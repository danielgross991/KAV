import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const attendancePageSource = readFileSync(join(root, "app", "[teamSlug]", "attendance", "page.tsx"), "utf-8");
const attendanceActionsSource = readFileSync(join(root, "app", "[teamSlug]", "attendance", "actions.ts"), "utf-8");
const attendanceWorkspaceSource = readFileSync(join(root, "components", "attendance-workspace.tsx"), "utf-8");
const operationsSource = readFileSync(join(root, "lib", "kav", "operations.ts"), "utf-8");

test("attendance page renders one roster for the whole team", () => {
  assert.match(attendancePageSource, /<AttendanceWorkspace/);
  assert.match(attendanceWorkspaceSource, /title="כל הצוות"/);
  assert.match(attendanceWorkspaceSource, /title="מדורכים \/ מיוחדים"/);
  assert.doesNotMatch(attendanceWorkspaceSource, /title="צפויים בבסיס"/);
  assert.doesNotMatch(attendanceWorkspaceSource, /נוכחות חריגה/);
  assert.doesNotMatch(attendanceWorkspaceSource, /stateLabel/);
  assert.doesNotMatch(attendanceWorkspaceSource, /title="יציאות מאושרות"/);
});

test("attendance WhatsApp report includes personal numbers and total present count", () => {
  assert.match(attendanceWorkspaceSource, /function attendanceReportText/);
  assert.match(attendanceWorkspaceSource, /person\.personal_number/);
  assert.match(attendanceWorkspaceSource, /נוכחים:/);
  assert.match(attendanceWorkspaceSource, /https:\/\/wa\.me\//);
});

test("attendance defaults unresolved rows from yesterday and lets managers edit today", () => {
  assert.match(attendancePageSource, /applyYesterdayAttendanceDefaults/);
  assert.match(attendancePageSource, /getOperationalDay\(supabase, membership\.team, addCalendarDays\(date, -1\), undefined, false, true\)/);
  assert.match(attendanceWorkspaceSource, /attendanceSource === "yesterday"/);
  assert.match(attendanceWorkspaceSource, /לפי אתמול/);
  assert.match(attendanceWorkspaceSource, /סמן את כל הצוות כנוכח/);
  assert.match(attendanceWorkspaceSource, /Metric label="צוות"/);
  assert.match(attendanceWorkspaceSource, /Metric label="מדורכים"/);
  assert.match(attendanceActionsSource, /seedMissingAttendanceFromYesterday/);
  assert.match(attendanceActionsSource, /source: "schedule_default"/);
  assert.doesNotMatch(attendanceActionsSource, /source: "previous_day_default"/);
  assert.match(attendanceActionsSource, /getOperationalDay\(context\.supabase, context\.team, addCalendarDays\(date, -1\), undefined, false, true\)/);
  assert.match(attendanceActionsSource, /activePeople = day\.people\.filter/);
  assert.doesNotMatch(attendanceActionsSource, /filter\(\(person\) => person\.resolution\.expectedAtBase\)/);
});

test("operational attendance data loads contact fields for manager reports", () => {
  assert.match(operationsSource, /"full_name" \| "id" \| "is_active" \| "phone"/);
  assert.match(operationsSource, /personal_number: string \| null/);
  assert.match(operationsSource, /includeContactDetails = false/);
  assert.match(operationsSource, /person_private_details/);
  assert.match(operationsSource, /select\("person_id, personal_number"\)/);
  assert.match(attendancePageSource, /getOperationalDay\(supabase, membership\.team, date, undefined, true, true\)/);
  assert.match(operationsSource, /includeLineSpecialPeople = false/);
  assert.match(operationsSource, /lineParticipation: inactivePersonIds\.has\(person\.id\) \? "special"/);
});

test("attendance row changes use optimistic inline actions instead of full form reloads", () => {
  assert.match(attendanceActionsSource, /export async function markAttendanceInlineAction/);
  assert.match(attendanceActionsSource, /export async function markExpectedPresentInlineAction/);
  assert.match(attendanceActionsSource, /export async function submitAttendanceInlineAction/);
  assert.match(attendanceWorkspaceSource, /useTransition/);
  assert.match(attendanceWorkspaceSource, /setPeople\(\(current\) => current\.map/);
  assert.match(attendanceWorkspaceSource, /loadingOverlay=\{false\}/);
  assert.doesNotMatch(attendanceWorkspaceSource, /<form action=\{markAttendanceAction/);
});

test("absent attendance on a base day creates a traceable approved leave request when missing", () => {
  assert.match(attendanceActionsSource, /ensureAutomaticLeaveForAbsence/);
  assert.match(attendanceActionsSource, /state === "absent"/);
  assert.match(attendanceActionsSource, /person\.resolution\.plannedState !== "base"/);
  assert.match(attendanceActionsSource, /\.lte\("starts_on", date\)/);
  assert.match(attendanceActionsSource, /\.gte\("ends_on", date\)/);
  assert.match(attendanceActionsSource, /\.in\("status", \["pending", "approved", "partially_approved"\]\)/);
  assert.match(attendanceActionsSource, /status: "approved"/);
  assert.match(attendanceActionsSource, /approved_starts_on: date/);
  assert.match(attendanceActionsSource, /approved_ends_on: date/);
  assert.match(attendanceActionsSource, /נוצר אוטומטית מדיווח נוכחות/);
  assert.match(attendanceActionsSource, /leave\.request_created/);
});
