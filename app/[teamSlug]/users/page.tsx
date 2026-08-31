import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageUp, MailPlus, UserCog, UserRound } from "lucide-react";

import { provisionPersonLoginAction, updatePersonPhotoAction } from "@/app/[teamSlug]/users/actions";
import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";

type UsersPageProps = {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ linked?: string; photo?: string }>;
};

export default async function UsersPage({ params, searchParams }: UsersPageProps) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
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
      .select("id, auth_user_id, full_name, email, is_active, photo_url")
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
        subtitle="קישור מייל לאיש צוות ופתיחת כניסה אישית ללא סיסמה."
      />
      {query.linked ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">המייל קושר והמשתמש יכול להיכנס בקישור אימייל.</p> : null}
      {query.photo ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">תמונת איש הצוות נשמרה.</p> : null}

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

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">כניסה לפי מייל לאנשי צוות</h2>
          <Badge variant="outline">{(people ?? []).length} אנשי צוות</Badge>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {(people ?? []).map((person) => {
              const membershipItem = person.auth_user_id
                ? (memberships ?? []).find((item) => item.user_id === person.auth_user_id)
                : null;
              return (
                <form
                  action={provisionPersonLoginAction.bind(null, teamSlug)}
                  className="grid gap-3 p-3.5 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-center"
                  key={person.id}
                >
                  <input type="hidden" name="person_id" value={person.id} />
                  <div className="min-w-0">
                    <Link className="font-semibold text-primary hover:underline" href={`/${teamSlug}/team/${person.id}`}>
                      {person.full_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant={person.is_active ? "success" : "muted"}>{person.is_active ? "פעיל" : "לא פעיל"}</Badge>
                      {membershipItem ? <RoleBadge role={membershipItem.role} /> : <Badge variant="outline">ללא כניסה</Badge>}
                    </div>
                  </div>
                  <Input
                    aria-label={`אימייל עבור ${person.full_name}`}
                    name="email"
                    type="email"
                    defaultValue={person.email ?? ""}
                    placeholder="name@example.com"
                    required
                  />
                  <Badge variant={person.auth_user_id ? "info" : "secondary"}>
                    {person.auth_user_id ? "מקושר" : "לא מקושר"}
                  </Badge>
                  <Button>
                    <MailPlus className="size-4" />
                    הפעלת כניסה
                  </Button>
                </form>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">תמונות לאלופי הבית</h2>
          <Badge variant="outline">מוצג בפודיום</Badge>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {(people ?? []).map((person) => (
              <form
                action={updatePersonPhotoAction.bind(null, teamSlug)}
                className="grid gap-3 p-3.5 md:grid-cols-[auto_1fr_1.7fr_auto] md:items-center"
                key={person.id}
              >
                <input type="hidden" name="person_id" value={person.id} />
                {person.photo_url ? (
                  <span
                    aria-label={`תמונה של ${person.full_name}`}
                    className="block size-12 rounded-md border bg-cover bg-center"
                    style={{ backgroundImage: `url(${person.photo_url})` }}
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <UserRound className="size-5" />
                  </span>
                )}
                <Link className="font-semibold text-primary hover:underline" href={`/${teamSlug}/team/${person.id}`}>
                  {person.full_name}
                </Link>
                <Input
                  aria-label={`קישור תמונה עבור ${person.full_name}`}
                  name="photo_url"
                  type="url"
                  defaultValue={person.photo_url ?? ""}
                  placeholder="https://..."
                />
                <Button variant="secondary">
                  <ImageUp className="size-4" />
                  שמירת תמונה
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      </section>
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
