"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  message?: string;
  ok?: boolean;
};

const GENERIC_RECOVERY_MESSAGE = "אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס הסיסמה.";

export async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email && email.includes("@")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      console.warn("Password recovery request failed", { code: error.code, status: error.status });
    }
  }

  return { ok: true, message: GENERIC_RECOVERY_MESSAGE };
}
