#!/usr/bin/env node
/**
 * Create a Homeroom account in Supabase, and check that it can sign in.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
 *     node scripts/make-supabase-user.js you@example.org --handle you
 *
 *   # ...with a password you choose rather than a generated one
 *   node scripts/make-supabase-user.js you@example.org --password 'five word pass phrase'
 *
 *   # ...or just check an account that already exists
 *   node scripts/make-supabase-user.js you@example.org --check --password '...'
 *
 * WHY A SCRIPT RATHER THAN THE DASHBOARD
 *
 * Both work. This one does the three things the dashboard does not: it puts the
 * Homeroom handle into user_metadata, so the account arrives with the name you
 * chose rather than one derived from the address; it immediately signs in with
 * the password it just set, so a project misconfiguration surfaces here instead
 * of on the login page; and it says plainly whether email confirmation is on,
 * which is the single most common reason a freshly created account cannot sign
 * in yet.
 *
 * It uses only the publishable (anon) key. There is no service-role key here
 * and there should not be: this creates an ordinary account through the same
 * front door a member uses, which is exactly what makes it a useful test.
 */

import { randomBytes } from 'node:crypto';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const OFF = '\x1b[0m';

const args = process.argv.slice(2);
const valueOf = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const email = String(args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
const checkOnly = args.includes('--check');

const URL_BASE = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

const WORDS = [
  'agar', 'amber', 'basalt', 'beacon', 'bramble', 'canyon', 'cedar', 'cinder',
  'cobalt', 'compass', 'copper', 'cortex', 'delta', 'ember', 'fathom', 'ferment',
  'flint', 'granite', 'harbor', 'helix', 'indigo', 'lantern', 'ledger', 'lichen',
  'lumen', 'marrow', 'meadow', 'mortar', 'nectar', 'orchard', 'peptide', 'pigment',
  'plasmid', 'quarry', 'quartz', 'saffron', 'sextant', 'shale', 'signal', 'slate',
  'spindle', 'stanza', 'sundial', 'talon', 'thicket', 'tundra', 'vellum', 'willow',
];

function pick(list) {
  const limit = Math.floor(256 / list.length) * list.length;
  let byte;
  do { byte = randomBytes(1)[0]; } while (byte >= limit);
  return list[byte % list.length];
}

const generate = () => Array.from({ length: 5 }, () => pick(WORDS)).join('-');

async function gotrue(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${URL_BASE}/auth/v1${path}`, {
    method,
    headers: {
      apikey: KEY,
      authorization: `Bearer ${token || KEY}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

const reason = (data) => data.msg || data.error_description || data.message || data.error || JSON.stringify(data);

async function main() {
  if (!URL_BASE || !KEY) {
    console.error(`\n${RED}SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must both be set.${OFF}`);
    console.error(`${DIM}Find them at Supabase -> Project Settings -> API.${OFF}\n`);
    process.exitCode = 2;
    return;
  }
  if (!email || !email.includes('@')) {
    console.error('\nUsage: node scripts/make-supabase-user.js <email> [--handle h] [--password p] [--check]\n');
    process.exitCode = 2;
    return;
  }

  /* ---- what kind of project is this ---- */

  const settings = await gotrue('/settings', { method: 'GET' });
  if (!settings.ok) {
    console.error(`\n${RED}Could not read the project settings (${settings.status}).${OFF}`);
    console.error(`${DIM}${reason(settings.data)}${OFF}`);
    console.error(`${DIM}Check SUPABASE_URL and that the key is the publishable/anon one.${OFF}\n`);
    process.exitCode = 1;
    return;
  }
  const confirmationRequired = !settings.data.mailer_autoconfirm;
  const signupsDisabled = settings.data.disable_signup === true;

  console.log(`\n${BOLD}${URL_BASE}${OFF}`);
  console.log(`  ${DIM}signups${OFF} ${signupsDisabled ? `${RED}disabled${OFF}` : `${GREEN}enabled${OFF}`}`);
  console.log(`  ${DIM}email confirmation${OFF} ${confirmationRequired ? `${YELLOW}required${OFF}` : `${GREEN}not required${OFF}`}`);

  const password = valueOf('--password') || generate();
  const handle = valueOf('--handle') || email.split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 20);

  /* ---- create ---- */

  if (!checkOnly) {
    if (signupsDisabled) {
      console.error(`\n${RED}Signups are disabled on this project, so this cannot create an account.${OFF}`);
      console.error(`${DIM}Turn them on under Authentication -> Sign In / Providers, or create the user`);
      console.error(`in the dashboard and re-run with --check --password '...'.${OFF}\n`);
      process.exitCode = 1;
      return;
    }

    const created = await gotrue('/signup', { body: { email, password, data: { handle } } });
    if (!created.ok) {
      const why = String(reason(created.data)).toLowerCase();
      if (why.includes('already registered')) {
        console.log(`\n${YELLOW}That address already has an account.${OFF}`);
        console.log(`${DIM}Re-run with --check --password '<the existing one>' to test it, or use a`);
        console.log(`different address.${OFF}\n`);
        process.exitCode = 1;
        return;
      }
      console.error(`\n${RED}Signup failed (${created.status}): ${reason(created.data)}${OFF}\n`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n${GREEN}Account created.${OFF}  ${DIM}id ${created.data.user?.id || created.data.id || '?'}${OFF}`);
  }

  /* ---- prove it can actually sign in ---- */

  const signedIn = await gotrue('/token?grant_type=password', { body: { email, password } });

  if (!signedIn.ok) {
    const why = String(reason(signedIn.data)).toLowerCase();
    console.log(`\n${YELLOW}The account exists but cannot sign in yet.${OFF}`);
    console.log(`${DIM}${reason(signedIn.data)}${OFF}`);
    if (why.includes('not confirmed')) {
      console.log(`\n${DIM}This is the usual one. Either click the confirmation link Supabase just`);
      console.log(`emailed, or turn confirmation off for testing:`);
      console.log(`  Authentication -> Sign In / Providers -> Email -> Confirm email = off${OFF}`);
    }
    printCredentials(email, password, handle);
    process.exitCode = 1;
    return;
  }

  console.log(`${GREEN}Signed in successfully.${OFF}`);

  // Leave nothing behind: the token this script minted is no longer needed.
  await gotrue('/logout', { token: signedIn.data.access_token });

  printCredentials(email, password, handle);

  console.log(`${BOLD}Then, on the site:${OFF}\n`);
  console.log('  HOMEROOM_AUTH               supabase');
  console.log(`  SUPABASE_URL                ${URL_BASE}`);
  console.log('  SUPABASE_PUBLISHABLE_KEY    (the same key you just used)\n');
  console.log(`${DIM}Add ${'{site}'}/homeroom/reset to Authentication -> URL Configuration -> Redirect URLs,`);
  console.log(`or the password-reset email will bounce the member back to the site root.${OFF}\n`);
}

function printCredentials(address, password, handle) {
  console.log(`\n${BOLD}Sign in to Homeroom at /homeroom/login with:${OFF}\n`);
  console.log(`  email     ${address}`);
  console.log(`  password  ${YELLOW}${password}${OFF}`);
  console.log(`  handle    ${DIM}${handle}${OFF}\n`);
}

main().catch((err) => {
  console.error(`\n${RED}${err?.message || err}${OFF}\n`);
  process.exitCode = 1;
});
