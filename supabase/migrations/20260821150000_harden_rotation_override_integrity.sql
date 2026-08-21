alter table public.rotation_groups
  add constraint rotation_groups_id_reserve_period_id_team_id_key
  unique (id, reserve_period_id, team_id);

alter table public.rotation_overrides
  add constraint rotation_overrides_from_group_period_team_fkey
    foreign key (from_rotation_group_id, reserve_period_id, team_id)
    references public.rotation_groups (id, reserve_period_id, team_id),
  add constraint rotation_overrides_to_group_period_team_fkey
    foreign key (to_rotation_group_id, reserve_period_id, team_id)
    references public.rotation_groups (id, reserve_period_id, team_id);

create index rotation_overrides_from_group_period_team_idx
  on public.rotation_overrides (from_rotation_group_id, reserve_period_id, team_id);

create index rotation_overrides_to_group_period_team_idx
  on public.rotation_overrides (to_rotation_group_id, reserve_period_id, team_id);

create or replace function private.enforce_rotation_override_period_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_starts_on date;
  period_ends_on date;
begin
  select period.starts_on, period.ends_on
    into period_starts_on, period_ends_on
  from public.reserve_periods as period
  where period.id = new.reserve_period_id
    and period.team_id = new.team_id;

  if not found then
    raise foreign_key_violation using message = 'Reserve period does not belong to the override team';
  end if;

  if new.starts_on < period_starts_on or new.ends_on > period_ends_on then
    raise check_violation using message = 'Rotation override dates must stay inside the reserve period';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_rotation_override_period_bounds() from public;

create trigger rotation_overrides_enforce_period_bounds
before insert or update of team_id, reserve_period_id, starts_on, ends_on
on public.rotation_overrides
for each row execute function private.enforce_rotation_override_period_bounds();
