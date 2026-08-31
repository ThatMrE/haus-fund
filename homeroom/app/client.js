// Supabase client and session handling for Homeroom.

import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

// The client library is loaded at runtime rather than statically imported, so
// a CDN that is blocked, slow or down produces a page that says so instead of
// a blank one. Everything else in Homeroom is served from this domain.
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const configured = isConfigured();

async function connect() {
  if (!configured) return null;
  try {
    const { createClient } = await import(CDN);
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (error) {
    console.error('Homeroom could not load its client library', error);
    document.body.innerHTML = offlinePage();
    return null;
  }
}

export const supabase = await connect();

let cachedMember = null;

export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/** The signed-in member's Homeroom profile, or null. Cached per page load. */
export async function currentMember({ refresh = false } = {}) {
  if (!supabase) return null;
  if (cachedMember && !refresh) return cachedMember;
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase.from('hr_members').select('*').eq('id', user.id).maybeSingle();
  cachedMember = data ?? null;
  return cachedMember;
}

/**
 * Gate every members-only page. Returns the member, or sends the visitor
 * somewhere sensible and never resolves — signed out to the login page,
 * signed in but with no profile yet to the handle step of signup.
 */
export async function requireMember() {
  if (!configured) {
    document.body.innerHTML = notConfiguredPage();
    await new Promise(() => {});
  }
  const user = await currentUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/homeroom/login.html?next=${next}`);
    await new Promise(() => {});
  }
  const member = await currentMember();
  if (!member) {
    location.replace('/homeroom/signup.html?step=handle');
    await new Promise(() => {});
  }
  // Best effort; a failed presence ping should never block a page.
  supabase.from('hr_members').update({ last_seen_at: new Date().toISOString() })
    .eq('id', member.id).then(() => {}, () => {});
  return member;
}

export async function signOut() {
  cachedMember = null;
  if (supabase) await supabase.auth.signOut();
  location.href = '/homeroom/login.html';
}

function offlinePage() {
  return `<main class="authpage"><div class="authcard">
    <div class="authmark"><img src="/assets/logo-mark.svg" alt="Haus"><span>Homeroom</span></div>
    <h1>Cannot reach the network</h1>
    <p class="lede">Homeroom loads its database client from a public CDN, and that request did not
      get through. A blocked network, an offline connection or an outage will all do it.</p>
    <p class="sm">Try again in a moment. If it keeps happening on a network you control, allow
      <code>cdn.jsdelivr.net</code>.</p>
    <p style="margin-top:20px"><a class="btn ghost" href="/">Back to Haus</a></p>
  </div></main>`;
}

function notConfiguredPage() {
  return `<main class="authpage"><div class="authcard">
    <div class="authmark"><img src="/assets/logo-mark.svg" alt="Haus"><span>Homeroom</span></div>
    <h1>Not connected yet</h1>
    <p class="lede">Homeroom needs a Supabase project before it can let anyone in.</p>
    <ol class="prose" style="padding-left:18px">
      <li>Create a project at supabase.com.</li>
      <li>Run <code>homeroom/supabase/schema.sql</code> in the SQL editor.</li>
      <li>Put the project URL and anon key into <code>homeroom/app/config.js</code>.</li>
    </ol>
    <p class="sm" style="margin-top:18px">The full walkthrough is in <code>homeroom/README.md</code>.</p>
  </div></main>`;
}
