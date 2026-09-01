import { KavMark } from "@/components/kav-mark";
import { cn } from "@/lib/utils";

export function KavLoading({ compact = false, label = "טוען נתונים" }: { compact?: boolean; label?: string }) {
  return (
    <div
      className={cn(
        "grid w-full place-items-center px-6 text-center",
        compact ? "min-h-48 bg-background/80 py-10 backdrop-blur-sm" : "fixed inset-0 z-50 min-h-screen bg-background/15 backdrop-blur-[1px]",
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="grid w-full max-w-xs place-items-center">
        <KavMark className="size-20 rounded-2xl shadow-lg shadow-primary/20 sm:size-24" loading />
      </div>
    </div>
  );
}

export function KavPageSkeleton({ rows = 5, title = "טוען מסך" }: { rows?: number; title?: string }) {
  void rows;

  return <KavLoading label={title} />;
}
