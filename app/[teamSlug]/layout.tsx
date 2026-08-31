import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/kav/auth";
import { getLineSelectionOptions } from "@/lib/kav/line-selection";
import { getSelectedLinePeriodId } from "@/lib/kav/line-selection.server";
import { requireTeamAccess } from "@/lib/kav/teams";

type TeamLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ teamSlug: string }>;
};

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const [lineOptions, selectedLinePeriodId] = await Promise.all([
    getLineSelectionOptions(supabase, membership.team),
    getSelectedLinePeriodId(teamSlug),
  ]);

  return <AppShell lineOptions={lineOptions} membership={membership} selectedLinePeriodId={selectedLinePeriodId}>{children}</AppShell>;
}
