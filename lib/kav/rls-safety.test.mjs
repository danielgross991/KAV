import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// These modules serve BOTH managers and ordinary viewers (dashboard, calendar, person
// profile). attendance_days/attendance_entries are manager-only-SELECT in production,
// while raw leave_requests are intentionally limited to manager rows or the viewer's own
// rows. A direct read here would either fail for viewers or accidentally narrow team-wide
// facts to one person. The only sanctioned way to reach these operational facts is through the
// safe RPCs in supabase/migrations/20260828150500_phase7_safe_operational_facts_rpcs.sql.
// This is a regression guard, not a full RLS test (that requires a live database) — it
// enforces "ordinary viewer cannot [be made to] query raw attendance/leave" at the
// source-code level, which is the only place this repo can check it without a DB.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_TABLE_READ = /\.from\(\s*["'](attendance_days|attendance_entries|leave_requests)["']\s*\)/;

const VIEWER_FACING_MODULES = ["operations.ts", "schedule.ts", "team-management.ts", "stats.ts", "dashboard.ts"];

function stripLineComments(source) {
  return source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
}

for (const filename of VIEWER_FACING_MODULES) {
  test(`${filename} never reads attendance_days/attendance_entries/leave_requests directly`, () => {
    const source = stripLineComments(readFileSync(join(__dirname, filename), "utf-8"));
    const match = source.match(FORBIDDEN_TABLE_READ);
    assert.equal(
      match,
      null,
      `${filename} contains a direct .from("${match?.[1]}") read — this bypasses the safe `
        + "RPC layer and will silently return empty results for a viewer session. Use the "
        + "get_team_approved_leave_windows / get_team_attendance_entries / "
        + "get_team_attendance_day_status / get_person_attendance_summary RPCs instead.",
    );
  });
}

const migrationSource = [
  "20260828150500_phase7_safe_operational_facts_rpcs.sql",
  "20260830120000_phase7_leave_request_markers_rpc.sql",
  "20260831082515_viewer_self_service_access.sql",
].map((filename) => readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", filename),
  "utf-8",
)).join("\n");

const SAFE_RPCS = [
  "get_team_approved_leave_windows",
  "get_team_attendance_entries",
  "get_team_attendance_day_status",
  "get_team_leave_request_markers",
  "get_person_attendance_summary",
];

// Columns that must never appear in any of these functions' output — leave reasons/manager
// notes, attendance free-text notes/source/submitted_by, and unrelated private-table columns.
const FORBIDDEN_COLUMNS = [
  "reason", "manager_notes", "notes", "source", "submitted_by", "submitted_at",
  "serial_number", "personal_number", "national_id", "private_notes",
];

for (const rpcName of SAFE_RPCS) {
  test(`${rpcName}: SECURITY DEFINER implementation lives in the private (non-exposed) schema`, () => {
    assert.match(
      migrationSource,
      new RegExp(`create or replace function private\\.${rpcName}\\([\\s\\S]*?security definer`),
      `private.${rpcName} must exist and be SECURITY DEFINER — the privileged, RLS-bypassing `
        + "read must not live directly in the exposed public schema.",
    );
  });

  test(`${rpcName}: public wrapper is SECURITY INVOKER, not DEFINER`, () => {
    const publicFunctionPattern = new RegExp(
      `create or replace function public\\.${rpcName}\\([\\s\\S]*?\\$\\$;`,
      "g",
    );
    const publicFunctionMatches = [...migrationSource.matchAll(publicFunctionPattern)].map((match) => match[0]);
    const publicFunction = publicFunctionMatches.at(-1);
    assert.ok(publicFunction, `expected a public.${rpcName} wrapper function`);
    assert.match(publicFunction, /security invoker/,
      `public.${rpcName} must be SECURITY INVOKER — it should hold no elevated privilege of `
        + "its own and only forward to the private definer function.");
    assert.doesNotMatch(publicFunction, /security definer/,
      `public.${rpcName} must not itself be SECURITY DEFINER.`);
  });

  test(`${rpcName}: revoked from anon/public, granted only to authenticated`, () => {
    assert.match(
      migrationSource,
      new RegExp(`revoke all on function public\\.${rpcName}\\([^)]*\\) from public, anon;`),
    );
    assert.match(
      migrationSource,
      new RegExp(`grant execute on function public\\.${rpcName}\\([^)]*\\) to authenticated;`),
      `${rpcName} must be callable by any authenticated team member, not managers only — `
        + "this is what makes viewer aggregates possible.",
    );
  });

  test(`${rpcName}: output never includes a private/sensitive column`, () => {
    const definitionPattern = new RegExp(
      `create or replace function private\\.${rpcName}\\([\\s\\S]*?\\$\\$;`,
      "g",
    );
    const definition = [...migrationSource.matchAll(definitionPattern)].map((match) => match[0]).at(-1);
    assert.ok(definition, `expected to find the private.${rpcName} definition`);
    for (const forbidden of FORBIDDEN_COLUMNS) {
      assert.doesNotMatch(
        definition,
        new RegExp(`\\b${forbidden}\\b`),
        `private.${rpcName} must never select/return "${forbidden}"`,
      );
    }
  });
}

test("the leave-windows RPC filters to approved/partially_approved statuses only", () => {
  const [definition] = migrationSource.match(
    /create or replace function private\.get_team_approved_leave_windows\([\s\S]*?\$\$;/,
  ) ?? [];
  assert.match(definition, /status in \('approved', 'partially_approved'\)/);
});

test("the leave request marker RPC is active-team-member scoped without sensitive details", () => {
  const definition = [...migrationSource.matchAll(
    /create or replace function private\.get_team_leave_request_markers\([\s\S]*?\$\$;/g,
  )].map((match) => match[0]).at(-1);
  assert.match(definition, /tm\.is_active/);
  assert.doesNotMatch(definition, /tm\.role in \('admin', 'manager'\)/);
});

test("viewer leave insert policy is constrained to the viewer's own pending request", () => {
  assert.match(migrationSource, /create policy leave_requests_insert_self/);
  assert.match(migrationSource, /status = 'pending'/);
  assert.match(migrationSource, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /p\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /manager_notes is null/);
});

test("every private RPC re-validates team membership itself rather than trusting the caller", () => {
  for (const rpcName of SAFE_RPCS) {
    const [definition] = migrationSource.match(
      new RegExp(`create or replace function private\\.${rpcName}\\([\\s\\S]*?\\$\\$;`),
    ) ?? [];
    assert.match(definition, /from public\.team_memberships tm/, `${rpcName} must check team_memberships`);
    assert.match(definition, /tm\.is_active/, `${rpcName} must require an active membership`);
  }
});
