import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";

import {
  applyScheduleProposalAction,
  assignTaskPersonAction,
  deleteTaskAction,
  publishTaskWeekAction,
  removeTaskAssignmentAction,
  saveTaskAction,
  saveTaskTemplateAction,
  setTaskTemplateActiveAction,
} from "@/app/[teamSlug]/tasks/actions";
import { TaskForm, TemplateForm } from "@/components/task-forms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { addCalendarDays, eachCalendarDate, getDateInTimeZone, overlapsCalendarDayInTimeZone } from "@/lib/kav/dates";
import { getScheduleProposal, type TaskCandidateAssessment, type TasksData } from "@/lib/kav/tasks";
import { cn } from "@/lib/utils";

export function TasksView({
  data,
  proposalRequested,
  selectedTab,
  selectedTaskId,
  templatesView,
}: {
  data: TasksData;
  proposalRequested: boolean;
  selectedTab: string;
  selectedTaskId?: string;
  templatesView: boolean;
}) {
  if (templatesView && data.canManage) return <Templates data={data} />;
  return data.canManage
    ? <ManagerTasks data={data} proposalRequested={proposalRequested} selectedTab={selectedTab} selectedTaskId={selectedTaskId} />
    : <ViewerTasks data={data} />;
}

function ManagerTasks({ data, proposalRequested, selectedTab, selectedTaskId }: {
  data: TasksData;
  proposalRequested: boolean;
  selectedTab: string;
  selectedTaskId?: string;
}) {
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);
  const proposal = proposalRequested ? getScheduleProposal(data) : null;
  const baseQuery = `week=${data.weekStartsOn}${data.selectedPeriod ? `&period=${data.selectedPeriod.id}` : ""}`;
  return <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <WeekHeader data={data} />
    <div className="mt-5 flex items-center justify-between gap-3 border-b">
      <nav className="flex overflow-x-auto">
        <Tab active={selectedTab === "tasks"} href={`?${baseQuery}&tab=tasks`}>משימות</Tab>
        <Tab active={selectedTab === "people"} href={`?${baseQuery}&tab=people`}>אנשים</Tab>
        <Tab active={selectedTab === "problems"} href={`?${baseQuery}&tab=problems`}>בעיות {data.publicationIssues.length ? `(${data.publicationIssues.length})` : ""}</Tab>
      </nav>
      <Link className="hidden text-sm font-medium text-primary sm:block" href={`?view=templates&${baseQuery}`}>תבניות</Link>
    </div>

    {!data.selectedPeriod ? <Empty title="אין תקופה תפעולית לשבוע" text="בחרו שבוע בתוך תקופת מילואים פעילה או מפורסמת." /> : null}
    {data.selectedPeriod && selectedTab === "tasks" ? <>
      <section className="flex flex-wrap items-center gap-2 border-b py-4">
        <details className="w-full md:w-auto">
          <summary className={cn(buttonVariants(), "cursor-pointer list-none")}><Plus className="size-4" />משימה חדשה</summary>
          <div className="mt-4 border-t pt-4 md:min-w-[720px]"><TaskForm action={saveTaskAction.bind(null, data.team.slug)} data={data} /></div>
        </details>
        {data.tasks.length && data.publication?.status === "draft" ? <Link className={buttonVariants({ variant: "outline" })} href={`?${baseQuery}&tab=tasks&proposal=1`}><Sparkles className="size-4" />הצע שיבוץ</Link> : null}
        <Link className={buttonVariants({ variant: "outline" })} href={`?view=templates&${baseQuery}`}><ClipboardList className="size-4" />תבניות</Link>
        <PublicationControl data={data} />
      </section>
      {proposal ? <Proposal data={data} proposal={proposal} /> : null}
      <div className={cn("grid gap-5 py-5", selectedTask ? "xl:grid-cols-[1fr_24rem]" : "") }>
        <TaskAgenda data={data} selectedTaskId={selectedTaskId} />
        {selectedTask ? <TaskDetail data={data} task={selectedTask} /> : null}
      </div>
    </> : null}
    {data.selectedPeriod && selectedTab === "people" ? <PeopleWorkload data={data} /> : null}
    {data.selectedPeriod && selectedTab === "problems" ? <Problems data={data} /> : null}
  </main>;
}

function WeekHeader({ data }: { data: TasksData }) {
  const previous = addCalendarDays(data.weekStartsOn, -7);
  const next = addCalendarDays(data.weekStartsOn, 7);
  const periodQuery = data.selectedPeriod ? `&period=${data.selectedPeriod.id}` : "";
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><div className="flex items-center gap-2"><h1 className="text-3xl font-bold tracking-normal">תכנון משימות</h1>{data.publication ? <Badge variant={data.publication.status === "published" ? "success" : "secondary"}>{data.publication.status === "published" ? "פורסם" : "טיוטה"}</Badge> : <Badge variant="outline">שבוע חדש</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">{shortDate(data.weekStartsOn)}–{shortDate(data.weekEndsOn)} · השבוע מתחיל ביום {weekday(data.weekStartsOn)}</p></div>
    <div className="flex items-center gap-1">
      <Link aria-label="שבוע קודם" className={buttonVariants({ size: "icon", variant: "outline" })} href={`?week=${previous}${periodQuery}`}><ArrowRight className="size-4" /></Link>
      <Link className={buttonVariants({ variant: "outline" })} href={`?week=${data.today}${periodQuery}`}>השבוע</Link>
      <Link aria-label="שבוע הבא" className={buttonVariants({ size: "icon", variant: "outline" })} href={`?week=${next}${periodQuery}`}><ArrowLeft className="size-4" /></Link>
    </div>
  </header>;
}

function PublicationControl({ data }: { data: TasksData }) {
  if (!data.publication || data.publication.status !== "draft") return null;
  const blockers = data.publicationIssues.filter((issue) => issue.severity === "block");
  const warnings = data.publicationIssues.filter((issue) => issue.severity === "warning");
  return <form action={publishTaskWeekAction.bind(null, data.team.slug)} className="grid gap-2 sm:mr-auto">
    <input name="week" type="hidden" value={data.weekStartsOn} /><input name="period_id" type="hidden" value={data.selectedPeriod?.id} />
    {warnings.length ? <label className="flex items-center gap-2 text-xs text-amber-700"><input name="confirm_warnings" required type="checkbox" value="yes" />פרסום עם {warnings.length} אזהרות זמינות</label> : null}
    <Button disabled={!data.tasks.length || blockers.length > 0} title={blockers.length ? "יש לפתור בעיות חוסמות לפני פרסום" : undefined}><CheckCircle2 className="size-4" />פרסום השבוע</Button>
  </form>;
}

function TaskAgenda({ data, selectedTaskId }: { data: TasksData; selectedTaskId?: string }) {
  if (!data.tasks.length) return <Empty title="אין משימות בשבוע זה" text="צרו משימה ידנית או מתבנית כדי להתחיל לתכנן." />;
  return <section className="divide-y border-y">
    {eachCalendarDate(data.weekStartsOn, data.weekEndsOn).map((date) => {
      const tasks = data.tasks.filter((task) => overlapsCalendarDayInTimeZone(data.team.timezone, date, task.starts_at, task.ends_at));
      if (!tasks.length) return null;
      return <div className="py-4" key={date}>
        <h2 className="mb-2 text-sm font-semibold">{fullDate(date)}</h2>
        <div className="grid gap-2">{tasks.map((task) => {
          const requirements = data.requirements.filter((item) => item.task_instance_id === task.id);
          const required = requirements.reduce((sum, item) => sum + item.required_count, 0);
          const assigned = data.assignments.filter((item) => item.task_instance_id === task.id).length;
          const missingPakal = requirements.some((item) => item.requirement_type === "pakal" && data.assignments.filter((assignment) => assignment.task_instance_requirement_id === item.id).length < item.required_count);
          return <Link className={cn("grid gap-2 rounded-md border bg-card p-3 hover:border-primary/40 md:grid-cols-[7rem_1fr_auto] md:items-center", selectedTaskId === task.id && "border-primary bg-accent/30")} href={`?week=${data.weekStartsOn}&period=${data.selectedPeriod?.id}&task=${task.id}`} key={`${date}-${task.id}`}>
            <div className="text-sm font-medium">{timeRange(task.starts_at, task.ends_at, data.team.timezone)}</div>
            <div><div className="font-semibold">{task.title}</div><div className="mt-1 text-xs text-muted-foreground">{task.location ?? "ללא מיקום"}</div></div>
            <div className="flex items-center gap-2"><Badge variant={assigned >= required ? "success" : "warning"}>{assigned}/{required} מאויש</Badge>{missingPakal ? <AlertTriangle className="size-4 text-amber-600" /> : null}</div>
          </Link>;
        })}</div>
      </div>;
    })}
  </section>;
}

function TaskDetail({ data, task }: { data: TasksData; task: TasksData["tasks"][number] }) {
  const requirements = data.requirements.filter((item) => item.task_instance_id === task.id);
  const personName = new Map(data.people.map((person) => [person.id, person.full_name]));
  const editable = data.publication?.status === "draft";
  return <aside className="self-start border-y xl:sticky xl:top-4">
    <header className="border-b py-4"><h2 className="text-xl font-bold">{task.title}</h2><p className="mt-1 text-sm text-muted-foreground">{fullDate(getDateInTimeZone(data.team.timezone, new Date(task.starts_at)))} · {timeRange(task.starts_at, task.ends_at, data.team.timezone)}</p></header>
    <section className="py-4"><h3 className="text-sm font-semibold">דרישות ושיבוץ</h3><div className="mt-3 grid gap-4">{requirements.map((requirement) => {
      const assignments = data.assignments.filter((item) => item.task_instance_requirement_id === requirement.id);
      const candidates = data.candidateAssessments[requirement.id] ?? [];
      return <div className="rounded-md border p-3" key={requirement.id}>
        <div className="flex items-center justify-between"><b>{requirement.role_label}</b><Badge variant={assignments.length >= requirement.required_count ? "success" : "warning"}>{assignments.length}/{requirement.required_count}</Badge></div>
        <div className="mt-2 grid gap-2">{assignments.map((assignment) => <div className="flex items-center justify-between rounded-md bg-muted px-2 py-2 text-sm" key={assignment.id}><span>{personName.get(assignment.person_id) ?? assignment.person_id}{assignment.availability_override ? " · חריגת זמינות" : ""}</span>{editable ? <form action={removeTaskAssignmentAction.bind(null, data.team.slug)}><input name="task_id" type="hidden" value={task.id} /><input name="assignment_id" type="hidden" value={assignment.id} /><Button aria-label="הסרת שיבוץ" size="icon" variant="ghost"><Trash2 className="size-4" /></Button></form> : null}</div>)}</div>
        {editable && assignments.length < requirement.required_count ? <AssignmentForm candidates={candidates} data={data} requirementId={requirement.id} taskId={task.id} /> : null}
      </div>;
    })}</div></section>
    {task.notes ? <section className="border-t py-4 text-sm"><b>הערות</b><p className="mt-2 text-muted-foreground">{task.notes}</p></section> : null}
    {editable ? <section className="border-t py-4"><details><summary className="cursor-pointer text-sm font-medium">עריכת המשימה</summary><div className="mt-4"><TaskForm action={saveTaskAction.bind(null, data.team.slug)} data={data} initial={{
      date: getDateInTimeZone(data.team.timezone, new Date(task.starts_at)),
      endsOn: getDateInTimeZone(data.team.timezone, new Date(task.ends_at)),
      endsTime: timeValue(task.ends_at, data.team.timezone),
      id: task.id,
      location: task.location ?? "",
      notes: task.notes ?? "",
      requirements: requirements.map((item) => ({ pakalTypeId: item.pakal_type_id ?? "", requiredCount: item.required_count, requirementType: item.requirement_type, roleLabel: item.role_label })),
      startsTime: timeValue(task.starts_at, data.team.timezone),
      templateId: task.task_template_id ?? "",
      title: task.title,
    }} /></div></details><form action={deleteTaskAction.bind(null, data.team.slug)} className="mt-3"><input name="task_id" type="hidden" value={task.id} /><Button variant="destructive"><Trash2 className="size-4" />מחיקת משימה</Button></form></section> : null}
  </aside>;
}

function AssignmentForm({ candidates, data, requirementId, taskId }: { candidates: TaskCandidateAssessment[]; data: TasksData; requirementId: string; taskId: string }) {
  const eligible = candidates.filter((item) => item.eligible);
  const overridable = candidates.filter((item) => item.canOverride);
  const blocked = candidates.filter((item) => item.hardBlocked);
  return <form action={assignTaskPersonAction.bind(null, data.team.slug)} className="mt-3 grid gap-2 border-t pt-3">
    <input name="task_id" type="hidden" value={taskId} /><input name="requirement_id" type="hidden" value={requirementId} />
    <select className="h-10 rounded-md border bg-background px-2 text-sm" name="person_id" required defaultValue="">
      <option disabled value="">בחירת איש צוות</option>
      {eligible.length ? <optgroup label="מומלצים וזמינים">{eligible.map((item) => <option key={item.personId} value={item.personId}>{item.fullName}</option>)}</optgroup> : null}
      {overridable.length ? <optgroup label="לא זמינים · דורש חריגה">{overridable.map((item) => <option key={item.personId} value={item.personId}>{item.fullName} · {item.reasons.map(reasonLabel).join(", ")}</option>)}</optgroup> : null}
      {blocked.length ? <optgroup disabled label="לא ניתנים לשיבוץ">{blocked.map((item) => <option key={item.personId} value={item.personId}>{item.fullName} · {item.reasons.map(reasonLabel).join(", ")}</option>)}</optgroup> : null}
    </select>
    {overridable.length ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><input name="availability_override" type="checkbox" value="yes" />אישור חריגת זמינות לאדם שאינו זמין</label> : null}
    <Button size="sm">שיבוץ</Button>
  </form>;
}

function Proposal({ data, proposal }: { data: TasksData; proposal: NonNullable<ReturnType<typeof getScheduleProposal>> }) {
  const people = new Map(data.people.map((person) => [person.id, person.full_name]));
  const tasks = new Map(data.tasks.map((task) => [task.id, task.title]));
  const requirements = new Map(data.requirements.map((requirement) => [requirement.id, requirement.role_label]));
  return <section className="border-b bg-accent/25 py-4">
    <div className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="font-semibold">הצעת שיבוץ</h2><Badge variant="outline">לא נשמרה</Badge></div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">{proposal.proposals.map((item) => <div className="rounded-md border bg-background p-3 text-sm" key={`${item.requirementId}-${item.slotIndex}`}><b>{people.get(item.personId)}</b><div className="mt-1 text-muted-foreground">{tasks.get(item.taskId)} · {requirements.get(item.requirementId)}</div><div className="mt-1 text-xs text-muted-foreground">זמין · ללא חפיפה</div></div>)}</div>
    {proposal.issues.length ? <div className="mt-3 text-sm text-amber-700">{proposal.issues.length} דרישות נותרו ללא מועמד מתאים.</div> : null}
    <div className="mt-3 flex gap-2"><form action={applyScheduleProposalAction.bind(null, data.team.slug)}><input name="week" type="hidden" value={data.weekStartsOn} /><input name="period_id" type="hidden" value={data.selectedPeriod?.id} /><Button disabled={!proposal.proposals.length}>החלת ההצעה</Button></form><Link className={buttonVariants({ variant: "outline" })} href={`?week=${data.weekStartsOn}&period=${data.selectedPeriod?.id}`}>ביטול</Link></div>
  </section>;
}

function PeopleWorkload({ data }: { data: TasksData }) {
  return <section className="divide-y border-y py-2">{data.workload.map((person) => <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3" key={person.personId}><div><b>{person.fullName}</b><div className="mt-1 text-xs text-muted-foreground">{person.taskCount ? "משובץ השבוע" : "ללא משימות"}</div></div><div className="text-left text-sm"><b>{person.taskCount} משימות</b><div className="text-muted-foreground">{formatMinutes(person.taskMinutes)}</div></div></div>)}</section>;
}

function Problems({ data }: { data: TasksData }) {
  const taskNames = new Map(data.tasks.map((task) => [task.id, task.title]));
  if (!data.publicationIssues.length) return <Empty title="אין בעיות פתוחות" text="כל הדרישות מכוסות ואין חפיפות או שיבוצים לא תקינים." />;
  return <section className="divide-y border-y">{data.publicationIssues.map((issue, index) => <div className="flex gap-3 py-4" key={`${issue.code}-${issue.taskId}-${index}`}><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><b>{issue.message}</b>{issue.taskId ? <p className="mt-1 text-sm text-muted-foreground">{taskNames.get(issue.taskId) ?? issue.taskId}</p> : null}{issue.taskId ? <Link className="mt-2 inline-block text-sm font-medium text-primary" href={`?week=${data.weekStartsOn}&period=${data.selectedPeriod?.id}&task=${issue.taskId}`}>פתיחת משימה</Link> : null}</div></div>)}</section>;
}

function Templates({ data }: { data: TasksData }) {
  return <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
    <Link className={buttonVariants({ variant: "ghost" })} href={`?week=${data.weekStartsOn}&period=${data.selectedPeriod?.id}`}><ArrowRight className="size-4" />חזרה למשימות</Link>
    <header className="mt-4 border-b pb-5"><h1 className="text-3xl font-bold tracking-normal">תבניות משימה</h1><p className="mt-2 text-sm text-muted-foreground">הדרישות נשמרות כברירת מחדל; משימות קיימות נשארות עם הצילום שלהן.</p></header>
    <details className="border-b py-4"><summary className="cursor-pointer font-semibold"><Plus className="ml-2 inline size-4" />תבנית חדשה</summary><div className="mt-4"><TemplateForm action={saveTaskTemplateAction.bind(null, data.team.slug)} data={data} /></div></details>
    <section className="divide-y">{data.taskTemplates.map((template) => <details className="py-4" key={template.id}><summary className="flex cursor-pointer list-none items-center justify-between"><span><b>{template.name}</b><span className="mr-2 text-xs text-muted-foreground">{template.default_duration_minutes ? `${template.default_duration_minutes} דקות` : "ללא משך"}</span></span><Badge variant={template.is_active ? "success" : "muted"}>{template.is_active ? "פעילה" : "לא פעילה"}</Badge></summary><div className="mt-4"><TemplateForm action={saveTaskTemplateAction.bind(null, data.team.slug)} data={data} templateId={template.id} /><form action={setTaskTemplateActiveAction.bind(null, data.team.slug)} className="mt-3"><input name="template_id" type="hidden" value={template.id} /><input name="is_active" type="hidden" value={String(!template.is_active)} /><Button variant="outline">{template.is_active ? "השבתת תבנית" : "הפעלת תבנית"}</Button></form></div></details>)}</section>
  </main>;
}

function ViewerTasks({ data }: { data: TasksData }) {
  const personName = new Map(data.people.map((person) => [person.id, person.full_name]));
  return <main className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 lg:px-8"><header className="border-b pb-5"><Badge variant="secondary">{data.team.name}</Badge><h1 className="mt-3 text-3xl font-bold tracking-normal">המשימות שלי</h1><p className="mt-2 text-sm text-muted-foreground">{shortDate(data.weekStartsOn)}–{shortDate(data.weekEndsOn)}</p></header>{data.tasks.length ? <section className="divide-y">{data.tasks.map((task) => {
    const teammates = data.assignments.filter((item) => item.task_instance_id === task.id && item.person_id !== data.currentPersonId).map((item) => personName.get(item.person_id)).filter(Boolean);
    return <article className="grid gap-2 py-4 md:grid-cols-[8rem_1fr]" key={task.id}><div><b>{fullDate(getDateInTimeZone(data.team.timezone, new Date(task.starts_at)))}</b><div className="mt-1 text-sm text-muted-foreground">{timeRange(task.starts_at, task.ends_at, data.team.timezone)}</div></div><div><h2 className="font-semibold">{task.title}</h2>{task.location ? <p className="mt-1 text-sm text-muted-foreground">{task.location}</p> : null}{teammates.length ? <p className="mt-2 text-sm">עם: {teammates.join(", ")}</p> : null}</div></article>;
  })}</section> : <Empty title="אין לך משימות קרובות" text="משימות יופיעו כאן לאחר פרסום השבוע." />}</main>;
}

function Tab({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) { return <Link className={cn("border-b-2 px-4 py-3 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted-foreground")} href={href}>{children}</Link>; }
function Empty({ text, title }: { text: string; title: string }) { return <section className="grid min-h-64 place-items-center border-y text-center"><div><CalendarDays className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></div></section>; }
function reasonLabel(reason: TaskCandidateAssessment["reasons"][number]) { return ({ absent: "לא נוכח", "approved-leave": "ביציאה", "cross-team": "צוות אחר", "duplicate-assignment": "כבר משובץ", "home-rotation": "בבית", inactive: "לא פעיל", "invalid-requirement": "דרישה לא תקינה", "missing-pakal": "חסר פק״ל", overlap: "משובץ למשימה אחרת" } as const)[reason]; }
function shortDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function weekday(date: string) { return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function timeValue(iso: string, zone: string) { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", minute: "2-digit", timeZone: zone }).format(new Date(iso)); }
function timeRange(start: string, end: string, zone: string) { return `${timeValue(start, zone)}–${timeValue(end, zone)}`; }
function formatMinutes(minutes: number) { return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} שעות`; }
