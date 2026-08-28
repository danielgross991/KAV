import {
  evaluateTaskEligibility,
  expandRequirementSlots,
  type CandidateInput,
  type ExistingAssignment,
  type TaskInterval,
  type TaskRequirement,
} from "./task-domain.ts";

export type SchedulerCandidate = Omit<CandidateInput, "assignments" | "attendance" | "expectedAtBase" | "isOnApprovedLeave" | "isToday"> & {
  availabilityByTaskId: Record<string, Pick<CandidateInput, "attendance" | "expectedAtBase" | "isOnApprovedLeave" | "isToday">>;
  existingTasks: TaskInterval[];
  fullName: string;
  weeklyTaskCount: number;
  weeklyTaskMinutes: number;
};

export type ProposedAssignment = {
  explanation: string[];
  personId: string;
  requirementId: string;
  slotIndex: number;
  taskId: string;
};

export type SchedulerIssue = {
  code: "no-candidate";
  requirementId: string;
  taskId: string;
};

export function generateScheduleProposal({
  assignments,
  candidates,
  requirements,
  tasks,
}: {
  assignments: ExistingAssignment[];
  candidates: SchedulerCandidate[];
  requirements: TaskRequirement[];
  tasks: TaskInterval[];
}) {
  const activeAssignments = assignments.filter((assignment) => (assignment.status ?? "assigned") === "assigned");
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const workload = new Map(candidates.map((candidate) => [candidate.personId, {
    count: candidate.weeklyTaskCount,
    minutes: candidate.weeklyTaskMinutes,
  }]));
  const proposedTasks = new Map(candidates.map((candidate) => [candidate.personId, [...candidate.existingTasks]]));
  const specialistPakals = new Set(requirements.flatMap((requirement) =>
    requirement.requirementType === "pakal" && requirement.pakalTypeId ? [requirement.pakalTypeId] : [],
  ));

  const slots = requirements.flatMap((requirement) => {
    const covered = activeAssignments.filter((assignment) => assignment.requirementId === requirement.id).length;
    return expandRequirementSlots(requirement).slice(Math.min(covered, requirement.requiredCount));
  });

  slots.sort((left, right) => {
    const typeOrder = Number(left.requirement.requirementType === "any_person") - Number(right.requirement.requirementType === "any_person");
    if (typeOrder) return typeOrder;
    const scarcity = eligibleCount(left.requirement) - eligibleCount(right.requirement);
    if (scarcity) return scarcity;
    const leftTask = tasksById.get(left.requirement.taskId);
    const rightTask = tasksById.get(right.requirement.taskId);
    return (leftTask?.startsAt ?? "").localeCompare(rightTask?.startsAt ?? "") ||
      left.requirement.id.localeCompare(right.requirement.id) || left.slotIndex - right.slotIndex;
  });

  const proposals: ProposedAssignment[] = [];
  const issues: SchedulerIssue[] = [];

  for (const slot of slots) {
    const task = tasksById.get(slot.requirement.taskId);
    if (!task) {
      issues.push({ code: "no-candidate", requirementId: slot.requirement.id, taskId: slot.requirement.taskId });
      continue;
    }
    const eligible = candidates.filter((candidate) => eligibility(candidate, slot.requirement, task).eligible);
    eligible.sort((left, right) => compareCandidates(left, right, slot.requirement.requirementType));
    const selected = eligible[0];
    if (!selected) {
      issues.push({ code: "no-candidate", requirementId: slot.requirement.id, taskId: task.id });
      continue;
    }

    proposals.push({
      explanation: ["available", "no-overlap", `${workload.get(selected.personId)?.count ?? 0}-weekly-tasks`],
      personId: selected.personId,
      requirementId: slot.requirement.id,
      slotIndex: slot.slotIndex,
      taskId: task.id,
    });
    proposedTasks.get(selected.personId)?.push(task);
    const current = workload.get(selected.personId) ?? { count: 0, minutes: 0 };
    workload.set(selected.personId, {
      count: current.count + 1,
      minutes: current.minutes + durationMinutes(task),
    });
  }

  return {
    issues,
    lockedAssignmentIds: activeAssignments.map((assignment) => assignment.id),
    proposals,
  };

  function eligibility(candidate: SchedulerCandidate, requirement: TaskRequirement, task: TaskInterval) {
    const availability = candidate.availabilityByTaskId[task.id] ?? {
      attendance: "unreported" as const,
      expectedAtBase: false,
      isOnApprovedLeave: false,
      isToday: false,
    };
    return evaluateTaskEligibility({
      candidate: {
        ...candidate,
        ...availability,
        assignments: proposedTasks.get(candidate.personId) ?? candidate.existingTasks,
      },
      requirement,
      task,
    });
  }

  function eligibleCount(requirement: TaskRequirement) {
    const task = tasksById.get(requirement.taskId);
    return task ? candidates.filter((candidate) => eligibility(candidate, requirement, task).eligible).length : 0;
  }

  function compareCandidates(left: SchedulerCandidate, right: SchedulerCandidate, type: TaskRequirement["requirementType"]) {
    const leftWorkload = workload.get(left.personId) ?? { count: 0, minutes: 0 };
    const rightWorkload = workload.get(right.personId) ?? { count: 0, minutes: 0 };
    const leftScarcity = type === "any_person" ? left.pakalTypeIds.filter((id) => specialistPakals.has(id)).length : 0;
    const rightScarcity = type === "any_person" ? right.pakalTypeIds.filter((id) => specialistPakals.has(id)).length : 0;
    return leftScarcity - rightScarcity ||
      leftWorkload.minutes - rightWorkload.minutes ||
      leftWorkload.count - rightWorkload.count ||
      left.personId.localeCompare(right.personId);
  }
}

function durationMinutes(task: TaskInterval) {
  return Math.max(0, Math.round((Date.parse(task.endsAt) - Date.parse(task.startsAt)) / 60_000));
}
