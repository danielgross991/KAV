// Pure name-resolution helpers used by the Phase 7 import script. Deliberately has no
// database/IO dependency of its own so it can be unit tested without a live Supabase project.
//
// Resolution is closed-world: a legacy name only ever resolves to a person ID that already
// exists in the `people` list passed in (the current, canonical Team Lidor roster). This
// module never invents or creates a person — if a legacy name (or one of its declared
// variants) isn't found among the given people, resolution simply returns null, and the
// caller is responsible for reporting that as skipped/unresolved rather than importing it.

/**
 * @param {{ id: string, full_name: string }[]} people
 * @param {{ canonical: string, legacy_variants: string[] }[]} nameVariants
 * @returns {Map<string, string>} legacy or canonical name -> person id
 */
export function buildNameIndex(people, nameVariants) {
  const byName = new Map(people.map((person) => [person.full_name.trim(), person.id]));
  for (const variant of nameVariants) {
    const canonicalId = byName.get(variant.canonical.trim());
    if (!canonicalId) continue;
    for (const legacyName of variant.legacy_variants) {
      if (!byName.has(legacyName.trim())) byName.set(legacyName.trim(), canonicalId);
    }
  }
  return byName;
}

/**
 * @param {Map<string, string>} nameToId
 * @param {string} name
 * @returns {string | null}
 */
export function resolvePersonId(nameToId, name) {
  return nameToId.get(name.trim()) ?? null;
}
