import Link from "next/link";
import { ArrowRight, CalendarClock, Check, CircleMinus, ClipboardList, Home, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { AppPage, PageHeader, SectionHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/kav/auth";
import { getDaySchedule, getScheduleData } from "@/lib/kav/schedule";
import { getTaskDaySchedule } from "@/lib/kav/tasks";
import { requireTeamAccess } from "@/lib/kav/teams";

type DayPageProps = {
  params: Promise<{ date: string; teamSlug: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function ScheduleDayPage({ params, searchParams }: DayPageProps) {
  const [{ date, teamSlug }, query] = await Promise.all([params, searchParams]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const data = await getScheduleData(supabase, membership, query.period, userId);
  const period = data.selectedPeriod;
  if (!period || date < period.starts_on || date > period.ends_on) notFound();
  const day = getDaySchedule(data, date);
  const taskDay = await getTaskDaySchedule(supabase, membership, date, period.id);
  const personName = new Map(data.people.map((person) => [person.id, person.full_name]));
  const groupName = new Map(data.groups.map((group) => [group.id, group.name]));
  const taskPeople = new Map(taskDay.people.map((person) => [person.id, person.full_name]));

  return (
    <AppPage className="max-w-[920px]">
      <PageHeader
        eyebrow={period.name}
        title={fullDate(date)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {day.phase ? <span>{day.phase.name}</span> : null}
            {period.location ? <span className="flex items-center gap-1"><MapPin className="size-3.5" />{period.location}</span> : null}
          </span>
        }
        action={
          <Link
            href={`/${teamSlug}/schedule?period=${period.id}&view=agenda`}
            className="flex size-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
            aria-label="חזרה ללו״ז"
          >
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section>
        <SectionHeader title="סבבים" hint={`${day.groups.length} קבוצות`} />
        <div className="grid gap-2 sm:grid-cols-2">
          {day.groups.map((group) => (
            <Card className="flex min-h-16 items-center justify-between gap-3 p-3.5" key={group.id}>
              <div>
                <h2 className="text-sm font-semibold">{group.name}</h2>
                {group.block ? <p className="kav-num mt-1 text-xs text-muted-foreground">{shortDate(group.block.starts_on)}–{shortDate(group.block.ends_on)}</p> : null}
              </div>
              <Badge variant={group.block?.state === "base" ? "success" : "muted"}>{stateLabel(group.block?.state)}</Badge>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <SectionHeader title="תכנון" />
        <div className="grid gap-3 md:grid-cols-2">
          <People title="צפויים בבסיס" icon={<Users className="size-4" />} people={day.expectedBase.map((person) => person.full_name)} />
          <People title="צפויים בבית" icon={<Home className="size-4" />} people={day.expectedHome.map((person) => person.full_name)} />
        </div>
      </section>

      {data.canManage ? (
        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <SectionHeader title="חריגים ובקשות" hint={`${day.approvedLeave.length + day.leaveRequests.length + day.overrides.length}`} />
            <Card className="divide-y overflow-hidden">
              {day.approvedLeave.map((person) => <CompactRow key={person.id} title={person.full_name} detail="יציאה מאושרת" />)}
              {day.leaveRequests.map((request) => (
                <CompactRow
                  key={request.id}
                  title={personName.get(request.personId) ?? "איש צוות"}
                  detail={`בקשת יציאה · ${leaveStatusLabel(request.status)}`}
                />
              ))}
              {day.overrides.map((override) => (
                <CompactRow
                  key={override.id}
                  title={personName.get(override.person_id) ?? "איש צוות"}
                  detail={`שינוי סבב · ${override.from_rotation_group_id ? `${groupName.get(override.from_rotation_group_id)} ← ` : ""}${override.to_rotation_group_id ? groupName.get(override.to_rotation_group_id) : "ללא סבב"}`}
                />
              ))}
              {!day.approvedLeave.length && !day.leaveRequests.length && !day.overrides.length ? <p className="p-3.5 text-sm text-muted-foreground">אין חריגים או בקשות ביום זה.</p> : null}
            </Card>
          </div>
          <div>
            <SectionHeader title="נוכחות בפועל" />
            <Card className="grid grid-cols-3 divide-x divide-x-reverse overflow-hidden">
              <Count icon={<Check className="size-4" />} label="נוכחים" value={day.attendance?.present.length ?? 0} tone="success" />
              <Count icon={<CircleMinus className="size-4" />} label="לא נוכחים" value={day.attendance?.absent.length ?? 0} tone="danger" />
              <Count icon={<CalendarClock className="size-4" />} label="טרם דווחו" value={day.attendance?.unreported.length ?? 0} tone="warning" />
            </Card>
          </div>
        </section>
      ) : null}

      <section className="mt-5">
        <SectionHeader title="משימות" hint={`${taskDay.tasks.length}`} />
        <div className="space-y-2">
          {taskDay.tasks.map((task) => {
            const requirements = taskDay.requirements.filter((item) => item.task_instance_id === task.id);
            const assignments = taskDay.assignments.filter((item) => item.task_instance_id === task.id);
            const required = requirements.reduce((sum, item) => sum + item.required_count, 0);
            return (
              <Link
                className="flex min-h-20 items-center gap-3 rounded-lg border bg-card p-3.5 shadow-[0_1px_2px_rgba(20,22,26,0.04)] transition-colors hover:border-primary/35"
                href={`/${teamSlug}/tasks?week=${date}&period=${period.id}&task=${task.id}`}
                key={task.id}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><ClipboardList className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-sm">{task.title}</b><Badge variant={taskDay.publicationStatus === "published" ? "success" : "muted"}>{taskDay.publicationStatus === "published" ? "פורסם" : "טיוטה"}</Badge></span>
                  <span className="kav-num mt-1 block text-xs text-muted-foreground">{formatTime(task.starts_at, data.team.timezone)}–{formatTime(task.ends_at, data.team.timezone)} · {assignments.length}/{required} מאויש</span>
                  {assignments.length ? <span className="mt-1 block truncate text-xs text-muted-foreground">{assignments.map((item) => taskPeople.get(item.person_id)).filter(Boolean).join(", ")}</span> : null}
                </span>
              </Link>
            );
          })}
          {!taskDay.tasks.length ? <EmptyRow icon={<ClipboardList className="size-4" />} text="אין משימות ביום זה" /> : null}
        </div>
      </section>

      <section className="mt-5">
        <SectionHeader title="אירועים" hint={`${day.events.length}`} />
        <Card className="divide-y overflow-hidden">
          {day.events.map((event) => {
            const isHoliday = isHolidayEvent(event);
            return (
              <div className="flex gap-3 p-3.5" key={event.id}>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${isHoliday ? "bg-special-soft text-special" : "bg-warning-soft text-warning"}`}><CalendarClock className="size-4" /></span>
                <div className="min-w-0"><b className="block truncate text-sm">{event.title}</b><p className="mt-1 text-xs text-muted-foreground">{event.is_all_day ? "כל היום" : formatTime(event.starts_at, data.team.timezone)}{event.location ? ` · ${event.location}` : ""}</p>{event.notes ? <p className="mt-2 text-sm">{event.notes}</p> : null}</div>
              </div>
            );
          })}
          {!day.events.length ? <p className="p-3.5 text-sm text-muted-foreground">אין אירועים ביום זה.</p> : null}
        </Card>
      </section>
    </AppPage>
  );
}

function People({ icon, people, title }: { icon: React.ReactNode; people: string[]; title: string }) {
  return <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2.5 text-sm font-semibold">{icon}{title}<Badge variant="muted">{people.length}</Badge></div><div className="grid grid-cols-2 gap-x-3 px-3.5 py-2">{people.map((name) => <div className="truncate border-b py-2 text-sm last:border-0" key={name}>{name}</div>)}</div>{!people.length ? <p className="p-3.5 text-sm text-muted-foreground">אין אנשים צפויים.</p> : null}</Card>;
}

function CompactRow({ detail, title }: { detail: string; title: string }) {
  return <div className="px-3.5 py-2.5"><b className="text-sm">{title}</b><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>;
}

function Count({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: "danger" | "success" | "warning"; value: number }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-warning";
  return <div className="p-3"><div className={`flex items-center gap-1 text-xs ${toneClass}`}>{icon}{label}</div><b className="kav-num mt-1 block text-xl">{value}</b></div>;
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-3.5 text-sm text-muted-foreground">{icon}{text}</div>;
}

function stateLabel(value?: string | null) { return value === "base" ? "בבסיס" : value === "home" ? "בבית" : "לא הוגדר"; }
function shortDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatTime(iso: string, zone: string) { return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(iso)); }

const holidayTitles = new Set([
  "ערב ראש השנה",
  "ראש השנה א׳",
  "ראש השנה ב׳",
  "צום גדליה",
  "ערב יום כיפור",
  "יום כיפור",
  "ערב סוכות",
  "סוכות",
  "חול המועד סוכות",
  "הושענא רבה",
  "שמיני עצרת / שמחת תורה",
  "תשעה באב",
]);

function isHolidayEvent(event: ReturnType<typeof getDaySchedule>["events"][number]) {
  return event.event_type === "holiday" || holidayTitles.has(event.title);
}

function leaveStatusLabel(status: string) {
  if (status === "pending") return "ממתינה";
  if (status === "approved") return "מאושרת";
  if (status === "partially_approved") return "מאושרת חלקית";
  if (status === "rejected") return "נדחתה";
  return status;
}
