import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type ManagerLeaveRequestSummary = {
  endsOn: string;
  id: string;
  personName: string;
  reason: string | null;
  startsOn: string;
  status: string;
};

export async function getManagerLeaveRequests(
  supabase: Client,
  teamId: string,
  reservePeriodId: string | null,
  peopleById: Map<string, { full_name: string }>,
): Promise<ManagerLeaveRequestSummary[]> {
  if (!reservePeriodId) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, person_id, starts_on, ends_on, status, reason")
    .eq("team_id", teamId)
    .eq("reserve_period_id", reservePeriodId)
    .order("starts_on", { ascending: true });

  if (error) throw new Error(`Unable to load manager leave requests: ${error.message}`);

  return (data ?? []).map((item) => ({
    endsOn: item.ends_on,
    id: item.id,
    personName: peopleById.get(item.person_id)?.full_name ?? "איש צוות",
    reason: item.reason,
    startsOn: item.starts_on,
    status: item.status,
  }));
}
