import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import {
  assignEquipmentAction,
  assignPakalAction,
  removePakalAction,
  returnEquipmentAction,
  updateEquipmentAction,
  updatePersonAction,
} from "@/app/[teamSlug]/team/actions";
import { AppPage, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { EquipmentType, PersonEquipmentItem, PersonProfileData, PersonPakalItem } from "@/lib/kav/team-management";
import { cn } from "@/lib/utils";

const equipmentCategoryLabels: Record<EquipmentType["category"], string> = {
  WEAPON: "נשק",
  OPTIC: "כוונת",
  AMRAL: "אמר״ל",
  PAKAL: "פק״ל",
  OTHER: "אחר",
};
const equipmentCategoryOrder: EquipmentType["category"][] = ["WEAPON", "OPTIC", "AMRAL", "PAKAL", "OTHER"];

const tabs = [
  { id: "general", label: "כללי" },
  { id: "pakals", label: "פקלים" },
  { id: "equipment", label: "ציוד" },
  { id: "reserve", label: "מילואים" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function PersonProfileView({
  data,
  saved,
  tab,
}: {
  data: PersonProfileData;
  saved?: string;
  tab?: string;
}) {
  const activeTab = tabs.some((item) => item.id === tab) ? (tab as TabId) : "general";
  const { person, team } = data;

  return (
    <AppPage>
      <PageHeader
        eyebrow={team.name}
        title={person.full_name}
        subtitle={person.phone || person.email || "אין פרטי קשר זמינים"}
        action={<Link className="flex size-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted" href={`/${team.slug}/team`} aria-label="חזרה לצוות"><ArrowRight className="size-4" /></Link>}
      >
      <nav className="kav-scroll-x grid grid-cols-4 gap-1 overflow-x-auto rounded-md border bg-muted p-1" aria-label="פרופיל איש צוות">
        {tabs.map((item) => (
          <Link
            key={item.id}
            className={cn(
              "min-w-20 rounded-md px-3 py-2 text-center text-sm font-medium text-muted-foreground transition-colors",
              activeTab === item.id && "bg-card text-foreground shadow-[0_1px_2px_rgba(20,22,26,0.06)]",
            )}
            href={`/${team.slug}/team/${person.id}?tab=${item.id}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      </PageHeader>

      <Card className="mb-4 flex items-center gap-3 p-3.5">
        <Avatar name={person.full_name} photoUrl={person.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{person.full_name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant={person.is_active ? "success" : "muted"}>{person.is_active ? "פעיל" : "לא פעיל"}</Badge>
            {saved ? <Badge variant="info">{savedLabel(saved)}</Badge> : null}
          </div>
        </div>
        {person.phone ? <a href={`tel:${person.phone}`} className="flex size-10 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted" aria-label="חיוג"><Phone className="size-4" /></a> : null}
      </Card>

      {activeTab === "general" ? <GeneralTab data={data} /> : null}
      {activeTab === "pakals" ? <PakalsTab data={data} /> : null}
      {activeTab === "equipment" ? <EquipmentTab data={data} /> : null}
      {activeTab === "reserve" ? <ReserveTab data={data} /> : null}
    </AppPage>
  );
}

function GeneralTab({ data }: { data: PersonProfileData }) {
  const { person, privateDetails, team } = data;
  const updatePerson = updatePersonAction.bind(null, team.slug, person.id);

  if (!data.canManageTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>פרטים כלליים</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info label="שם מלא" value={person.full_name} />
          <Info label="טלפון" value={person.phone} />
          <Info label="אימייל" value={person.email} />
          <Info label="סטטוס" value={person.is_active ? "פעיל" : "לא פעיל"} />
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={updatePerson} className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>פרטים כלליים</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={person.full_name} label="שם מלא" name="full_name" required />
            <Field defaultValue={person.phone ?? ""} label="טלפון" name="phone" type="tel" />
            <Field defaultValue={person.email ?? ""} label="אימייל" name="email" type="email" />
            <Field defaultValue={person.photo_url ?? ""} label="קישור לתמונה" name="photo_url" type="url" />
            <label className="flex items-center gap-2 pt-7 text-sm">
              <input name="is_active" type="checkbox" defaultChecked={person.is_active} />
              פעיל
            </label>
          </div>
          <TextArea defaultValue={person.notes ?? ""} label="הערות רגילות" name="notes" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>פרטים רגישים</CardTitle>
            <ShieldAlert className="size-5 text-amber-600" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input name="private_enabled" type="hidden" value="on" />
          <Field
            defaultValue={privateDetails?.personal_number ?? ""}
            label="מספר אישי"
            name="personal_number"
          />
          <Field
            defaultValue={privateDetails?.national_id ?? ""}
            label="תעודת זהות"
            name="national_id"
          />
          <TextArea
            defaultValue={privateDetails?.private_notes ?? ""}
            label="הערות פרטיות"
            name="private_notes"
          />
          {!privateDetails ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              אין עדיין רשומת פרטים רגישים לאיש הצוות.
            </p>
          ) : null}
          <Button type="submit">שמירת פרופיל</Button>
        </CardContent>
      </Card>
    </form>
  );
}

function PakalsTab({ data }: { data: PersonProfileData }) {
  const activePakals = data.selectedPakals.filter((item) => item.is_active);
  const activePakalIds = new Set(activePakals.map((item) => item.pakal_type_id));
  const availablePakals = data.pakalTypes.filter(
    (item) => item.is_active && !activePakalIds.has(item.id),
  );
  const assignPakal = assignPakalAction.bind(null, data.team.slug, data.person.id);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader>
          <CardTitle>פקלים משויכים</CardTitle>
        </CardHeader>
        <CardContent>
          {activePakals.length === 0 ? (
            <EmptyState title="אין פקלים משויכים" description="פקלים יופיעו כאן לאחר שיוך מנהל." />
          ) : (
            <div className="grid gap-3">
              {activePakals.map((item) => (
                <PakalRow
                  key={item.id}
                  item={item}
                  canManage={data.canManageTeam}
                  personId={data.person.id}
                  teamSlug={data.team.slug}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>הוספת פקל</CardTitle>
        </CardHeader>
        <CardContent>
          {data.canManageTeam ? (
            availablePakals.length > 0 ? (
              <form action={assignPakal} className="grid gap-3">
                <Select label="פקל" name="pakal_type_id" required>
                  {availablePakals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <TextArea label="הערת פקל" name="notes" />
                <Button type="submit">הוספה</Button>
              </form>
            ) : (
              <EmptyState title="אין פקלים זמינים" description="כל הפקלים הפעילים כבר משויכים." />
            )
          ) : (
            <EmptyState title="צפייה בלבד" description="מנהלים יכולים להוסיף או להסיר פקלים." />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EquipmentTab({ data }: { data: PersonProfileData }) {
  const assignEquipment = assignEquipmentAction.bind(null, data.team.slug, data.person.id);
  const activeTypes = data.equipmentTypes.filter((type) => type.is_active);

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader>
          <CardTitle>ציוד אישי</CardTitle>
        </CardHeader>
        <CardContent>
          {data.equipment.length === 0 ? (
            <EmptyState title="אין ציוד משויך" description="לא קיימות רשומות ציוד לאיש הצוות." />
          ) : (
            <div className="grid gap-4">
              {equipmentCategoryOrder.flatMap((category) => {
                const items = data.equipment.filter(
                  (item) => (item.equipmentType?.category ?? "OTHER") === category,
                );
                if (!items.length) return [];
                return (
                  <div key={category}>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {equipmentCategoryLabels[category]} · {items.length}
                    </p>
                    <div className="grid gap-3">
                      {items.map((item) => (
                        <EquipmentRow
                          key={item.id}
                          canManage={data.canManageTeam}
                          item={item}
                          personId={data.person.id}
                          teamSlug={data.team.slug}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ציוד צוותי</CardTitle>
        </CardHeader>
        <CardContent>
          {data.teamEquipment.length ? (
            <div className="grid gap-3">
              {data.teamEquipment.map((item) => (
                <div className="rounded-lg border p-4" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {equipmentCategoryLabels[item.category]} · {[item.model, item.serial_number].filter(Boolean).join(" · ") || "ללא דגם/מספר סידורי"}
                      </p>
                    </div>
                    <Badge variant={item.status === "in_use" ? "success" : item.status === "damaged" ? "warning" : item.status === "lost" ? "danger" : "outline"}>
                      {teamEquipmentStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {item.current_holder_person_id === data.person.id ? <Badge variant="success">אחראי נוכחי</Badge> : null}
                    {item.permanent_owner_person_id === data.person.id ? <Badge variant="outline">חתום קבוע</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="אין ציוד צוותי" description="לא נמצא ציוד צוותי שהאדם חתום עליו או אחראי עליו כרגע." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>שיוך ציוד</CardTitle>
        </CardHeader>
        <CardContent>
          {data.canManageTeam ? (
            activeTypes.length > 0 ? (
              <form action={assignEquipment} className="grid gap-3">
                <Select label="סוג ציוד" name="equipment_type_id" required>
                  {equipmentCategoryOrder.flatMap((category) => {
                    const items = activeTypes.filter((type) => type.category === category);
                    if (!items.length) return [];
                    return (
                      <optgroup key={category} label={equipmentCategoryLabels[category]}>
                        {items.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </Select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="דגם" name="model" />
                  <Field label="מספר סידורי" name="serial_number" />
                  <Field label="תאריך שיוך" name="assigned_at" type="date" />
                  <Select defaultValue="assigned" label="סטטוס" name="status">
                    <option value="assigned">משויך</option>
                    <option value="damaged">פגום</option>
                    <option value="lost">אבד</option>
                    <option value="returned">הוחזר</option>
                  </Select>
                </div>
                <TextArea label="הערות ציוד" name="notes" />
                <Button type="submit">שיוך ציוד</Button>
              </form>
            ) : (
              <EmptyState
                title="אין סוגי ציוד"
                description="יש להגדיר סוג ציוד בהגדרות לפני שיוך ציוד לאיש צוות."
              />
            )
          ) : (
            <EmptyState title="צפייה בלבד" description="מנהלים יכולים לשייך ולעדכן ציוד." />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ReserveTab({ data }: { data: PersonProfileData }) {
  const history = data.reserveHistory.filter(
    (item) => item.rotations.length > 0 || item.attendance.total > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>היסטוריית מילואים</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <EmptyState
            title="אין היסטוריית מילואים"
            description="עדיין אין תקופות, רוטציות או נוכחות עבור איש הצוות."
          />
        ) : (
          <div className="grid gap-3">
            {history.map((item) => (
              <div key={item.period.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{item.period.name}</div>
                  <Badge variant="outline">{item.period.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(item.period.starts_on)} - {formatDate(item.period.ends_on)}
                  {item.period.location ? ` · ${item.period.location}` : ""}
                </p>
                <Separator className="my-3" />
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <Info
                    label="רוטציות"
                    value={
                      item.rotations.length
                        ? item.rotations.map((rotation) => rotation.groupName).join(", ")
                        : "אין"
                    }
                  />
                  <Info
                    label="נוכחות בפועל"
                    value={`${item.attendance.present}/${item.attendance.total}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PakalRow({
  canManage,
  item,
  personId,
  teamSlug,
}: {
  canManage: boolean;
  item: PersonPakalItem;
  personId: string;
  teamSlug: string;
}) {
  const remove = removePakalAction.bind(null, teamSlug, personId, item.id);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Badge variant="outline">{item.pakal?.name ?? "פקל לא מזוהה"}</Badge>
        {item.notes ? <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p> : null}
      </div>
      {canManage ? (
        <form action={remove}>
          <Button size="sm" type="submit" variant="outline">
            הסרה
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function EquipmentRow({
  canManage,
  item,
  personId,
  teamSlug,
}: {
  canManage: boolean;
  item: PersonEquipmentItem;
  personId: string;
  teamSlug: string;
}) {
  const update = updateEquipmentAction.bind(null, teamSlug, personId, item.id);
  const returnEquipment = returnEquipmentAction.bind(null, teamSlug, personId, item.id);

  return (
    <details className="rounded-lg border p-4" open={!canManage}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{item.equipmentType?.name ?? "ציוד"}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[item.model, item.serial_number].filter(Boolean).join(" · ") || "ללא דגם/מספר סידורי"}
          </p>
        </div>
        <Badge variant={item.status === "assigned" ? "success" : item.status === "damaged" ? "warning" : "muted"}>
          {equipmentStatusLabel(item.status)}
        </Badge>
      </summary>
      {canManage ? (
        <form action={update} className="mt-4 grid gap-3 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field defaultValue={item.model ?? ""} label="דגם" name="model" />
            <Field defaultValue={item.serial_number ?? ""} label="מספר סידורי" name="serial_number" />
            <Field defaultValue={item.assigned_at ?? ""} label="תאריך שיוך" name="assigned_at" type="date" />
            <Field defaultValue={item.returned_at ?? ""} label="תאריך החזרה" name="returned_at" type="date" />
          </div>
          <Select defaultValue={item.status} label="סטטוס" name="status">
            <option value="assigned">משויך</option>
            <option value="damaged">פגום</option>
            <option value="lost">אבד</option>
            <option value="returned">הוחזר</option>
          </Select>
          <TextArea defaultValue={item.notes ?? ""} label="הערות" name="notes" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">שמירה</Button>
            {item.status === "assigned" ? (
              <Button formAction={returnEquipment} type="submit" variant="outline">
                החזרה
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </details>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <div
        aria-label={name}
        className="size-16 rounded-full border bg-cover bg-center"
        style={{ backgroundImage: `url(${photoUrl})` }}
      />
    );
  }

  return (
    <div className="flex size-16 items-center justify-center rounded-full border bg-accent text-accent-foreground">
      <UserRound className="size-7" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value || "אין"}</div>
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
        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        id={name}
        name={name}
      />
    </div>
  );
}

function Select({
  children,
  defaultValue,
  label,
  name,
  required,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        id={name}
        name={name}
        required={required}
      >
        {children}
      </select>
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed p-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <CalendarDays className="size-5" />
      </div>
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function equipmentStatusLabel(status: PersonEquipmentItem["status"]) {
  const labels: Record<PersonEquipmentItem["status"], string> = {
    assigned: "משויך",
    damaged: "פגום",
    lost: "אבד",
    returned: "הוחזר",
  };

  return labels[status];
}

function teamEquipmentStatusLabel(status: PersonProfileData["teamEquipment"][number]["status"]) {
  const labels: Record<PersonProfileData["teamEquipment"][number]["status"], string> = {
    available: "זמין בצוות",
    damaged: "תקול",
    in_use: "באחריות",
    lost: "אבד",
    retired: "יצא משימוש",
  };

  return labels[status];
}

function savedLabel(saved: string) {
  const labels: Record<string, string> = {
    "equipment-added": "הציוד שויך",
    "equipment-returned": "הציוד הוחזר",
    "equipment-updated": "הציוד עודכן",
    "pakal-added": "הפקל נוסף",
    "pakal-removed": "הפקל הוסר",
    "person-created": "איש הצוות נוצר",
    "person-updated": "הפרופיל נשמר",
    "private-updated": "הפרטים הרגישים נשמרו",
  };

  return labels[saved] ?? "נשמר";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(value));
}
