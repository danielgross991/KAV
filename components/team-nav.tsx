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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {items.map((item) => {
            const href = `${base}${item.href}`;
            const active = pathname === href;
            const Icon = item.icon;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium text-muted-foreground",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const active = pathname === href;
        const Icon = item.icon;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      {canManage(role) ? (
        <><Link
          href={`${base}/leave`}
          className={cn(
            "mt-3 flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            pathname === `${base}/leave` && "bg-accent text-accent-foreground",
          )}
        >
          <CalendarOff className="size-4" />
          יציאות
        </Link><Link
          href={`${base}/settings`}
          className={cn(
            "mt-3 flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            pathname === `${base}/settings` && "bg-accent text-accent-foreground",
          )}
        >
          <Settings className="size-4" />
          הגדרות
        </Link></>
      ) : null}
    </nav>
  );
}
