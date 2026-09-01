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
const photoStorageMigrationSource = readFileSync(
  join(root, "supabase", "migrations", "20260901060158_person_photo_storage.sql"),
  "utf-8",
);

test("viewer email login creates and verifies a server-side magic link without emailing the user", () => {
  assert.match(loginActionsSource, /export async function signInWithEmailOnly/);
  assert.match(loginActionsSource, /auth\.admin\.generateLink\(\{/);
  assert.match(loginActionsSource, /type:\s*"magiclink"/);
  assert.match(loginActionsSource, /properties\.hashed_token/);
  assert.match(loginActionsSource, /verifyOtp\(\{/);
  assert.doesNotMatch(loginActionsSource, /signInWithOtp/);
});

test("admin email linking provisions a confirmed Auth user without requiring email approval", () => {
  assert.match(usersActionSource, /createAdminClient/);
  assert.match(usersActionSource, /auth\.admin\.createUser\(\{/);
  assert.match(usersActionSource, /email_confirm:\s*true/);
  assert.match(usersActionSource, /ensureTeamMembership/);
  assert.match(usersActionSource, /\.from\("people"\)[\s\S]*\.update\(\{[\s\S]*email/);
});

test("admin can assign operational manager access from the users page", () => {
  assert.match(usersActionSource, /export async function updateMembershipRoleAction/);
  assert.match(usersActionSource, /ASSIGNABLE_ROLES = \["manager", "viewer"\]/);
  assert.match(usersActionSource, /target\.role === "admin"/);
  assert.match(usersActionSource, /\.update\(\{ is_active: isActive, role \}\)/);
});

test("admin can upload person photos through server-side Supabase storage", () => {
  assert.match(usersActionSource, /formData\.get\("photo_file"\)/);
  assert.match(usersActionSource, /\.storage[\s\S]*\.from\("person-photos"\)[\s\S]*\.upload\(/);
  assert.match(usersActionSource, /getPublicUrl/);
});

test("person photo storage bucket is public and image-only", () => {
  assert.match(photoStorageMigrationSource, /storage\.buckets/);
  assert.match(photoStorageMigrationSource, /'person-photos'/);
  assert.match(photoStorageMigrationSource, /5242880/);
  assert.match(photoStorageMigrationSource, /image\/jpeg/);
  assert.match(photoStorageMigrationSource, /image\/png/);
  assert.match(photoStorageMigrationSource, /image\/webp/);
});

test("admin login keeps password authentication available", () => {
  assert.match(loginActionsSource, /export async function signInWithPassword/);
  assert.match(loginActionsSource, /signInWithPassword\(\{ email, password \}\)/);
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
