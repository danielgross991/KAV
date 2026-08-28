"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { getOperationalDay } from "@/lib/kav/operations";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

export async function markAttendanceAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const date = required(formData, "date");
  const personId = required(formData, "person_id");
  const state = required(formData, "state");
  if (state !== "present" && state !== "absent" && state !== "unreported") throw new Error("מצב הנוכחות אינו תקין");
  const day = await getOperationalDay(context.supabase, context.team, date);
  if (!day.period || !day.people.some((person) => person.id === personId)) throw new Error("איש הצוות או היום אינם תקינים");
  const attendanceDayId = await ensureDay(context, day.period.id, date);
  const result = state === "unreported"
    ? await context.supabase.from("attendance_entries").delete().eq("team_id", context.team.id)
      .eq("attendance_day_id", attendanceDayId).eq("person_id", personId)
    : await context.supabase.from("attendance_entries").upsert({
        team_id: context.team.id, attendance_day_id: attendanceDayId, person_id: personId,
        is_present: state === "present", source: "manual", updated_by: context.userId,
      }, { onConflict: "attendance_day_id,person_id" });
  assertOk(result.error);
  refresh(teamSlug, date);
}

export async function markExpectedPresentAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const date = required(formData, "date");
  const day = await getOperationalDay(context.supabase, context.team, date);
  if (!day.period) throw new Error("אין תקופת מילואים פעילה ביום זה");
  const expected = day.people.filter((person) => person.resolution.expectedAtBase);
  if (!expected.length) return;
  const attendanceDayId = await ensureDay(context, day.period.id, date);
  const { error } = await context.supabase.from("attendance_entries").upsert(expected.map((person) => ({
    team_id: context.team.id, attendance_day_id: attendanceDayId, person_id: person.id,
    is_present: true, source: "schedule_default", updated_by: context.userId,
  })), { onConflict: "attendance_day_id,person_id" });
  assertOk(error);
  refresh(teamSlug, date);
}

export async function submitAttendanceAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const date = required(formData, "date");
  const day = await getOperationalDay(context.supabase, context.team, date);
  if (!day.period) throw new Error("אין תקופת מילואים פעילה ביום זה");
  const attendanceDayId = await ensureDay(context, day.period.id, date);
  const { error } = await context.supabase.from("attendance_days").update({
    status: "submitted", submitted_by: context.userId, submitted_at: new Date().toISOString(),
  }).eq("id", attendanceDayId).eq("team_id", context.team.id);
  assertOk(error);
  refresh(teamSlug, date);
}

async function ensureDay(context: Awaited<ReturnType<typeof managerContext>>, periodId: string, date: string) {
  const { data, error } = await context.supabase.from("attendance_days").upsert({
    team_id: context.team.id, reserve_period_id: periodId, attendance_date: date,
  }, { onConflict: "reserve_period_id,attendance_date", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) assertOk(error);
  if (data) return data.id;
  const { data: existing, error: readError } = await context.supabase.from("attendance_days").select("id")
    .eq("team_id", context.team.id).eq("reserve_period_id", periodId).eq("attendance_date", date).single();
  assertOk(readError);
  return existing!.id;
}

async function managerContext(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) redirect(`/${teamSlug}`);
  return { supabase, userId, team: membership.team };
}
function refresh(teamSlug: string, date: string) { revalidatePath(`/${teamSlug}`); revalidatePath(`/${teamSlug}/attendance`); revalidatePath(`/${teamSlug}/schedule/${date}`); }
function required(data: FormData, key: string) { const value = data.get(key); if (typeof value !== "string" || !value.trim()) throw new Error("חסר שדה חובה"); return value.trim(); }
function assertOk(error: { message: string } | null) { if (error) { console.error("Phase 4 attendance mutation failed", error.message); throw new Error("לא הצלחנו לעדכן את הנוכחות. נסה שוב."); } }
