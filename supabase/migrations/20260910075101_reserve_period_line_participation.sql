create table if not exists public.reserve_period_person_statuses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  reserve_period_id uuid not null,
  person_id uuid not null,
  is_line_active boolean not null default true,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserve_period_person_statuses_unique unique (reserve_period_id, person_id),
  constraint reserve_period_person_statuses_period_team_fk
    foreign key (reserve_period_id, team_id)
    references public.reserve_periods(id, team_id)
    on delete cascade,
  constraint reserve_period_person_statuses_person_team_fk
    foreign key (person_id, team_id)
    references public.people(id, team_id)
    on delete cascade
);

create index if not exists reserve_period_person_statuses_team_period_idx
  on public.reserve_period_person_statuses(team_id, reserve_period_id, is_line_active);

alter table public.reserve_period_person_statuses enable row level security;

grant select, insert, update, delete on public.reserve_period_person_statuses to authenticated;
grant all on public.reserve_period_person_statuses to service_role;

drop policy if exists reserve_period_person_statuses_select on public.reserve_period_person_statuses;
create policy reserve_period_person_statuses_select
on public.reserve_period_person_statuses
for select
to authenticated
using (
  exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = reserve_period_person_statuses.team_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
  )
);

drop policy if exists reserve_period_person_statuses_insert on public.reserve_period_person_statuses;
create policy reserve_period_person_statuses_insert
on public.reserve_period_person_statuses
for insert
to authenticated
with check ((select private.can_manage_team(team_id)));

drop policy if exists reserve_period_person_statuses_update on public.reserve_period_person_statuses;
create policy reserve_period_person_statuses_update
on public.reserve_period_person_statuses
for update
to authenticated
using ((select private.can_manage_team(team_id)))
with check ((select private.can_manage_team(team_id)));

drop policy if exists reserve_period_person_statuses_delete on public.reserve_period_person_statuses;
create policy reserve_period_person_statuses_delete
on public.reserve_period_person_statuses
for delete
to authenticated
using ((select private.can_manage_team(team_id)));
