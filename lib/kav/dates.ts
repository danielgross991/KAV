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

function parseCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid calendar date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
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
