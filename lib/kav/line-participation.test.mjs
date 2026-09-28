import assert from "node:assert/strict";
import { test } from "node:test";

import { filterLineActivePeople, parseStatsStartDate } from "./line-participation.ts";

test("line participation keeps everyone active by default", () => {
  const people = [{ id: "p1" }, { id: "p2" }];

  assert.deepEqual(filterLineActivePeople(people, new Set()), people);
});

test("line participation excludes people marked inactive for the current line", () => {
  const people = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

  assert.deepEqual(filterLineActivePeople(people, new Set(["p2"])), [{ id: "p1" }, { id: "p3" }]);
});

test("line participation notes can carry a personal stats start date", () => {
  assert.equal(parseStatsStartDate("חישוב יחסי stats_start:2026-09-14"), "2026-09-14");
  assert.equal(parseStatsStartDate("אין תאריך התחלה"), null);
  assert.equal(parseStatsStartDate(null), null);
});
