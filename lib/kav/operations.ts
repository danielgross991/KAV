import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getDateInTimeZone } from "@/lib/kav/dates";
import {
  resolveOperationalPerson,
  selectOperationalReservePeriod,
  type AttendanceInput,
  type LeaveInput,
  type RotationState,
} from "@/lib/kav/schedule-domain";
import type { TeamSummary } from "@/lib/kav/teams";

type Client = SupabaseClient<Database>;
type Row<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];

export type OperationalPerson = Pick<Row<"people">, "full_name" | "id" | "is_active"> & {
  resolution: ReturnType<typeof resolveOperationalPerson>;
};

export type OperationalDay = {
  attendanceDay: Row<"attendance_days"> | null;
  date: string;
  leaves: LeaveInput[];
  people: OperationalPerson[];
  period: Row<"reserve_periods"> | null;
  summary: {
    absent: number;
    expected: number;
    expectedPresent: number;
    leave: number;
    present: number;
    unexpectedPresent: number;
    unreported: number;
  };
};

export type OperationalRange = {
  people: Pick<Row<"people">, "full_name" | "id" | "is_active">[];
  resolve: (personId: string, date: string) => ReturnType<typeof resolveOperationalPerson>;
};

export async function getApprovedLeaveWindows(
  supabase: Client,
  teamId: string,
  reservePeriodId: string,
  startsOn: string,
  endsOn: string,
): Promise<LeaveInput[]> {
  const { data, error } = await supabase.rpc("get_team_approved_leave_windows", {
    target_team_id: teamId,
    target_reserve_period_id: reservePeriodId,
  });
  assertOk(error, "approved leave windows");

  return (data ?? [])
    .filter((item) => item.approved_starts_on !== null && item.approved_ends_on !== null
      && item.approved_starts_on <= endsOn && item.approved_ends_on >= startsOn)
    .map((item) => ({
      id: item.id,
      personId: item.person_id,
      status: item.status,
      startsOn: item.starts_on,
      endsOn: item.ends_on,
      approvedStartsOn: item.approved_starts_on,
      approvedEndsOn: item.approved_ends_on,
    }));
}

export async function getOperationalRange(
  supabase: Client,
  team: TeamSummary,
  period: Row<"reserve_periods">,
  startsOn: string,
  endsOn: string,
): Promise<OperationalRange> {
  const [peopleResult, groupsResult, blocksResult, overridesResult, leavesResult, attendanceDaysResult] = await Promise.all([
    supabase.from("people").select("id, full_name, is_active").eq("team_id", team.id).eq("is_active", true)
      .order("display_order").order("full_name"),
    supabase.from("rotation_groups").select("id").eq("team_id", team.id).eq("reserve_period_id", period.id),
    supabase.from("rotation_blocks").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .lte("starts_on", endsOn).gte("ends_on", startsOn),
    supabase.from("rotation_overrides").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .lte("starts_on", endsOn).gte("ends_on", startsOn),
    getApprovedLeaveWindows(supabase, team.id, period.id, startsOn, endsOn),
    supabase.from("attendance_days").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .gte("attendance_date", startsOn).lte("attendance_date", endsOn),
  ]);
  [peopleResult, groupsResult, blocksResult, overridesResult, attendanceDaysResult]
    .forEach((result) => assertOk(result.error, "operational range"));

  const groupIds = (groupsResult.data ?? []).map((group) => group.id);
  const attendanceDayIds = (attendanceDaysResult.data ?? []).map((day) => day.id);
  const [membershipsResult, attendanceResult] = await Promise.all([
    groupIds.length
      ? supabase.from("rotation_members").select("*").eq("team_id", team.id).in("rotation_group_id", groupIds)
        .or(`starts_on.is.null,starts_on.lte.${endsOn}`).or(`ends_on.is.null,ends_on.gte.${startsOn}`)
      : Promise.resolve({ data: [], error: null }),
    attendanceDayIds.length
      ? supabase.from("attendance_entries").select("*").eq("team_id", team.id).in("attendance_day_id", attendanceDayIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  assertOk(membershipsResult.error, "operational range memberships");
  assertOk(attendanceResult.error, "operational range attendance");

  const attendanceDateByDay = new Map((attendanceDaysResult.data ?? []).map((day) => [day.id, day.attendance_date]));
  const memberships = (membershipsResult.data ?? []).map((item) => ({
    personId: item.person_id,
    groupId: item.rotation_group_id,
    startsOn: item.starts_on ?? period.starts_on,
    endsOn: item.ends_on ?? period.ends_on,
  }));
  const blocks = (blocksResult.data ?? []).map((item) => ({
    groupId: item.rotation_group_id,
    state: item.state as RotationState,
    startsOn: item.starts_on,
    endsOn: item.ends_on,
  }));
  const overrides = (overridesResult.data ?? []).flatMap((item) => item.to_rotation_group_id ? [{
    personId: item.person_id,
    fromGroupId: item.from_rotation_group_id,
    toGroupId: item.to_rotation_group_id,
    startsOn: item.starts_on,
    endsOn: item.ends_on,
  }] : []);
  const leaves = leavesResult;

  return {
    people: peopleResult.data ?? [],
    resolve(personId, date) {
      const attendanceEntries: AttendanceInput[] = (attendanceResult.data ?? [])
        .filter((entry) => attendanceDateByDay.get(entry.attendance_day_id) === date)
        .map((entry) => ({ personId: entry.person_id, isPresent: entry.is_present }));
      return resolveOperationalPerson({
        personId,
        date,
        memberships,
        blocks,
        overrides,
        leaves,
        attendanceEntries,
      });
    },
  };
}

export async function getOperationalDay(
  supabase: Client,
  team: TeamSummary,
  date = getDateInTimeZone(team.timezone),
  explicitPeriodId?: string,
): Promise<OperationalDay> {
  const [{ data: periods, error: periodsError }, { data: people, error: peopleError }] = await Promise.all([
    supabase.from("reserve_periods").select("*").eq("team_id", team.id),
    supabase.from("people").select("id, full_name, is_active").eq("team_id", team.id).eq("is_active", true)
      .order("display_order").order("full_name"),
  ]);
  assertOk(periodsError, "reserve periods");
  assertOk(peopleError, "people");
  const period = explicitPeriodId
    ? (periods ?? []).find((item) => item.id === explicitPeriodId && item.starts_on <= date && item.ends_on >= date) ?? null
    : selectOperationalReservePeriod(periods ?? [], date);
  if (!period) return emptyDay(date);

  const [groupsResult, blocksResult, overridesResult, leaves, attendanceDayResult] = await Promise.all([
    supabase.from("rotation_groups").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id),
    supabase.from("rotation_blocks").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .lte("starts_on", date).gte("ends_on", date),
    supabase.from("rotation_overrides").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .lte("starts_on", date).gte("ends_on", date),
    getApprovedLeaveWindows(supabase, team.id, period.id, date, date),
    supabase.from("attendance_days").select("*").eq("team_id", team.id).eq("reserve_period_id", period.id)
      .eq("attendance_date", date).maybeSingle(),
  ]);
  [groupsResult, blocksResult, overridesResult, attendanceDayResult]
    .forEach((result) => assertOk(result.error, "operational day"));

  const groupIds = (groupsResult.data ?? []).map((group) => group.id);
  const [membersResult, attendanceResult] = await Promise.all([
    groupIds.length
      ? supabase.from("rotation_members").select("*").eq("team_id", team.id).in("rotation_group_id", groupIds)
        .or(`starts_on.is.null,starts_on.lte.${date}`).or(`ends_on.is.null,ends_on.gte.${date}`)
      : Promise.resolve({ data: [], error: null }),
    attendanceDayResult.data
      ? supabase.from("attendance_entries").select("*").eq("team_id", team.id)
        .eq("attendance_day_id", attendanceDayResult.data.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  assertOk(membersResult.error, "rotation memberships");
  assertOk(attendanceResult.error, "attendance entries");

  const memberships = (membersResult.data ?? []).map((item) => ({
    personId: item.person_id, groupId: item.rotation_group_id,
    startsOn: item.starts_on ?? period.starts_on, endsOn: item.ends_on ?? period.ends_on,
  }));
  const blocks = (blocksResult.data ?? []).map((item) => ({
    groupId: item.rotation_group_id, state: item.state as RotationState,
    startsOn: item.starts_on, endsOn: item.ends_on,
  }));
  const overrides = (overridesResult.data ?? []).flatMap((item) => item.to_rotation_group_id ? [{
    personId: item.person_id, fromGroupId: item.from_rotation_group_id,
    toGroupId: item.to_rotation_group_id, startsOn: item.starts_on, endsOn: item.ends_on,
  }] : []);
  const attendanceEntries: AttendanceInput[] = (attendanceResult.data ?? []).map((item) => ({
    personId: item.person_id, isPresent: item.is_present,
  }));
  const resolvedPeople = (people ?? []).map((person) => ({
    ...person,
    resolution: resolveOperationalPerson({
      personId: person.id, date, memberships, blocks, overrides, leaves, attendanceEntries,
    }),
  }));
  const expected = resolvedPeople.filter((person) => person.resolution.expectedAtBase);
  return {
    attendanceDay: attendanceDayResult.data,
    date,
    leaves,
    people: resolvedPeople,
    period,
    summary: {
      expected: expected.length,
      expectedPresent: expected.filter((person) => person.resolution.attendance === "present").length,
      leave: resolvedPeople.filter((person) => person.resolution.leave).length,
      present: resolvedPeople.filter((person) => person.resolution.attendance === "present").length,
      absent: expected.filter((person) => person.resolution.attendance === "absent").length,
      unreported: expected.filter((person) => person.resolution.attendance === "unreported").length,
      unexpectedPresent: resolvedPeople.filter((person) => person.resolution.discrepancy === "unexpected-presence").length,
    },
  };
}

function emptyDay(date: string): OperationalDay {
  return {
    attendanceDay: null, date, leaves: [], people: [], period: null,
    summary: { absent: 0, expected: 0, expectedPresent: 0, leave: 0, present: 0, unexpectedPresent: 0, unreported: 0 },
  };
}

function assertOk(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
}
