"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";

export async function provisionPersonLoginAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (membership.role !== "admin") redirect(`/${teamSlug}`);

  const personId = required(formData, "person_id");
  const email = required(formData, "email").toLowerCase();
  if (!email.includes("@")) throw new Error("כתובת האימייל אינה תקינה");

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id, email, auth_user_id")
    .eq("id", personId)
    .eq("team_id", membership.team.id)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  if (!person) throw new Error("איש הצוות אינו שייך לצוות הנוכחי");

  const emailChanged = (person.email ?? "").toLowerCase() !== email;
  const { error: updatePersonError } = await supabase
    .from("people")
    .update({ auth_user_id: emailChanged ? null : person.auth_user_id, email })
    .eq("id", person.id)
    .eq("team_id", membership.team.id);
  if (updatePersonError) throw new Error(`לא ניתן לקשר את המשתמש: ${updatePersonError.message}`);

  revalidatePath(`/${teamSlug}/users`);
  revalidatePath(`/${teamSlug}/team/${person.id}`);
  redirect(`/${teamSlug}/users?linked=1`);
}

export async function updatePersonPhotoAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (membership.role !== "admin") redirect(`/${teamSlug}`);

  const personId = required(formData, "person_id");
  const photoUrl = optionalUrl(formData.get("photo_url"));

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id")
    .eq("id", personId)
    .eq("team_id", membership.team.id)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  if (!person) throw new Error("איש הצוות אינו שייך לצוות הנוכחי");

  const { error: updateError } = await supabase
    .from("people")
    .update({ photo_url: photoUrl })
    .eq("id", person.id)
    .eq("team_id", membership.team.id);
  if (updateError) throw new Error(`לא ניתן לשמור תמונה: ${updateError.message}`);

  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/users`);
  revalidatePath(`/${teamSlug}/team/${person.id}`);
  redirect(`/${teamSlug}/users?photo=1`);
}

function required(data: FormData, key: string) {
  const value = data.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error("חסר שדה חובה");
  return value.trim();
}

function optionalUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
    return url.toString();
  } catch {
    throw new Error("קישור התמונה אינו תקין");
  }
}
