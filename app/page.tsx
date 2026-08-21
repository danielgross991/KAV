import { redirect } from "next/navigation";

import { TeamSelector } from "@/components/team-selector";
import { requireAuth } from "@/lib/kav/auth";
import { getUserTeams } from "@/lib/kav/teams";

export default async function HomePage() {
  const { supabase, userId } = await requireAuth();
  const memberships = await getUserTeams(supabase, userId);

  if (memberships.length === 1) {
    redirect(`/${memberships[0].team.slug}`);
  }

  const peopleCounts = await Promise.all(
    memberships.map(async (membership) => {
      const { count } = await supabase
        .from("people")
        .select("id", { count: "exact", head: true })
        .eq("team_id", membership.team.id)
        .eq("is_active", true);

      return {
        ...membership,
        activePeople: count ?? 0,
      };
    }),
  );

  return <TeamSelector memberships={peopleCounts} />;
}
