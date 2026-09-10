import { decideDailyQuoteAction, saveDailyQuoteAction } from "@/app/[teamSlug]/quotes/actions";
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
import type { DailyQuote } from "@/lib/kav/daily-quotes";
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
  dailyQuotes,
  equipmentTypes,
  saved,
}: {
  data: TeamManagementData;
  dailyQuotes: DailyQuote[];
  equipmentTypes: EquipmentType[];
  saved?: string;
}) {
  const createPakal = upsertPakalTypeAction.bind(null, data.team.slug);
  const updateRequirement = updateRequirementAction.bind(null, data.team.slug);
  const createEquipmentType = createEquipmentTypeAction.bind(null, data.team.slug);
  const peopleById = new Map(data.people.map((person) => [person.id, person.full_name]));
  const pendingQuotes = dailyQuotes.filter((quote) => quote.status === "pending");
  const managedQuotes = [
    ...pendingQuotes,
    ...dailyQuotes.filter((quote) => quote.status !== "pending"),
  ];

  return (
    <AppPage>
      <PageHeader eyebrow={data.team.name} title="הגדרות צוות" subtitle="ניהול פקלים, דרישות כשירות וסוגי ציוד לצוות." action={saved ? <Badge variant="success">{savedLabel(saved)}</Badge> : null} />

      {pendingQuotes.length ? (
        <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">משפטים שממתינים לאישור</h2>
              <p className="mt-0.5 text-sm">אישור מהיר להצעות שהצוות שלח.</p>
            </div>
            <Badge variant="warning">{pendingQuotes.length}</Badge>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {pendingQuotes.map((quote) => (
              <PendingDailyQuoteApproval key={quote.id} peopleById={peopleById} quote={quote} teamSlug={data.team.slug} />
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>משפטים יומיים</CardTitle>
              {pendingQuotes.length ? <Badge variant="warning">{pendingQuotes.length} ממתינים לאישור</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            {dailyQuotes.length === 0 ? (
              <EmptyState title="אין משפטים" description="אפשר להוסיף משפט ראשון מהטופס בצד." />
            ) : (
              <div className="grid gap-3">
                {managedQuotes.map((quote) => (
                  <DailyQuoteForm key={quote.id} peopleById={peopleById} quote={quote} teamSlug={data.team.slug} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>משפט חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyQuoteForm teamSlug={data.team.slug} />
          </CardContent>
        </Card>
      </section>
    </AppPage>
  );
}

function DailyQuoteForm({ peopleById, quote, teamSlug }: { peopleById?: Map<string, string>; quote?: DailyQuote; teamSlug: string }) {
  const save = saveDailyQuoteAction.bind(null, teamSlug);
  const submitterName = quote?.submitted_person_id ? peopleById?.get(quote.submitted_person_id) ?? "איש צוות" : null;

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {quote?.status === "pending" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">הצעה שממתינה לאישור</p>
              <p className="mt-1 text-sm font-bold leading-6">{quote.text}</p>
              {submitterName ? <p className="mt-1 text-xs">הוצע על ידי {submitterName}</p> : null}
            </div>
            <Badge variant="warning">חדש</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <form action={decideDailyQuoteAction.bind(null, teamSlug, quote.id, "approved")} className="grid gap-2">
              <input name="sort_order" type="hidden" value={quote.sort_order} />
              <Button className="w-full" type="submit">אישור משפט</Button>
            </form>
            <form action={decideDailyQuoteAction.bind(null, teamSlug, quote.id, "rejected")} className="grid gap-2">
              <input name="sort_order" type="hidden" value={quote.sort_order} />
              <Button className="w-full" type="submit" variant="outline">דחייה</Button>
            </form>
          </div>
        </div>
      ) : null}
      <form action={save} className="grid gap-3">
      {quote ? <input name="id" type="hidden" value={quote.id} /> : null}
      <TextArea
        defaultValue={quote?.text ?? ""}
        fieldId={quote ? `daily_quote_text_${quote.id}` : "daily_quote_text_new"}
        label="משפט"
        maxLength={220}
        name="text"
        required
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <QuoteStatusSelect defaultValue={quote?.status ?? "approved"} idSuffix={quote?.id ?? "new"} />
        <div className="grid gap-1.5">
          <Label htmlFor={quote ? `sort_order_${quote.id}` : "sort_order_new"}>סדר</Label>
          <Input
            defaultValue={quote?.sort_order ?? 0}
            id={quote ? `sort_order_${quote.id}` : "sort_order_new"}
            name="sort_order"
            type="number"
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked={quote?.is_active ?? true} />
          פעיל
        </label>
      </div>
      {quote?.source === "viewer" ? (
        <Badge className="justify-self-start" variant={quote.status === "pending" ? "warning" : "outline"}>
          {submitterName ? `הצעה מאת ${submitterName}` : "הצעה ממשתמש"}
        </Badge>
      ) : null}
      <Button type="submit" variant={quote ? "outline" : "default"}>
        {quote ? "שמירת משפט" : "הוספת משפט"}
      </Button>
    </form>
    </div>
  );
}

function PendingDailyQuoteApproval({ peopleById, quote, teamSlug }: { peopleById: Map<string, string>; quote: DailyQuote; teamSlug: string }) {
  const submitterName = quote.submitted_person_id ? peopleById.get(quote.submitted_person_id) ?? "איש צוות" : "איש צוות";

  return (
    <div className="grid gap-3 rounded-lg border border-amber-200 bg-white/80 p-3">
      <div>
        <p className="text-xs font-semibold text-amber-700">הוצע על ידי {submitterName}</p>
        <p className="mt-1 text-base font-bold leading-7">{quote.text}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <form action={decideDailyQuoteAction.bind(null, teamSlug, quote.id, "approved")}>
          <input name="sort_order" type="hidden" value={quote.sort_order} />
          <Button className="w-full" type="submit">אישור משפט</Button>
        </form>
        <form action={decideDailyQuoteAction.bind(null, teamSlug, quote.id, "rejected")}>
          <input name="sort_order" type="hidden" value={quote.sort_order} />
          <Button className="w-full" type="submit" variant="outline">דחייה</Button>
        </form>
      </div>
    </div>
  );
}

function QuoteStatusSelect({ defaultValue, idSuffix }: { defaultValue: DailyQuote["status"]; idSuffix: string }) {
  const id = `quote_status_${idSuffix}`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>סטטוס</Label>
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        id={id}
        name="status"
      >
        <option value="approved">מאושר</option>
        <option value="pending">ממתין לאישור</option>
        <option value="rejected">נדחה</option>
        <option value="archived">ארכיון</option>
      </select>
    </div>
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
  fieldId,
  label,
  maxLength,
  name,
  required,
}: {
  defaultValue?: string;
  fieldId?: string;
  label: string;
  maxLength?: number;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={fieldId ?? name}>{label}</Label>
      <textarea
        className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        id={fieldId ?? name}
        maxLength={maxLength}
        name={name}
        required={required}
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
    "daily-quote": "המשפט נשמר",
    "daily-quote-decision": "הצעת המשפט עודכנה",
    "pakal-type": "הפקל נשמר",
    requirement: "דרישת הכשירות נשמרה",
  };

  return labels[saved] ?? "נשמר";
}
