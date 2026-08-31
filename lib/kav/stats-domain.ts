export type AttendanceState = "present" | "absent" | "unreported";
export type RotationState = "base" | "home";

export type DailyResolution = {
  attendance: AttendanceState;
  expectedAtBase: boolean;
  leave: boolean;
  state: RotationState | null;
};

export type PersonStatsInput = {
  fullName: string;
  id: string;
  photoUrl?: string | null;
};

export type PersonAttendanceStats = {
  attendancePercentage: number | null;
  baseDays: number;
  finalizedExpectedDays: number;
  fullName: string;
  homeDays: number;
  homePercentage: number;
  leaveDays: number;
  personId: string;
  photoUrl: string | null;
  presentOnExpectedDays: number;
  totalElapsedDays: number;
};

/**
 * Aggregates per-person operational-day resolutions (already produced by the shared
 * schedule-domain resolver) into attendance/home statistics. Only elapsed dates should be
 * passed in — the caller decides what "elapsed" means (typically: strictly before today).
 * Unreported attendance is never counted as absence, and a legitimate home rotation or
 * approved leave never reduces the attendance percentage, because expectedAtBase already
 * accounts for both.
 */
export function computeAttendanceStats(
  people: PersonStatsInput[],
  resolutionsByPerson: Map<string, DailyResolution[]>,
): PersonAttendanceStats[] {
  return people.map((person) => {
    const days = resolutionsByPerson.get(person.id) ?? [];
    const baseDays = days.filter((day) => day.state === "base").length;
    const homeDays = days.filter((day) => day.state === "home").length;
    const leaveDays = days.filter((day) => day.leave).length;
    const expectedDays = days.filter((day) => day.expectedAtBase);
    const finalizedExpectedDays = expectedDays.filter((day) => day.attendance !== "unreported");
    const presentOnExpectedDays = finalizedExpectedDays.filter((day) => day.attendance === "present").length;
    const totalElapsedDays = days.length;

    return {
      attendancePercentage: finalizedExpectedDays.length > 0
        ? presentOnExpectedDays / finalizedExpectedDays.length
        : null,
      baseDays,
      finalizedExpectedDays: finalizedExpectedDays.length,
      fullName: person.fullName,
      homeDays,
      homePercentage: totalElapsedDays > 0 ? homeDays / totalElapsedDays : 0,
      leaveDays,
      personId: person.id,
      photoUrl: person.photoUrl ?? null,
      presentOnExpectedDays,
      totalElapsedDays,
    };
  });
}

/**
 * Historical imports may have actual daily presence from legacy spreadsheets even when
 * the planned rotation blocks were reconstructed later. For completed reserve periods,
 * let the finalized attendance table describe where the person really was:
 * present = base, absent = home.
 */
export function applyHistoricalAttendanceSemantics(day: DailyResolution): DailyResolution {
  if (day.attendance === "present") {
    return { ...day, expectedAtBase: true, state: "base" };
  }
  if (day.attendance === "absent") {
    return { ...day, expectedAtBase: false, state: "home" };
  }
  return day;
}

/**
 * Deterministic "אלופי הבית" ranking: most home days wins, ties broken by home
 * percentage, then by name/id so the order never depends on incidental array order.
 */
export function rankHomeLeaderboard(stats: PersonAttendanceStats[]): PersonAttendanceStats[] {
  return [...stats].sort((a, b) =>
    b.homeDays - a.homeDays ||
    b.homePercentage - a.homePercentage ||
    a.fullName.localeCompare(b.fullName, "he") ||
    a.personId.localeCompare(b.personId));
}
