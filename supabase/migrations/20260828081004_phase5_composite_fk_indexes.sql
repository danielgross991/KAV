create index task_assignments_requirement_task_team_idx
  on public.task_assignments (
    task_instance_requirement_id,
    task_instance_id,
    team_id
  );

create index task_instances_publication_team_period_idx
  on public.task_instances (
    schedule_publication_id,
    team_id,
    reserve_period_id
  );
