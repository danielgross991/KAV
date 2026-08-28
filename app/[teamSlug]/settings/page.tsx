import { redirect } from "next/navigation";

import { SettingsManagementView } from "@/components/settings-management-view";
import { requireAuth } from "@/lib/kav/auth";
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

  const [data, equipmentTypesResult] = await Promise.all([
    getTeamManagementData(supabase, membership),
    supabase
      .from("equipment_types")
      .select("id, team_id, name, category, serial_required, is_active, created_at")
      .eq("team_id", membership.team.id)
      .order("name", { ascending: true }),
  ]);

  if (equipmentTypesResult.error) {
    throw new Error(`לא ניתן לטעון סוגי ציוד: ${equipmentTypesResult.error.message}`);
  }

  return (
    <SettingsManagementView
      data={data}
      equipmentTypes={equipmentTypesResult.data ?? []}
      saved={saved}
    />
  );
}
