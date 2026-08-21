"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import { requestPasswordReset, type ForgotPasswordState } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">אימייל</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          required
        />
      </div>
      {state.message ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        <Mail className="size-4" />
        {pending ? "שולח..." : "שלח קישור"}
      </Button>
    </form>
  );
}
