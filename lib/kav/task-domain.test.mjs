import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateTaskEligibility,
  expandRequirementSlots,
  intervalsOverlap,
  isTaskVisibleToViewer,
  snapshotTemplateRequirements,
  validateTaskPublication,
} from "./task-domain.ts";

const task = { id: "task-1", teamId: "team-1", startsAt: "2026-09-10T05:00:00.000Z", endsAt: "2026-09-10T07:00:00.000Z" };
const anyRequirement = { id: "req-any", taskId: task.id, teamId: task.teamId, requirementType: "any_person", pakalTypeId: null, requiredCount: 1, roleLabel: "כללי" };
const medicRequirement = { ...anyRequirement, id: "req-medic", requirementType: "pakal", pakalTypeId: "medic", roleLabel: "חובש" };

function person(overrides = {}) {
  return {
    personId: "person-1", teamId: "team-1", isActive: true, expectedAtBase: true,
    isOnApprovedLeave: false, attendance: "unreported", isToday: false,
    pakalTypeIds: [], assignments: [], ...overrides,
  };
}

test("ANY_PERSON accepts an available person", () => {
  assert.equal(evaluateTaskEligibility({ candidate: person(), requirement: anyRequirement, task }).eligible, true);
});

test("PAKAL medic rejects a non-medic", () => {
  const result = evaluateTaskEligibility({ candidate: person(), requirement: medicRequirement, task });
  assert.deepEqual(result.reasons, ["missing-pakal"]);
  assert.equal(result.hardBlocked, true);
});

test("PAKAL medic accepts a qualified medic", () => {
  assert.equal(evaluateTaskEligibility({ candidate: person({ pakalTypeIds: ["medic"] }), requirement: medicRequirement, task }).eligible, true);
});

test("approved leave is excluded but explicitly overridable", () => {
  const result = evaluateTaskEligibility({ candidate: person({ isOnApprovedLeave: true, expectedAtBase: false }), requirement: anyRequirement, task });
  assert.equal(result.eligible, false);
  assert.equal(result.canOverride, true);
  assert.ok(result.reasons.includes("approved-leave"));
});

test("home rotation is excluded but explicitly overridable", () => {
  const result = evaluateTaskEligibility({ candidate: person({ expectedAtBase: false }), requirement: anyRequirement, task });
  assert.deepEqual(result.reasons, ["home-rotation"]);
  assert.equal(result.canOverride, true);
});

test("expected-at-base person is accepted", () => {
  assert.equal(evaluateTaskEligibility({ candidate: person({ expectedAtBase: true }), requirement: anyRequirement, task }).eligible, true);
});

test("today absent person is excluded", () => {
  const result = evaluateTaskEligibility({ candidate: person({ attendance: "absent", isToday: true }), requirement: anyRequirement, task });
  assert.deepEqual(result.reasons, ["absent"]);
});

test("future attendance state does not exclude", () => {
  assert.equal(evaluateTaskEligibility({ candidate: person({ attendance: "absent", isToday: false }), requirement: anyRequirement, task }).eligible, true);
});

test("overlapping assignment is hard-blocked", () => {
  const existing = { id: "other", teamId: "team-1", startsAt: "2026-09-10T06:00:00.000Z", endsAt: "2026-09-10T08:00:00.000Z" };
  const result = evaluateTaskEligibility({ candidate: person({ assignments: [existing] }), requirement: anyRequirement, task });
  assert.deepEqual(result.reasons, ["overlap"]);
  assert.equal(result.canOverride, false);
});

test("duplicate task assignment is rejected", () => {
  const result = evaluateTaskEligibility({ candidate: person({ assignments: [task] }), requirement: anyRequirement, task });
  assert.deepEqual(result.reasons, ["duplicate-assignment"]);
});

test("cross-team assignment is rejected", () => {
  const result = evaluateTaskEligibility({ candidate: person({ teamId: "other-team" }), requirement: anyRequirement, task });
  assert.ok(result.reasons.includes("cross-team"));
  assert.equal(result.hardBlocked, true);
});

test("requirement quantity expands into stable slots", () => {
  const slots = expandRequirementSlots({ ...anyRequirement, requiredCount: 3 });
  assert.deepEqual(slots.map((slot) => slot.slotIndex), [0, 1, 2]);
});

test("template requirement snapshot is independent of later edits", () => {
  const template = [{ id: anyRequirement.id, pakalTypeId: null, requiredCount: 1, requirementType: "any_person", roleLabel: "כללי" }];
  const normalized = template.map((requirement) => ({ ...requirement }));
  const snapshot = snapshotTemplateRequirements(normalized, "instance-1", "team-1");
  template[0].roleLabel = "changed";
  assert.equal(snapshot[0].roleLabel, "כללי");
  assert.equal(snapshot[0].taskId, "instance-1");
});

test("viewer cannot see a draft task", () => {
  assert.equal(isTaskVisibleToViewer("draft", ["person-1"], "person-1"), false);
});

test("viewer sees only an assigned published task", () => {
  assert.equal(isTaskVisibleToViewer("published", ["person-1", "person-2"], "person-1"), true);
  assert.equal(isTaskVisibleToViewer("published", ["person-2"], "person-1"), false);
});

test("adjacent intervals do not overlap while overnight intersections do", () => {
  assert.equal(intervalsOverlap(task, { startsAt: task.endsAt, endsAt: "2026-09-10T08:00:00.000Z" }), false);
  assert.equal(intervalsOverlap(task, { startsAt: "2026-09-10T06:59:00.000Z", endsAt: "2026-09-10T08:00:00.000Z" }), true);
});

test("publication blocks uncovered requirements", () => {
  const issues = validateTaskPublication({ assignments: [], candidates: [person()], requirements: [anyRequirement], tasks: [task] });
  assert.ok(issues.some((issue) => issue.code === "uncovered" && issue.severity === "block"));
});

test("publication blocks invalid pakal assignments", () => {
  const assignments = [{ id: "a1", personId: "person-1", requirementId: medicRequirement.id, taskId: task.id, teamId: task.teamId }];
  const issues = validateTaskPublication({ assignments, candidates: [person()], requirements: [medicRequirement], tasks: [task] });
  assert.ok(issues.some((issue) => issue.code === "invalid-pakal"));
});

test("publication blocks overlapping assignments", () => {
  const secondTask = { ...task, id: "task-2", startsAt: "2026-09-10T06:00:00.000Z", endsAt: "2026-09-10T08:00:00.000Z" };
  const secondReq = { ...anyRequirement, id: "req-2", taskId: secondTask.id };
  const assignments = [
    { id: "a1", personId: "person-1", requirementId: anyRequirement.id, taskId: task.id, teamId: task.teamId },
    { id: "a2", personId: "person-1", requirementId: secondReq.id, taskId: secondTask.id, teamId: task.teamId },
  ];
  const issues = validateTaskPublication({ assignments, candidates: [person()], requirements: [anyRequirement, secondReq], tasks: [task, secondTask] });
  assert.ok(issues.some((issue) => issue.code === "overlap"));
});

test("publication accepts a structurally valid covered schedule", () => {
  const assignments = [{ id: "a1", personId: "person-1", requirementId: anyRequirement.id, taskId: task.id, teamId: task.teamId }];
  assert.deepEqual(validateTaskPublication({ assignments, candidates: [person()], requirements: [anyRequirement], tasks: [task] }), []);
});

test("publication blocks assignments beyond requirement quantity", () => {
  const assignments = [
    { id: "a1", personId: "person-1", requirementId: anyRequirement.id, taskId: task.id, teamId: task.teamId },
    { id: "a2", personId: "person-2", requirementId: anyRequirement.id, taskId: task.id, teamId: task.teamId },
  ];
  const issues = validateTaskPublication({
    assignments,
    candidates: [person(), person({ personId: "person-2" })],
    requirements: [anyRequirement],
    tasks: [task],
  });
  assert.ok(issues.some((issue) => issue.code === "invalid-requirement"));
});
