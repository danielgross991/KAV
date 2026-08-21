import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appShellPath = new URL("../../components/app-shell.tsx", import.meta.url);
const teamSelectorPath = new URL("../../components/team-selector.tsx", import.meta.url);
const logoutRoutePath = new URL("../../app/logout/route.ts", import.meta.url);

test("logout is an explicit POST and cannot be triggered by link prefetch", async () => {
  const [appShell, teamSelector, logoutRoute] = await Promise.all([
    readFile(appShellPath, "utf8"),
    readFile(teamSelectorPath, "utf8"),
    readFile(logoutRoutePath, "utf8"),
  ]);

  assert.doesNotMatch(appShell, /href=["']\/logout["']/);
  assert.doesNotMatch(teamSelector, /href=["']\/logout["']/);
  assert.match(appShell, /<form action="\/logout" method="post">/);
  assert.match(teamSelector, /<form action="\/logout" method="post">/);
  assert.match(logoutRoute, /export async function POST\(/);
  assert.doesNotMatch(logoutRoute, /export async function GET\(/);
});
