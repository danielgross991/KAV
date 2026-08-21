import assert from "node:assert/strict";
import test from "node:test";

import { getDateInTimeZone } from "./dates.ts";

test("getDateInTimeZone returns the Israel date just after local midnight", () => {
  assert.equal(
    getDateInTimeZone("Asia/Jerusalem", new Date("2026-09-01T21:05:00.000Z")),
    "2026-09-02",
  );
});

test("getDateInTimeZone returns the Israel date before local midnight", () => {
  assert.equal(
    getDateInTimeZone("Asia/Jerusalem", new Date("2026-09-01T20:55:00.000Z")),
    "2026-09-01",
  );
});

test("getDateInTimeZone honors an explicit injected date", () => {
  assert.equal(
    getDateInTimeZone("America/New_York", new Date("2026-09-02T03:30:00.000Z")),
    "2026-09-01",
  );
});
