import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { addCalendarDays, getDateInTimeZone, getWeekStart, localDateTimeToIso } from "@/lib/kav/dates";
import { getOperationalRange } from "@/lib/kav/operations";
import { generateScheduleProposal, type SchedulerCandidate } from "@/lib/kav/scheduler";
import { selectOperationalReservePeriod } from "@/lib/kav/schedule-domain";
import {
  evaluateTaskEligibility,
  validateTaskPublication,
  type CandidateInput,
  type ExistingAssignment,
  type TaskInterval,
  type TaskRequirement,
} from "@/lib/kav/task-domain";
import { canManage, type TeamMembership } from "@/lib/kav/teams";

type Client = SupabaseClient<Database>;
type Row<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];

export type TaskCandidateAssessment = {
  canOverride: boolean;
  eligible: boolean;
  fullName: string;
  hardBlocked: boolean;
  personId: string;
  reasons: ReturnType<typeof evaluateTaskEligibility>["reasons"];
};

export type TasksData = {
  assignments: Row<"task_assignments">[];
  canManage: boolean;
  candidateAssessments: Record<string, TaskCandidateAssessment[]>;
  currentPersonId: string | null;
  people: Pick<Row<"people">, "full_name" | "id" | "is_active">[];
  periods: Row<"reserve_periods">[];
  publication: Row<"schedule_publications"> | null;
  publicationIssues: ReturnType<typeof validateTaskPublication>;
  requirements: Row<"task_instance_requirements">[];
  schedulerInput: {
    assignments: ExistingAssignment[];
    candidates: SchedulerCandidate[];
    requirements: TaskRequirement[];
    tasks: TaskInterval[];
  } | null;
  selectedPeriod: Row<"reserve_periods"> | null;
  taskTemplates: Row<"task_templates">[];
  templateRequirements: Row<"task_template_requirements">[];
  tasks: Row<"task_instances">[];
  team: TeamMembership["team"];
  pakalTypes: Row<"pakal_types">[];
  today: string;
  weekEndsOn: string;
  weekStartsOn: string;
  workload: Array<{ fullName: string; personId: string; taskCount: number; taskMinutes: number }>;
};

export async function getTasksData(
  supabase: Client,
  membership: TeamMembership,
  userId: string,
  options: { periodId?: string; selectedTaskId?: string; week?: string } = {},
): Promise<TasksData> {
  const team = membership.team;
  const manager = canManage(membership.role);
  const today = getDateInTimeZone(team.timezone);
  const [{ data: settings, error: settingsError }, { data: periods, error: periodsError }] = await Promise.all([
    supabase.from("team_settings").select("week_start_day").eq("team_id", team.id).maybeSingle(),
    supabase.from("reserve_periods").select("*").eq("team_id", team.id).order("starts_on", { ascending: false }),
  ]);
  assertOk(settingsError, "team settings");
  assertOk(periodsError, "reserve periods");
  const focusDate = isDate(options.week) ? options.week : today;
  const weekStartsOn = getWeekStart(focusDate, settings?.week_start_day ?? 0);
  const weekEndsOn = addCalendarDays(weekStartsOn, 6);
  const allPeriods = periods ?? [];
  const selectedPeriod = allPeriods.find((period) => period.id === options.periodId) ??
    selectOperationalReservePeriod(allPeriods, focusDate) ??
    (manager ? allPeriods.find((period) => period.starts_on <= weekEndsOn && period.ends_on >= weekStartsOn) : undefined) ?? null;

  const base = {
    canManage: manager,
    periods: allPeriods,
    selectedPeriod,
    team,
    today,
    weekEndsOn,
    weekStartsOn,
  };
  if (!selectedPeriod) return emptyTasksData(base);

  const [publicationResult, pakalsResult, templatesResult, currentPersonResult] = await Promise.all([
    supabase.from("schedule_publications").select("*").eq("team_id", team.id)
      .eq("reserve_period_id", selectedPeriod.id).eq("week_starts_on", weekStartsOn).maybeSingle(),
    manager ? supabase.from("pakal_types").select("*").eq("team_id", team.id).eq("is_active", true).order("name")
      : Promise.resolve({ data: [], error: null }),
    manager ? supabase.from("task_templates").select("*").eq("team_id", team.id).order("name")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("people").select("id").eq("team_id", team.id).eq("auth_user_id", userId).maybeSingle(),
  ]);
  [publicationResult, pakalsResult, templatesResult, currentPersonResult]
    .forEach((result) => assertOk(result.error, "task planning data"));
  const publication = publicationResult.data;
  const templates = templatesResult.data ?? [];
  const templateIds = templates.map((template) => template.id);
  const templateRequirementsResult = manager && templateIds.length
    ? await supabase.from("task_template_requirements").select("*").eq("team_id", team.id)
      .in("task_template_id", templateIds).order("sort_order")
    : { data: [], error: null };
  assertOk(templateRequirementsResult.error, "task template requirements");

  if (!publication) {
    return {
      ...emptyTasksData(base),
      currentPersonId: currentPersonResult.data?.id ?? null,
      pakalTypes: pakalsResult.data ?? [],
      taskTemplates: templates,
      templateRequirements: templateRequirementsResult.data ?? [],
    };
  }

  const { data: tasks, error: tasksError } = await supabase.from("task_instances").select("*")
    .eq("team_id", team.id).eq("schedule_publication_id", publication.id).order("starts_at");
  assertOk(tasksError, "task instances");
  const taskRows = tasks ?? [];
  const taskIds = taskRows.map((task) => task.id);
  const [requirementsResult, assignmentsResult] = taskIds.length ? await Promise.all([
    supabase.from("task_instance_requirements").select("*").eq("team_id", team.id)
      .in("task_instance_id", taskIds).order("sort_order"),
    supabase.from("task_assignments").select("*").eq("team_id", team.id)
      .in("task_instance_id", taskIds).eq("status", "assigned"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  assertOk(requirementsResult.error, "task requirements");
  assertOk(assignmentsResult.error, "task assignments");
  const requirements = requirementsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];

  const assignedPersonIds = [...new Set(assignments.map((assignment) => assignment.person_id))];
  const peopleResult = assignedPersonIds.length && !manager
    ? await supabase.from("people").select("id, full_name, is_active").eq("team_id", team.id).in("id", assignedPersonIds)
    : { data: [], error: null };
  assertOk(peopleResult.error, "assigned people");

  if (!manager) {
    return {
      ...base,
      assignments,
      candidateAssessments: {},
      currentPersonId: currentPersonResult.data?.id ?? null,
      pakalTypes: [],
      people: peopleResult.data ?? [],
      publication,
      publicationIssues: [],
      requirements,
      schedulerInput: null,
      taskTemplates: [],
      templateRequirements: [],
      tasks: taskRows,
      workload: [],
    };
  }

  const operational = await getOperationalRange(supabase, team, selectedPeriod, weekStartsOn, weekEndsOn);
  const weekStartsAt = localDateTimeToIso(team.timezone, weekStartsOn);
  const weekEndsAt = localDateTimeToIso(team.timezone, addCalendarDays(weekEndsOn, 1));
  const [personPakalsResult, conflictTasksResult] = await Promise.all([
    supabase.from("person_pakals").select("person_id, pakal_type_id").eq("team_id", team.id).eq("is_active", true),
    supabase.from("task_instances").select("id, team_id, starts_at, ends_at").eq("team_id", team.id)
      .lt("starts_at", weekEndsAt).gt("ends_at", weekStartsAt),
  ]);
  assertOk(personPakalsResult.error, "person qualifications");
  assertOk(conflictTasksResult.error, "assignment conflict tasks");
  const conflictTasks = conflictTasksResult.data ?? [];
  const conflictTaskIds = conflictTasks.map((item) => item.id);
  const allAssignmentsResult = conflictTaskIds.length
    ? await supabase.from("task_assignments").select("*").eq("team_id", team.id)
      .in("task_instance_id", conflictTaskIds).eq("status", "assigned")
    : { data: [], error: null };
  assertOk(allAssignmentsResult.error, "assignment conflicts");
  const allAssignments = allAssignmentsResult.data ?? [];
  const taskIntervalsById = new Map(conflictTasks.map((item) => [item.id, toTaskInterval(item)]));
  const domainTasks = taskRows.map(toTaskInterval);
  const domainRequirements = requirements.map(toTaskRequirement);
  const domainAssignments = assignments.map(toExistingAssignment);
  const pakalsByPerson = groupValues(personPakalsResult.data ?? [], "person_id", "pakal_type_id");
  const tasksByPerson = new Map<string, TaskInterval[]>();
  for (const assignment of allAssignments) {
    const interval = taskIntervalsById.get(assignment.task_instance_id);
    if (!interval) continue;
    tasksByPerson.set(assignment.person_id, [...(tasksByPerson.get(assignment.person_id) ?? []), interval]);
  }
  const candidateInputs = operational.people.map((person) => candidateForPublication(
    person,
    team.id,
    pakalsByPerson.get(person.id) ?? [],
    tasksByPerson.get(person.id) ?? [],
  ));
  const schedulerCandidates: SchedulerCandidate[] = operational.people.map((person) => {
    const existingTasks = tasksByPerson.get(person.id) ?? [];
    const weeklyTasks = existingTasks.filter((item) => item.startsAt < localDateTimeToIso(team.timezone, addCalendarDays(weekEndsOn, 1)) &&
      item.endsAt > localDateTimeToIso(team.timezone, weekStartsOn));
    return {
      personId: person.id,
      fullName: person.full_name,
      teamId: team.id,
      isActive: person.is_active,
      pakalTypeIds: pakalsByPerson.get(person.id) ?? [],
      existingTasks,
      weeklyTaskCount: weeklyTasks.length,
      weeklyTaskMinutes: weeklyTasks.reduce((total, item) => total + durationMinutes(item), 0),
      availabilityByTaskId: Object.fromEntries(taskRows.map((task) => {
        const date = getDateInTimeZone(team.timezone, new Date(task.starts_at));
        const resolution = operational.resolve(person.id, date);
        return [task.id, {
          attendance: resolution.attendance,
          expectedAtBase: resolution.expectedAtBase,
          isOnApprovedLeave: resolution.leave !== null,
          isToday: date === today,
        }];
      })),
    };
  });
  const schedulerInput = { assignments: domainAssignments, candidates: schedulerCandidates, requirements: domainRequirements, tasks: domainTasks };
  const candidateAssessments: Record<string, TaskCandidateAssessment[]> = {};
  for (const requirement of domainRequirements) {
    const task = domainTasks.find((item) => item.id === requirement.taskId);
    if (!task) continue;
    candidateAssessments[requirement.id] = schedulerCandidates.map((candidate) => {
      const availability = candidate.availabilityByTaskId[task.id];
      const result = evaluateTaskEligibility({
        candidate: { ...candidate, ...availability, assignments: candidate.existingTasks },
        requirement,
        task,
      });
      return { ...result, fullName: candidate.fullName, personId: candidate.personId };
    }).sort((left, right) => Number(left.hardBlocked) - Number(right.hardBlocked) ||
      Number(!left.eligible) - Number(!right.eligible) || left.fullName.localeCompare(right.fullName, "he"));
  }
  const peopleById = new Map(operational.people.map((person) => [person.id, person.full_name]));
  const workload = schedulerCandidates.map((candidate) => ({
    fullName: peopleById.get(candidate.personId) ?? candidate.fullName,
    personId: candidate.personId,
    taskCount: candidate.weeklyTaskCount,
    taskMinutes: candidate.weeklyTaskMinutes,
  })).sort((left, right) => right.taskMinutes - left.taskMinutes || left.fullName.localeCompare(right.fullName, "he"));
  const structuralIssues = validateTaskPublication({
    assignments: domainAssignments,
    candidates: candidateInputs,
    requirements: domainRequirements,
    tasks: domainTasks,
  });
  const availabilityIssues = assignments.flatMap((assignment) => {
    const task = taskRows.find((item) => item.id === assignment.task_instance_id);
    if (!task) return [];
    const date = getDateInTimeZone(team.timezone, new Date(task.starts_at));
    const resolution = operational.resolve(assignment.person_id, date);
    const unavailable = resolution.leave !== null || !resolution.expectedAtBase ||
      (date === today && resolution.attendance === "absent");
    return unavailable ? [{
      code: "availability" as const,
      message: "שיבוץ לאדם שאינו זמין תפעולית",
      severity: "warning" as const,
      taskId: task.id,
    }] : [];
  });

  return {
    ...base,
    assignments,
    candidateAssessments,
    currentPersonId: currentPersonResult.data?.id ?? null,
    pakalTypes: pakalsResult.data ?? [],
    people: operational.people,
    publication,
    publicationIssues: [...structuralIssues, ...availabilityIssues],
    requirements,
    schedulerInput,
    taskTemplates: templates,
    templateRequirements: templateRequirementsResult.data ?? [],
    tasks: taskRows,
    workload,
  };
}

export function getScheduleProposal(data: TasksData) {
  return data.schedulerInput ? generateScheduleProposal(data.schedulerInput) : null;
}

export type TaskDaySchedule = {
  assignments: Row<"task_assignments">[];
  people: Pick<Row<"people">, "full_name" | "id">[];
  publicationStatus: "draft" | "published" | null;
  requirements: Row<"task_instance_requirements">[];
  tasks: Row<"task_instances">[];
};

export async function getTaskDaySchedule(
  supabase: Client,
  membership: TeamMembership,
  date: string,
  periodId: string,
): Promise<TaskDaySchedule> {
  const { team } = membership;
  const { data: settings, error: settingsError } = await supabase.from("team_settings").select("week_start_day")
    .eq("team_id", team.id).maybeSingle();
  assertOk(settingsError, "task week settings");
  const weekStartsOn = getWeekStart(date, settings?.week_start_day ?? 0);
  const { data: publication, error: publicationError } = await supabase.from("schedule_publications").select("*")
    .eq("team_id", team.id).eq("reserve_period_id", periodId).eq("week_starts_on", weekStartsOn).maybeSingle();
  assertOk(publicationError, "task day publication");
  if (!publication) return { assignments: [], people: [], publicationStatus: null, requirements: [], tasks: [] };
  const startsAt = localDateTimeToIso(team.timezone, date);
  const endsAt = localDateTimeToIso(team.timezone, addCalendarDays(date, 1));
  const { data: tasks, error: tasksError } = await supabase.from("task_instances").select("*")
    .eq("team_id", team.id).eq("schedule_publication_id", publication.id)
    .lt("starts_at", endsAt).gt("ends_at", startsAt).order("starts_at");
  assertOk(tasksError, "task day instances");
  const taskRows = tasks ?? [];
  const taskIds = taskRows.map((task) => task.id);
  if (!taskIds.length) return { assignments: [], people: [], publicationStatus: publication.status, requirements: [], tasks: [] };
  const [requirementsResult, assignmentsResult] = await Promise.all([
    supabase.from("task_instance_requirements").select("*").eq("team_id", team.id).in("task_instance_id", taskIds).order("sort_order"),
    supabase.from("task_assignments").select("*").eq("team_id", team.id).in("task_instance_id", taskIds).eq("status", "assigned"),
  ]);
  assertOk(requirementsResult.error, "task day requirements");
  assertOk(assignmentsResult.error, "task day assignments");
  const personIds = [...new Set((assignmentsResult.data ?? []).map((assignment) => assignment.person_id))];
  const peopleResult = personIds.length
    ? await supabase.from("people").select("id, full_name").eq("team_id", team.id).in("id", personIds)
    : { data: [], error: null };
  assertOk(peopleResult.error, "task day people");
  return {
    assignments: assignmentsResult.data ?? [],
    people: peopleResult.data ?? [],
    publicationStatus: publication.status,
    requirements: requirementsResult.data ?? [],
    tasks: taskRows,
  };
}

export async function getNextPersonalTask(
  supabase: Client,
  team: TeamMembership["team"],
  userId: string,
) {
  const { data: person, error: personError } = await supabase.from("people").select("id")
    .eq("team_id", team.id).eq("auth_user_id", userId).maybeSingle();
  assertOk(personError, "personal task identity");
  if (!person) return null;
  const { data: assignments, error: assignmentsError } = await supabase.from("task_assignments")
    .select("task_instance_id").eq("team_id", team.id).eq("person_id", person.id).eq("status", "assigned");
  assertOk(assignmentsError, "personal task assignments");
  const taskIds = (assignments ?? []).map((assignment) => assignment.task_instance_id);
  if (!taskIds.length) return null;
  const { data: tasks, error: tasksError } = await supabase.from("task_instances").select("*")
    .eq("team_id", team.id).in("id", taskIds).gte("ends_at", new Date().toISOString()).order("starts_at").limit(1);
  assertOk(tasksError, "next personal task");
  const task = tasks?.[0];
  if (!task) return null;
  const { data: teammates, error: teammatesError } = await supabase.from("task_assignments").select("person_id")
    .eq("team_id", team.id).eq("task_instance_id", task.id).eq("status", "assigned").neq("person_id", person.id);
  assertOk(teammatesError, "personal task teammates");
  const teammateIds = (teammates ?? []).map((assignment) => assignment.person_id);
  const peopleResult = teammateIds.length
    ? await supabase.from("people").select("full_name").eq("team_id", team.id).in("id", teammateIds)
    : { data: [], error: null };
  assertOk(peopleResult.error, "personal task teammate names");
  return {
    endsAt: task.ends_at,
    startsAt: task.starts_at,
    teammateNames: (peopleResult.data ?? []).map((item) => item.full_name),
    title: task.title,
  };
}

function emptyTasksData(base: Pick<TasksData, "canManage" | "periods" | "selectedPeriod" | "team" | "today" | "weekEndsOn" | "weekStartsOn">): TasksData {
  return {
    ...base,
    assignments: [],
    candidateAssessments: {},
    currentPersonId: null,
    pakalTypes: [],
    people: [],
    publication: null,
    publicationIssues: [],
    requirements: [],
    schedulerInput: null,
    taskTemplates: [],
    templateRequirements: [],
    tasks: [],
    workload: [],
  };
}

function candidateForPublication(
  person: Pick<Row<"people">, "id" | "is_active">,
  teamId: string,
  pakalTypeIds: string[],
  assignments: TaskInterval[],
): CandidateInput {
  return {
    assignments,
    attendance: "unreported",
    expectedAtBase: true,
    isActive: person.is_active,
    isOnApprovedLeave: false,
    isToday: false,
    pakalTypeIds,
    personId: person.id,
    teamId,
  };
}

function toTaskInterval(task: { ends_at: string; id: string; starts_at: string; team_id: string }): TaskInterval {
  return { endsAt: task.ends_at, id: task.id, startsAt: task.starts_at, teamId: task.team_id };
}

function toTaskRequirement(requirement: Row<"task_instance_requirements">): TaskRequirement {
  return {
    id: requirement.id,
    pakalTypeId: requirement.pakal_type_id,
    requiredCount: requirement.required_count,
    requirementType: requirement.requirement_type,
    roleLabel: requirement.role_label,
    taskId: requirement.task_instance_id,
    teamId: requirement.team_id,
  };
}

function toExistingAssignment(assignment: Row<"task_assignments">): ExistingAssignment {
  return {
    id: assignment.id,
    personId: assignment.person_id,
    requirementId: assignment.task_instance_requirement_id,
    status: assignment.status,
    taskId: assignment.task_instance_id,
    teamId: assignment.team_id,
  };
}

function groupValues<RowType extends Record<string, string>, Key extends keyof RowType, Value extends keyof RowType>(
  rows: RowType[], key: Key, value: Value,
) {
  const grouped = new Map<string, string[]>();
  rows.forEach((row) => grouped.set(row[key], [...(grouped.get(row[key]) ?? []), row[value]]));
  return grouped;
}

function durationMinutes(task: TaskInterval) {
  return Math.max(0, Math.round((Date.parse(task.endsAt) - Date.parse(task.startsAt)) / 60_000));
}

function isDate(value?: string): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertOk(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
}
