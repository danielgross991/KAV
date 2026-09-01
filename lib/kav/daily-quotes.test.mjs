import assert from "node:assert/strict";
import test from "node:test";

import { selectDailyQuoteForDate } from "./daily-quotes.ts";

test("daily quote selection loops through available quotes by calendar day", () => {
  const quotes = ["אחד", "שתיים"];

  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-01"), "שתיים");
  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-02"), "אחד");
  assert.equal(selectDailyQuoteForDate(quotes, "2026-09-03"), "שתיים");
});

test("daily quote selection returns null when no quote is active", () => {
  assert.equal(selectDailyQuoteForDate([], "2026-09-01"), null);
});
