"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TasksData } from "@/lib/kav/tasks";

type RequirementDraft = {
  pakalTypeId: string;
  requiredCount: number;
  requirementType: "any_person" | "pakal";
  roleLabel: string;
};

type TaskDraft = {
  date: string;
  endsOn: string;
  endsTime: string;
  id?: string;
  location: string;
  notes: string;
  requirements: RequirementDraft[];
  startsTime: string;
  templateId: string;
  title: string;
};

export function TaskForm({
  action,
  data,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  data: TasksData;
  initial?: TaskDraft;
}) {
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startsTime, setStartsTime] = useState(initial?.startsTime ?? "08:00");
  const [endsTime, setEndsTime] = useState(initial?.endsTime ?? "10:00");
  const [requirements, setRequirements] = useState<RequirementDraft[]>(initial?.requirements ?? [emptyRequirement()]);
  const requirementsByTemplate = useMemo(() => new Map(data.taskTemplates.map((template) => [
    template.id,
    data.templateRequirements.filter((requirement) => requirement.task_template_id === template.id),
  ])), [data.taskTemplates, data.templateRequirements]);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const template = data.taskTemplates.find((item) => item.id === id);
    if (!template) return;
    setTitle(template.name);
    setLocation(template.default_location ?? "");
    const defaults = requirementsByTemplate.get(id) ?? [];
    setRequirements(defaults.length ? defaults.map((item) => ({
      pakalTypeId: item.pakal_type_id ?? "",
      requiredCount: item.required_count,
      requirementType: item.requirement_type,
      roleLabel: item.role_label,
    })) : [emptyRequirement()]);
    if (template.default_duration_minutes) setEndsTime(addMinutes(startsTime, template.default_duration_minutes));
  }

  return <form action={action} className="grid gap-4">
    {initial?.id ? <input name="task_id" type="hidden" value={initial.id} /> : null}
    <input name="reserve_period_id" type="hidden" value={data.selectedPeriod?.id ?? ""} />
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="תבנית">
        <select className={selectClass} name="task_template_id" value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
          <option value="">ללא תבנית</option>
          {data.taskTemplates.filter((template) => template.is_active).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </Field>
      <Field label="שם המשימה"><Input maxLength={120} name="title" required value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="תאריך"><Input min={data.selectedPeriod?.starts_on} max={data.selectedPeriod?.ends_on} name="date" required type="date" defaultValue={initial?.date ?? data.weekStartsOn} /></Field>
      <Field label="מיקום"><Input name="location" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
      <Field label="התחלה"><Input name="starts_time" required type="time" value={startsTime} onChange={(event) => setStartsTime(event.target.value)} /></Field>
      <Field label="סיום"><Input name="ends_time" required type="time" value={endsTime} onChange={(event) => setEndsTime(event.target.value)} /></Field>
      <Field label="תאריך סיום, אם חוצה יום"><Input name="ends_on" type="date" defaultValue={initial?.endsOn ?? ""} /></Field>
      <Field label="הערות"><Input name="notes" defaultValue={initial?.notes ?? ""} /></Field>
    </div>
    <RequirementFields pakalTypes={data.pakalTypes} requirements={requirements} setRequirements={setRequirements} />
    <Button className="w-fit">{initial ? "שמירת שינויים" : "יצירת משימה"}</Button>
  </form>;
}

export function TemplateForm({
  action,
  data,
  templateId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  data: TasksData;
  templateId?: string;
}) {
  const template = data.taskTemplates.find((item) => item.id === templateId);
  const initialRequirements = template ? data.templateRequirements.filter((item) => item.task_template_id === template.id) : [];
  const [requirements, setRequirements] = useState<RequirementDraft[]>(initialRequirements.length ? initialRequirements.map((item) => ({
    pakalTypeId: item.pakal_type_id ?? "",
    requiredCount: item.required_count,
    requirementType: item.requirement_type,
    roleLabel: item.role_label,
  })) : [emptyRequirement()]);
  return <form action={action} className="grid gap-4">
    {template ? <input name="template_id" type="hidden" value={template.id} /> : null}
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="שם"><Input name="name" required defaultValue={template?.name ?? ""} /></Field>
      <Field label="משך ברירת מחדל בדקות"><Input min={1} max={1440} name="default_duration_minutes" type="number" defaultValue={template?.default_duration_minutes ?? 60} /></Field>
      <Field label="מיקום ברירת מחדל"><Input name="default_location" defaultValue={template?.default_location ?? ""} /></Field>
      <Field label="תיאור"><Input name="description" defaultValue={template?.description ?? ""} /></Field>
    </div>
    <input name="is_active" type="hidden" value="on" />
    <RequirementFields pakalTypes={data.pakalTypes} requirements={requirements} setRequirements={setRequirements} />
    <Button className="w-fit">שמירת תבנית</Button>
  </form>;
}

function RequirementFields({
  pakalTypes,
  requirements,
  setRequirements,
}: {
  pakalTypes: TasksData["pakalTypes"];
  requirements: RequirementDraft[];
  setRequirements: React.Dispatch<React.SetStateAction<RequirementDraft[]>>;
}) {
  function update(index: number, patch: Partial<RequirementDraft>) {
    setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return <section className="border-t pt-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold">דרישות כוח אדם</h3>
      <Button aria-label="הוספת דרישה" size="icon" type="button" variant="outline" onClick={() => setRequirements((current) => [...current, emptyRequirement()])}>
        <Plus className="size-4" />
      </Button>
    </div>
    <div className="grid gap-2">
      {requirements.map((requirement, index) => <div className="grid items-end gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_6rem_1fr_2.5rem]" key={index}>
        <Field label="סוג">
          <select className={selectClass} name="requirement_type" value={requirement.requirementType} onChange={(event) => update(index, { requirementType: event.target.value as RequirementDraft["requirementType"] })}>
            <option value="any_person">כל איש צוות</option><option value="pakal">פק״ל</option>
          </select>
        </Field>
        <Field label="פק״ל">
          <select className={selectClass} name="pakal_type_id" value={requirement.pakalTypeId} onChange={(event) => update(index, { pakalTypeId: event.target.value })}>
            <option value="">ללא</option>{pakalTypes.map((pakal) => <option key={pakal.id} value={pakal.id}>{pakal.name}</option>)}
          </select>
        </Field>
        <Field label="כמות"><Input min={1} max={50} name="required_count" required type="number" value={requirement.requiredCount} onChange={(event) => update(index, { requiredCount: Number(event.target.value) })} /></Field>
        <Field label="תווית תפקיד"><Input name="role_label" required value={requirement.roleLabel} onChange={(event) => update(index, { roleLabel: event.target.value })} /></Field>
        <Button aria-label="הסרת דרישה" disabled={requirements.length === 1} size="icon" type="button" variant="ghost" onClick={() => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
          <Trash2 className="size-4" />
        </Button>
      </div>)}
    </div>
  </section>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}{children}</label>;
}

function emptyRequirement(): RequirementDraft {
  return { pakalTypeId: "", requiredCount: 1, requirementType: "any_person", roleLabel: "כל איש צוות" };
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour * 60 + minute + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const selectClass = "h-10 w-full rounded-md border bg-background px-2 text-sm";
