/*
 * The real-data seeder.
 *
 * The claim worth testing is a negative one: that it loads the researched
 * reference data and creates *no* invented content. A regression here would
 * put ten sample accounts with a documented password into production and look
 * exactly like success.
 */

process.env.HOMEROOM_DB = ':memory:';
process.env.HOMEROOM_SECRET = 'test-secret';

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../app/db.js';
import * as hr from '../app/models.js';
import { seedReal, SYSTEM_HANDLE } from '../app/seed-real.js';
import { PERKS } from '../app/data/perks.js';
import { FUNDERS as CAPITAL_MAP } from '../app/data/funders.js';
import { ATLAS_LABS } from '../app/data/atlas.js';
import { NETWORK_MENTORS } from '../app/data/network.js';
import { LIBRARY_MODULES } from '../app/data/curriculum.js';
import { PERK_CATEGORIES } from '../app/data/perks.js';
import { verifyPassword } from '../app/auth.js';

getDb();
const count = (table) => getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('it loads every researched data set', () => {
  seedReal();
  assert.equal(count('hr_deals'), PERKS.length);
  assert.equal(count('hr_funders'), CAPITAL_MAP.length);
  assert.equal(count('hr_atlas'), ATLAS_LABS.length);
  assert.equal(count('hr_mentors'), NETWORK_MENTORS.length);
  assert.equal(count('hr_modules'), LIBRARY_MODULES.length);
});

test('and creates nothing invented', () => {
  // The whole point. Each of these would be fabricated content next to real
  // content, which is the one thing this seeder exists to avoid.
  for (const table of ['hr_orgs', 'hr_jobs', 'hr_events',
    'hr_slots', 'hr_library', 'hr_yearbook', 'hr_signatures',
    'hr_funder_reviews', 'hr_pipeline', 'hr_intros', 'hr_messages']) {
    assert.equal(count(table), 0, `${table} should be empty`);
  }
});

test('the only account is the house, and it cannot be signed into', () => {
  assert.equal(count('users'), 1);
  const house = hr.getUser(SYSTEM_HANDLE);
  assert.ok(house, 'the house account owns the reference rows');
  assert.equal(house.is_admin, 0, 'a byline is not a steward');
  // Its password is random and discarded at creation, so no known string opens it.
  for (const guess of ['', 'password', 'homeroom-sample-pass', SYSTEM_HANDLE]) {
    assert.equal(verifyPassword(guess, house.password_hash), false);
  }
});

test('no funder ships with a rating', () => {
  assert.equal(count('hr_funder_reviews'), 0);
  for (const funder of hr.listFunders({ limit: 500 }).funders) {
    assert.equal(funder.review_count, 0, `${funder.name} should have no seeded reviews`);
  }
});

test('re-running refreshes rather than duplicating', () => {
  const before = { deals: count('hr_deals'), funders: count('hr_funders'), labs: count('hr_atlas') };
  seedReal();
  seedReal();
  assert.deepEqual(
    { deals: count('hr_deals'), funders: count('hr_funders'), labs: count('hr_atlas') },
    before,
  );
});

test('a steward-entered perk code survives a refresh', () => {
  const { deals } = hr.listDeals({ limit: 5 });
  hr.setDealCode(deals[0].id, 'REAL-CODE-FROM-A-PARTNER');
  seedReal();
  assert.equal(hr.getDeal(deals[0].slug).code, 'REAL-CODE-FROM-A-PARTNER',
    'refreshing the catalogue must not wipe a code a steward pasted in');
});

test('every perk category has something in it', () => {
  const used = new Set(PERKS.map((p) => p.category));
  for (const category of PERK_CATEGORIES) {
    assert.ok(used.has(category.slug), `${category.slug} is declared but empty`);
  }
});
