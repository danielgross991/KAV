"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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

export async function signInWithEmail(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !email.includes("@")) {
    return { message: "יש להזין כתובת אימייל תקינה" };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const redirectTo = getAuthCallbackUrl(headersList, next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return { message: "לא הצלחנו לשלוח קישור התחברות. נסה שוב." };
  }

  return { ok: true, message: "שלחנו קישור התחברות לאימייל שלך" };
}
