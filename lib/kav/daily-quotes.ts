import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { TeamSummary } from "@/lib/kav/teams";

type Supabase = SupabaseClient<Database>;

export type DailyQuote = Database["public"]["Tables"]["daily_quotes"]["Row"];

export type CurrentDailyQuote = {
  id: string;
  text: string;
} | null;

export async function getCurrentDailyQuote(
  supabase: Supabase,
  team: TeamSummary,
  today: string,
): Promise<CurrentDailyQuote> {
  const { data, error } = await supabase
    .from("daily_quotes")
    .select("id, text")
    .eq("team_id", team.id)
    .eq("status", "approved")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load daily quote: ${error.message}`);
  }

  return selectDailyQuoteForDate(data ?? [], today);
}

export function selectDailyQuoteForDate<T>(quotes: T[], today: string): T | null {
  if (!quotes.length) return null;
  return quotes[dayIndex(today) % quotes.length] ?? null;
}

function dayIndex(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) {
    throw new Error(`Invalid quote date: ${date}`);
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
