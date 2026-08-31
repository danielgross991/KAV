import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { TeamSummary } from "@/lib/kav/teams";

type Client = SupabaseClient<Database>;
type PeriodOption = {
  endsOn: string;
  id: string;
  location: string | null;
  name: string;
  startsOn: string;
  status: string;
};

export const DEFAULT_LINE_VALUE = "operational";

export async function getLineSelectionOptions(supabase: Client, team: TeamSummary) {
  const { data, error } = await supabase
    .from("reserve_periods")
    .select("id, name, location, starts_on, ends_on, status")
    .eq("team_id", team.id)
    .neq("status", "archived")
    .order("starts_on", { ascending: false });

  if (error) throw new Error(`Unable to load line selection: ${error.message}`);

  return (data ?? []).map((period): PeriodOption => ({
    endsOn: period.ends_on,
    id: period.id,
    location: period.location,
    name: period.name,
    startsOn: period.starts_on,
    status: period.status,
  }));
}

export function lineCookieName(teamSlug: string) {
  return `kav-line-${teamSlug}`;
}
