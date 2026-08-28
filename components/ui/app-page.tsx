import { CheckCircle2, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppPage({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main className={cn("kav-page", className)} {...props}>
      {children}
    </main>
  );
}

export function PageHeader({
  action,
  children,
  eyebrow,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <header className="kav-page-header">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</div> : null}
          <h1 className="text-[1.35rem] font-bold leading-7 text-foreground">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export function SectionHeader({
  action,
  className,
  hint,
  title,
}: {
  action?: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="kav-section-title">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  description,
  icon,
  title,
}: {
  description?: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className="grid min-h-36 place-items-center border-y px-4 py-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon ?? <Inbox className="size-4" />}
        </span>
        <h2 className="mt-3 text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

export function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex items-center gap-2 rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success">
      <CheckCircle2 className="size-4 shrink-0" />
      {children}
    </div>
  );
}
