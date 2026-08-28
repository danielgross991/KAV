import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarX2, Check, CircleMinus, RotateCcw, Send } from "lucide-react";
import { redirect } from "next/navigation";

import { markAttendanceAction, markExpectedPresentAction, submitAttendanceAction } from "@/app/[teamSlug]/attendance/actions";
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

  return <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
    <header className="border-b pb-5"><Badge variant="secondary">{membership.team.name}</Badge><h1 className="mt-3 text-3xl font-bold tracking-normal">נוכחות</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Link aria-label="היום הקודם" className={buttonVariants({ variant: "outline", size: "icon" })} href={href(teamSlug, addCalendarDays(date, -1))}><ArrowRight className="size-4" /></Link><form className="flex gap-2"><input className="h-10 rounded-md border bg-background px-2 text-sm" type="date" name="date" defaultValue={date} /><Button variant="outline">מעבר</Button></form><Link aria-label="היום הבא" className={buttonVariants({ variant: "outline", size: "icon" })} href={href(teamSlug, addCalendarDays(date, 1))}><ArrowLeft className="size-4" /></Link>{date !== today ? <Link className={buttonVariants({ variant: "ghost" })} href={href(teamSlug, today)}>היום</Link> : null}</div>
      <p className="mt-3 font-medium">{fullDate(date)}{date === today ? " · היום" : ""}</p>
    </header>
    {!day.period ? <div className="grid min-h-72 place-items-center text-center"><div><CalendarX2 className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-3 text-lg font-semibold">אין תקופת מילואים פעילה</h2></div></div> : <>
      <section className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4"><Metric label="צפויים" value={day.summary.expected} /><Metric label="נוכחים" value={day.summary.present} /><Metric label="לא נוכחים" value={day.summary.absent} /><Metric label="טרם דווחו" value={day.summary.unreported} /></section>
      <div className="flex flex-wrap gap-2 border-b py-4"><form action={markExpectedPresentAction.bind(null, teamSlug)}><input type="hidden" name="date" value={date} /><Button><Check className="size-4" />סמן את כל הצפויים כנוכחים</Button></form><form action={submitAttendanceAction.bind(null, teamSlug)}><input type="hidden" name="date" value={date} /><Button variant="outline"><Send className="size-4" />{day.attendanceDay?.status === "submitted" ? "דווח" : "סיום ודיווח"}</Button></form></div>
      <Roster title="צפויים בבסיס" empty="אין אנשי צוות הצפויים בבסיס ביום זה" people={expected} teamSlug={teamSlug} date={date} />
      <Roster title="יציאות מאושרות" empty="אין יציאות פעילות" people={leave} teamSlug={teamSlug} date={date} />
      <details className="border-b py-4"><summary className="cursor-pointer font-semibold">לא צפויים · {other.length}</summary><RosterContent people={other} teamSlug={teamSlug} date={date} /></details>
    </>}
  </main>;
}

function Roster({ title, empty, ...props }: { title: string; empty: string; people: OperationalPerson[]; teamSlug: string; date: string }) { return <section className="border-b py-5"><h2 className="font-semibold">{title} · {props.people.length}</h2>{props.people.length ? <RosterContent {...props} /> : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>}</section>; }
function RosterContent({ people, teamSlug, date }: { people: OperationalPerson[]; teamSlug: string; date: string }) { return <div className="mt-3 divide-y rounded-md border">{people.map((person) => <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={person.id}><div><b>{person.full_name}</b><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{stateLabel(person.resolution.state)}</span>{person.resolution.override ? <span>חריג סבב</span> : null}{person.resolution.leave ? <span>ביציאה מאושרת</span> : null}{person.resolution.discrepancy === "unexpected-presence" ? <Badge variant="outline">נוכחות חריגה</Badge> : null}</div></div><div className="grid grid-cols-3 gap-1"><AttendanceButton person={person} state="present" icon={<Check className="size-4" />} label="נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="absent" icon={<CircleMinus className="size-4" />} label="לא נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="unreported" icon={<RotateCcw className="size-4" />} label="איפוס" teamSlug={teamSlug} date={date} /></div></div>)}</div>; }
function AttendanceButton({ person, state, icon, label, teamSlug, date }: { person: OperationalPerson; state: string; icon: React.ReactNode; label: string; teamSlug: string; date: string }) { const active = person.resolution.attendance === state; return <form action={markAttendanceAction.bind(null, teamSlug)}><input type="hidden" name="date" value={date} /><input type="hidden" name="person_id" value={person.id} /><input type="hidden" name="state" value={state} /><Button aria-label={`${label} - ${person.full_name}`} className={cn("w-full", active && state === "present" && "border-emerald-600 bg-emerald-50 text-emerald-900", active && state === "absent" && "border-red-500 bg-red-50 text-red-900")} size="sm" variant="outline">{icon}<span className="hidden sm:inline">{label}</span></Button></form>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="bg-background p-3"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>; }
function href(slug: string, date: string) { return `/${slug}/attendance?date=${date}`; }
function stateLabel(state: string | null) { return state === "base" ? "בסיס" : state === "home" ? "בית" : "ללא תכנון"; }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
