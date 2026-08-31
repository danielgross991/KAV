import { TasksView } from "@/components/tasks-view";
import { requireAuth } from "@/lib/kav/auth";
import { getSelectedLinePeriodId } from "@/lib/kav/line-selection.server";
import { getTasksData } from "@/lib/kav/tasks";
import { requireTeamAccess } from "@/lib/kav/teams";

type TasksPageProps = {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ period?: string; proposal?: string; tab?: string; task?: string; view?: string; week?: string }>;
};

export default async function TasksPage({ params, searchParams }: TasksPageProps) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const selectedLinePeriodId = await getSelectedLinePeriodId(teamSlug);
  const data = await getTasksData(supabase, membership, userId, {
    periodId: query.period ?? selectedLinePeriodId ?? undefined,
    selectedTaskId: query.task,
    week: query.week,
  });
  return <TasksView
    data={data}
    proposalRequested={query.proposal === "1"}
    selectedTab={["people", "problems"].includes(query.tab ?? "") ? query.tab! : "tasks"}
    selectedTaskId={query.task}
    templatesView={query.view === "templates"}
  />;
}
