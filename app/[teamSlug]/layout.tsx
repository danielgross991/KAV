import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";

type TeamLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ teamSlug: string }>;
};

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  return <AppShell membership={membership}>{children}</AppShell>;
}
