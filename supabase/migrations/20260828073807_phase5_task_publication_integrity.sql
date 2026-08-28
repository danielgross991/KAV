-- Phase 5 uses schedule_publications as the only publication authority.
alter table public.schedule_publications
  add constraint schedule_publications_id_team_period_key
  unique (id, team_id, reserve_period_id);

alter table public.task_instances
  add column schedule_publication_id uuid;

alter table public.task_instances
  add constraint task_instances_publication_team_period_fkey
  foreign key (schedule_publication_id, team_id, reserve_period_id)
  references public.schedule_publications (id, team_id, reserve_period_id)
  on delete cascade;

-- The foundation tables are empty, so every future task can require an explicit
-- weekly publication scope without a data backfill.
alter table public.task_instances
  alter column schedule_publication_id set not null;

create index task_instances_publication_time_idx
  on public.task_instances (schedule_publication_id, starts_at, ends_at);

-- A requirement linked by an assignment must belong to that same task, not only
-- to another task in the same team.
alter table public.task_instance_requirements
  add constraint task_instance_requirements_id_task_team_key
  unique (id, task_instance_id, team_id);

alter table public.task_assignments
  drop constraint task_assignments_task_instance_requirement_id_team_id_fkey;

alter table public.task_assignments
  add constraint task_assignments_requirement_task_team_fkey
  foreign key (task_instance_requirement_id, task_instance_id, team_id)
  references public.task_instance_requirements (id, task_instance_id, team_id)
  on delete cascade;

alter table public.task_assignments
  add column availability_override boolean not null default false;

alter table public.task_template_requirements
  add constraint task_template_requirements_role_label_check
  check (length(btrim(role_label)) > 0);

alter table public.task_instance_requirements
  add constraint task_instance_requirements_role_label_check
  check (length(btrim(role_label)) > 0);

alter table public.task_assignments
  add constraint task_assignments_assignment_role_check
  check (length(btrim(assignment_role)) > 0);

-- Managers can see every task. Viewers can see a published task only when they
-- are personally assigned; assignment RLS then intentionally exposes teammates
-- on that same task.
create or replace function private.can_view_task(
  target_task_id uuid,
  target_team_id uuid
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
            from public.task_instances ti
            join public.schedule_publications sp
              on sp.id = ti.schedule_publication_id
             and sp.team_id = ti.team_id
             and sp.reserve_period_id = ti.reserve_period_id
            join public.task_assignments ta
              on ta.task_instance_id = ti.id
             and ta.team_id = ti.team_id
             and ta.status = 'assigned'
            join public.people p
              on p.id = ta.person_id
             and p.team_id = ta.team_id
            where ti.id = target_task_id
              and ti.team_id = target_team_id
              and sp.status = 'published'
              and p.auth_user_id = (select auth.uid())
          )
        )
    );
$$;

revoke all on function private.can_view_task(uuid, uuid) from public, anon;
grant execute on function private.can_view_task(uuid, uuid) to authenticated;

drop policy task_instances_select on public.task_instances;
create policy task_instances_select
  on public.task_instances
  for select
  to authenticated
  using ((select private.can_view_task(id, team_id)));

-- Task templates are planning data and are not needed by viewers.
drop policy task_templates_select on public.task_templates;
create policy task_templates_select
  on public.task_templates
  for select
  to authenticated
  using ((select private.can_manage_team(team_id)));

drop policy task_template_requirements_select
  on public.task_template_requirements;
create policy task_template_requirements_select
  on public.task_template_requirements
  for select
  to authenticated
  using ((select private.can_manage_team(team_id)));

-- Remove the competing row-level publication state after all policies and
-- helper functions have moved to the weekly publication authority.
alter table public.task_instances
  drop column publication_status,
  drop column published_by,
  drop column published_at;
