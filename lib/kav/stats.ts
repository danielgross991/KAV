import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { addCalendarDays, eachCalendarDate, getDateInTimeZone } from "@/lib/kav/dates";
import { getOperationalRange } from "@/lib/kav/operations";
import { selectOperationalReservePeriod } from "@/lib/kav/schedule-domain";
import { computeAttendanceStats, rankHomeLeaderboard, type DailyResolution, type PersonAttendanceStats } from "@/lib/kav/stats-domain";
import type { TeamSummary } from "@/lib/kav/teams";

export type { PersonAttendanceStats } from "@/lib/kav/stats-domain";

type Client = SupabaseClient<Database>;

export type TeamStats = {
  leaderboard: PersonAttendanceStats[];
  periodId: string | null;
  stats: PersonAttendanceStats[];
};

/**
 * DB-backed team stats for the currently-operational reserve period, built by reusing the
 * same resolver as the rest of the app (getOperationalRange -> resolveOperationalPerson) so
 * this never becomes a second source of truth for rotation/leave/attendance semantics.
 * Safe for viewers to call: getOperationalRange reads leave date-ranges through the
 * privacy-preserving get_team_approved_leave_windows RPC, never raw leave reasons.
 */
export async function getTeamStats(
  supabase: Client,
  team: TeamSummary,
  today = getDateInTimeZone(team.timezone),
): Promise<TeamStats> {
  const { data: periods, error } = await supabase
    .from("reserve_periods")
    .select("*")
    .eq("team_id", team.id)
    .in("status", ["active", "published"])
    .lte("starts_on", today)
    .gte("ends_on", today);
  if (error) throw new Error(`Unable to load reserve periods for stats: ${error.message}`);

  const period = selectOperationalReservePeriod(periods ?? [], today);
  if (!period) return { leaderboard: [], periodId: null, stats: [] };

  const elapsedEnd = today < period.ends_on ? addCalendarDays(today, -1) : period.ends_on;
  if (elapsedEnd < period.starts_on) return { leaderboard: [], periodId: period.id, stats: [] };

  const range = await getOperationalRange(supabase, team, period, period.starts_on, elapsedEnd);
  const activePeople = range.people.filter((person) => person.is_active);
  const elapsedDates = eachCalendarDate(period.starts_on, elapsedEnd);

  const resolutionsByPerson = new Map<string, DailyResolution[]>();
  for (const person of activePeople) {
    const days: DailyResolution[] = elapsedDates.map((date) => {
      const resolution = range.resolve(person.id, date);
      return {
        attendance: resolution.attendance,
        expectedAtBase: resolution.expectedAtBase,
        leave: Boolean(resolution.leave),
        state: resolution.state,
      };
    });
    resolutionsByPerson.set(person.id, days);
  }

  const stats = computeAttendanceStats(
    activePeople.map((person) => ({ fullName: person.full_name, id: person.id })),
    resolutionsByPerson,
  );

  return {
    leaderboard: rankHomeLeaderboard(stats).slice(0, 3),
    periodId: period.id,
    stats,
  };
}
