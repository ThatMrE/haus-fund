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
  SESSION_COOKIE, sessionCookie, clearCookie, createSession, destroySession, getSessionUser,
  hashPassword, verifyPassword, csrfToken, checkCsrf, validateUsername, validatePassword,
  validateEmail, createResetToken, findResetToken, consumeResetToken, purgeExpiredSessions,
  purgeExpiredResets,
} from './auth.js';
import * as hr from './models.js';
import { authLayout } from './views/layout.js';
import * as views from './views/pages.js';
import { parseCookies, nowSeconds } from './util.js';
import { sendResetEmail, showsResetLink } from './mail.js';
import { homeroomRoute, homeroomNotFound, render } from './routes.js';

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
      return sendJson(res, { ok: true, ...hr.networkStats(), now: nowSeconds() });
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

    const account = hr.getUserByEmail(email);
    // One message for both cases: a precise one tells a stranger which
    // addresses have accounts here.
    const fail = () => auth(ctx, views.loginPage(ctx, {
      values: { email }, next, error: 'That email and password do not match.',
    }), { title: 'Sign in', status: 401 });

    if (!account || !verifyPassword(fields.password || '', account.password_hash)) return fail();
    if (account.banned) {
      return auth(ctx, views.loginPage(ctx, { values: { email }, next, error: 'That account is suspended.' }),
        { title: 'Sign in', status: 403 });
    }
    finishLogin(ctx, account.id, next);
  },

  'GET /homeroom/signup': (ctx) => {
    if (ctx.user) return seeOther(ctx, '/homeroom');
    auth(ctx, views.signupPage(ctx, {}), { title: 'Create an account' });
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

    // The first person through the door is the first steward; somebody has to be.
    const first = hr.userCount() === 0;
    hr.createUser({
      id: values.handle,
      email: values.email,
      passwordHash: hashPassword(fields.password),
      isAdmin: first,
    });
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
    const token = ctx.query.get('token') || '';
    if (!findResetToken(token)) return auth(ctx, views.resetExpiredPage(), { title: 'Link expired', status: 410 });
    auth(ctx, views.resetPage(ctx, { token }), { title: 'Choose a password' });
  },

  'POST /homeroom/reset': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const token = String(fields.token || '');
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
