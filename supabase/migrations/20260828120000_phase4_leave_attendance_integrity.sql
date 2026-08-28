alter table public.leave_requests
  add constraint leave_requests_approval_shape_check check (
    (status in ('pending', 'rejected') and approved_starts_on is null and approved_ends_on is null)
    or
    (status in ('approved', 'partially_approved')
      and approved_starts_on is not null
      and approved_ends_on is not null
      and approved_starts_on >= starts_on
      and approved_ends_on <= ends_on)
  );

alter table public.leave_requests
  add constraint leave_requests_no_approved_overlap
  exclude using gist (
    person_id with =,
    reserve_period_id with =,
    daterange(approved_starts_on, approved_ends_on, '[]') with &&
  ) where (status in ('approved', 'partially_approved'));

create or replace function private.enforce_phase4_period_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_start date;
  period_end date;
begin
  select starts_on, ends_on into period_start, period_end
  from public.reserve_periods
  where id = new.reserve_period_id and team_id = new.team_id;

  if period_start is null then
    raise exception 'Reserve period does not belong to team';
  end if;

  if tg_table_name = 'leave_requests' then
    if new.starts_on < period_start or new.ends_on > period_end then
      raise exception 'Leave request must remain inside reserve period';
    end if;
  elsif new.attendance_date < period_start or new.attendance_date > period_end then
    raise exception 'Attendance date must remain inside reserve period';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_phase4_period_bounds() from public;

create trigger leave_requests_enforce_period_bounds
before insert or update of team_id, reserve_period_id, starts_on, ends_on
on public.leave_requests
for each row execute function private.enforce_phase4_period_bounds();

create trigger attendance_days_enforce_period_bounds
before insert or update of team_id, reserve_period_id, attendance_date
on public.attendance_days
for each row execute function private.enforce_phase4_period_bounds();

drop policy leave_requests_select on public.leave_requests;
create policy leave_requests_select
on public.leave_requests for select
to authenticated
using (
  (select private.can_manage_team(team_id))
  or exists (
    select 1 from public.people
    where people.id = leave_requests.person_id
      and people.team_id = leave_requests.team_id
      and people.auth_user_id = (select auth.uid())
  )
);

create index attendance_days_team_date_idx
  on public.attendance_days (team_id, attendance_date);
