import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarX2, Check, CircleMinus, MessageCircle, RotateCcw, Send } from "lucide-react";
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
  const day = await getOperationalDay(supabase, membership.team, date, undefined, true);
  const reportText = attendanceReportText(day.people, date);
  const reportContacts = day.people.filter((person) => person.phone);

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
            <WhatsAppReport contacts={reportContacts} reportText={reportText} />
            <Roster title="כל הצוות" empty="אין אנשי צוות פעילים" people={day.people} teamSlug={teamSlug} date={date} />
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
  return <div className="divide-y">{people.map((person) => <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={person.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="block truncate text-sm">{person.full_name}</b>{person.personal_number ? <span className="kav-num text-xs text-muted-foreground">{person.personal_number}</span> : null}<ReportStatusBadge person={person} /></div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{stateLabel(person.resolution.state)}</span>{person.resolution.override ? <Badge variant="info">חריג סבב</Badge> : null}{person.resolution.leave ? <Badge variant="warning">ביציאה מאושרת</Badge> : null}{person.resolution.discrepancy === "unexpected-presence" ? <Badge variant="special">נוכחות חריגה</Badge> : null}</div></div><div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1"><AttendanceButton person={person} state="present" icon={<Check className="size-4" />} label="נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="absent" icon={<CircleMinus className="size-4" />} label="לא נוכח" teamSlug={teamSlug} date={date} /><AttendanceButton person={person} state="unreported" icon={<RotateCcw className="size-4" />} label="איפוס" teamSlug={teamSlug} date={date} /></div></div>)}</div>;
}

function AttendanceButton({ person, state, icon, label, teamSlug, date }: { person: OperationalPerson; state: string; icon: React.ReactNode; label: string; teamSlug: string; date: string }) {
  const active = person.resolution.attendance === state;
  return <form action={markAttendanceAction.bind(null, teamSlug)}><input type="hidden" name="date" value={date} /><input type="hidden" name="person_id" value={person.id} /><input type="hidden" name="state" value={state} /><Button aria-label={`${label} - ${person.full_name}`} className={cn("h-10 w-full border-transparent px-2", active && state === "present" && "bg-success-soft text-success shadow-sm", active && state === "absent" && "bg-red-50 text-destructive shadow-sm", active && state === "unreported" && "bg-card text-foreground shadow-sm")} size="sm" variant="ghost">{icon}<span className="hidden min-[390px]:inline">{label}</span></Button></form>;
}

function WhatsAppReport({ contacts, reportText }: { contacts: OperationalPerson[]; reportText: string }) {
  return (
    <section className="rounded-lg border bg-card p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">דוח וואטסאפ</h2>
          <p className="mt-1 text-sm text-muted-foreground">טקסט מוכן לשליחה עם כל הצוות וסיכום נוכחים.</p>
        </div>
        <a className={buttonVariants()} href={whatsAppHref(reportText)} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" />
          שליחה בוואטסאפ
        </a>
      </div>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-right text-sm leading-7">{reportText}</pre>
      {contacts.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {contacts.map((person) => (
            <a className={buttonVariants({ size: "sm", variant: "outline" })} href={whatsAppHref(reportText, person.phone)} key={person.id} target="_blank" rel="noreferrer">
              שליחה ל{person.full_name}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReportStatusBadge({ person }: { person: OperationalPerson }) {
  const status = attendanceReportStatus(person);
  const variant = status === "נוכח" ? "success" : status === "לא נוכח" ? "danger" : status === "בבית" ? "info" : "muted";
  return <Badge variant={variant}>{status}</Badge>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="min-w-0 p-3 text-center"><div className="kav-num text-2xl font-bold">{value}</div><div className="mt-0.5 truncate text-[11px] text-white/65">{label}</div></div>; }
function href(slug: string, date: string) { return `/${slug}/attendance?date=${date}`; }
function stateLabel(state: string | null) { return state === "base" ? "בסיס" : state === "home" ? "בית" : "ללא תכנון"; }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function shortReportDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }

function attendanceReportText(people: OperationalPerson[], date: string) {
  const lines = [
    "*דוח 1 ניוד*",
    shortReportDate(date),
    ...people.map((person, index) => {
      const personalNumber = person.personal_number ? ` ${person.personal_number}` : "";
      return `${index + 1}.${person.full_name}${personalNumber} - ${attendanceReportStatus(person)}`;
    }),
    `נוכחים: ${people.filter((person) => person.resolution.attendance === "present").length}`,
  ];

  return lines.join("\n");
}

function attendanceReportStatus(person: OperationalPerson) {
  if (person.resolution.attendance === "present") return "נוכח";
  if (person.resolution.attendance === "absent") return "לא נוכח";
  if (person.resolution.leave || person.resolution.state === "home") return "בבית";
  return "טרם דווח";
}

function whatsAppHref(text: string, phone?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  const target = normalizedPhone ? `https://wa.me/${normalizedPhone}` : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(text)}`;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}
