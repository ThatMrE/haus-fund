#!/usr/bin/env node
/**
 * Replace the sample mentor roster with the real one.
 *
 * The roster shipped in `app/data/mentors.js` is fictional on purpose — see the
 * header of that file. This script is how the real one gets in, from either of
 * the two places it actually lives.
 *
 *   # From the Airtable Mentors table (the source the /api/mentors edge
 *   # function already reads; same base, same fields).
 *   AIRTABLE_TOKEN=pat... node scripts/import-mentors.js --airtable
 *
 *   # From a CSV export of that table, or of anything shaped like it.
 *   node scripts/import-mentors.js --csv mentors.csv
 *
 *   # See what would change without writing.
 *   node scripts/import-mentors.js --csv mentors.csv --dry-run
 *
 * Rows are matched on a slug of the name, so re-running updates in place rather
 * than duplicating. `--replace-seed` additionally deletes anything still marked
 * `source = 'seed'` once the import succeeds, which is the flag to use the
 * first time. It runs after the import, not before, so a failed fetch cannot
 * leave you with no mentors at all.
 *
 * Columns understood, case-insensitively, with the Airtable field names as
 * aliases: name, role/title, org/company, track, tags, location, bio,
 * scheduler/booking/calendly, vetted, expertise/"area of expertise", linkedin.
 */

import { readFileSync } from 'node:fs';
import { getDb, closeDb } from '../app/db.js';
import * as hr from '../app/models.js';
import { MENTOR_TRACKS } from '../app/data/mentors.js';

const AIRTABLE_BASE = process.env.AIRTABLE_MENTORS_BASE || 'appisCTsCCcBCMSk0';
const AIRTABLE_TABLE = process.env.AIRTABLE_MENTORS_TABLE || 'tblwHSlwNLXIfXFX9';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

/* ------------------------------------------------------------------ csv */

/**
 * A CSV reader that handles quotes, embedded commas and embedded newlines.
 *
 * Splitting on commas would corrupt every bio in the file, and a dependency for
 * this would be the only one in the project.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(header.map((key, index) => [key, (cells[index] || '').trim()])));
}

/* -------------------------------------------------------------- mapping */

const TRACK_SLUGS = new Set(MENTOR_TRACKS.map((t) => t.slug));

/**
 * Guess a track from free text.
 *
 * Airtable's "Area of Expertise" is prose, not a slug, so this maps the words
 * people actually write onto the twelve tracks. Anything unrecognised lands in
 * `founder`, which is the correct default for a generalist and is visible in
 * the directory rather than hidden.
 */
function trackFor(value) {
  const text = String(value || '').toLowerCase();
  if (TRACK_SLUGS.has(text)) return text;
  const rules = [
    [/legal|counsel|attorney|patent|\bip\b|licens/, 'legal'],
    [/invest|venture|\bvc\b|fundrais|capital|angel/, 'fundraising'],
    [/customer|commercial|sales|market|business develop|\bbd\b|partnership/, 'commercialization'],
    [/regulat|\bfda\b|quality|clinical|\bgmp\b|\bglp\b|biosafety|compliance/, 'regulatory'],
    [/grant|sbir|sttr|non-?dilutive|nih|nsf/, 'grants'],
    [/manufactur|supply|scale-?up|sourcing|cdmo|\bcmo\b|hardware/, 'manufacturing'],
    [/hiring|recruit|talent|people|\bhr\b/, 'hiring'],
    [/visa|immigration|\bo-?1\b|relocation/, 'immigration'],
    [/brand|media|press|communicat|community|marketing/, 'brand'],
    [/finance|account|\bcfo\b|bookkeep|operations|insurance/, 'ops'],
    [/scien|research|technical|\bphd\b|bio|chem|engineer|comput|\bml\b/, 'technical'],
  ];
  for (const [pattern, slug] of rules) if (pattern.test(text)) return slug;
  return 'founder';
}

const SCHEDULER = /^https?:\/\/(cal\.com|calendly\.com|savvycal\.com|lu\.ma|luma\.com|[\w.-]*zcal\.co)/i;

function normalize(row) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = row[key] ?? row[key.toLowerCase()];
      if (value !== undefined && String(value).trim()) return String(value).trim();
    }
    return '';
  };

  const name = get('name', 'full name', 'mentor');
  if (!name) return null;

  const expertise = get('area of expertise', 'expertise', 'focus');
  const scheduler = get('scheduler', 'booking', 'booking link', 'calendly', 'cal.com', 'calendar');

  return {
    name,
    role: get('role', 'title', 'position'),
    org: get('org', 'organisation', 'organization', 'company', 'firm'),
    track: trackFor(get('track') || expertise),
    tags: get('tags', 'topics', 'skills')
      .split(/[,;|]/).map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean),
    location: get('location', 'city', 'based'),
    bio: get('bio', 'about', 'summary'),
    format: /group/i.test(get('format')) ? 'group' : 'one-on-one',
    // Only accept links that look like a scheduler. A LinkedIn URL in this
    // column would render a "book time" button that goes to a profile page.
    scheduler: SCHEDULER.test(scheduler) ? scheduler : '',
    vetted: /^(1|true|yes|y|vetted)$/i.test(get('vetted', 'approved', 'confirmed')),
    source: 'import',
  };
}

/* ------------------------------------------------------------ airtable */

async function fromAirtable() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN is not set.');

  const rows = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const record of data.records || []) {
      const fields = record.fields || {};
      rows.push({
        name: fields.Name || '',
        role: fields.Role || fields.Title || '',
        org: fields.Organization || fields.Company || '',
        'area of expertise': fields['Area of Expertise'] || '',
        tags: Array.isArray(fields.Tags) ? fields.Tags.join(',') : (fields.Tags || ''),
        location: fields.Location || '',
        bio: fields.Bio || '',
        scheduler: fields.Scheduler || fields.Calendly || fields['Booking Link'] || '',
        vetted: fields.Vetted ? 'yes' : '',
      });
    }
    offset = data.offset;
  } while (offset);
  return rows;
}

/* ----------------------------------------------------------------- run */

async function main() {
  if (!has('--airtable') && !has('--csv')) {
    console.error('Usage: import-mentors.js (--airtable | --csv <file>) [--dry-run] [--replace-seed]');
    process.exitCode = 2;
    return;
  }

  const raw = has('--airtable')
    ? await fromAirtable()
    : parseCsv(readFileSync(valueOf('--csv'), 'utf8'));

  const mentors = raw.map(normalize).filter(Boolean);
  if (!mentors.length) {
    console.error('No usable rows — every row needs at least a name.');
    process.exitCode = 1;
    return;
  }

  if (has('--dry-run')) {
    console.log(`${mentors.length} mentors would be imported:`);
    for (const mentor of mentors.slice(0, 10)) {
      console.log(`  ${mentor.vetted ? '✓' : ' '} ${mentor.name} — ${mentor.track} — ${mentor.org || 'independent'}`);
    }
    if (mentors.length > 10) console.log(`  … and ${mentors.length - 10} more`);
    const byTrack = {};
    for (const mentor of mentors) byTrack[mentor.track] = (byTrack[mentor.track] || 0) + 1;
    console.log('By track:', byTrack);
    return;
  }

  const db = getDb();
  let imported = 0;
  db.exec('BEGIN');
  try {
    for (const mentor of mentors) {
      hr.upsertMentor(mentor);
      imported++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Only after a clean import: dropping the sample roster first would leave an
  // empty directory if the fetch or the write failed.
  let removed = 0;
  if (has('--replace-seed')) {
    removed = db.prepare("DELETE FROM hr_mentors WHERE source = 'seed'").run().changes;
  }

  const total = db.prepare('SELECT COUNT(*) AS n FROM hr_mentors').get().n;
  console.log(`Imported ${imported} mentors${removed ? `, removed ${removed} sample rows` : ''}. ${total} in the roster.`);
  if (!has('--replace-seed')) {
    console.log('Sample mentors are still present. Re-run with --replace-seed to drop them,');
    console.log('and set HOMEROOM_SEED=off so a cold container does not put them back.');
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
