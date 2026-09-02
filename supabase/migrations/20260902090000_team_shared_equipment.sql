-- Team shared equipment: team-owned items with permanent signer and current holder.
--
-- Personal equipment remains in person_equipment. These tables model equipment that
-- belongs to the team and can move between people during rotations, while preserving
-- who is formally signed for it and a transfer history.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_id_team_unique'
  ) then
    alter table public.people
      add constraint people_id_team_unique unique (id, team_id);
  end if;
end $$;

create table if not exists public.team_equipment_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  category text not null default 'OTHER' check (category in ('WEAPON', 'OPTIC', 'AMRAL', 'PAKAL', 'OTHER')),
  model text,
  serial_number text,
  permanent_owner_person_id uuid,
  current_holder_person_id uuid,
  status text not null default 'in_use' check (status in ('available', 'in_use', 'damaged', 'lost', 'retired')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  constraint team_equipment_items_permanent_owner_team_fk
    foreign key (permanent_owner_person_id, team_id)
    references public.people(id, team_id)
    on delete set null,
  constraint team_equipment_items_current_holder_team_fk
    foreign key (current_holder_person_id, team_id)
    references public.people(id, team_id)
    on delete set null
);

create index if not exists team_equipment_items_team_idx
  on public.team_equipment_items(team_id, status, name);

create index if not exists team_equipment_items_current_holder_idx
  on public.team_equipment_items(team_id, current_holder_person_id)
  where current_holder_person_id is not null;

create index if not exists team_equipment_items_permanent_owner_idx
  on public.team_equipment_items(team_id, permanent_owner_person_id)
  where permanent_owner_person_id is not null;

create table if not exists public.team_equipment_transfers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_equipment_item_id uuid not null,
  from_person_id uuid,
  to_person_id uuid,
  transferred_by uuid references auth.users(id) on delete set null,
  transfer_note text,
  transferred_at timestamptz not null default now(),
  constraint team_equipment_transfers_item_team_fk
    foreign key (team_equipment_item_id, team_id)
    references public.team_equipment_items(id, team_id)
    on delete cascade,
  constraint team_equipment_transfers_from_person_team_fk
    foreign key (from_person_id, team_id)
    references public.people(id, team_id)
    on delete set null,
  constraint team_equipment_transfers_to_person_team_fk
    foreign key (to_person_id, team_id)
    references public.people(id, team_id)
    on delete set null
);

create index if not exists team_equipment_transfers_item_idx
  on public.team_equipment_transfers(team_id, team_equipment_item_id, transferred_at desc);

alter table public.team_equipment_items enable row level security;
alter table public.team_equipment_transfers enable row level security;

create or replace function private.can_view_team_equipment_item(
  target_team_id uuid,
  target_permanent_owner_person_id uuid,
  target_current_holder_person_id uuid
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
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
        and (
          tm.role in ('admin', 'manager')
          or exists (
            select 1
            from public.people p
            where p.team_id = target_team_id
              and p.auth_user_id = (select auth.uid())
              and p.id in (target_permanent_owner_person_id, target_current_holder_person_id)
          )
        )
    );
$$;

revoke all on function private.can_view_team_equipment_item(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_view_team_equipment_item(uuid, uuid, uuid) to authenticated;

drop policy if exists team_equipment_items_select on public.team_equipment_items;
create policy team_equipment_items_select
on public.team_equipment_items for select
to authenticated
using ((select private.can_view_team_equipment_item(team_id, permanent_owner_person_id, current_holder_person_id)));

drop policy if exists team_equipment_items_insert on public.team_equipment_items;
create policy team_equipment_items_insert
on public.team_equipment_items for insert
to authenticated
with check ((select private.can_manage_team(team_id)));

drop policy if exists team_equipment_items_update on public.team_equipment_items;
create policy team_equipment_items_update
on public.team_equipment_items for update
to authenticated
using ((select private.can_manage_team(team_id)))
with check ((select private.can_manage_team(team_id)));

drop policy if exists team_equipment_items_delete on public.team_equipment_items;
create policy team_equipment_items_delete
on public.team_equipment_items for delete
to authenticated
using ((select private.can_manage_team(team_id)));

drop policy if exists team_equipment_transfers_select on public.team_equipment_transfers;
create policy team_equipment_transfers_select
on public.team_equipment_transfers for select
to authenticated
using ((select private.can_manage_team(team_id)));

drop policy if exists team_equipment_transfers_insert on public.team_equipment_transfers;
create policy team_equipment_transfers_insert
on public.team_equipment_transfers for insert
to authenticated
with check ((select private.can_manage_team(team_id)));

grant select, insert, update, delete on public.team_equipment_items to authenticated;
grant select, insert on public.team_equipment_transfers to authenticated;
grant all on public.team_equipment_items to service_role;
grant all on public.team_equipment_transfers to service_role;
