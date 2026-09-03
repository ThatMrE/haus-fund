/**
 * The front door.
 *
 * `roster.js` knows how to ask Airtable a question. This module decides what to
 * do with the answer, and it is deliberately separate because the two callers
 * want opposite things from a failure:
 *
 *   Signup fails CLOSED. If the roster cannot be reached we do not know whether
 *   this person belongs here, and creating an account on a guess is how a
 *   members-only room stops being one. The member sees "try again shortly",
 *   which is true, rather than "you are not a resident", which might not be.
 *
 *   Login fails OPEN. Someone already has an account; the roster said yes at
 *   least once. An Airtable outage must not lock the whole house out of its own
 *   forum. Only a definite, fresh "no longer eligible" revokes access.
 *
 * That asymmetry is the entire point of this file, and it is the thing to keep
 * if anything here is ever rewritten.
 */

import * as roster from './roster.js';
import * as hr from './models.js';
import { nowSeconds } from './util.js';

/**
 * What we currently believe about an address.
 *
 * Consults, in order: the always-allow list, a steward's explicit decision, a
 * fresh cached verdict, then Airtable. Records whatever it learns.
 *
 * @returns {{verdict: 'allow'|'deny'|'review'|'error'|'open'|'closed',
 *            reason: string, person?: object, error?: string, stale?: boolean}}
 */
export async function assess(email) {
  const address = roster.normalizeEmail(email);
  const mode = roster.accessMode();

  if (roster.alwaysAllow().has(address)) {
    return { verdict: 'allow', reason: 'allowlist', person: {} };
  }
  if (mode === 'open') return { verdict: 'open', reason: 'open-signup', person: {} };
  if (mode === 'closed') return { verdict: 'closed', reason: 'signup-closed' };

  const hash = roster.emailHash(address);
  const cached = await hr.rosterRow(hash);

  // A steward who has ruled on a conflict outranks the rule until they change
  // their mind. Re-deriving it from Airtable every week would undo their work.
  if (cached?.decision) {
    return {
      verdict: cached.decision,
      reason: `steward-${cached.decision}`,
      person: personFrom(cached),
    };
  }

  const fresh = cached && cached.checked_at > nowSeconds() - roster.verdictTtl();
  if (fresh && cached.verdict !== 'error') {
    return { verdict: cached.verdict, reason: cached.reason, person: personFrom(cached) };
  }

  const result = await roster.lookup(address);
  if (!result.ok) {
    // Keep the last thing we knew, marked stale, so the caller can decide.
    if (cached && cached.verdict !== 'error') {
      return {
        verdict: cached.verdict, reason: cached.reason,
        person: personFrom(cached), stale: true, error: result.error,
      };
    }
    return { verdict: 'error', reason: 'roster-unreachable', error: result.error };
  }

  await hr.recordVerdict({
    hash,
    masked: roster.maskEmail(address),
    verdict: result.verdict,
    reason: result.reason,
    person: result.person || {},
  });
  return { verdict: result.verdict, reason: result.reason, person: result.person || {} };
}

function personFrom(row) {
  return {
    name: row.name, cohort: row.cohort, house: row.house,
    status: row.status, lifecycle: row.lifecycle, residentType: row.resident_type,
  };
}

/** Signup policy: only a definite yes opens the door. */
export function signupAllowed(assessment) {
  return assessment.verdict === 'allow' || assessment.verdict === 'open';
}

/**
 * Login policy: only a definite, fresh no closes it.
 *
 * `stale` is the flag that makes this safe — a cached verdict we could not
 * re-confirm never revokes, because the reason we could not re-confirm it is
 * far more likely to be Airtable than the member.
 */
export function loginAllowed(assessment) {
  if (assessment.verdict === 'error') return true;
  if (assessment.stale) return true;
  return assessment.verdict !== 'deny';
}

/** Attach the account to its roster row, and remember what let them in. */
export async function bindAccount({ email, userId, assessment }) {
  await hr.setUserRoster(userId, `${assessment.verdict}:${assessment.reason}`.slice(0, 120));
  if (roster.configured()) await hr.linkRosterUser(roster.emailHash(email), userId);
}

/**
 * Prefill what the roster already knows, so a new member's first screen is not
 * an empty form. Never overwrites something they have already typed.
 */
export async function seedProfile(userId, person = {}) {
  if (!person || (!person.name && !person.cohort && !person.house)) return;
  const member = await hr.ensureMember(userId);
  const patch = {};
  if (person.name && !member.name) patch.name = person.name;
  if (person.cohort && !member.cohort) patch.cohort = person.cohort;
  if (Object.keys(patch).length) await hr.updateMember(userId, patch);
  if (person.cohort || person.house) {
    const entry = await hr.getYearbook(userId) || {};
    await hr.upsertYearbook(userId, {
      cohort: entry.cohort || person.cohort || '',
      house: entry.house || person.house || '',
    });
  }
}
