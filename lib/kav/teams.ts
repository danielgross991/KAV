import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type TeamRole = "admin" | "manager" | "viewer";

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type TeamMembership = {
  role: TeamRole;
  team: TeamSummary;
};

export async function getUserTeams(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TeamMembership[]> {
  const { data: memberships, error } = await supabase
    .from("team_memberships")
    .select("role, team_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load team memberships: ${error.message}`);
  }

  if (!memberships?.length) {
    return [];
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, slug, timezone")
    .in(
      "id",
      memberships.map((membership) => membership.team_id),
    );

  if (teamsError) {
    throw new Error(`Unable to load teams: ${teamsError.message}`);
  }

  const teamsById = new Map((teams ?? []).map((team) => [team.id, team]));

  return memberships.flatMap((membership) => {
    const team = teamsById.get(membership.team_id);
    if (!team) return [];

    return {
      role: membership.role as TeamRole,
      team,
    };
  });
}

export async function requireTeamAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  teamSlug: string,
) {
  const teams = await getUserTeams(supabase, userId);
  const membership = teams.find(({ team }) => team.slug === teamSlug);

  if (!membership) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", teamSlug)
      .maybeSingle();

    if (team) {
      redirect("/");
    }

    notFound();
  }

  return membership;
}

export function canManage(role: TeamRole) {
  return role === "admin" || role === "manager";
}
