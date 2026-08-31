import assert from "node:assert/strict";
import test from "node:test";

import { applyHistoricalAttendanceSemantics, computeAttendanceStats, rankHomeLeaderboard } from "./stats-domain.ts";

const people = [
  { fullName: "אבי", id: "p1" },
  { fullName: "בני", id: "p2" },
];

test("unreported attendance is excluded from the percentage denominator, not counted as absence", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "present", expectedAtBase: true, leave: false, state: "base" },
      { attendance: "unreported", expectedAtBase: true, leave: false, state: "base" },
    ]],
  ]);
  const [stats] = computeAttendanceStats([people[0]], resolutions);
  assert.equal(stats.finalizedExpectedDays, 1);
  assert.equal(stats.presentOnExpectedDays, 1);
  assert.equal(stats.attendancePercentage, 1);
});

test("a legitimate home rotation day does not reduce attendance percentage", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "present", expectedAtBase: true, leave: false, state: "base" },
      { attendance: "unreported", expectedAtBase: false, leave: false, state: "home" },
      { attendance: "unreported", expectedAtBase: false, leave: false, state: "home" },
    ]],
  ]);
  const [stats] = computeAttendanceStats([people[0]], resolutions);
  assert.equal(stats.homeDays, 2);
  assert.equal(stats.finalizedExpectedDays, 1);
  assert.equal(stats.attendancePercentage, 1);
});

test("approved leave on an expected-at-base day does not reduce attendance percentage", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "present", expectedAtBase: true, leave: false, state: "base" },
      { attendance: "unreported", expectedAtBase: false, leave: true, state: "base" },
    ]],
  ]);
  const [stats] = computeAttendanceStats([people[0]], resolutions);
  assert.equal(stats.leaveDays, 1);
  assert.equal(stats.finalizedExpectedDays, 1);
  assert.equal(stats.attendancePercentage, 1);
});

test("an actual absence on an expected-at-base day reduces attendance percentage", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "present", expectedAtBase: true, leave: false, state: "base" },
      { attendance: "absent", expectedAtBase: true, leave: false, state: "base" },
    ]],
  ]);
  const [stats] = computeAttendanceStats([people[0]], resolutions);
  assert.equal(stats.finalizedExpectedDays, 2);
  assert.equal(stats.presentOnExpectedDays, 1);
  assert.equal(stats.attendancePercentage, 0.5);
});

test("attendance percentage is null (not 0 or 100) when no expected day has been reported yet", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "unreported", expectedAtBase: true, leave: false, state: "base" },
    ]],
  ]);
  const [stats] = computeAttendanceStats([people[0]], resolutions);
  assert.equal(stats.finalizedExpectedDays, 0);
  assert.equal(stats.attendancePercentage, null);
});

test("home leaderboard ranks by home days, then home percentage, then name, deterministically", () => {
  const resolutions = new Map([
    ["p1", Array.from({ length: 4 }, () => ({ attendance: "unreported", expectedAtBase: false, leave: false, state: "home" }))],
    ["p2", Array.from({ length: 4 }, () => ({ attendance: "unreported", expectedAtBase: false, leave: false, state: "home" }))],
  ]);
  const stats = computeAttendanceStats(people, resolutions);
  const ranked = rankHomeLeaderboard(stats);
  // Tied on home days and percentage: Hebrew name comparison decides, and repeated calls
  // must produce the exact same order (no reliance on input array order or randomness).
  assert.deepEqual(ranked.map((item) => item.personId), rankHomeLeaderboard([...stats].reverse()).map((item) => item.personId));
});

test("more home days wins even with a lower home percentage denominator input", () => {
  const resolutions = new Map([
    ["p1", [
      { attendance: "unreported", expectedAtBase: false, leave: false, state: "home" },
      { attendance: "unreported", expectedAtBase: false, leave: false, state: "home" },
      { attendance: "present", expectedAtBase: true, leave: false, state: "base" },
    ]],
    ["p2", [
      { attendance: "unreported", expectedAtBase: false, leave: false, state: "home" },
    ]],
  ]);
  const stats = computeAttendanceStats(people, resolutions);
  const [first] = rankHomeLeaderboard(stats);
  assert.equal(first.personId, "p1");
  assert.equal(first.homeDays, 2);
});

test("historical attendance semantics count imported blank attendance as home", () => {
  const day = applyHistoricalAttendanceSemantics({
    attendance: "absent",
    expectedAtBase: true,
    leave: false,
    state: "base",
  });
  assert.equal(day.state, "home");
  assert.equal(day.expectedAtBase, false);
});

test("historical attendance semantics count imported X attendance as base", () => {
  const day = applyHistoricalAttendanceSemantics({
    attendance: "present",
    expectedAtBase: false,
    leave: false,
    state: "home",
  });
  assert.equal(day.state, "base");
  assert.equal(day.expectedAtBase, true);
});
