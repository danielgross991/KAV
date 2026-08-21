import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRotationBlocks,
  resolvePersonSchedule,
  selectOperationalReservePeriod,
  validateScheduleForPublication,
} from "./schedule-domain.ts";

const operationalDate = "2026-09-10";
const activePeriod = { id: "active", status: "active", starts_on: "2026-09-01", ends_on: "2026-09-20" };
const publishedPeriod = { id: "published", status: "published", starts_on: "2026-09-05", ends_on: "2026-09-15" };

test("operational period selection returns a current active period", () => {
  assert.equal(selectOperationalReservePeriod([activePeriod], operationalDate)?.id, "active");
});

test("operational period selection falls back to a current published period", () => {
  assert.equal(selectOperationalReservePeriod([publishedPeriod], operationalDate)?.id, "published");
});

test("operational period selection prefers active over overlapping published", () => {
  assert.equal(selectOperationalReservePeriod([publishedPeriod, activePeriod], operationalDate)?.id, "active");
});

test("operational period selection returns null when neither status applies", () => {
  assert.equal(selectOperationalReservePeriod([
    { ...activePeriod, status: "completed" },
    { ...publishedPeriod, starts_on: "2026-10-01", ends_on: "2026-10-10" },
  ], operationalDate), null);
});

test("generator produces an alternating 7/7 two-group rotation", () => {
  const blocks = generateRotationBlocks({
    period: { startsOn: "2026-09-04", endsOn: "2026-09-17" },
    anchorDate: "2026-09-04", baseDays: 7, homeDays: 7,
    groups: [
      { id: "a", initialState: "base" },
      { id: "b", initialState: "home" },
    ],
  });
  assert.deepEqual(blocks.map(({ groupId, state, startsOn, endsOn }) => ({ groupId, state, startsOn, endsOn })), [
    { groupId: "a", state: "base", startsOn: "2026-09-04", endsOn: "2026-09-10" },
    { groupId: "a", state: "home", startsOn: "2026-09-11", endsOn: "2026-09-17" },
    { groupId: "b", state: "home", startsOn: "2026-09-04", endsOn: "2026-09-10" },
    { groupId: "b", state: "base", startsOn: "2026-09-11", endsOn: "2026-09-17" },
  ]);
});

test("generator supports non-7/7 cadence and clips partial boundaries", () => {
  const blocks = generateRotationBlocks({
    period: { startsOn: "2026-09-02", endsOn: "2026-09-12" },
    anchorDate: "2026-09-05", baseDays: 5, homeDays: 3,
    groups: [{ id: "a", initialState: "base" }],
  });
  assert.deepEqual(blocks.map(({ state, startsOn, endsOn }) => ({ state, startsOn, endsOn })), [
    { state: "home", startsOn: "2026-09-02", endsOn: "2026-09-04" },
    { state: "base", startsOn: "2026-09-05", endsOn: "2026-09-09" },
    { state: "home", startsOn: "2026-09-10", endsOn: "2026-09-12" },
  ]);
});

const memberships = [{ personId: "p", groupId: "a", startsOn: "2026-09-01", endsOn: "2026-09-30" }];
const blocks = [
  { groupId: "a", state: "base", startsOn: "2026-09-01", endsOn: "2026-09-07" },
  { groupId: "a", state: "home", startsOn: "2026-09-08", endsOn: "2026-09-14" },
  { groupId: "b", state: "home", startsOn: "2026-09-01", endsOn: "2026-09-07" },
];

test("resolver exposes default group and base/home states", () => {
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-09-03", memberships, blocks, overrides: [] }).state, "base");
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-09-10", memberships, blocks, overrides: [] }).state, "home");
});

test("resolver applies only active overrides", () => {
  const overrides = [{ personId: "p", fromGroupId: "a", toGroupId: "b", startsOn: "2026-09-02", endsOn: "2026-09-04" }];
  const active = resolvePersonSchedule({ personId: "p", date: "2026-09-03", memberships, blocks, overrides });
  assert.equal(active.defaultGroupId, "a");
  assert.equal(active.effectiveGroupId, "b");
  assert.equal(active.state, "home");
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-09-01", memberships, blocks, overrides }).effectiveGroupId, "a");
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-09-05", memberships, blocks, overrides }).effectiveGroupId, "a");
});

test("resolver honors membership validity start and end", () => {
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-08-31", memberships, blocks, overrides: [] }).state, null);
  assert.equal(resolvePersonSchedule({ personId: "p", date: "2026-10-01", memberships, blocks, overrides: [] }).state, null);
});

test("publication validation finds assignments, gaps, overlaps, and outside blocks", () => {
  const issues = validateScheduleForPublication({
    period: { startsOn: "2026-09-01", endsOn: "2026-09-10" },
    activePeopleIds: ["p", "missing"], groups: [{ id: "a" }], memberships,
    phases: [{ type: "line", startsOn: "2026-09-01", endsOn: "2026-09-10" }],
    overrides: [],
    blocks: [
      { groupId: "a", state: "base", startsOn: "2026-08-31", endsOn: "2026-09-03" },
      { groupId: "a", state: "home", startsOn: "2026-09-03", endsOn: "2026-09-05" },
    ],
  });
  assert.deepEqual(new Set(issues.map((issue) => issue.code)), new Set([
    "missing-membership", "block-outside-period", "block-overlap", "block-gap",
  ]));
});

test("publication validation rejects unknown override groups", () => {
  const common = {
    period: { startsOn: "2026-09-01", endsOn: "2026-09-10" },
    activePeopleIds: [], groups: [{ id: "a" }], memberships: [], blocks: [], phases: [],
  };
  for (const override of [
    { personId: "p", fromGroupId: "unknown", toGroupId: "a", startsOn: "2026-09-02", endsOn: "2026-09-03" },
    { personId: "p", fromGroupId: "a", toGroupId: "unknown", startsOn: "2026-09-02", endsOn: "2026-09-03" },
  ]) {
    assert.ok(validateScheduleForPublication({ ...common, overrides: [override] })
      .some((issue) => issue.code === "invalid-override"));
  }
});
