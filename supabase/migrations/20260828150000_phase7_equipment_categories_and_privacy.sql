-- Phase 7: equipment category taxonomy + serial/model privacy.
--
-- A person may hold unlimited equipment items (multiple weapons, optics, etc.) via the
-- existing person_equipment table; this migration only adds a category so equipment types
-- can be grouped in the UI, and closes a privacy gap where any team viewer could read any
-- other person's serial numbers (person_equipment had no viewer-scoped SELECT restriction).

alter table public.equipment_types
  add column if not exists category text not null default 'OTHER';

alter table public.equipment_types
  drop constraint if exists equipment_types_category_check;

alter table public.equipment_types
  add constraint equipment_types_category_check
  check (category in ('WEAPON', 'OPTIC', 'AMRAL', 'PAKAL', 'OTHER'));

-- Managers/admins may see all team equipment. A viewer may see only their own
-- issued equipment (their own serial numbers are not sensitive to themselves).
-- This is a RESTRICTIVE policy: it is ANDed with whatever permissive team-scoped
-- SELECT policy already exists on person_equipment, so it narrows read access
-- without touching the existing insert/update/delete grants managers rely on.
create or replace function private.can_view_person_equipment(
  target_team_id uuid,
  target_person_id uuid
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
            where p.id = target_person_id
              and p.team_id = target_team_id
              and p.auth_user_id = (select auth.uid())
          )
        )
    );
$$;

revoke all on function private.can_view_person_equipment(uuid, uuid) from public, anon;
grant execute on function private.can_view_person_equipment(uuid, uuid) to authenticated;

drop policy if exists person_equipment_restrict_sensitive_select on public.person_equipment;
create policy person_equipment_restrict_sensitive_select
  on public.person_equipment
  as restrictive
  for select
  to authenticated
  using ((select private.can_view_person_equipment(team_id, person_id)));
