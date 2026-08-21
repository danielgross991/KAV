import { TeamManagementView } from "@/components/team-management-view";
import { requireAuth } from "@/lib/kav/auth";
import { getTeamManagementData } from "@/lib/kav/team-management";
import { requireTeamAccess } from "@/lib/kav/teams";

type TeamPageProps = {
  params: Promise<{ teamSlug: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const data = await getTeamManagementData(supabase, membership);

  return <TeamManagementView data={data} />;
}
