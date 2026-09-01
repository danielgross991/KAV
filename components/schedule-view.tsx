"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  advanceReservePeriodStatusAction, assignRotationMemberAction, createReservePeriodAction, deletePhaseAction,
  deleteRotationGroupAction, deleteScheduleEventAction, editRotationBlockAction,
  generateRotationBlocksAction, publishReservePeriodAction, savePhaseAction,
  saveRotationGroupAction, saveRotationOverrideAction, saveScheduleEventAction,
} from "@/app/[teamSlug]/schedule/actions";
import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KavLoading } from "@/components/kav-loading";
import { addCalendarDays, calendarDayDifference, eachCalendarDate, getDateInTimeZone, shiftMonth } from "@/lib/kav/dates";
import { generateRotationBlocks } from "@/lib/kav/schedule-domain";
import { getDaySchedule, type ScheduleData } from "@/lib/kav/schedule";
import { cn } from "@/lib/utils";

const phaseLabels: Record<string, string> = { preparation: "הכנה", line: "קו", stand_down: "ירידה / התארגנות", processing: "זיכויים", other: "אחר" };
const eventLabels: Record<string, string> = { briefing: "תדריך", training: "אימון", family: "משפחות", processing: "זיכויים", changeover: "החלפה", holiday: "חג / מועד", other: "אחר" };
const scheduleLoadingHandoffMs = 48;
const scheduleMinimumLoadingMs = 420;
const schedulePressFeedbackMs = 520;

export function ScheduleView({ data, initialManage, month, view }: { data: ScheduleData; initialManage: boolean; month?: string; view: string }) {
  const router = useRouter();
  const [manage, setManage] = useState(initialManage);
  const period = data.selectedPeriod;
  const initialMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : (period && data.today >= period.starts_on && data.today <= period.ends_on ? data.today : period?.starts_on ?? data.today).slice(0, 7);
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [activeView, setActiveView] = useState(view);
  const [localPending, setLocalPending] = useState(false);
  const [pressedSchedule, setPressedSchedule] = useState<{ month: string; view: string } | null>(null);
  const handoffTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const showingPending = localPending;

  function switchSchedule(nextView: string, nextMonth = activeMonth) {
    if (nextView === activeView && nextMonth === activeMonth) {
      return;
    }

    if (handoffTimer.current) {
      window.clearTimeout(handoffTimer.current);
    }

    if (finishTimer.current) {
      window.clearTimeout(finishTimer.current);
    }

    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
    }

    setPressedSchedule({ month: nextMonth, view: nextView });
    setLocalPending(true);
    window.history.pushState(null, "", href(data, nextView, nextMonth));

    pressTimer.current = window.setTimeout(() => {
      setPressedSchedule(null);
      pressTimer.current = null;
    }, schedulePressFeedbackMs);

    handoffTimer.current = window.setTimeout(() => {
      setActiveView(nextView);
      setActiveMonth(nextMonth);
      handoffTimer.current = null;

      finishTimer.current = window.setTimeout(() => {
        setLocalPending(false);
        finishTimer.current = null;
      }, scheduleMinimumLoadingMs);
    }, scheduleLoadingHandoffMs);
  }

  useEffect(() => {
    return () => {
      if (handoffTimer.current) {
        window.clearTimeout(handoffTimer.current);
      }

      if (finishTimer.current) {
        window.clearTimeout(finishTimer.current);
      }

      if (pressTimer.current) {
        window.clearTimeout(pressTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!period) return;
    [
      href(data, activeView, activeMonth),
      href(data, "month", shiftMonth(activeMonth, -1)),
      href(data, "month", shiftMonth(activeMonth, 1)),
      href(data, "month", data.today.slice(0, 7)),
    ].forEach((target) => router.prefetch(target));
  }, [activeMonth, activeView, data, data.today, period, router]);

  return <AppPage>
      {showingPending ? <KavLoading label="טוען לו״ז" /> : null}
      <PageHeader
      eyebrow={data.team.name}
      title="לו״ז"
      subtitle={period ? periodSubtitle(period) : "תכנון תקופות, סבבים ואירועים"}
      action={data.canManageReservePeriods ? <Button size="icon" type="button" variant={manage ? "secondary" : "outline"} aria-label="ניהול תקופה" onClick={() => setManage((value) => !value)}><Plus className="size-4" /></Button> : null}
    >
      <div className="space-y-2.5">
        {period ? <nav className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-1" aria-label="תצוגת לוח זמנים"><Tab active={activeView === "agenda"} pressed={pressedSchedule?.view === "agenda"} onSelect={() => switchSchedule("agenda")}>אג׳נדה</Tab><Tab active={activeView === "month"} pressed={pressedSchedule?.view === "month"} onSelect={() => switchSchedule("month")}>חודש</Tab><Tab active={activeView === "rotations"} pressed={pressedSchedule?.view === "rotations"} onSelect={() => switchSchedule("rotations")}>סבבים</Tab></nav> : null}
      </div>
    </PageHeader>
    {manage && data.canManageReservePeriods ? <Manager data={data} /> : null}
    {!period ? <Empty /> : activeView === "month" ? <Month data={data} month={activeMonth} pendingMonth={pressedSchedule?.view === "month" ? pressedSchedule.month : null} onMonthChange={(nextMonth) => switchSchedule("month", nextMonth)} /> : activeView === "rotations" ? <Timeline data={data} /> : <Agenda data={data} />}
  </AppPage>;
}

function Empty() { return <EmptyState icon={<CalendarDays className="size-4" />} title="אין עדיין תקופת מילואים" description="מנהל יכול ליצור תקופה חדשה ולהתחיל לבנות את הלו״ז." />; }
function Tab({ active, children, onSelect, pressed = false }: { active: boolean; children: React.ReactNode; onSelect: () => void; pressed?: boolean }) { return <button aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-all active:scale-[0.98] active:bg-card active:text-foreground", active || pressed ? "bg-card text-foreground shadow-[0_1px_2px_rgba(20,22,26,0.06)]" : "text-muted-foreground hover:bg-card/70 hover:text-foreground")} onClick={() => { if (!active) onSelect(); }} type="button">{children}</button>; }
function href(data: ScheduleData, view: string, month?: string) { return `/${data.team.slug}/schedule?period=${data.selectedPeriod?.id}&view=${view}${month ? `&month=${month}` : ""}`; }
function monthLabel(month: string) { return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`)); }

function Month({ data, month, onMonthChange, pendingMonth }: { data: ScheduleData; month: string; onMonthChange: (month: string) => void; pendingMonth: string | null }) {
  const monthStart = `${month}-01`;
  const firstDay = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
  const monthDays = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const weekCount = Math.ceil((firstDay + monthDays) / 7);
  const gridStart = addCalendarDays(monthStart, -firstDay);
  const dates = Array.from({ length: weekCount * 7 }, (_, index) => addCalendarDays(gridStart, index));
  const todayMonth = data.today.slice(0, 7);
  const [selectedDay, setSelectedDay] = useState<{ date: string; day: ReturnType<typeof getDaySchedule> } | null>(null);
  return <section className="overflow-hidden rounded-lg border bg-card shadow-[0_10px_28px_-24px_rgba(20,22,26,0.5)]">
    <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2.5">
      <MonthNavButton active={pendingMonth === shiftMonth(month, -1)} ariaLabel="חודש קודם" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronRight className="size-4" /></MonthNavButton>
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
        <span className="text-sm font-bold sm:text-base">{monthLabel(month)}</span>
        {month !== todayMonth ? <button className={cn("rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-primary active:scale-[0.96] active:border-primary/40 active:bg-accent active:text-primary", pendingMonth === todayMonth && "border-primary/40 bg-accent text-primary")} onClick={() => onMonthChange(todayMonth)} type="button">היום</button> : null}
      </div>
      <MonthNavButton active={pendingMonth === shiftMonth(month, 1)} ariaLabel="חודש הבא" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronLeft className="size-4" /></MonthNavButton>
    </div>
    <div className="grid grid-cols-7 border-b bg-card px-1 pt-2 text-center text-[0.68rem] font-semibold text-muted-foreground sm:px-2 sm:text-xs">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((day) => <div className="px-1 py-2" key={day}>{day}</div>)}</div>
    <div className="kav-month-enter grid grid-cols-7 gap-1 bg-card p-1 sm:gap-1.5 sm:p-2">{dates.map((date) => { const day = getDaySchedule(data, date); return <MonthCell data={data} date={date} day={day} inMonth={date.slice(0, 7) === month} key={date} onMobilePreview={() => setSelectedDay({ date, day })} />; })}</div>
    {selectedDay ? <DayPreview data={data} date={selectedDay.date} day={selectedDay.day} onClose={() => setSelectedDay(null)} /> : null}
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
      <LegendDot className="bg-violet-500" label="חג" />
      <LegendDot className="bg-primary" label="משימות" />
      <LegendDot className="bg-sky-500" label="בקשות/יציאות" />
      <LegendDot className="bg-destructive" label="פער נוכחות" />
    </div>
  </section>;
}

function MonthNavButton({ active, ariaLabel, children, onClick }: { active: boolean; ariaLabel: string; children: React.ReactNode; onClick: () => void }) {
  return <button aria-label={ariaLabel} className={cn("flex size-10 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(20,22,26,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent hover:text-primary active:translate-y-0 active:scale-[0.96] active:border-primary/40 active:bg-accent active:text-primary", active && "border-primary/40 bg-accent text-primary")} onClick={onClick} type="button">{children}</button>;
}

function MonthCell({ data, date, day, inMonth, onMobilePreview }: { data: ScheduleData; date: string; day: ReturnType<typeof getDaySchedule>; inMonth: boolean; onMobilePreview: () => void }) {
  const holiday = day.events.find(isHolidayEvent);
  const otherEvents = day.events.filter((event) => !isHolidayEvent(event));
  const viewer = data.viewerPersonId ? day.people.find((person) => person.id === data.viewerPersonId) : null;
  const personalLeaves = data.viewerPersonId
    ? [...day.leaveMarkers, ...day.leaveRequests].filter((item) => item.personId === data.viewerPersonId)
    : [];
  const teamLeaveCount = data.canManage
    ? day.approvedLeave.length + day.leaveRequests.length
    : day.leaveMarkers.length + day.leaveRequests.length;
  const isPast = date < data.today;
  const attendanceIssue = data.canManage && isPast && ((day.attendance?.absent.length ?? 0) > 0 || (day.attendance?.unreported.length ?? 0) > 0);
  const baseGroups = day.groups.filter((group) => group.block?.state === "base");

  return <Link aria-haspopup="dialog" className={cn("group min-h-[5.9rem] rounded-md border border-transparent bg-muted/25 p-1.5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card hover:shadow-[0_8px_22px_-18px_rgba(20,22,26,0.6)] sm:min-h-[7.25rem] sm:p-2", inMonth && "bg-background", !inMonth && "text-muted-foreground opacity-60", viewer?.resolution.state === "home" && "bg-sky-50/80", personalLeaves.length && "border-primary/40 bg-primary/10 ring-2 ring-inset ring-primary/25")} href={`/${data.team.slug}/schedule/${date}?period=${data.selectedPeriod?.id}`} onClick={(event) => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      event.preventDefault();
      onMobilePreview();
    }
  }}>
    <div className="mb-1.5 flex items-start justify-between gap-1">
      <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold transition-colors sm:size-7 sm:text-sm", date === data.today ? "bg-primary !text-white" : "bg-card text-foreground group-hover:bg-accent group-hover:text-primary")}>{Number(date.slice(-2))}</span>
      <span className="mt-1 flex flex-wrap justify-end gap-1">
        {holiday ? <span aria-label={holiday.title} className="size-2 rounded-full bg-violet-500" title={holiday.title} /> : null}
        {otherEvents.length ? <span className="size-2 rounded-full bg-amber-500" /> : null}
        {day.tasks.length ? <span className="size-2 rounded-full bg-primary" /> : null}
        {teamLeaveCount ? <span className="size-2 rounded-full bg-sky-500" /> : null}
        {attendanceIssue ? <span className="size-2 rounded-full bg-destructive" /> : null}
      </span>
    </div>
    {holiday ? <div className="truncate rounded bg-special-soft px-1.5 py-0.5 text-[0.68rem] font-medium text-special sm:text-xs">{holiday.title}</div> : null}
    {data.canManage ? (
      <>
        {baseGroups.slice(0, 2).map((group) => <div className={cn("mt-1 truncate rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium sm:text-xs", groupColorClass(group.color_token))} key={group.id}>{group.name} · {stateLabel(group.block?.state)}</div>)}
        {baseGroups.length > 2 ? <div className="mt-1 truncate text-[0.68rem] text-muted-foreground sm:text-xs">+{baseGroups.length - 2} סבבים בבסיס</div> : null}
        {teamLeaveCount ? <div className="mt-1 truncate text-[0.68rem] text-sky-700 sm:text-xs">{teamLeaveCount} יציאות/בקשות</div> : null}
        {day.tasks.length ? <div className="mt-1 truncate text-[0.68rem] text-primary sm:text-xs">{day.tasks.length} משימות</div> : null}
      </>
    ) : viewer ? (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {viewer.resolution.state ? (
          <Badge variant={viewer.resolution.state === "base" ? "success" : "info"}>
            {stateLabel(viewer.resolution.state)}
          </Badge>
        ) : null}
        {viewer.resolution.leave ? <Badge variant="secondary">יציאה</Badge> : null}
        {personalLeaves.length ? <Badge variant="outline">בקשה שלך</Badge> : null}
        {teamLeaveCount && !personalLeaves.length ? <span className="text-[0.68rem] text-sky-700 sm:text-xs">{teamLeaveCount} יציאות</span> : null}
      </div>
    ) : null}
  </Link>;
}

function DayPreview({ data, date, day, onClose }: { data: ScheduleData; date: string; day: ReturnType<typeof getDaySchedule>; onClose: () => void }) {
  const peopleById = new Map(data.people.map((person) => [person.id, person.full_name]));
  const leaveItems = Array.from(new Map([...day.leaveMarkers, ...day.leaveRequests].map((item) => [`${item.id}-${item.status}`, item])).values());
  const baseGroups = day.groups.filter((group) => group.block?.state === "base");
  const detailHref = `/${data.team.slug}/schedule/${date}?period=${data.selectedPeriod?.id}`;

  return <>
    <button aria-label="סגירת פירוט יום" className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[1px] md:hidden" onClick={onClose} type="button" />
    <aside aria-modal="true" className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 max-h-[72vh] overflow-auto rounded-xl border bg-card p-4 text-right shadow-[0_24px_80px_-32px_rgba(20,22,26,0.6)] md:hidden" role="dialog">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{fullDate(date)}</p>
          <h3 className="mt-1 text-base font-bold">{day.phase?.name ?? "יום מבצעי"}</h3>
        </div>
        <button aria-label="סגירה" className="grid size-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={onClose} type="button"><X className="size-4" /></button>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <PreviewSection title="מה יש ביום הזה">
          {baseGroups.length ? <div className="flex flex-wrap gap-1.5">{baseGroups.map((group) => <Badge key={group.id} variant="success">{group.name}</Badge>)}</div> : <p className="text-muted-foreground">אין סבב בבסיס.</p>}
          {[...day.events, ...day.tasks].length ? <div className="mt-2 space-y-1.5">{day.events.map((event) => <PreviewLine key={event.id} meta={event.is_all_day ? "כל היום" : time(event.starts_at, data.team.timezone)} text={event.title} />)}{day.tasks.map((task) => <PreviewLine key={task.id} meta={time(task.starts_at, data.team.timezone)} text={task.title} />)}</div> : <p className="mt-2 text-muted-foreground">אין אירועים או משימות.</p>}
        </PreviewSection>
        <PreviewSection title="בקשות יציאה">
          {leaveItems.length ? <div className="space-y-1.5">{leaveItems.map((item) => <PreviewLine key={`${item.id}-${item.status}`} meta={leaveStatusLabel(item.status)} text={peopleById.get(item.personId) ?? "איש צוות"} />)}</div> : <p className="text-muted-foreground">אין בקשות יציאה ביום הזה.</p>}
        </PreviewSection>
      </div>
      <Link className="mt-4 flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold !text-white" href={detailHref}>פתיחת פירוט מלא</Link>
    </aside>
  </>;
}

function PreviewSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="rounded-lg border bg-background/70 p-3"><h4 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h4>{children}</section>;
}

function PreviewLine({ meta, text }: { meta: string; text: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2"><span className="truncate font-medium">{text}</span><span className="shrink-0 text-xs text-muted-foreground">{meta}</span></div>;
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={cn("size-2 rounded-full", className)} />{label}</span>;
}

function periodSubtitle(period: NonNullable<ScheduleData["selectedPeriod"]>) {
  const location = period.location && period.location !== period.name ? ` · ${period.location}` : "";
  return `${period.name} · ${shortDate(period.starts_on)}–${shortDate(period.ends_on)}${location}`;
}

function Agenda({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod!;
  return <div className="space-y-3">{eachCalendarDate(period.starts_on, period.ends_on).map((date) => { const day = getDaySchedule(data, date); const isToday = date === data.today; return <section key={date} aria-label={fullDate(date)}><div className="sticky top-[132px] z-10 -mx-4 flex items-center gap-2 bg-background/95 px-4 py-1.5 backdrop-blur lg:static lg:mx-0 lg:px-0"><h2 className="text-sm font-semibold">{isToday ? "היום · " : ""}{shortWeekDate(date)}</h2><span className="h-px flex-1 bg-border" /><Badge variant={day.groups.some((group) => group.block?.state === "base") ? "success" : "muted"}>{day.expectedBase.length} בבסיס</Badge></div><Link className="mt-1.5 block overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(20,22,26,0.04)] transition-colors hover:border-primary/30" href={`/${data.team.slug}/schedule/${date}?period=${period.id}`}><div className="grid gap-3 p-3.5 md:grid-cols-[10rem_1fr_15rem]"><div><b className="text-sm">{day.phase?.name ?? "יום מבצעי"}</b><p className="mt-1 text-xs text-muted-foreground">{day.groups.filter((group) => group.block?.state === "base").map((group) => group.name).join(", ") || "אין סבב בבסיס"}</p></div><div className="grid grid-cols-2 gap-3"><Summary label="בבסיס" count={day.expectedBase.length} groups={[]} /><Summary label="בבית" count={day.expectedHome.length} groups={[]} /></div><div className="space-y-1 text-sm text-muted-foreground">{day.tasks.slice(0, 2).map((task) => <div className="truncate font-medium text-primary" key={task.id}>{time(task.starts_at, data.team.timezone)} · {task.title}</div>)}{day.events.slice(0, 2).map((event) => <div className="truncate" key={event.id}>{event.is_all_day ? "כל היום" : time(event.starts_at, data.team.timezone)} · {event.title}</div>)}{!day.tasks.length && !day.events.length ? <span className="text-xs">אין אירועים או משימות</span> : null}</div></div><div className="flex min-h-9 items-center justify-between border-t bg-muted/35 px-3.5 text-sm font-medium text-primary"><span>פירוט היום</span><span aria-hidden>←</span></div></Link></section>; })}</div>;
}
function Summary({ count, groups, label }: { count: number; groups: string[]; label: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="kav-num mt-1 text-sm font-semibold">{count}{groups.length ? <span className="mr-1 font-normal text-muted-foreground">· {groups.join(", ")}</span> : null}</div></div>; }

function Timeline({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod!; const days = calendarDayDifference(period.starts_on, period.ends_on) + 1;
  return <section className="rounded-lg border bg-card"><div className="border-b p-4"><h2 className="font-semibold">ציר סבבים</h2><p className="mt-1 text-xs text-muted-foreground">{days} ימים</p></div><div className="hidden overflow-x-auto p-4 md:block"><div className="min-w-[760px] space-y-4">{data.groups.map((group) => <div className="grid grid-cols-[8rem_1fr] items-center gap-3" key={group.id}><b>{group.name}</b><div className="relative h-14 rounded-md bg-muted">{data.blocks.filter((block) => block.rotation_group_id === group.id).map((block) => { const start = calendarDayDifference(period.starts_on, block.starts_on); const length = calendarDayDifference(block.starts_on, block.ends_on) + 1; return <div className={cn("absolute inset-y-1 grid place-items-center overflow-hidden rounded text-xs font-medium", block.state === "base" ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900")} key={block.id} style={{ right: `${start / days * 100}%`, width: `${length / days * 100}%` }}>{stateLabel(block.state)}</div>; })}</div></div>)}</div></div><div className="divide-y md:hidden">{data.groups.map((group) => <div className="p-4" key={group.id}><b>{group.name}</b><div className="mt-2 space-y-2">{data.blocks.filter((block) => block.rotation_group_id === group.id).map((block) => <div className="flex justify-between rounded-md bg-muted p-3 text-sm" key={block.id}><span>{shortDate(block.starts_on)}–{shortDate(block.ends_on)}</span><State state={block.state} /></div>)}</div></div>)}</div></section>;
}

function Manager({ data }: { data: ScheduleData }) {
  const create = createReservePeriodAction.bind(null, data.team.slug); const period = data.selectedPeriod;
  return <section className="mb-5 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(20,22,26,0.04)]"><div className="mb-4 flex justify-between gap-3"><div><h2 className="text-base font-semibold">ניהול תקופת מילואים</h2><p className="mt-0.5 text-sm text-muted-foreground">התקופה נשמרת כטיוטה עד לפרסום.</p></div>{period ? <Badge variant="outline">{statusLabel(period.status)}</Badge> : null}</div><details className="border-b py-3" open={!period}><summary className="cursor-pointer font-medium">1. פרטי תקופה</summary><form action={create} className="mt-4 grid gap-3 md:grid-cols-4"><Field name="name" label="שם התקופה" required /><Field name="location" label="מיקום" /><Field name="starts_on" label="תאריך התחלה" type="date" required /><Field name="ends_on" label="תאריך סיום" type="date" required /><div><Button>יצירת תקופה כטיוטה</Button></div></form></details>{period ? <><Phases data={data} /><Groups data={data} /><Assignments data={data} /><Generator data={data} /><Blocks data={data} /><Overrides data={data} /><Events data={data} /><Publish data={data} /></> : null}</section>;
}

function Phases({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod!; const save = savePhaseAction.bind(null, data.team.slug); const remove = deletePhaseAction.bind(null, data.team.slug);
  return <Panel title={`2. שלבים (${data.phases.length})`}><div className="space-y-2">{data.phases.map((phase) => <details className="rounded-md border p-3" key={phase.id}><summary className="cursor-pointer"><b>{phase.name}</b> <small>{phaseLabels[phase.phase_type]} · {shortDate(phase.starts_on)}–{shortDate(phase.ends_on)}</small></summary><form action={save} className="mt-3 grid gap-2 md:grid-cols-6"><Period id={period.id} /><input type="hidden" name="id" value={phase.id} /><Field name="name" label="שם" defaultValue={phase.name} required /><Select name="phase_type" label="סוג" defaultValue={phase.phase_type} options={Object.entries(phaseLabels)} /><Field name="starts_on" label="התחלה" type="date" defaultValue={phase.starts_on} min={period.starts_on} max={period.ends_on} required /><Field name="ends_on" label="סיום" type="date" defaultValue={phase.ends_on} min={period.starts_on} max={period.ends_on} required /><Field name="sort_order" label="סדר" type="number" defaultValue={phase.sort_order} /><Button className="self-end" size="sm">עדכון</Button></form><form action={remove} className="mt-2"><input type="hidden" name="id" value={phase.id} /><Button size="sm" variant="ghost">מחיקה</Button></form></details>)}</div><form action={save} className="mt-3 grid gap-3 md:grid-cols-6"><Period id={period.id} /><Field name="name" label="שם" required /><Select name="phase_type" label="סוג" options={Object.entries(phaseLabels)} /><Field name="starts_on" label="התחלה" type="date" min={period.starts_on} max={period.ends_on} required /><Field name="ends_on" label="סיום" type="date" min={period.starts_on} max={period.ends_on} required /><Field name="sort_order" label="סדר" type="number" defaultValue={data.phases.length} /><div className="self-end"><Button>הוספת שלב</Button></div></form></Panel>;
}

function Groups({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod!; const save = saveRotationGroupAction.bind(null, data.team.slug); const remove = deleteRotationGroupAction.bind(null, data.team.slug);
  return <Panel title={`3. סבבים (${data.groups.length})`}><div className="grid gap-2 md:grid-cols-2">{data.groups.map((group) => <details className="rounded-md border p-3" key={group.id}><summary className="cursor-pointer"><b>{group.name}</b> <small>פתיחה: {stateLabel(group.initial_state)}</small></summary><form action={save} className="mt-3 grid gap-2 sm:grid-cols-4"><Period id={period.id} /><input type="hidden" name="id" value={group.id} /><Field name="name" label="שם" defaultValue={group.name} required /><Select name="initial_state" label="פתיחה" defaultValue={group.initial_state} options={[["base", "בסיס"], ["home", "בית"]]} /><Select name="color_token" label="צבע" defaultValue={group.color_token ?? "blue"} options={[["blue", "כחול"], ["green", "ירוק"], ["amber", "ענבר"], ["gray", "אפור"]]} /><Field name="sort_order" label="סדר" type="number" defaultValue={group.sort_order} /><Button size="sm">עדכון</Button></form><form action={remove} className="mt-2"><input type="hidden" name="id" value={group.id} /><Button size="sm" variant="ghost">מחיקה</Button></form></details>)}</div><form action={save} className="mt-3 grid gap-3 md:grid-cols-5"><Period id={period.id} /><Field name="name" label="שם הסבב" required /><Select name="initial_state" label="מצב פתיחה" options={[["base", "בסיס"], ["home", "בית"]]} /><Select name="color_token" label="צבע" options={[["blue", "כחול"], ["green", "ירוק"], ["amber", "ענבר"], ["gray", "אפור"]]} /><Field name="sort_order" label="סדר" type="number" defaultValue={data.groups.length} /><div className="self-end"><Button>הוספת סבב</Button></div></form></Panel>;
}

function Assignments({ data }: { data: ScheduleData }) {
  const assign = assignRotationMemberAction.bind(null, data.team.slug); const current = new Map(data.memberships.map((item) => [item.person_id, item]));
  return <Panel title="4. אנשי הסבב"><div className="grid gap-2">{data.people.filter((person) => person.is_active).map((person) => { const membership = current.get(person.id); return <form action={assign} className="grid items-end gap-2 rounded-md border p-2 md:grid-cols-[1fr_10rem_9rem_9rem_auto]" key={person.id}><Period id={data.selectedPeriod!.id} /><input type="hidden" name="person_id" value={person.id} /><span className="self-center truncate text-sm font-medium">{person.full_name}</span><Select name="rotation_group_id" label="סבב" required={false} defaultValue={membership?.rotation_group_id ?? ""} options={[["", "ללא סבב"], ...data.groups.map((group) => [group.id, group.name])]} /><Field name="starts_on" label="מתאריך" type="date" defaultValue={membership?.starts_on ?? ""} /><Field name="ends_on" label="עד תאריך" type="date" defaultValue={membership?.ends_on ?? ""} /><Button size="sm" variant="outline">שמירה</Button></form>; })}</div></Panel>;
}

function Generator({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod!; const action = generateRotationBlocksAction.bind(null, data.team.slug); const [anchor, setAnchor] = useState(data.config?.anchor_date ?? data.phases.find((phase) => phase.phase_type === "line")?.starts_on ?? period.starts_on); const [base, setBase] = useState(data.config?.base_days ?? 7); const [home, setHome] = useState(data.config?.home_days ?? 7);
  const preview = useMemo(() => generateRotationBlocks({ period: { startsOn: period.starts_on, endsOn: period.ends_on }, anchorDate: anchor, baseDays: base, homeDays: home, groups: data.groups.map((group) => ({ id: group.id, initialState: group.initial_state })) }), [anchor, base, data.groups, home, period]);
  const generated = data.blocks.some((block) => block.source === "generated");
  return <Panel title="5. דפוס סבבים ותצוגה מקדימה"><form action={action}><Period id={period.id} /><div className="grid gap-3 md:grid-cols-3"><Controlled label="תאריך עוגן" name="anchor_date" type="date" value={anchor} set={setAnchor} /><Controlled label="ימים בבסיס" name="base_days" type="number" value={String(base)} set={(value) => setBase(Number(value))} /><Controlled label="ימים בבית" name="home_days" type="number" value={String(home)} set={(value) => setHome(Number(value))} /></div><div className="mt-3 max-h-64 overflow-auto rounded-md border"><table className="w-full text-right text-sm"><tbody className="divide-y">{preview.slice(0, 20).map((block) => <tr key={`${block.groupId}-${block.sequenceNo}`}><td className="p-2">{data.groups.find((group) => group.id === block.groupId)?.name}</td><td className="p-2">{shortDate(block.startsOn)}–{shortDate(block.endsOn)}</td><td className="p-2"><State state={block.state} /></td></tr>)}</tbody></table></div>{generated ? <label className="mt-3 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><input type="checkbox" name="confirm_replace" value="yes" required />יצירה מחדש תחליף בלוקים אוטומטיים. בלוקים ידניים יישמרו.</label> : null}<Button className="mt-3">יצירת הסבבים</Button></form></Panel>;
}

function Blocks({ data }: { data: ScheduleData }) {
  const action = editRotationBlockAction.bind(null, data.team.slug);
  return <Panel title="6. עריכת בלוקים"><div className="grid gap-2 lg:grid-cols-2">{data.blocks.map((block) => <form action={action} className="grid grid-cols-[1fr_6rem_8rem_auto] items-end gap-2 rounded-md border p-3" key={block.id}><input type="hidden" name="id" value={block.id} /><div className="text-sm"><b>{data.groups.find((group) => group.id === block.rotation_group_id)?.name}</b><div>{shortDate(block.starts_on)}–{shortDate(block.ends_on)}</div></div><Select defaultValue={block.state} label="מצב" name="state" options={[["base", "בסיס"], ["home", "בית"]]} /><Select label="תחולה" name="scope" options={[["only", "רק הבלוק"], ["following", "זה והבאים"]]} /><Button size="sm">עדכון</Button></form>)}</div></Panel>;
}

function Overrides({ data }: { data: ScheduleData }) {
  const action = saveRotationOverrideAction.bind(null, data.team.slug); const period = data.selectedPeriod!;
  return <Panel title="7. חריג סבב"><form action={action} className="grid gap-3 md:grid-cols-6"><Period id={period.id} /><Select name="person_id" label="איש צוות" options={data.people.filter((person) => person.is_active).map((person) => [person.id, person.full_name])} /><Select name="to_rotation_group_id" label="סבב זמני" options={data.groups.map((group) => [group.id, group.name])} /><Field name="starts_on" label="התחלה" type="date" min={period.starts_on} max={period.ends_on} required /><Field name="ends_on" label="סיום" type="date" min={period.starts_on} max={period.ends_on} required /><Field name="reason" label="סיבה" /><div className="self-end"><Button>הוספת חריג</Button></div></form></Panel>;
}

function Events({ data }: { data: ScheduleData }) {
  const save = saveScheduleEventAction.bind(null, data.team.slug); const remove = deleteScheduleEventAction.bind(null, data.team.slug); const period = data.selectedPeriod!;
  return <Panel title="8. אירועים"><div className="space-y-2">{data.events.map((event) => { const startsOn = getDateInTimeZone(data.team.timezone, new Date(event.starts_at)); const endsOn = event.ends_at ? getDateInTimeZone(data.team.timezone, new Date(event.ends_at)) : startsOn; return <details className="rounded-md border p-3 text-sm" key={event.id}><summary className="cursor-pointer"><b>{event.title}</b> · {eventLabels[event.event_type]} · {fullDate(startsOn)}</summary><form action={save} className="mt-3 grid gap-2 md:grid-cols-4"><Period id={period.id} /><input type="hidden" name="id" value={event.id} /><Field name="title" label="כותרת" defaultValue={event.title} required /><Select name="event_type" label="סוג" defaultValue={event.event_type} options={Object.entries(eventLabels)} /><Field name="starts_on" label="התחלה" type="date" defaultValue={startsOn} required /><Field name="starts_time" label="שעת התחלה" type="time" defaultValue={timeValue(event.starts_at, data.team.timezone)} /><Field name="ends_on" label="סיום" type="date" defaultValue={endsOn} /><Field name="ends_time" label="שעת סיום" type="time" defaultValue={event.ends_at ? timeValue(event.ends_at, data.team.timezone) : ""} /><Field name="location" label="מיקום" defaultValue={event.location ?? ""} /><Field name="notes" label="הערות" defaultValue={event.notes ?? ""} /><label className="flex items-end gap-2 pb-2"><input type="checkbox" name="is_all_day" defaultChecked={event.is_all_day} />כל היום</label><Button className="self-end" size="sm">עדכון</Button></form><form action={remove} className="mt-2"><input type="hidden" name="id" value={event.id} /><Button size="sm" variant="ghost">מחיקה</Button></form></details>; })}</div><form action={save} className="mt-3 grid gap-3 md:grid-cols-4"><Period id={period.id} /><Field name="title" label="כותרת" required /><Select name="event_type" label="סוג" options={Object.entries(eventLabels)} /><Field name="starts_on" label="תאריך התחלה" type="date" min={period.starts_on} max={period.ends_on} required /><Field name="starts_time" label="שעת התחלה" type="time" defaultValue="18:00" /><Field name="ends_on" label="תאריך סיום" type="date" /><Field name="ends_time" label="שעת סיום" type="time" defaultValue="19:00" /><Field name="location" label="מיקום" /><Field name="notes" label="הערות" /><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_all_day" />כל היום</label><div className="self-end"><Button>הוספת אירוע</Button></div></form></Panel>;
}

function Publish({ data }: { data: ScheduleData }) {
  const publish = publishReservePeriodAction.bind(null, data.team.slug); const advance = advanceReservePeriodStatusAction.bind(null, data.team.slug); const ready = data.validationIssues.length === 0; const period = data.selectedPeriod!;
  const nextLabel = period.status === "published" ? "הפעלת התקופה" : period.status === "active" ? "סיום התקופה" : period.status === "completed" ? "העברה לארכיון" : null;
  return <div className="pt-5"><div className={cn("flex gap-3 rounded-md border p-4", ready ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50")}>{ready ? <CheckCircle2 className="size-5 text-emerald-700" /> : <AlertTriangle className="size-5 text-amber-700" />}<div><b>{ready ? "מוכן לפרסום" : `יש ${data.validationIssues.length} בעיות שצריך לפתור`}</b>{!ready ? <ul className="mt-2 list-disc pr-5 text-sm">{data.validationIssues.slice(0, 8).map((issue) => <li key={`${issue.code}-${issue.message}`}>{names(issue.message, data)}</li>)}</ul> : null}</div></div><div className="mt-3 flex gap-2">{period.status === "draft" ? <form action={publish}><Period id={period.id} /><Button disabled={!ready}>פרסום לצוות</Button></form> : null}{nextLabel ? <form action={advance}><Period id={period.id} /><Button variant="outline">{nextLabel}</Button></form> : null}</div></div>;
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) { return <details className="border-b py-3"><summary className="cursor-pointer font-medium">{title}</summary><div className="mt-4">{children}</div></details>; }
function Field({ label, ...props }: React.ComponentProps<"input"> & { label: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<Input {...props} /></label>; }
function Controlled({ label, set, value, ...props }: Omit<React.ComponentProps<"input">, "value" | "onChange"> & { label: string; set: (value: string) => void; value: string }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<Input {...props} value={value} onChange={(event) => set(event.target.value)} /></label>; }
function Select({ defaultValue, label, name, options, required = true }: { defaultValue?: string; label: string; name: string; options: string[][]; required?: boolean }) { return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<select className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={defaultValue} name={name} required={required}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function Period({ id }: { id: string }) { return <input type="hidden" name="reserve_period_id" value={id} />; }
function State({ state }: { state: string }) { return <Badge variant={state === "base" ? "success" : "secondary"}>{stateLabel(state)}</Badge>; }
function stateLabel(value?: string | null) { return value === "base" ? "בסיס" : value === "home" ? "בית" : "לא הוגדר"; }
function statusLabel(value: string) { return ({ draft: "טיוטה", published: "פורסם", active: "פעיל", completed: "הושלם", archived: "ארכיון" } as Record<string, string>)[value] ?? value; }
function leaveStatusLabel(value: string) { return ({ pending: "ממתין", approved: "מאושר", partially_approved: "מאושר חלקית", rejected: "נדחה", cancelled: "בוטל" } as Record<string, string>)[value] ?? value; }
function shortDate(date: string) { return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function shortWeekDate(date: string) { return new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function fullDate(date: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function time(iso: string, zone: string) { return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(iso)); }
function timeValue(iso: string, zone: string) { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", minute: "2-digit", timeZone: zone }).format(new Date(iso)); }
function names(message: string, data: ScheduleData) { for (const person of data.people) message = message.replace(person.id, person.full_name); for (const group of data.groups) message = message.replace(group.id, group.name); return message; }

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

function isHolidayEvent(event: ScheduleData["events"][number]) {
  return event.event_type === "holiday" || holidayTitles.has(event.title);
}

function groupColorClass(color: string | null) {
  if (color === "green") return "bg-emerald-100 text-emerald-900";
  if (color === "amber") return "bg-amber-100 text-amber-900";
  if (color === "gray") return "bg-slate-100 text-slate-800";
  return "bg-sky-100 text-sky-900";
}
