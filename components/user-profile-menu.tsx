"use client";

import Link from "next/link";
import { ClipboardList, PackageCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { KavMark } from "@/components/kav-mark";
import { cn } from "@/lib/utils";

export type ShellPersonProfile = {
  full_name: string;
  id: string;
  photo_url: string | null;
};

export function InitialProfileWelcome({
  profile,
}: {
  profile: ShellPersonProfile | null;
}) {
  const [visible, setVisible] = useState(Boolean(profile));

  useEffect(() => {
    if (!profile) return;
    const timeout = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [profile]);

  if (!profile || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-background/70 px-6 text-center backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={`ברוך הבא ${profile.full_name}`}
    >
      <div className="grid place-items-center gap-4">
        <ProfileAvatar
          className="size-28 border-4 border-card shadow-xl shadow-primary/15"
          name={profile.full_name}
          photoUrl={profile.photo_url}
        />
        <div>
          <p className="text-sm font-medium text-muted-foreground">ברוך הבא</p>
          <h1 className="mt-1 text-2xl font-bold">{firstName(profile.full_name)}</h1>
        </div>
        <KavMark className="size-10 rounded-lg" loading />
      </div>
    </div>
  );
}

export function UserProfileMenu({
  profile,
  teamSlug,
  variant = "mobile",
}: {
  profile: ShellPersonProfile | null;
  teamSlug: string;
  variant?: "desktop" | "mobile";
}) {
  if (!profile) return null;

  return (
    <details className={cn("group relative", variant === "desktop" && "mt-3")}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-md border bg-background text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden",
          variant === "desktop" ? "min-h-12 px-2.5 py-2" : "size-10 justify-center p-1",
        )}
        aria-label="פתיחת אזור אישי"
      >
        <ProfileAvatar
          className={variant === "desktop" ? "size-9" : "size-8"}
          name={profile.full_name}
          photoUrl={profile.photo_url}
        />
        {variant === "desktop" ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profile.full_name}</span>
            <span className="block truncate text-xs text-muted-foreground">האזור האישי</span>
          </span>
        ) : null}
      </summary>
      <div
        className={cn(
          "absolute z-50 w-56 overflow-hidden rounded-lg border bg-card p-1.5 shadow-xl shadow-black/10",
          variant === "desktop" ? "bottom-full right-0 mb-2" : "left-0 top-12",
        )}
      >
        <ProfileMenuLink href={`/${teamSlug}/team/${profile.id}`} icon={<UserRound className="size-4" />}>
          האזור האישי
        </ProfileMenuLink>
        <ProfileMenuLink href={`/${teamSlug}/leave`} icon={<ClipboardList className="size-4" />}>
          הבקשות שלי
        </ProfileMenuLink>
        <ProfileMenuLink href={`/${teamSlug}/equipment`} icon={<PackageCheck className="size-4" />}>
          הציוד שלי
        </ProfileMenuLink>
      </div>
    </details>
  );
}

function ProfileMenuLink({
  children,
  href,
  icon,
}: {
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      className="flex h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      href={href}
    >
      {icon}
      {children}
    </Link>
  );
}

function ProfileAvatar({
  className,
  name,
  photoUrl,
}: {
  className?: string;
  name: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      <span
        aria-label={name}
        className={cn("block shrink-0 rounded-full border bg-cover bg-center", className)}
        style={{ backgroundImage: `url(${photoUrl})` }}
      />
    );
  }

  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full border bg-accent text-accent-foreground", className)}>
      <UserRound className="size-5" />
    </span>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
