"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { overlaps, validateLeaveRange } from "@/lib/kav/schedule-domain";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

const STATUSES = ["pending", "approved", "rejected"];

export async function saveLeaveAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const id = optional(formData, "id");
  const personId = required(formData, "person_id");
  const periodId = required(formData, "reserve_period_id");
  const startsOn = required(formData, "starts_on");
  const endsOn = required(formData, "ends_on");
  const status = required(formData, "status");
  if (!STATUSES.includes(status)) throw new Error("סטטוס היציאה אינו תקין");

  const [{ data: person }, { data: period }, existingResult] = await Promise.all([
    context.supabase.from("people").select("id").eq("id", personId).eq("team_id", context.teamId).maybeSingle(),
    context.supabase.from("reserve_periods").select("id, starts_on, ends_on").eq("id", periodId).eq("team_id", context.teamId).maybeSingle(),
    id ? context.supabase.from("leave_requests").select("id").eq("id", id).eq("team_id", context.teamId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (!person || !period || (id && !existingResult.data)) throw new Error("פרטי היציאה אינם שייכים לצוות");

  const approved = status === "approved"
    ? {
        startsOn,
        endsOn,
      }
    : null;
  const issues = validateLeaveRange({
    requested: { startsOn, endsOn }, approved,
    period: { startsOn: period.starts_on, endsOn: period.ends_on },
  });
  if (issues.length) throw new Error("טווח תאריכי היציאה אינו תקין");

  if (approved) {
    const { data: overlapping, error } = await context.supabase.from("leave_requests").select("id, approved_starts_on, approved_ends_on")
      .eq("team_id", context.teamId).eq("reserve_period_id", periodId).eq("person_id", personId)
      .in("status", ["approved", "partially_approved"]);
    assertOk(error);
    if ((overlapping ?? []).some((leave) => leave.id !== id && leave.approved_starts_on && leave.approved_ends_on && overlaps(
      approved, { startsOn: leave.approved_starts_on, endsOn: leave.approved_ends_on },
    ))) throw new Error("כבר קיימת יציאה מאושרת חופפת לאיש הצוות");
  }

  const payload = {
    team_id: context.teamId, reserve_period_id: periodId, person_id: personId,
    starts_on: startsOn, ends_on: endsOn, status,
    approved_starts_on: approved?.startsOn ?? null, approved_ends_on: approved?.endsOn ?? null,
    reason: optional(formData, "reason"), manager_notes: optional(formData, "manager_notes"),
    decided_by: status === "pending" ? null : context.userId,
    decided_at: status === "pending" ? null : new Date().toISOString(),
  };
  const result = id
    ? await context.supabase.from("leave_requests").update(payload).eq("id", id).eq("team_id", context.teamId).select("id").single()
    : await context.supabase.from("leave_requests").insert({ ...payload, created_by: context.userId }).select("id").single();
  assertOk(result.error);
  refresh(teamSlug);
  redirect(`/${teamSlug}/leave?saved=1`);
}

export async function deleteLeaveAction(teamSlug: string, formData: FormData) {
  const context = await managerContext(teamSlug);
  const { data, error } = await context.supabase.from("leave_requests").delete()
    .eq("id", required(formData, "id")).eq("team_id", context.teamId).select("id").single();
  assertOk(error);
  if (!data) throw new Error("היציאה לא נמצאה");
  refresh(teamSlug);
  redirect(`/${teamSlug}/leave?deleted=1`);
}

export async function createViewerLeaveRequestAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const periodId = required(formData, "reserve_period_id");
  const startsOn = required(formData, "starts_on");
  const endsOn = required(formData, "ends_on");

  const [{ data: person, error: personError }, { data: period, error: periodError }] = await Promise.all([
    supabase
      .from("people")
      .select("id")
      .eq("team_id", membership.team.id)
      .eq("auth_user_id", userId)
      .maybeSingle(),
    supabase
      .from("reserve_periods")
      .select("id, starts_on, ends_on")
      .eq("id", periodId)
      .eq("team_id", membership.team.id)
      .in("status", ["active", "published", "draft"])
      .maybeSingle(),
  ]);
  assertOk(personError);
  assertOk(periodError);
  if (!person || !period) throw new Error("לא ניתן לפתוח בקשה עבור המשתמש הנוכחי");

  const issues = validateLeaveRange({
    requested: { startsOn, endsOn },
    approved: null,
    period: { startsOn: period.starts_on, endsOn: period.ends_on },
  });
  if (issues.length) throw new Error("טווח תאריכי היציאה אינו תקין");

  const { error } = await supabase.from("leave_requests").insert({
    team_id: membership.team.id,
    reserve_period_id: period.id,
    person_id: person.id,
    starts_on: startsOn,
    ends_on: endsOn,
    status: "pending",
    reason: optional(formData, "reason"),
    created_by: userId,
  });
  assertOk(error);
  refresh(teamSlug);
  redirect(`/${teamSlug}/leave?saved=1`);
}

async function managerContext(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) redirect(`/${teamSlug}`);
  return { supabase, userId, teamId: membership.team.id };
}

function refresh(teamSlug: string) {
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/leave`);
  revalidatePath(`/${teamSlug}/attendance`);
  revalidatePath(`/${teamSlug}/schedule`);
}
function required(data: FormData, key: string) { const value = data.get(key); if (typeof value !== "string" || !value.trim()) throw new Error("חסר שדה חובה"); return value.trim(); }
function optional(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function assertOk(error: { message: string } | null) { if (error) { console.error("Phase 4 leave mutation failed", error.message); throw new Error("לא הצלחנו לשמור את היציאה. נסה שוב."); } }
