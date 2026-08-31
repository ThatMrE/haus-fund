# haus.fund/homeroom

The members-only side of Haus. A forum, a member directory, a lab directory,
deals, funder reviews, a fundraising pipeline, office hours, jobs, events, a
library, intro requests and messaging — served at `/homeroom` on the main site,
so it shares the domain, the design system and the sign-in.

It is a reskin of Bookface, Y Combinator's internal network. The idea it copies
is that the value comes from the room being closed: people say what a thing
actually cost, and which funder wasted three months of their life, only when
they know who is listening.

Zero npm dependencies, and no external service: `node:sqlite` for storage,
`node:http` for the server, `node:crypto` scrypt for passwords, tagged template
literals for views. Same shape as the sibling `news` function.

```bash
cd netlify/functions/homeroom
npm run seed          # the sample network, so there is something to look at
npm start             # http://localhost:8788/homeroom
npm test              # 38 tests, no network
```

Sample logins after seeding: any handle in the directory, password
`homeroom-sample-pass` — for example `ferment_or_die` / `homeroom-sample-pass`.
All of it is fictional.

## Layout

```
netlify/functions/homeroom/
├── index.mjs          Netlify entry point — claims /homeroom and /homeroom/*
├── server.js          local dev server, also serves the site root like Netlify does
├── app/
│   ├── app.js         sessions, the four pre-login pages, the dispatcher
│   ├── routes.js      every members-only surface
│   ├── models.js      data layer: members, labs, forum, deals, funders, hours, jobs, events
│   ├── schema.js      the hr_ tables
│   ├── db.js          accounts, sessions, reset tokens, migrations, transactions
│   ├── auth.js        scrypt hashing, sessions, CSRF, password resets
│   ├── mail.js        the one message this app sends
│   ├── seed.js        the fictional sample network
│   ├── http.js        send/redirect/body/rate-limit helpers
│   ├── util.js        escaping, html`` templating, time, URL handling
│   └── views/         layout, components, pages
└── test/              unit and HTTP integration tests
```

Static assets live at the repo root in `homeroom-assets/` so the CDN serves
them; the stylesheet imports the site's own `tokens/*.css`, so Homeroom
inherits any change to the design system automatically.

## Accounts

Homeroom owns its own accounts rather than borrowing an identity provider —
one table, one scrypt hash, one signed cookie — which is what keeps it
deployable with nothing to sign up for.

- **Signup** takes a handle, an email and a password of at least 10 characters.
  The handle is permanent and public; the email is only ever used to sign in and
  to reset the password. The first account created is a steward.
- **Sign in** fails with one message whether the address is unknown or the
  password is wrong. A precise message tells a stranger which addresses have
  accounts here.
- **Forgot password** mints a single-use token that expires in an hour, stores
  only its hash, and mails the link. The page looks the same whether or not the
  address has an account, and the link is never shown to whoever asked for it —
  that would let anyone reset anyone's password.
- **Reset** replaces the password and drops every existing session, so it also
  works as a way to throw someone out.

Set a mail sender or resets cannot be delivered:

| Variable | Notes |
| --- | --- |
| `HOMEROOM_RESEND_KEY` | Resend API key. Without it the link is written to the function log and nothing is sent. |
| `HOMEROOM_MAIL_FROM` | The From address, e.g. `Homeroom <homeroom@haus.fund>`. |
| `HOMEROOM_SHOW_RESET_LINK` | `1` puts the link on screen instead of mailing it. Local development only — never set this in production. |

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `HOMEROOM_DB` | `/tmp/haus-homeroom.db` | SQLite file. |
| `HOMEROOM_SECRET` | random per boot | Set in production, or CSRF tokens rotate on restart and every open form breaks. |
| `HOMEROOM_STATIC_BASE` | `/homeroom-assets` | Where the stylesheet and client script are served from. |
| `HOMEROOM_SEED` | — | `off` stops a cold container filling itself with the sample network. Set this once there is real content. |

## What is private, and how

Every surface requires an account, and the pages carry `noindex`. Beyond that:

- **Anonymous posts** hide the handle in the page and in the JSON API. Stewards
  can still look it up — anonymity is for candour, not cover.
- **Deal codes** are only rendered to a member who has claimed the deal, and
  claims are counted so the community can renegotiate on real numbers.
- **Pipeline notes** are read back only for the member who wrote them.
- **Message threads** are readable only by their members; an intro request opens
  one with both people in it when it is accepted.
- **Applicant lists** are visible to the poster and lab admins, not to everyone.

`npm test` covers each of those as a separate assertion, because they are the
claims most likely to quietly stop being true.

## Ranking

```
score = (points - 1 + 0.75 × replies + 1) / (age_hours + 2) ^ 1.5
        × 1.6 if it is a question with no replies and under 48 hours old
        × 1.15 if an answer has been accepted

pinned threads sort above everything
```

A reply is worth much more than a vote, because an answered question is the
product. The lift on an unanswered question is what stops one dying unseen.

## Storage: read this before inviting anyone

Netlify functions have an ephemeral filesystem. The database lives in `/tmp`,
which means **a cold container starts from nothing**: accounts, posts, replies
and bookings do not survive, and two concurrent containers do not share state.
The sample network is re-seeded automatically, so the page looks right, which is
exactly what makes this easy to miss.

That is fine for reviewing the design and the flows. It is not fine for a
network people are asked to put their fundraising notes into. Before launch,
storage has to move to something durable — either run the app as a single
process against a real volume (it is one Node process and one SQLite file), or
swap `db.js` for a hosted Postgres or Turso instance. Everything above `db.js`
is written against a small query surface, so the second option is a contained
change.

Set `HOMEROOM_SEED=off` at the same time, or the sample members will reappear
next to the real ones.
