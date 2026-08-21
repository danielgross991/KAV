# Phase 3 schema design

The live scheduling tables already model reserve periods, phases, rotation groups,
memberships, generated blocks, person overrides, and events. Phase 3 keeps those
tables and makes the following minimal additions:

- Add `published` to the single `reserve_periods.status` lifecycle constraint.
- Add `rotation_groups.initial_state` (`base` or `home`).
- Add `rotation_generation_configs`, one row per reserve period, containing the
  anchor date and configurable base/home durations.
- Add exclusion constraints preventing overlapping active periods for a team,
  overlapping blocks for a group, and overlapping overrides for a person in one
  period.
- Add `private.can_view_schedule_period(team_id, reserve_period_id)` and replace
  schedule SELECT policies so managers can read every lifecycle state while
  viewers can only read `published`, `active`, and `completed` periods and their
  child records.
- Add `public.replace_generated_rotation_blocks(...)` as a `SECURITY INVOKER`
  transaction boundary. It checks manager access explicitly and atomically
  upserts generator configuration, removes only generated blocks, and inserts
  the confirmed preview. Manual blocks are never deleted by this function.
- Add `public.replace_rotation_series_from(...)` with the same invoker/RLS
  model for atomic "this block and all following" edits.

`rotation_members` remains attached to a reserve period through its rotation
group. Preventing overlapping memberships across different groups in the same
period would require denormalizing the period id or a trigger. Phase 3 keeps the
schema normalized and enforces this invariant in manager server actions and the
publication validator.

All new public data is protected by RLS. The private authorization helper checks
`auth.uid()`, fixes its `search_path`, revokes `PUBLIC` execute, and grants only
the authenticated role.

## Follow-up integrity migration

`20260821150000_harden_rotation_override_integrity.sql` adds a unique key on
`rotation_groups (id, reserve_period_id, team_id)` and composite foreign keys
from both override group columns. This prevents a same-team group from another
reserve period being used without denormalizing any table. A private trigger
also rejects override date ranges outside the referenced reserve period. The
existing person/team and period/team foreign keys continue to enforce team
ownership.
