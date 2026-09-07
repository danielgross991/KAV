import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json, Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type ActivityEventType =
  | "auth.sign_in"
  | "leave.request_created"
  | "leave.request_updated"
  | "leave.request_deleted"
  | "equipment.assigned"
  | "equipment.updated"
  | "equipment.returned"
  | "team_equipment.created"
  | "team_equipment.updated"
  | "team_equipment.transferred";

export async function logActivityEvent(
  supabase: Client,
  input: {
    actorPersonId?: string | null;
    actorUserId: string;
    details?: string | null;
    entityId?: string | null;
    entityType: string;
    eventType: ActivityEventType;
    metadata?: Json;
    teamId: string;
    title: string;
  },
) {
  const { error } = await supabase.from("activity_events").insert({
    actor_person_id: input.actorPersonId ?? null,
    actor_user_id: input.actorUserId,
    details: input.details ?? null,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
    team_id: input.teamId,
    title: input.title,
  });

  if (error) {
    console.warn("Activity event logging failed", {
      code: error.code,
      eventType: input.eventType,
      message: error.message,
      teamId: input.teamId,
    });
  }
}
