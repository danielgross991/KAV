import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarX2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceWorkspace } from "@/components/attendance-workspace";
import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { addCalendarDays, getDateInTimeZone } from "@/lib/kav/dates";
import { requireAuth } from "@/lib/kav/auth";
import { getOperationalDay } from "@/lib/kav/operations";
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
  const [rawDay, previousDay] = await Promise.all([
    getOperationalDay(supabase, membership.team, date, undefined, true),
    getOperationalDay(supabase, membership.team, addCalendarDays(date, -1)),
  ]);
  const day = applyYesterdayAttendanceDefaults(rawDay, previousDay);

  return (
    <AppPage className="max-w-[920px]">
      <PageHeader eyebrow={membership.team.name} title="נוכחות" subtitle={`${fullDate(date)}${date === today ? " · היום" : ""}`}>
        <div className="flex items-center gap-1.5">
          <Link aria-label="היום הקודם" className={buttonVariants({ variant: "outline", size: "icon" })} href={href(teamSlug, addCalendarDays(date, -1))}><ArrowRight className="size-4" /></Link>
          <form className="flex min-w-0 flex-1 gap-1.5">
            <input className="min-w-0 flex-1 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30" type="date" name="date" defaultValue={date} aria-label="תאריך נוכחות" />
            <Button variant="outline">מעבר</Button>
          </form>
          <Link aria-label="היום הבא" className={buttonVariants({ variant: "outline", size: "icon" })} href={href(teamSlug, addCalendarDays(date, 1))}><ArrowLeft className="size-4" /></Link>
          {date !== today ? <Link className="hidden h-10 items-center px-2 text-sm font-medium text-primary sm:flex" href={href(teamSlug, today)}>היום</Link> : null}
        </div>
      </PageHeader>

      {!day.period ? (
        <EmptyState icon={<CalendarX2 className="size-4" />} title="אין תקופת מילואים פעילה" description="לא ניתן לדווח נוכחות ללא תקופה תפעולית לתאריך הזה." />
      ) : (
        <AttendanceWorkspace
          attendanceDayStatus={day.attendanceDayStatus}
          date={date}
          initialPeople={day.people}
          key={date}
          teamSlug={teamSlug}
        />
      )}
    </AppPage>
  );
}

function href(slug: string, date: string) { return `/${slug}/attendance?date=${date}`; }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }

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
