"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getAuthCallbackUrl, sanitizeNextPath, shouldCreateAuthUser } from "@/lib/kav/auth-config";

export type LoginState = {
  message?: string;
  ok?: boolean;
};

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
      shouldCreateUser: shouldCreateAuthUser(email),
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return { message: "לא הצלחנו לשלוח קישור התחברות. נסה שוב." };
  }

  return { ok: true, message: "שלחנו קישור התחברות לאימייל שלך" };
}
