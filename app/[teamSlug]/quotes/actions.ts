"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

const STATUSES = ["approved", "pending", "rejected", "archived"] as const;

export type DailyQuoteSubmitState = {
  message?: string;
  ok?: boolean;
};

export async function submitDailyQuoteSuggestionAction(
  teamSlug: string,
  _state: DailyQuoteSubmitState,
  formData: FormData,
): Promise<DailyQuoteSubmitState> {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const text = getText(formData, "text");

  if (!text) {
    return { message: "צריך לכתוב משפט לפני ההגשה.", ok: false };
  }

  if (text.length > 220) {
    return { message: "המשפט ארוך מדי.", ok: false };
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id")
    .eq("team_id", membership.team.id)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (personError) {
    return { message: "לא ניתן לזהות את איש הצוות שלך.", ok: false };
  }

  if (!person) {
    return { message: "רק איש צוות משויך יכול להציע משפט.", ok: false };
  }

  const { error } = await supabase.from("daily_quotes").insert({
    is_active: true,
    source: "viewer",
    status: "pending",
    submitted_by: userId,
    submitted_person_id: person.id,
    team_id: membership.team.id,
    text,
  });

  if (error) {
    return { message: "משהו השתבש בהגשה. נסה שוב עוד רגע.", ok: false };
  }

  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/settings`);
  return { message: "המשפט הועבר לאישור מנהל.", ok: true };
}

export async function saveDailyQuoteAction(teamSlug: string, formData: FormData) {
  const { membership, supabase, userId } = await requireManager(teamSlug);
  const id = getText(formData, "id");
  const text = requireText(formData, "text", "משפט");
  const status = quoteStatus(formData);
  const sortOrder = numberOrDefault(formData, "sort_order", 0);
  const isActive = formData.get("is_active") === "on";
  const approved = status === "approved";

  const payload = {
    approved_at: approved ? new Date().toISOString() : null,
    approved_by: approved ? userId : null,
    is_active: isActive,
    sort_order: sortOrder,
    status,
    team_id: membership.team.id,
    text,
  };

  const query = id
    ? supabase
        .from("daily_quotes")
        .update(payload)
        .eq("team_id", membership.team.id)
        .eq("id", id)
    : supabase
        .from("daily_quotes")
        .insert({ ...payload, source: "admin" });

  const { error } = await query;

  if (error) {
    throw new Error(`לא ניתן לשמור משפט יומי: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/settings`);
  redirect(`/${teamSlug}/settings?saved=daily-quote`);
}

async function requireManager(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  if (!canManage(membership.role)) {
    redirect(`/${teamSlug}`);
  }

  return { membership, supabase, userId };
}

function getText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function requireText(formData: FormData, name: string, label: string) {
  const value = getText(formData, name);
  if (!value) throw new Error(`${label} הוא שדה חובה.`);
  if (value.length > 220) throw new Error(`${label} ארוך מדי.`);
  return value;
}

function quoteStatus(formData: FormData) {
  const value = getText(formData, "status");
  if (STATUSES.includes(value as (typeof STATUSES)[number])) {
    return value as (typeof STATUSES)[number];
  }

  return "pending";
}

function numberOrDefault(formData: FormData, name: string, fallback: number) {
  const value = Number(getText(formData, name));
  return Number.isFinite(value) ? value : fallback;
}
