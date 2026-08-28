"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { addCalendarDays, getDateInTimeZone, getWeekStart, localDateTimeToIso } from "@/lib/kav/dates";
import { getOperationalDay } from "@/lib/kav/operations";
import { getScheduleProposal, getTasksData } from "@/lib/kav/tasks";
import { evaluateTaskEligibility, type TaskInterval, type TaskRequirement } from "@/lib/kav/task-domain";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

type ManagerContext = Awaited<ReturnType<typeof requireManager>>;

export async function saveTaskTemplateAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const templateId = optionalText(formData, "template_id");
  const requirements = await parseRequirements(supabase, membership.team.id, formData);
  const values = {
    default_duration_minutes: optionalInteger(formData, "default_duration_minutes", 1, 1_440),
    default_location: optionalText(formData, "default_location"),
    description: optionalText(formData, "description"),
    is_active: formData.get("is_active") !== "off",
    name: requiredText(formData, "name", "שם התבנית"),
    team_id: membership.team.id,
  };

  const templateResult = templateId
    ? await supabase.from("task_templates").update(values).eq("team_id", membership.team.id).eq("id", templateId)
      .select("id").single()
    : await supabase.from("task_templates").insert(values).select("id").single();
  if (templateResult.error) throw new Error(`לא ניתן לשמור תבנית: ${templateResult.error.message}`);

  if (templateId) {
    const { error } = await supabase.from("task_template_requirements").delete()
      .eq("team_id", membership.team.id).eq("task_template_id", templateResult.data.id);
    if (error) throw new Error(`לא ניתן לעדכן דרישות תבנית: ${error.message}`);
  }
  const { error: requirementsError } = await supabase.from("task_template_requirements").insert(
    requirements.map((requirement, index) => ({
      ...toRequirementInsert(requirement),
      sort_order: index,
      task_template_id: templateResult.data.id,
      team_id: membership.team.id,
    })),
  );
  if (requirementsError) {
    if (!templateId) await supabase.from("task_templates").delete().eq("id", templateResult.data.id);
    throw new Error(`לא ניתן לשמור דרישות תבנית: ${requirementsError.message}`);
  }

  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?view=templates&saved=template`);
}

export async function setTaskTemplateActiveAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const templateId = requiredText(formData, "template_id", "תבנית");
  const { error } = await supabase.from("task_templates").update({ is_active: formData.get("is_active") === "true" })
    .eq("team_id", membership.team.id).eq("id", templateId);
  if (error) throw new Error(`לא ניתן לעדכן תבנית: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?view=templates&saved=template-status`);
}

export async function saveTaskAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const { membership, supabase, userId } = context;
  const taskId = optionalText(formData, "task_id");
  const reservePeriodId = requiredText(formData, "reserve_period_id", "תקופת מילואים");
  const date = requiredDate(formData, "date", "תאריך");
  const startTime = requiredTime(formData, "starts_time", "שעת התחלה");
  const endTime = requiredTime(formData, "ends_time", "שעת סיום");
  let endDate = optionalDate(formData, "ends_on") ?? date;
  if (endDate === date && endTime <= startTime) endDate = addCalendarDays(endDate, 1);
  const startsAt = localDateTimeToIso(membership.team.timezone, date, startTime);
  const endsAt = localDateTimeToIso(membership.team.timezone, endDate, endTime);
  if (endsAt <= startsAt) throw new Error("סיום המשימה חייב להיות אחרי ההתחלה");

  const period = await requirePeriod(context, reservePeriodId);
  if (date < period.starts_on || endDate > period.ends_on) {
    throw new Error("זמן המשימה חייב להישאר בתוך תקופת המילואים");
  }
  const templateId = optionalText(formData, "task_template_id");
  if (templateId) await assertTemplate(context, templateId);
  const publication = taskId
    ? await requireTaskPublication(context, taskId)
    : await ensureDraftPublication(context, period.id, date);
  await assertDraft(publication.status);
  const requirements = await requirementsForTask(context, formData, templateId);
  const values = {
    ends_at: endsAt,
    location: optionalText(formData, "location"),
    notes: optionalText(formData, "notes"),
    reserve_period_id: period.id,
    schedule_publication_id: publication.id,
    starts_at: startsAt,
    task_template_id: templateId,
    team_id: membership.team.id,
    title: requiredText(formData, "title", "שם המשימה"),
  };

  if (taskId) {
    const { count, error: assignmentError } = await supabase.from("task_assignments")
      .select("id", { count: "exact", head: true }).eq("team_id", membership.team.id)
      .eq("task_instance_id", taskId).eq("status", "assigned");
    if (assignmentError) throw new Error(`לא ניתן לבדוק שיבוצים: ${assignmentError.message}`);
    if (count) throw new Error("יש להסיר שיבוצים לפני שינוי דרישות או זמן המשימה");
    const { error } = await supabase.from("task_instances").update(values)
      .eq("team_id", membership.team.id).eq("id", taskId);
    if (error) throw new Error(`לא ניתן לעדכן משימה: ${error.message}`);
    const { error: deleteError } = await supabase.from("task_instance_requirements").delete()
      .eq("team_id", membership.team.id).eq("task_instance_id", taskId);
    if (deleteError) throw new Error(`לא ניתן לעדכן דרישות: ${deleteError.message}`);
    await insertTaskRequirements(context, taskId, requirements);
  } else {
    const { data: task, error } = await supabase.from("task_instances").insert({ ...values, created_by: userId })
      .select("id").single();
    if (error) throw new Error(`לא ניתן ליצור משימה: ${error.message}`);
    try {
      await insertTaskRequirements(context, task.id, requirements);
    } catch (error) {
      await supabase.from("task_instances").delete().eq("team_id", membership.team.id).eq("id", task.id);
      throw error;
    }
  }

  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?week=${publication.week_starts_on}&period=${period.id}&saved=task`);
}

export async function deleteTaskAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const taskId = requiredText(formData, "task_id", "משימה");
  const publication = await requireTaskPublication(context, taskId);
  await assertDraft(publication.status);
  const { error } = await context.supabase.from("task_instances").delete()
    .eq("team_id", context.membership.team.id).eq("id", taskId);
  if (error) throw new Error(`לא ניתן למחוק משימה: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?saved=task-deleted`);
}

export async function assignTaskPersonAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const { membership, supabase, userId } = context;
  const taskId = requiredText(formData, "task_id", "משימה");
  const requirementId = requiredText(formData, "requirement_id", "דרישה");
  const personId = requiredText(formData, "person_id", "איש צוות");
  const publication = await requireTaskPublication(context, taskId);
  await assertDraft(publication.status);
  const { data: task, error: taskError } = await supabase.from("task_instances").select("*")
    .eq("team_id", membership.team.id).eq("id", taskId).single();
  const { data: requirement, error: requirementError } = await supabase.from("task_instance_requirements").select("*")
    .eq("team_id", membership.team.id).eq("task_instance_id", taskId).eq("id", requirementId).single();
  const { data: person, error: personError } = await supabase.from("people").select("id, is_active")
    .eq("team_id", membership.team.id).eq("id", personId).single();
  if (taskError || requirementError || personError || !task || !requirement || !person) {
    throw new Error("המשימה, הדרישה או איש הצוות אינם שייכים לצוות הנוכחי");
  }
  const { count, error: countError } = await supabase.from("task_assignments")
    .select("id", { count: "exact", head: true }).eq("team_id", membership.team.id)
    .eq("task_instance_requirement_id", requirementId).eq("status", "assigned");
  if (countError) throw new Error(`לא ניתן לבדוק כיסוי: ${countError.message}`);
  if ((count ?? 0) >= requirement.required_count) throw new Error("דרישה זו כבר מאוישת במלואה");

  const candidate = await loadCandidateForTask(context, task, person.id, person.is_active);
  const domainRequirement: TaskRequirement = {
    id: requirement.id,
    pakalTypeId: requirement.pakal_type_id,
    requiredCount: requirement.required_count,
    requirementType: requirement.requirement_type,
    roleLabel: requirement.role_label,
    taskId: task.id,
    teamId: task.team_id,
  };
  const result = evaluateTaskEligibility({ candidate, requirement: domainRequirement, task: toTaskInterval(task) });
  if (result.hardBlocked) throw new Error(`השיבוץ אסור: ${result.reasons.join(", ")}`);
  const override = formData.get("availability_override") === "yes";
  if (!result.eligible && (!result.canOverride || !override)) {
    throw new Error("איש הצוות אינו זמין. יש לאשר חריגת זמינות במפורש.");
  }
  const { error } = await supabase.from("task_assignments").insert({
    assigned_by: userId,
    assignment_role: requirement.role_label,
    availability_override: !result.eligible,
    person_id: person.id,
    task_instance_id: task.id,
    task_instance_requirement_id: requirement.id,
    team_id: membership.team.id,
  });
  if (error) throw new Error(`לא ניתן לשבץ: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?task=${task.id}&saved=assignment`);
}

export async function removeTaskAssignmentAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const taskId = requiredText(formData, "task_id", "משימה");
  const assignmentId = requiredText(formData, "assignment_id", "שיבוץ");
  const publication = await requireTaskPublication(context, taskId);
  await assertDraft(publication.status);
  const { error } = await context.supabase.from("task_assignments").update({ status: "cancelled" })
    .eq("team_id", context.membership.team.id).eq("task_instance_id", taskId).eq("id", assignmentId);
  if (error) throw new Error(`לא ניתן להסיר שיבוץ: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?task=${taskId}&saved=assignment-removed`);
}

export async function applyScheduleProposalAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const week = requiredDate(formData, "week", "שבוע");
  const periodId = requiredText(formData, "period_id", "תקופת מילואים");
  const data = await getTasksData(context.supabase, context.membership, context.userId, { periodId, week });
  if (!data.publication) throw new Error("לא נמצאה טיוטת שבוע");
  await assertDraft(data.publication.status);
  const proposal = getScheduleProposal(data);
  if (!proposal?.proposals.length) throw new Error("אין שיבוצים חדשים להחלה");
  const requirementById = new Map(data.requirements.map((requirement) => [requirement.id, requirement]));
  const { error } = await context.supabase.from("task_assignments").insert(proposal.proposals.map((item) => {
    const requirement = requirementById.get(item.requirementId);
    if (!requirement || requirement.task_instance_id !== item.taskId) throw new Error("הצעת השיבוץ אינה תקינה");
    return {
      assigned_by: context.userId,
      assignment_role: requirement.role_label,
      availability_override: false,
      person_id: item.personId,
      task_instance_id: item.taskId,
      task_instance_requirement_id: item.requirementId,
      team_id: context.membership.team.id,
    };
  }));
  if (error) throw new Error(`לא ניתן להחיל הצעה: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?week=${week}&period=${periodId}&saved=proposal`);
}

export async function publishTaskWeekAction(teamSlug: string, formData: FormData) {
  const context = await requireManager(teamSlug);
  const week = requiredDate(formData, "week", "שבוע");
  const periodId = requiredText(formData, "period_id", "תקופת מילואים");
  const data = await getTasksData(context.supabase, context.membership, context.userId, { periodId, week });
  if (!data.publication || data.publication.status !== "draft") throw new Error("לא נמצאה טיוטה לפרסום");
  if (!data.tasks.length) throw new Error("לא ניתן לפרסם שבוע ללא משימות");
  if (data.tasks.some((task) => {
    const taskDate = getDateInTimeZone(data.team.timezone, new Date(task.starts_at));
    return taskDate < data.weekStartsOn || taskDate > data.weekEndsOn;
  })) {
    throw new Error("אחת המשימות נמצאת מחוץ לטווח השבוע");
  }
  const blockers = data.publicationIssues.filter((issue) => issue.severity === "block");
  if (blockers.length) throw new Error(`לא ניתן לפרסם: ${blockers.map((issue) => issue.message).join("; ")}`);
  const warnings = data.publicationIssues.filter((issue) => issue.severity === "warning");
  if (warnings.length && formData.get("confirm_warnings") !== "yes") {
    throw new Error("יש לאשר במפורש פרסום עם אזהרות זמינות");
  }
  const { error } = await context.supabase.from("schedule_publications").update({
    published_at: new Date().toISOString(),
    published_by: context.userId,
    status: "published",
  }).eq("team_id", context.membership.team.id).eq("id", data.publication.id).eq("status", "draft");
  if (error) throw new Error(`לא ניתן לפרסם: ${error.message}`);
  revalidateTasks(teamSlug);
  redirect(`/${teamSlug}/tasks?week=${week}&period=${periodId}&saved=published`);
}

async function requireManager(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) throw new Error("אין הרשאה לבצע פעולה זו");
  return { membership, supabase, userId };
}

async function requirePeriod(context: ManagerContext, periodId: string) {
  const { data, error } = await context.supabase.from("reserve_periods").select("*")
    .eq("team_id", context.membership.team.id).eq("id", periodId).maybeSingle();
  if (error || !data) throw new Error("תקופת המילואים אינה שייכת לצוות הנוכחי");
  return data;
}

async function assertTemplate(context: ManagerContext, templateId: string) {
  const { data, error } = await context.supabase.from("task_templates").select("id")
    .eq("team_id", context.membership.team.id).eq("id", templateId).eq("is_active", true).maybeSingle();
  if (error || !data) throw new Error("התבנית אינה שייכת לצוות הנוכחי");
}

async function ensureDraftPublication(context: ManagerContext, reservePeriodId: string, date: string) {
  const { data: settings } = await context.supabase.from("team_settings").select("week_start_day")
    .eq("team_id", context.membership.team.id).maybeSingle();
  const weekStartsOn = getWeekStart(date, settings?.week_start_day ?? 0);
  const { data, error } = await context.supabase.from("schedule_publications").upsert({
    reserve_period_id: reservePeriodId,
    status: "draft",
    team_id: context.membership.team.id,
    week_starts_on: weekStartsOn,
  }, { onConflict: "reserve_period_id,week_starts_on", ignoreDuplicates: true }).select("*").single();
  if (error || !data) {
    const existing = await context.supabase.from("schedule_publications").select("*")
      .eq("team_id", context.membership.team.id).eq("reserve_period_id", reservePeriodId)
      .eq("week_starts_on", weekStartsOn).single();
    if (existing.error || !existing.data) throw new Error(`לא ניתן ליצור טיוטת שבוע: ${error?.message ?? existing.error?.message}`);
    return existing.data;
  }
  return data;
}

async function requireTaskPublication(context: ManagerContext, taskId: string) {
  const { data: task, error } = await context.supabase.from("task_instances")
    .select("schedule_publication_id").eq("team_id", context.membership.team.id).eq("id", taskId).maybeSingle();
  if (error || !task) throw new Error("המשימה אינה שייכת לצוות הנוכחי");
  const { data, error: publicationError } = await context.supabase.from("schedule_publications").select("*")
    .eq("team_id", context.membership.team.id).eq("id", task.schedule_publication_id).maybeSingle();
  if (publicationError || !data) throw new Error("שבוע המשימה אינו תקין");
  return data;
}

async function requirementsForTask(context: ManagerContext, formData: FormData, templateId: string | null) {
  const submitted = await parseRequirements(context.supabase, context.membership.team.id, formData, true);
  if (submitted.length || !templateId) return submitted.length ? submitted : [defaultRequirement()];
  const { data, error } = await context.supabase.from("task_template_requirements").select("*")
    .eq("team_id", context.membership.team.id).eq("task_template_id", templateId).order("sort_order");
  if (error) throw new Error(`לא ניתן לטעון דרישות תבנית: ${error.message}`);
  return (data ?? []).map((item): RequirementDraft => ({
    pakalTypeId: item.pakal_type_id,
    requiredCount: item.required_count,
    requirementType: item.requirement_type === "pakal" ? "pakal" : "any_person",
    roleLabel: item.role_label,
  }));
}

async function insertTaskRequirements(context: ManagerContext, taskId: string, requirements: RequirementDraft[]) {
  const { error } = await context.supabase.from("task_instance_requirements").insert(requirements.map((requirement, index) => ({
    ...toRequirementInsert(requirement),
    sort_order: index,
    task_instance_id: taskId,
    team_id: context.membership.team.id,
  })));
  if (error) throw new Error(`לא ניתן לשמור דרישות משימה: ${error.message}`);
}

async function loadCandidateForTask(
  context: ManagerContext,
  task: { ends_at: string; id: string; reserve_period_id: string; starts_at: string; team_id: string },
  personId: string,
  isActive: boolean,
) {
  const date = getDateInTimeZone(context.membership.team.timezone, new Date(task.starts_at));
  const operational = await getOperationalDay(context.supabase, context.membership.team, date, task.reserve_period_id);
  const resolution = operational.people.find((person) => person.id === personId)?.resolution;
  if (!resolution) throw new Error("לא ניתן לחשב זמינות לאיש הצוות");
  const [pakalsResult, assignmentsResult] = await Promise.all([
    context.supabase.from("person_pakals").select("pakal_type_id").eq("team_id", context.membership.team.id)
      .eq("person_id", personId).eq("is_active", true),
    context.supabase.from("task_assignments").select("task_instance_id").eq("team_id", context.membership.team.id)
      .eq("person_id", personId).eq("status", "assigned"),
  ]);
  if (pakalsResult.error || assignmentsResult.error) throw new Error("לא ניתן לבדוק כשירות וחפיפות");
  const taskIds = (assignmentsResult.data ?? []).map((item) => item.task_instance_id);
  const tasksResult = taskIds.length
    ? await context.supabase.from("task_instances").select("id, team_id, starts_at, ends_at")
      .eq("team_id", context.membership.team.id).in("id", taskIds)
    : { data: [], error: null };
  if (tasksResult.error) throw new Error("לא ניתן לבדוק חפיפות משימה");
  return {
    assignments: (tasksResult.data ?? []).map(toTaskInterval),
    attendance: resolution.attendance,
    expectedAtBase: resolution.expectedAtBase,
    isActive,
    isOnApprovedLeave: resolution.leave !== null,
    isToday: date === getDateInTimeZone(context.membership.team.timezone),
    pakalTypeIds: (pakalsResult.data ?? []).map((item) => item.pakal_type_id),
    personId,
    teamId: context.membership.team.id,
  };
}

type RequirementDraft = {
  pakalTypeId: string | null;
  requiredCount: number;
  requirementType: "any_person" | "pakal";
  roleLabel: string;
};

async function parseRequirements(
  supabase: ManagerContext["supabase"],
  teamId: string,
  formData: FormData,
  allowEmpty = false,
): Promise<RequirementDraft[]> {
  const types = formData.getAll("requirement_type").filter((value): value is string => typeof value === "string");
  if (!types.length && allowEmpty) return [];
  const counts = formData.getAll("required_count");
  const pakals = formData.getAll("pakal_type_id");
  const labels = formData.getAll("role_label");
  const requirements = types.map((type, index): RequirementDraft => {
    if (type !== "any_person" && type !== "pakal") throw new Error("סוג דרישה אינו תקין");
    const requiredCount = Number(counts[index]);
    if (!Number.isInteger(requiredCount) || requiredCount < 1 || requiredCount > 50) throw new Error("כמות דרישה אינה תקינה");
    const pakalTypeId = type === "pakal" && typeof pakals[index] === "string" && pakals[index] ? String(pakals[index]) : null;
    if (type === "pakal" && !pakalTypeId) throw new Error("דרישת פק״ל חייבת לבחור הסמכה");
    const label = typeof labels[index] === "string" ? labels[index].trim() : "";
    return { pakalTypeId, requiredCount, requirementType: type, roleLabel: label || (type === "pakal" ? "פק״ל" : "כל איש צוות") };
  });
  const pakalIds = [...new Set(requirements.flatMap((item) => item.pakalTypeId ? [item.pakalTypeId] : []))];
  if (pakalIds.length) {
    const { data, error } = await supabase.from("pakal_types").select("id").eq("team_id", teamId).in("id", pakalIds).eq("is_active", true);
    if (error || (data?.length ?? 0) !== pakalIds.length) throw new Error("אחת מדרישות הפק״ל אינה שייכת לצוות");
  }
  return requirements.length ? requirements : [defaultRequirement()];
}

function defaultRequirement(): RequirementDraft {
  return { pakalTypeId: null, requiredCount: 1, requirementType: "any_person", roleLabel: "כל איש צוות" };
}

function toRequirementInsert(requirement: RequirementDraft) {
  return {
    pakal_type_id: requirement.pakalTypeId,
    required_count: requirement.requiredCount,
    requirement_type: requirement.requirementType,
    role_label: requirement.roleLabel,
  };
}

function toTaskInterval(task: { ends_at: string; id: string; starts_at: string; team_id: string }): TaskInterval {
  return { endsAt: task.ends_at, id: task.id, startsAt: task.starts_at, teamId: task.team_id };
}

function revalidateTasks(teamSlug: string) {
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/tasks`);
  revalidatePath(`/${teamSlug}/schedule`);
}

async function assertDraft(status: string) {
  if (status !== "draft") throw new Error("שבוע שפורסם נעול לשינויים");
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = optionalText(formData, key);
  if (!value) throw new Error(`${label} הוא שדה חובה`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) throw new Error("ערך טקסט ארוך מדי");
  return trimmed;
}

function requiredDate(formData: FormData, key: string, label: string) {
  const value = optionalDate(formData, key);
  if (!value) throw new Error(`${label} אינו תקין`);
  return value;
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function requiredTime(formData: FormData, key: string, label: string) {
  const value = optionalText(formData, key);
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${label} אינה תקינה`);
  return value;
}

function optionalInteger(formData: FormData, key: string, min: number, max: number) {
  const raw = optionalText(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error("ערך מספרי אינו תקין");
  return value;
}
