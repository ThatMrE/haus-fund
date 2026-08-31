-- =====================================================================
-- HOMEROOM — schema for Supabase Postgres
--
-- Homeroom is the members-only side of Haus: forum, member directory,
-- lab directory, deals, funder reviews, fundraising pipeline, office
-- hours, jobs, events, library, intros and messaging.
--
-- Run this once against a fresh Supabase project (SQL Editor, or
-- `supabase db push`). It is idempotent enough to re-run: every object
-- is created with `if not exists` or `create or replace`.
--
-- Three rules shape the whole file:
--
--   1. The browser is untrusted. The anon key ships in the page, so
--      every rule that matters is enforced here, not in JavaScript.
--   2. Reads are governed by row-level security; anything a member may
--      not see is never sent. Anonymity and deal codes are enforced with
--      COLUMN privileges, so the author of an anonymous post is not in
--      the row at all.
--   3. Anything that spans rows — voting, capacity, accepting an answer,
--      opening a thread — is a SECURITY DEFINER function, so it cannot
--      be half-done or forged.
-- =====================================================================

create extension if not exists citext;

-- ── identity ─────────────────────────────────────────────────────────

create table if not exists hr_members (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null check (handle ~ '^[a-zA-Z0-9_-]{2,20}$'),
  name          text not null default '',
  headline      text not null default '',
  org           text not null default '',
  role          text not null default '',
  cohort        text,
  location      text not null default '',
  bio           text not null default '',
  working_on    text not null default '',
  ask_me_about  text not null default '',
  links         text[] not null default '{}',
  bsl           text,
  open_intros   boolean not null default true,
  open_hours    boolean not null default false,
  open_collab   boolean not null default true,
  open_hiring   boolean not null default false,
  karma         integer not null default 1,
  is_steward    boolean not null default false,
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists hr_members_cohort_idx on hr_members (cohort);

create table if not exists hr_expertise (
  member_id uuid not null references hr_members(id) on delete cascade,
  tag       text not null check (tag ~ '^[a-z0-9-]{1,40}$'),
  primary key (member_id, tag)
);

create index if not exists hr_expertise_tag_idx on hr_expertise (tag);

-- ── labs ─────────────────────────────────────────────────────────────

create table if not exists hr_orgs (
  id          bigint generated always as identity primary key,
  slug        text unique,
  name        text not null,
  tagline     text not null default '',
  description text not null default '',
  kind        text not null default 'startup'
              check (kind in ('startup','communitylab','academic','foundry','nonprofit','collective','solo')),
  stage       text not null default 'idea'
              check (stage in ('idea','bench','prototype','preclinical','revenue','clinical','scaling')),
  location    text not null default '',
  website     text,
  cohort      text,
  founded     integer,
  headcount   integer,
  tags        text[] not null default '{}',
  created_by  uuid not null references hr_members(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists hr_org_members (
  org_id    bigint not null references hr_orgs(id) on delete cascade,
  member_id uuid not null references hr_members(id) on delete cascade,
  role      text not null default '',
  is_admin  boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (org_id, member_id)
);

-- Progress notes from a lab. The weekly-update surface.
create table if not exists hr_updates (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references hr_orgs(id) on delete cascade,
  author_id  uuid not null references hr_members(id) on delete cascade,
  period     text not null default '',
  body       text not null,
  metrics    text not null default '',
  asks       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists hr_updates_org_idx on hr_updates (org_id, created_at desc);

-- ── forum ────────────────────────────────────────────────────────────
--
-- `shown_author` is a stored generated column: null whenever the post is
-- anonymous. `author_id` itself is revoked from clients further down, so
-- an anonymous author is not merely hidden by the UI — the identity is
-- never in any row the database will send.

create table if not exists hr_posts (
  id             bigint generated always as identity primary key,
  author_id      uuid not null references hr_members(id) on delete cascade,
  anonymous      boolean not null default false,
  shown_author   uuid generated always as (case when anonymous then null else author_id end) stored,
  kind           text not null default 'question'
                 check (kind in ('question','discussion','intro','show','announce','poll','launch')),
  category       text not null default 'general'
                 check (category in ('wetlab','dry','hardware','biosafety','regulatory','funding',
                                     'legal','hiring','space','intros','life','general')),
  title          text not null check (length(title) between 8 and 160),
  body           text not null default '',
  org_id         bigint references hr_orgs(id) on delete set null,
  tags           text[] not null default '{}',
  points         integer not null default 1,
  comment_count  integer not null default 0,
  view_count     integer not null default 0,
  answer_id      bigint,
  pinned         boolean not null default false,
  locked         boolean not null default false,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  last_active_at timestamptz not null default now()
);

create index if not exists hr_posts_created_idx  on hr_posts (created_at desc);
create index if not exists hr_posts_category_idx on hr_posts (category, created_at desc);
create index if not exists hr_posts_active_idx   on hr_posts (last_active_at desc);
create index if not exists hr_posts_tags_idx     on hr_posts using gin (tags);

create table if not exists hr_comments (
  id           bigint generated always as identity primary key,
  post_id      bigint not null references hr_posts(id) on delete cascade,
  parent_id    bigint references hr_comments(id) on delete cascade,
  author_id    uuid not null references hr_members(id) on delete cascade,
  anonymous    boolean not null default false,
  shown_author uuid generated always as (case when anonymous then null else author_id end) stored,
  body         text not null,
  depth        integer not null default 0,
  points       integer not null default 1,
  deleted      boolean not null default false,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);

create index if not exists hr_comments_post_idx on hr_comments (post_id, created_at);

do $$ begin
  alter table hr_posts add constraint hr_posts_answer_fk
    foreign key (answer_id) references hr_comments(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Foreign keys on the `shown_author` columns, so PostgREST can embed the
-- author of a post, reply or review in one request. They deliberately have
-- no ON DELETE action: a generated column may not carry one, and the
-- author_id key already cascades, which removes the row first.
do $$ begin
  alter table hr_posts add constraint hr_posts_shown_author_fk
    foreign key (shown_author) references hr_members(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table hr_comments add constraint hr_comments_shown_author_fk
    foreign key (shown_author) references hr_members(id);
exception when duplicate_object then null; end $$;

-- One vote table for posts and comments, discriminated by target kind.
create table if not exists hr_votes (
  member_id   uuid not null references hr_members(id) on delete cascade,
  target_kind text not null check (target_kind in ('post','comment')),
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  primary key (member_id, target_kind, target_id)
);

create table if not exists hr_saves (
  member_id   uuid not null references hr_members(id) on delete cascade,
  target_kind text not null,
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  primary key (member_id, target_kind, target_id)
);

-- Follows drive the notification fan-out on a thread.
create table if not exists hr_follows (
  member_id   uuid not null references hr_members(id) on delete cascade,
  target_kind text not null,
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  primary key (member_id, target_kind, target_id)
);

create index if not exists hr_follows_target_idx on hr_follows (target_kind, target_id);

create table if not exists hr_poll_options (
  id       bigint generated always as identity primary key,
  post_id  bigint not null references hr_posts(id) on delete cascade,
  label    text not null,
  votes    integer not null default 0,
  position integer not null default 0
);

create table if not exists hr_poll_votes (
  post_id    bigint not null references hr_posts(id) on delete cascade,
  member_id  uuid not null references hr_members(id) on delete cascade,
  option_id  bigint not null references hr_poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

-- ── deals ────────────────────────────────────────────────────────────
--
-- `code` is revoked from clients below. It is returned only by
-- hr_claim_deal() and hr_my_deal_code(), and only to a member who has
-- claimed the deal.

create table if not exists hr_deals (
  id         bigint generated always as identity primary key,
  slug       text unique,
  vendor     text not null,
  title      text not null,
  category   text not null default 'other'
             check (category in ('reagents','sequencing','synthesis','cloudlab','compute',
                                 'equipment','software','services','other')),
  summary    text not null default '',
  details    text not null default '',
  worth      text not null default '',
  code       text not null default '',
  url        text,
  expires_at timestamptz,
  active     boolean not null default true,
  posted_by  uuid not null references hr_members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists hr_deal_claims (
  deal_id    bigint not null references hr_deals(id) on delete cascade,
  member_id  uuid not null references hr_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, member_id)
);

-- ── funders ──────────────────────────────────────────────────────────

create table if not exists hr_funders (
  id          bigint generated always as identity primary key,
  slug        text unique,
  name        text not null,
  kind        text not null default 'vc'
              check (kind in ('vc','angel','grant','foundation','prize','accelerator','dao')),
  focus       text not null default '',
  stages      text not null default '',
  check_size  text not null default '',
  location    text not null default '',
  website     text,
  description text not null default '',
  dilutive    boolean not null default true,
  added_by    uuid references hr_members(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Five stars and a written account. One review per member per funder,
-- anonymous by default — the mechanic that keeps them honest.
create table if not exists hr_funder_reviews (
  id           bigint generated always as identity primary key,
  funder_id    bigint not null references hr_funders(id) on delete cascade,
  member_id    uuid not null references hr_members(id) on delete cascade,
  anonymous    boolean not null default true,
  shown_author uuid generated always as (case when anonymous then null else member_id end) stored,
  rating       smallint not null check (rating between 1 and 5),
  speed        smallint check (speed between 1 and 5),
  value_add    smallint check (value_add between 1 and 5),
  invested     boolean not null default false,
  body         text not null default '',
  created_at   timestamptz not null default now(),
  unique (funder_id, member_id)
);

do $$ begin
  alter table hr_funder_reviews add constraint hr_reviews_shown_author_fk
    foreign key (shown_author) references hr_members(id);
exception when duplicate_object then null; end $$;

-- The fundraising CRM. Owner-only, enforced by RLS.
create table if not exists hr_pipeline (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references hr_members(id) on delete cascade,
  funder_id  bigint not null references hr_funders(id) on delete cascade,
  org_id     bigint references hr_orgs(id) on delete set null,
  status     text not null default 'researching'
             check (status in ('researching','intro','pitched','diligence','committed','passed','closed')),
  amount     text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, funder_id)
);

-- ── office hours ─────────────────────────────────────────────────────

create table if not exists hr_slots (
  id          bigint generated always as identity primary key,
  host_id     uuid not null references hr_members(id) on delete cascade,
  title       text not null,
  description text not null default '',
  format      text not null default 'one-on-one' check (format in ('one-on-one','group')),
  starts_at   timestamptz not null,
  minutes     integer not null default 30 check (minutes between 10 and 240),
  capacity    integer not null default 1 check (capacity between 1 and 50),
  place       text not null default '',
  topics      text not null default '',
  canceled    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists hr_slots_start_idx on hr_slots (starts_at);

create table if not exists hr_bookings (
  slot_id    bigint not null references hr_slots(id) on delete cascade,
  member_id  uuid not null references hr_members(id) on delete cascade,
  question   text not null default '',
  created_at timestamptz not null default now(),
  primary key (slot_id, member_id)
);

-- ── jobs ─────────────────────────────────────────────────────────────

create table if not exists hr_jobs (
  id          bigint generated always as identity primary key,
  org_id      bigint not null references hr_orgs(id) on delete cascade,
  posted_by   uuid not null references hr_members(id) on delete cascade,
  title       text not null,
  discipline  text not null default 'other'
              check (discipline in ('wetlab','computational','engineering','ops','regulatory','bizdev','other')),
  employment  text not null default 'full-time'
              check (employment in ('full-time','part-time','contract','intern')),
  location    text not null default '',
  remote      boolean not null default false,
  comp        text not null default '',
  equity      text not null default '',
  description text not null default '',
  tags        text[] not null default '{}',
  closed      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists hr_applications (
  job_id     bigint not null references hr_jobs(id) on delete cascade,
  member_id  uuid not null references hr_members(id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now(),
  primary key (job_id, member_id)
);

-- ── events ───────────────────────────────────────────────────────────

create table if not exists hr_events (
  id          bigint generated always as identity primary key,
  host_id     uuid not null references hr_members(id) on delete cascade,
  title       text not null,
  description text not null default '',
  kind        text not null default 'meetup'
              check (kind in ('meetup','talk','workshop','demoday','openlab','online')),
  starts_at   timestamptz not null,
  minutes     integer not null default 90,
  place       text not null default '',
  url         text,
  capacity    integer not null default 0,
  canceled    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists hr_events_start_idx on hr_events (starts_at);

create table if not exists hr_rsvps (
  event_id   bigint not null references hr_events(id) on delete cascade,
  member_id  uuid not null references hr_members(id) on delete cascade,
  status     text not null default 'going' check (status in ('going','maybe')),
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

-- ── library ──────────────────────────────────────────────────────────

create table if not exists hr_library (
  id         bigint generated always as identity primary key,
  slug       text unique,
  title      text not null,
  kind       text not null default 'guide' check (kind in ('guide','protocol','essay','template')),
  summary    text not null default '',
  body       text not null default '',
  tags       text[] not null default '{}',
  author_id  uuid references hr_members(id) on delete set null,
  reads      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── intros ───────────────────────────────────────────────────────────

create table if not exists hr_intros (
  id           bigint generated always as identity primary key,
  requester_id uuid not null references hr_members(id) on delete cascade,
  target_id    uuid not null references hr_members(id) on delete cascade,
  reason       text not null check (length(reason) >= 20),
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (requester_id <> target_id)
);

create index if not exists hr_intros_target_idx on hr_intros (target_id, status);

-- ── messaging ────────────────────────────────────────────────────────

create table if not exists hr_threads (
  id         bigint generated always as identity primary key,
  subject    text not null default '',
  created_by uuid not null references hr_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);

create table if not exists hr_thread_members (
  thread_id    bigint not null references hr_threads(id) on delete cascade,
  member_id    uuid not null references hr_members(id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  primary key (thread_id, member_id)
);

create table if not exists hr_messages (
  id         bigint generated always as identity primary key,
  thread_id  bigint not null references hr_threads(id) on delete cascade,
  sender_id  uuid not null references hr_members(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists hr_messages_thread_idx on hr_messages (thread_id, created_at);

-- ── notifications ────────────────────────────────────────────────────

create table if not exists hr_notifications (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references hr_members(id) on delete cascade,
  kind       text not null,
  actor_id   uuid references hr_members(id) on delete set null,
  body       text not null default '',
  href       text not null default '/homeroom/',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hr_notifications_member_idx on hr_notifications (member_id, created_at desc);

-- =====================================================================
-- ACCESS CONTROL
--
-- Helpers are SECURITY DEFINER so that a policy on hr_members can ask
-- "is this person a member?" without recursing into its own policy.
-- =====================================================================

create or replace function hr_is_member() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from hr_members m where m.id = auth.uid());
$$;

create or replace function hr_is_steward() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from hr_members m where m.id = auth.uid() and m.is_steward);
$$;

create or replace function hr_in_org(target bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from hr_org_members o where o.org_id = target and o.member_id = auth.uid());
$$;

create or replace function hr_is_org_admin(target bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hr_org_members o
    where o.org_id = target and o.member_id = auth.uid() and o.is_admin
  ) or hr_is_steward();
$$;

create or replace function hr_in_thread(target bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from hr_thread_members t where t.thread_id = target and t.member_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'hr_members','hr_expertise','hr_orgs','hr_org_members','hr_updates','hr_posts','hr_comments',
    'hr_votes','hr_saves','hr_follows','hr_poll_options','hr_poll_votes','hr_deals','hr_deal_claims',
    'hr_funders','hr_funder_reviews','hr_pipeline','hr_slots','hr_bookings','hr_jobs','hr_applications',
    'hr_events','hr_rsvps','hr_library','hr_intros','hr_threads','hr_thread_members','hr_messages',
    'hr_notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Policies are dropped first so the file can be re-run.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename like 'hr\_%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ── the members-only rule ────────────────────────────────────────────
-- Everything below is readable by members and by nobody else. A logged
-- out visitor gets empty results, not a filtered view.

create policy hr_read on hr_members       for select using (hr_is_member());
create policy hr_read on hr_expertise     for select using (hr_is_member());
create policy hr_read on hr_orgs          for select using (hr_is_member());
create policy hr_read on hr_org_members   for select using (hr_is_member());
create policy hr_read on hr_updates       for select using (hr_is_member());
create policy hr_read on hr_posts         for select using (hr_is_member());
create policy hr_read on hr_comments      for select using (hr_is_member());
create policy hr_read on hr_poll_options  for select using (hr_is_member());
create policy hr_read on hr_deals         for select using (hr_is_member());
create policy hr_read on hr_funders       for select using (hr_is_member());
create policy hr_read on hr_funder_reviews for select using (hr_is_member());
create policy hr_read on hr_slots         for select using (hr_is_member());
create policy hr_read on hr_jobs          for select using (hr_is_member());
create policy hr_read on hr_events        for select using (hr_is_member());
create policy hr_read on hr_rsvps         for select using (hr_is_member());
create policy hr_read on hr_library       for select using (hr_is_member());
create policy hr_read on hr_votes         for select using (hr_is_member());
create policy hr_read on hr_poll_votes    for select using (hr_is_member());

-- ── private to one member ────────────────────────────────────────────

create policy hr_own on hr_pipeline      for all    using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy hr_own on hr_saves         for all    using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy hr_own on hr_follows       for all    using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy hr_own on hr_deal_claims   for select using (member_id = auth.uid());
create policy hr_own on hr_notifications for select using (member_id = auth.uid());
create policy hr_own_update on hr_notifications for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Bookings: yours, or the ones on a session you host.
create policy hr_read on hr_bookings for select
  using (member_id = auth.uid() or exists (select 1 from hr_slots s where s.id = slot_id and s.host_id = auth.uid()));

-- Applications: yours, or the ones on a role you posted.
create policy hr_read on hr_applications for select
  using (member_id = auth.uid() or exists (
    select 1 from hr_jobs j where j.id = job_id and (j.posted_by = auth.uid() or hr_is_org_admin(j.org_id))));

-- Intros: only the two people in them.
create policy hr_read on hr_intros for select
  using (requester_id = auth.uid() or target_id = auth.uid());

-- Messages: only members of the thread.
create policy hr_read on hr_threads        for select using (hr_in_thread(id));
create policy hr_read on hr_thread_members for select using (hr_in_thread(thread_id));
create policy hr_read on hr_messages       for select using (hr_in_thread(thread_id));
create policy hr_own on hr_thread_members  for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── writes members make directly ─────────────────────────────────────
-- Anything whose rules span more than one row goes through a function
-- further down instead.

create policy hr_edit_self on hr_members for update using (id = auth.uid()) with check (id = auth.uid());

create policy hr_own_tags   on hr_expertise for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy hr_create on hr_orgs for insert with check (hr_is_member() and created_by = auth.uid());
create policy hr_admin  on hr_orgs for update using (hr_is_org_admin(id)) with check (hr_is_org_admin(id));

create policy hr_join  on hr_org_members for insert with check (hr_is_member() and member_id = auth.uid());
create policy hr_leave on hr_org_members for delete using (member_id = auth.uid() or hr_is_org_admin(org_id));
-- Only an existing admin may change roles or promote anyone. Without this
-- there is no UPDATE policy at all, so a member joining a lab and setting
-- is_admin on their own row silently affects zero rows -- safe, but it also
-- leaves a lab with no way to add a second admin.
create policy hr_manage on hr_org_members for update
  using (hr_is_org_admin(org_id)) with check (hr_is_org_admin(org_id));

create policy hr_create on hr_updates for insert with check (author_id = auth.uid() and hr_in_org(org_id));

create policy hr_create on hr_deals   for insert with check (hr_is_member() and posted_by = auth.uid());
create policy hr_create on hr_funders for insert with check (hr_is_member() and added_by = auth.uid());
create policy hr_create on hr_library for insert with check (hr_is_member() and author_id = auth.uid());
create policy hr_edit   on hr_library for update using (author_id = auth.uid() or hr_is_steward());

create policy hr_create on hr_slots  for insert with check (hr_is_member() and host_id = auth.uid());
create policy hr_edit   on hr_slots  for update using (host_id = auth.uid() or hr_is_steward());

create policy hr_create on hr_events for insert with check (hr_is_member() and host_id = auth.uid());
create policy hr_edit   on hr_events for update using (host_id = auth.uid() or hr_is_steward());

create policy hr_create on hr_jobs for insert with check (posted_by = auth.uid() and hr_in_org(org_id));
create policy hr_edit   on hr_jobs for update using (posted_by = auth.uid() or hr_is_org_admin(org_id));

create policy hr_edit   on hr_posts for update using (author_id = auth.uid() or hr_is_steward());
create policy hr_edit   on hr_comments for update using (author_id = auth.uid() or hr_is_steward());

create policy hr_unbook on hr_bookings for delete using (member_id = auth.uid());

create policy hr_upsert on hr_funder_reviews for insert with check (hr_is_member() and member_id = auth.uid());
create policy hr_edit   on hr_funder_reviews for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── column privileges ────────────────────────────────────────────────
--
-- Row-level security decides which rows are sent. These decide which
-- COLUMNS are sent, which is what actually makes anonymity and deal
-- codes real rather than a UI convention.

-- A column-level REVOKE does nothing while a table-level SELECT grant is
-- still in place, and Supabase grants one on every new table in `public`
-- by default. So the table grant goes first, then SELECT is granted back
-- column by column, leaving the sensitive ones out. Without this the
-- author of an anonymous post is one query away.

revoke select on hr_posts from anon, authenticated;
grant  select (id, shown_author, anonymous, kind, category, title, body, org_id, tags,
               points, comment_count, view_count, answer_id, pinned, locked,
               created_at, edited_at, last_active_at)
  on hr_posts to authenticated;

revoke select on hr_comments from anon, authenticated;
grant  select (id, post_id, parent_id, shown_author, anonymous, body, depth, points,
               deleted, created_at, edited_at)
  on hr_comments to authenticated;

revoke select on hr_funder_reviews from anon, authenticated;
grant  select (id, funder_id, shown_author, anonymous, rating, speed, value_add,
               invested, body, created_at)
  on hr_funder_reviews to authenticated;

-- A deal code is readable only through hr_claim_deal() and
-- hr_my_deal_code(), and only by a member who has claimed it.
revoke select on hr_deals from anon, authenticated;
grant  select (id, slug, vendor, title, category, summary, details, worth, url,
               expires_at, active, posted_by, created_at)
  on hr_deals to authenticated;

-- Counters, karma and steward status are maintained by functions, never
-- by the client, so the client cannot write them.
revoke update on hr_members from anon, authenticated;
grant  update (name, headline, org, role, cohort, location, bio, working_on, ask_me_about,
               links, bsl, open_intros, open_hours, open_collab, open_hiring, updated_at,
               last_seen_at)
  on hr_members to authenticated;

revoke update on hr_posts from anon, authenticated;
grant  update (title, body, category, tags, edited_at) on hr_posts to authenticated;

revoke update on hr_comments from anon, authenticated;
grant  update (body, deleted, edited_at) on hr_comments to authenticated;

-- Members are created by hr_claim_handle() during signup, and nowhere else.
revoke insert, delete on hr_members from anon, authenticated;

-- =====================================================================
-- TRIGGERS
--
-- Two things the client cannot be allowed to do for itself: mint its own
-- slug (it would collide, or be ugly, or be a lie) and make itself an
-- admin of a lab. Both happen here instead.
-- =====================================================================

create or replace function hr_slugify(source text) returns text
  language sql immutable as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(lower(source), '[^a-z0-9]+', '-', 'g')), 60), ''), 'x');
$$;

-- Fills in a unique slug from a column of the row being inserted. The
-- column to read is passed as the trigger argument.
create or replace function hr_set_slug() returns trigger
  language plpgsql security definer set search_path = public as $$
declare base text; candidate text; n integer := 2; taken boolean; source text;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  execute format('select ($1).%I', tg_argv[0]) into source using new;
  base := hr_slugify(source);
  candidate := base;
  loop
    execute format('select exists (select 1 from %I where slug = $1)', tg_table_name)
      into taken using candidate;
    exit when not taken;
    candidate := base || '-' || n;
    n := n + 1;
    if n > 500 then candidate := base || '-' || floor(random() * 100000)::text; exit; end if;
  end loop;
  new.slug := candidate;
  return new;
end $$;

drop trigger if exists hr_orgs_slug on hr_orgs;
create trigger hr_orgs_slug before insert on hr_orgs
  for each row execute function hr_set_slug('name');

drop trigger if exists hr_deals_slug on hr_deals;
create trigger hr_deals_slug before insert on hr_deals
  for each row execute function hr_set_slug('vendor');

drop trigger if exists hr_funders_slug on hr_funders;
create trigger hr_funders_slug before insert on hr_funders
  for each row execute function hr_set_slug('name');

drop trigger if exists hr_library_slug on hr_library;
create trigger hr_library_slug before insert on hr_library
  for each row execute function hr_set_slug('title');

-- Whoever adds a lab is its first admin. Row-level security stops the
-- client setting is_admin itself, so it is granted here.
create or replace function hr_org_founder() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into hr_org_members (org_id, member_id, role, is_admin)
  values (new.id, new.created_by, 'founder', true)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists hr_orgs_founder on hr_orgs;
create trigger hr_orgs_founder after insert on hr_orgs
  for each row execute function hr_org_founder();

-- =====================================================================
-- THE FEED
--
-- Same gravity curve as the public Haus feed, with two changes that suit
-- a forum: a reply is worth much more than a vote, and a question with
-- no replies in its first 48 hours is lifted so it is not lost.
-- security_invoker keeps row-level security applied to the caller.
-- =====================================================================

create or replace view hr_feed with (security_invoker = on) as
select
  p.id, p.shown_author, p.anonymous, p.kind, p.category, p.title, p.body, p.org_id, p.tags,
  p.points, p.comment_count, p.view_count, p.answer_id, p.pinned, p.locked,
  p.created_at, p.edited_at, p.last_active_at,
  o.name as org_name, o.slug as org_slug,
  a.handle as author_handle, a.name as author_name,
  (
    (p.points - 1 + 0.75 * p.comment_count + 1)
    / power(greatest(extract(epoch from (now() - p.created_at)) / 3600, 0) + 2, 1.5)
    * case when p.kind = 'question' and p.comment_count = 0
            and p.created_at > now() - interval '48 hours' then 1.6 else 1.0 end
    * case when p.answer_id is not null then 1.15 else 1.0 end
  ) as score
from hr_posts p
left join hr_orgs o on o.id = p.org_id
left join hr_members a on a.id = p.shown_author;

-- Funder ratings, rolled up once rather than in every client.
create or replace view hr_funder_stats with (security_invoker = on) as
select
  f.id, f.slug, f.name, f.kind, f.focus, f.stages, f.check_size, f.location,
  f.website, f.description, f.dilutive, f.created_at,
  count(r.id)                            as review_count,
  round(avg(r.rating)::numeric, 1)       as avg_rating,
  round(avg(r.speed)::numeric, 1)        as avg_speed,
  round(avg(r.value_add)::numeric, 1)    as avg_value
from hr_funders f
left join hr_funder_reviews r on r.funder_id = f.id
group by f.id;

-- =====================================================================
-- WRITES THAT SPAN ROWS
--
-- Each of these is a rule the browser cannot be trusted to keep: you may
-- not upvote yourself, only the person who asked may accept an answer, a
-- full session may not be booked, a deal code is only for a claimer.
-- =====================================================================

create or replace function hr_notify(
  p_member uuid, p_kind text, p_actor uuid, p_body text, p_href text
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- You are never notified about your own actions.
  if p_member is null or p_member = p_actor then return; end if;
  insert into hr_notifications (member_id, kind, actor_id, body, href)
  values (p_member, p_kind, p_actor, p_body, p_href);
end $$;

-- Called once, straight after signup, to claim a handle and open a profile.
create or replace function hr_claim_handle(p_handle text, p_name text default '')
returns hr_members language plpgsql security definer set search_path = public as $$
declare row hr_members;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from hr_members where id = auth.uid()) then
    raise exception 'you already have a Homeroom profile';
  end if;
  if p_handle !~ '^[a-zA-Z0-9_-]{2,20}$' then
    raise exception 'Handles are 2-20 characters: letters, numbers, dashes and underscores.';
  end if;
  if exists (select 1 from hr_members where handle = p_handle) then
    raise exception 'That handle is taken.';
  end if;
  insert into hr_members (id, handle, name) values (auth.uid(), p_handle, coalesce(p_name, ''))
  returning * into row;
  return row;
end $$;

create or replace function hr_create_post(
  p_title text, p_body text default '', p_kind text default 'question',
  p_category text default 'general', p_tags text[] default '{}',
  p_org_id bigint default null, p_anonymous boolean default false,
  p_options text[] default '{}'
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; opt text; i integer := 0;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  if p_org_id is not null and not hr_in_org(p_org_id) then
    raise exception 'you are not listed with that lab';
  end if;
  if p_kind = 'poll' and coalesce(array_length(p_options, 1), 0) < 2 then
    raise exception 'a poll needs at least two options';
  end if;

  insert into hr_posts (author_id, anonymous, kind, category, title, body, org_id, tags)
  values (auth.uid(), p_anonymous, p_kind, p_category, p_title, coalesce(p_body, ''), p_org_id,
          coalesce(p_tags, '{}'))
  returning id into new_id;

  -- The author's own upvote is a real row, so unvoting behaves.
  insert into hr_votes (member_id, target_kind, target_id) values (auth.uid(), 'post', new_id);
  insert into hr_follows (member_id, target_kind, target_id) values (auth.uid(), 'post', new_id)
    on conflict do nothing;

  if p_kind = 'poll' then
    foreach opt in array p_options loop
      exit when i >= 8;
      insert into hr_poll_options (post_id, label, position) values (new_id, opt, i);
      i := i + 1;
    end loop;
  end if;
  return new_id;
end $$;

create or replace function hr_create_comment(
  p_post_id bigint, p_body text, p_parent_id bigint default null, p_anonymous boolean default false
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; new_depth integer := 0; post hr_posts; who text; follower uuid;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select * into post from hr_posts where id = p_post_id;
  if post is null then raise exception 'no such post'; end if;
  if post.locked then raise exception 'that thread is locked'; end if;

  if p_parent_id is not null then
    select least(depth + 1, 12) into new_depth from hr_comments
     where id = p_parent_id and post_id = p_post_id;
    if new_depth is null then raise exception 'that reply does not belong to this thread'; end if;
  end if;

  insert into hr_comments (post_id, parent_id, author_id, anonymous, body, depth)
  values (p_post_id, p_parent_id, auth.uid(), p_anonymous, p_body, new_depth)
  returning id into new_id;

  insert into hr_votes (member_id, target_kind, target_id) values (auth.uid(), 'comment', new_id);
  update hr_posts set comment_count = comment_count + 1, last_active_at = now() where id = p_post_id;

  -- Replying subscribes you to the thread, but never unsubscribes you.
  insert into hr_follows (member_id, target_kind, target_id) values (auth.uid(), 'post', p_post_id)
    on conflict do nothing;

  select case when p_anonymous then 'An anonymous member'
              else coalesce(nullif(m.name, ''), m.handle) end
    into who from hr_members m where m.id = auth.uid();

  for follower in select member_id from hr_follows where target_kind = 'post' and target_id = p_post_id loop
    perform hr_notify(follower, 'reply', auth.uid(),
      who || ' replied to "' || post.title || '"',
      '/homeroom/post.html?id=' || p_post_id || '#c' || new_id);
  end loop;
  return new_id;
end $$;

create or replace function hr_vote(p_kind text, p_id bigint, p_direction text default 'up')
returns integer language plpgsql security definer set search_path = public as $$
declare author uuid; current_points integer; already boolean;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  if p_kind = 'post' then
    select author_id, points into author, current_points from hr_posts where id = p_id;
  elsif p_kind = 'comment' then
    select author_id, points into author, current_points from hr_comments where id = p_id and not deleted;
  else
    raise exception 'unknown target';
  end if;
  if author is null then raise exception 'no such item'; end if;
  if author = auth.uid() then raise exception 'you cannot upvote your own post'; end if;

  select exists (select 1 from hr_votes
    where member_id = auth.uid() and target_kind = p_kind and target_id = p_id) into already;

  if p_direction = 'down' then
    if not already then return current_points; end if;
    delete from hr_votes where member_id = auth.uid() and target_kind = p_kind and target_id = p_id;
    update hr_members set karma = greatest(karma - 1, 0) where id = author;
    if p_kind = 'post' then
      update hr_posts set points = greatest(points - 1, 0) where id = p_id returning points into current_points;
    else
      update hr_comments set points = greatest(points - 1, 0) where id = p_id returning points into current_points;
    end if;
  else
    if already then return current_points; end if;
    insert into hr_votes (member_id, target_kind, target_id) values (auth.uid(), p_kind, p_id);
    update hr_members set karma = karma + 1 where id = author;
    if p_kind = 'post' then
      update hr_posts set points = points + 1 where id = p_id returning points into current_points;
    else
      update hr_comments set points = points + 1 where id = p_id returning points into current_points;
    end if;
  end if;
  return current_points;
end $$;

create or replace function hr_accept_answer(p_post_id bigint, p_comment_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare post hr_posts; answer_author uuid;
begin
  select * into post from hr_posts where id = p_post_id;
  if post is null then raise exception 'no such post'; end if;
  if post.author_id <> auth.uid() then
    raise exception 'only the person who asked can accept an answer';
  end if;
  if p_comment_id is null then
    update hr_posts set answer_id = null where id = p_post_id;
    return;
  end if;
  select author_id into answer_author from hr_comments where id = p_comment_id and post_id = p_post_id;
  if answer_author is null then raise exception 'that reply is not on this thread'; end if;
  update hr_posts set answer_id = p_comment_id where id = p_post_id;
  perform hr_notify(answer_author, 'answer', auth.uid(),
    'Your answer was accepted on "' || post.title || '"',
    '/homeroom/post.html?id=' || p_post_id || '#c' || p_comment_id);
end $$;

create or replace function hr_cast_poll_vote(p_post_id bigint, p_option_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare previous bigint;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  if not exists (select 1 from hr_poll_options where id = p_option_id and post_id = p_post_id) then
    raise exception 'no such option';
  end if;
  select option_id into previous from hr_poll_votes where post_id = p_post_id and member_id = auth.uid();
  if previous = p_option_id then return; end if;

  if previous is not null then
    update hr_poll_options set votes = greatest(votes - 1, 0) where id = previous;
    update hr_poll_votes set option_id = p_option_id, created_at = now()
      where post_id = p_post_id and member_id = auth.uid();
  else
    insert into hr_poll_votes (post_id, member_id, option_id) values (p_post_id, auth.uid(), p_option_id);
  end if;
  update hr_poll_options set votes = votes + 1 where id = p_option_id;
end $$;

create or replace function hr_bump_views(p_post_id bigint)
returns void language sql security definer set search_path = public as $$
  update hr_posts set view_count = view_count + 1 where id = p_post_id;
$$;

create or replace function hr_bump_reads(p_entry_id bigint)
returns void language sql security definer set search_path = public as $$
  update hr_library set reads = reads + 1 where id = p_entry_id;
$$;

-- Claiming is what reveals the code, and it is counted so the community
-- can renegotiate the deal on real numbers.
create or replace function hr_claim_deal(p_deal_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare deal_code text;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  if not exists (select 1 from hr_deals where id = p_deal_id and active) then
    raise exception 'no such deal';
  end if;
  insert into hr_deal_claims (deal_id, member_id) values (p_deal_id, auth.uid())
    on conflict do nothing;
  select code into deal_code from hr_deals where id = p_deal_id;
  return deal_code;
end $$;

create or replace function hr_my_deal_code(p_deal_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare deal_code text;
begin
  if not exists (select 1 from hr_deal_claims where deal_id = p_deal_id and member_id = auth.uid()) then
    return null;
  end if;
  select code into deal_code from hr_deals where id = p_deal_id;
  return deal_code;
end $$;

create or replace function hr_book_slot(p_slot_id bigint, p_question text default '')
returns void language plpgsql security definer set search_path = public as $$
declare slot hr_slots; taken integer;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select * into slot from hr_slots where id = p_slot_id;
  if slot is null or slot.canceled then raise exception 'no such session'; end if;
  if slot.host_id = auth.uid() then raise exception 'you are hosting this one'; end if;
  if slot.starts_at < now() then raise exception 'that session has already happened'; end if;
  if exists (select 1 from hr_bookings where slot_id = p_slot_id and member_id = auth.uid()) then return; end if;

  select count(*) into taken from hr_bookings where slot_id = p_slot_id;
  if taken >= slot.capacity then raise exception 'that session is full'; end if;

  insert into hr_bookings (slot_id, member_id, question) values (p_slot_id, auth.uid(), p_question);
  perform hr_notify(slot.host_id, 'booking', auth.uid(),
    'Someone booked your office hours: ' || slot.title, '/homeroom/hours.html?slot=' || p_slot_id);
end $$;

create or replace function hr_rsvp(p_event_id bigint, p_status text default 'going')
returns void language plpgsql security definer set search_path = public as $$
declare event hr_events; going_count integer; mine text;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select * into event from hr_events where id = p_event_id;
  if event is null or event.canceled then raise exception 'no such event'; end if;

  if p_status = 'none' then
    delete from hr_rsvps where event_id = p_event_id and member_id = auth.uid();
    return;
  end if;

  select status into mine from hr_rsvps where event_id = p_event_id and member_id = auth.uid();
  if p_status = 'going' and event.capacity > 0 and coalesce(mine, '') <> 'going' then
    select count(*) into going_count from hr_rsvps where event_id = p_event_id and status = 'going';
    if going_count >= event.capacity then raise exception 'that event is full'; end if;
  end if;

  insert into hr_rsvps (event_id, member_id, status) values (p_event_id, auth.uid(), p_status)
    on conflict (event_id, member_id) do update set status = excluded.status;
end $$;

create or replace function hr_apply_to_job(p_job_id bigint, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare job hr_jobs; who text;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select * into job from hr_jobs where id = p_job_id;
  if job is null or job.closed then raise exception 'that role is closed'; end if;
  insert into hr_applications (job_id, member_id, note) values (p_job_id, auth.uid(), p_note)
    on conflict do nothing;
  select coalesce(nullif(name, ''), handle) into who from hr_members where id = auth.uid();
  perform hr_notify(job.posted_by, 'application', auth.uid(),
    who || ' applied for ' || job.title, '/homeroom/jobs.html?id=' || p_job_id);
end $$;

-- ── intros ───────────────────────────────────────────────────────────

create or replace function hr_request_intro(p_handle text, p_reason text)
returns bigint language plpgsql security definer set search_path = public as $$
declare target hr_members; new_id bigint; who text;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select * into target from hr_members where handle = p_handle;
  if target is null then raise exception 'no such member'; end if;
  if target.id = auth.uid() then raise exception 'you already know yourself'; end if;
  if not target.open_intros then raise exception 'that member is not taking intro requests'; end if;
  if length(coalesce(p_reason, '')) < 20 then
    raise exception 'say more than that - twenty characters minimum';
  end if;
  if exists (select 1 from hr_intros
      where requester_id = auth.uid() and target_id = target.id and status = 'pending') then
    raise exception 'you already have a pending request to this member';
  end if;

  insert into hr_intros (requester_id, target_id, reason) values (auth.uid(), target.id, p_reason)
  returning id into new_id;

  select coalesce(nullif(name, ''), handle) into who from hr_members where id = auth.uid();
  perform hr_notify(target.id, 'intro', auth.uid(),
    who || ' asked you for an intro', '/homeroom/intros.html');
  return new_id;
end $$;

-- Accepting opens a thread with both members in it, so the request ends
-- in a conversation rather than a maybe.
create or replace function hr_resolve_intro(p_intro_id bigint, p_decision text)
returns bigint language plpgsql security definer set search_path = public as $$
declare intro hr_intros; thread_id bigint; who text;
begin
  select * into intro from hr_intros where id = p_intro_id;
  if intro is null then raise exception 'no such request'; end if;
  if intro.target_id <> auth.uid() then raise exception 'not yours to answer'; end if;
  if intro.status <> 'pending' then raise exception 'that request is already answered'; end if;
  if p_decision not in ('accepted', 'declined') then raise exception 'unknown decision'; end if;

  update hr_intros set status = p_decision, resolved_at = now() where id = p_intro_id;
  select coalesce(nullif(name, ''), handle) into who from hr_members where id = auth.uid();

  if p_decision = 'declined' then
    perform hr_notify(intro.requester_id, 'intro', auth.uid(),
      who || ' declined your intro request', '/homeroom/intros.html');
    return null;
  end if;

  insert into hr_threads (subject, created_by) values ('Intro', auth.uid()) returning id into thread_id;
  insert into hr_thread_members (thread_id, member_id, last_read_at)
    values (thread_id, auth.uid(), now()), (thread_id, intro.requester_id, 'epoch');
  insert into hr_messages (thread_id, sender_id, body)
    values (thread_id, auth.uid(), 'Happy to talk. Context from the request:' || chr(10) || chr(10) || intro.reason);

  perform hr_notify(intro.requester_id, 'intro', auth.uid(),
    who || ' accepted your intro request', '/homeroom/messages.html?thread=' || thread_id);
  return thread_id;
end $$;

-- ── messaging ────────────────────────────────────────────────────────

-- One-to-one threads are reused, so a direct-message list does not
-- sprout duplicates.
create or replace function hr_open_direct_thread(p_handle text)
returns bigint language plpgsql security definer set search_path = public as $$
declare other uuid; thread_id bigint;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  select id into other from hr_members where handle = p_handle;
  if other is null then raise exception 'no such member'; end if;
  if other = auth.uid() then raise exception 'pick someone other than yourself'; end if;

  select t.id into thread_id from hr_threads t
    join hr_thread_members a on a.thread_id = t.id and a.member_id = auth.uid()
    join hr_thread_members b on b.thread_id = t.id and b.member_id = other
   where (select count(*) from hr_thread_members m where m.thread_id = t.id) = 2
   order by t.id limit 1;
  if thread_id is not null then return thread_id; end if;

  insert into hr_threads (subject, created_by) values ('', auth.uid()) returning id into thread_id;
  insert into hr_thread_members (thread_id, member_id, last_read_at)
    values (thread_id, auth.uid(), now()), (thread_id, other, 'epoch');
  return thread_id;
end $$;

create or replace function hr_create_group_thread(p_handles text[], p_subject text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare thread_id bigint; h text; other uuid; added integer := 0;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  insert into hr_threads (subject, created_by) values (coalesce(p_subject, ''), auth.uid())
    returning id into thread_id;
  insert into hr_thread_members (thread_id, member_id, last_read_at) values (thread_id, auth.uid(), now());

  foreach h in array p_handles loop
    select id into other from hr_members where handle = trim(h);
    if other is null then raise exception 'no member called "%"', trim(h); end if;
    if other <> auth.uid() then
      insert into hr_thread_members (thread_id, member_id) values (thread_id, other)
        on conflict do nothing;
      added := added + 1;
    end if;
  end loop;
  if added = 0 then raise exception 'pick someone other than yourself'; end if;
  return thread_id;
end $$;

create or replace function hr_send_message(p_thread_id bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; who text; other uuid;
begin
  if not hr_in_thread(p_thread_id) then raise exception 'not a member of this thread'; end if;
  if length(coalesce(p_body, '')) = 0 then raise exception 'write something'; end if;

  insert into hr_messages (thread_id, sender_id, body) values (p_thread_id, auth.uid(), p_body)
    returning id into new_id;
  update hr_threads set last_at = now() where id = p_thread_id;
  update hr_thread_members set last_read_at = now()
    where thread_id = p_thread_id and member_id = auth.uid();

  select coalesce(nullif(name, ''), handle) into who from hr_members where id = auth.uid();
  for other in select member_id from hr_thread_members where thread_id = p_thread_id loop
    perform hr_notify(other, 'message', auth.uid(), who || ' sent you a message',
      '/homeroom/messages.html?thread=' || p_thread_id);
  end loop;
  return new_id;
end $$;

create or replace function hr_mark_thread_read(p_thread_id bigint)
returns void language sql security definer set search_path = public as $$
  update hr_thread_members set last_read_at = now()
   where thread_id = p_thread_id and member_id = auth.uid();
$$;

create or replace function hr_mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update hr_notifications set read_at = now()
   where member_id = auth.uid() and read_at is null;
$$;

create or replace function hr_unread_counts()
returns table (messages bigint, notifications bigint, intros bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from hr_messages m
       join hr_thread_members t on t.thread_id = m.thread_id and t.member_id = auth.uid()
      where m.created_at > t.last_read_at and m.sender_id <> auth.uid()),
    (select count(*) from hr_notifications where member_id = auth.uid() and read_at is null),
    (select count(*) from hr_intros where target_id = auth.uid() and status = 'pending');
$$;

-- Who is actually answering things. Anonymous replies are left out on
-- purpose: the leaderboard is for credit, and anonymity forgoes it.
create or replace function hr_top_answerers(p_limit integer default 6)
returns table (handle citext, name text, answers bigint, points bigint)
language sql stable security definer set search_path = public as $$
  select m.handle, m.name, count(*) as answers, sum(c.points)::bigint as points
    from hr_comments c
    join hr_members m on m.id = c.author_id
   where not c.deleted and not c.anonymous and c.created_at > now() - interval '30 days'
   group by m.handle, m.name
   order by points desc, answers desc
   limit p_limit;
$$;

-- Everything a member may need to look up, in one round trip.
create or replace function hr_search(p_query text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare needle text; out jsonb;
begin
  if not hr_is_member() then raise exception 'members only'; end if;
  if length(coalesce(trim(p_query), '')) = 0 then return '{}'::jsonb; end if;
  needle := '%' || trim(p_query) || '%';

  select jsonb_build_object(
    'posts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, title, kind, category, points, comment_count, shown_author, anonymous
          from hr_posts
         where title ilike needle or body ilike needle
            or exists (select 1 from unnest(tags) t where t ilike needle)
         order by points desc limit 8) x),
    'members', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select handle, name, headline, org, location from hr_members
          where handle ilike needle or name ilike needle or headline ilike needle
             or bio ilike needle or org ilike needle or working_on ilike needle
             or ask_me_about ilike needle
          order by karma desc limit 8) x),
    'orgs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select slug, name, tagline, kind, location from hr_orgs
         where name ilike needle or tagline ilike needle or description ilike needle
            or exists (select 1 from unnest(tags) t where t ilike needle)
         limit 8) x),
    'funders', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select slug, name, kind, avg_rating, review_count from hr_funder_stats
          where name ilike needle or focus ilike needle or description ilike needle
          limit 8) x),
    'deals', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select slug, vendor, title, worth from hr_deals
          where active and (vendor ilike needle or title ilike needle or summary ilike needle)
          limit 8) x),
    'library', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select slug, title, kind, summary from hr_library
          where title ilike needle or summary ilike needle or body ilike needle
          limit 8) x)
  ) into out;
  return out;
end $$;

-- Only members may call these; the anon role gets nothing.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'hr\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
