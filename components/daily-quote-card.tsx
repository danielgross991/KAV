"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  submitDailyQuoteSuggestionAction,
  type DailyQuoteSubmitState,
} from "@/app/[teamSlug]/quotes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: DailyQuoteSubmitState = {};

export function DailyQuoteCard({
  quote,
  teamSlug,
}: {
  quote: { id: string; text: string } | null;
  teamSlug: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DailyQuoteSubmitState, FormData>(
    submitDailyQuoteSuggestionAction.bind(null, teamSlug),
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>המשפט היומי</CardTitle>
      </CardHeader>
      <CardContent>
        <blockquote className="rounded-lg bg-accent px-4 py-3 text-lg font-bold leading-8 text-primary">
          {quote?.text ?? "עוד לא הוגדר משפט יומי."}
        </blockquote>
        <div className="mt-3">
          <Button
            aria-expanded={open}
            className="h-8 px-2.5 text-xs"
            onClick={() => setOpen((value) => !value)}
            type="button"
            variant="outline"
          >
            <MessageSquarePlus className="size-3.5" />
            הצע משפט יומי
          </Button>
        </div>
        {open ? (
          <form ref={formRef} action={formAction} className="kav-panel-enter mt-3 grid gap-2">
            <label className="grid gap-1.5 text-sm font-medium">
              משפט מוצע
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={220}
                name="text"
                placeholder="כתוב כאן משפט קצר"
              />
            </label>
            <Button className="justify-self-start" disabled={pending} type="submit">
              <Send className="size-4" />
              {pending ? "שולח" : "הגש"}
            </Button>
          </form>
        ) : null}
        {state.message ? (
          <p
            className={state.ok ? "mt-3 rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success" : "mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm font-medium text-warning"}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
