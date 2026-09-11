"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Check, CircleMinus, MessageCircle, RotateCcw, Send } from "lucide-react";

import {
  markAttendanceInlineAction,
  markExpectedPresentInlineAction,
  submitAttendanceInlineAction,
} from "@/app/[teamSlug]/attendance/actions";
import { SectionHeader } from "@/components/ui/app-page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OperationalPerson } from "@/lib/kav/operations";
import { cn } from "@/lib/utils";

type AttendanceState = OperationalPerson["resolution"]["attendance"];

export function AttendanceWorkspace({
  attendanceDayStatus,
  date,
  initialPeople,
  teamSlug,
}: {
  attendanceDayStatus: string | null;
  date: string;
  initialPeople: OperationalPerson[];
  teamSlug: string;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [status, setStatus] = useState(attendanceDayStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [savingPeople, setSavingPeople] = useState<Set<string>>(() => new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const summary = useMemo(() => attendanceSummary(people), [people]);
  const reportText = useMemo(() => attendanceReportText(people, date), [date, people]);
  const reportContacts = useMemo(() => people.filter((person) => person.phone), [people]);

  function setPersonSaving(personId: string, saving: boolean) {
    setSavingPeople((current) => {
      const next = new Set(current);
      if (saving) next.add(personId);
      else next.delete(personId);
      return next;
    });
  }

  function updatePerson(personId: string, state: AttendanceState) {
    let previous: OperationalPerson | undefined;
    setMessage(null);
    setPersonSaving(personId, true);
    setPeople((current) => current.map((person) => {
      if (person.id !== personId) return person;
      previous = person;
      return withAttendance(person, state);
    }));

    startBulkTransition(async () => {
      const result = await markAttendanceInlineAction(teamSlug, { date, personId, state });
      setPersonSaving(personId, false);
      if (!result.ok) {
        setMessage(result.message ?? "לא הצלחנו לעדכן את הנוכחות. נסה שוב.");
        if (previous) {
          setPeople((current) => current.map((person) => person.id === personId ? previous! : person));
        }
      }
    });
  }

  function markAllPresent() {
    const previous = people;
    setMessage(null);
    setPeople((current) => current.map((person) => withAttendance(person, "present")));
    startBulkTransition(async () => {
      const result = await markExpectedPresentInlineAction(teamSlug, { date });
      if (!result.ok) {
        setMessage(result.message ?? "לא הצלחנו לסמן את הצוות כנוכח. נסה שוב.");
        setPeople(previous);
      }
    });
  }

  function submitAttendance() {
    setMessage(null);
    startBulkTransition(async () => {
      const result = await submitAttendanceInlineAction(teamSlug, { date });
      if (result.ok) {
        setStatus("submitted");
      } else {
        setMessage(result.message ?? "לא הצלחנו לסיים דיווח. נסה שוב.");
      }
    });
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg bg-primary !text-white">
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-white/15">
          <Metric label="צוות" value={summary.total} />
          <Metric label="נוכחים" value={summary.present} />
          <Metric label="לא נוכחים" value={summary.absent} />
          <Metric label="טרם דווחו" value={summary.unreported} />
        </div>
        <div className="flex flex-col gap-2 border-t border-white/15 p-3 sm:flex-row">
          <Button
            className="w-full flex-1 border-white/20 bg-white/10 text-white hover:bg-white/15 active:bg-white/20"
            disabled={bulkPending}
            loadingOverlay={false}
            onClick={markAllPresent}
            type="button"
          >
            <Check className="size-4" />
            סמן את כל הצוות כנוכח
          </Button>
          <Button
            className="w-full flex-1 border-white/30 bg-white text-primary hover:bg-white/90 active:bg-white/80"
            disabled={bulkPending || status === "submitted"}
            loadingOverlay={false}
            onClick={submitAttendance}
            type="button"
            variant="outline"
          >
            <Send className="size-4" />
            {bulkPending ? "שומר..." : status === "submitted" ? "דווח" : "סיום ודיווח"}
          </Button>
        </div>
      </section>

      {message ? (
        <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
          {message}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        <WhatsAppReport contacts={reportContacts} reportText={reportText} />
        <Roster
          date={date}
          onChange={updatePerson}
          people={people}
          savingPeople={savingPeople}
        />
      </div>
    </>
  );
}

function Roster({
  date,
  onChange,
  people,
  savingPeople,
}: {
  date: string;
  onChange: (personId: string, state: AttendanceState) => void;
  people: OperationalPerson[];
  savingPeople: Set<string>;
}) {
  return (
    <section>
      <SectionHeader hint={`${people.length}`} title="כל הצוות" />
      {people.length ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="divide-y">
            {people.map((person) => (
              <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={`${date}-${person.id}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="block truncate text-sm">{person.full_name}</b>
                    {person.personal_number ? <span className="kav-num text-xs text-muted-foreground">{person.personal_number}</span> : null}
                    <ReportStatusBadge person={person} />
                    {savingPeople.has(person.id) ? <Badge variant="info">שומר</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {person.resolution.leave ? <Badge variant="warning">בקשת יציאה מאושרת</Badge> : null}
                    {person.resolution.attendanceSource === "yesterday" ? <Badge variant="info">לפי אתמול</Badge> : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                  <AttendanceButton icon={<Check className="size-4" />} label="נוכח" onChange={onChange} person={person} state="present" />
                  <AttendanceButton icon={<CircleMinus className="size-4" />} label="לא נוכח" onChange={onChange} person={person} state="absent" />
                  <AttendanceButton icon={<RotateCcw className="size-4" />} label="איפוס" onChange={onChange} person={person} state="unreported" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-14 items-center rounded-lg border bg-card px-3.5 text-sm text-muted-foreground">אין אנשי צוות פעילים</div>
      )}
    </section>
  );
}

function AttendanceButton({
  icon,
  label,
  onChange,
  person,
  state,
}: {
  icon: ReactNode;
  label: string;
  onChange: (personId: string, state: AttendanceState) => void;
  person: OperationalPerson;
  state: AttendanceState;
}) {
  const active = person.resolution.attendance === state;
  return (
    <Button
      aria-label={`${label} - ${person.full_name}`}
      className={cn(
        "h-10 w-full border-transparent px-2 active:ring-2 active:ring-primary/20",
        active && state === "present" && "bg-success-soft text-success shadow-sm",
        active && state === "absent" && "bg-red-50 text-destructive shadow-sm",
        active && state === "unreported" && "bg-card text-foreground shadow-sm",
      )}
      loadingOverlay={false}
      onClick={() => onChange(person.id, state)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {icon}
      <span className="hidden min-[390px]:inline">{label}</span>
    </Button>
  );
}

function WhatsAppReport({ contacts, reportText }: { contacts: OperationalPerson[]; reportText: string }) {
  return (
    <section className="rounded-lg border bg-card p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">דוח וואטסאפ</h2>
          <p className="mt-1 text-sm text-muted-foreground">טקסט מוכן לשליחה עם כל הצוות וסיכום נוכחים.</p>
        </div>
        <a className={buttonVariants()} href={whatsAppHref(reportText)} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" />
          שליחה בוואטסאפ
        </a>
      </div>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-right text-sm leading-7">{reportText}</pre>
      {contacts.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {contacts.map((person) => (
            <a className={buttonVariants({ size: "sm", variant: "outline" })} href={whatsAppHref(reportText, person.phone)} key={person.id} target="_blank" rel="noreferrer">
              שליחה ל{person.full_name}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReportStatusBadge({ person }: { person: OperationalPerson }) {
  const status = attendanceReportStatus(person);
  const variant = status === "נוכח" ? "success" : status === "לא נוכח" ? "danger" : "muted";
  return <Badge variant={variant}>{status}</Badge>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 p-3 text-center"><div className="kav-num text-2xl font-bold">{value}</div><div className="mt-0.5 truncate text-[11px] text-white/65">{label}</div></div>;
}

function withAttendance(person: OperationalPerson, attendance: AttendanceState): OperationalPerson {
  return {
    ...person,
    resolution: {
      ...person.resolution,
      attendance,
      attendanceSource: undefined,
      discrepancy: null,
    },
  };
}

function attendanceReportText(people: OperationalPerson[], date: string) {
  const lines = [
    "*דוח 1 ניוד*",
    shortReportDate(date),
    ...people.map((person, index) => {
      const personalNumber = person.personal_number ? ` ${person.personal_number}` : "";
      return `${index + 1}.${person.full_name}${personalNumber} - ${attendanceReportStatus(person)}`;
    }),
    `נוכחים: ${people.filter((person) => person.resolution.attendance === "present").length}`,
  ];

  return lines.join("\n");
}

function attendanceReportStatus(person: OperationalPerson) {
  if (person.resolution.attendance === "present") return "נוכח";
  if (person.resolution.attendance === "absent") return "לא נוכח";
  return "טרם דווח";
}

function attendanceSummary(people: OperationalPerson[]) {
  return {
    absent: people.filter((person) => person.resolution.attendance === "absent").length,
    present: people.filter((person) => person.resolution.attendance === "present").length,
    total: people.length,
    unreported: people.filter((person) => person.resolution.attendance === "unreported").length,
  };
}

function shortReportDate(date: string) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function whatsAppHref(text: string, phone?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  const target = normalizedPhone ? `https://wa.me/${normalizedPhone}` : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(text)}`;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}
