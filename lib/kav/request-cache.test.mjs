import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const authSource = readFileSync(join(__dirname, "auth.ts"), "utf-8");
const teamsSource = readFileSync(join(__dirname, "teams.ts"), "utf-8");
const dashboardSource = readFileSync(join(__dirname, "dashboard.ts"), "utf-8");
const operationsSource = readFileSync(join(__dirname, "operations.ts"), "utf-8");
const scheduleSource = readFileSync(join(__dirname, "schedule.ts"), "utf-8");
const scheduleActionsSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "schedule", "actions.ts"), "utf-8");
const scheduleViewSource = readFileSync(join(__dirname, "..", "..", "components", "schedule-view.tsx"), "utf-8");
const tasksSource = readFileSync(join(__dirname, "tasks.ts"), "utf-8");
const teamManagementSource = readFileSync(join(__dirname, "team-management.ts"), "utf-8");

test("auth and team access use request-scoped React cache", () => {
  assert.match(authSource, /import \{ cache \} from "react"/);
  assert.match(authSource, /export const requireAuth = cache/);
  assert.match(teamsSource, /import \{ cache \} from "react"/);
  assert.match(teamsSource, /export const getUserTeams = cache/);
  assert.match(teamsSource, /export const requireTeamAccess = cache/);
});

test("private auth data is not stored in the persistent Next cache", () => {
  assert.doesNotMatch(authSource, /unstable_cache|use cache/);
  assert.doesNotMatch(teamsSource, /unstable_cache|use cache/);
});

test("main page data loaders are request cached across the app", () => {
  for (const [source, exportName] of [
    [dashboardSource, "getDashboardData"],
    [operationsSource, "getOperationalRange"],
    [operationsSource, "getOperationalDay"],
    [scheduleSource, "getScheduleData"],
    [tasksSource, "getTasksData"],
    [tasksSource, "getTaskDaySchedule"],
    [teamManagementSource, "getTeamManagementData"],
    [teamManagementSource, "getPersonProfileData"],
  ]) {
    assert.match(source, new RegExp(`export const ${exportName} = cache`), `${exportName} should use request cache`);
  }
});

test("dashboard does not run the separate operational summary query path", () => {
  assert.doesNotMatch(dashboardSource, /getOperationalScheduleSummary/);
  assert.match(operationsSource, /rotationStatus:/);
});

test("schedule month and view switches stay on the current client page", () => {
  assert.match(scheduleViewSource, /function switchSchedule/);
  assert.match(scheduleViewSource, /window\.history\.pushState/);
  assert.match(scheduleViewSource, /setActiveMonth/);
  assert.match(scheduleViewSource, /setActiveView/);
});

test("schedule mobile day tap opens an in-page day preview", () => {
  assert.match(scheduleViewSource, /function DayPreview/);
  assert.match(scheduleViewSource, /aria-haspopup="dialog"/);
  assert.match(scheduleViewSource, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(scheduleViewSource, /בקשות יציאה/);
});

test("reserve period management is admin-only while operational management remains broader", () => {
  assert.match(teamsSource, /export function canManageReservePeriods/);
  assert.match(scheduleSource, /canManageReservePeriods:/);
  assert.match(scheduleViewSource, /data\.canManageReservePeriods/);
  assert.match(scheduleActionsSource, /export async function createReservePeriodAction[\s\S]*adminContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function publishReservePeriodAction[\s\S]*adminContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function saveRotationOverrideAction[\s\S]*managerContext\(teamSlug\)/);
});
