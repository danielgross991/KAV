"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";
import { createAdminClient } from "@/lib/supabase/admin";

export async function provisionPersonLoginAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (membership.role !== "admin") redirect(`/${teamSlug}`);

  const personId = required(formData, "person_id");
  const email = required(formData, "email").toLowerCase();
  if (!email.includes("@")) throw new Error("כתובת האימייל אינה תקינה");

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id")
    .eq("id", personId)
    .eq("team_id", membership.team.id)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  if (!person) throw new Error("איש הצוות אינו שייך לצוות הנוכחי");

  const admin = createAdminClient();
  const authUser = await findOrCreateUserByEmail(admin, email);

  const { error: updatePersonError } = await admin
    .from("people")
    .update({ auth_user_id: authUser.id, email })
    .eq("id", person.id)
    .eq("team_id", membership.team.id);
  if (updatePersonError) throw new Error(`לא ניתן לקשר את המשתמש: ${updatePersonError.message}`);

  const { data: existingMembership, error: membershipError } = await admin
    .from("team_memberships")
    .select("id, role, is_active")
    .eq("team_id", membership.team.id)
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (membershipError) throw new Error(`לא ניתן לבדוק הרשאת צוות: ${membershipError.message}`);

  if (existingMembership) {
    const role = existingMembership.role === "admin" || existingMembership.role === "manager"
      ? existingMembership.role
      : "viewer";
    const { error } = await admin
      .from("team_memberships")
      .update({ is_active: true, role })
      .eq("id", existingMembership.id);
    if (error) throw new Error(`לא ניתן לעדכן הרשאת צפייה: ${error.message}`);
  } else {
    const { error } = await admin
      .from("team_memberships")
      .insert({ team_id: membership.team.id, user_id: authUser.id, role: "viewer", is_active: true });
    if (error) throw new Error(`לא ניתן ליצור הרשאת צפייה: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}/users`);
  revalidatePath(`/${teamSlug}/team/${person.id}`);
  redirect(`/${teamSlug}/users?linked=1`);
}

async function findOrCreateUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<User> {
  const existing = await findUserByEmail(admin, email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (!error && data.user) return data.user;

  if (error?.message.toLowerCase().includes("already")) {
    const retry = await findUserByEmail(admin, email);
    if (retry) return retry;
  }

  throw new Error(`לא ניתן ליצור משתמש Auth: ${error?.message ?? "שגיאה לא ידועה"}`);
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`לא ניתן לבדוק משתמשי Auth: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

function required(data: FormData, key: string) {
  const value = data.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error("חסר שדה חובה");
  return value.trim();
}
