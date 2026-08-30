import { addCalendarDays, eachCalendarDate } from "./dates.ts";

export type RotationState = "base" | "home";
export type DateRange = { startsOn: string; endsOn: string };
export type RotationGroupInput = { id: string; name?: string; initialState: RotationState };
export type RotationBlockInput = DateRange & {
  groupId: string;
  state: RotationState;
  source?: "generated" | "manual";
  sequenceNo?: number;
};
export type RotationMembershipInput = DateRange & { groupId: string; personId: string };
export type RotationOverrideInput = DateRange & {
  fromGroupId?: string | null;
  personId: string;
  toGroupId: string;
};
export type LeaveStatus = "pending" | "approved" | "partially_approved" | "rejected";
export type AttendanceState = "present" | "absent" | "unreported";
export type LeaveInput = DateRange & {
  id: string;
  approvedStartsOn?: string | null;
  approvedEndsOn?: string | null;
  personId: string;
  status: LeaveStatus | string;
};
export type AttendanceInput = { personId: string; isPresent: boolean };

export type OperationalPersonResolution = ReturnType<typeof resolvePersonSchedule> & {
  attendance: AttendanceState;
  discrepancy: "attendance-gap" | "unexpected-presence" | "unreported" | null;
  expectedAtBase: boolean;
  leave: LeaveInput | null;
  plannedState: RotationState | null;
};
export type OperationalReservePeriod = {
  ends_on: string;
  starts_on: string;
  status: string;
};

export function selectOperationalReservePeriod<T extends OperationalReservePeriod>(
  periods: T[],
  date: string,
): T | null {
  const current = periods.filter((period) =>
    period.starts_on <= date && period.ends_on >= date,
  );

  return newestStarting(current.filter((period) => period.status === "active")) ??
    newestStarting(current.filter((period) => period.status === "published")) ??
    null;
}

export function selectDefaultScheduleReservePeriod<T extends OperationalReservePeriod>(
  periods: T[],
  date: string,
): T | null {
  return selectOperationalReservePeriod(periods, date) ??
    newestStarting(periods.filter((period) => period.status === "draft" && period.starts_on <= date && period.ends_on >= date)) ??
    earliestStarting(periods.filter((period) =>
      period.status !== "archived" && period.ends_on >= date,
    )) ??
    newestEnding(periods.filter((period) => period.status === "completed")) ??
    null;
}

export function generateRotationBlocks(input: {
  period: DateRange;
  anchorDate: string;
  baseDays: number;
  homeDays: number;
  groups: RotationGroupInput[];
}): RotationBlockInput[] {
  if (input.period.endsOn < input.period.startsOn) throw new Error("Invalid reserve period range");
  if (input.baseDays < 1 || input.homeDays < 1) throw new Error("Rotation durations must be positive");

  return input.groups.flatMap((group) => {
    const blocks: Omit<RotationBlockInput, "sequenceNo">[] = [];
    let cursor = input.anchorDate;
    let state = group.initialState;

    while (cursor > input.period.startsOn) {
      const previousState = opposite(state);
      const previousStart = addCalendarDays(cursor, -duration(previousState, input));
      pushClipped(blocks, input.period, group.id, previousState, previousStart, addCalendarDays(cursor, -1));
      cursor = previousStart;
      state = previousState;
    }

    cursor = input.anchorDate;
    state = group.initialState;
    while (cursor <= input.period.endsOn) {
      const blockEnd = addCalendarDays(cursor, duration(state, input) - 1);
      pushClipped(blocks, input.period, group.id, state, cursor, blockEnd);
      cursor = addCalendarDays(blockEnd, 1);
      state = opposite(state);
    }

    return blocks
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      .map((block, sequenceNo) => ({ ...block, sequenceNo }));
  });
}

export function resolvePersonSchedule(input: {
  personId: string;
  date: string;
  memberships: RotationMembershipInput[];
  blocks: RotationBlockInput[];
  overrides: RotationOverrideInput[];
}) {
  const memberships = input.memberships.filter(
    (item) => item.personId === input.personId && contains(item, input.date),
  );
  if (memberships.length > 1) throw new Error("Person has overlapping rotation memberships");
  const defaultGroupId = memberships[0]?.groupId ?? null;
  const activeOverrides = input.overrides.filter(
    (item) => item.personId === input.personId && contains(item, input.date),
  );
  if (activeOverrides.length > 1) throw new Error("Person has overlapping rotation overrides");
  const override = activeOverrides[0] ?? null;
  const effectiveGroupId = override?.toGroupId ?? defaultGroupId;
  const matchingBlocks = effectiveGroupId
    ? input.blocks.filter((item) => item.groupId === effectiveGroupId && contains(item, input.date))
    : [];
  if (matchingBlocks.length > 1) throw new Error("Rotation group has overlapping blocks");

  return {
    defaultGroupId,
    effectiveGroupId,
    state: matchingBlocks[0]?.state ?? null,
    membership: memberships[0] ?? null,
    block: matchingBlocks[0] ?? null,
    override,
  };
}

export function resolveOperationalPerson(input: {
  personId: string;
  date: string;
  memberships: RotationMembershipInput[];
  blocks: RotationBlockInput[];
  overrides: RotationOverrideInput[];
  leaves: LeaveInput[];
  attendanceEntries: AttendanceInput[];
}): OperationalPersonResolution {
  const rotation = resolvePersonSchedule(input);
  const defaultBlock = rotation.defaultGroupId
    ? input.blocks.find((block) => block.groupId === rotation.defaultGroupId && contains(block, input.date)) ?? null
    : null;
  const activeLeaves = input.leaves.filter((leave) =>
    leave.personId === input.personId && isApprovedLeaveOnDate(leave, input.date),
  );
  if (activeLeaves.length > 1) throw new Error("Person has overlapping approved leave");
  const attendanceEntries = input.attendanceEntries.filter((entry) => entry.personId === input.personId);
  if (attendanceEntries.length > 1) throw new Error("Person has duplicate attendance entries");
  const attendance = attendanceEntries[0]
    ? attendanceEntries[0].isPresent ? "present" : "absent"
    : "unreported";
  const leave = activeLeaves[0] ?? null;
  const expectedAtBase = rotation.state === "base" && !leave;
  const discrepancy = expectedAtBase
    ? attendance === "absent" ? "attendance-gap" : attendance === "unreported" ? "unreported" : null
    : attendance === "present" ? "unexpected-presence" : null;

  return {
    ...rotation,
    plannedState: defaultBlock?.state ?? null,
    leave,
    expectedAtBase,
    attendance,
    discrepancy,
  };
}

export function isApprovedLeaveOnDate(leave: LeaveInput, date: string): boolean {
  if (leave.status !== "approved" && leave.status !== "partially_approved") return false;
  if (!leave.approvedStartsOn || !leave.approvedEndsOn) return false;
  return leave.approvedStartsOn <= date && leave.approvedEndsOn >= date;
}

export function validateLeaveRange(input: {
  requested: DateRange;
  approved?: DateRange | null;
  period: DateRange;
}): string[] {
  const issues: string[] = [];
  if (input.requested.endsOn < input.requested.startsOn) issues.push("invalid-requested-range");
  if (!inside(input.requested, input.period)) issues.push("requested-outside-period");
  if (input.approved) {
    if (input.approved.endsOn < input.approved.startsOn) issues.push("invalid-approved-range");
    if (!inside(input.approved, input.requested)) issues.push("approved-outside-requested");
    if (!inside(input.approved, input.period)) issues.push("approved-outside-period");
  }
  return [...new Set(issues)];
}

export type PublicationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export function validateScheduleForPublication(input: {
  period: DateRange;
  activePeopleIds: string[];
  groups: { id: string }[];
  memberships: RotationMembershipInput[];
  blocks: RotationBlockInput[];
  overrides: RotationOverrideInput[];
  phases: (DateRange & { type: string })[];
}): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  const error = (code: string, message: string) => issues.push({ code, message, severity: "error" });
  if (input.groups.length === 0) error("no-groups", "לא הוגדרו סבבים");

  for (const personId of input.activePeopleIds) {
    if (!input.memberships.some((membership) => membership.personId === personId && overlaps(membership, input.period))) {
      error("missing-membership", `איש צוות פעיל ללא שיוך לסבב: ${personId}`);
    }
  }
  for (const phase of input.phases) {
    if (!inside(phase, input.period)) error("phase-outside-period", "שלב נמצא מחוץ לטווח התקופה");
  }
  for (const block of input.blocks) {
    if (!inside(block, input.period)) error("block-outside-period", "בלוק סבב נמצא מחוץ לטווח התקופה");
  }
  for (const group of input.groups) {
    const blocks = input.blocks.filter((block) => block.groupId === group.id).sort(byStart);
    if (blocks.length === 0) error("group-without-blocks", `לסבב ${group.id} אין בלוקים`);
    for (let index = 1; index < blocks.length; index += 1) {
      if (blocks[index].startsOn <= blocks[index - 1].endsOn) error("block-overlap", `יש חפיפה בבלוקים של סבב ${group.id}`);
    }
    for (const phase of input.phases.filter((item) => item.type === "line")) {
      for (const date of eachCalendarDate(phase.startsOn, phase.endsOn)) {
        if (!blocks.some((block) => contains(block, date))) {
          error("block-gap", `חסר בלוק לסבב ${group.id} בתאריך ${date}`);
          break;
        }
      }
    }
  }
  const groupIds = new Set(input.groups.map((group) => group.id));
  for (const override of input.overrides) {
    if (
      !inside(override, input.period) ||
      !groupIds.has(override.toGroupId) ||
      (override.fromGroupId !== null && override.fromGroupId !== undefined && !groupIds.has(override.fromGroupId))
    ) {
      error("invalid-override", `חריג סבב לא תקין עבור ${override.personId}`);
    }
  }
  return uniqueIssues(issues);
}

export function contains(range: DateRange, date: string) {
  return range.startsOn <= date && range.endsOn >= date;
}

export function overlaps(a: DateRange, b: DateRange) {
  return a.startsOn <= b.endsOn && a.endsOn >= b.startsOn;
}

function inside(inner: DateRange, outer: DateRange) {
  return inner.startsOn >= outer.startsOn && inner.endsOn <= outer.endsOn && inner.endsOn >= inner.startsOn;
}

function duration(state: RotationState, input: { baseDays: number; homeDays: number }) {
  return state === "base" ? input.baseDays : input.homeDays;
}

function opposite(state: RotationState): RotationState {
  return state === "base" ? "home" : "base";
}

function pushClipped(
  blocks: Omit<RotationBlockInput, "sequenceNo">[], period: DateRange, groupId: string,
  state: RotationState, startsOn: string, endsOn: string,
) {
  const clippedStartsOn = startsOn < period.startsOn ? period.startsOn : startsOn;
  const clippedEndsOn = endsOn > period.endsOn ? period.endsOn : endsOn;
  if (clippedStartsOn <= clippedEndsOn) {
    blocks.push({ groupId, state, startsOn: clippedStartsOn, endsOn: clippedEndsOn, source: "generated" });
  }
}

function byStart(a: DateRange, b: DateRange) {
  return a.startsOn.localeCompare(b.startsOn);
}

function newestStarting<T extends OperationalReservePeriod>(periods: T[]): T | null {
  return periods.reduce<T | null>((selected, period) =>
    !selected || period.starts_on > selected.starts_on ? period : selected,
  null);
}

function earliestStarting<T extends OperationalReservePeriod>(periods: T[]): T | null {
  return periods.reduce<T | null>((selected, period) =>
    !selected || period.starts_on < selected.starts_on ? period : selected,
  null);
}

function newestEnding<T extends OperationalReservePeriod>(periods: T[]): T | null {
  return periods.reduce<T | null>((selected, period) =>
    !selected || period.ends_on > selected.ends_on ? period : selected,
  null);
}

function uniqueIssues(issues: PublicationIssue[]) {
  return [...new Map(issues.map((issue) => [`${issue.code}:${issue.message}`, issue])).values()];
}
