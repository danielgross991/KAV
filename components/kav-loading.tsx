import { KavMark } from "@/components/kav-mark";
import { cn } from "@/lib/utils";

export function KavLoading({ compact = false, label = "טוען נתונים" }: { compact?: boolean; label?: string }) {
  return (
    <div
      className={cn(
        "grid w-full place-items-center bg-background/92 px-6 text-center backdrop-blur-sm",
        compact ? "min-h-48 py-10" : "fixed inset-0 z-50 min-h-screen",
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5">
        <KavMark className="size-20 rounded-2xl shadow-lg shadow-primary/20 sm:size-24" loading />
        <div>
          <p className="text-base font-bold text-foreground sm:text-lg">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">KAV מכין את התצוגה</p>
        </div>
        <div className="grid w-32 gap-2">
          <span className="h-2 animate-pulse rounded-full bg-primary/35" />
          <span className="mx-auto h-2 w-2/3 animate-pulse rounded-full bg-primary/20" />
        </div>
      </div>
    </div>
  );
}

export function KavPageSkeleton({ rows = 5, title = "טוען מסך" }: { rows?: number; title?: string }) {
  void rows;

  return <KavLoading label={title} />;
}
