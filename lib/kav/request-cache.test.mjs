import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const authSource = readFileSync(join(__dirname, "auth.ts"), "utf-8");
const teamsSource = readFileSync(join(__dirname, "teams.ts"), "utf-8");

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
