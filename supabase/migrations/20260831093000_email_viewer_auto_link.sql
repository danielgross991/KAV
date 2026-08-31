create or replace function private.link_auth_identity_to_people_by_email(
  target_user_id uuid,
  target_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null or target_email is null then
    return;
  end if;

  with eligible_people as (
    select
      p.id,
      p.team_id,
      count(*) over (partition by p.team_id, lower(p.email)) as same_team_matches
    from public.people p
    where p.is_active
      and p.email is not null
      and lower(p.email) = lower(target_email)
      and (p.auth_user_id is null or p.auth_user_id = target_user_id)
  ),
  linked_people as (
    update public.people p
    set auth_user_id = target_user_id,
        updated_at = now()
    from eligible_people ep
    where ep.same_team_matches = 1
      and p.id = ep.id
      and p.team_id = ep.team_id
      and (p.auth_user_id is null or p.auth_user_id = target_user_id)
    returning p.team_id
  )
  insert into public.team_memberships (team_id, user_id, role, is_active)
  select distinct lp.team_id, target_user_id, 'viewer', true
  from linked_people lp
  on conflict (team_id, user_id) do update
    set is_active = true,
        role = case
          when public.team_memberships.role in ('admin', 'manager') then public.team_memberships.role
          else 'viewer'
        end;
end;
$$;

create or replace function private.link_auth_user_to_people_by_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform private.link_auth_identity_to_people_by_email(new.id, new.email);

  return new;
end;
$$;

create or replace function public.link_current_user_to_people_by_email()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := (select auth.jwt() ->> 'email');
begin
  if current_user_id is null or current_email is null then
    raise exception 'Authentication is required';
  end if;

  perform private.link_auth_identity_to_people_by_email(current_user_id, current_email);
end;
$$;

revoke all on function public.link_current_user_to_people_by_email() from public, anon;
grant execute on function public.link_current_user_to_people_by_email() to authenticated;

drop trigger if exists on_auth_user_email_link_people on auth.users;

create trigger on_auth_user_email_link_people
after insert or update of email on auth.users
for each row
execute function private.link_auth_user_to_people_by_email();
