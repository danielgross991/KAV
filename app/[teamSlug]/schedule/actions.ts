"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json } from "@/lib/database.types";
import { addCalendarDays, getDateInTimeZone, localDateTimeToIso } from "@/lib/kav/dates";
import { requireAuth } from "@/lib/kav/auth";
import { generateRotationBlocks, overlaps, validateScheduleForPublication, type RotationState } from "@/lib/kav/schedule-domain";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

const PHASE_TYPES = ["preparation", "line", "stand_down", "processing", "other"];
const EVENT_TYPES = ["briefing", "training", "family", "processing", "changeover", "holiday", "other"];

export async function createReservePeriodAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const startsOn = required(formData, "starts_on", "תאריך התחלה");
  const endsOn = required(formData, "ends_on", "תאריך סיום");
  assertDateRange(startsOn, endsOn);
  const { data, error } = await context.supabase.from("reserve_periods").insert({
    team_id: context.team.id, name: required(formData, "name", "שם התקופה"),
    location: optional(formData, "location"), starts_on: startsOn, ends_on: endsOn,
    status: "draft", created_by: context.userId,
  }).select("id").single();
  assertOk(error, "יצירת תקופת המילואים");
  if (!data) throw new Error("תקופת המילואים לא נוצרה");
  redirect(`/${teamSlug}/schedule?period=${data.id}&manage=1`);
}

export async function savePhaseAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  assertDraft(period);
  const startsOn = required(formData, "starts_on", "תאריך התחלה");
  const endsOn = required(formData, "ends_on", "תאריך סיום");
  assertInsidePeriod(startsOn, endsOn, period);
  const phaseType = enumValue(formData, "phase_type", PHASE_TYPES, "סוג שלב");
  const id = optional(formData, "id");
  const { data: existing } = await context.supabase.from("period_phases").select("id, starts_on, ends_on")
    .eq("team_id", context.team.id).eq("reserve_period_id", period.id);
  if ((existing ?? []).some((phase) => phase.id !== id && overlaps(
    { startsOn, endsOn }, { startsOn: phase.starts_on, endsOn: phase.ends_on },
  ))) throw new Error("שלבים אינם יכולים לחפוף");
  const payload = {
    team_id: context.team.id, reserve_period_id: period.id,
    name: required(formData, "name", "שם השלב"), phase_type: phaseType,
    starts_on: startsOn, ends_on: endsOn, notes: optional(formData, "notes"),
    sort_order: integer(formData, "sort_order", 0, 999),
  };
  const result = id
    ? await context.supabase.from("period_phases").update(payload).eq("id", id).eq("team_id", context.team.id)
    : await context.supabase.from("period_phases").insert(payload);
  assertOk(result.error, "שמירת השלב");
  refresh(teamSlug);
}

export async function deletePhaseAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const id = required(formData, "id", "שלב");
  const { data: phase } = await context.supabase.from("period_phases").select("reserve_period_id")
    .eq("id", id).eq("team_id", context.team.id).maybeSingle();
  if (!phase) throw new Error("השלב לא נמצא");
  assertDraft(await ownedPeriod(context, phase.reserve_period_id));
  const { error } = await context.supabase.from("period_phases").delete()
    .eq("id", id).eq("team_id", context.team.id);
  assertOk(error, "מחיקת השלב"); refresh(teamSlug);
}

export async function saveRotationGroupAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  assertDraft(period);
  const initialState = enumValue(formData, "initial_state", ["base", "home"], "מצב פתיחה") as RotationState;
  const id = optional(formData, "id");
  const payload = {
    team_id: context.team.id, reserve_period_id: period.id,
    name: required(formData, "name", "שם הסבב"), color_token: optional(formData, "color_token") ?? "blue",
    sort_order: integer(formData, "sort_order", 0, 999), initial_state: initialState,
  };
  const result = id
    ? await context.supabase.from("rotation_groups").update(payload).eq("id", id).eq("team_id", context.team.id)
    : await context.supabase.from("rotation_groups").insert(payload);
  assertOk(result.error, "שמירת הסבב"); refresh(teamSlug);
}

export async function deleteRotationGroupAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const id = required(formData, "id", "סבב");
  const { data: group } = await context.supabase.from("rotation_groups").select("reserve_period_id")
    .eq("id", id).eq("team_id", context.team.id).maybeSingle();
  if (!group) throw new Error("הסבב לא נמצא");
  assertDraft(await ownedPeriod(context, group.reserve_period_id));
  const { error } = await context.supabase.from("rotation_groups").delete()
    .eq("id", id).eq("team_id", context.team.id);
  assertOk(error, "מחיקת הסבב"); refresh(teamSlug);
}

export async function assignRotationMemberAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  const personId = required(formData, "person_id", "איש צוות");
  const groupId = optional(formData, "rotation_group_id");
  const [{ data: person }, { data: groups }] = await Promise.all([
    context.supabase.from("people").select("id").eq("id", personId).eq("team_id", context.team.id).maybeSingle(),
    context.supabase.from("rotation_groups").select("id").eq("reserve_period_id", period.id).eq("team_id", context.team.id),
  ]);
  if (!person) throw new Error("איש הצוות לא נמצא");
  const groupIds = (groups ?? []).map((group) => group.id);
  if (groupId && !groupIds.includes(groupId)) throw new Error("הסבב אינו שייך לתקופה");
  const startsOn = optional(formData, "starts_on");
  const endsOn = optional(formData, "ends_on");
  if (groupId) assertInsidePeriod(startsOn ?? period.starts_on, endsOn ?? period.ends_on, period);
  if (groupIds.length) {
    const { error } = await context.supabase.from("rotation_members").delete()
      .eq("person_id", personId).eq("team_id", context.team.id).in("rotation_group_id", groupIds);
    assertOk(error, "עדכון שיוך הסבב");
  }
  if (groupId) {
    const { error } = await context.supabase.from("rotation_members").insert({
      team_id: context.team.id, rotation_group_id: groupId, person_id: personId,
      starts_on: startsOn, ends_on: endsOn,
    });
    assertOk(error, "שיוך איש הצוות");
  }
  refresh(teamSlug);
}

export async function generateRotationBlocksAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  assertDraft(period);
  const anchorDate = required(formData, "anchor_date", "תאריך עוגן");
  const baseDays = integer(formData, "base_days", 1, 90);
  const homeDays = integer(formData, "home_days", 1, 90);
  const [{ data: groups, error: groupsError }, { data: existing, error: blocksError }] = await Promise.all([
    context.supabase.from("rotation_groups").select("id, name, initial_state").eq("team_id", context.team.id).eq("reserve_period_id", period.id).order("sort_order"),
    context.supabase.from("rotation_blocks").select("*").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
  ]);
  assertOk(groupsError, "טעינת הסבבים"); assertOk(blocksError, "טעינת הבלוקים");
  if (!groups?.length) throw new Error("יש ליצור לפחות סבב אחד לפני יצירת הלו״ז");
  if ((existing ?? []).some((block) => block.source === "generated") && formData.get("confirm_replace") !== "yes") {
    throw new Error("כבר קיים לו״ז. יש לאשר יצירה מחדש במפורש");
  }
  const preview = generateRotationBlocks({
    period: { startsOn: period.starts_on, endsOn: period.ends_on }, anchorDate, baseDays, homeDays,
    groups: groups.map((group) => ({ id: group.id, initialState: group.initial_state })),
  });
  const manualBlocks = (existing ?? []).filter((block) => block.source === "manual");
  const seriesByGroup = new Map(groups.map((group) => [group.id, randomUUID()]));
  const generated = preview.flatMap((block) => subtractManualRanges(block, manualBlocks)
    .map((piece, sequenceNo) => ({
      rotation_group_id: piece.groupId, state: piece.state, starts_on: piece.startsOn,
      ends_on: piece.endsOn, series_key: seriesByGroup.get(piece.groupId), sequence_no: sequenceNo,
    })));
  const { error } = await context.supabase.rpc("replace_generated_rotation_blocks", {
    target_team_id: context.team.id, target_reserve_period_id: period.id,
    generator_config: { anchor_date: anchorDate, base_days: baseDays, home_days: homeDays },
    generated_blocks: generated as Json,
  });
  assertOk(error, "יצירת הסבבים"); refresh(teamSlug);
}

export async function editRotationBlockAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const state = enumValue(formData, "state", ["base", "home"], "מצב") as RotationState;
  const id = required(formData, "id", "בלוק");
  const { data: block } = await context.supabase.from("rotation_blocks").select("*")
    .eq("id", id).eq("team_id", context.team.id).maybeSingle();
  if (!block) throw new Error("הבלוק לא נמצא");
  const period = await ownedPeriod(context, block.reserve_period_id);
  assertDraft(period);
  if (formData.get("scope") === "following") {
    const { data: config } = await context.supabase.from("rotation_generation_configs").select("*")
      .eq("reserve_period_id", block.reserve_period_id).eq("team_id", context.team.id).maybeSingle();
    if (!config) throw new Error("לא נמצאה תצורת סבבים");
    const generated = generateRotationBlocks({
      period: { startsOn: block.starts_on, endsOn: period.ends_on }, anchorDate: block.starts_on,
      baseDays: config.base_days, homeDays: config.home_days,
      groups: [{ id: block.rotation_group_id, initialState: state }],
    });
    const seriesKey = randomUUID();
    const { error } = await context.supabase.rpc("replace_rotation_series_from", {
      target_team_id: context.team.id,
      target_reserve_period_id: block.reserve_period_id,
      target_rotation_group_id: block.rotation_group_id,
      replace_from: block.starts_on,
      replacement_blocks: generated.map((item) => ({
        state: item.state, starts_on: item.startsOn, ends_on: item.endsOn,
        series_key: seriesKey, sequence_no: item.sequenceNo,
      })) as Json,
    });
    assertOk(error, "עדכון המשך הסדרה");
  } else {
    const { error } = await context.supabase.from("rotation_blocks").update({ state, source: "manual" })
      .eq("id", id).eq("team_id", context.team.id);
    assertOk(error, "עדכון הבלוק");
  }
  refresh(teamSlug);
}

export async function saveRotationOverrideAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  const startsOn = required(formData, "starts_on", "תאריך התחלה");
  const endsOn = required(formData, "ends_on", "תאריך סיום");
  assertInsidePeriod(startsOn, endsOn, period);
  const personId = required(formData, "person_id", "איש צוות");
  const fromGroupId = optional(formData, "from_rotation_group_id");
  const toGroupId = required(formData, "to_rotation_group_id", "סבב חלופי");
  const [{ data: person, error: personError }, { data: groups, error: groupsError }] = await Promise.all([
    context.supabase.from("people").select("id").eq("id", personId).eq("team_id", context.team.id).maybeSingle(),
    context.supabase.from("rotation_groups").select("id").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
  ]);
  assertOk(personError, "טעינת איש הצוות");
  assertOk(groupsError, "טעינת הסבבים");
  if (!person) throw new Error("איש הצוות אינו שייך לצוות");
  const groupIds = new Set((groups ?? []).map((group) => group.id));
  if (!groupIds.has(toGroupId)) throw new Error("הסבב החלופי אינו שייך לתקופה");
  if (fromGroupId && !groupIds.has(fromGroupId)) throw new Error("סבב המקור אינו שייך לתקופה");

  const payload = {
    team_id: context.team.id, reserve_period_id: period.id,
    person_id: personId, from_rotation_group_id: fromGroupId, to_rotation_group_id: toGroupId,
    starts_on: startsOn, ends_on: endsOn, reason: optional(formData, "reason"), created_by: context.userId,
  };
  const { error } = await context.supabase.from("rotation_overrides").insert(payload);
  assertOk(error, "שמירת חריג הסבב"); refresh(teamSlug);
}

export async function saveScheduleEventAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  const isAllDay = formData.get("is_all_day") === "on";
  const startsOn = required(formData, "starts_on", "תאריך");
  const endsOn = optional(formData, "ends_on") ?? startsOn;
  assertInsidePeriod(startsOn, endsOn, period);
  const startsAt = localDateTimeToIso(context.team.timezone, startsOn, isAllDay ? "00:00" : required(formData, "starts_time", "שעת התחלה"));
  const endsAt = localDateTimeToIso(context.team.timezone, endsOn, isAllDay ? "23:59" : (optional(formData, "ends_time") ?? required(formData, "starts_time", "שעת התחלה")));
  const payload = {
    team_id: context.team.id, reserve_period_id: period.id,
    title: required(formData, "title", "כותרת"), event_type: enumValue(formData, "event_type", EVENT_TYPES, "סוג אירוע"),
    starts_at: startsAt, ends_at: endsAt, location: optional(formData, "location"),
    notes: optional(formData, "notes"), is_all_day: isAllDay, created_by: context.userId,
  };
  const id = optional(formData, "id");
  const result = id
    ? await context.supabase.from("schedule_events").update(payload).eq("id", id).eq("team_id", context.team.id)
    : await context.supabase.from("schedule_events").insert(payload);
  assertOk(result.error, "שמירת האירוע"); refresh(teamSlug);
}

export async function deleteScheduleEventAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const { error } = await context.supabase.from("schedule_events").delete()
    .eq("id", required(formData, "id", "אירוע")).eq("team_id", context.team.id);
  assertOk(error, "מחיקת האירוע"); refresh(teamSlug);
}

export async function publishReservePeriodAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  assertDraft(period);
  const [{ data: people }, { data: groups }, { data: phases }, { data: blocks }, { data: overrides }] = await Promise.all([
    context.supabase.from("people").select("id").eq("team_id", context.team.id).eq("is_active", true),
    context.supabase.from("rotation_groups").select("id").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
    context.supabase.from("period_phases").select("starts_on, ends_on, phase_type").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
    context.supabase.from("rotation_blocks").select("rotation_group_id, state, starts_on, ends_on").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
    context.supabase.from("rotation_overrides").select("person_id, from_rotation_group_id, to_rotation_group_id, starts_on, ends_on").eq("team_id", context.team.id).eq("reserve_period_id", period.id),
  ]);
  const groupIds = (groups ?? []).map((group) => group.id);
  const { data: memberships } = groupIds.length
    ? await context.supabase.from("rotation_members").select("person_id, rotation_group_id, starts_on, ends_on").eq("team_id", context.team.id).in("rotation_group_id", groupIds)
    : { data: [] };
  const issues = validateScheduleForPublication({
    period: { startsOn: period.starts_on, endsOn: period.ends_on },
    activePeopleIds: (people ?? []).map((person) => person.id), groups: groups ?? [],
    memberships: (memberships ?? []).map((item) => ({ personId: item.person_id, groupId: item.rotation_group_id, startsOn: item.starts_on ?? period.starts_on, endsOn: item.ends_on ?? period.ends_on })),
    blocks: (blocks ?? []).map((item) => ({ groupId: item.rotation_group_id, state: item.state as RotationState, startsOn: item.starts_on, endsOn: item.ends_on })),
    overrides: (overrides ?? []).flatMap((item) => item.to_rotation_group_id ? [{ personId: item.person_id, fromGroupId: item.from_rotation_group_id, toGroupId: item.to_rotation_group_id, startsOn: item.starts_on, endsOn: item.ends_on }] : []),
    phases: (phases ?? []).map((phase) => ({ startsOn: phase.starts_on, endsOn: phase.ends_on, type: phase.phase_type })),
  });
  if (issues.some((issue) => issue.severity === "error")) throw new Error(`לא ניתן לפרסם: ${issues.map((issue) => issue.message).join("; ")}`);
  const { error } = await context.supabase.from("reserve_periods").update({ status: "published" })
    .eq("id", period.id).eq("team_id", context.team.id);
  assertOk(error, "פרסום התקופה"); refresh(teamSlug);
}

export async function advanceReservePeriodStatusAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const period = await ownedPeriod(context, required(formData, "reserve_period_id", "תקופה"));
  const transitions: Record<string, string> = { published: "active", active: "completed", completed: "archived" };
  const nextStatus = transitions[period.status];
  if (!nextStatus) throw new Error("לא ניתן לקדם את התקופה מהסטטוס הנוכחי");
  if (nextStatus === "active") {
    const today = getDateInTimeZone(context.team.timezone);
    if (today < period.starts_on || today > period.ends_on) {
      throw new Error("אפשר להפעיל תקופה רק כאשר התאריך הנוכחי נמצא בטווח שלה");
    }
  }
  const { error } = await context.supabase.from("reserve_periods").update({ status: nextStatus })
    .eq("id", period.id).eq("team_id", context.team.id);
  assertOk(error, "עדכון סטטוס התקופה"); refresh(teamSlug);
}

async function managerContext(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) throw new Error("אין הרשאה לניהול הלו״ז");
  return { supabase, userId, team: membership.team };
}

async function ownedPeriod(context: Awaited<ReturnType<typeof managerContext>>, id: string) {
  const { data, error } = await context.supabase.from("reserve_periods").select("*")
    .eq("id", id).eq("team_id", context.team.id).maybeSingle();
  assertOk(error, "טעינת התקופה"); if (!data) throw new Error("תקופת המילואים לא נמצאה"); return data;
}

function required(formData: FormData, key: string, label: string) {
  const value = formData.get(key); if (typeof value !== "string" || !value.trim()) throw new Error(`${label} הוא שדה חובה`); return value.trim();
}
function optional(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function integer(formData: FormData, key: string, min: number, max: number) { const value = Number(formData.get(key)); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`ערך מספרי לא תקין: ${key}`); return value; }
function enumValue(formData: FormData, key: string, values: string[], label: string) { const value = required(formData, key, label); if (!values.includes(value)) throw new Error(`${label} אינו תקין`); return value; }
function assertDateRange(startsOn: string, endsOn: string) { if (endsOn < startsOn) throw new Error("תאריך הסיום חייב להיות אחרי תאריך ההתחלה"); }
function assertInsidePeriod(startsOn: string, endsOn: string, period: { starts_on: string; ends_on: string }) { assertDateRange(startsOn, endsOn); if (startsOn < period.starts_on || endsOn > period.ends_on) throw new Error("טווח התאריכים חייב להיות בתוך תקופת המילואים"); }
function assertDraft(period: { status: string }) { if (period.status !== "draft") throw new Error("שינויים מבניים מותרים רק בתקופה במצב טיוטה"); }
function assertOk(error: { message: string } | null, label: string) { if (error) throw new Error(`${label} נכשלה: ${error.message}`); }
function refresh(teamSlug: string) { revalidatePath(`/${teamSlug}/schedule`); revalidatePath(`/${teamSlug}`); revalidatePath(`/${teamSlug}/team`); }

function subtractManualRanges(
  block: { groupId: string; state: RotationState; startsOn: string; endsOn: string },
  manualBlocks: { rotation_group_id: string; starts_on: string; ends_on: string }[],
) {
  let pieces = [block];
  for (const manual of manualBlocks.filter((item) => item.rotation_group_id === block.groupId)) {
    pieces = pieces.flatMap((piece) => {
      if (!overlaps(piece, { startsOn: manual.starts_on, endsOn: manual.ends_on })) return [piece];
      const result: typeof pieces = [];
      if (piece.startsOn < manual.starts_on) result.push({ ...piece, endsOn: addCalendarDays(manual.starts_on, -1) });
      if (piece.endsOn > manual.ends_on) result.push({ ...piece, startsOn: addCalendarDays(manual.ends_on, 1) });
      return result;
    });
  }
  return pieces;
}
