import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import type { Database } from "@/lib/database.types";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { getOperationalDay } from "@/lib/kav/operations";
import { getTeamStats, type PersonAttendanceStats } from "@/lib/kav/stats";
import { getNextPersonalTask } from "@/lib/kav/tasks";
import type { TeamSummary } from "@/lib/kav/teams";

type Supabase = SupabaseClient<Database>;

export type DashboardData = {
  canManage: boolean;
  activePeople: number;
  approvedLeaveToday: number;
  attendance: {
    absent: number;
    present: number;
    submitted: boolean;
    total: number;
    unexpectedPresent: number;
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
  homeLeaderboard: PersonAttendanceStats[];
  attendanceStats: PersonAttendanceStats[];
  issues: string[];
  nextTask: Awaited<ReturnType<typeof getNextPersonalTask>>;
  personalStatus: {
    attendance: "absent" | "present" | "unreported";
    fullName: string;
    isOnLeave: boolean;
    personId: string;
    state: "base" | "home" | null;
  } | null;
  personalStats: PersonAttendanceStats | null;
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
  statsPeriodId: string | null;
  statsPeriods: {
    endsOn: string;
    id: string;
    location: string | null;
    name: string;
    startsOn: string;
    status: string;
  }[];
  upcomingEvent:
    | {
        startsAt: string;
        title: string;
        type: string;
      }
    | null;
};

export const getDashboardData = cache(async function getDashboardData(
  supabase: Supabase,
  team: TeamSummary,
  manager = false,
  userId?: string,
  selectedStatsPeriodId?: string,
): Promise<DashboardData> {
  const today = getDateInTimeZone(team.timezone);
  const now = new Date().toISOString();

  const [
    activePeopleResult,
    requirementsResult,
    personPakalsResult,
    currentPersonResult,
    statsPeriodsResult,
  ] = await Promise.all([
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .eq("is_active", true),
    supabase
      .from("team_pakal_requirements")
      .select("required_count, pakal_types!inner(id, name)")
      .eq("team_id", team.id),
    supabase
      .from("person_pakals")
      .select("pakal_type_id")
      .eq("team_id", team.id)
      .eq("is_active", true),
    userId
      ? supabase
          .from("people")
          .select("id, full_name")
          .eq("team_id", team.id)
          .eq("auth_user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("reserve_periods")
      .select("id, name, location, starts_on, ends_on, status")
      .eq("team_id", team.id)
      .order("starts_on", { ascending: false }),
  ]);

  assertOk(activePeopleResult.error, "active people");
  assertOk(requirementsResult.error, "pakal requirements");
  assertOk(personPakalsResult.error, "person pakals");
  assertOk(currentPersonResult.error, "current person");
  assertOk(statsPeriodsResult.error, "stats periods");

  const selectedPeriod = selectedStatsPeriodId
    ? (statsPeriodsResult.data ?? []).find((period) => period.id === selectedStatsPeriodId) ?? null
    : null;
  let upcomingEventQuery = supabase
    .from("schedule_events")
    .select("title, event_type, starts_at")
    .eq("team_id", team.id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(1);

  if (selectedPeriod) {
    upcomingEventQuery = upcomingEventQuery.eq("reserve_period_id", selectedPeriod.id);
  }

  const [operationalDay, nextTask, teamStats, upcomingEventResult] = await Promise.all([
    getOperationalDay(supabase, team, today, selectedPeriod?.id),
    userId ? getNextPersonalTask(supabase, team, userId, selectedPeriod?.id) : Promise.resolve(null),
    getTeamStats(supabase, team, today, selectedStatsPeriodId),
    upcomingEventQuery.maybeSingle(),
  ]);
  assertOk(upcomingEventResult.error, "upcoming event");
  const currentPeriod = selectedPeriod ?? operationalDay.period;
  const attendance = {
    absent: operationalDay.summary.absent,
    present: operationalDay.summary.expectedPresent,
    submitted: operationalDay.attendanceDayStatus === "submitted",
    total: operationalDay.summary.expected,
    unexpectedPresent: operationalDay.summary.unexpectedPresent,
  };
  const rotationStatus = operationalDay.rotationStatus;
  const expectedOnBase = operationalDay.summary.expected;

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
  if (operationalDay.summary.absent) issues.push(`${operationalDay.summary.absent} פערי נוכחות`);
  if (operationalDay.summary.unreported) issues.push(`${operationalDay.summary.unreported} טרם דווחו בנוכחות`);
  if (operationalDay.summary.unexpectedPresent) issues.push(`${operationalDay.summary.unexpectedPresent} נוכחות חריגה`);

  const currentPerson = currentPersonResult.data;
  const personalResolution = currentPerson
    ? operationalDay.people.find((person) => person.id === currentPerson.id)?.resolution
    : null;

  return {
    activePeople: activePeopleResult.count ?? 0,
    canManage: manager,
    approvedLeaveToday: operationalDay.summary.leave,
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
    homeLeaderboard: teamStats.leaderboard,
    attendanceStats: teamStats.stats,
    issues,
    nextTask,
    personalStatus: currentPerson && personalResolution
      ? {
          attendance: personalResolution.attendance,
          fullName: currentPerson.full_name,
          isOnLeave: Boolean(personalResolution.leave),
          personId: currentPerson.id,
          state: personalResolution.state,
        }
      : null,
    personalStats: currentPerson ? teamStats.stats.find((item) => item.personId === currentPerson.id) ?? null : null,
    qualificationReadiness: requirements.map((requirement) => ({
      current: pakalCounts.get(requirement.pakal_types.id) ?? 0,
      name: requirement.pakal_types.name,
      required: requirement.required_count,
    })),
    rotationStatus,
    team,
    statsPeriodId: teamStats.periodId,
    statsPeriods: (statsPeriodsResult.data ?? []).map((period) => ({
      endsOn: period.ends_on,
      id: period.id,
      location: period.location,
      name: period.name,
      startsOn: period.starts_on,
      status: period.status,
    })),
    upcomingEvent: upcomingEventResult.data
      ? {
          startsAt: upcomingEventResult.data.starts_at,
          title: upcomingEventResult.data.title,
          type: upcomingEventResult.data.event_type,
        }
      : null,
  };
});

function assertOk(error: { message: string } | null, label: string) {
  if (error) {
    throw new Error(`Unable to load ${label}: ${error.message}`);
  }
}
