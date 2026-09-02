"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/kav/auth";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

const EQUIPMENT_STATUSES = ["assigned", "returned", "lost", "damaged"] as const;
const EQUIPMENT_CATEGORIES = ["WEAPON", "OPTIC", "AMRAL", "PAKAL", "OTHER"] as const;
const TEAM_EQUIPMENT_STATUSES = ["available", "in_use", "damaged", "lost", "retired"] as const;

type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];
type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
type TeamEquipmentStatus = (typeof TEAM_EQUIPMENT_STATUSES)[number];

export async function createPersonAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const fullName = requiredText(formData, "full_name", "שם מלא");
  const phone = optionalText(formData, "phone");
  const email = optionalEmail(formData, "email");
  const notes = optionalText(formData, "notes");
  const photoUrl = optionalText(formData, "photo_url");
  const isActive = formData.get("is_active") === "on";

  const { data, error } = await supabase
    .from("people")
    .insert({
      email,
      full_name: fullName,
      is_active: isActive,
      notes,
      phone,
      photo_url: photoUrl,
      team_id: membership.team.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`לא ניתן ליצור איש צוות: ${error.message}`);
  }

  revalidateTeam(teamSlug, data.id);
  redirect(`/${teamSlug}/team/${data.id}?saved=person-created`);
}

export async function updatePersonAction(
  teamSlug: string,
  personId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const fullName = requiredText(formData, "full_name", "שם מלא");
  const phone = optionalText(formData, "phone");
  const email = optionalEmail(formData, "email");
  const notes = optionalText(formData, "notes");
  const photoUrl = optionalText(formData, "photo_url");
  const isActive = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("people")
    .update({
      email,
      full_name: fullName,
      is_active: isActive,
      notes,
      phone,
      photo_url: photoUrl,
    })
    .eq("team_id", membership.team.id)
    .eq("id", personId);

  if (error) {
    throw new Error(`לא ניתן לעדכן איש צוות: ${error.message}`);
  }

  if (formData.get("private_enabled") === "on") {
    const privateError = await upsertPrivateDetails(teamSlug, personId, formData);
    if (privateError) throw privateError;
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?saved=person-updated`);
}

export async function upsertPrivateDetailsAction(
  teamSlug: string,
  personId: string,
  formData: FormData,
) {
  const error = await upsertPrivateDetails(teamSlug, personId, formData);
  if (error) throw error;

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?tab=general&saved=private-updated`);
}

export async function assignPakalAction(
  teamSlug: string,
  personId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const pakalTypeId = requiredText(formData, "pakal_type_id", "פקל");
  const notes = optionalText(formData, "notes");

  await assertPersonBelongsToTeam(supabase, membership.team.id, personId);
  await assertPakalBelongsToTeam(supabase, membership.team.id, pakalTypeId);

  const { error } = await supabase.from("person_pakals").upsert(
    {
      is_active: true,
      notes,
      pakal_type_id: pakalTypeId,
      person_id: personId,
      team_id: membership.team.id,
    },
    { onConflict: "person_id,pakal_type_id" },
  );

  if (error) {
    throw new Error(`לא ניתן לעדכן פקל: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?tab=pakals&saved=pakal-added`);
}

export async function removePakalAction(
  teamSlug: string,
  personId: string,
  personPakalId: string,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const { error } = await supabase
    .from("person_pakals")
    .update({ is_active: false })
    .eq("team_id", membership.team.id)
    .eq("person_id", personId)
    .eq("id", personPakalId);

  if (error) {
    throw new Error(`לא ניתן להסיר פקל: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?tab=pakals&saved=pakal-removed`);
}

export async function upsertPakalTypeAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const id = optionalText(formData, "id");
  const name = requiredText(formData, "name", "שם פקל");
  const description = optionalText(formData, "description");
  const isActive = formData.get("is_active") === "on";

  const query = id
    ? supabase
        .from("pakal_types")
        .update({ description, is_active: isActive, name })
        .eq("team_id", membership.team.id)
        .eq("id", id)
    : supabase
        .from("pakal_types")
        .insert({ description, is_active: isActive, name, team_id: membership.team.id });

  const { error } = await query;
  if (error) {
    throw new Error(`לא ניתן לשמור פקל: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}/settings`);
  revalidatePath(`/${teamSlug}/team`);
  redirect(`/${teamSlug}/settings?saved=pakal-type`);
}

export async function updateRequirementAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const pakalTypeId = requiredText(formData, "pakal_type_id", "פקל");
  const requiredCount = requiredNumber(formData, "required_count", "כמות נדרשת", 0, 99);

  await assertPakalBelongsToTeam(supabase, membership.team.id, pakalTypeId);

  const { error } = await supabase.from("team_pakal_requirements").upsert(
    {
      pakal_type_id: pakalTypeId,
      required_count: requiredCount,
      team_id: membership.team.id,
    },
    { onConflict: "team_id,pakal_type_id" },
  );

  if (error) {
    throw new Error(`לא ניתן לשמור דרישה: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}/settings`);
  revalidatePath(`/${teamSlug}`);
  redirect(`/${teamSlug}/settings?saved=requirement`);
}

export async function createEquipmentTypeAction(teamSlug: string, formData: FormData) {
  const { membership, supabase } = await requireManager(teamSlug);
  const name = requiredText(formData, "name", "שם סוג ציוד");
  const category = equipmentCategory(formData);
  const serialRequired = formData.get("serial_required") === "on";

  const { error } = await supabase.from("equipment_types").insert({
    category,
    is_active: true,
    name,
    serial_required: serialRequired,
    team_id: membership.team.id,
  });

  if (error) {
    throw new Error(`לא ניתן ליצור סוג ציוד: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}/team`);
  redirect(`/${teamSlug}/settings?saved=equipment-type`);
}

export async function updateEquipmentTypeAction(
  teamSlug: string,
  equipmentTypeId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const name = requiredText(formData, "name", "שם סוג ציוד");
  const category = equipmentCategory(formData);
  const serialRequired = formData.get("serial_required") === "on";
  const isActive = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("equipment_types")
    .update({
      category,
      is_active: isActive,
      name,
      serial_required: serialRequired,
    })
    .eq("team_id", membership.team.id)
    .eq("id", equipmentTypeId);

  if (error) {
    throw new Error(`לא ניתן לעדכן סוג ציוד: ${error.message}`);
  }

  revalidatePath(`/${teamSlug}/settings`);
  revalidatePath(`/${teamSlug}/team`);
  redirect(`/${teamSlug}/settings?saved=equipment-type-updated`);
}

export async function assignEquipmentAction(
  teamSlug: string,
  personId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const equipmentTypeId = requiredText(formData, "equipment_type_id", "סוג ציוד");
  const status = equipmentStatus(formData);

  await assertPersonBelongsToTeam(supabase, membership.team.id, personId);
  await assertEquipmentTypeBelongsToTeam(supabase, membership.team.id, equipmentTypeId);

  const { error } = await supabase.from("person_equipment").insert({
    assigned_at: optionalDate(formData, "assigned_at"),
    equipment_type_id: equipmentTypeId,
    model: optionalText(formData, "model"),
    notes: optionalText(formData, "notes"),
    person_id: personId,
    returned_at: status === "returned" ? optionalDate(formData, "returned_at") : null,
    serial_number: optionalText(formData, "serial_number"),
    status,
    team_id: membership.team.id,
  });

  if (error) {
    throw new Error(`לא ניתן לשייך ציוד: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  if (formData.get("return_to") === "team") {
    redirect(`/${teamSlug}/team?saved=equipment-added`);
  }
  redirect(`/${teamSlug}/team/${personId}?tab=equipment&saved=equipment-added`);
}

export async function updateEquipmentAction(
  teamSlug: string,
  personId: string,
  equipmentId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const status = equipmentStatus(formData);

  const { error } = await supabase
    .from("person_equipment")
    .update({
      assigned_at: optionalDate(formData, "assigned_at"),
      model: optionalText(formData, "model"),
      notes: optionalText(formData, "notes"),
      returned_at: optionalDate(formData, "returned_at"),
      serial_number: optionalText(formData, "serial_number"),
      status,
    })
    .eq("team_id", membership.team.id)
    .eq("person_id", personId)
    .eq("id", equipmentId);

  if (error) {
    throw new Error(`לא ניתן לעדכן ציוד: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?tab=equipment&saved=equipment-updated`);
}

export async function quickUpdateEquipmentAction(
  teamSlug: string,
  personId: string,
  equipmentId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const status = equipmentStatus(formData);

  const { error } = await supabase
    .from("person_equipment")
    .update({
      model: optionalText(formData, "model"),
      serial_number: optionalText(formData, "serial_number"),
      status,
    })
    .eq("team_id", membership.team.id)
    .eq("person_id", personId)
    .eq("id", equipmentId);

  if (error) {
    throw new Error(`לא ניתן לעדכן ציוד: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team?saved=equipment-updated`);
}

export async function returnEquipmentAction(
  teamSlug: string,
  personId: string,
  equipmentId: string,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  const today = getDateInTimeZone(membership.team.timezone);

  const { error } = await supabase
    .from("person_equipment")
    .update({ returned_at: today, status: "returned" })
    .eq("team_id", membership.team.id)
    .eq("person_id", personId)
    .eq("id", equipmentId);

  if (error) {
    throw new Error(`לא ניתן להחזיר ציוד: ${error.message}`);
  }

  revalidateTeam(teamSlug, personId);
  redirect(`/${teamSlug}/team/${personId}?tab=equipment&saved=equipment-returned`);
}

export async function createTeamEquipmentAction(teamSlug: string, formData: FormData) {
  const { membership, supabase, userId } = await requireManager(teamSlug);
  const currentHolderPersonId = optionalText(formData, "current_holder_person_id");
  const permanentOwnerPersonId = optionalText(formData, "permanent_owner_person_id");

  if (currentHolderPersonId) {
    await assertPersonBelongsToTeam(supabase, membership.team.id, currentHolderPersonId);
  }

  if (permanentOwnerPersonId) {
    await assertPersonBelongsToTeam(supabase, membership.team.id, permanentOwnerPersonId);
  }

  const { data, error } = await supabase
    .from("team_equipment_items")
    .insert({
      category: equipmentCategory(formData),
      created_by: userId,
      current_holder_person_id: currentHolderPersonId,
      model: optionalText(formData, "model"),
      name: requiredText(formData, "name", "שם ציוד"),
      notes: optionalText(formData, "notes"),
      permanent_owner_person_id: permanentOwnerPersonId,
      serial_number: optionalText(formData, "serial_number"),
      status: teamEquipmentStatus(formData),
      team_id: membership.team.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`לא ניתן ליצור ציוד צוותי: ${error.message}`);
  }

  if (currentHolderPersonId) {
    const { error: transferError } = await supabase.from("team_equipment_transfers").insert({
      team_equipment_item_id: data.id,
      team_id: membership.team.id,
      to_person_id: currentHolderPersonId,
      transfer_note: optionalText(formData, "transfer_note"),
      transferred_by: userId,
    });
    if (transferError) {
      throw new Error(`הציוד נוצר אך לא נשמרה היסטוריית אחריות: ${transferError.message}`);
    }
  }

  revalidateTeamEquipment(teamSlug, [currentHolderPersonId, permanentOwnerPersonId]);
  redirect(`/${teamSlug}/team?saved=team-equipment-added`);
}

export async function updateTeamEquipmentAction(teamSlug: string, itemId: string, formData: FormData) {
  const { membership, supabase, userId } = await requireManager(teamSlug);
  const currentHolderPersonId = optionalText(formData, "current_holder_person_id");
  const permanentOwnerPersonId = optionalText(formData, "permanent_owner_person_id");

  const existingItem = await assertTeamEquipmentBelongsToTeam(supabase, membership.team.id, itemId);
  if (currentHolderPersonId) {
    await assertPersonBelongsToTeam(supabase, membership.team.id, currentHolderPersonId);
  }

  if (permanentOwnerPersonId) {
    await assertPersonBelongsToTeam(supabase, membership.team.id, permanentOwnerPersonId);
  }

  const { error } = await supabase
    .from("team_equipment_items")
    .update({
      category: equipmentCategory(formData),
      current_holder_person_id: currentHolderPersonId,
      model: optionalText(formData, "model"),
      name: requiredText(formData, "name", "שם ציוד"),
      notes: optionalText(formData, "notes"),
      permanent_owner_person_id: permanentOwnerPersonId,
      serial_number: optionalText(formData, "serial_number"),
      status: teamEquipmentStatus(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", membership.team.id)
    .eq("id", itemId);

  if (error) {
    throw new Error(`לא ניתן לעדכן ציוד צוותי: ${error.message}`);
  }

  if (existingItem.current_holder_person_id !== currentHolderPersonId) {
    const { error: transferError } = await supabase.from("team_equipment_transfers").insert({
      from_person_id: existingItem.current_holder_person_id,
      team_equipment_item_id: existingItem.id,
      team_id: membership.team.id,
      to_person_id: currentHolderPersonId,
      transfer_note: optionalText(formData, "transfer_note"),
      transferred_by: userId,
    });

    if (transferError) {
      throw new Error(`הציוד עודכן אך לא נשמרה היסטוריית אחריות: ${transferError.message}`);
    }
  }

  revalidateTeamEquipment(teamSlug, [
    existingItem.current_holder_person_id,
    currentHolderPersonId,
    permanentOwnerPersonId,
  ]);
  redirect(`/${teamSlug}/team?saved=team-equipment-updated`);
}

export async function transferTeamEquipmentAction(teamSlug: string, itemId: string, formData: FormData) {
  const { membership, supabase, userId } = await requireManager(teamSlug);
  const toPersonId = optionalText(formData, "to_person_id");

  if (toPersonId) {
    await assertPersonBelongsToTeam(supabase, membership.team.id, toPersonId);
  }

  const { data: item, error: itemError } = await supabase
    .from("team_equipment_items")
    .select("id, current_holder_person_id")
    .eq("team_id", membership.team.id)
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error("הציוד הצוותי לא נמצא בצוות הנוכחי");
  }

  const status: TeamEquipmentStatus = toPersonId ? "in_use" : "available";
  const { error: updateError } = await supabase
    .from("team_equipment_items")
    .update({
      current_holder_person_id: toPersonId,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", membership.team.id)
    .eq("id", itemId);

  if (updateError) {
    throw new Error(`לא ניתן להעביר אחריות: ${updateError.message}`);
  }

  const { error: transferError } = await supabase.from("team_equipment_transfers").insert({
    from_person_id: item.current_holder_person_id,
    team_equipment_item_id: item.id,
    team_id: membership.team.id,
    to_person_id: toPersonId,
    transfer_note: optionalText(formData, "transfer_note"),
    transferred_by: userId,
  });

  if (transferError) {
    throw new Error(`האחריות הועברה אך לא נשמרה היסטוריה: ${transferError.message}`);
  }

  revalidateTeamEquipment(teamSlug, [item.current_holder_person_id, toPersonId]);
  redirect(`/${teamSlug}/team?saved=team-equipment-transferred`);
}

async function upsertPrivateDetails(
  teamSlug: string,
  personId: string,
  formData: FormData,
) {
  const { membership, supabase } = await requireManager(teamSlug);
  await assertPersonBelongsToTeam(supabase, membership.team.id, personId);

  const { error } = await supabase.from("person_private_details").upsert(
    {
      national_id: optionalText(formData, "national_id"),
      person_id: personId,
      personal_number: optionalText(formData, "personal_number"),
      private_notes: optionalText(formData, "private_notes"),
      team_id: membership.team.id,
    },
    { onConflict: "person_id" },
  );

  if (error) {
    return new Error(`לא ניתן לשמור פרטים רגישים: ${error.message}`);
  }

  return null;
}

async function requireManager(teamSlug: string) {
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  if (!canManage(membership.role)) {
    throw new Error("אין הרשאה לבצע פעולה זו");
  }

  return { membership, supabase, userId };
}

async function assertPersonBelongsToTeam(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  teamId: string,
  personId: string,
) {
  const { data, error } = await supabase
    .from("people")
    .select("id")
    .eq("team_id", teamId)
    .eq("id", personId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("איש הצוות לא נמצא בצוות הנוכחי");
  }
}

async function assertPakalBelongsToTeam(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  teamId: string,
  pakalTypeId: string,
) {
  const { data, error } = await supabase
    .from("pakal_types")
    .select("id")
    .eq("team_id", teamId)
    .eq("id", pakalTypeId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("הפקל אינו שייך לצוות הנוכחי");
  }
}

async function assertEquipmentTypeBelongsToTeam(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  teamId: string,
  equipmentTypeId: string,
) {
  const { data, error } = await supabase
    .from("equipment_types")
    .select("id")
    .eq("team_id", teamId)
    .eq("id", equipmentTypeId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("סוג הציוד אינו שייך לצוות הנוכחי");
  }
}

async function assertTeamEquipmentBelongsToTeam(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  teamId: string,
  itemId: string,
) {
  const { data, error } = await supabase
    .from("team_equipment_items")
    .select("id, current_holder_person_id")
    .eq("team_id", teamId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("הציוד הצוותי לא נמצא בצוות הנוכחי");
  }

  return data;
}

function revalidateTeam(teamSlug: string, personId: string) {
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/team`);
  revalidatePath(`/${teamSlug}/team/${personId}`);
}

function revalidateTeamEquipment(teamSlug: string, personIds: Array<string | null | undefined>) {
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/equipment`);
  revalidatePath(`/${teamSlug}/team`);

  for (const personId of new Set(personIds.filter(Boolean))) {
    revalidatePath(`/${teamSlug}/team/${personId}`);
  }
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = optionalText(formData, key);
  if (!value) {
    throw new Error(`${label} הוא שדה חובה`);
  }

  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new Error("ערך טקסט ארוך מדי");
  }

  return trimmed;
}

function optionalEmail(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("כתובת אימייל אינה תקינה");
  }

  return value;
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("תאריך אינו תקין");
  }

  return value;
}

function requiredNumber(
  formData: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
) {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} חייב להיות מספר בין ${min} ל-${max}`);
  }

  return value;
}

function equipmentStatus(formData: FormData): EquipmentStatus {
  const value = formData.get("status");
  if (typeof value === "string" && EQUIPMENT_STATUSES.includes(value as EquipmentStatus)) {
    return value as EquipmentStatus;
  }

  return "assigned";
}

function equipmentCategory(formData: FormData): EquipmentCategory {
  const value = formData.get("category");
  if (typeof value === "string" && EQUIPMENT_CATEGORIES.includes(value as EquipmentCategory)) {
    return value as EquipmentCategory;
  }

  return "OTHER";
}

function teamEquipmentStatus(formData: FormData): TeamEquipmentStatus {
  const value = formData.get("status");
  if (typeof value === "string" && TEAM_EQUIPMENT_STATUSES.includes(value as TeamEquipmentStatus)) {
    return value as TeamEquipmentStatus;
  }

  return "in_use";
}
