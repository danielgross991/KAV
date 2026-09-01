"use server";

import { randomUUID } from "node:crypto";

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
  const admin = createAdminClient();

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id, email, auth_user_id")
    .eq("id", personId)
    .eq("team_id", membership.team.id)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  if (!person) throw new Error("איש הצוות אינו שייך לצוות הנוכחי");

  const authUser = await ensureConfirmedAuthUser(admin, email);
  const { error: updatePersonError } = await admin
    .from("people")
    .update({ auth_user_id: authUser.id, email })
    .eq("id", person.id)
    .eq("team_id", membership.team.id);
  if (updatePersonError) throw new Error(`לא ניתן לקשר את המשתמש: ${updatePersonError.message}`);

  await ensureViewerMembership(admin, membership.team.id, authUser.id);

  revalidatePath(`/${teamSlug}/users`);
  revalidatePath(`/${teamSlug}/team/${person.id}`);
  redirect(`/${teamSlug}/users?linked=1`);
}

export async function updatePersonPhotoAction(teamSlug: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (membership.role !== "admin") redirect(`/${teamSlug}`);

  const personId = required(formData, "person_id");
  const admin = createAdminClient();

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id")
    .eq("id", personId)
    .eq("team_id", membership.team.id)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  if (!person) throw new Error("איש הצוות אינו שייך לצוות הנוכחי");

  const photoUrl = await getSubmittedPhotoUrl(admin, membership.team.id, person.id, formData);

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

async function ensureConfirmedAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User> {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!created.error && created.data.user) {
    return created.data.user;
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (!existing) {
    console.warn("Unable to provision viewer auth user", {
      code: created.error?.code,
      status: created.error?.status,
    });
    throw new Error("לא ניתן ליצור משתמש כניסה עבור המייל הזה");
  }

  if (!existing.email_confirmed_at) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error("לא ניתן לאשר את משתמש הכניסה");
    }
    return data.user;
  }

  return existing;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`לא ניתן לבדוק משתמשי כניסה: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }

  return null;
}

async function ensureViewerMembership(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  userId: string,
) {
  const { data: existing, error: existingError } = await admin
    .from("team_memberships")
    .select("id, role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw new Error(`לא ניתן לבדוק הרשאת צוות: ${existingError.message}`);

  if (existing) {
    const role = existing.role === "admin" || existing.role === "manager" ? existing.role : "viewer";
    const { error } = await admin
      .from("team_memberships")
      .update({ is_active: true, role })
      .eq("id", existing.id);
    if (error) throw new Error(`לא ניתן לעדכן הרשאת צוות: ${error.message}`);
    return;
  }

  const { error } = await admin
    .from("team_memberships")
    .insert({ is_active: true, role: "viewer", team_id: teamId, user_id: userId });
  if (error) throw new Error(`לא ניתן ליצור הרשאת צפייה: ${error.message}`);
}

async function getSubmittedPhotoUrl(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  personId: string,
  formData: FormData,
) {
  const file = formData.get("photo_file");
  if (file instanceof File && file.size > 0) {
    return uploadPersonPhoto(admin, teamId, personId, file);
  }

  return optionalUrl(formData.get("photo_url"));
}

async function uploadPersonPhoto(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  personId: string,
  file: File,
) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(file.type)) {
    throw new Error("אפשר להעלות רק תמונת JPG, PNG, WEBP או GIF");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("התמונה גדולה מדי. עד 5MB");
  }

  const extension = extensionForMime(file.type);
  const path = `${teamId}/${personId}/${randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from("person-photos")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`לא ניתן להעלות תמונה: ${error.message}`);
  }

  return admin.storage.from("person-photos").getPublicUrl(path).data.publicUrl;
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

function extensionForMime(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}
