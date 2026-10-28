/**
 * The connector's own LinkedIn network, as a place to find people.
 *
 * A second source for the intro engine, next to Happenstance. It changes
 * nothing downstream: a person found here becomes an ordinary request, goes
 * through the same steward gate, the same three buttons, the same member view.
 * See docs/INTRO-ENGINE.md §20.8.
 *
 * What the export is, because every choice below follows from it:
 *
 *   - Name, company, position and the date connected. No LinkedIn ID, no
 *     profile URL. So a person's key is a hash of their normalised name and
 *     company — stable across re-imports, and nothing else is available.
 *   - An email address for about 2% of rows: only the connections who opted
 *     in. Those are encrypted on the way in and only ever decrypted onto a
 *     steward's compose field. For everybody else a steward supplies the
 *     address, exactly as for a Happenstance result.
 *   - Titles from the day they connected, often years ago. The member is told.
 *
 * Searching it is free and local, so it is the first thing a member's search
 * box does. Happenstance becomes the explicit second step.
 */

import { createHash } from 'node:crypto';
import * as sql from './db.js';
import * as intro from './introengine.js';
import { nowSeconds } from './util.js';

/* ------------------------------------------------------------------ parse */

/**
 * RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside
 * quotes. LinkedIn's export is well-formed, but a position like
 * "Founder, CEO" is common and a naive split would shift every column after it.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "04 May 2023" → "2023-05-04". Anything else → ''. */
export function isoDate(value) {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(String(value || '').trim());
  if (!m) return '';
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return '';
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const squash = (value) => String(value || '').replace(/\s+/g, ' ').trim();

/** Drop the legal suffix, so "Ginkgo Bioworks, Inc." and "Ginkgo Bioworks" are one company. */
export function normaliseCompany(value) {
  return squash(value)
    .replace(/[,\s]+(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|gmbh|plc|pbc|s\.a|b\.v)\.?$/i, '')
    .trim();
}

/** The key. Case, spacing and a company's legal suffix do not change who somebody is. */
export function personHash(name, company) {
  const key = `li:${squash(name).toLowerCase()}|${normaliseCompany(company).toLowerCase()}`;
  return createHash('sha256').update(key).digest('hex');
}

/*
 * Tracks from keyword rules, not a model. Cheap, explainable, and good enough
 * to make "someone who has done GRAS" find a Regulatory Affairs Director.
 * Word boundaries matter: "director" contains "cto".
 */
const TRACKS = [
  ['regulatory', /regulat|\bgras\b|\bfda\b|compliance|quality assurance|\bqa\b|food safety|\bqc\b/],
  ['manufacturing', /manufactur|scale-?up|process dev|ferment|bioprocess|\bcdmo\b|\bcmo\b|supply chain|production/],
  ['investor', /invest|venture|\bvc\b|\bangel\b|general partner|managing partner|limited partner|principal at|\bfund\b/],
  ['academic', /professor|\bphd\b|ph\.d|postdoc|lecturer|faculty|\bdean\b|graduate student|research fellow/],
  ['founder', /founder|\bceo\b|chief executive/],
  ['legal', /attorney|lawyer|counsel|\blegal\b|patent|\bip\b|paralegal/],
  ['science', /scientist|biolog|chemist|\br&d\b|research|bioinformatic|microbiolog/],
  ['engineering', /engineer|\bcto\b|chief technology|developer|software/],
  ['operator', /chief operating|\bcoo\b|operations|general manager/],
];

export const TRACK_NAMES = TRACKS.map(([name]) => name);

export function tracksFor(position, company = '') {
  const p = String(position || '').toLowerCase();
  const out = TRACKS.filter(([, re]) => re.test(p)).map(([name]) => name);
  // A firm's name says investor more reliably than a title like "Partner".
  if (!out.includes('investor') && /\b(capital|ventures|vc)\b/i.test(company)) out.push('investor');
  if (!out.includes('academic') && /universit|college|institute of technology/i.test(company)) out.push('academic');
  return out;
}

/**
 * The export, as clean rows. Pure: no database, so the rules can be tested
 * against a fixture without an import.
 *
 * LinkedIn puts a "Notes:" preamble above the header, so the header is found
 * rather than assumed to be line one.
 */
export function readExport(text) {
  const rows = parseCsv(text);
  const at = rows.findIndex((r) => squash(r[0]).toLowerCase() === 'first name');
  if (at === -1) return { ok: false, error: 'That does not look like a LinkedIn connections export — there is no "First Name" header.' };

  const header = rows[at].map((h) => squash(h).toLowerCase());
  const col = (name) => header.indexOf(name);
  const idx = {
    first: col('first name'), last: col('last name'), email: col('email address'),
    company: col('company'), position: col('position'), connected: col('connected on'),
  };
  if (idx.first < 0 || idx.last < 0 || idx.company < 0 || idx.position < 0) {
    return { ok: false, error: 'The export is missing a column it needs: First Name, Last Name, Company or Position.' };
  }

  const people = new Map();
  let noName = 0;
  let duplicate = 0;
  for (const r of rows.slice(at + 1)) {
    if (!r.length || (r.length === 1 && !r[0].trim())) continue;
    const name = squash(`${r[idx.first] || ''} ${r[idx.last] || ''}`);
    if (!name) { noName++; continue; }
    const company = normaliseCompany(r[idx.company]);
    const position = squash(r[idx.position]);
    const rawEmail = idx.email >= 0 ? squash(r[idx.email]).toLowerCase() : '';
    const hash = personHash(name, company);
    const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail) ? rawEmail : '';
    // The first row wins — the export lists the original, better-formed one
    // first — but an address on the duplicate is not thrown away.
    if (people.has(hash)) {
      duplicate++;
      const kept = people.get(hash);
      if (!kept.email && email) kept.email = email;
      continue;
    }
    const tracks = tracksFor(position, company);
    people.set(hash, {
      person_hash: hash, name, company, position, tracks,
      email,
      connected_on: idx.connected >= 0 ? isoDate(r[idx.connected]) : '',
      haystack: [name, company, position, tracks.join(' ')].join(' | ').toLowerCase(),
    });
  }
  return { ok: true, people: [...people.values()], noName, duplicate };
}

/* ----------------------------------------------------------------- import */

const CHUNK = 200;

/**
 * Upsert the export. Steward only — the route checks, and the caller passes
 * the steward so the audit trail says who loaded ten thousand people.
 *
 * Suppression is applied here, before a row exists, for the same reason
 * collect() does it for Happenstance: a filter that lives at a call site is
 * the one that is missing from the next endpoint. Search filters again,
 * because somebody can say "never" after the import.
 *
 * Batched multi-row inserts in one transaction: ten thousand single-row
 * round trips would not finish inside a function's time limit on Postgres.
 */
export async function importExport(text, { actor }) {
  if (!actor?.is_admin) return { ok: false, error: 'Only a steward can import the network.' };
  const read = readExport(text);
  if (!read.ok) return read;

  const suppressed = new Set((await sql.all('SELECT person_hash FROM hr_intro_suppression')).map((r) => r.person_hash));
  const keep = read.people.filter((p) => !suppressed.has(p.person_hash));
  if (!keep.length) return { ok: false, error: 'No importable rows in that file.' };

  const now = nowSeconds();
  const batch = Number(await sql.value('SELECT COALESCE(MAX(batch), 0) FROM hr_li_connections')) + 1;

  await sql.tx(async (db) => {
    for (let i = 0; i < keep.length; i += CHUNK) {
      const slice = keep.slice(i, i + CHUNK);
      const values = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = slice.flatMap((p) => [
        p.person_hash, p.name, p.company, p.position, p.tracks.join(','), p.haystack,
        p.connected_on, intro.encryptAddress(p.email), batch, now, now,
      ]);
      // An address already on file survives a re-import that lacks one: the
      // connection may have since hidden it, but a steward was given it once.
      await db.run(`INSERT INTO hr_li_connections
           (person_hash, name, company, position, tracks, haystack, connected_on, email_enc, batch, imported_at, updated_at)
         VALUES ${values}
         ON CONFLICT(person_hash) DO UPDATE SET
           name = excluded.name, company = excluded.company, position = excluded.position,
           tracks = excluded.tracks, haystack = excluded.haystack, connected_on = excluded.connected_on,
           email_enc = CASE WHEN excluded.email_enc <> '' THEN excluded.email_enc ELSE hr_li_connections.email_enc END,
           batch = excluded.batch, updated_at = excluded.updated_at`, params);
    }
  });

  const dropped = Number(await sql.value('SELECT COUNT(*) FROM hr_li_connections WHERE batch < ?', batch));
  const summary = {
    imported: keep.length,
    withEmail: keep.filter((p) => p.email).length,
    suppressed: read.people.length - keep.length,
    noName: read.noName,
    duplicate: read.duplicate,
    dropped,
    batch,
  };
  await intro.logEvent({ actorId: actor.id, actorKind: 'steward', event: 'network-imported',
    detail: `${summary.imported} people, ${summary.withEmail} with an address, ${summary.suppressed} suppressed, batch ${batch}` });
  return { ok: true, ...summary };
}

/* ----------------------------------------------------------------- search */

const LIVE = `batch = (SELECT MAX(batch) FROM hr_li_connections)
  AND person_hash NOT IN (SELECT person_hash FROM hr_intro_suppression)`;

/* Words that match everybody. A member who searched Happenstance with a full
   sentence lands back here with that sentence, and "who has" must not turn
   into ten thousand partial matches. */
const STOPWORDS = new Set(('a an and are at be been but by can do does for from has have help how i in '
  + 'into is it its looking me my need of on or our people person someone somebody that the their them '
  + 'they this to us was we who with you your would like find anyone').split(' '));

const likeTerm = (term) => `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/** What a member may see about a connection. Never the address, in any form. */
export function memberCard(row) {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    position: row.position,
    tracks: String(row.tracks || '').split(',').filter(Boolean),
    connectedYear: String(row.connected_on || '').slice(0, 4),
  };
}

/**
 * Every term must match somewhere; position and track hits rank above a name
 * or company that happens to contain the word. Free and local, so there is no
 * cache and no budget.
 */
export async function search(query, { limit = 30 } = {}) {
  const terms = String(query || '').toLowerCase().split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}&.+-]/gu, '')).filter((t) => t.length >= 2 && !STOPWORDS.has(t)).slice(0, 6);
  if (!terms.length) return { terms, loose: false, people: [], total: 0 };

  const match = (joiner) => sql.all(`SELECT id, name, company, position, tracks, connected_on FROM hr_li_connections
       WHERE ${LIVE} AND (${terms.map(() => "haystack LIKE ? ESCAPE '\\'").join(joiner)}) LIMIT 400`,
  ...terms.map(likeTerm));

  // Every word first. If nobody matches all of them, anyone who matches some,
  // ranked by how many — and the page says so, rather than showing a near
  // miss as if it were an answer.
  let rows = await match(' AND ');
  const loose = !rows.length && terms.length > 1;
  if (loose) rows = await match(' OR ');

  const score = (row) => {
    const position = row.position.toLowerCase();
    const company = row.company.toLowerCase();
    const tracks = row.tracks.toLowerCase();
    return terms.reduce((sum, t) => sum
      + (position.includes(t) ? 3 : 0) + (tracks.includes(t) ? 2 : 0)
      + (company.includes(t) ? 2 : 0) + (row.name.toLowerCase().includes(t) ? 1 : 0), 0);
  };
  rows.sort((a, b) => score(b) - score(a) || String(b.connected_on).localeCompare(String(a.connected_on)));
  return { terms, loose, total: rows.length, people: rows.slice(0, limit).map(memberCard) };
}

/** One live connection, or null if it has been dropped or suppressed. */
export async function getConnection(id) {
  return await sql.get(`SELECT * FROM hr_li_connections WHERE id = ? AND ${LIVE}`, Number(id)) ?? null;
}

/** The shape createRequest() takes. No evidence line: the member's "why them" carries it. */
export function asPerson(row, connector) {
  return {
    person_hash: row.person_hash,
    search_id: null,
    source: 'linkedin',
    name: row.name,
    title: row.position,
    org: row.company,
    summary: '',
    evidence: [],
    through: [connector],
    profile_url: '',
  };
}

/**
 * The address on file for a person, for a steward's compose field only.
 * Returns '' when there is none, which is 98% of the network.
 */
export async function addressFor(personHash) {
  const row = await sql.get('SELECT email_enc FROM hr_li_connections WHERE person_hash = ?', personHash);
  return row ? intro.decryptAddress(row.email_enc) : '';
}

export async function stats() {
  const one = async (q) => Number(await sql.value(q) || 0);
  const batch = await one('SELECT COALESCE(MAX(batch), 0) FROM hr_li_connections');
  const live = await one(`SELECT COUNT(*) FROM hr_li_connections WHERE ${LIVE}`);
  const withEmail = await one(`SELECT COUNT(*) FROM hr_li_connections WHERE ${LIVE} AND email_enc <> ''`);
  const last = await sql.value('SELECT MAX(updated_at) FROM hr_li_connections');
  return { available: live > 0, people: live, withEmail, batch, importedAt: last ? Number(last) : null };
}
