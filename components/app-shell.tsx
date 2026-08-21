import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { TeamNav } from "@/components/team-nav";
import type { TeamMembership } from "@/lib/kav/teams";

export function AppShell({
  children,
  membership,
}: {
  children: React.ReactNode;
  membership: TeamMembership;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 hidden w-64 border-l bg-card px-4 py-5 lg:block">
        <Link href={`/${membership.team.slug}`} className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="text-xl font-bold">KAV</span>
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold">{membership.team.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{roleLabel(membership.role)}</p>
        </div>
        <Separator className="my-5" />
        <TeamNav
          role={membership.role}
          teamSlug={membership.team.slug}
          variant="desktop"
        />
        <div className="absolute bottom-5 right-4 left-4">
          <Link
            href="/logout"
            className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-4" />
            יציאה
          </Link>
        </div>
      </aside>
      <div className="pb-20 lg:mr-64 lg:pb-0">
        <div className="min-h-screen">{children}</div>
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
