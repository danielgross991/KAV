import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type LineParticipationStatus = {
  is_line_active: boolean;
  notes: string | null;
  person_id: string;
};

export const getLineParticipationStatuses = cache(async function getLineParticipationStatuses(
  supabase: Client,
  teamId: string,
  reservePeriodId: string,
): Promise<LineParticipationStatus[]> {
  const { data, error } = await supabase
    .from("reserve_period_person_statuses")
    .select("person_id, is_line_active, notes")
    .eq("team_id", teamId)
    .eq("reserve_period_id", reservePeriodId);

  if (error) {
    throw new Error(`Unable to load line participation statuses: ${error.message}`);
  }

  return data ?? [];
});

export async function getLineInactivePersonIds(
  supabase: Client,
  teamId: string,
  reservePeriodId: string,
) {
  return new Set(
    (await getLineParticipationStatuses(supabase, teamId, reservePeriodId))
      .filter((status) => !status.is_line_active)
      .map((status) => status.person_id),
  );
}

export async function getLineStatsStartDates(
  supabase: Client,
  teamId: string,
  reservePeriodId: string,
) {
  const startsByPersonId = new Map<string, string>();
  for (const status of await getLineParticipationStatuses(supabase, teamId, reservePeriodId)) {
    const statsStart = parseStatsStartDate(status.notes);
    if (statsStart) startsByPersonId.set(status.person_id, statsStart);
  }
  return startsByPersonId;
}

export function parseStatsStartDate(notes: string | null) {
  const match = notes?.match(/\bstats_start:(\d{4}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

export function filterLineActivePeople<T extends { id: string }>(
  people: T[],
  inactivePersonIds: ReadonlySet<string>,
) {
  return people.filter((person) => !inactivePersonIds.has(person.id));
}
