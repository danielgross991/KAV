-- Phase 7 follow-up: viewer-safe leave request markers for the monthly calendar.
--
-- Managers need the month/day schedule to distinguish pending leave requests from
-- approved operational leave. The raw leave table remains manager-only; this RPC
-- returns only marker-grade fields and intentionally excludes reason/manager notes.

create or replace function private.get_team_leave_request_markers(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  id uuid,
  person_id uuid,
  status text,
  starts_on date,
  ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.person_id, l.status, l.starts_on, l.ends_on
  from public.leave_requests l
  where l.team_id = target_team_id
    and l.reserve_period_id = target_reserve_period_id
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
        and tm.role in ('admin', 'manager')
    );
$$;

revoke all on function private.get_team_leave_request_markers(uuid, uuid) from public, anon;
grant execute on function private.get_team_leave_request_markers(uuid, uuid) to authenticated, service_role;

create or replace function public.get_team_leave_request_markers(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  id uuid,
  person_id uuid,
  status text,
  starts_on date,
  ends_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_team_leave_request_markers(target_team_id, target_reserve_period_id);
$$;

revoke all on function public.get_team_leave_request_markers(uuid, uuid) from public, anon;
grant execute on function public.get_team_leave_request_markers(uuid, uuid) to authenticated;
