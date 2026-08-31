import Link from "next/link";
import { LogOut } from "lucide-react";

import { KavMark } from "@/components/kav-mark";
import { LineSelector } from "@/components/line-selector";
import { Separator } from "@/components/ui/separator";
import { TeamNav } from "@/components/team-nav";
import type { getLineSelectionOptions } from "@/lib/kav/line-selection";
import type { TeamMembership } from "@/lib/kav/teams";

export function AppShell({
  children,
  lineOptions,
  membership,
  selectedLinePeriodId,
}: {
  children: React.ReactNode;
  lineOptions: Awaited<ReturnType<typeof getLineSelectionOptions>>;
  membership: TeamMembership;
  selectedLinePeriodId: string | null;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-60 flex-col border-l bg-card lg:flex">
        <div className="px-4 py-4">
          <Link href={`/${membership.team.slug}`} className="inline-flex items-center gap-2.5" aria-label="KAV - בית">
            <KavMark />
            <span className="leading-none">
              <span className="block text-base font-bold">KAV</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">קו</span>
            </span>
          </Link>
        </div>
        <div className="mx-4 rounded-md border bg-muted/55 px-3 py-2.5">
          <p className="truncate text-sm font-semibold">{membership.team.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel(membership.role)}</p>
        </div>
        <div className="mx-4 mt-3">
          <LineSelector
            id="desktop-line-selector"
            options={lineOptions}
            selectedPeriodId={selectedLinePeriodId}
            teamSlug={membership.team.slug}
          />
        </div>
        <Separator className="mx-4 my-4 w-auto" />
        <div className="flex-1 px-3">
          <TeamNav
            role={membership.role}
            teamSlug={membership.team.slug}
            variant="desktop"
          />
        </div>
        <div className="border-t p-3">
          <form action="/logout" method="post">
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <LogOut className="size-4" />
              יציאה
            </button>
          </form>
        </div>
      </aside>
      <header className="sticky top-0 z-30 border-b bg-card/95 px-3 py-2 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-[720px] items-center gap-2">
          <Link href={`/${membership.team.slug}`} className="flex min-w-0 flex-1 items-center gap-2" aria-label="KAV - בית">
            <KavMark />
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-4">KAV</span>
              <span className="block truncate text-[11px] text-muted-foreground">{membership.team.name}</span>
            </span>
          </Link>
          <LineSelector
            className="w-[min(52vw,15rem)]"
            id="mobile-line-selector"
            options={lineOptions}
            selectedPeriodId={selectedLinePeriodId}
            teamSlug={membership.team.slug}
          />
          <form action="/logout" method="post">
            <button
              type="submit"
              className="flex size-10 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="יציאה מהחשבון"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:mr-60 lg:pb-0">
        <div className="min-h-screen lg:mx-auto lg:max-w-[1180px]">{children}</div>
      </div>
      <TeamNav
        role={membership.role}
        teamSlug={membership.team.slug}
        variant="mobile"
      />
    </div>
  );
}

function roleLabel(role: TeamMembership["role"]) {
  if (role === "admin") return "מנהל מערכת";
  if (role === "manager") return "מנהל";
  return "צפייה";
}
