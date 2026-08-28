import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultEquipmentTypes = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "kav-default-equipment-types.json"), "utf-8"),
);

const VALID_CATEGORIES = new Set(["WEAPON", "OPTIC", "AMRAL", "PAKAL", "OTHER"]);

test("every default equipment type uses a category the equipment_types check constraint allows", () => {
  for (const type of defaultEquipmentTypes.equipmentTypes) {
    assert.ok(VALID_CATEGORIES.has(type.category), `${type.name} has an invalid category: ${type.category}`);
  }
});

test("default equipment type names are unique", () => {
  const names = defaultEquipmentTypes.equipmentTypes.map((type) => type.name);
  assert.equal(new Set(names).size, names.length);
});
