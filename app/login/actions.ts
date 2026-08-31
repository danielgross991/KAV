"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthCallbackUrl,
  getPostLoginPath,
  sanitizeNextPath,
} from "@/lib/kav/auth-config";
import { getUserTeams } from "@/lib/kav/teams";

export type LoginState = {
  message?: string;
  ok?: boolean;
};

const GENERIC_LOGIN_ERROR = "האימייל או הסיסמה אינם נכונים.";
const GENERIC_VIEWER_ERROR = "האימייל לא מוגדר לאיש צוות פעיל.";

export async function signInWithPassword(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !email.includes("@") || !password) {
    return { message: GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    console.warn("Password sign-in failed", { code: error?.code, status: error?.status });
    return { message: GENERIC_LOGIN_ERROR };
  }

  const memberships = next === "/" ? await getUserTeams(supabase, data.user.id) : [];
  redirect(getPostLoginPath(next, memberships.map(({ team }) => team.slug)));
}

export async function signInWithEmailOnly(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !email.includes("@")) {
    return { message: "יש להזין כתובת אימייל תקינה" };
  }

  const admin = createAdminClient();
  const eligiblePeople = await getEligiblePeopleForEmail(admin, email);
  if (!eligiblePeople.length) {
    return { message: GENERIC_VIEWER_ERROR };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const redirectTo = getAuthCallbackUrl(headersList, next);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (linkError || !linkData.properties.hashed_token) {
    console.warn("Email-only sign-in link generation failed", { code: linkError?.code, status: linkError?.status });
    return { message: "לא הצלחנו להכניס אותך כרגע. נסה שוב." };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (error || !data.user) {
    console.warn("Email-only sign-in verification failed", { code: error?.code, status: error?.status });
    return { message: "לא הצלחנו להכניס אותך כרגע. נסה שוב." };
  }

  await linkUserToEligiblePeople(admin, data.user, eligiblePeople);

  const memberships = next === "/" ? await getUserTeams(supabase, data.user.id) : [];
  redirect(getPostLoginPath(next, memberships.map(({ team }) => team.slug)));
}

type EligiblePerson = {
  id: string;
  team_id: string;
};

async function getEligiblePeopleForEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<EligiblePerson[]> {
  const { data, error } = await admin
    .from("people")
    .select("id, team_id")
    .eq("email", email)
    .eq("is_active", true);

  if (error) {
    throw new Error(`לא ניתן לבדוק את האימייל: ${error.message}`);
  }

  return data ?? [];
}

async function linkUserToEligiblePeople(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
  people: EligiblePerson[],
) {
  const teamIds = [...new Set(people.map((person) => person.team_id))];

  for (const person of people) {
    const { error } = await admin
      .from("people")
      .update({ auth_user_id: user.id, email: user.email?.toLowerCase() ?? null })
      .eq("id", person.id)
      .eq("team_id", person.team_id);
    if (error) throw new Error(`לא ניתן לקשר איש צוות: ${error.message}`);
  }

  for (const teamId of teamIds) {
    const { data: existing, error: existingError } = await admin
      .from("team_memberships")
      .select("id, role")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw new Error(`לא ניתן לבדוק הרשאת צוות: ${existingError.message}`);

    if (existing) {
      const role = existing.role === "admin" || existing.role === "manager" ? existing.role : "viewer";
      const { error } = await admin
        .from("team_memberships")
        .update({ is_active: true, role })
        .eq("id", existing.id);
      if (error) throw new Error(`לא ניתן לעדכן הרשאת צוות: ${error.message}`);
    } else {
      const { error } = await admin
        .from("team_memberships")
        .insert({ team_id: teamId, user_id: user.id, role: "viewer", is_active: true });
      if (error) throw new Error(`לא ניתן ליצור הרשאת צפייה: ${error.message}`);
    }
  }
}
