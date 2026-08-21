# KAV authentication and admin password bootstrap

KAV is closed-access. Supabase Auth establishes identity; `team_memberships`
continues to grant team access and roles. The application has no public signup.

## Supabase Dashboard configuration

In **Authentication -> Providers -> Email**, keep password-based Email Auth
enabled and configure a reasonable minimum password length supported by the
current plan (KAV also enforces at least 8 characters in its update form).

In **Authentication -> URL Configuration**, keep the canonical production URL
as the Site URL. Allow these recovery paths and their local equivalents:

```text
https://kav-teal.vercel.app/auth/confirm
https://kav-teal.vercel.app/account/update-password
http://localhost:3000/auth/confirm
http://localhost:3000/account/update-password
http://127.0.0.1:3000/auth/confirm
http://127.0.0.1:3000/account/update-password
```

In **Authentication -> Email Templates -> Reset Password**, use this exact PKCE
token-hash link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password">
  איפוס סיסמה
</a>
```

On newer Free-plan projects, Supabase's default SMTP may not permit customized
templates. Configure custom SMTP if the Dashboard blocks the template change.
Leaked-password protection is a paid-plan feature and is not a development
blocker.

## One-time existing-admin password bootstrap

Never edit `auth.users.encrypted_password` directly. The local-only script
updates an existing user through the Supabase Admin Auth API and never creates a
new identity.

Set these values temporarily in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<server-only-secret-key>
KAV_BOOTSTRAP_EMAIL=<existing-admin-email>
KAV_BOOTSTRAP_PASSWORD=<new-password-at-least-8-characters>
```

Run from a shell that loads `.env.local` into the process environment:

```bash
node --env-file=.env.local scripts/set-auth-password.mjs
```

The successful script prints only the email/user ID summary and:

```text
User password configured successfully.
```

Immediately remove `SUPABASE_SECRET_KEY` and `KAV_BOOTSTRAP_PASSWORD` from
`.env.local`. The deployed KAV application requires only the public Supabase URL
and publishable key; never configure the secret key in Vercel for this flow.
