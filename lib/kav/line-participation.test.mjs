import assert from "node:assert/strict";
import { test } from "node:test";

import { filterLineActivePeople } from "./line-participation.ts";

test("line participation keeps everyone active by default", () => {
  const people = [{ id: "p1" }, { id: "p2" }];

  assert.deepEqual(filterLineActivePeople(people, new Set()), people);
});

test("line participation excludes people marked inactive for the current line", () => {
  const people = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

  assert.deepEqual(filterLineActivePeople(people, new Set(["p2"])), [{ id: "p1" }, { id: "p3" }]);
});
