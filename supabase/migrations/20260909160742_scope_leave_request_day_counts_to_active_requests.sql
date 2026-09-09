create or replace function private.get_team_leave_request_day_counts(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  person_id uuid,
  request_days bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.person_id,
    sum((l.ends_on - l.starts_on) + 1)::bigint as request_days
  from public.leave_requests l
  where l.team_id = target_team_id
    and l.reserve_period_id = target_reserve_period_id
    and l.status not in ('cancelled', 'rejected')
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = l.team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    )
    and exists (
      select 1
      from public.people p
      where p.id = l.person_id
        and p.team_id = l.team_id
        and p.is_active
    )
  group by l.person_id
  having sum((l.ends_on - l.starts_on) + 1) > 0;
$$;
