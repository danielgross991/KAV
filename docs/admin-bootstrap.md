# KAV Admin Bootstrap

KAV is a closed-access application. Logging in is separate from being part of a
team, and being a person in the Team Lidor roster is separate from having login
access.

## Identity Model

```text
auth.users
  -> profiles
  -> team_memberships
  -> Team access and role

people
  -> optional auth_user_id
  -> Physical team member / roster record
```

Concepts:

- `auth.users`: Supabase Auth identity. This is what can receive a Magic Link and create a session.
- `profiles`: app profile metadata for an auth user.
- `team_memberships`: authorization boundary for KAV team access and role (`admin`, `manager`, `viewer`).
- `people`: Team roster/personnel records. A person record does not automatically grant login access.
- `people.auth_user_id`: optional link from a roster person to an auth user.

## Closed Login Policy

Supabase `signInWithOtp` creates a new auth user by default when the email does
not already exist. KAV disables this by default by sending:

```ts
options: {
  shouldCreateUser: false
}
```

For the first bootstrap only, the server action supports:

```env
KAV_AUTH_ALLOW_USER_CREATION=true
KAV_BOOTSTRAP_EMAIL=first.admin@example.com
```

If `KAV_BOOTSTRAP_EMAIL` is set, only that email may be auto-created while
bootstrap user creation is enabled. Do not set these variables in production
after the first admin exists.

## First Admin Procedure

1. Temporarily enable bootstrap user creation in local development:

```env
KAV_AUTH_ALLOW_USER_CREATION=true
KAV_BOOTSTRAP_EMAIL=<first-admin-email>
```

2. Start the app locally and request a Magic Link from `/login` using the same email.
3. Click the Magic Link to create and sign in the auth user.
4. Resolve the auth user ID:

```sql
select id, email
from auth.users
where lower(email) = lower('<first-admin-email>');
```

5. Add the Team Lidor admin membership:

```sql
insert into public.team_memberships (team_id, user_id, role, is_active)
select t.id, u.id, 'admin', true
from public.teams t
cross join auth.users u
where t.slug = 'team-lidor'
  and lower(u.email) = lower('<first-admin-email>')
on conflict do nothing;
```

6. Disable bootstrap user creation:

```env
KAV_AUTH_ALLOW_USER_CREATION=false
KAV_BOOTSTRAP_EMAIL=
```

7. Log out and log in again. The user should enter Team Lidor as `admin`.

## Supabase Auth URL Configuration

Configure Supabase Auth -> URL Configuration:

Site URL:

```text
https://<vercel-production-domain>
```

Additional Redirect URLs:

```text
http://127.0.0.1:3000/auth/confirm
http://localhost:3000/auth/confirm
https://<vercel-production-domain>/auth/confirm
https://*.vercel.app/auth/confirm
```

The app builds the Magic Link callback from the request host and always uses
`/auth/confirm`. It sanitizes the `next` parameter to local paths only, so Magic
Links cannot redirect to arbitrary external URLs.

## Vercel Environment Variables

Only these Supabase variables are needed for the deployed application:

```env
NEXT_PUBLIC_SUPABASE_URL=https://scqytssoghswrvzotutl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Do not configure a Supabase service-role key for this phase.
