import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { getOperationalScheduleSummary } from "@/lib/kav/schedule";
import { getOperationalDay } from "@/lib/kav/operations";
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
  manager = false,
): Promise<DashboardData> {
  const today = getDateInTimeZone(team.timezone);
  const now = new Date().toISOString();

  const [
    activePeopleResult,
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
  assertOk(upcomingEventResult.error, "upcoming event");
  assertOk(requirementsResult.error, "pakal requirements");
  assertOk(personPakalsResult.error, "person pakals");

  const [operationalSchedule, operationalDay] = await Promise.all([
    getOperationalScheduleSummary(supabase, team, today),
    getOperationalDay(supabase, team, today),
  ]);
  const currentPeriod = operationalSchedule.period;
  const attendance = {
    absent: operationalDay.summary.absent,
    present: operationalDay.summary.expectedPresent,
    submitted: operationalDay.attendanceDay?.status === "submitted",
    total: operationalDay.summary.expected,
    unexpectedPresent: operationalDay.summary.unexpectedPresent,
  };
  const rotationStatus = operationalSchedule.rotationStatus;
  const expectedOnBase = operationalSchedule.expectedOnBase;

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
    expectedOnBase: operationalDay.period ? operationalDay.summary.expected : expectedOnBase,
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

function assertOk(error: { message: string } | null, label: string) {
  if (error) {
    throw new Error(`Unable to load ${label}: ${error.message}`);
  }
}
