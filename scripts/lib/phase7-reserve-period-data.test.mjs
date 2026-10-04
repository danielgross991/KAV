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
  assert.equal(periodSeed.period.starts_on, "2026-09-08");
  assert.equal(periodSeed.period.ends_on, "2026-12-12");
  assert.equal(periodSeed.period.status, "published");
});

test("2026 Otniel seed includes a reported commanders day for the four requested people", () => {
  const commandersDay = periodSeed.events.find((event) => event.title === "יום מפקדים");
  assert.ok(commandersDay);
  assert.equal(commandersDay.starts_on, "2026-09-08");
  assert.equal(commandersDay.event_type, "briefing");

  const attendanceDay = periodSeed.attendanceDays.find((day) => day.date === "2026-09-08");
  assert.ok(attendanceDay);
  assert.equal(attendanceDay.status, "submitted");
  assert.deepEqual(attendanceDay.present, ["דניאל גרוס", "לידור דורון", "אורי בנבג'י", "ניתאי ידעי"]);
});

test("2026 Otniel seed tracks Ariel Doyev as present from September 25 through 27", () => {
  for (const date of ["2026-09-25", "2026-09-26", "2026-09-27"]) {
    const attendanceDay = periodSeed.attendanceDays.find((day) => day.date === date);
    assert.ok(attendanceDay, `missing attendance day ${date}`);
    assert.equal(attendanceDay.status, "submitted");
    assert.deepEqual(attendanceDay.present, ["אריאל דויב"]);
  }
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
  assert.deepEqual(periodSeed.rotationGroups.map((group) => group.name), ["מפקדים", "כל הצוות"]);
  assert.deepEqual(periodSeed.rotationGroups[0].members, ["דניאל גרוס", "לידור דורון", "אורי בנבג'י", "ניתאי ידעי"]);
  assert.equal(periodSeed.rotationGroups[0].starts_on, "2026-09-08");
  assert.equal(periodSeed.rotationGroups[0].ends_on, "2026-09-08");
  assert.equal(periodSeed.rotationGroups[1].members, "all_active");
  assert.equal(periodSeed.rotationGroups[1].starts_on, "2026-09-09");
  assert.deepEqual(periodSeed.rotationGroups[1].excluded_members, ["עמנואל אלמו", "אריאל דויב", "אריאל דוייב"]);

  const blocks = periodSeed.rotationBlocks ?? [];
  assert.equal(blocks[0].starts_on, "2026-09-08");
  assert.equal(blocks[0].state, "base");
  assert.equal(blocks[0].group_name, "מפקדים");
  assert.equal(blocks[1].starts_on, "2026-09-09");
  assert.equal(blocks[1].state, "base");
  assert.equal(blocks.at(-1).ends_on, "2026-12-12");
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-10" &&
    block.ends_on === "2026-09-13"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-17" &&
    block.ends_on === "2026-09-21"));
  assert.ok(blocks.some((block) =>
    block.state === "base" &&
    block.starts_on === "2026-09-22" &&
    block.ends_on === "2026-09-28"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-09-29" &&
    block.ends_on === "2026-10-06"));
  assert.ok(blocks.some((block) =>
    block.state === "base" &&
    block.starts_on === "2026-10-07" &&
    block.ends_on === "2026-10-13"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-10-14" &&
    block.ends_on === "2026-10-19"));
  assert.ok(blocks.some((block) =>
    block.state === "base" &&
    block.starts_on === "2026-11-25" &&
    block.ends_on === "2026-12-02"));
  assert.ok(blocks.some((block) =>
    block.state === "home" &&
    block.starts_on === "2026-12-03" &&
    block.ends_on === "2026-12-12"));
  for (let index = 1; index < blocks.length; index += 1) {
    assert.equal(blocks[index].group_name, "כל הצוות");
    assert.ok(blocks[index].starts_on > blocks[index - 1].ends_on);
    if (index > 1) assert.notEqual(blocks[index].state, blocks[index - 1].state);
  }
});

test("2026 Otniel seed includes the ELT PDF schedule for September 14-16", () => {
  const titles = new Set(periodSeed.events.map((event) => event.title));
  for (const title of [
    "14/9 - יום סמבצים בגזרה",
    "14/9 - קפ״ק 2 לגזרה",
    "15/9 - לבנת מעצרים לשיטה חדשה",
    "15/9 - תרגיל פלוגה א",
    "16/9 - שעת מח״ט לכל הגדוד",
    "16/9 - מטווח קליעה",
    "16/9 - עליית מטא״ר 1 לגזרות",
  ]) {
    assert.ok(titles.has(title), `missing ELT schedule event: ${title}`);
  }

  const lineStart = periodSeed.events.find((event) => event.title === "17/9 - תחילת סבב");
  assert.ok(lineStart);
  assert.equal(lineStart.starts_on, "2026-09-17");
});

test("2026 Otniel seed follows the updated round B exit and return table", () => {
  const transitions = periodSeed.events
    .filter((event) => event.event_type === "changeover")
    .map((event) => [event.starts_on, event.title]);
  assert.deepEqual(transitions.slice(-12), [
    ["2026-09-17", "17/9 - תחילת סבב"],
    ["2026-09-22", "22/9 - חזרה לבסיס"],
    ["2026-09-29", "29/9 - יציאה הביתה"],
    ["2026-10-07", "7/10 - חזרה לבסיס"],
    ["2026-10-14", "14/10 - יציאה הביתה"],
    ["2026-10-20", "20/10 - חזרה לבסיס"],
    ["2026-10-27", "27/10 - יציאה הביתה"],
    ["2026-11-03", "3/11 - חזרה לבסיס"],
    ["2026-11-08", "8/11 - יציאה הביתה"],
    ["2026-11-12", "12/11 - חזרה לבסיס"],
    ["2026-11-18", "18/11 - יציאה הביתה"],
    ["2026-11-25", "25/11 - חזרה לבסיס"],
  ]);

  const processingPhase = periodSeed.phases.find((phase) => phase.name === "ימי התארגנות");
  assert.ok(processingPhase);
  assert.equal(processingPhase.phase_type, "processing");
  assert.equal(processingPhase.starts_on, "2026-12-02");
  assert.equal(processingPhase.ends_on, "2026-12-12");

  const processingEvent = periodSeed.events.find((event) => event.title === "ימי התארגנות");
  assert.ok(processingEvent);
  assert.equal(processingEvent.event_type, "processing");
  assert.equal(processingEvent.starts_on, "2026-12-02");
  assert.equal(processingEvent.ends_on, "2026-12-12");
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
