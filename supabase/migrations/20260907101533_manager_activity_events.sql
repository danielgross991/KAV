create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_person_id uuid references public.people(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_event_type_check check (
    event_type in (
      'auth.sign_in',
      'leave.request_created',
      'leave.request_updated',
      'leave.request_deleted',
      'equipment.assigned',
      'equipment.updated',
      'equipment.returned',
      'team_equipment.created',
      'team_equipment.updated',
      'team_equipment.transferred'
    )
  )
);

create index if not exists activity_events_team_created_idx
  on public.activity_events (team_id, created_at desc);

create index if not exists activity_events_entity_idx
  on public.activity_events (entity_type, entity_id);

alter table public.activity_events enable row level security;

grant select, insert on public.activity_events to authenticated;
grant all on public.activity_events to service_role;

drop policy if exists activity_events_select_manage on public.activity_events;
create policy activity_events_select_manage
on public.activity_events for select
to authenticated
using ((select private.can_manage_team(team_id)));

drop policy if exists activity_events_insert_team_member on public.activity_events;
create policy activity_events_insert_team_member
on public.activity_events for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = activity_events.team_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
  )
);
