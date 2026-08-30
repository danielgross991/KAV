import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const periodSeed = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-2026-reserve-period.json"), "utf-8"),
);

test("2026 reserve period seed is the upcoming Otniel line with exact requested dates", () => {
  assert.equal(periodSeed.period.name, "קו עותניאל ספטמבר–דצמבר 2026");
  assert.equal(periodSeed.period.location, "קו עותניאל");
  assert.equal(periodSeed.period.starts_on, "2026-09-06");
  assert.equal(periodSeed.period.ends_on, "2026-12-02");
});

test("Rosh Hashanah home instruction is modeled as an event, not fake leave requests", () => {
  const roshHashanah = periodSeed.events.find((event) => event.title === "ראש השנה בבית");
  assert.ok(roshHashanah);
  assert.equal(roshHashanah.starts_on, "2026-09-11");
  assert.equal(roshHashanah.ends_on, "2026-09-13");
  assert.match(roshHashanah.notes, /כולם בבית/);
  assert.equal(periodSeed.pendingLeaveRequests.some((request) => request.reason === "ראש השנה בבית"), false);
});
