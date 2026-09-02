/*
 * Homeroom — HTTP entry point.
 *
 * An ordinary node:http handler, so it runs the same behind Netlify's function
 * shim as it does under `npm start`. This file owns the session, the accounts,
 * and the four pre-login pages; everything a member sees once they are in lives
 * in routes.js.
 */

import { sendHtml, sendJson, sendText, readBody, rateLimit, clientIp } from './http.js';
import {
  SESSION_COOKIE, sessionCookie, clearCookie, createSession, destroySession, destroyAllSessions,
  getSessionUser,
  hashPassword, verifyPassword, csrfToken, checkCsrf, validateUsername, validatePassword,
  validateEmail, createResetToken, findResetToken, consumeResetToken, purgeExpiredSessions,
  purgeExpiredResets,
} from './auth.js';
import * as hr from './models.js';
import { authLayout } from './views/layout.js';
import * as views from './views/pages.js';
import { parseCookies, nowSeconds } from './util.js';
import { randomBytes } from 'node:crypto';
import { sendResetEmail, showsResetLink } from './mail.js';
import { homeroomRoute, homeroomNotFound, render } from './routes.js';
import * as access from './access.js';
import * as roster from './roster.js';
import * as sbAuth from './supabase-auth.js';

/**
 * Whether to mark the session cookie Secure.
 *
 * Read off the request rather than an environment variable: a function's
 * runtime does not reliably carry NODE_ENV or NETLIFY, and getting this wrong
 * means a members-only session travelling over plain http. The proxy header is
 * what actually describes the connection the browser made.
 */
function secureCookies(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '');
  if (proto) return proto.split(',')[0].trim() === 'https';
  return process.env.NODE_ENV === 'production' || !!process.env.NETLIFY;
}

const LIMITS = {
  read: { limit: 300, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  login: { limit: 12, windowMs: 10 * 60_000 },
  forgot: { limit: 6, windowMs: 60 * 60_000 },
};

export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  const ip = clientIp(req);
  const isWrite = req.method === 'POST';
  if (!rateLimit(`${isWrite ? 'w' : 'r'}:${ip}`, isWrite ? LIMITS.write : LIMITS.read)) {
    return sendText(res, 'Slow down.', { status: 429 });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  const user = getSessionUser(token);
  const ctx = {
    req, res, url, ip,
    path: pathname,
    fullPath: pathname + (url.search || ''),
    query: url.searchParams,
    user,
    token,
    csrf: csrfToken(token),
  };

  try {
    const authHandler = AUTH_ROUTES[`${req.method} ${pathname}`];
    if (authHandler) return await authHandler(ctx);

    if (pathname === '/homeroom/health') {
      // Reports the integrations too, so "is publishing wired up" is one curl
      // rather than a deploy and a guess.
      const { health: supabaseHealth } = await import('./supabase.js');
      const { configured: lumaConfigured, calendarUrl } = await import('./luma.js');
      return sendJson(res, {
        ok: true,
        ...hr.networkStats(),
        supabase: await supabaseHealth(),
        roster: { ...(await roster.health()), ...hr.rosterCounts() },
        auth: await sbAuth.health(),
        luma: { configured: lumaConfigured(), calendar: calendarUrl() },
        mentors: (await import('./mentordesk.js')).deskStats(),
        now: nowSeconds(),
      });
    }

    const handler = homeroomRoute(req.method, pathname);
    if (!handler) return homeroomNotFound(ctx);
    await handler(ctx);
  } catch (err) {
    if (err?.status === 413) return sendText(res, 'Payload too large.', { status: 413 });
    console.error(`[homeroom] ${req.method} ${req.url}`, err);
    if (!res.headersSent) {
      return render(ctx, views.errorPage('Something went wrong on our side.'), {
        title: 'Error', status: 500,
      });
    }
    res.end();
  }
}

/* -------------------------------------------------------------- accounts */

function auth(ctx, content, { title, status = 200, error, flash } = {}) {
  sendHtml(ctx.res, authLayout(ctx, { title, content, error, flash }), { status });
}

function seeOther(ctx, location, headers = {}) {
  ctx.res.writeHead(303, { location, ...headers });
  ctx.res.end();
}

/** Only ever bounce back into Homeroom. */
function safeNext(value, fallback = '/homeroom') {
  if (typeof value !== 'string' || !value.startsWith('/homeroom')) return fallback;
  if (value.startsWith('//')) return fallback;
  return value;
}

function finishLogin(ctx, userId, next) {
  const token = createSession(userId);
  hr.ensureMember(userId);
  hr.touchMember(userId);
  seeOther(ctx, safeNext(next), {
    'set-cookie': sessionCookie(token, { secure: secureCookies(ctx.req) }),
  });
}

/**
 * Find or create the Homeroom row that a Supabase credential signs in as.
 *
 * Supabase owns the password; this owns everything a foreign key points at. The
 * two are matched on `users.supabase_id` first, and only then on the address —
 * matching on address alone would let a Supabase account whose email was later
 * changed silently take over somebody else's Homeroom identity.
 *
 * The password column is filled with a random, discarded value. It is never
 * consulted while HOMEROOM_AUTH=supabase, and leaving it null would make the
 * row a working passwordless account the moment anyone switched back to local.
 */
function localAccountFor(sbUser, { handleHint = '', isAdmin = false } = {}) {
  const linked = hr.getUserBySupabaseId(sbUser.id);
  if (linked) {
    // Supabase is the authority on the address; a change there should follow.
    if (sbUser.email && linked.email !== sbUser.email) hr.setUserEmail(linked.id, sbUser.email);
    return { account: hr.getUser(linked.id), created: false };
  }

  const byEmail = hr.getUserByEmail(sbUser.email);
  if (byEmail) {
    // An account that predates the switch to Supabase, claiming its credential
    // for the first time. Only ever adopted when nothing else holds it.
    if (!byEmail.supabase_id) {
      hr.linkSupabaseId(byEmail.id, sbUser.id);
      return { account: hr.getUser(byEmail.id), created: false };
    }
    return { error: 'That address is already in use by another account.' };
  }

  const handle = availableHandle(sbUser.handle || handleHint || sbUser.email.split('@')[0]);
  hr.createUser({
    id: handle,
    email: sbUser.email,
    passwordHash: hashPassword(randomBytes(32).toString('hex')),
    isAdmin,
  });
  hr.linkSupabaseId(handle, sbUser.id);
  return { account: hr.getUser(handle), created: true };
}

/**
 * A handle nobody has, derived from a preferred one.
 *
 * Supabase has no notion of a handle, so an account created outside Homeroom —
 * in the dashboard, by a script — arrives with only an address. Sanitise it to
 * something the signup form would have accepted and add a number if taken,
 * rather than refusing the login of an account that genuinely exists.
 */
function availableHandle(preferred) {
  const base = String(preferred || '')
    .toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/^[-_]+/, '').slice(0, 20) || 'member';
  const seed = validateUsername(base) ? `m${base}`.slice(0, 20) : base;
  if (!hr.getUser(seed)) return seed;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${seed.slice(0, 20 - String(n).length)}${n}`;
    if (!hr.getUser(candidate)) return candidate;
  }
  return `member-${randomBytes(4).toString('hex')}`;
}

const AUTH_ROUTES = {
  'GET /homeroom/login': (ctx) => {
    if (ctx.user) return seeOther(ctx, safeNext(ctx.query.get('next')));
    auth(ctx, views.loginPage(ctx, { next: safeNext(ctx.query.get('next')) }), { title: 'Sign in' });
  },

  'POST /homeroom/login': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const next = safeNext(fields.next);
    const email = String(fields.email || '').trim();

    if (!rateLimit(`login:${ctx.ip}`, LIMITS.login)) {
      return auth(ctx, views.loginPage(ctx, {
        values: { email }, next, error: 'Too many attempts. Wait a few minutes.',
      }), { title: 'Sign in', status: 429 });
    }
    if (!checkCsrf(ctx.token, fields.csrf) && ctx.token) {
      return auth(ctx, views.loginPage(ctx, { values: { email }, next, error: 'That form expired. Try again.' }),
        { title: 'Sign in', status: 403 });
    }

    // One message for both cases: a precise one tells a stranger which
    // addresses have accounts here.
    const fail = (message = 'That email and password do not match.', status = 401) =>
      auth(ctx, views.loginPage(ctx, { values: { email }, next, error: message }),
        { title: 'Sign in', status });

    /* ---- Supabase holds the password ---- */
    if (sbAuth.configured()) {
      const result = await sbAuth.signInWithPassword({ email, password: fields.password || '' });
      if (!result.ok) {
        // An outage must be distinguishable from a wrong password, or the first
        // thing anyone does during one is change their password and fail again.
        if (result.code === 'unreachable' || result.code === 'timeout' || result.status >= 500) {
          return fail('Sign-in is temporarily unavailable. Try again shortly.', 503);
        }
        return fail(result.error);
      }

      const { account: linked, created, error } = localAccountFor(result.session.user);
      if (error) return fail(error, 409);
      if (linked.banned) {
        return auth(ctx, views.loginPage(ctx, { values: { email }, next, error: 'That account is suspended.' }),
          { title: 'Sign in', status: 403 });
      }
      // The token has done its one job. Nothing here acts on the member's
      // behalf at Supabase, so holding it any longer is liability without use.
      await sbAuth.signOut(result.session.accessToken);
      if (created) access.seedProfile(linked.id, {});
      return finishLogin(ctx, linked.id, next);
    }

    /* ---- Homeroom holds the password ---- */
    const account = hr.getUserByEmail(email);
    if (!account || !verifyPassword(fields.password || '', account.password_hash)) return fail();
    if (account.banned) {
      return auth(ctx, views.loginPage(ctx, { values: { email }, next, error: 'That account is suspended.' }),
        { title: 'Sign in', status: 403 });
    }

    // Re-check against the roster, so someone whose place was rescinded stops
    // having a key. Stewards are exempt: an Airtable edit should never be able
    // to lock out the people who administer the room.
    if (!account.is_admin && roster.accessMode() === 'roster') {
      const stale = account.roster_checked_at < nowSeconds() - roster.verdictTtl();
      if (stale) {
        const assessment = await access.assess(account.email);
        if (!access.loginAllowed(assessment)) {
          destroySession(ctx.token);
          return auth(ctx, views.accessRevokedPage(), { title: 'Access ended', status: 403 });
        }
        hr.setUserRoster(account.id, `${assessment.verdict}:${assessment.reason}`.slice(0, 120));
      }
    }

    finishLogin(ctx, account.id, next);
  },

  'GET /homeroom/signup': (ctx) => {
    if (ctx.user) return seeOther(ctx, '/homeroom');
    const mode = roster.accessMode();
    if (mode === 'closed') {
      return auth(ctx, views.signupClosedPage(), { title: 'Accounts are closed', status: 403 });
    }
    auth(ctx, views.signupPage(ctx, { mode }), { title: 'Create an account' });
  },

  'POST /homeroom/signup': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const values = {
      handle: String(fields.handle || '').trim(),
      email: String(fields.email || '').trim(),
    };
    const fail = (message, status = 400) =>
      auth(ctx, views.signupPage(ctx, { values, error: message }), { title: 'Create an account', status });

    if (!rateLimit(`signup:${ctx.ip}`, LIMITS.signup)) {
      return fail('Too many accounts from this address. Wait an hour.', 429);
    }
    const handleError = validateUsername(values.handle);
    if (handleError) return fail(handleError);
    const emailError = validateEmail(values.email);
    if (emailError) return fail(emailError);
    const passwordError = validatePassword(fields.password || '');
    if (passwordError) return fail(passwordError);
    if (hr.getUser(values.handle)) return fail('That handle is taken.');
    if (hr.getUserByEmail(values.email)) {
      // Do not confirm that the address is already registered.
      return fail('That handle or email cannot be used. Try signing in instead.');
    }

    // ---- the roster gate ----
    // Everything above this line is form validation. This is the part that
    // decides whether the room stays closed.
    const assessment = await access.assess(values.email);

    if (assessment.verdict === 'closed') {
      return auth(ctx, views.signupClosedPage(), { title: 'Accounts are closed', status: 403 });
    }
    if (assessment.verdict === 'error') {
      // Fails closed, but says so honestly: this is our problem, not theirs.
      return auth(ctx, views.rosterUnavailablePage(ctx, { values }),
        { title: 'Try again shortly', status: 503 });
    }
    if (!access.signupAllowed(assessment)) {
      // One page for denied and for under-review, and the same page whether or
      // not the address was found: a precise message here turns signup into a
      // way to test whether any given person is a resident.
      return auth(ctx, views.notOnRosterPage(ctx, { email: values.email }),
        { title: 'Residents only', status: 403 });
    }

    // The first person through the door is the first steward; somebody has to be.
    const first = hr.userCount() === 0;

    /* ---- Supabase holds the password ---- */
    if (sbAuth.configured()) {
      const created = await sbAuth.signUp({
        email: values.email,
        password: fields.password,
        handle: values.handle,
      });
      if (!created.ok) {
        if (created.code === 'unreachable' || created.code === 'timeout' || created.status >= 500) {
          return auth(ctx, views.rosterUnavailablePage(ctx, { values }),
            { title: 'Try again shortly', status: 503 });
        }
        return fail(created.error);
      }

      const { account: linked, error } = localAccountFor(created.user, {
        handleHint: values.handle,
        isAdmin: first,
      });
      if (error) return fail(error, 409);
      access.bindAccount({ email: values.email, userId: linked.id, assessment });
      access.seedProfile(linked.id, assessment.person);

      // With email confirmation switched on, the credential exists but cannot
      // sign in yet. Saying so beats a login that mysteriously fails.
      if (created.needsConfirmation) {
        return auth(ctx, views.confirmEmailPage(ctx, { email: values.email }),
          { title: 'Confirm your email' });
      }
      if (created.session) await sbAuth.signOut(created.session.accessToken);
      return finishLogin(ctx, linked.id, '/homeroom/settings?welcome=1');
    }

    /* ---- Homeroom holds the password ---- */
    hr.createUser({
      id: values.handle,
      email: values.email,
      passwordHash: hashPassword(fields.password),
      isAdmin: first,
    });
    access.bindAccount({ email: values.email, userId: values.handle, assessment });
    access.seedProfile(values.handle, assessment.person);
    finishLogin(ctx, values.handle, '/homeroom/settings?welcome=1');
  },

  'POST /homeroom/logout': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    if (ctx.user && !checkCsrf(ctx.token, fields.csrf)) return seeOther(ctx, '/homeroom');
    destroySession(ctx.token);
    seeOther(ctx, '/homeroom', { 'set-cookie': clearCookie() });
  },

  'GET /homeroom/forgot': (ctx) => auth(ctx, views.forgotPage(ctx, {}), { title: 'Reset your password' }),

  'POST /homeroom/forgot': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const email = String(fields.email || '').trim();

    if (!rateLimit(`forgot:${ctx.ip}`, LIMITS.forgot)) {
      return auth(ctx, views.forgotPage(ctx, { values: { email }, error: 'Too many requests. Wait an hour.' }),
        { title: 'Reset your password', status: 429 });
    }
    if (validateEmail(email)) {
      return auth(ctx, views.forgotPage(ctx, { values: { email }, error: 'That does not look like an email address.' }),
        { title: 'Reset your password', status: 400 });
    }

    /* ---- Supabase sends the email ---- */
    if (sbAuth.configured()) {
      await sbAuth.sendRecovery({ email, redirectTo: `${origin(ctx)}/homeroom/reset` });
      // Deliberately ignoring the result. GoTrue answers 200 for an address it
      // has never seen, and this page must not distinguish the two either.
      return auth(ctx, views.forgotSentPage(ctx, { email, link: null }), { title: 'Check your email' });
    }

    const account = hr.getUserByEmail(email);
    let link = null;
    if (account) {
      const token = createResetToken(account.id);
      const base = origin(ctx);
      const resetUrl = `${base}/homeroom/reset?token=${token}`;
      const result = await sendResetEmail({ to: account.email, link: resetUrl });
      if (!result.sent && showsResetLink()) link = resetUrl;
    }
    // Same page either way, whether or not the address is one of ours.
    auth(ctx, views.forgotSentPage(ctx, { email, link }), { title: 'Check your email' });
  },

  'GET /homeroom/reset': (ctx) => {
    /* ---- Supabase minted the token ---- */
    //
    // GoTrue can deliver a recovery link two ways, and which one arrives
    // depends on a project's email template, so both are accepted:
    //
    //   ?token_hash=...&type=recovery   verifiable on the server, nothing ever
    //                                   reaches client-side JavaScript.
    //   #access_token=...               the default implicit flow, which puts
    //                                   the token in the URL fragment where
    //                                   only the browser can see it.
    //
    // The fragment never reaches this handler at all — that is what a fragment
    // is — so the page carries a few lines of script that move it into a form
    // field. Rendering the same form either way keeps one code path for the
    // part that matters, which is choosing the password.
    if (sbAuth.configured()) {
      return auth(ctx, views.resetPage(ctx, {
        token: '',
        tokenHash: ctx.query.get('token_hash') || '',
        supabase: true,
      }), { title: 'Choose a password' });
    }

    const token = ctx.query.get('token') || '';
    if (!findResetToken(token)) return auth(ctx, views.resetExpiredPage(), { title: 'Link expired', status: 410 });
    auth(ctx, views.resetPage(ctx, { token }), { title: 'Choose a password' });
  },

  'POST /homeroom/reset': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const token = String(fields.token || '');

    /* ---- Supabase holds the password ---- */
    if (sbAuth.configured()) {
      const tokenHash = String(fields.token_hash || '');
      const carried = String(fields.access_token || '');
      const fail = (message, status = 400) => auth(ctx, views.resetPage(ctx, {
        token: '', tokenHash, supabase: true, error: message,
      }), { title: 'Choose a password', status });

      if (fields.password !== fields.confirm) return fail('Those two do not match.');
      const passwordError = validatePassword(fields.password || '');
      if (passwordError) return fail(passwordError);
      if (!tokenHash && !carried) {
        return auth(ctx, views.resetExpiredPage(), { title: 'Link expired', status: 410 });
      }

      // Whichever half of the link arrived, the end state is the same: a token
      // that proves who is asking, exchanged for a password change.
      let accessToken = carried;
      if (!accessToken) {
        const verified = await sbAuth.verifyRecovery({ tokenHash });
        if (!verified.ok) {
          return auth(ctx, views.resetExpiredPage(), { title: 'Link expired', status: 410 });
        }
        accessToken = verified.session.accessToken;
      }

      const updated = await sbAuth.updatePassword({ accessToken, password: fields.password });
      if (!updated.ok) return fail(updated.error);

      // Every Homeroom session for this account, on this container, dies with
      // the password. A reset that leaves the old session signed in has not
      // locked anybody out of anything.
      const linked = hr.getUserBySupabaseId(updated.user.id) || hr.getUserByEmail(updated.user.email);
      if (linked) destroyAllSessions(linked.id);
      await sbAuth.signOut(accessToken);
      return auth(ctx, views.resetDonePage(), { title: 'Password saved' });
    }

    /* ---- Homeroom holds the password ---- */
    if (!findResetToken(token)) return auth(ctx, views.resetExpiredPage(), { title: 'Link expired', status: 410 });

    const fail = (message) =>
      auth(ctx, views.resetPage(ctx, { token, error: message }), { title: 'Choose a password', status: 400 });

    if (fields.password !== fields.confirm) return fail('Those two do not match.');
    const passwordError = validatePassword(fields.password || '');
    if (passwordError) return fail(passwordError);

    if (!consumeResetToken(token, fields.password)) return fail('That link has already been used.');
    auth(ctx, views.resetDonePage(), { title: 'Password saved' });
  },
};

function origin(ctx) {
  const proto = ctx.req.headers['x-forwarded-proto'] || (secureCookies(ctx.req) ? 'https' : 'http');
  const host = ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host || 'haus.fund';
  return `${proto}://${host}`;
}

/* Housekeeping, cheap enough to run on a timer in the long-lived server and
   harmless in a function that never lives long enough to fire it. */
setInterval(() => {
  try {
    purgeExpiredSessions();
    purgeExpiredResets();
  } catch { /* the next boot will do it */ }
}, 6 * 60 * 60 * 1000).unref?.();
