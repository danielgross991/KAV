import assert from "node:assert/strict";
import test from "node:test";

import { getLegacyLineStatsOverride } from "./legacy-line-stats.ts";
import { rankHomeLeaderboard } from "./stats-domain.ts";

test("Kishufim 2025 historical summary produces the photographed home podium", () => {
  const stats = getLegacyLineStatsOverride({ name: "קו כיסופים 2025" }, [
    { id: "guy", fullName: "גיא כהן" },
    { id: "melse", fullName: "מלסה אטלאי" },
    { id: "doyev", fullName: "אריאל דויב" },
    { id: "yoni", fullName: "יונתן אבוחצירא" },
  ]);

  assert.ok(stats);
  assert.deepEqual(rankHomeLeaderboard(stats).slice(0, 3).map((item) => ({
    name: item.fullName,
    homeDays: item.homeDays,
  })), [
    { name: "גיא כהן", homeDays: 55 },
    { name: "מלסה אטלאי", homeDays: 53 },
    { name: "אריאל דויב", homeDays: 51 },
  ]);
});

test("legacy summary is scoped only to the Kishufim historical line", () => {
  assert.equal(getLegacyLineStatsOverride({ name: "קו עותניאל" }, [{ id: "guy", fullName: "גיא כהן" }]), null);
});
