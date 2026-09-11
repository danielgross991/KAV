import { redirect } from "next/navigation";

import { SettingsManagementView } from "@/components/settings-management-view";
import { requireAuth } from "@/lib/kav/auth";
import { getDateInTimeZone } from "@/lib/kav/dates";
import { getCurrentDailyQuote } from "@/lib/kav/daily-quotes";
import { getScheduleData } from "@/lib/kav/schedule";
import { getTeamManagementData } from "@/lib/kav/team-management";
import { canManage, requireTeamAccess } from "@/lib/kav/teams";

type SettingsPageProps = {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { teamSlug } = await params;
  const { saved } = await searchParams;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  if (!canManage(membership.role)) {
    redirect(`/${teamSlug}`);
  }

  const today = getDateInTimeZone(membership.team.timezone);
  const [data, scheduleData, currentDailyQuote, equipmentTypesResult, dailyQuotesResult] = await Promise.all([
    getTeamManagementData(supabase, membership),
    getScheduleData(supabase, membership, undefined, userId),
    getCurrentDailyQuote(supabase, membership.team, today),
    supabase
      .from("equipment_types")
      .select("id, team_id, name, category, serial_required, is_active, created_at")
      .eq("team_id", membership.team.id)
      .order("name", { ascending: true }),
    supabase
      .from("daily_quotes")
      .select("id, team_id, text, status, source, submitted_by, submitted_person_id, approved_by, approved_at, sort_order, is_active, created_at, updated_at")
      .eq("team_id", membership.team.id)
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (equipmentTypesResult.error) {
    throw new Error(`לא ניתן לטעון סוגי ציוד: ${equipmentTypesResult.error.message}`);
  }

  if (dailyQuotesResult.error) {
    throw new Error(`לא ניתן לטעון משפטים יומיים: ${dailyQuotesResult.error.message}`);
  }

  return (
    <SettingsManagementView
      currentDailyQuoteId={currentDailyQuote?.id ?? null}
      data={data}
      dailyQuotes={dailyQuotesResult.data ?? []}
      equipmentTypes={equipmentTypesResult.data ?? []}
      scheduleData={scheduleData}
      saved={saved}
    />
  );
}
