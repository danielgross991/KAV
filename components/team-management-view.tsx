"use client";

import Link from "next/link";
import { Mail, Phone, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { createPersonAction } from "@/app/[teamSlug]/team/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeamManagementData } from "@/lib/kav/team-management";

export function TeamManagementView({ data }: { data: TeamManagementData }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [pakal, setPakal] = useState("all");
  const [rotation, setRotation] = useState("all");
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge variant="secondary">{data.team.name}</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-normal">ניהול צוות</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {data.people.length} אנשי צוות, {activeCount(data)} פעילים,{" "}
            {data.pakalTypes.length} פקלים מוגדרים
          </p>
        </div>
        {data.canManageTeam ? (
          <details className="group w-full xl:w-auto">
            <summary className="list-none">
              <Button type="button" className="w-full xl:w-auto">
                <Plus className="size-4" />
                איש צוות
              </Button>
            </summary>
            <Card className="mt-3 xl:w-[30rem]">
              <CardHeader>
                <CardTitle>איש צוות חדש</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createPerson} className="grid gap-3">
                  <Field label="שם מלא" name="full_name" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="טלפון" name="phone" type="tel" />
                    <Field label="אימייל" name="email" type="email" />
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
      </header>

      <section className="mb-4 grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_11rem_13rem_13rem]">
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
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <table className="w-full table-fixed text-right text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="w-[28%] px-4 py-3 font-medium">שם</th>
                  <th className="w-[12%] px-4 py-3 font-medium">סטטוס</th>
                  <th className="w-[27%] px-4 py-3 font-medium">פקלים</th>
                  <th className="w-[17%] px-4 py-3 font-medium">רוטציה</th>
                  <th className="w-[16%] px-4 py-3 font-medium">קשר</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/${data.team.slug}/team/${person.id}`}
                      >
                        {person.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={person.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <PakalChips names={person.pakals.map((item) => item.name)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {person.rotation?.name ?? "אין"}
                    </td>
                    <td className="px-4 py-3">
                      <ContactLinks email={person.email} phone={person.phone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filteredPeople.map((person) => (
              <Card key={person.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        className="text-lg font-semibold text-primary"
                        href={`/${data.team.slug}/team/${person.id}`}
                      >
                        {person.full_name}
                      </Link>
                      <div className="mt-2">
                        <PakalChips names={person.pakals.map((item) => item.name)} />
                      </div>
                    </div>
                    <StatusBadge active={person.is_active} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {person.rotation ? `רוטציה: ${person.rotation.name}` : "אין רוטציה"}
                    </span>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                      href={`/${data.team.slug}/team/${person.id}`}
                    >
                      פתח פרופיל
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
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
  label,
  name,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} type={type} />
    </div>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function PakalChips({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-sm text-muted-foreground">אין פקלים</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {names.slice(0, 4).map((name) => (
        <Badge key={name} variant="outline">
          {name}
        </Badge>
      ))}
      {names.length > 4 ? <Badge variant="muted">+{names.length - 4}</Badge> : null}
    </div>
  );
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
