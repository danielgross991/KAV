import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";

import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";

type UsersPageProps = {
  params: Promise<{ teamSlug: string }>;
};

export default async function UsersPage({ params }: UsersPageProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);

  if (membership.role !== "admin") {
    redirect(`/${teamSlug}`);
  }

  const [{ data: memberships, error: membershipsError }, { data: people, error: peopleError }] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("id, user_id, role, is_active")
      .eq("team_id", membership.team.id)
      .order("role", { ascending: true }),
    supabase
      .from("people")
      .select("id, auth_user_id, full_name, email, is_active")
      .eq("team_id", membership.team.id)
      .order("display_order")
      .order("full_name"),
  ]);

  if (membershipsError) throw new Error(`לא ניתן לטעון משתמשים: ${membershipsError.message}`);
  if (peopleError) throw new Error(`לא ניתן לטעון אנשי צוות: ${peopleError.message}`);

  const personByAuthId = new Map((people ?? [])
    .filter((person) => person.auth_user_id)
    .map((person) => [person.auth_user_id!, person]));

  return (
    <AppPage>
      <PageHeader
        eyebrow={membership.team.name}
        title="ניהול משתמשים"
        subtitle="תצוגת אדמין של חשבונות, תפקידים וקישור לאיש צוות. שינוי הרשאות יתווסף אחרי שנגדיר את מודל ה-viewer."
      />

      {(memberships ?? []).length === 0 ? (
        <EmptyState icon={<UserCog className="size-4" />} title="אין משתמשים משויכים לצוות" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">איש צוות</th>
                    <th className="px-4 py-3 font-medium">אימייל</th>
                    <th className="px-4 py-3 font-medium">תפקיד</th>
                    <th className="px-4 py-3 font-medium">סטטוס משתמש</th>
                    <th className="px-4 py-3 font-medium">User ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(memberships ?? []).map((item) => {
                    const person = personByAuthId.get(item.user_id);
                    return (
                      <tr key={item.id} className="hover:bg-muted/35">
                        <td className="px-4 py-3 font-medium">
                          {person ? <Link className="text-primary hover:underline" href={`/${teamSlug}/team/${person.id}`}>{person.full_name}</Link> : "לא משויך לאיש צוות"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{person?.email ?? "לא מוגדר"}</td>
                        <td className="px-4 py-3"><RoleBadge role={item.role} /></td>
                        <td className="px-4 py-3"><Badge variant={item.is_active ? "success" : "muted"}>{item.is_active ? "פעיל" : "לא פעיל"}</Badge></td>
                        <td className="kav-num px-4 py-3 text-xs text-muted-foreground">{shortId(item.user_id)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 p-3 md:hidden">
              {(memberships ?? []).map((item) => {
                const person = personByAuthId.get(item.user_id);
                return (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{person?.full_name ?? "לא משויך לאיש צוות"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{person?.email ?? shortId(item.user_id)}</p>
                      </div>
                      <RoleBadge role={item.role} />
                    </div>
                    <Badge className="mt-3" variant={item.is_active ? "success" : "muted"}>{item.is_active ? "פעיל" : "לא פעיל"}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </AppPage>
  );
}

function RoleBadge({ role }: { role: "admin" | "manager" | "viewer" }) {
  if (role === "admin") return <Badge variant="special">אדמין</Badge>;
  if (role === "manager") return <Badge variant="info">מנהל</Badge>;
  return <Badge variant="secondary">צופה</Badge>;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
