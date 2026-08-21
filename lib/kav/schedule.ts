import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getDateInTimeZone } from "@/lib/kav/dates";
import {
  resolvePersonSchedule,
  validateScheduleForPublication,
  type PublicationIssue,
  type RotationState,
} from "@/lib/kav/schedule-domain";
import type { TeamMembership } from "@/lib/kav/teams";
import { canManage } from "@/lib/kav/teams";

type Client = SupabaseClient<Database>;
type Row<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];

export type ScheduleData = {
  blocks: Row<"rotation_blocks">[];
  canManage: boolean;
  config: Row<"rotation_generation_configs"> | null;
  events: Row<"schedule_events">[];
  groups: Row<"rotation_groups">[];
  memberships: Row<"rotation_members">[];
  overrides: Row<"rotation_overrides">[];
  people: Pick<Row<"people">, "full_name" | "id" | "is_active">[];
  periods: Row<"reserve_periods">[];
  phases: Row<"period_phases">[];
  selectedPeriod: Row<"reserve_periods"> | null;
  team: TeamMembership["team"];
  today: string;
  validationIssues: PublicationIssue[];
};

export async function getScheduleData(
  supabase: Client,
  membership: TeamMembership,
  selectedPeriodId?: string,
): Promise<ScheduleData> {
  const team = membership.team;
  const today = getDateInTimeZone(team.timezone);
  const [{ data: periods, error: periodsError }, { data: people, error: peopleError }] = await Promise.all([
    supabase.from("reserve_periods").select("*").eq("team_id", team.id).order("starts_on", { ascending: false }),
    supabase.from("people").select("id, full_name, is_active").eq("team_id", team.id).order("display_order").order("full_name"),
  ]);
  assertOk(periodsError, "reserve periods");
  assertOk(peopleError, "people");

  const allPeriods = periods ?? [];
  const selectedPeriod =
    allPeriods.find((period) => period.id === selectedPeriodId) ??
    allPeriods.find((period) => period.starts_on <= today && period.ends_on >= today && ["active", "published"].includes(period.status)) ??
    allPeriods[0] ?? null;

  if (!selectedPeriod) {
    return {
      blocks: [], canManage: canManage(membership.role), config: null, events: [], groups: [],
      memberships: [], overrides: [], people: people ?? [], periods: allPeriods, phases: [],
      selectedPeriod: null, team, today, validationIssues: [],
    };
  }

  const [phasesResult, groupsResult, blocksResult, overridesResult, eventsResult, configResult] = await Promise.all([
    supabase.from("period_phases").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).order("sort_order"),
    supabase.from("rotation_groups").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).order("sort_order"),
    supabase.from("rotation_blocks").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).order("starts_on"),
    supabase.from("rotation_overrides").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).order("starts_on"),
    supabase.from("schedule_events").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).order("starts_at"),
    supabase.from("rotation_generation_configs").select("*").eq("team_id", team.id).eq("reserve_period_id", selectedPeriod.id).maybeSingle(),
  ]);
  [phasesResult, groupsResult, blocksResult, overridesResult, eventsResult, configResult].forEach((result) => assertOk(result.error, "schedule"));

  const groups = groupsResult.data ?? [];
  const groupIds = groups.map((group) => group.id);
  const membershipsResult = groupIds.length
    ? await supabase.from("rotation_members").select("*").eq("team_id", team.id).in("rotation_group_id", groupIds)
    : { data: [], error: null };
  assertOk(membershipsResult.error, "rotation memberships");

  const phases = phasesResult.data ?? [];
  const blocks = blocksResult.data ?? [];
  const overrides = overridesResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const activePeopleIds = (people ?? []).filter((person) => person.is_active).map((person) => person.id);
  const validationIssues = validateScheduleForPublication({
    period: { startsOn: selectedPeriod.starts_on, endsOn: selectedPeriod.ends_on },
    activePeopleIds,
    groups,
    memberships: memberships.map((item) => ({
      personId: item.person_id, groupId: item.rotation_group_id,
      startsOn: item.starts_on ?? selectedPeriod.starts_on, endsOn: item.ends_on ?? selectedPeriod.ends_on,
    })),
    blocks: blocks.map((item) => ({
      groupId: item.rotation_group_id, state: item.state as RotationState,
      startsOn: item.starts_on, endsOn: item.ends_on,
    })),
    overrides: overrides.flatMap((item) => item.to_rotation_group_id ? [{
      personId: item.person_id, fromGroupId: item.from_rotation_group_id,
      toGroupId: item.to_rotation_group_id, startsOn: item.starts_on, endsOn: item.ends_on,
    }] : []),
    phases: phases.map((phase) => ({ startsOn: phase.starts_on, endsOn: phase.ends_on, type: phase.phase_type })),
  });

  return {
    blocks, canManage: canManage(membership.role), config: configResult.data, events: eventsResult.data ?? [],
    groups, memberships, overrides, people: people ?? [], periods: allPeriods, phases,
    selectedPeriod, team, today, validationIssues,
  };
}

export function getDaySchedule(data: ScheduleData, date: string) {
  const membershipInputs = data.memberships.map((item) => ({
    personId: item.person_id, groupId: item.rotation_group_id,
    startsOn: item.starts_on ?? data.selectedPeriod?.starts_on ?? date,
    endsOn: item.ends_on ?? data.selectedPeriod?.ends_on ?? date,
  }));
  const blockInputs = data.blocks.map((item) => ({
    groupId: item.rotation_group_id, state: item.state as RotationState,
    startsOn: item.starts_on, endsOn: item.ends_on,
  }));
  const overrideInputs = data.overrides.flatMap((item) => item.to_rotation_group_id ? [{
    personId: item.person_id, fromGroupId: item.from_rotation_group_id,
    toGroupId: item.to_rotation_group_id, startsOn: item.starts_on, endsOn: item.ends_on,
  }] : []);
  const people = data.people.map((person) => ({
    ...person,
    resolution: resolvePersonSchedule({
      personId: person.id, date, memberships: membershipInputs, blocks: blockInputs, overrides: overrideInputs,
    }),
  }));
  const groups = data.groups.map((group) => ({
    ...group,
    block: data.blocks.find((block) => block.rotation_group_id === group.id && block.starts_on <= date && block.ends_on >= date) ?? null,
  }));
  return {
    date, groups, people,
    phase: data.phases.find((phase) => phase.starts_on <= date && phase.ends_on >= date) ?? null,
    events: data.events.filter((event) => getDateInTimeZone(data.team.timezone, new Date(event.starts_at)) === date),
    expectedBase: people.filter((person) => person.is_active && person.resolution.state === "base"),
    expectedHome: people.filter((person) => person.is_active && person.resolution.state === "home"),
    overrides: data.overrides.filter((item) => item.starts_on <= date && item.ends_on >= date),
  };
}

export async function getOperationalScheduleSummary(
  supabase: Client,
  team: TeamMembership["team"],
  today = getDateInTimeZone(team.timezone),
) {
  const { data: period, error } = await supabase.from("reserve_periods")
    .select("*").eq("team_id", team.id).in("status", ["active", "published"])
    .lte("starts_on", today).gte("ends_on", today).order("status", { ascending: true })
    .order("starts_on", { ascending: false }).limit(1).maybeSingle();
  assertOk(error, "operational reserve period");
  if (!period) return { period: null, rotationStatus: [], expectedOnBase: 0 };

  const [groupsResult, blocksResult, overridesResult, peopleResult] = await Promise.all([
    supabase.from("rotation_groups").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id).order("sort_order"),
    supabase.from("rotation_blocks").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id).lte("starts_on", today).gte("ends_on", today),
    supabase.from("rotation_overrides").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id).lte("starts_on", today).gte("ends_on", today),
    supabase.from("people").select("id, is_active").eq("team_id", team.id).eq("is_active", true),
  ]);
  [groupsResult, blocksResult, overridesResult, peopleResult].forEach((result) => assertOk(result.error, "operational schedule"));
  const groups = groupsResult.data ?? [];
  const groupIds = groups.map((group) => group.id);
  const { data: memberships, error: membershipError } = groupIds.length
    ? await supabase.from("rotation_members").select("*").eq("team_id", team.id).in("rotation_group_id", groupIds)
      .or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`)
    : { data: [], error: null };
  assertOk(membershipError, "operational memberships");
  const membershipInputs = (memberships ?? []).map((item) => ({
    personId: item.person_id, groupId: item.rotation_group_id,
    startsOn: item.starts_on ?? period.starts_on, endsOn: item.ends_on ?? period.ends_on,
  }));
  const blockInputs = (blocksResult.data ?? []).map((item) => ({
    groupId: item.rotation_group_id, state: item.state as RotationState,
    startsOn: item.starts_on, endsOn: item.ends_on,
  }));
  const overrideInputs = (overridesResult.data ?? []).flatMap((item) => item.to_rotation_group_id ? [{
    personId: item.person_id, fromGroupId: item.from_rotation_group_id,
    toGroupId: item.to_rotation_group_id, startsOn: item.starts_on, endsOn: item.ends_on,
  }] : []);
  const expectedOnBase = (peopleResult.data ?? []).filter((person) =>
    resolvePersonSchedule({ personId: person.id, date: today, memberships: membershipInputs, blocks: blockInputs, overrides: overrideInputs }).state === "base",
  ).length;
  return {
    period,
    expectedOnBase,
    rotationStatus: groups.map((group) => ({
      name: group.name,
      state: blockInputs.find((block) => block.groupId === group.id)?.state ?? "unknown",
    })),
  };
}

function assertOk(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
}
