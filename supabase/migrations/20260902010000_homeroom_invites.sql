-- =====================================================================
-- Homeroom onboarding: invites
--
-- WHY THIS IS IN SUPABASE AND NOT IN HOMEROOM'S OWN DATABASE
--
-- Homeroom's SQLite file lives on the function container's /tmp. An invite
-- minted on one container is invisible to the next, so an invite stored there
-- works only if the person happens to click it while the same container is
-- still warm. That is not an invite; it is a coin flip. Invites are the one
-- piece of onboarding state that MUST outlive a container, so they live here.
--
-- WHAT THE ANON KEY CAN DO WITH THIS TABLE: nothing, directly.
--
-- The publishable key ships in the function environment and should be assumed
-- semi-public. A table of pending invites is a list of resident email addresses
-- plus, if tokens were stored in the clear, a set of working keys to the room.
-- So this table has RLS on and NO policies at all — `anon` cannot select,
-- insert, update or delete a single row.
--
-- Every operation goes through a `security definer` function instead, and each
-- one is deliberately narrow:
--
--   homeroom_invite_peek(hash)      one row, and only if you already know its
--                                   token hash. Knowing the hash IS the
--                                   credential, so no secret is required — but
--                                   you cannot enumerate, only look up.
--   homeroom_invite_redeem(hash, …) the same, plus an atomic state change.
--                                   Atomic because two people clicking one link
--                                   at once must not both get in.
--   homeroom_invite_create(secret,…) minting an invite is admission to a
--   homeroom_invite_list(secret, …)  members-only room, and reading the list is
--   homeroom_invite_revoke(secret,…) reading resident addresses. All three
--                                   require HOMEROOM_INVITE_SECRET, so holding
--                                   the anon key alone is not enough.
--
-- THE TOKEN IS NEVER STORED. Only its SHA-256. A full dump of this table yields
-- no usable invite link, which is the property that makes it safe to keep the
-- email address alongside.
--
-- Run with:  supabase link --project-ref <ref> && supabase db push
-- =====================================================================

create table if not exists public.homeroom_invites (
  id             uuid primary key default gen_random_uuid(),

  -- SHA-256 of the invite token, hex. Unique so a collision is a constraint
  -- error rather than two invites quietly sharing one link.
  token_hash     text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),

  email          text not null check (char_length(email) between 3 and 254),

  -- The Homeroom handle of the steward who sent it. Not a foreign key:
  -- Homeroom owns its accounts and this table does not know about them.
  invited_by     text not null check (char_length(invited_by) between 1 and 64),
  note           text not null default '' check (char_length(note) <= 500),

  -- What the Airtable roster said when the invite was made. Recorded so that a
  -- steward overriding a "deny" or a "review" leaves a trail, and so the
  -- redemption path can tell an override from a clean pass.
  roster_verdict text not null default '' check (char_length(roster_verdict) <= 80),

  status         text not null default 'pending'
                 check (status in ('pending', 'redeemed', 'revoked')),

  redeemed_by    text check (redeemed_by is null or char_length(redeemed_by) between 1 and 64),
  redeemed_at    timestamptz,

  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

create index if not exists homeroom_invites_status_idx
  on public.homeroom_invites (status, created_at desc);
create index if not exists homeroom_invites_email_idx
  on public.homeroom_invites (lower(email));

alter table public.homeroom_invites enable row level security;

-- Deliberately no policies. With RLS on and none defined, anon is denied every
-- direct operation, and the functions below are the only way in.

-- ---------------------------------------------------------------------
-- The shared secret that gates the steward-only functions.
--
-- Stored as a database setting rather than baked into the function bodies so
-- rotating it does not need a migration:
--
--   alter database postgres set app.homeroom_invite_secret = '<a long random string>';
--
-- Set the same value as HOMEROOM_INVITE_SECRET in Netlify. If it is unset here,
-- every gated function refuses — closed is the right direction to fail.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_secret_ok(p_secret text)
returns boolean
language plpgsql
stable
as $$
declare
  expected text;
begin
  expected := current_setting('app.homeroom_invite_secret', true);
  if expected is null or expected = '' then
    return false;
  end if;
  -- Length check first so the comparison below is only ever run on equal-length
  -- inputs; not a constant-time compare, but the secret is long and random and
  -- the attacker is rate-limited by the API gateway.
  return length(p_secret) = length(expected) and p_secret = expected;
end;
$$;

revoke all on function public.homeroom_invite_secret_ok(text) from public, anon;

-- ---------------------------------------------------------------------
-- Look up one invite by the hash of its token.
--
-- No secret: possession of the token is the credential, and this returns
-- exactly one row or none. It deliberately returns the email so the join page
-- can show whose invite this is — someone holding the link already knows.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_peek(p_token_hash text)
returns table (
  email          text,
  invited_by     text,
  status         text,
  roster_verdict text,
  expires_at     timestamptz,
  live           boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select i.email,
         i.invited_by,
         i.status,
         i.roster_verdict,
         i.expires_at,
         (i.status = 'pending' and i.expires_at > now()) as live
  from public.homeroom_invites i
  where i.token_hash = p_token_hash;
$$;

revoke all on function public.homeroom_invite_peek(text) from public;
grant execute on function public.homeroom_invite_peek(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Redeem an invite, atomically.
--
-- The UPDATE ... WHERE status = 'pending' is the whole point: two people
-- opening the same link at the same moment both reach this, and exactly one
-- update matches. The loser gets no row back and is told the invite is spent.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_redeem(p_token_hash text, p_handle text)
returns table (
  email          text,
  invited_by     text,
  roster_verdict text
)
language sql
security definer
set search_path = public
as $$
  update public.homeroom_invites i
     set status      = 'redeemed',
         redeemed_by = p_handle,
         redeemed_at = now()
   where i.token_hash = p_token_hash
     and i.status     = 'pending'
     and i.expires_at > now()
  returning i.email, i.invited_by, i.roster_verdict;
$$;

revoke all on function public.homeroom_invite_redeem(text, text) from public;
grant execute on function public.homeroom_invite_redeem(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Mint an invite. Steward-only.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_create(
  p_secret         text,
  p_token_hash     text,
  p_email          text,
  p_invited_by     text,
  p_note           text default '',
  p_roster_verdict text default '',
  p_ttl_days       integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.homeroom_invite_secret_ok(p_secret) then
    raise exception 'not authorised';
  end if;

  -- One live invite per address. Re-inviting someone should replace the old
  -- link rather than leave two working, or revoking the first one achieves
  -- nothing.
  update public.homeroom_invites
     set status = 'revoked'
   where lower(email) = lower(p_email)
     and status = 'pending';

  insert into public.homeroom_invites
    (token_hash, email, invited_by, note, roster_verdict, expires_at)
  values
    (p_token_hash, lower(p_email), p_invited_by, coalesce(p_note, ''),
     coalesce(p_roster_verdict, ''), now() + make_interval(days => greatest(1, p_ttl_days)))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.homeroom_invite_create(text, text, text, text, text, text, integer) from public;
grant execute on function public.homeroom_invite_create(text, text, text, text, text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- The steward's list. Never returns token hashes: nothing a steward does with
-- this page needs one, and a hash in a rendered page is a hash in a log.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_list(p_secret text, p_limit integer default 100)
returns table (
  id             uuid,
  email          text,
  invited_by     text,
  note           text,
  roster_verdict text,
  status         text,
  redeemed_by    text,
  redeemed_at    timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.homeroom_invite_secret_ok(p_secret) then
    raise exception 'not authorised';
  end if;

  return query
    select i.id, i.email, i.invited_by, i.note, i.roster_verdict, i.status,
           i.redeemed_by, i.redeemed_at, i.expires_at, i.created_at
      from public.homeroom_invites i
     order by i.created_at desc
     limit least(greatest(1, p_limit), 500);
end;
$$;

revoke all on function public.homeroom_invite_list(text, integer) from public;
grant execute on function public.homeroom_invite_list(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Revoke one. Only a pending invite can be revoked: a redeemed one is history,
-- and rewriting history here would make the audit trail lie.
-- ---------------------------------------------------------------------

create or replace function public.homeroom_invite_revoke(p_secret text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit integer;
begin
  if not public.homeroom_invite_secret_ok(p_secret) then
    raise exception 'not authorised';
  end if;

  update public.homeroom_invites
     set status = 'revoked'
   where id = p_id and status = 'pending';

  get diagnostics hit = row_count;
  return hit > 0;
end;
$$;

revoke all on function public.homeroom_invite_revoke(text, uuid) from public;
grant execute on function public.homeroom_invite_revoke(text, uuid) to anon, authenticated;
