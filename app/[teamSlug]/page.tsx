import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/kav/dashboard";
import { requireAuth } from "@/lib/kav/auth";
import { getLineSelectionOptions } from "@/lib/kav/line-selection";
import { getSelectedLinePeriodId } from "@/lib/kav/line-selection.server";
import { requireTeamAccess } from "@/lib/kav/teams";
import { canManage } from "@/lib/kav/teams";

type TeamDashboardProps = {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ statsPeriod?: string }>;
};

export default async function TeamDashboardPage({ params, searchParams }: TeamDashboardProps) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const [lineOptions, selectedLinePeriodId] = await Promise.all([
    getLineSelectionOptions(supabase, membership.team),
    getSelectedLinePeriodId(teamSlug),
  ]);
  const data = await getDashboardData(
    supabase,
    membership.team,
    canManage(membership.role),
    userId,
    query.statsPeriod ?? selectedLinePeriodId ?? undefined,
  );

  return <DashboardView data={data} lineOptions={lineOptions} selectedLinePeriodId={selectedLinePeriodId} />;
}
