import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { selectOperationalReservePeriod } from "@/lib/kav/schedule-domain";

type Client = SupabaseClient<Database>;
type TableRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];

export const CURRENT_RESERVE_PERIOD_STATUSES = ["active", "published"] as const;

export type CurrentRotation = {
  id: string;
  name: string;
};

export type CurrentRotationContext = {
  reservePeriod: Pick<TableRow<"reserve_periods">, "ends_on" | "id" | "name" | "starts_on" | "status"> | null;
  rotationByPersonId: Map<string, CurrentRotation>;
  rotationOptions: CurrentRotation[];
};

export async function getCurrentRotationContext(
  supabase: Client,
  teamId: string,
  timeZone: string,
  today = getDateInTimeZone(timeZone),
): Promise<CurrentRotationContext> {
  const { data: reservePeriods, error: reservePeriodError } = await supabase
    .from("reserve_periods")
    .select("id, name, starts_on, ends_on, status")
    .eq("team_id", teamId)
    .in("status", [...CURRENT_RESERVE_PERIOD_STATUSES])
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("starts_on", { ascending: false });

  if (reservePeriodError) {
    throw new Error(`Unable to load current reserve period: ${reservePeriodError.message}`);
  }

  const reservePeriod = selectOperationalReservePeriod(reservePeriods ?? [], today);
  if (!reservePeriod) {
    return emptyCurrentRotationContext();
  }

  const { data: rotationGroups, error: rotationGroupsError } = await supabase
    .from("rotation_groups")
    .select("id, reserve_period_id, name, sort_order")
    .eq("team_id", teamId)
    .eq("reserve_period_id", reservePeriod.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (rotationGroupsError) {
    throw new Error(`Unable to load current rotation groups: ${rotationGroupsError.message}`);
  }

  const groups = rotationGroups ?? [];
  const rotationOptions = groups.map((group) => ({ id: group.id, name: group.name }));
  if (groups.length === 0) {
    return { reservePeriod, rotationByPersonId: new Map(), rotationOptions };
  }

  const groupIds = groups.map((group) => group.id);
  const { data: rotationMembers, error: rotationMembersError } = await supabase
    .from("rotation_members")
    .select("id, person_id, rotation_group_id, starts_on, ends_on")
    .eq("team_id", teamId)
    .in("rotation_group_id", groupIds)
    .or(`starts_on.is.null,starts_on.lte.${today}`)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  if (rotationMembersError) {
    throw new Error(`Unable to load current rotation members: ${rotationMembersError.message}`);
  }

  const rotationByGroupId = new Map(rotationOptions.map((rotation) => [rotation.id, rotation]));
  const groupPositionById = new Map(groups.map((group, index) => [group.id, index]));
  const rotationByPersonId = new Map<string, CurrentRotation>();

  for (const member of [...(rotationMembers ?? [])].sort((a, b) =>
    compareCurrentMemberships(a, b, groupPositionById),
  )) {
    if (!isRotationMembershipValidOn(member, today)) continue;

    const rotation = rotationByGroupId.get(member.rotation_group_id);
    if (rotation && !rotationByPersonId.has(member.person_id)) {
      rotationByPersonId.set(member.person_id, rotation);
    }
  }

  return { reservePeriod, rotationByPersonId, rotationOptions };
}

export function isRotationMembershipValidOn(
  member: Pick<TableRow<"rotation_members">, "ends_on" | "starts_on">,
  today: string,
) {
  return (!member.starts_on || member.starts_on <= today) && (!member.ends_on || member.ends_on >= today);
}

function emptyCurrentRotationContext(): CurrentRotationContext {
  return {
    reservePeriod: null,
    rotationByPersonId: new Map(),
    rotationOptions: [],
  };
}

function compareCurrentMemberships(
  a: Pick<TableRow<"rotation_members">, "id" | "rotation_group_id" | "starts_on">,
  b: Pick<TableRow<"rotation_members">, "id" | "rotation_group_id" | "starts_on">,
  groupPositionById: Map<string, number>,
) {
  const startCompare = (b.starts_on ?? "").localeCompare(a.starts_on ?? "");
  if (startCompare !== 0) return startCompare;

  const aPosition = groupPositionById.get(a.rotation_group_id) ?? Number.MAX_SAFE_INTEGER;
  const bPosition = groupPositionById.get(b.rotation_group_id) ?? Number.MAX_SAFE_INTEGER;
  if (aPosition !== bPosition) return aPosition - bPosition;

  return a.id.localeCompare(b.id);
}
