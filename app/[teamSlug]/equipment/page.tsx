import { PackageCheck } from "lucide-react";

import { AppPage, EmptyState, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/kav/auth";
import { requireTeamAccess } from "@/lib/kav/teams";

type EquipmentPageProps = {
  params: Promise<{ teamSlug: string }>;
};

const categoryLabels: Record<string, string> = {
  AMRAL: "אמר״ל",
  OPTIC: "כוונת",
  OTHER: "אחר",
  PAKAL: "פק״ל",
  WEAPON: "נשק",
};

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { teamSlug } = await params;
  const { supabase, userId } = await requireAuth();
  const membership = await requireTeamAccess(supabase, userId, teamSlug);
  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id, full_name")
    .eq("team_id", membership.team.id)
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (personError) throw new Error(`לא ניתן לטעון איש צוות: ${personError.message}`);

  const [{ data: equipment, error: equipmentError }, { data: equipmentTypes, error: equipmentTypesError }] = person
    ? await Promise.all([
        supabase
        .from("person_equipment")
        .select("id, status, serial_number, model, equipment_type_id, created_at")
        .eq("team_id", membership.team.id)
        .eq("person_id", person.id)
        .order("created_at", { ascending: false }),
        supabase
          .from("equipment_types")
          .select("id, name, category")
          .eq("team_id", membership.team.id),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (equipmentError || equipmentTypesError) throw new Error(`לא ניתן לטעון ציוד: ${equipmentError?.message ?? equipmentTypesError?.message}`);

  const typeById = new Map((equipmentTypes ?? []).map((type) => [type.id, type]));

  return (
    <AppPage className="max-w-[920px]">
      <PageHeader
        eyebrow={membership.team.name}
        title="הציוד שלי"
        subtitle={person ? person.full_name : "לא נמצא איש צוות מקושר למשתמש"}
      />
      {!person ? (
        <EmptyState icon={<PackageCheck className="size-4" />} title="אין איש צוות מקושר למשתמש שלך" description="אדמין יכול לקשר אותך דרך ניהול משתמשים." />
      ) : equipment?.length ? (
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">ציוד</th>
                    <th className="px-4 py-3 font-medium">קטגוריה</th>
                    <th className="px-4 py-3 font-medium">מספר סידורי</th>
                    <th className="px-4 py-3 font-medium">מודל</th>
                    <th className="px-4 py-3 font-medium">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {equipment.map((item) => (
                    <tr className="hover:bg-muted/35" key={item.id}>
                      <td className="px-4 py-3 font-semibold">{typeById.get(item.equipment_type_id)?.name ?? "ציוד"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{categoryLabels[typeById.get(item.equipment_type_id)?.category ?? "OTHER"]}</td>
                      <td className="kav-num px-4 py-3 text-muted-foreground">{item.serial_number ?? "לא מוגדר"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.model ?? "לא מוגדר"}</td>
                      <td className="px-4 py-3"><EquipmentStatus status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 p-3 md:hidden">
              {equipment.map((item) => (
                <div className="rounded-md border p-3" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{typeById.get(item.equipment_type_id)?.name ?? "ציוד"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{categoryLabels[typeById.get(item.equipment_type_id)?.category ?? "OTHER"]}</p>
                    </div>
                    <EquipmentStatus status={item.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>סידורי: <b className="kav-num text-foreground">{item.serial_number ?? "לא מוגדר"}</b></span>
                    <span>מודל: <b className="text-foreground">{item.model ?? "לא מוגדר"}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<PackageCheck className="size-4" />} title="לא משויך לך ציוד" />
      )}
    </AppPage>
  );
}

function EquipmentStatus({ status }: { status: string }) {
  if (status === "assigned") return <Badge variant="success">אצלי</Badge>;
  if (status === "returned") return <Badge variant="muted">הוחזר</Badge>;
  if (status === "lost") return <Badge variant="danger">אבד</Badge>;
  if (status === "damaged") return <Badge variant="warning">תקול</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
