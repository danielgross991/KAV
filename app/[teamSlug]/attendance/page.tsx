import { CalendarX2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceWorkspace } from "@/components/attendance-workspace";
import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { addCalendarDays, eachCalendarDate, getDateInTimeZone } from "@/lib/kav/dates";
import { requireAuth } from "@/lib/kav/auth";
import { getOperationalDay, type OperationalDay } from "@/lib/kav/operations";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

export default async function AttendancePage({ params, searchParams }: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) redirect(`/${teamSlug}`);
  const today = getDateInTimeZone(membership.team.timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : today;
  const rawSelectedDay = await getOperationalDay(supabase, membership.team, date, undefined, true, true);
  const period = rawSelectedDay.period;
  const startsOn = period ? maxDate(period.starts_on, addCalendarDays(date, -14)) : date;
  const endsOn = period ? minDate(period.ends_on, addCalendarDays(date, 14)) : date;
  const preloadDates = period ? [addCalendarDays(startsOn, -1), ...eachCalendarDate(startsOn, endsOn)] : [date];
  const rawDays = await Promise.all(
    preloadDates.map((dayDate) => getOperationalDay(supabase, membership.team, dayDate, period?.id, true, true)),
  );
  const rawDaysByDate = new Map(rawDays.map((day) => [day.date, day]));
  const days = eachCalendarDate(startsOn, endsOn).map((dayDate) => {
    const rawDay = rawDaysByDate.get(dayDate) ?? emptyDay(dayDate);
    const previousDay = rawDaysByDate.get(addCalendarDays(dayDate, -1)) ?? emptyDay(addCalendarDays(dayDate, -1));
    return applyYesterdayAttendanceDefaults(rawDay, previousDay);
  });

  return (
    <AppPage className="max-w-[920px]">
      <PageHeader eyebrow={membership.team.name} title="נוכחות" subtitle="דיווח מהיר לפי ימים" />

      {!period ? (
        <EmptyState icon={<CalendarX2 className="size-4" />} title="אין תקופת מילואים פעילה" description="לא ניתן לדווח נוכחות ללא תקופה תפעולית לתאריך הזה." />
      ) : (
        <AttendanceWorkspace
          initialDate={date}
          initialDays={days}
          teamSlug={teamSlug}
          today={today}
        />
      )}
    </AppPage>
  );
}

function maxDate(a: string, b: string) { return a > b ? a : b; }
function minDate(a: string, b: string) { return a < b ? a : b; }

function emptyDay(date: string): OperationalDay {
  return {
    attendanceDayStatus: null,
    date,
    leaves: [],
    people: [],
    period: null,
    rotationStatus: [],
    summary: { absent: 0, expected: 0, expectedPresent: 0, leave: 0, present: 0, unexpectedPresent: 0, unreported: 0 },
  };
}

function applyYesterdayAttendanceDefaults(day: Awaited<ReturnType<typeof getOperationalDay>>, previousDay: Awaited<ReturnType<typeof getOperationalDay>>) {
  const previousByPersonId = new Map(previousDay.people.map((person) => [person.id, person.resolution.attendance]));
  return {
    ...day,
    people: day.people.map((person) => {
      const previousAttendance = previousByPersonId.get(person.id);
      if (person.resolution.attendance !== "unreported" || previousAttendance === undefined || previousAttendance === "unreported") {
        return person;
      }

      return {
        ...person,
        resolution: {
          ...person.resolution,
          attendance: previousAttendance,
          attendanceSource: "yesterday" as const,
          discrepancy: null,
        },
      };
    }),
  };
}
