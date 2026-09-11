import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const appShellSource = readFileSync(join(__dirname, "..", "..", "components", "app-shell.tsx"), "utf-8");
const authSource = readFileSync(join(__dirname, "auth.ts"), "utf-8");
const badgeSource = readFileSync(join(__dirname, "..", "..", "components", "ui", "badge.tsx"), "utf-8");
const buttonSource = readFileSync(join(__dirname, "..", "..", "components", "ui", "button.tsx"), "utf-8");
const formPendingOverlaySource = readFileSync(join(__dirname, "..", "..", "components", "form-pending-overlay.tsx"), "utf-8");
const teamsSource = readFileSync(join(__dirname, "teams.ts"), "utf-8");
const dashboardSource = readFileSync(join(__dirname, "dashboard.ts"), "utf-8");
const lineParticipationSource = readFileSync(join(__dirname, "line-participation.ts"), "utf-8");
const managerLeaveSource = readFileSync(join(__dirname, "manager-leave.ts"), "utf-8");
const operationsSource = readFileSync(join(__dirname, "operations.ts"), "utf-8");
const scheduleSource = readFileSync(join(__dirname, "schedule.ts"), "utf-8");
const scheduleActionsSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "schedule", "actions.ts"), "utf-8");
const scheduleDayPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "schedule", "[date]", "page.tsx"), "utf-8");
const schedulePageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "schedule", "page.tsx"), "utf-8");
const scheduleViewSource = readFileSync(join(__dirname, "..", "..", "components", "schedule-view.tsx"), "utf-8");
const settingsManagementViewSource = readFileSync(join(__dirname, "..", "..", "components", "settings-management-view.tsx"), "utf-8");
const settingsPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "settings", "page.tsx"), "utf-8");
const dashboardViewSource = readFileSync(join(__dirname, "..", "..", "components", "dashboard-view.tsx"), "utf-8");
const equipmentPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "equipment", "page.tsx"), "utf-8");
const leaveActionsSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "leave", "actions.ts"), "utf-8");
const leavePageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "leave", "page.tsx"), "utf-8");
const loginActionsSource = readFileSync(join(__dirname, "..", "..", "app", "login", "actions.ts"), "utf-8");
const quotesActionsSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "quotes", "actions.ts"), "utf-8");
const tasksSource = readFileSync(join(__dirname, "tasks.ts"), "utf-8");
const tasksPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "tasks", "page.tsx"), "utf-8");
const teamActionsSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "team", "actions.ts"), "utf-8");
const teamLayoutSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "layout.tsx"), "utf-8");
const teamManagementSource = readFileSync(join(__dirname, "team-management.ts"), "utf-8");
const teamManagementViewSource = readFileSync(join(__dirname, "..", "..", "components", "team-management-view.tsx"), "utf-8");
const teamNavSource = readFileSync(join(__dirname, "..", "..", "components", "team-nav.tsx"), "utf-8");
const userProfileMenuSource = readFileSync(join(__dirname, "..", "..", "components", "user-profile-menu.tsx"), "utf-8");
const viewerLeaveRequestFormSource = readFileSync(join(__dirname, "..", "..", "components", "viewer-leave-request-form.tsx"), "utf-8");
const activitySource = readFileSync(join(__dirname, "activity.ts"), "utf-8");
const notificationsPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "notifications", "page.tsx"), "utf-8");
const heavyRouteLoadingSources = [
  "attendance",
  "leave",
  "notifications",
  "schedule",
  "tasks",
].map((route) => readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", route, "loading.tsx"), "utf-8"));

test("auth and team access use request-scoped React cache", () => {
  assert.match(authSource, /import \{ cache \} from "react"/);
  assert.match(authSource, /export const requireAuth = cache/);
  assert.match(teamsSource, /import \{ cache \} from "react"/);
  assert.match(teamsSource, /export const getUserTeams = cache/);
  assert.match(teamsSource, /export const requireTeamAccess = cache/);
});

test("private auth data is not stored in the persistent Next cache", () => {
  assert.doesNotMatch(authSource, /unstable_cache|use cache/);
  assert.doesNotMatch(teamsSource, /unstable_cache|use cache/);
});

test("main page data loaders are request cached across the app", () => {
  for (const [source, exportName] of [
    [dashboardSource, "getDashboardData"],
    [operationsSource, "getOperationalRange"],
    [operationsSource, "getOperationalDay"],
    [scheduleSource, "getScheduleData"],
    [tasksSource, "getTasksData"],
    [tasksSource, "getTaskDaySchedule"],
    [teamManagementSource, "getTeamManagementData"],
    [teamManagementSource, "getPersonProfileData"],
  ]) {
    assert.match(source, new RegExp(`export const ${exportName} = cache`), `${exportName} should use request cache`);
  }
});

test("dashboard does not run the separate operational summary query path", () => {
  assert.doesNotMatch(dashboardSource, /getOperationalScheduleSummary/);
  assert.match(operationsSource, /rotationStatus:/);
});

test("schedule month and view switches stay on the current client page", () => {
  assert.match(scheduleViewSource, /function switchSchedule/);
  assert.match(scheduleViewSource, /window\.history\.pushState/);
  assert.match(scheduleViewSource, /setActiveMonth/);
  assert.match(scheduleViewSource, /setActiveView/);
  assert.match(scheduleViewSource, /scheduleLoadingHandoffMs/);
  assert.match(scheduleViewSource, /pressedSchedule/);
  assert.match(scheduleViewSource, /schedulePressFeedbackMs/);
  assert.match(scheduleViewSource, /function MonthNavButton/);
  assert.match(scheduleViewSource, /setLocalPending\(true\)[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setActiveView/);
});

test("global line selection wins over stale period query defaults", () => {
  const dashboardPageSource = readFileSync(join(__dirname, "..", "..", "app", "[teamSlug]", "page.tsx"), "utf-8");
  assert.match(schedulePageSource, /selectedLinePeriodId \?\? query\.period \?\? undefined/);
  assert.match(scheduleDayPageSource, /selectedLinePeriodId \?\? query\.period \?\? undefined/);
  assert.match(tasksPageSource, /periodId: selectedLinePeriodId \?\? query\.period \?\? undefined/);
  assert.match(leavePageSource, /await getSelectedLinePeriodId\(teamSlug\) \?\? query\.period \?\? null/);
  assert.match(dashboardPageSource, /selectedLinePeriodId \?\? query\.statsPeriod \?\? undefined/);
});

test("schedule day tap opens an in-page day preview before full detail", () => {
  assert.match(scheduleViewSource, /function DayPreview/);
  assert.match(scheduleViewSource, /aria-haspopup="dialog"/);
  assert.match(scheduleViewSource, /event\.preventDefault\(\)/);
  assert.match(scheduleViewSource, /onPreview/);
  assert.match(scheduleViewSource, /בקשות יציאה/);
  assert.match(scheduleViewSource, /aria-label=\{`\$\{teamLeaveCount\} בקשות יציאה`\}/);
  assert.match(scheduleViewSource, /function isRiskyLeaveDate/);
  assert.match(scheduleViewSource, /riskyLeaveRequestThreshold/);
  assert.match(scheduleViewSource, /יום אדום - יותר מ/);
  assert.match(scheduleViewSource, /enrichmentMarkers\.map/);
  assert.match(scheduleViewSource, /isCommanderDayEvent/);
  assert.match(scheduleViewSource, /bg-pink-200\/95/);
  assert.match(scheduleViewSource, /יום מפקדים/);
  assert.doesNotMatch(scheduleViewSource, /\{teamLeaveCount\} בקשות יציאה<\/div>/);
  assert.doesNotMatch(scheduleViewSource, /\{day\.expectedBase\.length\} בבסיס/);
  assert.match(scheduleViewSource, /function isChangeoverDate/);
  assert.match(scheduleViewSource, /previousState !== null && previousState !== state/);
  assert.doesNotMatch(scheduleViewSource, /nextState/);
  assert.match(scheduleViewSource, /operationalLabel/);
  assert.doesNotMatch(scheduleViewSource, /groupColorClass/);
});

test("primary actions force readable white text on dark primary backgrounds", () => {
  assert.match(buttonSource, /default: "bg-primary !text-white/);
  assert.match(badgeSource, /default: "border-transparent bg-primary !text-white/);
  assert.match(scheduleViewSource, /bg-primary px-3 text-sm font-semibold !text-white/);
});

test("reserve period management is admin-only while operational management remains broader", () => {
  assert.match(teamsSource, /export function canManageReservePeriods/);
  assert.match(scheduleSource, /canManageReservePeriods:/);
  assert.match(scheduleViewSource, /data\.canManage && \(data\.canManageReservePeriods \|\| period\)/);
  assert.match(scheduleViewSource, /data\.canManageReservePeriods/);
  assert.match(scheduleViewSource, /admin \? <><Phases data=\{data\} \/><Groups data=\{data\} \/><Assignments data=\{data\} \/><Generator data=\{data\} \/><Blocks data=\{data\} \/><\/> : null/);
  assert.match(scheduleViewSource, /<Overrides data=\{data\} \/><Events data=\{data\} \/>/);
  assert.match(scheduleActionsSource, /export async function createReservePeriodAction[\s\S]*adminContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function publishReservePeriodAction[\s\S]*adminContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function saveRotationOverrideAction[\s\S]*managerContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function saveScheduleEventAction[\s\S]*managerContext\(teamSlug\)/);
  assert.match(scheduleActionsSource, /export async function deleteScheduleEventAction[\s\S]*managerContext\(teamSlug\)/);
});

test("manager activity feed logs sign-ins, leave requests, and equipment changes", () => {
  assert.match(activitySource, /export async function logActivityEvent/);
  assert.match(notificationsPageSource, /\.from\("activity_events"\)/);
  assert.match(notificationsPageSource, /if \(!canManage\(membership\.role\)\)/);
  assert.match(teamNavSource, /href: "\/notifications"/);
  assert.match(loginActionsSource, /auth\.sign_in/);
  assert.match(leaveActionsSource, /leave\.request_created/);
  assert.match(quotesActionsSource, /entityType: "daily_quote"/);
  assert.match(quotesActionsSource, /eventType: "leave\.request_created"/);
  assert.match(notificationsPageSource, /MessageSquareQuote/);
  assert.match(notificationsPageSource, /entityType === "daily_quote"/);
  assert.match(notificationsPageSource, /משפט חדש/);
  assert.match(teamActionsSource, /equipment\.updated/);
  assert.match(teamActionsSource, /team_equipment\.transferred/);
});

test("dashboard request champions count requested leave days", () => {
  assert.match(dashboardSource, /getLeaveRequestDayCounts/);
  assert.match(dashboardSource, /leaveRequestLeaderboard:/);
  assert.match(dashboardSource, /requestDays:/);
  assert.match(dashboardSource, /b\.requestDays - a\.requestDays/);
  assert.match(operationsSource, /get_team_leave_request_day_counts/);
  assert.match(dashboardViewSource, /ימי בקשה/);
});

test("home champions show only the home percentage in the podium", () => {
  const homeLeaderboardSource = dashboardViewSource.match(/function HomeLeaderboard[\s\S]*?function LeaveRequestLeaderboard/)?.[0] ?? "";
  assert.match(homeLeaderboardSource, /<details/);
  assert.match(homeLeaderboardSource, /<summary/);
  assert.match(homeLeaderboardSource, /Math\.round\(item\.homePercentage \* 100\)\}%/);
  assert.match(homeLeaderboardSource, />בבסיס</);
  assert.match(homeLeaderboardSource, />בבית</);
  assert.doesNotMatch(homeLeaderboardSource, /item\.homeDays\} ימים/);
});

test("dashboard surfaces current-line inactive people below home champions", () => {
  assert.match(dashboardSource, /specialPeople:/);
  assert.match(dashboardSource, /getLineInactivePersonIds/);
  assert.match(dashboardSource, /getAttendanceEntriesByDate/);
  assert.match(dashboardViewSource, /function SpecialPeople/);
  assert.match(dashboardViewSource, /המיוחדים/);
  assert.match(dashboardViewSource, /ימים שכן היה בקו/);
  assert.match(lineParticipationSource, /reserve_period_person_statuses/);
  assert.match(lineParticipationSource, /filterLineActivePeople/);
});

test("manager leave requests moved from dashboard to mobile schedule tab", () => {
  assert.doesNotMatch(dashboardViewSource, /function ManagerLeaveRequests/);
  assert.doesNotMatch(dashboardSource, /managerLeaveRequests:/);
  assert.match(managerLeaveSource, /\.from\("leave_requests"\)/);
  assert.match(scheduleSource, /managerLeaveRequests:/);
  assert.match(scheduleViewSource, /function ScheduleLeaveRequests/);
  assert.match(scheduleViewSource, /activeView === "leaveRequests"/);
  assert.match(scheduleViewSource, /className="md:hidden"/);
  assert.match(scheduleViewSource, /כל הבקשות בקו הנבחר/);
});

test("viewer leave requests are rejected when every requested day is already home", () => {
  assert.match(leaveActionsSource, /getOperationalRange/);
  assert.match(leaveActionsSource, /eachCalendarDate\(startsOn, endsOn\)/);
  assert.match(leaveActionsSource, /plannedState === "base"/);
  assert.match(leaveActionsSource, /אופס! יצאת חמור - בקשת היציאה שלך היא לתאריך שאנחנו במילא בבית!/);
  assert.match(leaveActionsSource, /createViewerLeaveRequestStateAction/);
  assert.match(viewerLeaveRequestFormSource, /useActionState/);
  assert.match(viewerLeaveRequestFormSource, /role="alert"/);
  assert.match(leavePageSource, /<ViewerLeaveRequestForm/);
});

test("team equipment quick edit updates only table-visible fields", () => {
  assert.match(teamActionsSource, /export async function quickUpdateEquipmentAction/);
  assert.match(teamActionsSource, /quickUpdateEquipmentAction[\s\S]*model: optionalText\(formData, "model"\)/);
  assert.match(teamActionsSource, /quickUpdateEquipmentAction[\s\S]*serial_number: optionalText\(formData, "serial_number"\)/);
  assert.match(teamActionsSource, /quickUpdateEquipmentAction[\s\S]*status,/);
  assert.doesNotMatch(teamActionsSource.match(/export async function quickUpdateEquipmentAction[\s\S]*?export async function returnEquipmentAction/)?.[0] ?? "", /notes:|assigned_at:|returned_at:/);
});

test("team mobile view keeps a manager-only full equipment table", () => {
  assert.match(teamManagementViewSource, /showMobileEquipment/);
  assert.match(teamManagementViewSource, /הצגת כל הציוד/);
  assert.match(teamManagementViewSource, /function MobileEquipmentTable/);
  assert.match(teamManagementViewSource, /data\.canManageTeam \?/);
  assert.match(teamManagementViewSource, /sticky right-0 z-20/);
  assert.match(teamManagementViewSource, /w-\[7\.5rem\]/);
  assert.match(teamManagementViewSource, /max-h-\[70vh\] overflow-auto/);
  assert.match(teamManagementViewSource, /sticky top-0 right-0 z-30/);
  assert.match(teamManagementViewSource, /sticky top-0 z-20/);
  assert.match(teamManagementViewSource, /editingEquipment/);
  assert.match(teamManagementViewSource, /function EquipmentCategoryCell/);
  assert.match(teamManagementViewSource, /function EquipmentEditDialog/);
  assert.match(teamManagementViewSource, /aria-label=\{`עריכת ציוד/);
  assert.match(teamManagementViewSource, /quickUpdateEquipmentAction/);
  assert.match(teamManagementViewSource, /return_to" type="hidden" value="team"/);
  assert.match(teamManagementViewSource, /placeholder="צ׳"/);
});

test("team shared equipment is separate from personal equipment and has quick responsibility transfer", () => {
  assert.match(teamManagementSource, /export type TeamEquipmentItem/);
  assert.match(teamManagementSource, /\.from\("team_equipment_items"\)/);
  assert.match(teamManagementViewSource, /function SharedTeamEquipmentPanel/);
  assert.match(teamManagementViewSource, /transferTeamEquipmentAction/);
  assert.match(teamActionsSource, /export async function createTeamEquipmentAction/);
  assert.match(teamActionsSource, /export async function transferTeamEquipmentAction/);
  assert.match(teamActionsSource, /export async function deleteTeamEquipmentAction/);
  assert.match(teamActionsSource, /\.from\("team_equipment_items"\)[\s\S]*\.delete\(\)/);
  assert.match(teamActionsSource, /team-equipment-deleted/);
  assert.match(teamManagementViewSource, /deleteTeamEquipmentAction/);
  assert.match(teamManagementViewSource, /מחיקת ציוד צוותי/);
  assert.match(teamManagementViewSource, /variant="destructive"/);
  assert.match(teamActionsSource, /from_person_id: item\.current_holder_person_id/);
});

test("settings exposes mobile-friendly quote approval for manager suggestions", () => {
  assert.match(settingsManagementViewSource, /decideDailyQuoteAction/);
  assert.match(settingsManagementViewSource, /setCurrentDailyQuoteAction/);
  assert.match(quotesActionsSource, /export async function decideDailyQuoteAction/);
  assert.match(quotesActionsSource, /export async function setCurrentDailyQuoteAction/);
  assert.match(quotesActionsSource, /getDailyQuoteIndex/);
  assert.match(quotesActionsSource, /status: "approved" \| "rejected"/);
  assert.match(quotesActionsSource, /findExistingQuote/);
  assert.match(quotesActionsSource, /המשפט הועבר לאישור מנהל/);
  assert.match(settingsManagementViewSource, /pendingQuotes/);
  assert.match(settingsManagementViewSource, /function PendingDailyQuoteApproval/);
  assert.match(settingsManagementViewSource, /ממתינים לאישור/);
  assert.match(settingsManagementViewSource, /משפטים שממתינים לאישור/);
  assert.match(settingsManagementViewSource, /אישור משפט/);
  assert.match(settingsManagementViewSource, /דחייה/);
  assert.match(settingsManagementViewSource, /הוגש ע״י/);
  assert.match(settingsManagementViewSource, /משפט היום/);
  assert.match(settingsManagementViewSource, /קבע כמשפט היום/);
});

test("settings exposes line schedule editing for managers", () => {
  assert.match(settingsPageSource, /getScheduleData/);
  assert.match(settingsPageSource, /getCurrentDailyQuote/);
  assert.match(settingsManagementViewSource, /function LineScheduleSettings/);
  assert.match(settingsManagementViewSource, /saveScheduleEventAction/);
  assert.match(settingsManagementViewSource, /deleteScheduleEventAction/);
  assert.match(settingsManagementViewSource, /לו״ז הקו/);
  assert.match(settingsManagementViewSource, /אירוע חדש בלו״ז/);
});

test("personal equipment surfaces include admins and team equipment responsibility", () => {
  assert.match(dashboardSource, /personalEquipment:/);
  assert.match(dashboardSource, /\.from\("team_equipment_items"\)/);
  assert.match(dashboardViewSource, /function PersonalEquipmentCard/);
  assert.match(equipmentPageSource, /ציוד צוותי באחריותי/);
  assert.match(leavePageSource, /function MyLeaveRequests/);
  assert.doesNotMatch(leavePageSource, /isManager\s*\?\s*Promise\.resolve\(\{ data: null/);
});

test("leave requests are single-surface for managers and approval is yes or no", () => {
  assert.match(leavePageSource, /managementLeaves/);
  assert.match(leavePageSource, /leave\.person_id !== currentPerson\.id/);
  assert.match(leavePageSource, /const statusOptions = \[\["pending", "טרם הוחלט"\], \["approved", "כן"\], \["rejected", "לא"\], \["cancelled", "בוטל"\]\]/);
  assert.match(leaveActionsSource, /const STATUSES = \["pending", "approved", "rejected", "cancelled"\]/);
  assert.match(leaveActionsSource, /const approved = status === "approved"[\s\S]*startsOn,[\s\S]*endsOn,/);
  assert.doesNotMatch(leavePageSource, /מאושר מתאריך|מאושר עד תאריך|מאושרת חלקית/);
});

test("manager leave requests can be filtered by person and highlight risky dates first", () => {
  assert.match(leavePageSource, /searchParams: Promise<\{ period\?: string; person\?: string; view\?: string; saved\?: string; deleted\?: string \}>/);
  assert.match(leavePageSource, /const selectedPersonId = query\.person && peopleById\.has\(query\.person\) \? query\.person : "all"/);
  assert.match(leavePageSource, /\.order\("starts_on", \{ ascending: true \}\)/);
  assert.match(leavePageSource, /function LeaveFilters/);
  assert.match(leavePageSource, /סינון לפי איש צוות/);
  assert.match(leavePageSource, /<option value="all">כל הבקשות<\/option>/);
  assert.match(leavePageSource, /ממויין לפי תאריך/);
  assert.doesNotMatch(leavePageSource, /function Tab/);
  assert.match(leavePageSource, /function RiskDays/);
  assert.match(leavePageSource, /ימים מסוכנים/);
  assert.match(leavePageSource, /function buildRiskDays/);
  assert.match(leavePageSource, /buildLeaveRiskDays/);
  assert.match(leavePageSource, /buildLeaveRiskDateSet/);
  assert.match(leavePageSource, /getLeaveRiskDates/);
  assert.match(leavePageSource, /function RiskyLeaveBadge/);
  assert.match(leavePageSource, /יום אדום/);
  const leaveRiskSource = readFileSync(join(__dirname, "leave-risk.ts"), "utf-8");
  assert.match(leaveRiskSource, /eachCalendarDate\(request\.startsOn, request\.endsOn\)/);
  assert.match(leaveRiskSource, /status !== "cancelled" && status !== "rejected"/);
  assert.match(leaveRiskSource, /riskyLeaveRequestThreshold = 3/);
  assert.match(leaveRiskSource, /\.filter\(\(day\) => day\.count > threshold\)/);
});

test("team shell shows the current person profile entry point and welcome state", () => {
  assert.match(teamLayoutSource, /\.from\("people"\)[\s\S]*\.select\("id, full_name, photo_url"\)/);
  assert.match(appShellSource, /InitialProfileWelcome/);
  assert.match(appShellSource, /UserProfileMenu/);
  assert.match(userProfileMenuSource, /ברוך הבא/);
  assert.match(userProfileMenuSource, /האזור האישי/);
  assert.match(userProfileMenuSource, /הבקשות שלי/);
  assert.match(userProfileMenuSource, /הציוד שלי/);
  assert.match(userProfileMenuSource, /rounded-full/);
  assert.match(userProfileMenuSource, /onSelect=\{\(\) => setOpen\(false\)\}/);
});

test("loading overlays clear after completed navigation or stale pending state", () => {
  assert.match(teamNavSource, /const effectivePendingHref = pendingHref && !isActivePath/);
  assert.match(teamNavSource, /window\.setTimeout\(\(\) => setPendingHref\(null\), 9000\)/);
  assert.match(formPendingOverlaySource, /const pendingOverlayDelayMs = 350/);
  assert.match(formPendingOverlaySource, /const maxPendingOverlayMs = 9000/);
  assert.match(formPendingOverlaySource, /function AutoExpiringPendingOverlay/);
  assert.match(formPendingOverlaySource, /return expired \|\| !visible \? null : <KavLoading/);
  for (const source of heavyRouteLoadingSources) {
    assert.match(source, /KavPageSkeleton/);
  }
});
