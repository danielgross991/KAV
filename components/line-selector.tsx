"use client";

import { MapPin } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { setSelectedLineAction } from "@/app/[teamSlug]/line/actions";
import { DEFAULT_LINE_VALUE } from "@/lib/kav/line-selection";
import { cn } from "@/lib/utils";

type LineOption = {
  endsOn: string;
  id: string;
  location: string | null;
  name: string;
  startsOn: string;
  status: string;
};

export function LineSelector({
  className,
  id,
  options,
  selectedPeriodId,
  teamSlug,
}: {
  className?: string;
  id: string;
  options: LineOption[];
  selectedPeriodId: string | null;
  teamSlug: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!options.length) return null;

  const next = nextPath(pathname, searchParams);
  const action = setSelectedLineAction.bind(null, teamSlug);
  const selectedValue = options.some((option) => option.id === selectedPeriodId)
    ? selectedPeriodId!
    : DEFAULT_LINE_VALUE;

  return (
    <form action={action} className={cn("grid gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <input type="hidden" name="next" value={next} />
      <label className="flex items-center gap-1.5" htmlFor={id}>
        <MapPin className="size-3.5" />
        בחירת קו
      </label>
      <select
        id={id}
        name="period_id"
        defaultValue={selectedValue}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <option value={DEFAULT_LINE_VALUE}>קו תפעולי נוכחי</option>
        {options.map((period) => (
          <option key={period.id} value={period.id}>
            {period.location ? `${period.location} · ` : ""}
            {period.name}
          </option>
        ))}
      </select>
    </form>
  );
}

function nextPath(pathname: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("period");
  params.delete("statsPeriod");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
