import { PersonProfileView } from "@/components/person-profile-view";
import { requireAuth } from "@/lib/kav/auth";
import { getPersonProfileData } from "@/lib/kav/team-management";
import { requireTeamAccess } from "@/lib/kav/teams";

type PersonPageProps = {
  params: Promise<{ personId: string; teamSlug: string }>;
  searchParams: Promise<{ saved?: string; tab?: string }>;
};

export default async function PersonPage({ params, searchParams }: PersonPageProps) {
  const { personId, teamSlug } = await params;
  const { saved, tab } = await searchParams;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const data = await getPersonProfileData(supabase, membership, personId);

  return <PersonProfileView data={data} saved={saved} tab={tab} />;
}
