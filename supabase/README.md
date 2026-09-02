# Supabase

Durable storage for the one Homeroom surface that reaches the public: a member
publishing to [haus.fund/news](https://haus.fund/news).

## Why

Homeroom runs as a Netlify function against SQLite in `/tmp`. That filesystem is
ephemeral — a cold container starts from nothing, and two concurrent containers
do not share state. Fine for a forum you are still designing; not fine for
something a member expects to appear on a public page.

So the submission goes to Supabase, which is durable and shared, and Homeroom
keeps a local row as a receipt. If Supabase is unreachable the member still sees
that they tried, and a steward can retry.

## Setup

```bash
supabase login
supabase init                      # only if .supabase/ is missing
supabase link --project-ref rppcppflvitypfrkzirk
supabase db push                   # applies migrations/
```

Then set these in Netlify → Site configuration → Environment variables:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the publishable (anon) key |
| `SUPABASE_NEWS_TABLE` | optional; defaults to `news_submissions` |

`SUPABASE_SERVICE_ROLE_KEY` is **not** used by Homeroom and must not be set on
any function that renders member-facing HTML. Review and publishing happen in
the news app with that key, where nothing renders it.

Check it from the running app: `/homeroom/health` reports `supabase.reachable`.

## The security model, in one paragraph

The publishable key is safe to ship because Row Level Security decides what it
can do, and here it can do exactly two things: insert a row that is
`status = 'pending'` and `source = 'homeroom'`, and read rows that are already
published. It cannot update, cannot delete, and cannot read anybody's pending
submission — including its own author's, which is why Homeroom keeps the local
receipt. Publishing is done with the service-role key from the news app.

## Rotating the keys

Anything that has been in a chat message, a commit or a screenshot is burned.
Rotate in the dashboard under Settings → API, update the Netlify variables, and
redeploy. The database password is separate and rotates under Settings →
Database; nothing in this repository connects with it directly.
