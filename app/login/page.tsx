import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/app/login/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next = "/" } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          KAV
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">כניסה למערכת</CardTitle>
            <CardDescription>
              הזן אימייל וסיסמה כדי להיכנס לחשבון KAV שלך.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={next} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
