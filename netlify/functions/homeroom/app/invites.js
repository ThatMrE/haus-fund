/**
 * Invites — how a new resident gets in.
 *
 * THE PROBLEM THIS SOLVES
 *
 * `HOMEROOM_ACCESS=closed` is the right production setting: without a roster
 * token, open signup lets anyone who finds the URL create an account. But
 * closed with nothing beside it means the only way to make an account is a
 * steward running a script in a terminal, once per person. That is not an
 * onboarding method; it is a bottleneck with a person in it.
 *
 * An invite is the bridge. A steward asserts eligibility once, at invite time,
 * and the invitee does the rest themselves: choose a handle, set a password,
 * land in the room. The steward's assertion is the authorisation, which is
 * exactly what `closed` was missing.
 *
 * WHERE INVITES LIVE, AND WHY IT MATTERS
 *
 * In Supabase, when it is configured. Homeroom's SQLite file is on the
 * container's /tmp, so an invite minted on one container is invisible to the
 * next — the link would work only if the person clicked it while that same
 * container happened to still be warm. An invite that works by luck is not an
 * invite, so this is the one piece of onboarding state that must be durable.
 *
 * Without Supabase it falls back to a local `hr_invites` table, which is
 * correct for development and honest rather than silent in production: the
 * steward page says plainly that the links will not survive a restart.
 *
 * WHAT REACHES SUPABASE
 *
 * The token never does — only its SHA-256. A full dump of that table yields no
 * working link, which is what makes it safe to keep the invited address next to
 * it. Every operation goes through a `security definer` function; the table
 * itself denies the anon key outright. Minting, listing and revoking need
 * HOMEROOM_INVITE_SECRET on top, so holding the publishable key is not enough
 * to admit yourself to a members-only room. See supabase/migrations/.
 */

import { randomBytes, createHash } from 'node:crypto';
import { getDb } from './db.js';
import { nowSeconds } from './util.js';
import * as supabase from './supabase.js';

/** Two weeks. Long enough to survive a holiday, short enough to expire. */
export const DEFAULT_TTL_DAYS = Number(process.env.HOMEROOM_INVITE_DAYS || 14);

export function secret() {
  return String(process.env.HOMEROOM_INVITE_SECRET || '').trim();
}

/**
 * Whether invites are durable.
 *
 * Both halves are required. Supabase without the secret can still redeem an
 * invite (that path needs no secret) but cannot mint one, which would be a
 * confusing half-state — so the steward page treats it as not configured and
 * says which piece is missing.
 */
export function durable() {
  return supabase.configured() && !!secret();
}

export function backend() {
  if (durable()) return 'supabase';
  if (supabase.configured()) return 'supabase-unconfigured';
  return 'local';
}

/** A token the holder proves possession of. 32 bytes, url-safe. */
export function mintToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** The link a steward sends. */
export function inviteUrl(origin, token) {
  return `${String(origin).replace(/\/+$/, '')}/homeroom/join/${token}`;
}

/* ==========================================================================
 * Supabase, over PostgREST's RPC endpoint
 * ======================================================================== */

async function rpc(name, args) {
  const result = await supabase.rpc(name, args);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

/* ==========================================================================
 * The local fallback
 * ======================================================================== */

function localCreate({ tokenHash, email, invitedBy, note, rosterVerdict, ttlDays }) {
  const db = getDb();
  const now = nowSeconds();
  // Same rule as the Supabase function: re-inviting replaces the live link
  // rather than leaving two that both work.
  db.prepare(`UPDATE hr_invites SET status = 'revoked' WHERE email = ? AND status = 'pending'`)
    .run(email);
  db.prepare(
    `INSERT INTO hr_invites (token_hash, email, invited_by, note, roster_verdict, status,
                             expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(tokenHash, email, invitedBy, note, rosterVerdict, now + Math.max(1, ttlDays) * 86400, now);
  return db.prepare('SELECT id FROM hr_invites WHERE token_hash = ?').get(tokenHash)?.id;
}

function localPeek(tokenHash) {
  const row = getDb().prepare('SELECT * FROM hr_invites WHERE token_hash = ?').get(tokenHash);
  if (!row) return null;
  return {
    email: row.email,
    invitedBy: row.invited_by,
    status: row.status,
    rosterVerdict: row.roster_verdict,
    expiresAt: row.expires_at,
    live: row.status === 'pending' && row.expires_at > nowSeconds(),
  };
}

function localRedeem(tokenHash, handle) {
  const db = getDb();
  // One statement, so two simultaneous redemptions cannot both match.
  const changed = db.prepare(
    `UPDATE hr_invites SET status = 'redeemed', redeemed_by = ?, redeemed_at = ?
      WHERE token_hash = ? AND status = 'pending' AND expires_at > ?`,
  ).run(handle, nowSeconds(), tokenHash, nowSeconds()).changes;
  if (!changed) return null;
  const row = db.prepare('SELECT * FROM hr_invites WHERE token_hash = ?').get(tokenHash);
  return { email: row.email, invitedBy: row.invited_by, rosterVerdict: row.roster_verdict };
}

function localList(limit) {
  return getDb()
    .prepare('SELECT * FROM hr_invites ORDER BY created_at DESC LIMIT ?')
    .all(Math.min(Math.max(1, limit), 500))
    .map(shapeLocal);
}

function shapeLocal(row) {
  return {
    id: String(row.id),
    email: row.email,
    invitedBy: row.invited_by,
    note: row.note,
    rosterVerdict: row.roster_verdict,
    status: row.status,
    redeemedBy: row.redeemed_by,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    expired: row.status === 'pending' && row.expires_at <= nowSeconds(),
  };
}

/* ==========================================================================
 * The API the routes use. Same shape whichever backend answers.
 * ======================================================================== */

/**
 * Mint an invite.
 *
 * Returns the raw token exactly once — it is not stored anywhere and cannot be
 * recovered, so the caller has to put it in front of the steward now or lose it.
 *
 * @returns {{ok: true, token: string, id: string}|{ok: false, error: string}}
 */
export async function create({
  email, invitedBy, note = '', rosterVerdict = '', ttlDays = DEFAULT_TTL_DAYS,
}) {
  const address = normalizeEmail(email);
  if (!address.includes('@')) return { ok: false, error: 'That does not look like an email address.' };

  const token = mintToken();
  const tokenHash = hashToken(token);

  if (durable()) {
    const result = await rpc('homeroom_invite_create', {
      p_secret: secret(),
      p_token_hash: tokenHash,
      p_email: address,
      p_invited_by: invitedBy,
      p_note: String(note).slice(0, 500),
      p_roster_verdict: String(rosterVerdict).slice(0, 80),
      p_ttl_days: ttlDays,
    });
    if (!result.ok) return { ok: false, error: describe(result.error) };
    return { ok: true, token, id: String(result.data ?? ''), durable: true };
  }

  const id = localCreate({
    tokenHash, email: address, invitedBy,
    note: String(note).slice(0, 500),
    rosterVerdict: String(rosterVerdict).slice(0, 80),
    ttlDays,
  });
  return { ok: true, token, id: String(id), durable: false };
}

/** What an invite link points at, without spending it. */
export async function peek(token) {
  const tokenHash = hashToken(token);
  if (durable() || supabase.configured()) {
    const result = await rpc('homeroom_invite_peek', { p_token_hash: tokenHash });
    if (!result.ok) return { ok: false, error: describe(result.error) };
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) return { ok: true, invite: null };
    return {
      ok: true,
      invite: {
        email: row.email,
        invitedBy: row.invited_by,
        status: row.status,
        rosterVerdict: row.roster_verdict,
        expiresAt: row.expires_at,
        live: !!row.live,
      },
    };
  }
  return { ok: true, invite: localPeek(tokenHash) };
}

/**
 * Spend it.
 *
 * Atomic on both backends, because two people opening one link at the same
 * moment must not both get an account. The loser is told the invite is spent
 * rather than handed a second one.
 */
export async function redeem(token, handle) {
  const tokenHash = hashToken(token);
  if (durable() || supabase.configured()) {
    const result = await rpc('homeroom_invite_redeem', { p_token_hash: tokenHash, p_handle: handle });
    if (!result.ok) return { ok: false, error: describe(result.error) };
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) return { ok: true, invite: null };
    return {
      ok: true,
      invite: { email: row.email, invitedBy: row.invited_by, rosterVerdict: row.roster_verdict },
    };
  }
  return { ok: true, invite: localRedeem(tokenHash, handle) };
}

export async function list({ limit = 100 } = {}) {
  if (durable()) {
    const result = await rpc('homeroom_invite_list', { p_secret: secret(), p_limit: limit });
    if (!result.ok) return { ok: false, error: describe(result.error), invites: [] };
    const now = Date.now();
    return {
      ok: true,
      invites: (result.data || []).map((row) => ({
        id: row.id,
        email: row.email,
        invitedBy: row.invited_by,
        note: row.note,
        rosterVerdict: row.roster_verdict,
        status: row.status,
        redeemedBy: row.redeemed_by,
        redeemedAt: row.redeemed_at ? Math.floor(Date.parse(row.redeemed_at) / 1000) : null,
        expiresAt: Math.floor(Date.parse(row.expires_at) / 1000),
        createdAt: Math.floor(Date.parse(row.created_at) / 1000),
        expired: row.status === 'pending' && Date.parse(row.expires_at) <= now,
      })),
    };
  }
  return { ok: true, invites: localList(limit) };
}

export async function revoke(id) {
  if (durable()) {
    const result = await rpc('homeroom_invite_revoke', { p_secret: secret(), p_id: id });
    if (!result.ok) return { ok: false, error: describe(result.error) };
    return { ok: true, revoked: !!result.data };
  }
  const changed = getDb()
    .prepare(`UPDATE hr_invites SET status = 'revoked' WHERE id = ? AND status = 'pending'`)
    .run(Number(id)).changes;
  return { ok: true, revoked: changed > 0 };
}

/**
 * Turn a Postgres error into something a steward can act on.
 *
 * `not authorised` from the RPC means the secret in Netlify and the one in the
 * database disagree, which is by far the most likely misconfiguration and the
 * least obvious from the raw message.
 */
function describe(error) {
  const raw = String(error || '').toLowerCase();
  if (raw.includes('not authorised') || raw.includes('not authorized')) {
    return 'Supabase refused the invite secret. HOMEROOM_INVITE_SECRET here and '
      + 'app.homeroom_invite_secret in the database must match.';
  }
  if (raw.includes('could not find the function') || raw.includes('does not exist')) {
    return 'The invite functions are not in this Supabase project yet. Run the migrations in '
      + 'supabase/migrations/.';
  }
  if (raw.includes('duplicate key')) return 'That invite already exists. Try again.';
  return String(error || 'Supabase rejected the request.').slice(0, 300);
}

/** For /homeroom/health and the steward page. */
export function health() {
  return {
    backend: backend(),
    durable: durable(),
    ...(durable() ? {} : {
      warning: supabase.configured()
        ? 'HOMEROOM_INVITE_SECRET is not set, so invites are stored locally and will not '
          + 'survive a container restart.'
        : 'Supabase is not configured, so invites are stored locally and will not survive a '
          + 'container restart.',
    }),
  };
}
