import Link from "next/link";
import { KeyRound } from "lucide-react";

import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary !text-white">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-xl">איפוס סיסמה</CardTitle>
          <CardDescription>
            הזן את כתובת האימייל שלך ונשלח אליך קישור להגדרת סיסמה חדשה.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ForgotPasswordForm />
          <Link className="text-center text-sm text-primary hover:underline" href="/login">
            חזרה להתחברות
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
