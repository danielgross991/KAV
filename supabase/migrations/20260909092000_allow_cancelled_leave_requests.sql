alter table public.leave_requests
  drop constraint if exists leave_requests_approval_shape_check;

alter table public.leave_requests
  add constraint leave_requests_approval_shape_check check (
    (status in ('pending', 'rejected', 'cancelled') and approved_starts_on is null and approved_ends_on is null)
    or
    (status in ('approved', 'partially_approved')
      and approved_starts_on is not null
      and approved_ends_on is not null
      and approved_starts_on >= starts_on
      and approved_ends_on <= ends_on)
  );
