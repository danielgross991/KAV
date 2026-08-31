import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardList,
  Clock3,
  Home,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";

import { AppPage, PageHeader, SectionHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/lib/kav/dashboard";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function DashboardView({ data }: { data: DashboardData }) {
  return data.canManage ? <ManagerDashboard data={data} /> : <ViewerDashboard data={data} />;
}

function ManagerDashboard({ data }: { data: DashboardData }) {
  const home = Math.max(0, data.activePeople - data.expectedOnBase - data.approvedLeaveToday);

  return (
    <AppPage>
      <PageHeader
        eyebrow={data.team.name}
        title="מה קורה היום?"
        subtitle={formatToday(data.team.timezone)}
        action={
          <Link
            className="flex size-10 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href={`/${data.team.slug}/settings`}
            aria-label="הגדרות"
          >
            <Clock3 className="size-4" />
          </Link>
        }
      />

      <section className="overflow-hidden rounded-lg bg-primary text-white shadow-[0_8px_24px_-16px_rgba(20,22,26,0.7)]">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
          <p className="text-xs font-medium text-white/70">תמונת מצב תפעולית</p>
          {data.currentPeriod ? (
            <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/85">
              {data.currentPeriod.name}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-4 px-4 pb-4 pt-2">
          <HeroMetric dominant label="צפויים בבסיס" value={data.expectedOnBase} />
          <HeroMetric label="בבית" value={home} muted />
          <HeroMetric label="ביציאה" value={data.approvedLeaveToday} info />
        </div>
        <Link
          href={`/${data.team.slug}/attendance`}
          className="flex min-h-11 items-center justify-between border-t border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm transition-colors hover:bg-white/10"
        >
          <span className="flex items-center gap-2">
            <UserCheck className="size-4 text-white/70" />
            <b>נוכחות היום</b>
            <span className="kav-num text-white/65">{data.attendance.present}/{data.attendance.total}</span>
          </span>
          <ArrowLeft className="size-4 text-white/60" />
        </Link>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="space-y-4">
          <section>
            <SectionHeader title="דורש טיפול" hint={`${data.issues.length} פריטים`} />
            {data.issues.length ? (
              <div className="space-y-2">
                {data.issues.map((issue) => (
                  <Link
                    key={issue}
                    href={`/${data.team.slug}/attendance`}
                    className="flex min-h-14 items-center gap-3 rounded-lg border border-warning/20 bg-warning-soft px-3.5 py-3 text-sm text-warning transition-colors hover:border-warning/40"
                  >
                    <AlertTriangle className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 font-medium">{issue}</span>
                    <ArrowLeft className="size-4 shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3.5 text-sm">
                <Check className="size-4 text-success" />
                <span className="font-medium">הכול תקין</span>
              </div>
            )}
          </section>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>נוכחות היום</CardTitle>
                <p className="kav-num mt-0.5 text-sm text-muted-foreground">
                  {data.attendance.present}/{data.attendance.total} סומנו כנוכחים
                </p>
              </div>
              <AttendanceStatus data={data} />
            </CardHeader>
            <CardContent>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="bg-success" style={{ width: ratio(data.attendance.present, data.attendance.total) }} />
                <span className="bg-destructive" style={{ width: ratio(data.attendance.absent, data.attendance.total) }} />
              </div>
              <Link
                className="mt-3 flex h-9 items-center justify-center rounded-md border bg-card text-sm font-medium transition-colors hover:bg-muted"
                href={`/${data.team.slug}/attendance`}
              >
                {data.attendance.submitted ? "פתח נוכחות" : "השלם דיווח נוכחות"}
              </Link>
            </CardContent>
          </Card>

          <NextTask data={data} />
        </div>

        <div className="space-y-4">
          <CurrentPeriod data={data} />
          <UpcomingEvent data={data} />
          <StatsPeriodSelector data={data} />
          <HomeLeaderboard data={data} />
          <AttendanceByPerson data={data} />
          <QualificationReadiness data={data} />
        </div>
      </div>
    </AppPage>
  );
}

function ViewerDashboard({ data }: { data: DashboardData }) {
  const personal = data.personalStatus;
  const firstName = personal?.fullName.split(" ")[0];

  return (
    <AppPage className="max-w-[820px]">
      <PageHeader
        eyebrow={data.team.name}
        title={firstName ? `שלום ${firstName}` : "הבית שלי"}
        subtitle={formatToday(data.team.timezone)}
      />

      <section className="rounded-lg bg-primary px-4 py-4 text-white shadow-[0_8px_24px_-16px_rgba(20,22,26,0.7)]">
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          {personal?.state === "home" ? <Home className="size-4" /> : <Users className="size-4" />}
          הסטטוס שלך עכשיו
        </div>
        <p className="mt-1.5 text-[1.8rem] font-bold leading-9">{personalStatusLabel(personal)}</p>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/15 pt-3">
          {personal ? <Badge className="border-white/20 bg-white/10 text-white">{attendanceLabel(personal.attendance)}</Badge> : null}
          {data.currentPeriod ? <Badge className="border-white/20 bg-white/10 text-white">{data.currentPeriod.name}</Badge> : null}
        </div>
      </section>

      <div className="mt-4 space-y-4">
        <HomeLeaderboard data={data} />
        <NextTask data={data} personal />
        <PersonalStats data={data} />
        <UpcomingEvent data={data} />
        <StatsPeriodSelector data={data} />
        <CurrentPeriod data={data} compact />
      </div>
    </AppPage>
  );
}

function PersonalStats({ data }: { data: DashboardData }) {
  const stats = data.personalStats;
  if (!stats) return null;
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>הנתונים שלי במילואים</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniMetric label="ימי בית" value={stats.homeDays} />
        <MiniMetric label="ימי בסיס" value={stats.baseDays} />
        <MiniMetric label="ימי יציאה" value={stats.leaveDays} />
        <MiniMetric label="נוכחות" value={stats.attendancePercentage === null ? "אין" : `${Math.round(stats.attendancePercentage * 100)}%`} />
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-center">
      <b className="kav-num block text-xl">{value}</b>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function HomeLeaderboard({ data }: { data: DashboardData }) {
  if (!data.homeLeaderboard.length) return null;
  const podium = [data.homeLeaderboard[1], data.homeLeaderboard[0], data.homeLeaderboard[2]].filter(Boolean);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>אלופי הבית</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 items-end gap-2">
          {podium.map((item) => {
            const rank = data.homeLeaderboard.findIndex((candidate) => candidate.personId === item.personId) + 1;
            return (
              <div
                key={item.personId}
                className={cn(
                  "grid min-h-36 place-items-center rounded-lg border bg-muted/30 p-2 text-center",
                  rank === 1 && "min-h-44 border-primary/30 bg-accent",
                )}
              >
                <span className="text-xl" aria-hidden>{MEDALS[rank - 1]}</span>
                <PersonAvatar name={item.fullName} photoUrl={item.photoUrl} featured={rank === 1} />
                <b className="mt-2 line-clamp-2 text-xs leading-4">{item.fullName}</b>
                <span className="kav-num mt-1 text-xs text-muted-foreground">
                  {item.homeDays} ימים · {Math.round(item.homePercentage * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsPeriodSelector({ data }: { data: DashboardData }) {
  if (data.statsPeriods.length <= 1) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>סטטיסטיקות לפי סבב</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {data.statsPeriods.slice(0, 4).map((period) => (
          <Link
            key={period.id}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
              data.statsPeriodId === period.id && "border-primary bg-accent text-primary",
            )}
            href={`/${data.team.slug}?statsPeriod=${period.id}`}
          >
            {period.name}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function PersonAvatar({ featured, name, photoUrl }: { featured?: boolean; name: string; photoUrl: string | null }) {
  const size = featured ? "size-16" : "size-12";
  if (photoUrl) {
    return (
      <span
        aria-label={name}
        className={cn("block rounded-lg border bg-cover bg-center", size)}
        style={{ backgroundImage: `url(${photoUrl})` }}
      />
    );
  }

  return (
    <span className={cn("flex items-center justify-center rounded-lg border bg-card text-muted-foreground", size)}>
      <UserRound className={featured ? "size-7" : "size-5"} />
    </span>
  );
}

function HeroMetric({
  dominant,
  info,
  label,
  muted,
  value,
}: {
  dominant?: boolean;
  info?: boolean;
  label: string;
  muted?: boolean;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <p className={`kav-num font-bold ${dominant ? "text-[2.1rem] leading-9" : "text-2xl leading-8"} ${muted ? "text-white/60" : info ? "text-blue-200" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-white/65">{label}</p>
    </div>
  );
}

function AttendanceStatus({ data }: { data: DashboardData }) {
  if (data.attendance.absent) return <Badge variant="danger">{data.attendance.absent} לא נוכחים</Badge>;
  if (!data.attendance.submitted) return <Badge variant="warning">טרם הושלם</Badge>;
  return <Badge variant="success">הושלם</Badge>;
}

function CurrentPeriod({ data, compact = false }: { data: DashboardData; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>סבבים</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.currentPeriod ? `${shortDate(data.currentPeriod.startsOn)}–${shortDate(data.currentPeriod.endsOn)}` : "אין תקופה פעילה"}
          </p>
        </div>
        {data.currentPeriod ? <Badge variant="outline">{statusLabel(data.currentPeriod.status)}</Badge> : null}
      </CardHeader>
      <CardContent>
        {data.currentPeriod ? (
          <div className="divide-y">
            {data.rotationStatus.slice(0, compact ? 2 : 4).map((rotation) => (
              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0" key={`${rotation.name}-${rotation.state}`}>
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className={`h-8 w-1 rounded-full ${rotation.state === "base" ? "bg-success" : "bg-border"}`} />
                  {rotation.name}
                </span>
                <Badge variant={rotation.state === "base" ? "success" : "muted"}>{stateLabel(rotation.state)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">אין תקופת מילואים פעילה להיום.</p>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingEvent({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>הקרוב</CardTitle>
      </CardHeader>
      <CardContent>
        {data.upcomingEvent ? (
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
              <CalendarClock className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{data.upcomingEvent.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(data.upcomingEvent.startsAt, data.team.timezone)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">אין אירועים קרובים.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NextTask({ data, personal = false }: { data: DashboardData; personal?: boolean }) {
  return (
    <section>
      <SectionHeader title={personal ? "המשימה הבאה שלי" : "המשימה הבאה שלך"} />
      {data.nextTask ? (
        <Link
          href={`/${data.team.slug}/tasks`}
          className="flex min-h-20 items-center gap-3 rounded-lg border bg-card p-3.5 shadow-[0_1px_2px_rgba(20,22,26,0.04)] transition-colors hover:border-primary/35"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
            <ClipboardList className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{data.nextTask.title}</b>
            <span className="mt-1 block text-sm text-muted-foreground">
              {formatDateTime(data.nextTask.startsAt, data.team.timezone)}
              {data.nextTask.teammateNames.length ? ` · עם ${data.nextTask.teammateNames.join(" ו")}` : ""}
            </span>
          </span>
          <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-3.5 text-sm text-muted-foreground">
          <ClipboardList className="size-4" />
          אין לך משימות קרובות
        </div>
      )}
    </section>
  );
}

function AttendanceByPerson({ data }: { data: DashboardData }) {
  const withData = data.attendanceStats
    .filter((item) => item.attendancePercentage !== null)
    .sort((a, b) => (a.attendancePercentage ?? 0) - (b.attendancePercentage ?? 0))
    .slice(0, 6);
  if (!withData.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>נוכחות לפי אדם</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {withData.map((item) => (
          <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0" key={item.personId}>
            <span className="truncate text-sm font-medium">{item.fullName}</span>
            <Badge variant={(item.attendancePercentage ?? 0) >= 0.9 ? "success" : (item.attendancePercentage ?? 0) >= 0.7 ? "warning" : "danger"}>
              {Math.round((item.attendancePercentage ?? 0) * 100)}%
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QualificationReadiness({ data }: { data: DashboardData }) {
  if (!data.qualificationReadiness.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>כשירות פק״לים</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {data.qualificationReadiness.map((item) => {
          const ready = item.current >= item.required;
          return (
            <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0" key={item.name}>
              <span className="text-sm font-medium">{item.name}</span>
              <Badge variant={ready ? "success" : "warning"}>{item.current}/{item.required}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function personalStatusLabel(personal: DashboardData["personalStatus"]) {
  if (!personal) return "אין סטטוס זמין";
  if (personal.isOnLeave) return "אתה ביציאה";
  if (personal.state === "base") return "אתה בבסיס";
  if (personal.state === "home") return "אתה בבית";
  return "אין תכנון פעיל";
}

function attendanceLabel(value: "absent" | "present" | "unreported") {
  if (value === "present") return "נוכח";
  if (value === "absent") return "לא נוכח";
  return "טרם דווח";
}

function ratio(value: number, total: number) {
  return total ? `${Math.min(100, (value / total) * 100)}%` : "0%";
}

function formatToday(timeZone: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone }).format(new Date());
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function stateLabel(state: string) {
  return ["base", "on_base", "in_base"].includes(state) ? "בבסיס" : ["home", "off_base"].includes(state) ? "בבית" : state;
}

function statusLabel(status: string) {
  if (status === "active") return "פעילה";
  if (status === "published") return "פורסמה";
  if (status === "draft") return "טיוטה";
  return status;
}
