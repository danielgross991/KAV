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
