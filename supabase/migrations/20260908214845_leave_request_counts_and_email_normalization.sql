update public.people
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));

alter table public.people
  drop constraint if exists people_email_lowercase_check,
  add constraint people_email_lowercase_check
    check (email is null or email = lower(trim(email)));

create or replace function private.get_team_leave_request_counts(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  person_id uuid,
  request_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.person_id, count(*)::bigint as request_count
  from public.leave_requests l
  where l.team_id = target_team_id
    and l.reserve_period_id = target_reserve_period_id
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    )
  group by l.person_id;
$$;

revoke all on function private.get_team_leave_request_counts(uuid, uuid) from public, anon;
grant execute on function private.get_team_leave_request_counts(uuid, uuid) to authenticated, service_role;

create or replace function public.get_team_leave_request_counts(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  person_id uuid,
  request_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_team_leave_request_counts(target_team_id, target_reserve_period_id);
$$;

revoke all on function public.get_team_leave_request_counts(uuid, uuid) from public, anon;
grant execute on function public.get_team_leave_request_counts(uuid, uuid) to authenticated;
