import assert from "node:assert/strict";
import test from "node:test";

import { generateScheduleProposal } from "./scheduler.ts";

const task = { id: "task-1", teamId: "team-1", startsAt: "2026-09-10T05:00:00.000Z", endsAt: "2026-09-10T06:00:00.000Z" };
const anyRequirement = { id: "req-any", taskId: task.id, teamId: task.teamId, requirementType: "any_person", pakalTypeId: null, requiredCount: 1, roleLabel: "כללי" };
const medicRequirement = { ...anyRequirement, id: "req-medic", requirementType: "pakal", pakalTypeId: "medic", roleLabel: "חובש" };

function candidate(id, overrides = {}) {
  return {
    personId: id, fullName: id, teamId: "team-1", isActive: true, pakalTypeIds: [],
    weeklyTaskCount: 0, weeklyTaskMinutes: 0, existingTasks: [],
    availabilityByTaskId: { [task.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "unreported", isToday: false } },
    ...overrides,
  };
}

function schedule({ assignments = [], candidates = [candidate("person-1")], requirements = [anyRequirement], tasks = [task] } = {}) {
  return generateScheduleProposal({ assignments, candidates, requirements, tasks });
}

test("one eligible person fills one slot", () => {
  assert.equal(schedule().proposals[0].personId, "person-1");
});

test("lowest workload minutes wins", () => {
  const result = schedule({ candidates: [candidate("busy", { weeklyTaskMinutes: 120 }), candidate("light", { weeklyTaskMinutes: 60 })] });
  assert.equal(result.proposals[0].personId, "light");
});

test("equal workload uses deterministic person ID tie-break", () => {
  const result = schedule({ candidates: [candidate("z-person"), candidate("a-person")] });
  assert.equal(result.proposals[0].personId, "a-person");
});

test("PAKAL slot considers only qualified people", () => {
  const result = schedule({ requirements: [medicRequirement], candidates: [candidate("regular"), candidate("medic", { pakalTypeIds: ["medic"] })] });
  assert.equal(result.proposals[0].personId, "medic");
});

test("specialist slot is filled before overlapping ANY_PERSON slot", () => {
  const generalTask = { ...task, id: "general", startsAt: "2026-09-10T05:30:00.000Z", endsAt: "2026-09-10T06:30:00.000Z" };
  const generalReq = { ...anyRequirement, taskId: generalTask.id };
  const candidates = [
    candidate("medic", { pakalTypeIds: ["medic"], availabilityByTaskId: {
      [task.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "unreported", isToday: false },
      [generalTask.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "unreported", isToday: false },
    } }),
    candidate("regular", { availabilityByTaskId: {
      [task.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "unreported", isToday: false },
      [generalTask.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "unreported", isToday: false },
    } }),
  ];
  const result = schedule({ candidates, requirements: [generalReq, medicRequirement], tasks: [generalTask, task] });
  assert.equal(result.proposals.find((proposal) => proposal.requirementId === medicRequirement.id)?.personId, "medic");
  assert.equal(result.proposals.find((proposal) => proposal.requirementId === generalReq.id)?.personId, "regular");
});

test("existing manual assignment is locked and preserved", () => {
  const assignment = { id: "manual", personId: "person-1", requirementId: anyRequirement.id, taskId: task.id, teamId: task.teamId };
  const result = schedule({ assignments: [assignment] });
  assert.deepEqual(result.lockedAssignmentIds, ["manual"]);
  assert.equal(result.proposals.length, 0);
});

test("candidate with overlap is excluded", () => {
  const overlap = { id: "other", teamId: "team-1", startsAt: task.startsAt, endsAt: task.endsAt };
  const result = schedule({ candidates: [candidate("blocked", { existingTasks: [overlap] }), candidate("free")] });
  assert.equal(result.proposals[0].personId, "free");
});

test("candidate on approved leave is excluded", () => {
  const result = schedule({ candidates: [candidate("leave", { availabilityByTaskId: { [task.id]: { expectedAtBase: false, isOnApprovedLeave: true, attendance: "unreported", isToday: false } } }), candidate("free")] });
  assert.equal(result.proposals[0].personId, "free");
});

test("today absent candidate is excluded", () => {
  const result = schedule({ candidates: [candidate("absent", { availabilityByTaskId: { [task.id]: { expectedAtBase: true, isOnApprovedLeave: false, attendance: "absent", isToday: true } } }), candidate("present")] });
  assert.equal(result.proposals[0].personId, "present");
});

test("no candidate returns an issue without a fake assignment", () => {
  const result = schedule({ candidates: [] });
  assert.equal(result.proposals.length, 0);
  assert.equal(result.issues[0].code, "no-candidate");
});

test("multiple requirements are all filled", () => {
  const secondReq = { ...anyRequirement, id: "req-2" };
  const result = schedule({ candidates: [candidate("one"), candidate("two")], requirements: [anyRequirement, secondReq] });
  assert.equal(result.proposals.length, 2);
});

test("insufficient capacity returns partial proposal and explicit issue", () => {
  const requirement = { ...anyRequirement, requiredCount: 2 };
  const result = schedule({ candidates: [candidate("one")], requirements: [requirement] });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.issues.length, 1);
});

test("workload minutes take precedence over task count", () => {
  const result = schedule({ candidates: [
    candidate("many-short", { weeklyTaskCount: 3, weeklyTaskMinutes: 90 }),
    candidate("one-long", { weeklyTaskCount: 1, weeklyTaskMinutes: 480 }),
  ] });
  assert.equal(result.proposals[0].personId, "many-short");
});

test("proposal generation does not mutate input assignments or candidates", () => {
  const candidates = [candidate("person-1")];
  const assignments = [];
  const before = JSON.stringify({ assignments, candidates });
  schedule({ assignments, candidates });
  assert.equal(JSON.stringify({ assignments, candidates }), before);
});
