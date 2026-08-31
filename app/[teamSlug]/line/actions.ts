"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { DEFAULT_LINE_VALUE, lineCookieName } from "@/lib/kav/line-selection";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

export async function setSelectedLineAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const periodId = stringValue(formData.get("period_id"));
  const nextPath = normalizeNextPath(stringValue(formData.get("next")), teamSlug);
  const cookieStore = await cookies();

  if (!periodId || periodId === DEFAULT_LINE_VALUE) {
    cookieStore.set(lineCookieName(teamSlug), "", {
      maxAge: 0,
      path: `/${teamSlug}`,
      sameSite: "lax",
    });
    revalidatePath(`/${teamSlug}`);
    redirect(nextPath);
  }

  let query = supabase
    .from("reserve_periods")
    .select("id, status")
    .eq("id", periodId)
    .eq("team_id", membership.team.id)
    .neq("status", "archived");

  if (!canManage(membership.role)) {
    query = query.in("status", ["active", "published"]);
  }

  const { data: period, error } = await query.maybeSingle();
  if (error) throw new Error(`לא ניתן לבחור קו: ${error.message}`);
  if (!period) throw new Error("הקו שבחרת אינו זמין למשתמש הנוכחי");

  cookieStore.set(lineCookieName(teamSlug), period.id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 120,
    path: `/${teamSlug}`,
    sameSite: "lax",
  });
  revalidatePath(`/${teamSlug}`);
  redirect(nextPath);
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNextPath(value: string, teamSlug: string) {
  if (!value.startsWith(`/${teamSlug}`)) return `/${teamSlug}`;
  return value;
}
