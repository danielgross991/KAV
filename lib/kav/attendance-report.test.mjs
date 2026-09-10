import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const attendancePageSource = readFileSync(join(root, "app", "[teamSlug]", "attendance", "page.tsx"), "utf-8");
const attendanceActionsSource = readFileSync(join(root, "app", "[teamSlug]", "attendance", "actions.ts"), "utf-8");
const operationsSource = readFileSync(join(root, "lib", "kav", "operations.ts"), "utf-8");

test("attendance page renders one roster for the whole team", () => {
  assert.match(attendancePageSource, /<Roster title="כל הצוות"/);
  assert.doesNotMatch(attendancePageSource, /title="צפויים בבסיס"/);
  assert.doesNotMatch(attendancePageSource, /נוכחות חריגה/);
  assert.doesNotMatch(attendancePageSource, /stateLabel/);
  assert.doesNotMatch(attendancePageSource, /title="יציאות מאושרות"/);
});

test("attendance WhatsApp report includes personal numbers and total present count", () => {
  assert.match(attendancePageSource, /function attendanceReportText/);
  assert.match(attendancePageSource, /person\.personal_number/);
  assert.match(attendancePageSource, /נוכחים:/);
  assert.match(attendancePageSource, /https:\/\/wa\.me\//);
});

test("attendance defaults unresolved rows from yesterday and lets managers edit today", () => {
  assert.match(attendancePageSource, /applyYesterdayAttendanceDefaults/);
  assert.match(attendancePageSource, /getOperationalDay\(supabase, membership\.team, addCalendarDays\(date, -1\)\)/);
  assert.match(attendancePageSource, /attendanceSource === "yesterday"/);
  assert.match(attendancePageSource, /לפי אתמול/);
  assert.match(attendancePageSource, /סמן את כל הצוות כנוכח/);
  assert.match(attendancePageSource, /Metric label="צוות"/);
  assert.match(attendanceActionsSource, /seedMissingAttendanceFromYesterday/);
  assert.match(attendanceActionsSource, /source: "previous_day_default"/);
  assert.match(attendanceActionsSource, /day\.people\.map/);
  assert.doesNotMatch(attendanceActionsSource, /filter\(\(person\) => person\.resolution\.expectedAtBase\)/);
});

test("operational attendance data loads contact fields for manager reports", () => {
  assert.match(operationsSource, /"full_name" \| "id" \| "is_active" \| "phone"/);
  assert.match(operationsSource, /personal_number: string \| null/);
  assert.match(operationsSource, /includeContactDetails = false/);
  assert.match(operationsSource, /person_private_details/);
  assert.match(operationsSource, /select\("person_id, personal_number"\)/);
  assert.match(attendancePageSource, /getOperationalDay\(supabase, membership\.team, date, undefined, true\)/);
});
