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
  const { data: profile, error: profileError } = await supabase
    .from("people")
    .select("id, full_name, photo_url")
    .eq("team_id", membership.team.id)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load current profile: ${profileError.message}`);
  }

  return <AppShell membership={membership} profile={profile}>{children}</AppShell>;
}
