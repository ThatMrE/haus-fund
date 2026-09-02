#!/usr/bin/env node
/**
 * Check the front door against the real Airtable, before anyone tries it.
 *
 *   # One address — "why can't this person sign in?"
 *   HOMEROOM_ROSTER_TOKEN=pat... node scripts/check-roster.js someone@example.org
 *
 *   # The whole table — what the gate will do to all 141 people
 *   HOMEROOM_ROSTER_TOKEN=pat... node scripts/check-roster.js --audit
 *
 *   # Same, with addresses shown, for working the conflicts locally
 *   HOMEROOM_ROSTER_TOKEN=pat... node scripts/check-roster.js --audit --emails
 *
 * WHY THIS EXISTS. The gate is the one part of Homeroom whose failure is
 * invisible until a cohort is standing outside it. This runs the *same*
 * `evaluate()` the live gate runs — imported, not reimplemented, so the two
 * cannot drift — over the real table, and prints what would happen. Run it once
 * before switching the mode to `roster` and the surprises happen on your
 * terminal rather than on somebody's first day.
 *
 * The audit reads the whole People table, so it prints nothing but names,
 * statuses and (opt-in) addresses. It writes nothing, to Airtable or to the
 * Homeroom database.
 */

import { evaluate, maskEmail, token } from '../app/roster.js';

const BASE = process.env.HOMEROOM_ROSTER_BASE || 'app9STfjol4NHGEWj';
const TABLE = process.env.HOMEROOM_ROSTER_TABLE || 'tblC1nB717HfTDEaa';

const FIELDS = [
  'First Name', 'Last Name', 'Email', 'Additional Email', 'Personal Email',
  'Status', 'Lifecycle Status (Computed)', 'Resident type',
];

const args = process.argv.slice(2);
const showEmails = args.includes('--emails');
const audit = args.includes('--audit');
const target = args.find((a) => !a.startsWith('--'));

const BOLD = '[1m';
const DIM = '[2m';
const OFF = '[0m';
const COLOUR = { allow: '[32m', deny: '[31m', review: '[33m' };

function tag(verdict) {
  return `${COLOUR[verdict] || ''}${verdict.toUpperCase().padEnd(6)}${OFF}`;
}

async function page(offset) {
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  url.searchParams.set('pageSize', '100');
  if (offset) url.searchParams.set('offset', offset);
  for (const field of FIELDS) url.searchParams.append('fields[]', field);

  const res = await fetch(url, { headers: { authorization: `Bearer ${token()}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable returned ${res.status}. ${hint(res.status)}\n${body.slice(0, 300)}`);
  }
  return res.json();
}

function hint(status) {
  if (status === 401) return 'The token is not valid.';
  if (status === 403) return `Usually means the token has no access to base ${BASE} — Airtable PATs are scoped per base, so check the base list on the token. If you are behind a proxy, check the body below first.`;
  if (status === 404) return `Base ${BASE} or table ${TABLE} does not exist under this token.`;
  if (status === 422) return 'A field name in FIELDS does not exist on the table.';
  return '';
}

function addressesOf(fields) {
  return ['Email', 'Additional Email', 'Personal Email']
    .map((key) => String(fields[key] || '').trim().toLowerCase())
    .filter(Boolean);
}

const show = (address) => (showEmails ? address : maskEmail(address));

/* ------------------------------------------------------------- one person */

async function checkOne(address) {
  const wanted = address.trim().toLowerCase();
  let offset;
  const hits = [];
  do {
    const data = await page(offset);
    for (const record of data.records || []) {
      if (addressesOf(record.fields).includes(wanted)) hits.push(record);
    }
    offset = data.offset;
  } while (offset);

  if (!hits.length) {
    console.log(`\n${tag('deny')} ${wanted}`);
    console.log(`${DIM}Not on the roster under any of Email, Additional Email or Personal Email.`);
    console.log(`They would see the "Residents only" page. If they are a resident, they applied`);
    console.log(`with a different address — search Airtable by name to find which.${OFF}\n`);
    return;
  }

  console.log(`\n${BOLD}${wanted}${OFF} — ${hits.length} record${hits.length === 1 ? '' : 's'}\n`);
  for (const record of hits) {
    const { verdict, reason, person } = evaluate(record.fields);
    console.log(`  ${tag(verdict)} ${person.name || '(no name)'}  ${DIM}${reason}${OFF}`);
    console.log(`         ${DIM}status ${person.status || '—'} · lifecycle ${person.lifecycle || '—'}`
      + ` · ${person.residentType || 'no resident type'} · ${record.id}${OFF}`);
  }
  const best = hits.map((r) => evaluate(r.fields))
    .sort((a, b) => ({ allow: 0, review: 1, deny: 2 })[a.verdict] - ({ allow: 0, review: 1, deny: 2 })[b.verdict])[0];
  console.log(`\n  ${BOLD}The gate would say: ${tag(best.verdict).trim()}${OFF}`
    + `${best.verdict === 'review' ? `  ${DIM}(held for a steward, no account created)${OFF}` : ''}\n`);
}

/* ---------------------------------------------------------------- the lot */

async function auditAll() {
  const counts = { allow: 0, deny: 0, review: 0 };
  const reasons = new Map();
  const conflicts = [];
  const noAddress = [];
  let total = 0;
  let offset;

  do {
    const data = await page(offset);
    for (const record of data.records || []) {
      total++;
      const { verdict, reason, person } = evaluate(record.fields);
      counts[verdict]++;
      reasons.set(reason, (reasons.get(reason) || 0) + 1);

      const addresses = addressesOf(record.fields);
      if (verdict === 'review') conflicts.push({ record, person, reason, addresses });
      // Someone the gate would let in who has no address on file cannot sign up
      // at all, and would never appear in the review queue either — a silent
      // lockout, and the reason this check exists.
      if (verdict === 'allow' && !addresses.length) noAddress.push(person);
    }
    offset = data.offset;
  } while (offset);

  console.log(`\n${BOLD}${total} people on the roster${OFF}\n`);
  console.log(`  ${tag('allow')} ${String(counts.allow).padStart(4)}  can create an account`);
  console.log(`  ${tag('deny')} ${String(counts.deny).padStart(4)}  turned away`);
  console.log(`  ${tag('review')} ${String(counts.review).padStart(4)}  held for a steward\n`);

  console.log(`${DIM}By reason:${OFF}`);
  for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${reason}`);
  }

  if (conflicts.length) {
    console.log(`\n${BOLD}${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} needing a decision${OFF}`);
    console.log(`${DIM}The dates say they lived here; the status says otherwise. Nobody is admitted`);
    console.log(`and nobody is turned away until a steward rules at /homeroom/stewards/access.${OFF}\n`);
    for (const { record, person, addresses } of conflicts) {
      console.log(`  ${BOLD}${person.name || '(no name)'}${OFF}`);
      console.log(`    ${DIM}status ${person.status} · lifecycle ${person.lifecycle}`
        + `${person.residentType ? ` · ${person.residentType}` : ''} · ${record.id}${OFF}`);
      console.log(`    ${DIM}${addresses.map(show).join(', ') || 'no address on file'}${OFF}`);
    }
    if (!showEmails) console.log(`\n${DIM}  Addresses masked. Re-run with --emails to see them.${OFF}`);
  }

  if (noAddress.length) {
    console.log(`\n${BOLD}[31m${noAddress.length} would be allowed but have no email on file${OFF}`);
    console.log(`${DIM}They cannot sign up at all, and will not appear in any queue. Add an address`);
    console.log(`in Airtable before the cohort arrives.${OFF}\n`);
    for (const person of noAddress) {
      console.log(`  ${person.name || '(no name)'} ${DIM}· ${person.status || '—'} · ${person.lifecycle || '—'}${OFF}`);
    }
  }

  console.log('');
}

/* ------------------------------------------------------------------- main */

async function main() {
  if (!token()) {
    console.error('\nHOMEROOM_ROSTER_TOKEN (or AIRTABLE_TOKEN) is not set.\n');
    console.error('Create one at https://airtable.com/create/tokens with:');
    console.error('  scope  data.records:read');
    console.error(`  base   ${BASE}  (the Biopunk base holding People)\n`);
    process.exitCode = 2;
    return;
  }
  if (!audit && !target) {
    console.error('\nUsage:');
    console.error('  check-roster.js <email>          what the gate would do for one person');
    console.error('  check-roster.js --audit          what it would do for everyone');
    console.error('  check-roster.js --audit --emails  ... with addresses shown\n');
    process.exitCode = 2;
    return;
  }

  try {
    if (audit) await auditAll();
    else await checkOne(target);
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exitCode = 1;
  }
}

main();
