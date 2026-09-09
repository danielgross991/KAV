import { eachCalendarDate } from "@/lib/kav/dates";

export const riskyLeaveRequestThreshold = 3;

export type LeaveRiskInput = {
  endsOn: string;
  id?: string;
  personId?: string;
  personName?: string;
  startsOn: string;
  status: string;
};

export type LeaveRiskDay = {
  count: number;
  date: string;
  people: string[];
};

export function isCountedLeaveRequestStatus(status: string) {
  return status !== "cancelled" && status !== "rejected";
}

export function buildLeaveRiskDays(
  requests: LeaveRiskInput[],
  threshold = riskyLeaveRequestThreshold,
): LeaveRiskDay[] {
  const days = new Map<string, { count: number; people: Set<string> }>();

  for (const request of requests) {
    if (!isCountedLeaveRequestStatus(request.status)) continue;

    for (const date of eachCalendarDate(request.startsOn, request.endsOn)) {
      const day = days.get(date) ?? { count: 0, people: new Set<string>() };
      day.count += 1;
      day.people.add(request.personName ?? request.personId ?? request.id ?? "איש צוות");
      days.set(date, day);
    }
  }

  return [...days.entries()]
    .map(([date, day]) => ({
      count: day.count,
      date,
      people: [...day.people].sort((a, b) => a.localeCompare(b, "he")),
    }))
    .filter((day) => day.count > threshold)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildLeaveRiskDateSet(requests: LeaveRiskInput[]) {
  return new Set(buildLeaveRiskDays(requests).map((day) => day.date));
}

export function getLeaveRiskDates(request: LeaveRiskInput, riskDateSet: Set<string>) {
  if (!isCountedLeaveRequestStatus(request.status)) return [];
  return eachCalendarDate(request.startsOn, request.endsOn).filter((date) => riskDateSet.has(date));
}
