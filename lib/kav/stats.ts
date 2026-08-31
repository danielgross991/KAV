import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { addCalendarDays, eachCalendarDate, getDateInTimeZone } from "@/lib/kav/dates";
import { getOperationalRange } from "@/lib/kav/operations";
import { selectOperationalReservePeriod } from "@/lib/kav/schedule-domain";
import {
  applyHistoricalAttendanceSemantics,
  computeAttendanceStats,
  rankHomeLeaderboard,
  type DailyResolution,
  type PersonAttendanceStats,
} from "@/lib/kav/stats-domain";
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
  selectedPeriodId?: string,
): Promise<TeamStats> {
  const { data: periods, error } = await supabase
    .from("reserve_periods")
    .select("*")
    .eq("team_id", team.id)
    .order("starts_on", { ascending: false });
  if (error) throw new Error(`Unable to load reserve periods for stats: ${error.message}`);

  const period = selectedPeriodId
    ? (periods ?? []).find((item) => item.id === selectedPeriodId) ?? null
    : selectOperationalReservePeriod(
        (periods ?? []).filter((item) => item.status === "active" || item.status === "published"),
        today,
      );
  if (!period) return { leaderboard: [], periodId: null, stats: [] };

  const elapsedEnd = today < period.ends_on ? addCalendarDays(today, -1) : period.ends_on;
  if (elapsedEnd < period.starts_on) return { leaderboard: [], periodId: period.id, stats: [] };

  const range = await getOperationalRange(supabase, team, period, period.starts_on, elapsedEnd);
  const activePeople = range.people.filter((person) => person.is_active);
  const elapsedDates = eachCalendarDate(period.starts_on, elapsedEnd);

  const resolutionsByPerson = new Map<string, DailyResolution[]>();
  const useActualHistoricalAttendance = period.status === "completed";
  for (const person of activePeople) {
    const days: DailyResolution[] = elapsedDates.map((date) => {
      const resolution = range.resolve(person.id, date);
      const day = {
        attendance: resolution.attendance,
        expectedAtBase: resolution.expectedAtBase,
        leave: Boolean(resolution.leave),
        state: resolution.state,
      };
      return useActualHistoricalAttendance ? applyHistoricalAttendanceSemantics(day) : day;
    });
    resolutionsByPerson.set(person.id, days);
  }

  const stats = computeAttendanceStats(
    activePeople.map((person) => ({ fullName: person.full_name, id: person.id, photoUrl: person.photo_url })),
    resolutionsByPerson,
  );

  return {
    leaderboard: rankHomeLeaderboard(stats).slice(0, 3),
    periodId: period.id,
    stats,
  };
}
