import Link from "next/link";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

import { deleteLeaveAction, saveLeaveAction } from "@/app/[teamSlug]/leave/actions";
import { AppPage, PageHeader, SuccessNotice } from "@/components/ui/app-page";
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

  return <AppPage className="max-w-6xl">
    <PageHeader eyebrow={membership.team.name} title="יציאות" subtitle="ניהול בקשות וטווחים מאושרים" action={<a className={buttonVariants({ size: "icon" })} href="#new-leave" aria-label="יציאה חדשה"><Plus className="size-4" /></a>}>
      <nav className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-1"><Tab active={view === "active"} href={`/${teamSlug}/leave?view=active`}>פעילות</Tab><Tab active={view === "upcoming"} href={`/${teamSlug}/leave?view=upcoming`}>קרובות</Tab><Tab active={view === "history"} href={`/${teamSlug}/leave?view=history`}>היסטוריה</Tab></nav>
    </PageHeader>
    {query.saved ? <SuccessNotice>היציאה נשמרה</SuccessNotice> : null}{query.deleted ? <SuccessNotice>היציאה נמחקה</SuccessNotice> : null}
    <section className="divide-y overflow-hidden rounded-lg border bg-card">
      {filtered.map((leave) => <details key={leave.id}>
        <summary className="grid min-h-16 cursor-pointer gap-2 p-3.5 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div><b>{peopleById.get(leave.person_id)}</b><p className="mt-1 text-sm text-muted-foreground">{range(leave.starts_on, leave.ends_on)} · {periodsById.get(leave.reserve_period_id)?.name}</p></div>
          <Badge variant={leave.status === "approved" || leave.status === "partially_approved" ? "success" : "secondary"}>{statusLabel(leave.status)}</Badge>
          {leave.approved_starts_on ? <span className="text-sm">מאושר: {range(leave.approved_starts_on, leave.approved_ends_on!)}</span> : null}
        </summary>
        <form action={saveLeaveAction.bind(null, teamSlug)} className="grid gap-3 border-t bg-muted/30 p-3.5 md:grid-cols-4">
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
        <form action={deleteLeaveAction.bind(null, teamSlug)} className="bg-muted/30 px-3.5 pb-3.5"><input type="hidden" name="id" value={leave.id} /><Button variant="ghost" size="sm"><Trash2 className="size-4" />מחיקה</Button></form>
      </details>)}
      {!filtered.length ? <div className="grid min-h-52 place-items-center text-center"><div><CalendarOff className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">אין יציאות פעילות</p></div></div> : null}
    </section>
    <section className="mt-5 scroll-mt-24 rounded-lg border bg-card p-4" id="new-leave"><h2 className="text-base font-semibold">יציאה חדשה</h2>
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
  </AppPage>;
}

const statusOptions = [["pending", "ממתינה"], ["approved", "מאושרת"], ["partially_approved", "מאושרת חלקית"], ["rejected", "נדחתה"]];
function Field({ label, ...props }: React.ComponentProps<"input"> & { label: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<Input {...props} /></label>; }
function Select({ label, name, options, value }: { label: string; name: string; options: string[][]; value?: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<select className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={value} name={name} required>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
function Tab({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) { return <Link aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium", active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(20,22,26,0.06)]" : "text-muted-foreground")} href={href}>{children}</Link>; }
function range(start: string, end: string) { return `${short(start)}–${short(end)}`; }
function short(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function statusLabel(value: string) { return Object.fromEntries(statusOptions)[value] ?? value; }
