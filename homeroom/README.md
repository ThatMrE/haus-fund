# Homeroom

The members-only side of Haus, served at `/homeroom`. A forum, a member
directory, a lab directory, deals, funder reviews, a fundraising pipeline,
office hours, jobs, events, a library, intro requests and messaging.

It is a reskin of Bookface — Y Combinator's internal network — for Haus. Same
idea: the value comes from the room being closed, because people will say what
a thing actually cost, and which funder wasted three months of their life, only
when they know who is listening.

## How it is built

Static HTML and ES modules, like the rest of this repo. No build step and no
framework. The database, authentication and every access rule live in Supabase.

```
homeroom/
├── index.html · forum.html · post.html · ask.html         the forum
├── people.html · profile.html · settings.html            the directory
├── labs.html · lab.html                                  labs and their updates
├── deals.html · deal.html                                vendor deals
├── funders.html · funder.html · pipeline.html            funder reviews and the raise
├── hours.html · jobs.html · events.html                  sessions, roles, calendar
├── library.html · entry.html                             written-down answers
├── intros.html · messages.html · notifications.html      the connective tissue
├── saved.html · search.html · about.html
├── login.html · signup.html · forgot.html · reset.html   the four pre-login pages
├── homeroom.css                                          Haus tokens, one stylesheet
├── app/
│   ├── config.js     the Supabase URL and anon key
│   ├── client.js     the client, the session, the members-only gate
│   ├── ui.js         escaping, formatting, chrome, shared parts
│   ├── api.js        every query, in one place
│   └── pages/*.js    one module per page
└── supabase/
    ├── schema.sql    tables, row-level security, functions, triggers
    ├── test.sql      the access rules, exercised as three different members
    ├── local-stub.sql  stand-ins for what Supabase provides
    └── run-tests.sh  runs both against a scratch Postgres
```

Each page is a thin shell that loads `homeroom.css` and one module. The public
site embeds its CSS per page; an application has too many shared surfaces for
that, so Homeroom keeps one stylesheet built on the tokens in `/tokens`.

## Setting it up

1. **Create a Supabase project.** Any region; the free tier is enough to start.

2. **Run the schema.** Paste `supabase/schema.sql` into the SQL editor and run
   it. It is idempotent, so re-running it after a change is safe.

3. **Point the site at the project.** Copy the project URL and the *anon* key
   from Project Settings → API into `app/config.js`, then commit.

   The anon key belongs in the repo: it identifies the project and grants
   nothing on its own. The **service_role key must never go in this repo** —
   it bypasses row-level security completely.

4. **Set the auth URLs.** In Authentication → URL Configuration:
   - Site URL: `https://haus.fund`
   - Redirect URLs: `https://haus.fund/homeroom/*` and, for local work,
     `http://localhost:8888/homeroom/*`

5. **Turn on email confirmation** (Authentication → Providers → Email). Signup
   already handles the confirm-then-choose-a-handle flow.

6. **Make yourself a steward** once you have signed up:

   ```sql
   update hr_members set is_steward = true where handle = 'your-handle';
   ```

Until step 3 is done, every Homeroom page says so rather than failing quietly.

## The rules, and where they live

The browser is untrusted — the anon key ships inside the page — so nothing that
matters is enforced in JavaScript. Three mechanisms do the work:

| Mechanism | What it protects |
|---|---|
| Row-level security | Which rows a member may read. Logged out returns nothing at all; pipeline notes return only to their owner; a message thread returns only to its members. |
| Column privileges | Which columns are sent. The author of an anonymous post is not withheld by the UI — `author_id` is revoked, and `shown_author` is a generated column that is null whenever the post is anonymous. Deal codes work the same way. |
| `SECURITY DEFINER` functions | Anything that spans rows: voting (not your own, once only, karma follows), accepting an answer (only the asker), booking (capacity), intros (opens a thread), slugs, and making a lab's creator its first admin. |

`supabase/test.sql` exercises all of it as three different signed-in members.
Run it before touching `schema.sql`:

```bash
./supabase/run-tests.sh              # spins up a scratch Postgres
PGURL=postgres://... ./supabase/run-tests.sh   # or use one you have
```

It proves, among other things, that a member cannot read `author_id`, upvote
themselves, accept an answer on someone else's question, read a deal code they
have not claimed, see another member's pipeline, book a full session, resolve
someone else's intro, or promote themselves to admin of a lab they joined.

## Working on it locally

```bash
python3 -m http.server 8888     # from the repo root
open http://localhost:8888/homeroom/
```

There is nothing to build. Add `http://localhost:8888/homeroom/*` to the
Supabase redirect URLs so the email links come back to the right place.

## Deploying

Same as the rest of the site: push to `main` and Netlify publishes. Two things
are wired up for `/homeroom`:

- `netlify.toml` sends `X-Robots-Tag: noindex` and `Cache-Control: no-store`
  for everything under `/homeroom/*`.
- `_redirects` 404s this README and the SQL files. `publish = "."` serves every
  committed file otherwise. **Adding a new `.md` or `.sql` here? Add a line to
  `_redirects` too, or it goes live.**
