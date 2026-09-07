import { Bell, LogIn, PackageCheck, PlaneTakeoff } from "lucide-react";
import { redirect } from "next/navigation";

import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/kav/auth";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

type NotificationsPageProps = {
  params: Promise<{ teamSlug: string }>;
};

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  if (!canManage(membership.role)) {
    redirect(`/${teamSlug}`);
  }

  const { data: events, error } = await supabase
    .from("activity_events")
    .select("id, actor_person_id, created_at, details, entity_type, event_type, title")
    .eq("team_id", membership.team.id)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error(`Unable to load activity events: ${error.message}`);
  }
  const actorIds = [...new Set((events ?? []).flatMap((event) => event.actor_person_id ? [event.actor_person_id] : []))];
  const { data: people, error: peopleError } = actorIds.length
    ? await supabase.from("people").select("id, full_name").eq("team_id", membership.team.id).in("id", actorIds)
    : { data: [], error: null };
  if (peopleError) {
    throw new Error(`Unable to load activity people: ${peopleError.message}`);
  }
  const peopleById = new Map((people ?? []).map((person) => [person.id, person.full_name]));

  return (
    <AppPage>
      <PageHeader
        eyebrow={membership.team.name}
        title="עדכונים ולוגים"
        subtitle="כניסות, בקשות יציאה ושינויי ציוד בזמן אמת למנהלים."
      />

      {events?.length ? (
        <section className="space-y-2">
          {events.map((event) => (
            <Card className="grid gap-3 p-3.5 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={event.id}>
              <span className="grid size-10 place-items-center rounded-md bg-accent text-primary">
                <ActivityIcon type={event.event_type} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">{event.title}</h2>
                  <Badge variant="outline">{label(event.event_type)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.details ?? "עודכן במערכת"}
                  {event.actor_person_id && peopleById.has(event.actor_person_id) ? ` · ${peopleById.get(event.actor_person_id)}` : ""}
                </p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
                {formatDateTime(event.created_at)}
              </time>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState icon={<Bell className="size-4" />} title="אין עדכונים עדיין" description="כאן יופיעו כניסות, בקשות יציאה ושינויי ציוד." />
      )}
    </AppPage>
  );
}

function ActivityIcon({ type }: { type: string }) {
  if (type.startsWith("auth.")) return <LogIn className="size-4" />;
  if (type.startsWith("leave.")) return <PlaneTakeoff className="size-4" />;
  if (type.includes("equipment")) return <PackageCheck className="size-4" />;
  return <Bell className="size-4" />;
}

function label(type: string) {
  if (type === "auth.sign_in") return "כניסה";
  if (type === "leave.request_created") return "בקשה חדשה";
  if (type === "leave.request_updated") return "עדכון יציאה";
  if (type === "leave.request_deleted") return "מחיקת יציאה";
  if (type === "equipment.assigned") return "ציוד אישי";
  if (type === "equipment.updated") return "ציוד אישי";
  if (type === "equipment.returned") return "החזרת ציוד";
  if (type === "team_equipment.created") return "ציוד צוותי";
  if (type === "team_equipment.updated") return "ציוד צוותי";
  if (type === "team_equipment.transferred") return "העברת אחריות";
  return "עדכון";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}
