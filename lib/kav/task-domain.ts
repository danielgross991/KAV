export type RequirementType = "any_person" | "pakal";

export type TaskInterval = {
  endsAt: string;
  id: string;
  startsAt: string;
  teamId: string;
};

export type TaskRequirement = {
  id: string;
  pakalTypeId: string | null;
  requiredCount: number;
  requirementType: RequirementType;
  roleLabel: string;
  taskId: string;
  teamId: string;
};

export type ExistingAssignment = {
  id: string;
  personId: string;
  requirementId: string;
  status?: "assigned" | "cancelled" | "replaced";
  taskId: string;
  teamId: string;
};

export type CandidateInput = {
  assignments: TaskInterval[];
  attendance: "absent" | "present" | "unreported";
  expectedAtBase: boolean;
  isActive: boolean;
  isOnApprovedLeave: boolean;
  isToday: boolean;
  pakalTypeIds: string[];
  personId: string;
  teamId: string;
};

export type EligibilityReason =
  | "absent"
  | "approved-leave"
  | "cross-team"
  | "duplicate-assignment"
  | "home-rotation"
  | "inactive"
  | "invalid-requirement"
  | "missing-pakal"
  | "overlap";

export type EligibilityResult = {
  canOverride: boolean;
  eligible: boolean;
  hardBlocked: boolean;
  reasons: EligibilityReason[];
};

export function evaluateTaskEligibility({
  candidate,
  requirement,
  task,
}: {
  candidate: CandidateInput;
  requirement: TaskRequirement;
  task: TaskInterval;
}): EligibilityResult {
  const hardReasons: EligibilityReason[] = [];
  const availabilityReasons: EligibilityReason[] = [];

  if (candidate.teamId !== task.teamId || requirement.teamId !== task.teamId) {
    hardReasons.push("cross-team");
  }
  if (requirement.taskId !== task.id) hardReasons.push("invalid-requirement");
  if (!candidate.isActive) hardReasons.push("inactive");
  if (
    requirement.requirementType === "pakal" &&
    (!requirement.pakalTypeId || !candidate.pakalTypeIds.includes(requirement.pakalTypeId))
  ) {
    hardReasons.push("missing-pakal");
  }
  if (candidate.assignments.some((assignment) => assignment.id === task.id)) {
    hardReasons.push("duplicate-assignment");
  } else if (candidate.assignments.some((assignment) => intervalsOverlap(task, assignment))) {
    hardReasons.push("overlap");
  }

  if (candidate.isOnApprovedLeave) {
    availabilityReasons.push("approved-leave");
  } else if (!candidate.expectedAtBase) {
    availabilityReasons.push("home-rotation");
  }
  if (candidate.isToday && candidate.attendance === "absent") {
    availabilityReasons.push("absent");
  }

  const reasons = unique([...hardReasons, ...availabilityReasons]);
  return {
    canOverride: hardReasons.length === 0 && availabilityReasons.length > 0,
    eligible: reasons.length === 0,
    hardBlocked: hardReasons.length > 0,
    reasons,
  };
}

export function intervalsOverlap(
  left: Pick<TaskInterval, "endsAt" | "startsAt">,
  right: Pick<TaskInterval, "endsAt" | "startsAt">,
) {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}

export function expandRequirementSlots(requirement: TaskRequirement) {
  return Array.from({ length: Math.max(0, requirement.requiredCount) }, (_, slotIndex) => ({
    requirement,
    slotIndex,
  }));
}

export function snapshotTemplateRequirements(
  requirements: Array<Omit<TaskRequirement, "taskId" | "teamId">>,
  taskId: string,
  teamId: string,
) {
  return requirements.map((requirement) => ({ ...requirement, taskId, teamId }));
}

export function isTaskVisibleToViewer(
  publicationStatus: "draft" | "published",
  assignedPersonIds: string[],
  currentPersonId: string | null,
) {
  return publicationStatus === "published" && currentPersonId !== null && assignedPersonIds.includes(currentPersonId);
}

export type PublicationIssue = {
  code:
    | "cross-team"
    | "duplicate-assignment"
    | "availability"
    | "invalid-pakal"
    | "invalid-reference"
    | "invalid-requirement"
    | "overlap"
    | "uncovered";
  message: string;
  severity: "block" | "warning";
  taskId?: string;
};

export function validateTaskPublication({
  assignments,
  candidates,
  requirements,
  tasks,
}: {
  assignments: ExistingAssignment[];
  candidates: CandidateInput[];
  requirements: TaskRequirement[];
  tasks: TaskInterval[];
}): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const candidatesById = new Map(candidates.map((candidate) => [candidate.personId, candidate]));
  const activeAssignments = assignments.filter((assignment) => (assignment.status ?? "assigned") === "assigned");

  for (const requirement of requirements) {
    const task = tasksById.get(requirement.taskId);
    if (!task || task.teamId !== requirement.teamId) {
      issues.push(block("invalid-requirement", "דרישה אינה משויכת למשימה תקינה", requirement.taskId));
      continue;
    }
    if (
      requirement.requiredCount < 1 ||
      (requirement.requirementType === "pakal" && !requirement.pakalTypeId) ||
      (requirement.requirementType === "any_person" && requirement.pakalTypeId)
    ) {
      issues.push(block("invalid-requirement", "מבנה דרישת כוח האדם אינו תקין", task.id));
    }
    const covered = activeAssignments.filter((assignment) => assignment.requirementId === requirement.id).length;
    if (covered < requirement.requiredCount) {
      issues.push(block("uncovered", `חסרים ${requirement.requiredCount - covered} שיבוצים`, task.id));
    } else if (covered > requirement.requiredCount) {
      issues.push(block("invalid-requirement", "מספר השיבוצים גדול מכמות הדרישה", task.id));
    }
  }

  const seenPeopleByTask = new Set<string>();
  for (const assignment of activeAssignments) {
    const task = tasksById.get(assignment.taskId);
    const requirement = requirementsById.get(assignment.requirementId);
    const candidate = candidatesById.get(assignment.personId);
    if (!task || !requirement || !candidate || requirement.taskId !== task.id) {
      issues.push(block("invalid-reference", "שיבוץ מפנה לישות שאינה קיימת", assignment.taskId));
      continue;
    }
    if (assignment.teamId !== task.teamId || candidate.teamId !== task.teamId) {
      issues.push(block("cross-team", "שיבוץ חוצה צוותים", task.id));
    }
    const duplicateKey = `${task.id}:${candidate.personId}`;
    if (seenPeopleByTask.has(duplicateKey)) {
      issues.push(block("duplicate-assignment", "אותו אדם שובץ פעמיים לאותה משימה", task.id));
    }
    seenPeopleByTask.add(duplicateKey);
    if (
      requirement.requirementType === "pakal" &&
      (!requirement.pakalTypeId || !candidate.pakalTypeIds.includes(requirement.pakalTypeId))
    ) {
      issues.push(block("invalid-pakal", "אדם שובץ לדרישת פק״ל ללא הסמכה", task.id));
    }
  }

  for (let index = 0; index < activeAssignments.length; index += 1) {
    const left = activeAssignments[index];
    const leftTask = tasksById.get(left.taskId);
    if (!leftTask) continue;
    for (const right of activeAssignments.slice(index + 1)) {
      if (left.personId !== right.personId || left.taskId === right.taskId) continue;
      const rightTask = tasksById.get(right.taskId);
      if (rightTask && intervalsOverlap(leftTask, rightTask)) {
        issues.push(block("overlap", "לאותו אדם יש משימות חופפות", leftTask.id));
      }
    }
  }

  return dedupeIssues(issues);
}

function block(code: PublicationIssue["code"], message: string, taskId?: string): PublicationIssue {
  return { code, message, severity: "block", taskId };
}

function dedupeIssues(issues: PublicationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.taskId ?? ""}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
