"use client";

import { useActionState, useState } from "react";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmailOnly, signInWithPassword, type LoginState } from "@/app/login/actions";

export function LoginForm({ next }: { next: string }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [viewerState, viewerAction, viewerPending] = useActionState<LoginState, FormData>(
    signInWithEmailOnly,
    {},
  );
  const [adminState, adminAction, adminPending] = useActionState<LoginState, FormData>(signInWithPassword, {});

  return (
    <div className="grid gap-5">
      <form action={viewerAction} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-2">
          <Label htmlFor="viewer-email">אימייל</Label>
          <Input
            id="viewer-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            required
          />
        </div>
        <LoginMessage state={viewerState} />
        <Button type="submit" className="h-11 w-full" disabled={viewerPending}>
          <LogIn className="size-4" />
          {viewerPending ? "נכנס..." : "כניסה"}
        </Button>
      </form>

      <div className="border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAdminOpen((open) => !open)}
          aria-expanded={adminOpen}
        >
          <ShieldCheck className="size-3.5" />
          כניסת מנהל
        </Button>

        {adminOpen ? (
          <form action={adminAction} className="mt-3 grid gap-3 rounded-md border bg-muted/35 p-3">
            <input type="hidden" name="next" value={next} />
            <div className="grid gap-2">
              <Label htmlFor="admin-email">שם משתמש</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-password">סיסמה</Label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <LoginMessage state={adminState} />
            <Button type="submit" variant="secondary" className="h-10 w-full" disabled={adminPending}>
              <KeyRound className="size-4" />
              {adminPending ? "בודק..." : "כניסת מנהל"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function LoginMessage({ state }: { state: LoginState }) {
  if (!state.message) return null;

  return (
    <p
      className={
        state.ok
          ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      }
    >
      {state.message}
    </p>
  );
}
