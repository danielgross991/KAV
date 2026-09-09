"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { createViewerLeaveRequestStateAction, type ViewerLeaveRequestState } from "@/app/[teamSlug]/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ViewerLeaveRequestForm({
  className,
  periodOptions,
  selectedPeriodId,
  teamSlug,
}: {
  className?: string;
  periodOptions: { id: string; name: string }[];
  selectedPeriodId: string | null;
  teamSlug: string;
}) {
  const [state, action, pending] = useActionState<ViewerLeaveRequestState, FormData>(
    createViewerLeaveRequestStateAction.bind(null, teamSlug),
    {},
  );

  return (
    <form action={action} className={className ?? "grid gap-3 md:grid-cols-4"}>
      <PeriodInput options={periodOptions} selectedPeriodId={selectedPeriodId} />
      <Field label="מתאריך" name="starts_on" type="date" required />
      <Field label="עד תאריך" name="ends_on" type="date" required />
      <Field label="סיבה" name="reason" />
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-destructive md:col-span-4" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button className="self-end" disabled={pending}>
        <Plus className="size-4" />
        {pending ? "שולח..." : "שליחת בקשה"}
      </Button>
    </form>
  );
}

function Field({ label, ...props }: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <Input {...props} />
    </label>
  );
}

function PeriodInput({
  options,
  selectedPeriodId,
}: {
  options: { id: string; name: string }[];
  selectedPeriodId: string | null;
}) {
  if (selectedPeriodId) return <input name="reserve_period_id" type="hidden" value={selectedPeriodId} />;

  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      תקופת מילואים
      <select className="h-10 rounded-md border bg-background px-2 text-sm" name="reserve_period_id" required>
        {options.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name}
          </option>
        ))}
      </select>
    </label>
  );
}
