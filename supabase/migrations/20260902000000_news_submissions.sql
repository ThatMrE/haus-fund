-- =====================================================================
-- Homeroom → haus.fund/news
--
-- One table plus the policies that make it safe to talk to with nothing but
-- the publishable (anon) key. Everything that matters here is the RLS: the key
-- ships in the function's environment and would ship in a browser bundle if
-- anyone ever moved this client-side, so it must not be able to do anything a
-- stranger should not.
--
--   INSERT  anyone with the key, but only rows that are status = 'pending'
--           and source = 'homeroom'. A submission cannot declare itself
--           published; publishing is a steward's decision, made elsewhere.
--   SELECT  published rows are readable (that is the point of a public feed).
--           Unpublished rows are not readable at all through this key, so one
--           member cannot read another's queued submission.
--   UPDATE  nobody. Review happens with the service-role key, from the news
--           app, never from here.
--   DELETE  nobody.
--
-- Run with:  supabase link --project-ref <ref> && supabase db push
-- =====================================================================

create table if not exists public.news_submissions (
  id             uuid primary key default gen_random_uuid(),

  -- The Homeroom handle. Not a foreign key: Homeroom owns its own accounts and
  -- this table deliberately does not know about them, so the news app never
  -- becomes a second place member identity lives.
  handle         text not null check (char_length(handle) between 1 and 64),

  title          text not null check (char_length(title) between 3 and 300),
  url            text check (url is null or url ~ '^https?://'),
  body           text not null default '' check (char_length(body) <= 20000),
  topic          text not null default 'general'
                 check (topic in ('general','research','funding','launch','policy','community')),

  status         text not null default 'pending'
                 check (status in ('pending','queued','published','rejected')),
  source         text not null default 'homeroom',

  -- Filled in by a steward on review, with the service-role key.
  decline_reason text not null default '',
  reviewed_by    text,
  published_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.news_submissions is
  'Posts sent from Homeroom to the public news feed. Written with the anon key under RLS; reviewed and published with the service-role key.';

create index if not exists news_submissions_handle_idx
  on public.news_submissions (handle, created_at desc);
create index if not exists news_submissions_published_idx
  on public.news_submissions (status, published_at desc);

-- Keep updated_at honest without trusting the caller to send it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists news_submissions_touch on public.news_submissions;
create trigger news_submissions_touch
  before update on public.news_submissions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS ----

alter table public.news_submissions enable row level security;

-- Deny by default: with RLS on and no policy, nothing is permitted. Each policy
-- below opens exactly one door.

drop policy if exists "anon can submit pending" on public.news_submissions;
create policy "anon can submit pending"
  on public.news_submissions
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and source = 'homeroom'
    and published_at is null
    and decline_reason = ''
    and reviewed_by is null
  );

drop policy if exists "published rows are public" on public.news_submissions;
create policy "published rows are public"
  on public.news_submissions
  for select
  to anon, authenticated
  using (status = 'published');

-- No update or delete policy exists, and that is deliberate: review moves a row
-- to 'published' or 'rejected' using the service-role key, which bypasses RLS.
-- Adding an update policy here would let anyone holding the publishable key
-- publish their own submission.

-- --------------------------------------------------------------- notes ----
--
-- A member reading back their own queue: the app calls
-- `?handle=eq.<handle>` and gets only their published rows under these
-- policies, which is why Homeroom keeps its own local receipt in
-- `hr_news_submissions`. Making pending rows readable by handle would let
-- anyone with the key enumerate every member's drafts by guessing handles,
-- and handles are public.
--
-- If you later want members to read their own pending rows, do it by giving
-- Homeroom a Supabase JWT per member and matching on a claim — not by
-- loosening this policy.
