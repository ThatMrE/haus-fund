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
import { normalize } from '../app/mentorfields.js';

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

  const db = await getDb();
  let imported = 0;
  db.exec('BEGIN');
  try {
    for (const mentor of mentors) {
      await hr.upsertMentor(mentor);
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
    removed = (await db.prepare("DELETE FROM hr_mentors WHERE source = 'seed'").run()).changes;
  }

  const total = (await db.prepare('SELECT COUNT(*) AS n FROM hr_mentors').get()).n;
  console.log(`Imported ${imported} mentors${removed ? `, removed ${removed} sample rows` : ''}. ${total} in the roster.`);
  if (!has('--replace-seed')) {
    console.log('Sample mentors are still present. Re-run with --replace-seed to drop them,');
    console.log('and set HOMEROOM_SEED=off so a cold container does not put them back.');
  }
}

await main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
