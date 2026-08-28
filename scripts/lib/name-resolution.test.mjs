import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildNameIndex, resolvePersonId } from "./name-resolution.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legacyPeriod = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-legacy-2025-period.json"), "utf-8"),
);

// The real, current 17-person Team Lidor roster (production canonical names) — does NOT
// include "גושו טדסה", matching the review finding that production only has these 17 people.
const canonicalRoster = [
  "דניאל גרוס", "ירין אמסילי", "מלסה אטלאי", "גיא כהן", "אסף אליאב", "יונתן אבוחצירא",
  "אורי בנבג'י", "רפאל עזרא", "אריאל דויב", "בנימין ברי", "ניתאי ידעי", "לידור דורון",
  "תמיר אסראסו", "אביאל אלקאיל", "ירין כהן", "עדן מימון", "עמנואל אלמו",
].map((full_name, index) => ({ id: `person-${index}`, full_name }));

test("legacy spelling variants resolve to the canonical person", () => {
  const nameToId = buildNameIndex(canonicalRoster, legacyPeriod.nameVariants);
  const canonicalId = resolvePersonId(nameToId, "יונתן אבוחצירא");
  assert.equal(resolvePersonId(nameToId, "יוני אבוחצירה"), canonicalId);
  assert.equal(resolvePersonId(nameToId, "יוני"), canonicalId);
});

test("a name with no canonical person record and no declared variant resolves to null, not a fabricated id", () => {
  const nameToId = buildNameIndex(canonicalRoster, legacyPeriod.nameVariants);
  assert.equal(resolvePersonId(nameToId, "גושו טדסה"), null);
});

test("גושו טדסה is declared unresolved in the legacy metadata, not claimed as imported", () => {
  const entry = legacyPeriod.unresolvedHistoricalPeople.find((item) => item.legacy_name === "גושו טדסה");
  assert.ok(entry, "expected an explicit unresolvedHistoricalPeople entry for גושו טדסה");
  assert.match(entry.status, /skip/i);
  assert.doesNotMatch(entry.why, /^מיובאת/); // must not claim his attendance "is imported"
});

test("a placeholder roster label never resolves to a real person id", () => {
  const nameToId = buildNameIndex(canonicalRoster, legacyPeriod.nameVariants);
  assert.equal(resolvePersonId(nameToId, "יחיד ומיוחד"), null);
});

test("none of the official rotation group member lists contain the placeholder label", () => {
  for (const group of legacyPeriod.rotationGroups) {
    assert.ok(!group.members.includes("יחיד ומיוחד"), `${group.name} must not include the placeholder label`);
    assert.ok(!group.members.includes("גושו טדסה"), `${group.name} must not include an unresolved historical person`);
  }
});
