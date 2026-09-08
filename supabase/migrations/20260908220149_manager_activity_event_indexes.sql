create index if not exists activity_events_actor_user_idx
  on public.activity_events (actor_user_id)
  where actor_user_id is not null;

create index if not exists activity_events_actor_person_idx
  on public.activity_events (actor_person_id)
  where actor_person_id is not null;
