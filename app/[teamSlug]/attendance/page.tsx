import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarX2, Check, CircleMinus, RotateCcw, Send } from "lucide-react";
import { redirect } from "next/navigation";

import { markAttendanceAction, markExpectedPresentAction, submitAttendanceAction } from "@/app/[teamSlug]/attendance/actions";
import { AppPage, EmptyState, PageHeader, SectionHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { addCalendarDays, getDateInTimeZone } from "@/lib/kav/dates";
import { requireAuth } from "@/lib/kav/auth";
import { getOperationalDay, type OperationalPerson } from "@/lib/kav/operations";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";
import { cn } from "@/lib/utils";

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
  const day = await getOperationalDay(supabase, membership.team, date);
  const expected = day.people.filter((person) => person.resolution.expectedAtBase);
  const leave = day.people.filter((person) => person.resolution.leave);
  const other = day.people.filter((person) => !person.resolution.expectedAtBase && !person.resolution.leave);

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
        <>
          <section className="overflow-hidden rounded-lg bg-primary text-white">
            <div className="grid grid-cols-4 divide-x divide-x-reverse divide-white/15">
              <Metric label="צפויים" value={day.summary.expected} />
              <Metric label="נוכחים" value={day.summary.present} />
              <Metric label="לא נוכחים" value={day.summary.absent} />
              <Metric label="טרם דווחו" value={day.summary.unreported} />
            </div>
            <div className="flex flex-col gap-2 border-t border-white/15 p-3 sm:flex-row">
              <form action={markExpectedPresentAction.bind(null, teamSlug)} className="flex-1"><input type="hidden" name="date" value={date} /><Button className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15"><Check className="size-4" />סמן את כל הצפויים כנוכחים</Button></form>
              <form action={submitAttendanceAction.bind(null, teamSlug)} className="flex-1"><input type="hidden" name="date" value={date} /><Button className="w-full border-white/30 bg-white text-primary hover:bg-white/90" variant="outline"><Send className="size-4" />{day.attendanceDayStatus === "submitted" ? "דווח" : "סיום ודיווח"}</Button></form>
            </div>
          </section>

          <div className="mt-5 space-y-5">
            <Roster title="צפויים בבסיס" empty="אין אנשי צוות הצפויים בבסיס ביום זה" people={expected} teamSlug={teamSlug} date={date} />
            <Roster title="יציאות מאושרות" empty="אין יציאות פעילות" people={leave} teamSlug={teamSlug} date={date} />
            <details className="rounded-lg border bg-card">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-3.5 text-sm font-semibold">לא צפויים <Badge variant="muted">{other.length}</Badge></summary>
              <div className="border-t"><RosterContent people={other} teamSlug={teamSlug} date={date} /></div>
            </details>
          </div>
        </>
      )}
    </AppPage>
  );
}

function Roster({ title, empty, ...props }: { title: string; empty: string; people: OperationalPerson[]; teamSlug: string; date: string }) {
  return <section><SectionHeader title={title} hint={`${props.people.length}`} />{props.people.length ? <div className="overflow-hidden rounded-lg border bg-card"><RosterContent {...props} /></div> : <div className="flex min-h-14 items-center rounded-lg border bg-card px-3.5 text-sm text-muted-foreground">{empty}</div>}</section>;
}

function RosterContent({ people, teamSlug, date }: { people: OperationalPerson[]; teamSlug: string; date: string }) {
  return <div className="divide-y">{people.map((person) => <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={person.id}><div className="min-w-0"><b className="block truncate text-sm">{person.full_name}</b><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{stateLabel(person.resolution.state)}</span>{person.resolution.override ? <Badge variant="info">חריג סבב</Badge> : null}{person.resolution.leave ? <Badge variant="warning">ביציאה מאושרת</Badge> : null}{person.resolution.discrepancy === "unexpected-presence" ? <Badge variant="special">נוכחות חריגה</Badge> : null}</div></div><div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1"><AttendanceButton person={person} state="present" icon={<Check className="size-4" />} label="נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="absent" icon={<CircleMinus className="size-4" />} label="לא נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="unreported" icon={<RotateCcw className="size-4" />} label="איפוס" teamSlug={teamSlug} date={date} /></div></div>)}</div>;
}

function AttendanceButton({ person, state, icon, label, teamSlug, date }: { person: OperationalPerson; state: string; icon: React.ReactNode; label: string; teamSlug: string; date: string }) {
  const active = person.resolution.attendance === state;
  return <form action={markAttendanceAction.bind(null, teamSlug)}><input type="hidden" name="date" value={date} /><input type="hidden" name="person_id" value={person.id} /><input type="hidden" name="state" value={state} /><Button aria-label={`${label} - ${person.full_name}`} className={cn("h-10 w-full border-transparent px-2", active && state === "present" && "bg-success-soft text-success shadow-sm", active && state === "absent" && "bg-red-50 text-destructive shadow-sm", active && state === "unreported" && "bg-card text-foreground shadow-sm")} size="sm" variant="ghost">{icon}<span className="hidden min-[390px]:inline">{label}</span></Button></form>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="min-w-0 p-3 text-center"><div className="kav-num text-2xl font-bold">{value}</div><div className="mt-0.5 truncate text-[11px] text-white/65">{label}</div></div>; }
function href(slug: string, date: string) { return `/${slug}/attendance?date=${date}`; }
function stateLabel(state: string | null) { return state === "base" ? "בסיס" : state === "home" ? "בית" : "ללא תכנון"; }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
