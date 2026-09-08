import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const periodSeed = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-2026-reserve-period.json"), "utf-8"),
);
const legacyPeriodSeed = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-legacy-2025-period.json"), "utf-8"),
);
const legacyLeaveSeed = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-legacy-2025-leave-requests.json"), "utf-8"),
);

test("2026 reserve period seed is the upcoming Otniel line with exact requested dates", () => {
  assert.equal(periodSeed.period.name, "קו עותניאל");
  assert.equal(periodSeed.period.location, "קו עותניאל");
  assert.equal(periodSeed.period.starts_on, "2026-09-09");
  assert.equal(periodSeed.period.ends_on, "2026-12-02");
  assert.equal(periodSeed.period.status, "published");
});

test("Rosh Hashanah home instruction is modeled as an event, not fake leave requests", () => {
  const roshHashanah = periodSeed.events.find((event) => event.title === "חוזרים הביתה לראש השנה");
  assert.ok(roshHashanah);
  assert.equal(roshHashanah.starts_on, "2026-09-10");
  assert.equal(roshHashanah.ends_on, "2026-09-13");
  assert.match(roshHashanah.notes, /כולם בבית/);
  assert.equal(periodSeed.pendingLeaveRequests.some((request) => request.reason === "ראש השנה בבית"), false);
});

test("2026 Otniel rotations are whole-team week-on week-off", () => {
  assert.deepEqual(periodSeed.rotationGroups.map((group) => group.name), ["כל הצוות"]);
  assert.equal(periodSeed.rotationGroups[0].members, "all_active");
  assert.deepEqual(periodSeed.rotationGroups[0].excluded_members, ["עמנואל אלמו", "אריאל דויב", "אריאל דוייב"]);

  const blocks = periodSeed.rotationBlocks ?? [];
  assert.equal(blocks[0].starts_on, "2026-09-09");
  assert.equal(blocks.at(-1).ends_on, "2026-12-02");
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-10" &&
    block.ends_on === "2026-09-13"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-18" &&
    block.ends_on === "2026-09-21"));
  assert.ok(blocks.some((block) =>
    block.state === "base" &&
    block.starts_on === "2026-09-22" &&
    block.ends_on === "2026-09-28"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-29" &&
    block.ends_on === "2026-10-05"));
  assert.ok(blocks.some((block) =>
    block.state === "base" &&
    block.starts_on === "2026-10-06" &&
    block.ends_on === "2026-10-10"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-10-11" &&
    block.ends_on === "2026-10-17"));
  assert.ok(blocks.slice(7).every((block) => new Date(`${block.starts_on}T12:00:00Z`).getUTCDay() === 0));
  for (let index = 1; index < blocks.length; index += 1) {
    assert.equal(blocks[index].group_name, "כל הצוות");
    assert.ok(blocks[index].starts_on > blocks[index - 1].ends_on);
    assert.notEqual(blocks[index].state, blocks[index - 1].state);
  }
});

test("historical Kishufim seed includes non-overlapping rotation blocks for both rounds", () => {
  const blocks = legacyPeriodSeed.rotationBlocks ?? [];
  assert.equal(blocks.length, 26);
  assert.deepEqual([...new Set(blocks.map((block) => block.group_name))].sort(), ["סבב ירוק", "סבב צהוב"]);

  for (const groupName of ["סבב ירוק", "סבב צהוב"]) {
    const groupBlocks = blocks
      .filter((block) => block.group_name === groupName)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    assert.equal(groupBlocks[0].starts_on, legacyPeriodSeed.period.starts_on);
    assert.equal(groupBlocks.at(-1).ends_on, legacyPeriodSeed.period.ends_on);
    for (let index = 1; index < groupBlocks.length; index += 1) {
      assert.ok(groupBlocks[index].starts_on > groupBlocks[index - 1].ends_on);
    }
  }
});

test("historical Kishufim leave requests are extracted from person-specific calendar notes", () => {
  const requests = legacyLeaveSeed.requests ?? [];
  assert.equal(requests.length, 31);
  assert.equal(requests.some((request) => request.reason === "חובת הגעה כולם"), false);
  assert.equal(requests.some((request) => request.reason === "תפיסת קו כיסופים"), false);
  assert.ok(requests.some((request) =>
    request.person_name === "מלסה" &&
    request.starts_on === "2025-06-22" &&
    request.ends_on === "2025-06-26" &&
    request.reason === "חול"));
  assert.ok(requests.some((request) =>
    request.person_name === "ניתאי" &&
    request.starts_on === "2025-07-18" &&
    request.reason === "חתונה"));

  for (const request of requests) {
    assert.ok(request.starts_on >= legacyPeriodSeed.period.starts_on, `${request.person_name} starts before the historical period`);
    assert.ok(request.ends_on <= legacyPeriodSeed.period.ends_on, `${request.person_name} ends after the historical period`);
  }
});
