import { KavMark } from "@/components/kav-mark";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KavLoading({ compact = false, label = "טוען נתונים" }: { compact?: boolean; label?: string }) {
  return (
    <div className={cn("grid w-full place-items-center", compact ? "py-10" : "min-h-[60vh] p-4")}>
      <Card className="w-full max-w-sm border-primary/10">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <KavMark className="size-12" loading />
          <div aria-live="polite">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">KAV מכין את התצוגה</p>
          </div>
          <div className="grid w-full gap-2">
            <span className="h-2 animate-pulse rounded-full bg-muted" />
            <span className="mx-auto h-2 w-2/3 animate-pulse rounded-full bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function KavPageSkeleton({ rows = 5, title = "טוען מסך" }: { rows?: number; title?: string }) {
  return (
    <main className="kav-page">
      <div className="kav-page-header">
        <div className="flex items-center gap-3">
          <KavMark className="size-10" loading />
          <div>
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
            <div className="mt-2 h-6 w-40 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          <span className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: rows }).map((_, index) => (
            <span key={index} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </section>
    </main>
  );
}
