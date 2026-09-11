import assert from "node:assert/strict";
import test from "node:test";

import { getDailyQuoteIndex, selectDailyQuoteForDate } from "./daily-quotes.ts";

test("daily quote selection loops through available quotes by calendar day", () => {
  const quotes = ["אחד", "שתיים"];

  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-01"), "שתיים");
  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-02"), "אחד");
  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-03"), "שתיים");
});

test("daily quote selection returns null when no quote is active", () => {
  assert.equal(selectDailyQuoteForDate([], "2026-09-01"), null);
});

test("fourth daily quote is selected for September 11 2026", () => {
  const quotes = ["איפה השניצל של גרציה", "כשהראש דפוק הגוף סובל", "למה באתי מארצות הברית", "אחר כך אתה שואל..."];
  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-11"), "אחר כך אתה שואל...");
  assert.equal(getDailyQuoteIndex("2026-09-11", quotes.length), 3);
});
