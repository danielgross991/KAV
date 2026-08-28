import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/kav/dashboard";
import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";
import { canManage } from "@/lib/kav/teams";

type TeamDashboardProps = {
  params: Promise<{ teamSlug: string }>;
};

export default async function TeamDashboardPage({ params }: TeamDashboardProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const data = await getDashboardData(supabase, membership.team, canManage(membership.role), userId);

  return <DashboardView data={data} />;
}
