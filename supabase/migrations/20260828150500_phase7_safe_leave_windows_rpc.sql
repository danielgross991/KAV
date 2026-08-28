-- Phase 7: safe, privacy-preserving read of approved leave date ranges.
--
-- leave_requests SELECT is manager-only (20260828123000_phase4_restrict_leave_reads.sql),
-- because leave reasons/manager notes are sensitive. But the operational resolver
-- (lib/kav/schedule-domain.ts resolveOperationalPerson) needs approved leave *date ranges*
-- to correctly compute expectedAtBase/attendance discrepancies and home-day statistics for
-- every team member, not just managers. This RPC returns only the non-sensitive columns the
-- resolver needs (id, person, status, approved range) and is readable by any active team
-- member, so viewers get correct personal/aggregate stats without ever reading reasons.
create or replace function public.get_team_approved_leave_windows(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  id uuid,
  person_id uuid,
  status text,
  starts_on date,
  ends_on date,
  approved_starts_on date,
  approved_ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.person_id, l.status, l.starts_on, l.ends_on, l.approved_starts_on, l.approved_ends_on
  from public.leave_requests l
  where l.team_id = target_team_id
    and l.reserve_period_id = target_reserve_period_id
    and l.status in ('approved', 'partially_approved')
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    );
$$;

revoke all on function public.get_team_approved_leave_windows(uuid, uuid) from public, anon;
grant execute on function public.get_team_approved_leave_windows(uuid, uuid) to authenticated;
