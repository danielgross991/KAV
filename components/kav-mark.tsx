import { cn } from "@/lib/utils";

export function KavMark({ className, loading = false }: { className?: string; loading?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-md bg-primary",
        loading && "kav-mark-loading",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute right-[9px] top-[8px] h-4 w-0.5 rounded-full bg-white/90" />
      <span className="absolute right-[14px] top-[8px] h-4 w-0.5 rounded-full bg-white/50" />
      <span className="absolute right-[19px] top-[8px] h-4 w-0.5 rounded-full bg-white/25" />
    </span>
  );
}
