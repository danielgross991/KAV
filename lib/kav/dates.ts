export function getDateInTimeZone(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = parseCalendarDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function calendarDayDifference(from: string, to: string): number {
  return Math.round((parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime()) / 86_400_000);
}

export function eachCalendarDate(startsOn: string, endsOn: string): string[] {
  const dates: string[] = [];
  for (let date = startsOn; date <= endsOn; date = addCalendarDays(date, 1)) dates.push(date);
  return dates;
}

export function getWeekStart(date: string, weekStartDay = 0) {
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    throw new Error("Week start day must be between 0 and 6");
  }
  const day = parseCalendarDate(date).getUTCDay();
  return addCalendarDays(date, -((day - weekStartDay + 7) % 7));
}

export function localDateTimeToIso(
  timeZone: string,
  localDate: string,
  localTime = "00:00",
): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Invalid local date or time");
  }

  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateTimeParts(timeZone, candidate);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    candidate = new Date(candidate.getTime() + desired - represented);
  }

  const resolved = dateTimeParts(timeZone, candidate);
  if (
    resolved.year !== year || resolved.month !== month || resolved.day !== day ||
    resolved.hour !== hour || resolved.minute !== minute
  ) {
    throw new Error(`Local time ${localDate} ${localTime} does not exist in ${timeZone}`);
  }
  return candidate.toISOString();
}

export function overlapsCalendarDayInTimeZone(
  timeZone: string,
  date: string,
  startsAt: string | Date,
  endsAt?: string | Date | null,
): boolean {
  const dayStartsAt = new Date(localDateTimeToIso(timeZone, date));
  const nextDayStartsAt = new Date(localDateTimeToIso(timeZone, addCalendarDays(date, 1)));
  const rangeStartsAt = toValidDate(startsAt);
  const rangeEndsAt = endsAt ? toValidDate(endsAt) : rangeStartsAt;

  if (rangeEndsAt < rangeStartsAt) throw new Error("Event end must not precede its start");
  if (rangeEndsAt.getTime() === rangeStartsAt.getTime()) {
    return rangeStartsAt >= dayStartsAt && rangeStartsAt < nextDayStartsAt;
  }

  return rangeStartsAt < nextDayStartsAt && rangeEndsAt > dayStartsAt;
}

function parseCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid calendar date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

function toValidDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date-time value");
  return date;
}

function dateTimeParts(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit",
    month: "2-digit", timeZone, year: "numeric",
  });
  const values = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(values.get("year")), month: Number(values.get("month")),
    day: Number(values.get("day")), hour: Number(values.get("hour")), minute: Number(values.get("minute")),
  };
}
