import { decideDailyQuoteAction, saveDailyQuoteAction, setCurrentDailyQuoteAction } from "@/app/[teamSlug]/quotes/actions";
import { deleteScheduleEventAction, saveScheduleEventAction } from "@/app/[teamSlug]/schedule/actions";
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
import type { ScheduleData } from "@/lib/kav/schedule";
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
  currentDailyQuoteId,
  data,
  dailyQuotes,
  equipmentTypes,
  scheduleData,
  saved,
}: {
  currentDailyQuoteId?: string | null;
  data: TeamManagementData;
  dailyQuotes: DailyQuote[];
  equipmentTypes: EquipmentType[];
  scheduleData: ScheduleData;
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

      <LineScheduleSettings data={scheduleData} />

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
                  <DailyQuoteForm
                    current={quote.id === currentDailyQuoteId}
                    key={quote.id}
                    peopleById={peopleById}
                    quote={quote}
                    teamSlug={data.team.slug}
                  />
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

function LineScheduleSettings({ data }: { data: ScheduleData }) {
  const period = data.selectedPeriod;
  const save = saveScheduleEventAction.bind(null, data.team.slug);
  const remove = deleteScheduleEventAction.bind(null, data.team.slug);

  return (
    <section className="mb-4 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">לו״ז הקו</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            עריכת אירועים שיופיעו בלוח השנה של הקו הנבחר. שינוי כאן משפיע על לו״ז הבית והלו״ז החודשי.
          </p>
        </div>
        {period ? <Badge variant="outline">{period.name}</Badge> : null}
      </div>

      {!period ? (
        <EmptyState title="אין קו נבחר" description="בחר או צור תקופת מילואים לפני עריכת לו״ז." />
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_24rem]">
          <div className="grid gap-3">
            {data.events.length ? data.events.map((event) => (
              <details className="rounded-lg border p-3" key={event.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{event.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.is_all_day ? localDate(event.starts_at, data.team.timezone) : `${localDate(event.starts_at, data.team.timezone)} · ${localTime(event.starts_at, data.team.timezone)}`}
                    </p>
                  </div>
                  <Badge variant="outline">{eventTypeLabel(event.event_type)}</Badge>
                </summary>
                <form action={save} className="mt-4 grid gap-3 border-t pt-4">
                  <input name="id" type="hidden" value={event.id} />
                  <input name="reserve_period_id" type="hidden" value={period.id} />
                  <ScheduleEventFields event={event} timeZone={data.team.timezone} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="sm:flex-1" type="submit">שמירת אירוע</Button>
                    <Button form={`delete_event_${event.id}`} type="submit" variant="outline">מחיקה</Button>
                  </div>
                </form>
                <form action={remove} id={`delete_event_${event.id}`}>
                  <input name="id" type="hidden" value={event.id} />
                </form>
              </details>
            )) : <EmptyState title="אין אירועים בלו״ז" description="אפשר להוסיף אירוע חדש מהטופס בצד." />}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>אירוע חדש בלו״ז</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={save} className="grid gap-3">
                <input name="reserve_period_id" type="hidden" value={period.id} />
                <ScheduleEventFields timeZone={data.team.timezone} />
                <Button type="submit">הוספת אירוע</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

function ScheduleEventFields({ event, timeZone }: { event?: ScheduleData["events"][number]; timeZone: string }) {
  const startsOn = event ? localDate(event.starts_at, timeZone) : "";
  const endsOn = event?.ends_at ? localDate(event.ends_at, timeZone) : "";
  const startsTime = event && !event.is_all_day ? localTime(event.starts_at, timeZone) : "";
  const endsTime = event && !event.is_all_day && event.ends_at ? localTime(event.ends_at, timeZone) : "";
  return (
    <>
      <Field defaultValue={event?.title ?? ""} label="כותרת" name="title" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={event ? `event_type_${event.id}` : "event_type_new"}>סוג</Label>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={event?.event_type ?? "training"}
            id={event ? `event_type_${event.id}` : "event_type_new"}
            name="event_type"
          >
            <option value="briefing">תדריך</option>
            <option value="training">אימון</option>
            <option value="family">בית / משפחה</option>
            <option value="processing">קליטה / זיכויים</option>
            <option value="changeover">חילוף</option>
            <option value="holiday">חג</option>
            <option value="other">אחר</option>
          </select>
        </div>
        <Field defaultValue={event?.location ?? ""} label="מיקום" name="location" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field defaultValue={startsOn} label="מתאריך" name="starts_on" required type="date" />
        <Field defaultValue={endsOn || startsOn} label="עד תאריך" name="ends_on" type="date" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field defaultValue={startsTime} label="משעה" name="starts_time" type="time" />
        <Field defaultValue={endsTime} label="עד שעה" name="ends_time" type="time" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="is_all_day" type="checkbox" defaultChecked={event?.is_all_day ?? true} />
        כל היום
      </label>
      <TextArea defaultValue={event?.notes ?? ""} label="הערות" name="notes" />
    </>
  );
}

function DailyQuoteForm({ current, peopleById, quote, teamSlug }: { current?: boolean; peopleById?: Map<string, string>; quote?: DailyQuote; teamSlug: string }) {
  const save = saveDailyQuoteAction.bind(null, teamSlug);
  const quoteId = quote?.id;
  const setCurrent = quote ? setCurrentDailyQuoteAction.bind(null, teamSlug, quote.id) : null;
  const submitterName = quote?.submitted_person_id ? peopleById?.get(quote.submitted_person_id) ?? "איש צוות" : null;

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {quote?.status === "pending" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">הצעה שממתינה לאישור</p>
              <p className="mt-1 text-sm font-bold leading-6">{quote.text}</p>
              {submitterName ? <p className="mt-1 text-xs">הוגש ע״י {submitterName}</p> : null}
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
      <div className="flex flex-wrap items-center gap-2">
        {current ? <Badge variant="success">משפט היום</Badge> : null}
        {quote?.source === "viewer" ? (
          <Badge className="justify-self-start" variant={quote.status === "pending" ? "warning" : "outline"}>
            {submitterName ? `הוגש ע״י ${submitterName}` : "הוגש ע״י משתמש"}
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" variant={quote ? "outline" : "default"}>
          {quote ? "שמירת משפט" : "הוספת משפט"}
        </Button>
        {setCurrent && quoteId ? (
          <Button form={`current_quote_${quoteId}`} type="submit" variant={current ? "secondary" : "default"}>
            {current ? "זה המשפט היום" : "קבע כמשפט היום"}
          </Button>
        ) : null}
      </div>
    </form>
    {setCurrent && quoteId ? <form action={setCurrent} id={`current_quote_${quoteId}`} /> : null}
    </div>
  );
}

function PendingDailyQuoteApproval({ peopleById, quote, teamSlug }: { peopleById: Map<string, string>; quote: DailyQuote; teamSlug: string }) {
  const submitterName = quote.submitted_person_id ? peopleById.get(quote.submitted_person_id) ?? "איש צוות" : "איש צוות";

  return (
    <div className="grid gap-3 rounded-lg border border-amber-200 bg-white/80 p-3">
      <div>
        <p className="text-xs font-semibold text-amber-700">הוגש ע״י {submitterName}</p>
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
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input defaultValue={defaultValue} id={name} name={name} required={required} type={type} />
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
    "daily-quote-current": "משפט היום עודכן",
    "pakal-type": "הפקל נשמר",
    requirement: "דרישת הכשירות נשמרה",
  };

  return labels[saved] ?? "נשמר";
}

function localDate(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function localTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    briefing: "תדריך",
    changeover: "חילוף",
    family: "בית",
    holiday: "חג",
    other: "אחר",
    processing: "קליטה",
    training: "אימון",
  };
  return labels[type] ?? type;
}
