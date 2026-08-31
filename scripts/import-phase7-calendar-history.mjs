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
const legacyLeaveRequests = readJson("kav-legacy-2025-leave-requests.json");
const defaultEquipmentTypes = readJson("kav-default-equipment-types.json");

const report = {
  periodsCreated: [], periodsReused: [],
  phasesCreated: [], phasesSkipped: [],
  eventsCreated: [], eventsSkipped: [],
  holidaysCreated: [], holidaysSkipped: [],
  pendingLeaveImported: [], pendingLeaveSkipped: [], historicalLeaveImported: [], historicalLeaveSkipped: [],
  equipmentTypesCreated: [], equipmentTypesSkipped: [],
  equipmentImported: [],
  historicalAttendanceDates: [], historicalPresenceRowsCreated: [], historicalPresenceRowsUpdated: [],
  historicalRotationBlocksCreated: [], historicalRotationBlocksSkipped: [], historicalRotationMembership: [],
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
  // The current schedule schema intentionally has no separate holiday event type;
  // holidays are displayed as all-day calendar events with the valid generic type.
  await createEvents(team, period2026.id, (reservePeriod2026.holidays ?? []).map((h) => ({ ...h, event_type: "other", is_all_day: true })), "holiday");
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
  const historicalGroupIds = await createHistoricalRotationGroups(team.id, period2025.id, legacyPeriod2025.rotationGroups ?? [], nameToId);
  await createHistoricalRotationBlocks(team.id, period2025.id, legacyPeriod2025.rotationBlocks ?? [], historicalGroupIds);
  for (const placeholder of legacyPeriod2025.placeholderNamesExcluded ?? []) {
    report.ambiguousNames.push(placeholder);
  }
  reportKnownUnresolvedHistoricalPeople(nameToId, legacyPeriod2025.unresolvedHistoricalPeople ?? []);
  await importHistoricalAttendance(team.id, period2025.id, legacyAttendance, nameToId, legacyPeriod2025.period);
  await importHistoricalLeave(team.id, period2025.id, legacyLeaveRequests.requests ?? [], nameToId, legacyPeriod2025.period);

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
  const { data: exactName, error } = await supabase
    .from("reserve_periods").select("*").eq("team_id", teamId).eq("name", period.name).maybeSingle();
  if (error) throw new Error(`Unable to look up reserve period '${period.name}': ${error.message}`);
  const existing = exactName ?? await findPeriodByDateRange(teamId, period);
  if (existing) {
    const updates = {
      ends_on: period.ends_on,
      location: period.location ?? existing.location,
      name: period.name,
      starts_on: period.starts_on,
      status: period.status,
    };
    const needsUpdate = existing.name !== updates.name ||
      existing.location !== updates.location ||
      existing.starts_on !== updates.starts_on ||
      existing.ends_on !== updates.ends_on ||
      existing.status !== updates.status;
    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from("reserve_periods")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateError) throw new Error(`Unable to update reserve period '${existing.name}': ${updateError.message}`);
      report.periodsReused.push({ id: updated.id, name: updated.name, updated: true });
      return updated;
    }
    report.periodsReused.push({ id: existing.id, name: existing.name, updated: false });
    return existing;
  }
  const { data, error: insertError } = await supabase.from("reserve_periods").insert({
    team_id: teamId, name: period.name, starts_on: period.starts_on, ends_on: period.ends_on,
    location: period.location ?? null, status: period.status,
  }).select("*").single();
  if (insertError) throw new Error(`Unable to create reserve period '${period.name}': ${insertError.message}`);
  report.periodsCreated.push({ id: data.id, name: data.name, status: data.status });
  return data;
}

async function findPeriodByDateRange(teamId, period) {
  const { data, error } = await supabase
    .from("reserve_periods")
    .select("*")
    .eq("team_id", teamId)
    .eq("starts_on", period.starts_on)
    .eq("ends_on", period.ends_on)
    .maybeSingle();
  if (error) throw new Error(`Unable to look up reserve period by date range: ${error.message}`);
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

    // Holidays in the legacy extract use a semantic label that is not part of the
    // schedule_events constraint. Preserve them as all-day events using the valid
    // generic category; the title and all-day flag retain the calendar meaning.
    const eventType = ["briefing", "training", "family", "processing", "changeover", "other"]
      .includes(event.event_type) ? event.event_type : "other";
    const { error: insertError } = await supabase.from("schedule_events").insert({
      team_id: team.id, reserve_period_id: reservePeriodId, title: event.title,
      event_type: eventType, starts_at: startsAt, ends_at: endsAt,
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

async function importHistoricalLeave(teamId, reservePeriodId, requests, nameToId, period) {
  for (const request of requests) {
    if (request.starts_on < period.starts_on || request.ends_on > period.ends_on) {
      report.historicalLeaveSkipped.push({ ...request, why_skipped: "outside historical reserve period" });
      continue;
    }

    const personId = resolvePersonId(nameToId, request.person_name, "historical leave import");
    if (!personId) {
      report.historicalLeaveSkipped.push({ ...request, why_skipped: "person not found in team roster" });
      continue;
    }

    const { data: existing, error } = await supabase.from("leave_requests").select("id")
      .eq("team_id", teamId).eq("person_id", personId)
      .eq("starts_on", request.starts_on).eq("ends_on", request.ends_on)
      .eq("reason", request.reason ?? null).maybeSingle();
    if (error) throw new Error(`Unable to look up historical leave for ${request.person_name}: ${error.message}`);
    if (existing) {
      report.historicalLeaveSkipped.push({ ...request, why_skipped: "already exists" });
      continue;
    }

    const { error: insertError } = await supabase.from("leave_requests").insert({
      team_id: teamId,
      reserve_period_id: reservePeriodId,
      person_id: personId,
      starts_on: request.starts_on,
      ends_on: request.ends_on,
      status: "approved",
      approved_starts_on: request.starts_on,
      approved_ends_on: request.ends_on,
      reason: request.reason ?? null,
      manager_notes: request.source_cell ? `מקור אקסל: ${request.source_cell}` : null,
    });
    if (insertError) throw new Error(`Unable to create historical leave for ${request.person_name}: ${insertError.message}`);
    report.historicalLeaveImported.push({
      person_name: request.person_name,
      starts_on: request.starts_on,
      ends_on: request.ends_on,
      reason: request.reason ?? null,
    });
  }
}

async function createHistoricalRotationGroups(teamId, reservePeriodId, groups, nameToId) {
  let sortOrder = 0;
  const colorByGroupName = { "סבב ירוק": "green", "סבב צהוב": "amber" };
  const groupIdByName = new Map();
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
    groupIdByName.set(group.name, groupId);
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
  return groupIdByName;
}

async function createHistoricalRotationBlocks(teamId, reservePeriodId, blocks, groupIdByName) {
  for (const block of blocks) {
    const rotationGroupId = groupIdByName.get(block.group_name);
    if (!rotationGroupId) {
      report.historicalRotationBlocksSkipped.push({ ...block, why_skipped: "rotation group not found" });
      continue;
    }

    const { data: existing, error } = await supabase.from("rotation_blocks").select("id")
      .eq("team_id", teamId).eq("reserve_period_id", reservePeriodId).eq("rotation_group_id", rotationGroupId)
      .eq("starts_on", block.starts_on).eq("ends_on", block.ends_on).maybeSingle();
    if (error) throw new Error(`Unable to look up historical rotation block ${block.group_name} ${block.starts_on}: ${error.message}`);
    if (existing) {
      report.historicalRotationBlocksSkipped.push({ group: block.group_name, starts_on: block.starts_on, ends_on: block.ends_on, reason: "already exists" });
      continue;
    }

    const { error: insertError } = await supabase.from("rotation_blocks").insert({
      team_id: teamId,
      reserve_period_id: reservePeriodId,
      rotation_group_id: rotationGroupId,
      state: block.state,
      starts_on: block.starts_on,
      ends_on: block.ends_on,
      source: "manual",
      sequence_no: null,
    });
    if (insertError) throw new Error(`Unable to create historical rotation block ${block.group_name} ${block.starts_on}: ${insertError.message}`);
    report.historicalRotationBlocksCreated.push({ group: block.group_name, state: block.state, starts_on: block.starts_on, ends_on: block.ends_on });
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

  const { data: existingDays, error: daysError } = await supabase.from("attendance_days")
    .select("id, attendance_date, status").eq("team_id", teamId).eq("reserve_period_id", reservePeriodId);
  if (daysError) throw new Error(`Unable to load historical attendance days: ${daysError.message}`);
  const dayByDate = new Map((existingDays ?? []).map((day) => [day.attendance_date, day]));
  for (const record of inRange) {
    let day = dayByDate.get(record.date);
    if (!day) {
      const { data: created, error: insertError } = await supabase.from("attendance_days").insert({
        team_id: teamId, reserve_period_id: reservePeriodId, attendance_date: record.date,
        status: "submitted", submitted_at: new Date().toISOString(),
      }).select("id, attendance_date, status").single();
      if (insertError) throw new Error(`Unable to create attendance day ${record.date}: ${insertError.message}`);
      day = created;
      dayByDate.set(record.date, day);
      report.historicalAttendanceDates.push(record.date);
    } else if (day.status !== "submitted") {
      const { error: updateError } = await supabase.from("attendance_days").update({ status: "submitted" }).eq("id", day.id);
      if (updateError) throw new Error(`Unable to finalize attendance day ${record.date}: ${updateError.message}`);
    }
  }

  const dayIds = [...dayByDate.values()].map((day) => day.id);
  const existingEntries = dayIds.length ? await getExistingAttendanceEntries(teamId, dayIds) : [];
  const entryKeys = new Set(existingEntries.map((entry) => `${entry.attendance_day_id}:${entry.person_id}`));
  const rowsToInsert = [];
  for (const record of inRange) {
    const day = dayByDate.get(record.date);
    for (const [legacyName, isPresent] of Object.entries(record.presence)) {
      const personId = resolvePersonId(nameToId, legacyName, `historical attendance ${record.date}`);
      if (!personId) continue;
      const key = `${day.id}:${personId}`;
      if (entryKeys.has(key)) continue;
      entryKeys.add(key);
      rowsToInsert.push({ team_id: teamId, attendance_day_id: day.id, person_id: personId, is_present: isPresent, source: "manual" });
      report.historicalPresenceRowsCreated.push({ date: record.date, person: legacyName, isPresent });
    }
  }
  for (let index = 0; index < rowsToInsert.length; index += 500) {
    const { error: insertError } = await supabase.from("attendance_entries")
      .upsert(rowsToInsert.slice(index, index + 500), {
        onConflict: "attendance_day_id,person_id",
        ignoreDuplicates: true,
      });
    if (insertError) throw new Error(`Unable to create historical attendance entries: ${insertError.message}`);
  }
}

async function getExistingAttendanceEntries(teamId, dayIds) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("attendance_entries").select("id, attendance_day_id, person_id")
      .eq("team_id", teamId).in("attendance_day_id", dayIds)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load historical attendance entries: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
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
