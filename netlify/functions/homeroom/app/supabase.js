/**
 * Supabase — the durable half of Homeroom.
 *
 * WHY IT EXISTS. This was the first thing to leave the container's /tmp, back
 * when the rest of Homeroom still lived there, because losing a row here is not
 * merely annoying but visible to the public: a member publishing to
 * haus.fund/news.
 *
 * It stays separate now that Homeroom's own database is Postgres, for a reason
 * that has nothing to do with durability: this table belongs to the news app,
 * which reads and publishes from it independently. The local row is a receipt,
 * so a member can see the state of their own submission when Supabase is
 * unreachable.
 *
 * NO SDK. The same rule as the rest of this app: zero npm dependencies. Supabase
 * speaks PostgREST over plain HTTPS and `fetch` is built in, so an SDK would buy
 * a bundle and nothing else.
 *
 * KEYS. Only the publishable (anon) key is ever read here, and it is safe to
 * ship precisely because Row Level Security decides what it can do — see
 * supabase/migrations/. The service-role key is never referenced by this file
 * and must never be put in a variable an edge or browser context can read.
 *
 * FAILS SOFT. With no configuration, `configured()` is false and every caller
 * renders "publishing is not configured" rather than throwing. An outage
 * degrades the feature; it never takes down the page.
 */

const TIMEOUT_MS = 8000;

export function supabaseUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

export function supabaseKey() {
  // SUPABASE_ANON_KEY is the older name for the same thing; accept both so a
  // project configured either way works without an edit here.
  return process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
}

export function configured() {
  return !!(supabaseUrl() && supabaseKey());
}

/** The table the news feed reads. Overridable so a staging project can differ. */
export function newsTable() {
  return process.env.SUPABASE_NEWS_TABLE || 'news_submissions';
}

function headers(extra = {}) {
  const key = supabaseKey();
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    accept: 'application/json',
    ...extra,
  };
}

/**
 * One PostgREST call.
 *
 * Every failure mode — not configured, network, timeout, HTTP error, unparseable
 * body — comes back as `{ ok: false, error }` rather than a throw, because every
 * caller is rendering a page and none of them want a stack trace.
 */
async function request(path, { method = 'GET', body = null, prefer = null } = {}) {
  if (!configured()) return { ok: false, error: 'Supabase is not configured.', unconfigured: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
      method,
      headers: headers(prefer ? { prefer } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      const message = parsed?.message || parsed?.error || `Supabase returned ${res.status}.`;
      return { ok: false, error: String(message).slice(0, 400), status: res.status };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Supabase timed out.' : 'Could not reach Supabase.';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call a Postgres function.
 *
 * PostgREST exposes `security definer` functions at /rest/v1/rpc/<name>, which
 * is how a table the anon key cannot touch at all can still be operated on
 * through a handful of narrow, audited entry points. See the invites migration
 * for the pattern, and why it is worth the indirection.
 */
export async function rpc(name, args = {}) {
  return request(`rpc/${name}`, { method: 'POST', body: args });
}

/**
 * Send a member's post to the public feed.
 *
 * `status` is fixed at 'pending' here and NOT taken from the caller: the RLS
 * policy also pins it, but sending it from the app makes the intent legible at
 * the call site. Publishing is a decision a steward makes in the news app, not
 * something a submission can assert about itself.
 */
export async function submitToNews({ handle, title, url = '', body = '', topic = 'general' }) {
  return request(newsTable(), {
    method: 'POST',
    prefer: 'return=representation',
    body: [{
      handle,
      title: String(title).slice(0, 300),
      url: url || null,
      body: String(body || '').slice(0, 20_000),
      topic,
      status: 'pending',
      source: 'homeroom',
    }],
  });
}

/** A member's own submissions, newest first. RLS scopes this to their handle. */
export async function mySubmissions(handle, { limit = 30 } = {}) {
  const query = new URLSearchParams({
    handle: `eq.${handle}`,
    select: 'id,title,url,topic,status,created_at,published_at,decline_reason',
    order: 'created_at.desc',
    limit: String(limit),
  });
  return request(`${newsTable()}?${query}`);
}

/** What has actually gone live, for the "published from Homeroom" rail. */
export async function publishedFromHomeroom({ limit = 10 } = {}) {
  const query = new URLSearchParams({
    status: 'eq.published',
    source: 'eq.homeroom',
    select: 'id,handle,title,url,topic,published_at',
    order: 'published_at.desc',
    limit: String(limit),
  });
  return request(`${newsTable()}?${query}`);
}

/** Cheap reachability probe for /homeroom/health. Never throws. */
export async function health() {
  if (!configured()) return { configured: false, reachable: false };
  const result = await request(`${newsTable()}?select=id&limit=1`);
  return { configured: true, reachable: result.ok, error: result.ok ? undefined : result.error };
}
