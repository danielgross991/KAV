"use client";

import Link from "next/link";
import { CalendarDays, CalendarOff, ClipboardList, Home, Settings, UsersRound, UserCheck } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { canManage, type TeamRole } from "@/lib/kav/teams";

const managerItems = [
  { href: "", label: "בית", icon: Home },
  { href: "/schedule", label: "לו״ז", icon: CalendarDays },
  { href: "/tasks", label: "משימות", icon: ClipboardList },
  { href: "/attendance", label: "נוכחות", icon: UserCheck },
  { href: "/team", label: "צוות", icon: UsersRound },
];

const viewerItems = managerItems.filter((item) => item.href !== "/attendance");

export function TeamNav({
  role,
  teamSlug,
  variant,
}: {
  role: TeamRole;
  teamSlug: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const items = canManage(role) ? managerItems : viewerItems;
  const base = `/${teamSlug}`;

  if (variant === "mobile") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-md lg:hidden" aria-label="ניווט ראשי">
        <div className="mx-auto flex max-w-md items-stretch px-1">
          {items.map((item) => {
            const href = `${base}${item.href}`;
            const active = item.href === "" ? pathname === href : pathname.startsWith(href);
            const Icon = item.icon;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                  active && "font-semibold text-primary",
                )}
              >
                <span className={cn("absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity", active ? "opacity-100" : "opacity-0")} />
                <Icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    );
  }

  return (
    <nav className="grid gap-0.5" aria-label="ניווט ראשי">
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.href === "" ? pathname === href : pathname.startsWith(href);
        const Icon = item.icon;

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active && "bg-accent text-primary",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      {canManage(role) ? (
        <div className="mt-3 border-t pt-3"><Link
          href={`${base}/leave`}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            pathname.startsWith(`${base}/leave`) && "bg-accent text-primary",
          )}
        >
          <CalendarOff className="size-4" />
          יציאות
        </Link><Link
          href={`${base}/settings`}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            pathname.startsWith(`${base}/settings`) && "bg-accent text-primary",
          )}
        >
          <Settings className="size-4" />
          הגדרות
        </Link></div>
      ) : null}
    </nav>
  );
}
