import { KeyRound } from "lucide-react";

import { UpdatePasswordForm } from "@/app/account/update-password/update-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/kav/auth";

export default async function UpdatePasswordPage() {
  await requireAuth();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary !text-white">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-xl">הגדרת סיסמה חדשה</CardTitle>
          <CardDescription>בחר סיסמה חדשה לחשבון KAV שלך.</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
