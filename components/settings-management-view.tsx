import {
  createEquipmentTypeAction,
  updateEquipmentTypeAction,
  updateRequirementAction,
  upsertPakalTypeAction,
} from "@/app/[teamSlug]/team/actions";
import { AppPage, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentType, PakalType, TeamManagementData } from "@/lib/kav/team-management";

const equipmentCategoryLabels: Record<EquipmentType["category"], string> = {
  WEAPON: "נשק",
  OPTIC: "כוונת",
  AMRAL: "אמר״ל",
  PAKAL: "פק״ל",
  OTHER: "אחר",
};
const equipmentCategoryOrder: EquipmentType["category"][] = ["WEAPON", "OPTIC", "AMRAL", "PAKAL", "OTHER"];

export function SettingsManagementView({
  data,
  equipmentTypes,
  saved,
}: {
  data: TeamManagementData;
  equipmentTypes: EquipmentType[];
  saved?: string;
}) {
  const createPakal = upsertPakalTypeAction.bind(null, data.team.slug);
  const updateRequirement = updateRequirementAction.bind(null, data.team.slug);
  const createEquipmentType = createEquipmentTypeAction.bind(null, data.team.slug);

  return (
    <AppPage>
      <PageHeader eyebrow={data.team.name} title="הגדרות צוות" subtitle="ניהול פקלים, דרישות כשירות וסוגי ציוד לצוות." action={saved ? <Badge variant="success">{savedLabel(saved)}</Badge> : null} />

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>פקלים קיימים</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pakalTypes.length === 0 ? (
              <EmptyState title="אין פקלים" description="אפשר להוסיף פקל חדש מהטופס בצד." />
            ) : (
              <div className="grid gap-3">
                {data.pakalTypes.map((pakal) => (
                  <PakalTypeForm key={pakal.id} pakal={pakal} teamSlug={data.team.slug} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>פקל חדש</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createPakal} className="grid gap-3">
                <Field label="שם פקל" name="name" required />
                <TextArea label="תיאור" name="description" />
                <label className="flex items-center gap-2 text-sm">
                  <input name="is_active" type="checkbox" defaultChecked />
                  פעיל
                </label>
                <Button type="submit">שמירת פקל</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>סוג ציוד חדש</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createEquipmentType} className="grid gap-3">
                <Field label="שם סוג ציוד" name="name" required />
                <CategorySelect />
                <label className="flex items-center gap-2 text-sm">
                  <input name="serial_required" type="checkbox" />
                  נדרש מספר סידורי
                </label>
                <Button type="submit">הוספת סוג ציוד</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>דרישות כשירות</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pakalTypes.length === 0 ? (
              <EmptyState title="אין דרישות" description="יש להגדיר פקלים לפני קביעת דרישות." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.pakalTypes.map((pakal) => (
                  <form
                    key={pakal.id}
                    action={updateRequirement}
                    className="rounded-lg border p-3"
                  >
                    <input name="pakal_type_id" type="hidden" value={pakal.id} />
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{pakal.name}</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          בפועל {pakal.assignedCount}
                        </p>
                      </div>
                      <Badge
                        variant={pakal.assignedCount >= pakal.requiredCount ? "success" : "warning"}
                      >
                        {pakal.assignedCount}/{pakal.requiredCount}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        aria-label={`דרישה עבור ${pakal.name}`}
                        defaultValue={pakal.requiredCount}
                        min={0}
                        name="required_count"
                        type="number"
                      />
                      <Button type="submit" variant="outline">
                        שמירה
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>סוגי ציוד</CardTitle>
          </CardHeader>
          <CardContent>
            {equipmentTypes.length === 0 ? (
              <EmptyState title="אין סוגי ציוד" description="הוספת סוג ציוד תאפשר שיוך ציוד בפרופיל איש צוות." />
            ) : (
              <div className="grid gap-4">
                {equipmentCategoryOrder.flatMap((category) => {
                  const items = equipmentTypes.filter((type) => type.category === category);
                  if (!items.length) return [];
                  return (
                    <div key={category}>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        {equipmentCategoryLabels[category]}
                      </p>
                      <div className="grid gap-2">
                        {items.map((type) => (
                          <EquipmentTypeForm key={type.id} teamSlug={data.team.slug} type={type} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppPage>
  );
}

function EquipmentTypeForm({ teamSlug, type }: { teamSlug: string; type: EquipmentType }) {
  const save = updateEquipmentTypeAction.bind(null, teamSlug, type.id);

  return (
    <details className="rounded-lg border p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <div>
          <div className="font-medium">{type.name}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {type.serial_required ? "דורש מספר סידורי" : "מספר סידורי אופציונלי"}
          </p>
        </div>
        <Badge variant={type.is_active ? "success" : "muted"}>
          {type.is_active ? "פעיל" : "לא פעיל"}
        </Badge>
      </summary>
      <form action={save} className="mt-4 grid gap-3 border-t pt-4">
        <Field defaultValue={type.name} label="שם סוג ציוד" name="name" required />
        <CategorySelect defaultValue={type.category} />
        <label className="flex items-center gap-2 text-sm">
          <input name="serial_required" type="checkbox" defaultChecked={type.serial_required} />
          נדרש מספר סידורי
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked={type.is_active} />
          פעיל
        </label>
        <Button type="submit">שמירה</Button>
      </form>
    </details>
  );
}

function PakalTypeForm({ pakal, teamSlug }: { pakal: PakalType; teamSlug: string }) {
  const save = upsertPakalTypeAction.bind(null, teamSlug);

  return (
    <details className="rounded-lg border p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="font-medium">{pakal.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {pakal.description || "אין תיאור"}
          </p>
        </div>
        <Badge variant={pakal.is_active ? "success" : "muted"}>
          {pakal.is_active ? "פעיל" : "לא פעיל"}
        </Badge>
      </summary>
      <form action={save} className="mt-4 grid gap-3 border-t pt-4">
        <input name="id" type="hidden" value={pakal.id} />
        <Field defaultValue={pakal.name} label="שם פקל" name="name" required />
        <TextArea defaultValue={pakal.description ?? ""} label="תיאור" name="description" />
        <label className="flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked={pakal.is_active} />
          פעיל
        </label>
        <Button type="submit">שמירה</Button>
      </form>
    </details>
  );
}

function CategorySelect({ defaultValue }: { defaultValue?: EquipmentType["category"] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="category">קטגוריית ציוד</Label>
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue ?? "OTHER"}
        id="category"
        name="category"
      >
        {equipmentCategoryOrder.map((category) => (
          <option key={category} value={category}>
            {equipmentCategoryLabels[category]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input defaultValue={defaultValue} id={name} name={name} required={required} />
    </div>
  );
}

function TextArea({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        id={name}
        name={name}
      />
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-sm">
      <div className="font-medium">{title}</div>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function savedLabel(saved: string) {
  const labels: Record<string, string> = {
    "equipment-type": "סוג הציוד נוסף",
    "equipment-type-updated": "סוג הציוד נשמר",
    "pakal-type": "הפקל נשמר",
    requirement: "דרישת הכשירות נשמרה",
  };

  return labels[saved] ?? "נשמר";
}
