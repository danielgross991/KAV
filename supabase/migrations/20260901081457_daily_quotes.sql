create table if not exists public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 2 and 220),
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected', 'archived')),
  source text not null default 'admin' check (source in ('admin', 'viewer')),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_person_id uuid references public.people(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_quotes_team_text_unique unique (team_id, text)
);

create index if not exists daily_quotes_team_status_idx
  on public.daily_quotes (team_id, status, is_active, sort_order, created_at);

create index if not exists daily_quotes_submitted_by_idx
  on public.daily_quotes (submitted_by)
  where submitted_by is not null;

alter table public.daily_quotes enable row level security;

grant select, insert, update, delete on public.daily_quotes to authenticated;
grant all on public.daily_quotes to service_role;

drop policy if exists daily_quotes_select on public.daily_quotes;
create policy daily_quotes_select
on public.daily_quotes
for select
to authenticated
using (
  (select private.can_manage_team(team_id))
  or (
    status = 'approved'
    and is_active
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = daily_quotes.team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    )
  )
  or submitted_by = (select auth.uid())
);

drop policy if exists daily_quotes_insert on public.daily_quotes;
create policy daily_quotes_insert
on public.daily_quotes
for insert
to authenticated
with check (
  (select private.can_manage_team(team_id))
  or (
    status = 'pending'
    and source = 'viewer'
    and submitted_by = (select auth.uid())
    and submitted_person_id is not null
    and approved_by is null
    and approved_at is null
    and exists (
      select 1
      from public.people p
      join public.team_memberships tm
        on tm.team_id = p.team_id
       and tm.user_id = (select auth.uid())
       and tm.is_active
      where p.id = daily_quotes.submitted_person_id
        and p.team_id = daily_quotes.team_id
        and p.auth_user_id = (select auth.uid())
    )
  )
);

drop policy if exists daily_quotes_update on public.daily_quotes;
create policy daily_quotes_update
on public.daily_quotes
for update
to authenticated
using ((select private.can_manage_team(team_id)))
with check ((select private.can_manage_team(team_id)));

drop policy if exists daily_quotes_delete on public.daily_quotes;
create policy daily_quotes_delete
on public.daily_quotes
for delete
to authenticated
using ((select private.can_manage_team(team_id)));

insert into public.daily_quotes (team_id, text, status, source, sort_order, is_active, approved_at)
select t.id, quote.text, 'approved', 'admin', quote.sort_order, true, now()
from public.teams t
cross join (
  values
    ('איפה השניצל של גרציה', 1),
    ('כשהראש דפוק הגוף סובל', 2),
    ('למה באתי מארצות הברית', 3)
) as quote(text, sort_order)
where t.slug = 'team-lidor'
on conflict (team_id, text)
do update set
  status = 'approved',
  source = 'admin',
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
