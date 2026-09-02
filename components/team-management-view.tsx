"use client";

import Link from "next/link";
import { Mail, PackageCheck, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  assignEquipmentAction,
  createPersonAction,
  createTeamEquipmentAction,
  quickUpdateEquipmentAction,
  transferTeamEquipmentAction,
  updateTeamEquipmentAction,
} from "@/app/[teamSlug]/team/actions";
import { AppPage, PageHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentType, PersonListEquipmentItem, TeamManagementData } from "@/lib/kav/team-management";
import { cn } from "@/lib/utils";

const equipmentCategoryLabels: Record<EquipmentType["category"], string> = {
  AMRAL: "אמר״ל",
  OPTIC: "כוונת",
  OTHER: "ציוד נוסף",
  PAKAL: "פק״ל",
  WEAPON: "נשק",
};

export function TeamManagementView({ data }: { data: TeamManagementData }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [pakal, setPakal] = useState("all");
  const [rotation, setRotation] = useState("all");
  const [showMobileEquipment, setShowMobileEquipment] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<{
    category: EquipmentType["category"];
    personId: string;
  } | null>(null);
  const createPerson = createPersonAction.bind(null, data.team.slug);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = normalize(query);

    return data.people.filter((person) => {
      const matchesQuery =
        !normalizedQuery ||
        normalize(person.full_name).includes(normalizedQuery) ||
        normalize(person.phone).includes(normalizedQuery) ||
        normalize(person.email).includes(normalizedQuery);
      const matchesStatus =
        status === "all" ||
        (status === "active" && person.is_active) ||
        (status === "inactive" && !person.is_active);
      const matchesPakal =
        pakal === "all" || person.pakals.some((item) => item.id === pakal);
      const matchesRotation =
        rotation === "all" || (person.rotation?.id ?? "none") === rotation;

      return matchesQuery && matchesStatus && matchesPakal && matchesRotation;
    });
  }, [data.people, pakal, query, rotation, status]);

  const editingPerson = editingEquipment
    ? data.people.find((person) => person.id === editingEquipment.personId) ?? null
    : null;

  return (
    <AppPage>
      <PageHeader
        eyebrow={data.team.name}
        title="צוות"
        subtitle={`${data.people.length} אנשי צוות · ${activeCount(data)} פעילים · ${data.pakalTypes.length} פקלים`}
        action={data.canManageTeam ? (
          <details className="group w-full xl:w-auto">
            <summary className="list-none">
              <Button type="button" size="icon" aria-label="איש צוות חדש">
                <Plus className="size-4" />
              </Button>
            </summary>
            <Card className="absolute left-4 right-4 z-30 mt-3 sm:right-auto sm:w-[30rem]">
              <CardHeader>
                <CardTitle>איש צוות חדש</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createPerson} className="grid gap-3">
                  <Field label="שם מלא" name="full_name" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="טלפון" name="phone" type="tel" />
                    <Field label="אימייל" name="email" type="email" />
                    <Field label="קישור לתמונה" name="photo_url" type="url" />
                  </div>
                  <TextArea label="הערות" name="notes" />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="is_active" type="checkbox" defaultChecked />
                    פעיל
                  </label>
                  <Button type="submit">יצירה</Button>
                </form>
              </CardContent>
            </Card>
          </details>
        ) : null}
      />

      <section className="mb-4 grid gap-3 rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(20,22,26,0.04)] md:grid-cols-[1fr_11rem_13rem_13rem]">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="חיפוש אנשי צוות"
            className="pr-9"
            placeholder="חיפוש לפי שם, טלפון או אימייל"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Select label="סטטוס" value={status} onChange={setStatus}>
          <option value="all">כולם</option>
          <option value="active">פעילים</option>
          <option value="inactive">לא פעילים</option>
        </Select>
        <Select label="פקל" value={pakal} onChange={setPakal}>
          <option value="all">כל הפקלים</option>
          {data.pakalTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          disabled={data.rotations.length === 0}
          label="רוטציה"
          value={rotation}
          onChange={setRotation}
        >
          <option value="all">
            {data.rotations.length === 0 ? "אין רוטציות" : "כל הרוטציות"}
          </option>
          {data.rotations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </section>

      {filteredPeople.length === 0 ? (
        <EmptyState
          title="לא נמצאו אנשי צוות"
          description="אפשר לשנות את החיפוש או להסיר מסננים כדי לראות עוד תוצאות."
        />
      ) : (
        <>
          {data.canManageTeam ? (
            <section className="mb-4 rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(20,22,26,0.04)] md:hidden">
              <Button
                className="w-full justify-between"
                type="button"
                variant={showMobileEquipment ? "secondary" : "outline"}
                onClick={() => setShowMobileEquipment((value) => !value)}
              >
                <span className="flex items-center gap-2">
                  <PackageCheck className="size-4" />
                  {showMobileEquipment ? "הסתרת טבלת ציוד" : "הצגת כל הציוד"}
                </span>
                <span className="kav-num text-xs text-muted-foreground">
                  {equipmentItemCount(filteredPeople)}
                </span>
              </Button>
              {showMobileEquipment ? (
                <MobileEquipmentTable
                  people={filteredPeople}
                  onEdit={(personId, category) => setEditingEquipment({ category, personId })}
                />
              ) : null}
            </section>
          ) : null}

          {data.canManageTeam ? <SharedTeamEquipmentPanel data={data} /> : null}

          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="min-w-[1040px] w-full table-fixed text-right text-xs">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="sticky right-0 z-20 w-[9rem] bg-muted/95 px-2.5 py-2 font-medium shadow-[-10px_0_18px_-18px_rgba(20,22,26,0.7)]">לוחם</th>
                  <th className="w-[6rem] px-2.5 py-2 font-medium">סטטוס</th>
                  <th className="w-[12rem] px-2.5 py-2 font-medium">נשק</th>
                  <th className="w-[12rem] px-2.5 py-2 font-medium">כוונת</th>
                  <th className="w-[12rem] px-2.5 py-2 font-medium">אמר״ל</th>
                  <th className="w-[12rem] px-2.5 py-2 font-medium">פק״ל</th>
                  <th className="w-[12rem] px-2.5 py-2 font-medium">ציוד נוסף</th>
                  <th className="w-[8rem] px-2.5 py-2 font-medium">סבב</th>
                  <th className="w-[5rem] px-2.5 py-2 font-medium">קשר</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPeople.map((person) => {
                  const equipment = summarizeEquipment(person.equipment);
                  return (
                  <tr key={person.id} className="align-top hover:bg-muted/30">
                    <td className="sticky right-0 z-10 bg-card px-2.5 py-2 shadow-[-10px_0_18px_-18px_rgba(20,22,26,0.55)]">
                      <Link
                        className="block truncate font-semibold text-primary hover:underline"
                        href={`/${data.team.slug}/team/${person.id}`}
                      >
                        {person.full_name}
                      </Link>
                    </td>
                    <td className="px-2.5 py-2">
                      <StatusBadge active={person.is_active} />
                    </td>
                    {data.canManageTeam ? (
                      <>
                        <td className="px-2.5 py-2"><EquipmentCategoryCell category="WEAPON" onEdit={() => setEditingEquipment({ category: "WEAPON", personId: person.id })} person={person} /></td>
                        <td className="px-2.5 py-2"><EquipmentCategoryCell category="OPTIC" onEdit={() => setEditingEquipment({ category: "OPTIC", personId: person.id })} person={person} /></td>
                        <td className="px-2.5 py-2"><EquipmentCategoryCell category="AMRAL" onEdit={() => setEditingEquipment({ category: "AMRAL", personId: person.id })} person={person} /></td>
                        <td className="px-2.5 py-2"><EquipmentCategoryCell category="PAKAL" onEdit={() => setEditingEquipment({ category: "PAKAL", personId: person.id })} person={person} /></td>
                        <td className="px-2.5 py-2"><EquipmentCategoryCell category="OTHER" onEdit={() => setEditingEquipment({ category: "OTHER", personId: person.id })} person={person} /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-2.5 py-2 text-muted-foreground">{equipment.weapon.models}</td>
                        <td className="px-2.5 py-2 text-muted-foreground">{equipment.optic.models}</td>
                        <td className="px-2.5 py-2 text-muted-foreground">{equipment.amral.models}</td>
                        <td className="px-2.5 py-2 text-muted-foreground">{equipment.pakal.models}</td>
                        <td className="px-2.5 py-2 text-muted-foreground">{equipment.other.models}</td>
                      </>
                    )}
                    <td className="px-2.5 py-2 text-muted-foreground">
                      {person.rotation?.name ?? "אין"}
                    </td>
                    <td className="px-2.5 py-2">
                      <ContactLinks email={person.email} phone={person.phone} />
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card md:hidden">
            {filteredPeople.map((person) => (
              <div className="border-b p-3 last:border-0" key={person.id}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-primary">{initials(person.full_name)}</span>
                    <div className="min-w-0 flex-1">
                      <Link
                        className="block truncate text-sm font-semibold"
                        href={`/${data.team.slug}/team/${person.id}`}
                      >
                        {person.full_name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{person.rotation ? `רוטציה: ${person.rotation.name}` : "אין רוטציה"}{person.pakals.length ? ` · ${person.pakals.slice(0, 2).map((item) => item.name).join(", ")}` : ""}</p>
                    </div>
                    <StatusBadge active={person.is_active} />
                  </div>
              </div>
            ))}
          </div>
        </>
      )}
      {editingEquipment && editingPerson ? (
        <EquipmentEditDialog
          category={editingEquipment.category}
          data={data}
          person={editingPerson}
          onClose={() => setEditingEquipment(null)}
        />
      ) : null}
    </AppPage>
  );
}

function SharedTeamEquipmentPanel({ data }: { data: TeamManagementData }) {
  const create = createTeamEquipmentAction.bind(null, data.team.slug);

  return (
    <section className="mb-4 rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">ציוד צוותי</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">פריטים ששייכים לצוות ועוברים באחריות בין אנשים.</p>
        </div>
        <Badge variant="outline">{data.teamEquipment.length} פריטים</Badge>
      </div>

      {data.teamEquipment.length ? (
        <div className="grid gap-2">
          {data.teamEquipment.map((item) => (
            <SharedTeamEquipmentItem data={data} item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">עוד אין ציוד צוותי.</div>
      )}

      <details className="mt-3 rounded-lg border border-dashed p-3">
        <summary className="cursor-pointer text-sm font-semibold">הוספת ציוד צוותי</summary>
        <form action={create} className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="שם ציוד" name="name" required />
          <TeamEquipmentCategorySelect defaultValue="OTHER" />
          <Field label="דגם" name="model" />
          <Field label="מספר סידורי" name="serial_number" />
          <PersonSelect label="חתום קבוע" name="permanent_owner_person_id" people={data.people} />
          <PersonSelect label="אחראי נוכחי" name="current_holder_person_id" people={data.people} />
          <TeamEquipmentStatusSelect defaultValue="in_use" />
          <Field label="הערת פתיחה" name="transfer_note" />
          <div className="md:col-span-4">
            <TextArea label="הערות" name="notes" />
          </div>
          <Button className="md:col-span-4" type="submit">הוספת ציוד צוותי</Button>
        </form>
      </details>
    </section>
  );
}

function SharedTeamEquipmentItem({
  data,
  item,
}: {
  data: TeamManagementData;
  item: TeamManagementData["teamEquipment"][number];
}) {
  const transfer = transferTeamEquipmentAction.bind(null, data.team.slug, item.id);
  const update = updateTeamEquipmentAction.bind(null, data.team.slug, item.id);

  return (
    <details className="rounded-lg border p-3">
      <summary className="grid cursor-pointer list-none gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div>
          <b className="text-sm">{item.name}</b>
          <p className="mt-1 text-xs text-muted-foreground">
            {equipmentCategoryLabels[item.category]} · {item.serial_number ?? item.model ?? "ללא מספר/דגם"}
          </p>
        </div>
        <Badge variant={teamEquipmentBadgeVariant(item.status)}>{teamEquipmentStatusLabel(item.status)}</Badge>
        <span className="text-xs text-muted-foreground">
          אצל: <b className="text-foreground">{item.currentHolder?.full_name ?? "לא משויך"}</b>
        </span>
      </summary>
      <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-[1fr_1fr]">
        <form action={transfer} className="grid gap-2 rounded-lg bg-muted/30 p-3">
          <p className="text-sm font-semibold">העברת אחריות מהירה</p>
          <PersonSelect defaultValue={item.current_holder_person_id ?? ""} label="אחראי חדש" name="to_person_id" people={data.people} />
          <Field label="הערת העברה" name="transfer_note" />
          <Button type="submit" variant="secondary">העבר אחריות</Button>
        </form>
        <form action={update} className="grid gap-2 rounded-lg bg-muted/30 p-3">
          <p className="text-sm font-semibold">עריכת פריט</p>
          <Field defaultValue={item.name} label="שם ציוד" name="name" required />
          <TeamEquipmentCategorySelect defaultValue={item.category} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field defaultValue={item.model ?? ""} label="דגם" name="model" />
            <Field defaultValue={item.serial_number ?? ""} label="מספר סידורי" name="serial_number" />
          </div>
          <PersonSelect defaultValue={item.permanent_owner_person_id ?? ""} label="חתום קבוע" name="permanent_owner_person_id" people={data.people} />
          <PersonSelect defaultValue={item.current_holder_person_id ?? ""} label="אחראי נוכחי" name="current_holder_person_id" people={data.people} />
          <TeamEquipmentStatusSelect defaultValue={item.status} />
          <TextArea defaultValue={item.notes ?? ""} label="הערות" name="notes" />
          <Button type="submit">שמירה</Button>
        </form>
      </div>
    </details>
  );
}

function PersonSelect({
  defaultValue = "",
  label,
  name,
  people,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  people: TeamManagementData["people"];
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        name={name}
      >
        <option value="">ללא</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select>
    </label>
  );
}

function TeamEquipmentStatusSelect({ defaultValue }: { defaultValue: TeamManagementData["teamEquipment"][number]["status"] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      סטטוס
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        name="status"
      >
        <option value="available">זמין בצוות</option>
        <option value="in_use">באחריות</option>
        <option value="damaged">תקול</option>
        <option value="lost">אבד</option>
        <option value="retired">יצא משימוש</option>
      </select>
    </label>
  );
}

function TeamEquipmentCategorySelect({ defaultValue }: { defaultValue: EquipmentType["category"] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      קטגוריה
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={defaultValue}
        name="category"
      >
        {Object.entries(equipmentCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function MobileEquipmentTable({
  onEdit,
  people,
}: {
  onEdit: (personId: string, category: EquipmentType["category"]) => void;
  people: TeamManagementData["people"];
}) {
  return (
    <div className="mt-3 max-h-[70vh] overflow-auto rounded-lg border">
      <table className="min-w-[780px] w-full table-fixed text-right text-[0.72rem]">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="sticky top-0 right-0 z-30 w-[7.5rem] border-b bg-muted/95 px-2 py-2 font-medium shadow-[-10px_0_18px_-18px_rgba(20,22,26,0.7)]">לוחם</th>
            <th className="sticky top-0 z-20 w-[10.5rem] border-b bg-muted/95 px-2 py-2 font-medium">נשק</th>
            <th className="sticky top-0 z-20 w-[10.5rem] border-b bg-muted/95 px-2 py-2 font-medium">כוונת</th>
            <th className="sticky top-0 z-20 w-[10.5rem] border-b bg-muted/95 px-2 py-2 font-medium">אמר״ל</th>
            <th className="sticky top-0 z-20 w-[10.5rem] border-b bg-muted/95 px-2 py-2 font-medium">פק״ל</th>
            <th className="sticky top-0 z-20 w-[10.5rem] border-b bg-muted/95 px-2 py-2 font-medium">נוסף</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-card">
          {people.map((person) => (
            <tr className="align-top" key={person.id}>
              <td className="sticky right-0 z-10 bg-card px-2 py-2 font-semibold shadow-[-10px_0_18px_-18px_rgba(20,22,26,0.55)]">{person.full_name}</td>
              <td className="px-2 py-2"><EquipmentCategoryCell category="WEAPON" onEdit={() => onEdit(person.id, "WEAPON")} person={person} /></td>
              <td className="px-2 py-2"><EquipmentCategoryCell category="OPTIC" onEdit={() => onEdit(person.id, "OPTIC")} person={person} /></td>
              <td className="px-2 py-2"><EquipmentCategoryCell category="AMRAL" onEdit={() => onEdit(person.id, "AMRAL")} person={person} /></td>
              <td className="px-2 py-2"><EquipmentCategoryCell category="PAKAL" onEdit={() => onEdit(person.id, "PAKAL")} person={person} /></td>
              <td className="px-2 py-2"><EquipmentCategoryCell category="OTHER" onEdit={() => onEdit(person.id, "OTHER")} person={person} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentCategoryCell({
  category,
  onEdit,
  person,
}: {
  category: EquipmentType["category"];
  onEdit: () => void;
  person: TeamManagementData["people"][number];
}) {
  const items = person.equipment.filter((item) => (item.equipmentType?.category ?? "OTHER") === category);

  return (
    <button
      aria-label={`עריכת ציוד ${equipmentCategoryLabels[category]} - ${person.full_name}`}
      className="group grid min-h-14 w-full min-w-0 content-start gap-1 rounded-md border border-transparent bg-background/60 px-2 py-1.5 text-right transition-colors hover:border-primary/25 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      type="button"
      onClick={onEdit}
    >
      {items.length ? (
        <>
          {items.slice(0, 2).map((item) => <EquipmentDisplayLine item={item} key={item.id} />)}
          {items.length > 2 ? (
            <span className="text-[0.66rem] font-medium text-primary">+{items.length - 2} נוספים</span>
          ) : null}
        </>
      ) : (
        <>
          <span className="text-muted-foreground">אין</span>
          <span className="text-[0.66rem] font-medium text-primary">לחץ להוספה</span>
        </>
      )}
      {items.length ? (
        <span className="text-[0.66rem] font-medium text-primary opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          לחץ לעריכה
        </span>
      ) : null}
    </button>
  );
}

function EquipmentDisplayLine({ item }: { item: PersonListEquipmentItem }) {
  const details = [item.model, item.serial_number ? `צ׳ ${item.serial_number}` : null].filter(Boolean).join(" · ");

  return (
    <span className="grid min-w-0 gap-0.5 rounded bg-muted/45 px-1.5 py-1">
      <span className="truncate font-semibold text-foreground">{item.equipmentType?.name ?? "ציוד"}</span>
      <span className="truncate text-muted-foreground">{details || equipmentStatusLabel(item.status)}</span>
    </span>
  );
}

function equipmentStatusLabel(status: PersonListEquipmentItem["status"]) {
  if (status === "damaged") {
    return "פגום";
  }

  if (status === "lost") {
    return "אבד";
  }

  return "משויך";
}

function EquipmentEditDialog({
  category,
  data,
  onClose,
  person,
}: {
  category: EquipmentType["category"];
  data: TeamManagementData;
  onClose: () => void;
  person: TeamManagementData["people"][number];
}) {
  const types = data.equipmentTypes.filter((type) => type.category === category && type.is_active);
  const items = person.equipment.filter((item) => (item.equipmentType?.category ?? "OTHER") === category);
  const assignEquipment = assignEquipmentAction.bind(null, data.team.slug, person.id);

  return (
    <>
      <button
        aria-label="סגירת עריכת ציוד"
        className="fixed inset-0 z-40 bg-background/35 backdrop-blur-[2px]"
        type="button"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 max-h-[82vh] overflow-auto rounded-xl border bg-card p-4 text-right shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[34rem] sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{person.full_name}</p>
            <h3 className="text-lg font-semibold">{equipmentCategoryLabels[category]}</h3>
          </div>
          <Button aria-label="סגירה" size="icon" type="button" variant="outline" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="grid gap-2">
          {items.length ? (
            items.map((item) => (
              <EquipmentQuickEditForm
                item={item}
                key={item.id}
                personId={person.id}
                teamSlug={data.team.slug}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              אין עדיין ציוד בקטגוריה הזו.
            </p>
          )}
        </div>

        {types.length ? (
          <form action={assignEquipment} className="mt-4 grid gap-2 rounded-lg border border-dashed bg-background/70 p-3">
            <input name="return_to" type="hidden" value="team" />
            <p className="text-sm font-semibold">הוספת {equipmentCategoryLabels[category]}</p>
            <CompactSelect aria-label="סוג ציוד" name="equipment_type_id">
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </CompactSelect>
            <div className="grid grid-cols-2 gap-2">
              <CompactInput name="model" placeholder="דגם" />
              <CompactInput className="kav-num" name="serial_number" placeholder="צ׳" />
            </div>
            <input name="status" type="hidden" value="assigned" />
            <Button className="h-9 px-3 text-sm" size="sm" type="submit">הוסף</Button>
          </form>
        ) : null}
      </section>
    </>
  );
}

function EquipmentQuickEditForm({
  item,
  personId,
  teamSlug,
}: {
  item: PersonListEquipmentItem;
  personId: string;
  teamSlug: string;
}) {
  const update = quickUpdateEquipmentAction.bind(null, teamSlug, personId, item.id);

  return (
    <form action={update} className="grid gap-2 rounded-lg border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{item.equipmentType?.name ?? "ציוד"}</p>
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-[0.68rem] text-muted-foreground">{equipmentStatusLabel(item.status)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CompactInput defaultValue={item.model ?? ""} name="model" placeholder="דגם" />
        <CompactInput className="kav-num" defaultValue={item.serial_number ?? ""} name="serial_number" placeholder="צ׳" />
      </div>
      <CompactSelect defaultValue={item.status} name="status" aria-label="סטטוס">
        <option value="assigned">משויך</option>
        <option value="damaged">פגום</option>
        <option value="lost">אבד</option>
      </CompactSelect>
      <Button className="h-9 px-3 text-sm" size="sm" type="submit" variant="secondary">שמור</Button>
    </form>
  );
}

function CompactInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-9 min-w-0 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30", className)} {...props} />;
}

function CompactSelect(props: React.ComponentProps<"select">) {
  return <select className="h-9 min-w-0 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30" {...props} />;
}

function Select({
  children,
  disabled,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
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

function TextArea({ defaultValue, label, name }: { defaultValue?: string; label: string; name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function summarizeEquipment(equipment: TeamManagementData["people"][number]["equipment"]) {
  return {
    amral: summarizeEquipmentCategory(equipment, "AMRAL"),
    optic: summarizeEquipmentCategory(equipment, "OPTIC"),
    other: summarizeEquipmentCategory(equipment, "OTHER"),
    pakal: summarizeEquipmentCategory(equipment, "PAKAL"),
    weapon: summarizeEquipmentCategory(equipment, "WEAPON"),
  };
}

function summarizeEquipmentCategory(
  equipment: TeamManagementData["people"][number]["equipment"],
  category: "AMRAL" | "OPTIC" | "OTHER" | "PAKAL" | "WEAPON",
) {
  const items = equipment.filter((item) => item.equipmentType?.category === category);
  const models = items.map((item) => item.model || item.equipmentType?.name).filter(Boolean).join(", ");
  const serials = items.map((item) => item.serial_number).filter(Boolean).join(", ");

  return {
    models: models || "אין",
    serials: serials || "אין",
  };
}

function ContactLinks({ email, phone }: { email: string | null; phone: string | null }) {
  if (!email && !phone) {
    return <span className="text-muted-foreground">אין</span>;
  }

  return (
    <div className="flex gap-1">
      {phone ? (
        <a
          aria-label="חיוג"
          className="flex size-8 items-center justify-center rounded-md border hover:bg-accent"
          href={`tel:${phone}`}
        >
          <Phone className="size-4" />
        </a>
      ) : null}
      {email ? (
        <a
          aria-label="אימייל"
          className="flex size-8 items-center justify-center rounded-md border hover:bg-accent"
          href={`mailto:${email}`}
        >
          <Mail className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "muted"}>{active ? "פעיל" : "לא פעיל"}</Badge>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed bg-card p-8 text-center">
      <UserRound className="size-8 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function normalize(value: string | null) {
  return (value ?? "").trim().toLocaleLowerCase("he-IL");
}

function activeCount(data: TeamManagementData) {
  return data.people.filter((person) => person.is_active).length;
}

function equipmentItemCount(people: TeamManagementData["people"]) {
  return people.reduce((count, person) => count + person.equipment.length, 0);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

function teamEquipmentBadgeVariant(status: TeamManagementData["teamEquipment"][number]["status"]) {
  if (status === "in_use") return "success";
  if (status === "available") return "info";
  if (status === "damaged") return "warning";
  if (status === "lost") return "danger";
  return "muted";
}

function teamEquipmentStatusLabel(status: TeamManagementData["teamEquipment"][number]["status"]) {
  const labels: Record<TeamManagementData["teamEquipment"][number]["status"], string> = {
    available: "זמין בצוות",
    damaged: "תקול",
    in_use: "באחריות",
    lost: "אבד",
    retired: "יצא משימוש",
  };

  return labels[status];
}
