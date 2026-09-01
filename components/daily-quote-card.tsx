"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

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
        <form ref={formRef} action={formAction} className="mt-3 grid gap-2">
          <label className="grid gap-1.5 text-sm font-medium">
            הצע משפט יומי
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={220}
              name="text"
              placeholder="כתוב כאן משפט קצר"
            />
          </label>
          {state.message ? (
            <p
              className={state.ok ? "rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success" : "rounded-md bg-warning-soft px-3 py-2 text-sm font-medium text-warning"}
              role="status"
            >
              {state.message}
            </p>
          ) : null}
          <Button className="justify-self-start" disabled={pending} type="submit">
            <Send className="size-4" />
            {pending ? "שולח" : "הגש"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
