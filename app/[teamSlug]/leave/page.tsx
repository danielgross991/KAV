import Link from "next/link";
import { CalendarOff, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

import { deleteLeaveAction, saveLeaveAction } from "@/app/[teamSlug]/leave/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuth } from "@/lib/kav/auth";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";
import { cn } from "@/lib/utils";

export default async function LeavePage({ params, searchParams }: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ view?: string; saved?: string; deleted?: string }>;
}) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  if (!canManage(membership.role)) redirect(`/${teamSlug}`);
  const today = getDateInTimeZone(membership.team.timezone);
  const [{ data: people, error: peopleError }, { data: periods, error: periodsError }, { data: leaves, error: leavesError }] = await Promise.all([
    supabase.from("people").select("id, full_name, is_active").eq("team_id", membership.team.id).order("display_order").order("full_name"),
    supabase.from("reserve_periods").select("id, name, starts_on, ends_on, status").eq("team_id", membership.team.id).order("starts_on", { ascending: false }),
    supabase.from("leave_requests").select("*").eq("team_id", membership.team.id).order("starts_on", { ascending: false }),
  ]);
  if (peopleError || periodsError || leavesError) throw new Error("לא הצלחנו לטעון את היציאות");
  const peopleById = new Map((people ?? []).map((person) => [person.id, person.full_name]));
  const periodsById = new Map((periods ?? []).map((period) => [period.id, period]));
  const view = ["active", "upcoming", "history"].includes(query.view ?? "") ? query.view! : "active";
  const filtered = (leaves ?? []).filter((leave) => view === "active"
    ? leave.starts_on <= today && leave.ends_on >= today
    : view === "upcoming" ? leave.starts_on > today : leave.ends_on < today);

  return <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><Badge variant="secondary">{membership.team.name}</Badge><h1 className="mt-3 text-3xl font-bold tracking-normal">יציאות</h1><p className="mt-2 text-sm text-muted-foreground">ניהול בקשות וטווחים מאושרים</p></div>
      <a className={buttonVariants()} href="#new-leave"><Plus className="size-4" />יציאה חדשה</a>
    </header>
    {query.saved ? <Notice>היציאה נשמרה</Notice> : null}{query.deleted ? <Notice>היציאה נמחקה</Notice> : null}
    <nav className="flex border-b"><Tab active={view === "active"} href={`/${teamSlug}/leave?view=active`}>פעילות</Tab><Tab active={view === "upcoming"} href={`/${teamSlug}/leave?view=upcoming`}>קרובות</Tab><Tab active={view === "history"} href={`/${teamSlug}/leave?view=history`}>היסטוריה</Tab></nav>
    <section className="divide-y border-b">
      {filtered.map((leave) => <details className="py-4" key={leave.id}>
        <summary className="grid cursor-pointer gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div><b>{peopleById.get(leave.person_id)}</b><p className="mt-1 text-sm text-muted-foreground">{range(leave.starts_on, leave.ends_on)} · {periodsById.get(leave.reserve_period_id)?.name}</p></div>
          <Badge variant={leave.status === "approved" || leave.status === "partially_approved" ? "success" : "secondary"}>{statusLabel(leave.status)}</Badge>
          {leave.approved_starts_on ? <span className="text-sm">מאושר: {range(leave.approved_starts_on, leave.approved_ends_on!)}</span> : null}
        </summary>
        <form action={saveLeaveAction.bind(null, teamSlug)} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-4">
          <input type="hidden" name="id" value={leave.id} />
          <Select label="איש צוות" name="person_id" value={leave.person_id} options={(people ?? []).map((p) => [p.id, p.full_name])} />
          <Select label="תקופה" name="reserve_period_id" value={leave.reserve_period_id} options={(periods ?? []).map((p) => [p.id, p.name])} />
          <Field label="מתאריך" name="starts_on" type="date" defaultValue={leave.starts_on} required />
          <Field label="עד תאריך" name="ends_on" type="date" defaultValue={leave.ends_on} required />
          <Select label="סטטוס" name="status" value={leave.status} options={statusOptions} />
          <Field label="מאושר מתאריך" name="approved_starts_on" type="date" defaultValue={leave.approved_starts_on ?? ""} />
          <Field label="מאושר עד תאריך" name="approved_ends_on" type="date" defaultValue={leave.approved_ends_on ?? ""} />
          <Field label="סיבה" name="reason" defaultValue={leave.reason ?? ""} />
          <Field label="הערת מנהל" name="manager_notes" defaultValue={leave.manager_notes ?? ""} />
          <Button className="self-end">שמירת שינויים</Button>
        </form>
        <form action={deleteLeaveAction.bind(null, teamSlug)} className="mt-2"><input type="hidden" name="id" value={leave.id} /><Button variant="ghost" size="sm"><Trash2 className="size-4" />מחיקה</Button></form>
      </details>)}
      {!filtered.length ? <div className="grid min-h-52 place-items-center text-center"><div><CalendarOff className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">אין יציאות פעילות</p></div></div> : null}
    </section>
    <section className="scroll-mt-6 border-b py-6" id="new-leave"><h2 className="text-lg font-semibold">יציאה חדשה</h2>
      <form action={saveLeaveAction.bind(null, teamSlug)} className="mt-4 grid gap-3 md:grid-cols-4">
        <Select label="איש צוות" name="person_id" options={(people ?? []).filter((p) => p.is_active).map((p) => [p.id, p.full_name])} />
        <Select label="תקופת מילואים" name="reserve_period_id" options={(periods ?? []).map((p) => [p.id, p.name])} />
        <Field label="מתאריך" name="starts_on" type="date" required /><Field label="עד תאריך" name="ends_on" type="date" required />
        <Select label="סטטוס" name="status" value="approved" options={statusOptions} />
        <Field label="מאושר מתאריך" name="approved_starts_on" type="date" /><Field label="מאושר עד תאריך" name="approved_ends_on" type="date" />
        <Field label="סיבה" name="reason" /><Field label="הערת מנהל" name="manager_notes" />
        <Button className="self-end"><Plus className="size-4" />שמירת יציאה</Button>
      </form>
    </section>
  </main>;
}

const statusOptions = [["pending", "ממתינה"], ["approved", "מאושרת"], ["partially_approved", "מאושרת חלקית"], ["rejected", "נדחתה"]];
function Field({ label, ...props }: React.ComponentProps<"input"> & { label: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<Input {...props} /></label>; }
function Select({ label, name, options, value }: { label: string; name: string; options: string[][]; value?: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<select className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={value} name={name} required>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
function Tab({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) { return <Link className={cn("border-b-2 px-5 py-3 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted-foreground")} href={href}>{children}</Link>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="my-4 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 className="size-4" />{children}</div>; }
function range(start: string, end: string) { return `${short(start)}–${short(end)}`; }
function short(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function statusLabel(value: string) { return Object.fromEntries(statusOptions)[value] ?? value; }
