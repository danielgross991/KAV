alter table public.leave_requests
  drop constraint if exists leave_requests_status_check;

alter table public.leave_requests
  add constraint leave_requests_status_check
    check (status = any (array['pending', 'approved', 'partially_approved', 'rejected', 'cancelled']));
