import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarOff, Check, Clock, UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/lib/kav/dashboard";

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary">{data.team.name}</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-normal">מה קורה היום?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            תמונת מצב מבוססת נתונים חיים מה-Supabase הקיים.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("he-IL", {
            dateStyle: "full",
            timeZone: data.team.timezone,
          }).format(new Date())}
        </div>
      </header>

      {data.canManage ? <div className="mb-4 flex flex-wrap gap-2">
        <Link className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent" href={`/${data.team.slug}/attendance`}><UserCheck className="size-4" />עדכון נוכחות</Link>
        <Link className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent" href={`/${data.team.slug}/leave`}><CalendarOff className="size-4" />ניהול יציאות</Link>
      </div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="size-5" />}
          label="צפויים בבסיס"
          value={data.expectedOnBase}
          detail={`${data.activePeople} פעילים בצוות`}
        />
        <MetricCard
          icon={<Clock className="size-5" />}
          label="חופשה מאושרת"
          value={data.approvedLeaveToday}
          detail="משפיע על זמינות יומית"
        />
        <MetricCard
          icon={<Check className="size-5" />}
          label="נוכחות"
          value={`${data.attendance.present}/${data.attendance.total}`}
          detail={data.attendance.unexpectedPresent
            ? `${data.attendance.unexpectedPresent} נוכחות חריגה`
            : data.attendance.submitted ? "דווח וסומן" : "טרם הוגש להיום"}
        />
        <MetricCard
          icon={<AlertTriangle className="size-5" />}
          label="פערים פתוחים"
          value={data.issues.length}
          detail={data.issues.length ? "דורש טיפול מנהל" : "אין פערים ידועים"}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>תקופת מילואים נוכחית</CardTitle>
            <CardDescription>תקופה וסבבי רוטציה להיום</CardDescription>
          </CardHeader>
          <CardContent>
            {data.currentPeriod ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{data.currentPeriod.name}</h2>
                  <Badge variant="outline">{data.currentPeriod.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(data.currentPeriod.startsOn)} -{" "}
                  {formatDate(data.currentPeriod.endsOn)}
                  {data.currentPeriod.location ? ` · ${data.currentPeriod.location}` : ""}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {data.rotationStatus.map((rotation) => (
                    <div
                      key={`${rotation.name}-${rotation.state}`}
                      className="rounded-lg border bg-muted/30 p-4"
                    >
                      <div className="font-medium">{rotation.name}</div>
                      <Badge className="mt-2" variant={rotation.state === "base" ? "success" : "muted"}>
                        {stateLabel(rotation.state)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="אין תקופת מילואים פעילה"
                description="בטבלת reserve_periods לא נמצאה תקופה שמכסה את התאריך הנוכחי."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>אירוע קרוב</CardTitle>
            <CardDescription>האירוע העתידי הקרוב ביותר בלו״ז</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingEvent ? (
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <CalendarClock className="size-5" />
                </span>
                <div>
                  <div className="font-medium">{data.upcomingEvent.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(data.upcomingEvent.startsAt)}
                  </p>
                  <Badge className="mt-3" variant="outline">
                    {eventTypeLabel(data.upcomingEvent.type)}
                  </Badge>
                </div>
              </div>
            ) : (
              <EmptyState
                title="אין אירועים עתידיים"
                description="לא נמצאו אירועים עתידיים בטבלת schedule_events."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>כשירות פק״לים</CardTitle>
            <CardDescription>ספירה מול דרישות הצוות</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.qualificationReadiness.length > 0 ? (
              data.qualificationReadiness.map((item) => {
                const ready = item.current >= item.required;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="font-medium">{item.name}</div>
                    <Badge variant={ready ? "success" : "warning"}>
                      {item.current} / {item.required}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="אין דרישות פק״ל"
                description="לא נמצאו רשומות פעילות ב-team_pakal_requirements."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>פערים לטיפול</CardTitle>
            <CardDescription>בעיות שהמערכת מזהה עבור היום</CardDescription>
          </CardHeader>
          <CardContent>
            {data.issues.length > 0 ? (
              <div className="grid gap-2">
                {data.issues.map((issue) => (
                  <div
                    key={issue}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="אין פערים פתוחים" description="המידע להיום נראה תקין." />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <span className="text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5">
      <div className="font-medium">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stateLabel(state: string) {
  if (["base", "on_base", "in_base"].includes(state)) return "בבסיס";
  if (["home", "off_base"].includes(state)) return "בבית";
  return state;
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    briefing: "תדריך",
    changeover: "החלפה",
    family: "משפחה",
    processing: "זיכויים",
    training: "אימון",
  };

  return labels[type] ?? "אירוע";
}
