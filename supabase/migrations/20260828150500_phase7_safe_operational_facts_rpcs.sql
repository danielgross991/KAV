-- Phase 7: safe, privacy-preserving reads of otherwise manager-only operational rows.
--
-- leave_requests SELECT is manager-only (20260828123000_phase4_restrict_leave_reads.sql) and
-- attendance_days/attendance_entries SELECT is manager-only in production. Both restrictions
-- are intentional (leave reasons and daily attendance detail are sensitive), but the
-- operational resolver (lib/kav/schedule-domain.ts resolveOperationalPerson) needs approved
-- leave date-ranges and per-day presence facts for EVERY team member to correctly compute
-- expectedAtBase/attendance discrepancies and aggregate stats — not just for managers.
--
-- Pattern used throughout this file (per Supabase security guidance: SECURITY DEFINER
-- functions should not live in an exposed/discoverable schema):
--   1. The actual privileged, RLS-bypassing read lives in a `private.*` function
--      (private is never exposed to PostgREST, so it cannot be called directly over the API).
--      It is SECURITY DEFINER, `set search_path = ''`, and re-validates the caller's team
--      membership explicitly (it does not rely on the caller's own row-level privileges).
--      It returns ONLY the minimal non-sensitive columns the resolver needs — never reason,
--      manager_notes, or any other private column.
--   2. A thin `public.*` wrapper with an IDENTICAL signature is what the application actually
--      calls via supabase.rpc(...). It is SECURITY INVOKER (holds no elevated privilege of its
--      own) and does nothing but forward to the private function above, which is where the
--      privileged read and the authorization check actually happen.
-- This keeps the privileged logic out of the exposed/discoverable public schema while still
-- giving the application a minimal, safe, PostgREST-callable API surface.

-- ============================================================================
-- 1. Approved leave date-ranges (no reason, no manager_notes)
-- ============================================================================

create or replace function private.get_team_approved_leave_windows(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  id uuid,
  person_id uuid,
  status text,
  starts_on date,
  ends_on date,
  approved_starts_on date,
  approved_ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.person_id, l.status, l.starts_on, l.ends_on, l.approved_starts_on, l.approved_ends_on
  from public.leave_requests l
  where l.team_id = target_team_id
    and l.reserve_period_id = target_reserve_period_id
    and l.status in ('approved', 'partially_approved')
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    );
$$;

revoke all on function private.get_team_approved_leave_windows(uuid, uuid) from public, anon;
grant execute on function private.get_team_approved_leave_windows(uuid, uuid) to authenticated, service_role;

create or replace function public.get_team_approved_leave_windows(
  target_team_id uuid,
  target_reserve_period_id uuid
)
returns table (
  id uuid,
  person_id uuid,
  status text,
  starts_on date,
  ends_on date,
  approved_starts_on date,
  approved_ends_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_team_approved_leave_windows(target_team_id, target_reserve_period_id);
$$;

revoke all on function public.get_team_approved_leave_windows(uuid, uuid) from public, anon;
grant execute on function public.get_team_approved_leave_windows(uuid, uuid) to authenticated;

-- ============================================================================
-- 2. Per-day presence facts (no notes, no source, no submitted_by)
-- ============================================================================

create or replace function private.get_team_attendance_entries(
  target_team_id uuid,
  target_reserve_period_id uuid,
  range_starts_on date,
  range_ends_on date
)
returns table (
  attendance_date date,
  person_id uuid,
  is_present boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.attendance_date, e.person_id, e.is_present
  from public.attendance_entries e
  join public.attendance_days d
    on d.id = e.attendance_day_id
   and d.team_id = e.team_id
  where e.team_id = target_team_id
    and d.reserve_period_id = target_reserve_period_id
    and d.attendance_date between range_starts_on and range_ends_on
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    );
$$;

revoke all on function private.get_team_attendance_entries(uuid, uuid, date, date) from public, anon;
grant execute on function private.get_team_attendance_entries(uuid, uuid, date, date) to authenticated, service_role;

create or replace function public.get_team_attendance_entries(
  target_team_id uuid,
  target_reserve_period_id uuid,
  range_starts_on date,
  range_ends_on date
)
returns table (
  attendance_date date,
  person_id uuid,
  is_present boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_team_attendance_entries(
    target_team_id, target_reserve_period_id, range_starts_on, range_ends_on
  );
$$;

revoke all on function public.get_team_attendance_entries(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_team_attendance_entries(uuid, uuid, date, date) to authenticated;

-- ============================================================================
-- 3. Per-day submission status (no submitted_by, no submitted_at, no id)
-- ============================================================================

create or replace function private.get_team_attendance_day_status(
  target_team_id uuid,
  target_reserve_period_id uuid,
  range_starts_on date,
  range_ends_on date
)
returns table (
  attendance_date date,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.attendance_date, d.status
  from public.attendance_days d
  where d.team_id = target_team_id
    and d.reserve_period_id = target_reserve_period_id
    and d.attendance_date between range_starts_on and range_ends_on
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = target_team_id
        and tm.user_id = (select auth.uid())
        and tm.is_active
    );
$$;

revoke all on function private.get_team_attendance_day_status(uuid, uuid, date, date) from public, anon;
grant execute on function private.get_team_attendance_day_status(uuid, uuid, date, date) to authenticated, service_role;

create or replace function public.get_team_attendance_day_status(
  target_team_id uuid,
  target_reserve_period_id uuid,
  range_starts_on date,
  range_ends_on date
)
returns table (
  attendance_date date,
  status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_team_attendance_day_status(
    target_team_id, target_reserve_period_id, range_starts_on, range_ends_on
  );
$$;

revoke all on function public.get_team_attendance_day_status(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_team_attendance_day_status(uuid, uuid, date, date) to authenticated;

-- ============================================================================
-- 4. Per-person, per-reserve-period attendance summary (already-aggregated counts
--    only — used by the person profile's "reserve history" tab, which never needs
--    per-day rows, so it gets the smallest possible surface: a present/total count).
--    Self-or-manager: a viewer may see their OWN historical attendance summary.
-- ============================================================================

create or replace function private.get_person_attendance_summary(
  target_team_id uuid,
  target_person_id uuid
)
returns table (
  reserve_period_id uuid,
  present_count integer,
  total_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.reserve_period_id,
         count(*) filter (where e.is_present)::integer as present_count,
         count(*)::integer as total_count
  from public.attendance_entries e
  join public.attendance_days d
    on d.id = e.attendance_day_id
   and d.team_id = e.team_id
  where e.team_id = target_team_id
    and e.person_id = target_person_id
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
    )
  group by d.reserve_period_id;
$$;

revoke all on function private.get_person_attendance_summary(uuid, uuid) from public, anon;
grant execute on function private.get_person_attendance_summary(uuid, uuid) to authenticated, service_role;

create or replace function public.get_person_attendance_summary(
  target_team_id uuid,
  target_person_id uuid
)
returns table (
  reserve_period_id uuid,
  present_count integer,
  total_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_person_attendance_summary(target_team_id, target_person_id);
$$;

revoke all on function public.get_person_attendance_summary(uuid, uuid) from public, anon;
grant execute on function public.get_person_attendance_summary(uuid, uuid) to authenticated;
