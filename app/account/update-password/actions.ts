"use server";

import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = {
  message?: string;
  ok?: boolean;
};

export async function updatePassword(
  _state: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  if (password.length < 8) return { message: "הסיסמה חייבת להכיל לפחות 8 תווים." };
  if (password !== confirmation) return { message: "הסיסמאות אינן תואמות." };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    return { message: "קישור האיפוס אינו תקף או שפג תוקפו." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.warn("Password update failed", { code: error.code, status: error.status });
    return { message: "לא הצלחנו לעדכן את הסיסמה. נסה לבקש קישור חדש." };
  }

  return { ok: true, message: "הסיסמה עודכנה בהצלחה" };
}
