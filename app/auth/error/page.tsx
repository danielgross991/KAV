import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>הקישור לא תקין</CardTitle>
          <CardDescription>
            ייתכן שפג תוקף הקישור או שכבר נעשה בו שימוש.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className={buttonVariants()} href="/login">
            חזרה להתחברות
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
