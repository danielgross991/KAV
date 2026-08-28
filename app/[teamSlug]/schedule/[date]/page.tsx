import Link from "next/link";
import { ArrowRight, CalendarClock, Check, CircleMinus, ClipboardList, Home, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  const data = await getScheduleData(supabase, membership, query.period);
  const period = data.selectedPeriod;
  if (!period || date < period.starts_on || date > period.ends_on) notFound();
  const day = getDaySchedule(data, date);
  const taskDay = await getTaskDaySchedule(supabase, membership, date, period.id);
  const personName = new Map(data.people.map((person) => [person.id, person.full_name]));
  const groupName = new Map(data.groups.map((group) => [group.id, group.name]));

  return <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
    <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/${teamSlug}/schedule?period=${period.id}&view=agenda`}><ArrowRight className="size-4" />חזרה ללו״ז</Link>
    <header className="mt-4 border-b pb-5"><Badge variant="secondary">{period.name}</Badge><h1 className="mt-3 text-3xl font-bold tracking-normal">{fullDate(date)}</h1><div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">{day.phase ? <span>{day.phase.name}</span> : null}{period.location ? <span className="flex items-center gap-1"><MapPin className="size-4" />{period.location}</span> : null}</div></header>
    <section className="grid gap-4 border-b py-5 sm:grid-cols-2">{day.groups.map((group) => <div className="rounded-md border bg-card p-4" key={group.id}><div className="flex items-center justify-between"><h2 className="font-semibold">{group.name}</h2><Badge variant={group.block?.state === "base" ? "success" : "secondary"}>{stateLabel(group.block?.state)}</Badge></div>{group.block ? <p className="mt-2 text-xs text-muted-foreground">{shortDate(group.block.starts_on)}–{shortDate(group.block.ends_on)}</p> : null}</div>)}</section>
    <section className="border-b py-5"><h2 className="font-semibold">תכנון</h2><div className="mt-4 grid gap-6 md:grid-cols-2"><People title="צפויים בבסיס" icon={<Users className="size-5" />} people={day.expectedBase.map((person) => person.full_name)} /><People title="צפויים בבית" icon={<Home className="size-5" />} people={day.expectedHome.map((person) => person.full_name)} /></div></section>
    {data.canManage ? <section className="grid gap-6 border-b py-5 md:grid-cols-2"><div><h2 className="font-semibold">חריגים</h2><div className="mt-3 space-y-2">{day.approvedLeave.map((person) => <div className="rounded-md border bg-card p-3 text-sm" key={person.id}><b>{person.full_name}</b><p className="mt-1 text-muted-foreground">יציאה מאושרת</p></div>)}{day.overrides.map((override) => <div className="rounded-md border bg-card p-3 text-sm" key={override.id}><b>{personName.get(override.person_id)}</b><div className="mt-1 text-muted-foreground">שינוי סבב · {override.from_rotation_group_id ? `${groupName.get(override.from_rotation_group_id)} ← ` : ""}{override.to_rotation_group_id ? groupName.get(override.to_rotation_group_id) : "ללא סבב"}</div></div>)}{!day.approvedLeave.length && !day.overrides.length ? <p className="text-sm text-muted-foreground">אין חריגים ביום זה.</p> : null}</div></div><div><h2 className="font-semibold">נוכחות בפועל</h2>{day.attendance ? <div className="mt-3 grid grid-cols-3 gap-2"><Count icon={<Check className="size-4" />} label="נוכחים" value={day.attendance.present.length} /><Count icon={<CircleMinus className="size-4" />} label="לא נוכחים" value={day.attendance.absent.length} /><Count icon={<CalendarClock className="size-4" />} label="טרם דווחו" value={day.attendance.unreported.length} /></div> : null}</div></section> : null}
    <section className="border-b py-5"><h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-5" />משימות</h2><div className="mt-3 space-y-2">{taskDay.tasks.length ? taskDay.tasks.map((task) => { const requirements = taskDay.requirements.filter((item) => item.task_instance_id === task.id); const assignments = taskDay.assignments.filter((item) => item.task_instance_id === task.id); const names = new Map(taskDay.people.map((person) => [person.id, person.full_name])); return <Link className="block rounded-md border bg-card p-3 text-sm hover:border-primary/40" href={`/${teamSlug}/tasks?week=${date}&period=${period.id}&task=${task.id}`} key={task.id}><div className="flex items-center justify-between gap-2"><b>{task.title}</b><Badge variant={taskDay.publicationStatus === "published" ? "success" : "secondary"}>{taskDay.publicationStatus === "published" ? "פורסם" : "טיוטה"}</Badge></div><div className="mt-1 text-muted-foreground">{formatTime(task.starts_at, data.team.timezone)}–{formatTime(task.ends_at, data.team.timezone)} · {assignments.length}/{requirements.reduce((sum, item) => sum + item.required_count, 0)} מאויש</div>{assignments.length ? <p className="mt-2">{assignments.map((item) => names.get(item.person_id)).filter(Boolean).join(", ")}</p> : null}</Link>; }) : <p className="text-sm text-muted-foreground">אין משימות ביום זה.</p>}</div></section>
    <section className="py-5"><h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-5" />אירועים</h2><div className="mt-3 space-y-2">{day.events.length ? day.events.map((event) => <div className="rounded-md border bg-card p-3 text-sm" key={event.id}><b>{event.title}</b><div className="mt-1 text-muted-foreground">{event.is_all_day ? "כל היום" : formatTime(event.starts_at, data.team.timezone)}{event.location ? ` · ${event.location}` : ""}</div>{event.notes ? <p className="mt-2">{event.notes}</p> : null}</div>) : <p className="text-sm text-muted-foreground">אין אירועים ביום זה.</p>}</div></section>
  </main>;
}

function People({ icon, people, title }: { icon: React.ReactNode; people: string[]; title: string }) { return <div><h2 className="flex items-center gap-2 font-semibold">{icon}{title} · {people.length}</h2><div className="mt-3 grid grid-cols-2 gap-2">{people.map((name) => <div className="rounded-md bg-muted px-3 py-2 text-sm" key={name}>{name}</div>)}</div>{!people.length ? <p className="mt-3 text-sm text-muted-foreground">אין אנשים צפויים.</p> : null}</div>; }
function Count({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-md bg-muted p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div><b className="mt-1 block text-xl">{value}</b></div>; }
function stateLabel(value?: string | null) { return value === "base" ? "בסיס" : value === "home" ? "בית" : "לא הוגדר"; }
function shortDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatTime(iso: string, zone: string) { return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(iso)); }
