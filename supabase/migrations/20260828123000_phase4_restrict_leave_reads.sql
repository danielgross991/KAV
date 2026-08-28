drop policy leave_requests_select on public.leave_requests;
create policy leave_requests_select
on public.leave_requests for select
to authenticated
using ((select private.can_manage_team(team_id)));
