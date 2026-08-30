import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getCurrentRotationContext } from "@/lib/kav/rotations";
import { canManage, type TeamMembership } from "@/lib/kav/teams";

type Client = SupabaseClient<Database>;

type TableRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];

export type PersonListItem = Pick<
  TableRow<"people">,
  "email" | "full_name" | "id" | "is_active" | "phone" | "photo_url"
> & {
  equipment: PersonListEquipmentItem[];
  pakals: Array<Pick<TableRow<"pakal_types">, "id" | "name">>;
  rotation: { id: string; name: string } | null;
};

export type PersonListEquipmentItem = Pick<
  TableRow<"person_equipment">,
  "id" | "model" | "person_id" | "serial_number" | "status"
> & {
  equipmentType: Pick<TableRow<"equipment_types">, "category" | "name"> | null;
};

export type PakalType = TableRow<"pakal_types"> & {
  assignedCount: number;
  requiredCount: number;
};

export type EquipmentType = TableRow<"equipment_types">;

export type RotationOption = {
  id: string;
  name: string;
};

export type TeamManagementData = {
  canManageTeam: boolean;
  people: PersonListItem[];
  pakalTypes: PakalType[];
  rotations: RotationOption[];
  team: TeamMembership["team"];
};

export type PersonProfileData = {
  canManageTeam: boolean;
  equipment: PersonEquipmentItem[];
  equipmentTypes: EquipmentType[];
  pakalTypes: PakalType[];
  person: TableRow<"people">;
  privateDetails: TableRow<"person_private_details"> | null;
  reserveHistory: ReserveHistoryItem[];
  selectedPakals: PersonPakalItem[];
  team: TeamMembership["team"];
};

export type PersonPakalItem = TableRow<"person_pakals"> & {
  pakal: Pick<TableRow<"pakal_types">, "id" | "name"> | null;
};

export type PersonEquipmentItem = TableRow<"person_equipment"> & {
  equipmentType: Pick<TableRow<"equipment_types">, "id" | "name" | "category" | "serial_required"> | null;
};

export type ReserveHistoryItem = {
  attendance: { present: number; total: number };
  period: Pick<TableRow<"reserve_periods">, "ends_on" | "id" | "location" | "name" | "starts_on" | "status">;
  rotations: Array<{
    endsOn: string | null;
    groupName: string;
    startsOn: string | null;
  }>;
};

export async function getTeamManagementData(
  supabase: Client,
  membership: TeamMembership,
): Promise<TeamManagementData> {
  const canManageTeam = canManage(membership.role);
  const [people, pakalTypes, personPakals, requirements, currentRotationContext, equipmentTypes, equipment] =
    await Promise.all([
      selectOrThrow(
        supabase
          .from("people")
          .select("id, full_name, phone, email, photo_url, is_active, display_order")
          .eq("team_id", membership.team.id)
          .order("display_order", { ascending: true })
          .order("full_name", { ascending: true }),
        "לא ניתן לטעון את רשימת אנשי הצוות",
      ),
      selectOrThrow(
        supabase
          .from("pakal_types")
          .select("id, team_id, code, name, description, is_active, created_at")
          .eq("team_id", membership.team.id)
          .order("name", { ascending: true }),
        "לא ניתן לטעון פקלים",
      ),
      selectOrThrow(
        supabase
          .from("person_pakals")
          .select("id, team_id, person_id, pakal_type_id, notes, is_active, created_at")
          .eq("team_id", membership.team.id)
          .eq("is_active", true),
        "לא ניתן לטעון שיוכי פקלים",
      ),
      selectOrThrow(
        supabase
          .from("team_pakal_requirements")
          .select("id, team_id, pakal_type_id, required_count, created_at")
          .eq("team_id", membership.team.id),
        "לא ניתן לטעון דרישות כשירות",
      ),
      getCurrentRotationContext(supabase, membership.team.id, membership.team.timezone),
      canManageTeam
        ? selectOrThrow(
            supabase
              .from("equipment_types")
              .select("id, team_id, name, category, serial_required, is_active, created_at")
              .eq("team_id", membership.team.id),
            "לא ניתן לטעון סוגי ציוד",
          )
        : Promise.resolve([]),
      canManageTeam
        ? selectOrThrow(
            supabase
              .from("person_equipment")
              .select("id, team_id, person_id, equipment_type_id, model, serial_number, status")
              .eq("team_id", membership.team.id)
              .neq("status", "returned"),
            "לא ניתן לטעון ציוד צוות",
          )
        : Promise.resolve([]),
    ]);

  const pakalsById = new Map(pakalTypes.map((pakal) => [pakal.id, pakal]));
  const equipmentTypeById = new Map(equipmentTypes.map((type) => [type.id, type]));
  const equipmentByPersonId = new Map<string, PersonListEquipmentItem[]>();
  for (const item of equipment) {
    const items = equipmentByPersonId.get(item.person_id) ?? [];
    items.push({
      equipmentType: equipmentTypeById.get(item.equipment_type_id) ?? null,
      id: item.id,
      model: item.model,
      person_id: item.person_id,
      serial_number: item.serial_number,
      status: item.status,
    });
    equipmentByPersonId.set(item.person_id, items);
  }
  const requirementsByPakalId = new Map(
    requirements.map((requirement) => [requirement.pakal_type_id, requirement.required_count]),
  );
  const assignedCounts = countActivePakals(personPakals);

  return {
    canManageTeam,
    people: people.map((person) => ({
      email: person.email,
      equipment: equipmentByPersonId.get(person.id) ?? [],
      full_name: person.full_name,
      id: person.id,
      is_active: person.is_active,
      phone: person.phone,
      photo_url: person.photo_url,
      pakals: personPakals
        .filter((pakal) => pakal.person_id === person.id)
        .flatMap((pakal) => {
          const type = pakalsById.get(pakal.pakal_type_id);
          return type ? [{ id: type.id, name: type.name }] : [];
        }),
      rotation: currentRotationContext.rotationByPersonId.get(person.id) ?? null,
    })),
    pakalTypes: pakalTypes.map((pakal) => ({
      ...pakal,
      assignedCount: assignedCounts.get(pakal.id) ?? 0,
      requiredCount: requirementsByPakalId.get(pakal.id) ?? 0,
    })),
    rotations: currentRotationContext.rotationOptions,
    team: membership.team,
  };
}

export async function getPersonProfileData(
  supabase: Client,
  membership: TeamMembership,
  personId: string,
  viewerUserId?: string,
): Promise<PersonProfileData> {
  const canManageTeam = canManage(membership.role);
  if (!isUuid(personId)) {
    notFound();
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .select(
      "id, team_id, auth_user_id, full_name, phone, email, date_of_birth, photo_url, notes, display_order, is_active, created_at, updated_at",
    )
    .eq("team_id", membership.team.id)
    .eq("id", personId)
    .maybeSingle();

  if (personError) {
    throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);
  }

  if (!person) {
    notFound();
  }

  const [pakalTypes, personPakals, requirements, equipmentTypes, equipment, reservePeriods] =
    await Promise.all([
      selectOrThrow(
        supabase
          .from("pakal_types")
          .select("id, team_id, code, name, description, is_active, created_at")
          .eq("team_id", membership.team.id)
          .order("name", { ascending: true }),
        "לא ניתן לטעון פקלים",
      ),
      selectOrThrow(
        supabase
          .from("person_pakals")
          .select("id, team_id, person_id, pakal_type_id, notes, is_active, created_at")
          .eq("team_id", membership.team.id)
          .eq("person_id", person.id)
          .order("created_at", { ascending: true }),
        "לא ניתן לטעון פקלים לאיש צוות",
      ),
      selectOrThrow(
        supabase
          .from("team_pakal_requirements")
          .select("id, team_id, pakal_type_id, required_count, created_at")
          .eq("team_id", membership.team.id),
        "לא ניתן לטעון דרישות כשירות",
      ),
      selectOrThrow(
        supabase
          .from("equipment_types")
          .select("id, team_id, name, category, serial_required, is_active, created_at")
          .eq("team_id", membership.team.id)
          .order("name", { ascending: true }),
        "לא ניתן לטעון סוגי ציוד",
      ),
      selectOrThrow(
        supabase
          .from("person_equipment")
          .select(
            "id, team_id, person_id, equipment_type_id, model, serial_number, notes, status, assigned_at, returned_at, created_at, updated_at",
          )
          .eq("team_id", membership.team.id)
          .eq("person_id", person.id)
          .order("created_at", { ascending: false }),
        "לא ניתן לטעון ציוד",
      ),
      selectOrThrow(
        supabase
          .from("reserve_periods")
          .select("id, team_id, name, location, starts_on, ends_on, status")
          .eq("team_id", membership.team.id)
          .order("starts_on", { ascending: false }),
        "לא ניתן לטעון היסטוריית מילואים",
      ),
    ]);

  const privateDetails = canManageTeam
    ? await selectMaybePrivateDetails(supabase, membership.team.id, person.id)
    : null;

  // Attendance is reached only through the get_person_attendance_summary RPC (see
  // supabase/migrations/20260828150500_phase7_safe_operational_facts_rpcs.sql) — it is a
  // SECURITY DEFINER function that returns already-aggregated present/total counts per
  // reserve period (self-or-manager authorized inside the function), never raw daily rows.
  // attendance_days/attendance_entries are manager-only-SELECT in production; a direct
  // table read here would silently return nothing for a viewer looking at their own profile.
  const [rotationGroups, rotationMembers, attendanceSummaryResult] = await Promise.all([
    selectOrThrow(
      supabase.from("rotation_groups").select("id, reserve_period_id, name").eq("team_id", membership.team.id),
      "לא ניתן לטעון קבוצות רוטציה",
    ),
    selectOrThrow(
      supabase
        .from("rotation_members")
        .select("id, rotation_group_id, person_id, starts_on, ends_on")
        .eq("team_id", membership.team.id)
        .eq("person_id", person.id),
      "לא ניתן לטעון שיוכי רוטציה",
    ),
    supabase.rpc("get_person_attendance_summary", {
      target_team_id: membership.team.id,
      target_person_id: person.id,
    }),
  ]);

  if (attendanceSummaryResult.error) {
    throw new Error(`לא ניתן לטעון סיכום נוכחות: ${attendanceSummaryResult.error.message}`);
  }

  const pakalById = new Map(pakalTypes.map((pakal) => [pakal.id, pakal]));
  const equipmentTypeById = new Map(equipmentTypes.map((type) => [type.id, type]));
  const requirementsByPakalId = new Map(
    requirements.map((requirement) => [requirement.pakal_type_id, requirement.required_count]),
  );
  const activePakals = personPakals.filter((pakal) => pakal.is_active);
  const assignedCounts = countActivePakals(activePakals);
  const rotationGroupById = new Map(rotationGroups.map((group) => [group.id, group]));
  const attendanceByPeriodId = new Map<string, { present: number; total: number }>(
    (attendanceSummaryResult.data ?? []).map((item) => [
      item.reserve_period_id,
      { present: item.present_count, total: item.total_count },
    ]),
  );

  // Equipment serial numbers/models are sensitive: a manager sees all team equipment,
  // but a viewer may only see their own issued equipment. The RLS policy on
  // person_equipment enforces this at the database layer; this mirrors it so the
  // app never renders another person's equipment even if the query already
  // returned rows (e.g. before the enforcing migration lands in this environment).
  const canViewThisPersonEquipment = canManageTeam || person.auth_user_id === viewerUserId;

  return {
    canManageTeam,
    equipment: canViewThisPersonEquipment
      ? equipment.map((item) => ({
          ...item,
          equipmentType: equipmentTypeById.get(item.equipment_type_id) ?? null,
        }))
      : [],
    equipmentTypes,
    pakalTypes: pakalTypes.map((pakal) => ({
      ...pakal,
      assignedCount: assignedCounts.get(pakal.id) ?? 0,
      requiredCount: requirementsByPakalId.get(pakal.id) ?? 0,
    })),
    person,
    privateDetails,
    reserveHistory: reservePeriods.map((period) => ({
      attendance: attendanceByPeriodId.get(period.id) ?? { present: 0, total: 0 },
      period,
      rotations: rotationMembers.flatMap((member) => {
        const group = rotationGroupById.get(member.rotation_group_id);
        if (!group || group.reserve_period_id !== period.id) return [];

        return {
          endsOn: member.ends_on,
          groupName: group.name,
          startsOn: member.starts_on,
        };
      }),
    })),
    selectedPakals: personPakals.map((pakal) => ({
      ...pakal,
      pakal: pakalById.get(pakal.pakal_type_id) ?? null,
    })),
    team: membership.team,
  };
}

async function selectMaybePrivateDetails(
  supabase: Client,
  teamId: string,
  personId: string,
) {
  const { data, error } = await supabase
    .from("person_private_details")
    .select("person_id, team_id, personal_number, national_id, private_notes, created_at, updated_at")
    .eq("team_id", teamId)
    .eq("person_id", personId)
    .maybeSingle();

  if (error) {
    throw new Error(`לא ניתן לטעון פרטים רגישים: ${error.message}`);
  }

  return data;
}

async function selectOrThrow<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  message: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }

  return data ?? ([] as T);
}

function countActivePakals(personPakals: Array<Pick<TableRow<"person_pakals">, "pakal_type_id">>) {
  const counts = new Map<string, number>();

  for (const pakal of personPakals) {
    counts.set(pakal.pakal_type_id, (counts.get(pakal.pakal_type_id) ?? 0) + 1);
  }

  return counts;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
