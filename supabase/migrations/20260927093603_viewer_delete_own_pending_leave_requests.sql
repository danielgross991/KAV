-- Allow ordinary team members to remove their own pending leave requests.
-- Approved/rejected/cancelled rows stay immutable for viewers so operational history is preserved.

drop policy if exists leave_requests_delete_self_pending on public.leave_requests;
create policy leave_requests_delete_self_pending
on public.leave_requests for delete
to authenticated
using (
  status = 'pending'
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.people p
    where p.id = leave_requests.person_id
      and p.team_id = leave_requests.team_id
      and p.auth_user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = leave_requests.team_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
  )
);
