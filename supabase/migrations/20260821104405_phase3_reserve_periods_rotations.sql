create extension if not exists btree_gist with schema extensions;

alter table public.reserve_periods
  drop constraint reserve_periods_status_check,
  add constraint reserve_periods_status_check
    check (status = any (array['draft', 'published', 'active', 'completed', 'archived']));

alter table public.reserve_periods
  add constraint reserve_periods_one_active_per_team
  exclude using gist (
    team_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (status = 'active');

alter table public.rotation_groups
  add column initial_state text not null default 'base',
  add constraint rotation_groups_initial_state_check
    check (initial_state = any (array['base', 'home']));

create table public.rotation_generation_configs (
  reserve_period_id uuid primary key,
  team_id uuid not null,
  anchor_date date not null,
  base_days integer not null check (base_days > 0 and base_days <= 90),
  home_days integer not null check (home_days > 0 and home_days <= 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rotation_generation_configs_period_team_fkey
    foreign key (reserve_period_id, team_id)
    references public.reserve_periods (id, team_id)
    on delete cascade
);

create index rotation_generation_configs_period_team_idx
  on public.rotation_generation_configs (reserve_period_id, team_id);

alter table public.rotation_blocks
  add constraint rotation_blocks_no_overlap
  exclude using gist (
    rotation_group_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  );

alter table public.rotation_overrides
  add constraint rotation_overrides_no_overlap
  exclude using gist (
    reserve_period_id with =,
    person_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  );

alter table public.rotation_generation_configs enable row level security;

grant select, insert, update, delete on public.rotation_generation_configs to authenticated;
grant all on public.rotation_generation_configs to service_role;

create or replace function private.can_view_schedule_period(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.reserve_periods as period
      join public.team_memberships as membership
        on membership.team_id = period.team_id
      where period.id = target_reserve_period_id
        and period.team_id = target_team_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and (
          membership.role in ('admin', 'manager')
          or period.status in ('published', 'active', 'completed')
        )
    );
$$;

revoke all on function private.can_view_schedule_period(uuid, uuid) from public;
revoke all on function private.can_view_schedule_period(uuid, uuid) from anon;
grant execute on function private.can_view_schedule_period(uuid, uuid) to authenticated;
grant execute on function private.can_view_schedule_period(uuid, uuid) to service_role;

drop policy reserve_periods_select on public.reserve_periods;
create policy reserve_periods_select
on public.reserve_periods for select
to authenticated
using ((select private.can_view_schedule_period(team_id, id)));

drop policy period_phases_select on public.period_phases;
create policy period_phases_select
on public.period_phases for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

drop policy rotation_groups_select on public.rotation_groups;
create policy rotation_groups_select
on public.rotation_groups for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

drop policy rotation_members_select on public.rotation_members;
create policy rotation_members_select
on public.rotation_members for select
to authenticated
using (
  exists (
    select 1
    from public.rotation_groups as rotation_group
    where rotation_group.id = rotation_members.rotation_group_id
      and rotation_group.team_id = rotation_members.team_id
      and (select private.can_view_schedule_period(
        rotation_members.team_id,
        rotation_group.reserve_period_id
      ))
  )
);

drop policy rotation_blocks_select on public.rotation_blocks;
create policy rotation_blocks_select
on public.rotation_blocks for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

drop policy rotation_overrides_select on public.rotation_overrides;
create policy rotation_overrides_select
on public.rotation_overrides for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

drop policy schedule_events_select on public.schedule_events;
create policy schedule_events_select
on public.schedule_events for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

create policy rotation_generation_configs_select
on public.rotation_generation_configs for select
to authenticated
using ((select private.can_view_schedule_period(team_id, reserve_period_id)));

create policy rotation_generation_configs_insert
on public.rotation_generation_configs for insert
to authenticated
with check ((select private.can_manage_team(team_id)));

create policy rotation_generation_configs_update
on public.rotation_generation_configs for update
to authenticated
using ((select private.can_manage_team(team_id)))
with check ((select private.can_manage_team(team_id)));

create policy rotation_generation_configs_delete
on public.rotation_generation_configs for delete
to authenticated
using ((select private.can_manage_team(team_id)));

create or replace function public.replace_generated_rotation_blocks(
  target_team_id uuid,
  target_reserve_period_id uuid,
  generator_config jsonb,
  generated_blocks jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_manage_team(target_team_id)) then
    raise exception 'Not authorized to manage this team';
  end if;

  if not exists (
    select 1 from public.reserve_periods
    where id = target_reserve_period_id and team_id = target_team_id
  ) then
    raise exception 'Reserve period not found';
  end if;

  insert into public.rotation_generation_configs (
    reserve_period_id, team_id, anchor_date, base_days, home_days, updated_at
  ) values (
    target_reserve_period_id,
    target_team_id,
    (generator_config ->> 'anchor_date')::date,
    (generator_config ->> 'base_days')::integer,
    (generator_config ->> 'home_days')::integer,
    now()
  )
  on conflict (reserve_period_id) do update set
    anchor_date = excluded.anchor_date,
    base_days = excluded.base_days,
    home_days = excluded.home_days,
    updated_at = now();

  delete from public.rotation_blocks
  where team_id = target_team_id
    and reserve_period_id = target_reserve_period_id
    and source = 'generated';

  insert into public.rotation_blocks (
    team_id, reserve_period_id, rotation_group_id, state,
    starts_on, ends_on, source, series_key, sequence_no
  )
  select
    target_team_id,
    target_reserve_period_id,
    block.rotation_group_id,
    block.state,
    block.starts_on,
    block.ends_on,
    'generated',
    block.series_key,
    block.sequence_no
  from jsonb_to_recordset(generated_blocks) as block(
    rotation_group_id uuid,
    state text,
    starts_on date,
    ends_on date,
    series_key uuid,
    sequence_no integer
  );
end;
$$;

revoke all on function public.replace_generated_rotation_blocks(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.replace_generated_rotation_blocks(uuid, uuid, jsonb, jsonb) from anon;
grant execute on function public.replace_generated_rotation_blocks(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.replace_generated_rotation_blocks(uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.replace_rotation_series_from(
  target_team_id uuid,
  target_reserve_period_id uuid,
  target_rotation_group_id uuid,
  replace_from date,
  replacement_blocks jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_manage_team(target_team_id)) then
    raise exception 'Not authorized to manage this team';
  end if;

  if not exists (
    select 1 from public.rotation_groups
    where id = target_rotation_group_id
      and team_id = target_team_id
      and reserve_period_id = target_reserve_period_id
  ) then
    raise exception 'Rotation group not found';
  end if;

  delete from public.rotation_blocks
  where team_id = target_team_id
    and reserve_period_id = target_reserve_period_id
    and rotation_group_id = target_rotation_group_id
    and starts_on >= replace_from;

  insert into public.rotation_blocks (
    team_id, reserve_period_id, rotation_group_id, state,
    starts_on, ends_on, source, series_key, sequence_no
  )
  select target_team_id, target_reserve_period_id, target_rotation_group_id,
    block.state, block.starts_on, block.ends_on, 'manual',
    block.series_key, block.sequence_no
  from jsonb_to_recordset(replacement_blocks) as block(
    state text,
    starts_on date,
    ends_on date,
    series_key uuid,
    sequence_no integer
  );
end;
$$;

revoke all on function public.replace_rotation_series_from(uuid, uuid, uuid, date, jsonb) from public;
revoke all on function public.replace_rotation_series_from(uuid, uuid, uuid, date, jsonb) from anon;
grant execute on function public.replace_rotation_series_from(uuid, uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.replace_rotation_series_from(uuid, uuid, uuid, date, jsonb) to service_role;
