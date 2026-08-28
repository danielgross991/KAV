import assert from "node:assert/strict";
import test from "node:test";

import { getDateInTimeZone, getWeekStart, localDateTimeToIso, overlapsCalendarDayInTimeZone, shiftMonth } from "./dates.ts";

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

test("getWeekStart uses the configured local week boundary", () => {
  assert.equal(getWeekStart("2026-09-02", 0), "2026-08-30");
  assert.equal(getWeekStart("2026-09-02", 1), "2026-08-31");
});

test("localDateTimeToIso uses Israel daylight-saving offset", () => {
  assert.equal(localDateTimeToIso("Asia/Jerusalem", "2026-09-01", "00:05"), "2026-08-31T21:05:00.000Z");
});

test("localDateTimeToIso uses Israel winter offset", () => {
  assert.equal(localDateTimeToIso("Asia/Jerusalem", "2026-12-01", "23:55"), "2026-12-01T21:55:00.000Z");
});

test("all-day multi-day events overlap every covered Israel calendar day", () => {
  const startsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-10", "00:00");
  const endsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-12", "23:59");
  assert.deepEqual(["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]
    .filter((date) => overlapsCalendarDayInTimeZone("Asia/Jerusalem", date, startsAt, endsAt)), [
      "2026-09-10", "2026-09-11", "2026-09-12",
    ]);
});

test("overnight timed events overlap both local calendar days", () => {
  const startsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-10", "23:00");
  const endsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-11", "02:00");
  assert.equal(overlapsCalendarDayInTimeZone("Asia/Jerusalem", "2026-09-10", startsAt, endsAt), true);
  assert.equal(overlapsCalendarDayInTimeZone("Asia/Jerusalem", "2026-09-11", startsAt, endsAt), true);
  assert.equal(overlapsCalendarDayInTimeZone("Asia/Jerusalem", "2026-09-12", startsAt, endsAt), false);
});

test("single-day events remain confined to their local calendar day", () => {
  const startsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-10", "09:00");
  const endsAt = localDateTimeToIso("Asia/Jerusalem", "2026-09-10", "10:00");
  assert.equal(overlapsCalendarDayInTimeZone("Asia/Jerusalem", "2026-09-10", startsAt, endsAt), true);
  assert.equal(overlapsCalendarDayInTimeZone("Asia/Jerusalem", "2026-09-11", startsAt, endsAt), false);
});

test("shiftMonth moves forward and backward within a year", () => {
  assert.equal(shiftMonth("2026-09", 1), "2026-10");
  assert.equal(shiftMonth("2026-09", -1), "2026-08");
});

test("shiftMonth rolls over year boundaries in both directions", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("shiftMonth rejects a malformed month", () => {
  assert.throws(() => shiftMonth("2026-9", 1));
});
