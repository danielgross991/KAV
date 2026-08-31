import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const loginActionsSource = readFileSync(join(root, "app", "login", "actions.ts"), "utf-8");
const usersActionSource = readFileSync(join(root, "app", "[teamSlug]", "users", "actions.ts"), "utf-8");
const migrationSource = readFileSync(
  join(root, "supabase", "migrations", "20260831093000_email_viewer_auto_link.sql"),
  "utf-8",
);
const cleanupMigrationSource = readFileSync(
  join(root, "supabase", "migrations", "20260831094500_remove_public_email_self_link_rpc.sql"),
  "utf-8",
);

test("email login can create the auth user for a pre-approved team email", () => {
  assert.match(loginActionsSource, /shouldCreateUser:\s*true/);
});

test("admin email linking does not require the Supabase service key", () => {
  assert.doesNotMatch(usersActionSource, /createAdminClient|auth\.admin|SUPABASE_(SECRET|SERVICE_ROLE)_KEY/);
  assert.match(usersActionSource, /\.from\("people"\)[\s\S]*\.update\(\{[\s\S]*email/);
});

test("email linking is handled by an auth trigger, not an exposed RPC endpoint", () => {
  assert.match(migrationSource, /create trigger on_auth_user_email_link_people/);
  assert.match(migrationSource, /after insert or update of email on auth\.users/);
  assert.match(cleanupMigrationSource, /drop function if exists public\.link_current_user_to_people_by_email\(\);/);
});

test("automatic email linking preserves manager and admin roles", () => {
  assert.match(migrationSource, /when public\.team_memberships\.role in \('admin', 'manager'\)/);
  assert.match(migrationSource, /else 'viewer'/);
});
