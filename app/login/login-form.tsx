"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword, type LoginState } from "@/app/login/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInWithPassword,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
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
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">סיסמה</Label>
          <Link className="text-sm text-primary hover:underline" href="/forgot-password">
            שכחת סיסמה?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        <LogIn className="size-4" />
        {pending ? "נכנס..." : "כניסה"}
      </Button>
    </form>
  );
}
