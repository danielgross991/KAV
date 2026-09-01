"use client";

import Link from "next/link";
import { CalendarDays, CalendarOff, ClipboardList, Home, PackageCheck, Settings, UsersRound, UserCheck, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { KavLoading } from "@/components/kav-loading";
import { KavMark } from "@/components/kav-mark";
import { cn } from "@/lib/utils";
import { canManage, type TeamRole } from "@/lib/kav/teams";

const managerItems = [
  { href: "", label: "בית", icon: Home },
  { href: "/schedule", label: "לו״ז", icon: CalendarDays },
  { href: "/tasks", label: "משימות", icon: ClipboardList },
  { href: "/attendance", label: "נוכחות", icon: UserCheck },
  { href: "/team", label: "צוות", icon: UsersRound },
];

const viewerItems = [
  { href: "", label: "בית", icon: Home },
  { href: "/schedule", label: "לו״ז", icon: CalendarDays },
  { href: "/leave", label: "בקשות", icon: CalendarOff },
  { href: "/equipment", label: "ציוד", icon: PackageCheck },
];

export function TeamNav({
  role,
  teamSlug,
  variant,
}: {
  role: TeamRole;
  teamSlug: string;
  variant: "desktop" | "mobile";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const items = canManage(role) ? managerItems : viewerItems;
  const base = `/${teamSlug}`;
  const showRouteLoading = pendingHref !== null && !isActivePath(pathname, pendingHref, base);

  useEffect(() => {
    const routeHrefs = [
      ...items.map((item) => `${base}${item.href}`),
      ...(canManage(role) ? [`${base}/leave`, `${base}/settings`, ...(role === "admin" ? [`${base}/users`] : [])] : []),
    ];

    routeHrefs.forEach((href) => router.prefetch(href));
  }, [base, items, role, router]);

  if (variant === "mobile") {
    return (
      <>
        {showRouteLoading ? <KavLoading label="טוען מסך" /> : null}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-md lg:hidden" aria-label="ניווט ראשי">
          <div className="mx-auto flex max-w-md items-stretch px-1">
            {items.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.href === "" ? pathname === href : pathname.startsWith(href);
              const pending = pendingHref === href && !active;
              const Icon = item.icon;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (!active) setPendingHref(href);
                  }}
                  className={cn(
                    "relative flex h-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                    active && "bg-accent font-semibold text-primary",
                    pending && "text-primary",
                  )}
                >
                  <span className={cn("absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity", active || pending ? "opacity-100" : "opacity-0")} />
                  {pending ? <KavMark className="size-[19px] rounded-[0.3rem]" loading /> : <Icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.8} />}
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </>
    );
  }

  return (
    <>
      {showRouteLoading ? <KavLoading label="טוען מסך" /> : null}
      <nav className="grid gap-0.5" aria-label="ניווט ראשי">
        {items.map((item) => <DesktopNavItem
          active={item.href === "" ? pathname === `${base}${item.href}` : pathname.startsWith(`${base}${item.href}`)}
          href={`${base}${item.href}`}
          icon={item.icon}
          key={`${base}${item.href}`}
          label={item.label}
          pending={pendingHref === `${base}${item.href}`}
          setPendingHref={setPendingHref}
        />)}
        {canManage(role) ? (
          <div className="mt-3 border-t pt-3"><Link
            href={`${base}/leave`}
            aria-current={pathname.startsWith(`${base}/leave`) ? "page" : undefined}
            onClick={() => {
              if (!pathname.startsWith(`${base}/leave`)) setPendingHref(`${base}/leave`);
            }}
            className={cn(
              "relative flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              pathname.startsWith(`${base}/leave`) && "bg-accent text-primary",
              pendingHref === `${base}/leave` && !pathname.startsWith(`${base}/leave`) && "text-primary",
            )}
          >
            <ActiveRail active={pathname.startsWith(`${base}/leave`) || pendingHref === `${base}/leave`} />
            {pendingHref === `${base}/leave` && !pathname.startsWith(`${base}/leave`) ? <KavMark className="size-4 rounded-[0.25rem]" loading /> : <CalendarOff className="size-4" />}
            יציאות
          </Link><Link
            href={`${base}/settings`}
            aria-current={pathname.startsWith(`${base}/settings`) ? "page" : undefined}
            onClick={() => {
              if (!pathname.startsWith(`${base}/settings`)) setPendingHref(`${base}/settings`);
            }}
            className={cn(
              "relative flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              pathname.startsWith(`${base}/settings`) && "bg-accent text-primary",
              pendingHref === `${base}/settings` && !pathname.startsWith(`${base}/settings`) && "text-primary",
            )}
          >
            <ActiveRail active={pathname.startsWith(`${base}/settings`) || pendingHref === `${base}/settings`} />
            {pendingHref === `${base}/settings` && !pathname.startsWith(`${base}/settings`) ? <KavMark className="size-4 rounded-[0.25rem]" loading /> : <Settings className="size-4" />}
            הגדרות
          </Link>{role === "admin" ? <Link
            href={`${base}/users`}
            aria-current={pathname.startsWith(`${base}/users`) ? "page" : undefined}
            onClick={() => {
              if (!pathname.startsWith(`${base}/users`)) setPendingHref(`${base}/users`);
            }}
            className={cn(
              "relative flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              pathname.startsWith(`${base}/users`) && "bg-accent text-primary",
              pendingHref === `${base}/users` && !pathname.startsWith(`${base}/users`) && "text-primary",
            )}
          >
            <ActiveRail active={pathname.startsWith(`${base}/users`) || pendingHref === `${base}/users`} />
            {pendingHref === `${base}/users` && !pathname.startsWith(`${base}/users`) ? <KavMark className="size-4 rounded-[0.25rem]" loading /> : <UsersRound className="size-4" />}
            משתמשים
          </Link> : null}</div>
        ) : null}
      </nav>
    </>
  );
}

function isActivePath(pathname: string, href: string, base: string) {
  return href === base ? pathname === href : pathname.startsWith(href);
}

function DesktopNavItem({
  active,
  href,
  icon: Icon,
  label,
  pending,
  setPendingHref,
}: {
  active: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  pending: boolean;
  setPendingHref: (href: string | null) => void;
}) {
  const showingPending = pending && !active;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={() => {
        if (!active) setPendingHref(href);
      }}
      className={cn(
        "relative flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active && "bg-accent text-primary",
        showingPending && "text-primary",
      )}
    >
      <ActiveRail active={active || showingPending} />
      {showingPending ? <KavMark className="size-4 rounded-[0.25rem]" loading /> : <Icon className="size-4" />}
      {label}
    </Link>
  );
}

function ActiveRail({ active }: { active: boolean }) {
  return <span className={cn("absolute inset-y-2 right-0 w-0.5 rounded-full bg-primary transition-opacity", active ? "opacity-100" : "opacity-0")} />;
}
