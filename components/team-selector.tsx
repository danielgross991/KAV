import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamMembership } from "@/lib/kav/teams";

export function TeamSelector({
  memberships,
}: {
  memberships: (TeamMembership & { activePeople: number })[];
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">KAV</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal">בחירת צוות</h1>
        </div>
        <form action="/logout" method="post">
          <button className={buttonVariants({ variant: "outline" })} type="submit">
            יציאה
          </button>
        </form>
      </header>
      {memberships.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ activePeople, role, team }) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{team.name}</CardTitle>
                  <Badge variant="secondary">{roleLabel(role)}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>{activePeople} אנשי צוות פעילים</span>
                </div>
                <Link
                  className={buttonVariants({ className: "w-full" })}
                  href={`/${team.slug}`}
                >
                  כניסה לצוות
                  <ArrowLeft className="size-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>אין צוותים זמינים לחשבון הזה</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            המשתמש מחובר, אבל לא קיימת עבורו רשומת חברות פעילה בטבלת
            team_memberships.
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function roleLabel(role: TeamMembership["role"]) {
  if (role === "admin") return "מנהל מערכת";
  if (role === "manager") return "מנהל";
  return "צפייה";
}
