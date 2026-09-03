/**
 * Supabase Auth (GoTrue) as Homeroom's credential store.
 *
 * WHY THIS EXISTS
 *
 * This was written when Homeroom's database lived on the container's /tmp and a
 * local account lasted about as long as one container. That is no longer the
 * reason to use it: local accounts are durable too now. What Supabase still
 * gives, and this app cannot, is the part of account management that needs a
 * mail server — an actual password-reset email, rather than a link written to a
 * function log.
 *
 * WHAT IT DOES AND DOES NOT OWN
 *
 * Supabase owns credentials: the password, its hashing, the reset tokens, the
 * recovery email. It owns nothing else.
 *
 * Homeroom keeps its own `users` row and its own session cookie, because every
 * table in the schema hangs off `users.id` by foreign key — posts, chat,
 * reviews, progress, bookings. Replacing that identity with a Supabase UUID
 * would be a migration of the whole database rather than a change of login
 * form. So the local row remains the identity, `users.supabase_id` links it to
 * the credential, and a Supabase sign-in is translated into an ordinary
 * Homeroom session on the way through.
 *
 * The access token is deliberately NOT stored or put in a cookie. Nothing in
 * Homeroom talks to Supabase on the member's behalf, so keeping a bearer token
 * around would be a liability with no use. The one operation that needs one —
 * changing a password — re-authenticates with the current password first, which
 * is what you would want that endpoint to do anyway.
 *
 * NO SDK. The REST API is four endpoints and `fetch` reaches all of them; the
 * dependency would be larger than the code.
 */

const TIMEOUT_MS = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS || 8000);

/** `local` (the default) or `supabase`. */
export function mode() {
  return String(process.env.HOMEROOM_AUTH || 'local').trim().toLowerCase();
}

export function url() {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
}

export function anonKey() {
  return String(
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  ).trim();
}

/**
 * Whether Supabase should be handling logins.
 *
 * Both halves matter. `HOMEROOM_AUTH=supabase` with no project configured would
 * take the front door off its hinges — every login failing with a connection
 * error — so an unconfigured project means local auth, and `health()` says so.
 */
export function configured() {
  return mode() === 'supabase' && !!url() && !!anonKey();
}

/* ------------------------------------------------------------- transport */

/**
 * One request to GoTrue.
 *
 * Always resolves. A network failure, a timeout and a 400 all come back as
 * `{ok: false, ...}` so that no caller can turn an outage into a stack trace on
 * a login page.
 */
async function call(path, { method = 'POST', body, accessToken } = {}) {
  if (!url() || !anonKey()) {
    return { ok: false, status: 0, error: 'Supabase is not configured.', code: 'not-configured' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url()}/auth/v1${path}`, {
      method,
      headers: {
        apikey: anonKey(),
        // The anon key is the identity for anonymous calls; a user's own token
        // replaces it once we have one.
        authorization: `Bearer ${accessToken || anonKey()}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: data.error_code || data.error || String(res.status),
        error: humanError(res.status, data),
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      code: aborted ? 'timeout' : 'unreachable',
      error: aborted ? 'Supabase did not answer in time.' : 'Could not reach Supabase.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turn a GoTrue error into something worth showing a person.
 *
 * GoTrue's own strings are written for developers ("Invalid login credentials",
 * "AuthApiError"), and some of them leak whether an address is registered.
 * Anything not explicitly translated falls through to a generic line, which is
 * the safe direction to fail.
 */
function humanError(status, data) {
  const raw = String(data.msg || data.error_description || data.message || data.error || '').toLowerCase();

  if (raw.includes('invalid login credentials')) return 'That email or password is wrong.';
  if (raw.includes('email not confirmed')) {
    return 'That address has not been confirmed yet. Check your email for the confirmation link.';
  }
  if (raw.includes('already registered') || raw.includes('already been registered')) {
    return 'That address cannot be used. Try signing in instead.';
  }
  if (raw.includes('password') && raw.includes('should be at least')) {
    return 'That password is too short for this project.';
  }
  if (raw.includes('weak') && raw.includes('password')) return 'That password is too easy to guess.';
  if (raw.includes('token has expired') || raw.includes('expired')) return 'That link has expired.';
  if (status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (status >= 500) return 'Supabase is having trouble. Try again shortly.';
  return 'That did not work. Check the details and try again.';
}

/* ---------------------------------------------------------------- shapes */

/**
 * The parts of a GoTrue session Homeroom actually reads.
 *
 * `handle` rides in user_metadata because GoTrue has no concept of one, and
 * Homeroom's identity is a handle rather than a UUID.
 */
function shapeUser(user = {}) {
  return {
    id: user.id || '',
    email: String(user.email || '').trim().toLowerCase(),
    handle: String(user.user_metadata?.handle || '').trim().toLowerCase(),
    confirmed: !!(user.email_confirmed_at || user.confirmed_at),
    createdAt: user.created_at || null,
  };
}

function shapeSession(data = {}) {
  return {
    accessToken: data.access_token || '',
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || 0,
    user: shapeUser(data.user || {}),
  };
}

/* ----------------------------------------------------------- operations */

/**
 * Create the credential.
 *
 * Returns `{ok, user, session, needsConfirmation}`. When the project has email
 * confirmation switched on, GoTrue returns a user and no session: the account
 * exists but cannot sign in until the link is clicked, and the caller has to
 * say so rather than silently failing the login that follows.
 */
export async function signUp({ email, password, handle }) {
  const result = await call('/signup', {
    body: {
      email: String(email).trim().toLowerCase(),
      password,
      data: handle ? { handle: String(handle).trim().toLowerCase() } : undefined,
    },
  });
  if (!result.ok) return result;

  const session = shapeSession(result.data);
  // GoTrue puts the user at the top level when there is no session to wrap it.
  const user = session.user.id ? session.user : shapeUser(result.data);
  return {
    ok: true,
    user,
    session: session.accessToken ? session : null,
    needsConfirmation: !session.accessToken,
  };
}

export async function signInWithPassword({ email, password }) {
  const result = await call('/token?grant_type=password', {
    body: { email: String(email).trim().toLowerCase(), password },
  });
  if (!result.ok) return result;
  return { ok: true, session: shapeSession(result.data) };
}

/**
 * Ask Supabase to email a recovery link.
 *
 * Always report success to the caller. GoTrue itself returns 200 for an address
 * it has never seen, and preserving that is the point: a "no such account" here
 * turns the forgot-password form into a way to test whether someone is a member.
 */
export async function sendRecovery({ email, redirectTo }) {
  // redirect_to travels as a query parameter, not in the body, and must match
  // one of the project's allowed redirect URLs or GoTrue ignores it.
  const path = redirectTo
    ? `/recover?redirect_to=${encodeURIComponent(redirectTo)}`
    : '/recover';
  const result = await call(path, { body: { email: String(email).trim().toLowerCase() } });
  return result.ok ? { ok: true } : result;
}

/**
 * Exchange a recovery token for a session.
 *
 * This is the server-readable half of the reset flow: GoTrue's email template
 * can carry a `token_hash`, and verifying it here means the new password is
 * chosen and submitted without any token ever reaching client-side JavaScript.
 */
export async function verifyRecovery({ tokenHash, type = 'recovery' }) {
  const result = await call('/verify', { body: { token_hash: tokenHash, type } });
  if (!result.ok) return result;
  return { ok: true, session: shapeSession(result.data) };
}

/** Set a new password, using a token that proves who is asking. */
export async function updatePassword({ accessToken, password }) {
  const result = await call('/user', { method: 'PUT', accessToken, body: { password } });
  if (!result.ok) return result;
  return { ok: true, user: shapeUser(result.data) };
}

/** Who a token belongs to. Also the cheapest way to tell whether it is live. */
export async function getUser(accessToken) {
  const result = await call('/user', { method: 'GET', accessToken });
  if (!result.ok) return result;
  return { ok: true, user: shapeUser(result.data) };
}

/** End a session on Supabase's side too, so the refresh token stops working. */
export async function signOut(accessToken) {
  if (!accessToken) return { ok: true };
  const result = await call('/logout', { accessToken, body: {} });
  // A token that is already dead is a success as far as the caller is concerned.
  return result.ok || result.status === 401 ? { ok: true } : result;
}

/* ------------------------------------------------------------- reporting */

/**
 * For /homeroom/health.
 *
 * Probes rather than assumes: "is the front door wired up" is the question this
 * answers, and a configuration that looks right but cannot be reached is the
 * failure worth catching before a cohort arrives rather than after.
 */
export async function health() {
  if (mode() !== 'supabase') return { mode: mode(), configured: false };
  if (!url() || !anonKey()) {
    return {
      mode: 'supabase',
      configured: false,
      reachable: false,
      error: 'HOMEROOM_AUTH=supabase but SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing. '
        + 'Falling back to local accounts.',
    };
  }
  const result = await call('/settings', { method: 'GET' });
  return {
    mode: 'supabase',
    configured: true,
    reachable: result.ok,
    ...(result.ok
      ? {
        signupsEnabled: result.data.disable_signup === false,
        // autoconfirm on means a new account can sign in immediately; off means
        // the member has to click a link first, which changes what signup says.
        confirmationRequired: !result.data.mailer_autoconfirm,
      }
      : { error: result.error }),
  };
}
