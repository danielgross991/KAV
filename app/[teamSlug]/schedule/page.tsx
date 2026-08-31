import { ScheduleView } from "@/components/schedule-view";
import { requireAuth } from "@/lib/kav/auth";
import { getSelectedLinePeriodId } from "@/lib/kav/line-selection.server";
import { getScheduleData } from "@/lib/kav/schedule";
import { requireTeamAccess } from "@/lib/kav/teams";

type SchedulePageProps = {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ manage?: string; month?: string; period?: string; view?: string }>;
};

export default async function SchedulePage({ params, searchParams }: SchedulePageProps) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const selectedLinePeriodId = await getSelectedLinePeriodId(teamSlug);
  const data = await getScheduleData(supabase, membership, query.period ?? selectedLinePeriodId ?? undefined, userId);
  const view = ["month", "agenda", "rotations"].includes(query.view ?? "")
    ? query.view!
    : "agenda";

  return <ScheduleView data={data} initialManage={query.manage === "1"} month={query.month} view={view} />;
}
