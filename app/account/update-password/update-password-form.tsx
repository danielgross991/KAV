"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { updatePassword, type UpdatePasswordState } from "@/app/account/update-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    {},
  );

  useEffect(() => {
    if (!state.ok) return;
    const timeout = window.setTimeout(() => router.replace("/"), 900);
    return () => window.clearTimeout(timeout);
  }, [router, state.ok]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">סיסמה חדשה</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password_confirmation">אימות סיסמה</Label>
        <Input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state.message ? (
        <p className={state.ok
          ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending || state.ok}>
        <Save className="size-4" />
        {pending ? "שומר..." : "שמירת סיסמה"}
      </Button>
    </form>
  );
}
