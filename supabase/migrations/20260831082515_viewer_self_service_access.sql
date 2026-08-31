-- Viewer self-service: own leave requests and team calendar leave markers.
--
-- Raw leave details remain constrained: managers can manage all requests, while viewers
-- can only read and create their own pending requests. Calendar markers stay minimal
-- and exclude reasons / manager notes.

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select
on public.leave_requests for select
to authenticated
using (
  (select private.can_manage_team(team_id))
  or exists (
    select 1
    from public.people p
    where p.id = leave_requests.person_id
      and p.team_id = leave_requests.team_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists leave_requests_insert_self on public.leave_requests;
create policy leave_requests_insert_self
on public.leave_requests for insert
to authenticated
with check (
  status = 'pending'
  and approved_starts_on is null
  and approved_ends_on is null
  and manager_notes is null
  and decided_by is null
  and decided_at is null
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = leave_requests.team_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
  )
  and exists (
    select 1
    from public.people p
    where p.id = leave_requests.person_id
      and p.team_id = leave_requests.team_id
      and p.auth_user_id = (select auth.uid())
  )
);

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
