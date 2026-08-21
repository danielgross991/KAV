import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { TeamSummary } from "@/lib/kav/teams";

type Supabase = SupabaseClient<Database>;

export type DashboardData = {
  activePeople: number;
  approvedLeaveToday: number;
  attendance: {
    absent: number;
    present: number;
    submitted: boolean;
    total: number;
  };
  currentPeriod:
    | {
        endsOn: string;
        location: string | null;
        name: string;
        startsOn: string;
        status: string;
      }
    | null;
  expectedOnBase: number;
  issues: string[];
  qualificationReadiness: {
    current: number;
    name: string;
    required: number;
  }[];
  rotationStatus: {
    name: string;
    state: string;
  }[];
  team: TeamSummary;
  upcomingEvent:
    | {
        startsAt: string;
        title: string;
        type: string;
      }
    | null;
};

export async function getDashboardData(
  supabase: Supabase,
  team: TeamSummary,
): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const [
    activePeopleResult,
    currentPeriodResult,
    approvedLeaveResult,
    attendanceDayResult,
    upcomingEventResult,
    requirementsResult,
    personPakalsResult,
  ] = await Promise.all([
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .eq("is_active", true),
    supabase
      .from("reserve_periods")
      .select("id, name, location, starts_on, ends_on, status")
      .eq("team_id", team.id)
      .lte("starts_on", today)
      .gte("ends_on", today)
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .in("status", ["approved", "partially_approved"])
      .lte("starts_on", today)
      .gte("ends_on", today),
    supabase
      .from("attendance_days")
      .select("id, status")
      .eq("team_id", team.id)
      .eq("attendance_date", today)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("schedule_events")
      .select("title, event_type, starts_at")
      .eq("team_id", team.id)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("team_pakal_requirements")
      .select("required_count, pakal_types!inner(id, name)")
      .eq("team_id", team.id),
    supabase
      .from("person_pakals")
      .select("pakal_type_id")
      .eq("team_id", team.id)
      .eq("is_active", true),
  ]);

  assertOk(activePeopleResult.error, "active people");
  assertOk(currentPeriodResult.error, "current period");
  assertOk(approvedLeaveResult.error, "approved leave");
  assertOk(attendanceDayResult.error, "attendance day");
  assertOk(upcomingEventResult.error, "upcoming event");
  assertOk(requirementsResult.error, "pakal requirements");
  assertOk(personPakalsResult.error, "person pakals");

  const currentPeriod = currentPeriodResult.data;
  const attendance = await getAttendanceSummary(
    supabase,
    team.id,
    attendanceDayResult.data?.id,
    attendanceDayResult.data?.status === "submitted",
  );
  const rotationStatus = currentPeriod
    ? await getRotationStatus(supabase, team.id, currentPeriod.id, today)
    : [];
  const expectedOnBase = currentPeriod
    ? await getExpectedOnBase(supabase, team.id, today, rotationStatus)
    : 0;

  const personPakals = personPakalsResult.data ?? [];
  const pakalCounts = new Map<string, number>();
  personPakals.forEach((pakal) => {
    pakalCounts.set(pakal.pakal_type_id, (pakalCounts.get(pakal.pakal_type_id) ?? 0) + 1);
  });

  const requirements = (requirementsResult.data ?? []) as unknown as {
    pakal_types: { id: string; name: string };
    required_count: number;
  }[];

  const issues: string[] = [];
  if (!currentPeriod) {
    issues.push("לא הוגדרה תקופת מילואים פעילה להיום");
  }
  if (currentPeriod && rotationStatus.length === 0) {
    issues.push("אין סבבי רוטציה פעילים להיום");
  }

  return {
    activePeople: activePeopleResult.count ?? 0,
    approvedLeaveToday: approvedLeaveResult.count ?? 0,
    attendance,
    currentPeriod: currentPeriod
      ? {
          endsOn: currentPeriod.ends_on,
          location: currentPeriod.location,
          name: currentPeriod.name,
          startsOn: currentPeriod.starts_on,
          status: currentPeriod.status,
        }
      : null,
    expectedOnBase,
    issues,
    qualificationReadiness: requirements.map((requirement) => ({
      current: pakalCounts.get(requirement.pakal_types.id) ?? 0,
      name: requirement.pakal_types.name,
      required: requirement.required_count,
    })),
    rotationStatus,
    team,
    upcomingEvent: upcomingEventResult.data
      ? {
          startsAt: upcomingEventResult.data.starts_at,
          title: upcomingEventResult.data.title,
          type: upcomingEventResult.data.event_type,
        }
      : null,
  };
}

async function getAttendanceSummary(
  supabase: Supabase,
  teamId: string,
  attendanceDayId: string | undefined,
  submitted: boolean,
) {
  if (!attendanceDayId) {
    return { absent: 0, present: 0, submitted: false, total: 0 };
  }

  const { data, error } = await supabase
    .from("attendance_entries")
    .select("is_present")
    .eq("team_id", teamId)
    .eq("attendance_day_id", attendanceDayId);

  assertOk(error, "attendance entries");

  const entries = data ?? [];
  const present = entries.filter((entry) => entry.is_present).length;

  return {
    absent: entries.length - present,
    present,
    submitted,
    total: entries.length,
  };
}

async function getRotationStatus(
  supabase: Supabase,
  teamId: string,
  reservePeriodId: string,
  today: string,
) {
  const { data, error } = await supabase
    .from("rotation_blocks")
    .select("state, rotation_groups!inner(name)")
    .eq("team_id", teamId)
    .eq("reserve_period_id", reservePeriodId)
    .lte("starts_on", today)
    .gte("ends_on", today);

  assertOk(error, "rotation blocks");

  return ((data ?? []) as unknown as { rotation_groups: { name: string }; state: string }[])
    .map((block) => ({
      name: block.rotation_groups.name,
      state: block.state,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

async function getExpectedOnBase(
  supabase: Supabase,
  teamId: string,
  today: string,
  rotationStatus: { name: string; state: string }[],
) {
  const onBaseNames = rotationStatus
    .filter((rotation) => ["base", "on_base", "in_base"].includes(rotation.state))
    .map((rotation) => rotation.name);

  if (onBaseNames.length === 0) return 0;

  const { data: groups, error: groupError } = await supabase
    .from("rotation_groups")
    .select("id, name")
    .eq("team_id", teamId)
    .in("name", onBaseNames);

  assertOk(groupError, "rotation groups");

  const groupIds = (groups ?? []).map((group) => group.id);
  if (groupIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("rotation_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .in("rotation_group_id", groupIds)
    .or(`starts_on.is.null,starts_on.lte.${today}`)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  assertOk(error, "rotation members");

  return count ?? 0;
}

function assertOk(error: { message: string } | null, label: string) {
  if (error) {
    throw new Error(`Unable to load ${label}: ${error.message}`);
  }
}
