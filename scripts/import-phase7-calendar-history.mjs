// Phase 7 data import: 2026 reserve period + fixed events + holidays + pending leave,
// and the historical "קו כיסופים 2025" period + rotation groups + attendance.
//
// This script is reproducible, idempotent (safe to re-run — it looks up existing rows by
// natural key before inserting) and auditable (prints a full report of what it did/skipped).
// It does NOT invent any data: every value it writes traces back to either the task
// instructions (2026 period/events/holidays/leave, given verbatim) or the legacy workbook
// extracts in scripts/data/ (2025 attendance + roster, produced by inspecting
// "לוז צוות - קו כיסופים.xlsx" — see scripts/data/kav-legacy-2025-attendance.json).
//
// Usage (from repo root):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... KAV_TEAM_SLUG=<team-lidor-slug> \
//     node --experimental-strip-types scripts/import-phase7-calendar-history.mjs
//
// Requires a Supabase service-role key (bypasses RLS so the whole import runs as one
// consistent, auditable operation) — never expose SUPABASE_SECRET_KEY to the browser/app.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { localDateTimeToIso } from "../lib/kav/dates.ts";
import { buildNameIndex, resolvePersonId as resolvePersonIdPure } from "./lib/name-resolution.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");

const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = requiredEnv("SUPABASE_SECRET_KEY");
const teamSlug = requiredEnv("KAV_TEAM_SLUG");

const supabase = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const reservePeriod2026 = readJson("kav-2026-reserve-period.json");
const legacyPeriod2025 = readJson("kav-legacy-2025-period.json");
const legacyAttendance = readJson("kav-legacy-2025-attendance.json");
const defaultEquipmentTypes = readJson("kav-default-equipment-types.json");

const report = {
  periodsCreated: [], periodsReused: [],
  phasesCreated: [], phasesSkipped: [],
  eventsCreated: [], eventsSkipped: [],
  holidaysCreated: [], holidaysSkipped: [],
  pendingLeaveImported: [], pendingLeaveSkipped: [],
  equipmentTypesCreated: [], equipmentTypesSkipped: [],
  equipmentImported: [],
  historicalAttendanceDates: [], historicalPresenceRowsCreated: [], historicalPresenceRowsUpdated: [],
  historicalRotationMembership: [],
  skippedRows: [], ambiguousNames: [], missingDates: [],
  // One entry per unique unresolved legacy name (not one per date/occurrence — a name that
  // fails to resolve across 72 attendance days would otherwise flood this with 72 near-
  // identical rows). Each entry lists every context it was skipped from and a total count.
  unresolvedMappings: [],
};

const unresolvedByName = new Map();

function recordUnresolved(name, context) {
  const entry = unresolvedByName.get(name) ?? { name, contexts: new Set(), occurrences: 0 };
  entry.contexts.add(context);
  entry.occurrences += 1;
  unresolvedByName.set(name, entry);
}

function resolvePersonId(nameToId, name, context) {
  const id = resolvePersonIdPure(nameToId, name);
  if (!id) recordUnresolved(name, context);
  return id;
}

function finalizeUnresolvedMappings() {
  report.unresolvedMappings = [...unresolvedByName.values()].map((entry) => ({
    name: entry.name,
    occurrences: entry.occurrences,
    contexts: [...entry.contexts],
  }));
}

async function main() {
  const team = await getTeamBySlug(teamSlug);
  console.log(`Team: ${team.name} (${team.id}), timezone ${team.timezone}`);

  const people = await getPeople(team.id);
  const nameToId = buildNameIndex(people, legacyPeriod2025.nameVariants ?? []);

  // ---- B/C/J: 2026 reserve period, fixed events, holidays, pending leave ----
  const period2026 = await getOrCreatePeriod(team.id, reservePeriod2026.period);
  await createPhases(team.id, period2026.id, reservePeriod2026.phases ?? []);
  await createEvents(team, period2026.id, reservePeriod2026.events ?? [], "event");
  await createEvents(team, period2026.id, (reservePeriod2026.holidays ?? []).map((h) => ({ ...h, event_type: "holiday", is_all_day: true })), "holiday");
  await importPendingLeave(team.id, period2026.id, reservePeriod2026.pendingLeaveRequests ?? [], nameToId);
  for (const skipped of reservePeriod2026.skippedLeaveRequests ?? []) {
    report.pendingLeaveSkipped.push(skipped);
  }

  // Equipment (Section E): legacy sheet "צלם" was inspected and contains zero populated
  // equipment values for any person (every equipment column is blank for all 17 people) —
  // there is nothing to import. Recorded explicitly rather than silently doing nothing.
  report.equipmentImported.push({
    note: "Legacy sheet 'צלם' inspected: 0 non-empty equipment values for any person. No equipment rows created.",
  });

  // Default equipment TYPES (not actual assigned items — the legacy sheet had none to
  // import) so a manager can immediately assign a weapon/optic/amral/etc to a person
  // without first having to configure a type in הגדרות.
  await createDefaultEquipmentTypes(team.id, defaultEquipmentTypes.equipmentTypes ?? []);

  // ---- F/G/H: historical קו כיסופים 2025 period, rotation groups, attendance ----
  const period2025 = await getOrCreatePeriod(team.id, legacyPeriod2025.period);
  await createEvents(team, period2025.id, legacyPeriod2025.milestoneEvents ?? [], "event");
  await createHistoricalRotationGroups(team.id, period2025.id, legacyPeriod2025.rotationGroups ?? [], nameToId);
  for (const placeholder of legacyPeriod2025.placeholderNamesExcluded ?? []) {
    report.ambiguousNames.push(placeholder);
  }
  reportKnownUnresolvedHistoricalPeople(nameToId, legacyPeriod2025.unresolvedHistoricalPeople ?? []);
  await importHistoricalAttendance(team.id, period2025.id, legacyAttendance, nameToId, legacyPeriod2025.period);

  finalizeUnresolvedMappings();
  printReport();
}

// Cross-checks the static "known unresolved historical person" metadata (scripts/data/
// kav-legacy-2025-period.json) against what ACTUALLY resolves right now against the live
// `people` table, rather than just trusting the metadata's claim. If someone later creates
// a person record and this name suddenly DOES resolve, that must be surfaced loudly (their
// historical attendance would then start importing on the next run) rather than silently
// changing behavior.
function reportKnownUnresolvedHistoricalPeople(nameToId, knownUnresolved) {
  for (const person of knownUnresolved) {
    const id = resolvePersonIdPure(nameToId, person.legacy_name);
    if (id) {
      report.ambiguousNames.push({
        legacy_name: person.legacy_name,
        WARNING: `This name now resolves to person ${id} — metadata previously declared it unresolved/skipped. `
          + "Their historical attendance/rotation membership WILL be imported this run. Confirm this is intended.",
      });
    } else {
      report.ambiguousNames.push({
        legacy_name: person.legacy_name,
        status: "confirmed unresolved — no canonical Team Lidor person record exists; nothing imported for this name",
      });
    }
  }
}

async function getTeamBySlug(slug) {
  const { data, error } = await supabase.from("teams").select("id, name, slug, timezone").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Unable to load team: ${error.message}`);
  if (!data) throw new Error(`No team found with slug '${slug}'. Set KAV_TEAM_SLUG to the correct slug.`);
  return data;
}

async function getPeople(teamId) {
  const { data, error } = await supabase.from("people").select("id, full_name").eq("team_id", teamId);
  if (error) throw new Error(`Unable to load people: ${error.message}`);
  return data ?? [];
}

async function createDefaultEquipmentTypes(teamId, types) {
  for (const type of types) {
    const { data: existing, error } = await supabase.from("equipment_types").select("id")
      .eq("team_id", teamId).eq("name", type.name).maybeSingle();
    if (error) throw new Error(`Unable to look up equipment type '${type.name}': ${error.message}`);
    if (existing) { report.equipmentTypesSkipped.push({ name: type.name, reason: "already exists" }); continue; }

    const { error: insertError } = await supabase.from("equipment_types").insert({
      team_id: teamId, name: type.name, category: type.category,
      serial_required: Boolean(type.serial_required), is_active: true,
    });
    if (insertError) throw new Error(`Unable to create equipment type '${type.name}': ${insertError.message}`);
    report.equipmentTypesCreated.push({ name: type.name, category: type.category });
  }
}

async function getOrCreatePeriod(teamId, period) {
  const { data: existing, error } = await supabase
    .from("reserve_periods").select("*").eq("team_id", teamId).eq("name", period.name).maybeSingle();
  if (error) throw new Error(`Unable to look up reserve period '${period.name}': ${error.message}`);
  if (existing) {
    report.periodsReused.push({ id: existing.id, name: existing.name });
    return existing;
  }
  const { data, error: insertError } = await supabase.from("reserve_periods").insert({
    team_id: teamId, name: period.name, starts_on: period.starts_on, ends_on: period.ends_on,
    status: period.status,
  }).select("*").single();
  if (insertError) throw new Error(`Unable to create reserve period '${period.name}': ${insertError.message}`);
  report.periodsCreated.push({ id: data.id, name: data.name, status: data.status });
  return data;
}

async function createPhases(teamId, reservePeriodId, phases) {
  for (const phase of phases) {
    const { data: existing, error } = await supabase.from("period_phases").select("id")
      .eq("team_id", teamId).eq("reserve_period_id", reservePeriodId).eq("name", phase.name).maybeSingle();
    if (error) throw new Error(`Unable to look up phase '${phase.name}': ${error.message}`);
    if (existing) { report.phasesSkipped.push({ name: phase.name, reason: "already exists" }); continue; }
    const { error: insertError } = await supabase.from("period_phases").insert({
      team_id: teamId, reserve_period_id: reservePeriodId, name: phase.name, phase_type: phase.phase_type,
      starts_on: phase.starts_on, ends_on: phase.ends_on, sort_order: phase.sort_order ?? 0,
    });
    if (insertError) throw new Error(`Unable to create phase '${phase.name}': ${insertError.message}`);
    report.phasesCreated.push({ name: phase.name });
  }
}

async function createEvents(team, reservePeriodId, events, kind) {
  for (const event of events) {
    const endsOn = event.ends_on ?? event.starts_on;
    const startsTime = event.is_all_day ? "00:00" : (event.starts_time ?? "00:00");
    const endsTime = event.is_all_day ? "23:59" : (event.ends_time ?? event.starts_time ?? "00:00");
    const startsAt = localDateTimeToIso(team.timezone, event.starts_on, startsTime);
    const endsAt = localDateTimeToIso(team.timezone, endsOn, endsTime);

    const { data: existing, error } = await supabase.from("schedule_events").select("id")
      .eq("team_id", team.id).eq("reserve_period_id", reservePeriodId)
      .eq("title", event.title).eq("starts_at", startsAt).maybeSingle();
    if (error) throw new Error(`Unable to look up event '${event.title}': ${error.message}`);
    const bucket = kind === "holiday" ? report.holidaysSkipped : report.eventsSkipped;
    if (existing) { bucket.push({ title: event.title, starts_on: event.starts_on, reason: "already exists" }); continue; }

    const { error: insertError } = await supabase.from("schedule_events").insert({
      team_id: team.id, reserve_period_id: reservePeriodId, title: event.title,
      event_type: event.event_type, starts_at: startsAt, ends_at: endsAt,
      is_all_day: Boolean(event.is_all_day), notes: event.notes ?? null, location: event.location ?? null,
    });
    if (insertError) throw new Error(`Unable to create event '${event.title}': ${insertError.message}`);
    (kind === "holiday" ? report.holidaysCreated : report.eventsCreated).push({ title: event.title, starts_on: event.starts_on });
  }
}

async function importPendingLeave(teamId, reservePeriodId, requests, nameToId) {
  for (const request of requests) {
    const personId = resolvePersonId(nameToId, request.person_name, "pending leave import");
    if (!personId) {
      report.pendingLeaveSkipped.push({ ...request, why_skipped: "person not found in team roster" });
      continue;
    }
    const { data: existing, error } = await supabase.from("leave_requests").select("id")
      .eq("team_id", teamId).eq("person_id", personId)
      .eq("starts_on", request.starts_on).eq("ends_on", request.ends_on).maybeSingle();
    if (error) throw new Error(`Unable to look up leave request for ${request.person_name}: ${error.message}`);
    if (existing) { report.pendingLeaveSkipped.push({ ...request, why_skipped: "already exists" }); continue; }

    const { error: insertError } = await supabase.from("leave_requests").insert({
      team_id: teamId, reserve_period_id: reservePeriodId, person_id: personId,
      starts_on: request.starts_on, ends_on: request.ends_on, status: "pending",
      reason: request.reason ?? null,
    });
    if (insertError) throw new Error(`Unable to create leave request for ${request.person_name}: ${insertError.message}`);
    report.pendingLeaveImported.push({ person_name: request.person_name, starts_on: request.starts_on, ends_on: request.ends_on });
  }
}

async function createHistoricalRotationGroups(teamId, reservePeriodId, groups, nameToId) {
  let sortOrder = 0;
  const colorByGroupName = { "סבב ירוק": "green", "סבב צהוב": "amber" };
  for (const group of groups) {
    let groupId;
    const { data: existingGroup, error } = await supabase.from("rotation_groups").select("id")
      .eq("team_id", teamId).eq("reserve_period_id", reservePeriodId).eq("name", group.name).maybeSingle();
    if (error) throw new Error(`Unable to look up rotation group '${group.name}': ${error.message}`);
    if (existingGroup) {
      groupId = existingGroup.id;
    } else {
      const { data: created, error: insertError } = await supabase.from("rotation_groups").insert({
        team_id: teamId, reserve_period_id: reservePeriodId, name: group.name,
        initial_state: "base", sort_order: sortOrder, color_token: colorByGroupName[group.name] ?? "blue",
      }).select("id").single();
      if (insertError) throw new Error(`Unable to create rotation group '${group.name}': ${insertError.message}`);
      groupId = created.id;
    }
    sortOrder += 1;

    for (const memberName of group.members) {
      const personId = resolvePersonId(nameToId, memberName, `historical rotation group '${group.name}'`);
      if (!personId) continue;
      const { data: existingMember, error: memberError } = await supabase.from("rotation_members").select("id")
        .eq("team_id", teamId).eq("rotation_group_id", groupId).eq("person_id", personId).maybeSingle();
      if (memberError) throw new Error(`Unable to look up rotation membership for ${memberName}: ${memberError.message}`);
      if (existingMember) continue;
      const { error: insertError } = await supabase.from("rotation_members").insert({
        team_id: teamId, rotation_group_id: groupId, person_id: personId, starts_on: null, ends_on: null,
      });
      if (insertError) throw new Error(`Unable to create rotation membership for ${memberName}: ${insertError.message}`);
      report.historicalRotationMembership.push({ group: group.name, person: memberName });
    }
  }
}

async function importHistoricalAttendance(teamId, reservePeriodId, attendanceData, nameToId, period) {
  const inRange = attendanceData.records.filter(
    (record) => record.date >= period.starts_on && record.date <= period.ends_on,
  );
  const outOfRange = attendanceData.records.length - inRange.length;
  if (outOfRange > 0) {
    report.skippedRows.push({
      why_skipped: `${outOfRange} legacy attendance sheet rows fall outside the task-specified historical period (${period.starts_on}..${period.ends_on}) and were not imported`,
    });
  }

  for (const record of inRange) {
    let { data: day, error } = await supabase.from("attendance_days").select("id, status")
      .eq("team_id", teamId).eq("reserve_period_id", reservePeriodId).eq("attendance_date", record.date).maybeSingle();
    if (error) throw new Error(`Unable to look up attendance day ${record.date}: ${error.message}`);
    if (!day) {
      const { data: created, error: insertError } = await supabase.from("attendance_days").insert({
        team_id: teamId, reserve_period_id: reservePeriodId, attendance_date: record.date,
        status: "submitted", submitted_at: new Date().toISOString(),
      }).select("id, status").single();
      if (insertError) throw new Error(`Unable to create attendance day ${record.date}: ${insertError.message}`);
      day = created;
      report.historicalAttendanceDates.push(record.date);
    } else if (day.status !== "submitted") {
      const { error: updateError } = await supabase.from("attendance_days").update({ status: "submitted" })
        .eq("id", day.id);
      if (updateError) throw new Error(`Unable to finalize attendance day ${record.date}: ${updateError.message}`);
    }

    for (const [legacyName, isPresent] of Object.entries(record.presence)) {
      const personId = resolvePersonId(nameToId, legacyName, `historical attendance ${record.date}`);
      if (!personId) continue;
      const { data: existingEntry, error: entryError } = await supabase.from("attendance_entries").select("id")
        .eq("team_id", teamId).eq("attendance_day_id", day.id).eq("person_id", personId).maybeSingle();
      if (entryError) throw new Error(`Unable to look up attendance entry ${record.date}/${legacyName}: ${entryError.message}`);
      if (existingEntry) {
        const { error: updateError } = await supabase.from("attendance_entries").update({
          is_present: isPresent, source: "legacy_import_2025",
        }).eq("id", existingEntry.id);
        if (updateError) throw new Error(`Unable to update attendance entry ${record.date}/${legacyName}: ${updateError.message}`);
        report.historicalPresenceRowsUpdated.push({ date: record.date, person: legacyName, isPresent });
      } else {
        const { error: insertError } = await supabase.from("attendance_entries").insert({
          team_id: teamId, attendance_day_id: day.id, person_id: personId,
          is_present: isPresent, source: "legacy_import_2025",
        });
        if (insertError) throw new Error(`Unable to create attendance entry ${record.date}/${legacyName}: ${insertError.message}`);
        report.historicalPresenceRowsCreated.push({ date: record.date, person: legacyName, isPresent });
      }
    }
  }
}

function printReport() {
  console.log("\n===== Phase 7 import report =====");
  for (const [key, value] of Object.entries(report)) {
    const count = Array.isArray(value) ? value.length : "n/a";
    console.log(`${key}: ${count}`);
  }
  console.log("\nFull report JSON:\n");
  console.log(JSON.stringify(report, null, 2));
}

function readJson(filename) {
  return JSON.parse(readFileSync(join(dataDir, filename), "utf-8"));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

main().catch((error) => {
  console.error("Import failed:", error);
  console.log("\nPartial report so far:\n");
  finalizeUnresolvedMappings();
  printReport();
  process.exitCode = 1;
});
