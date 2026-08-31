import { raw, esc } from '../util.js';

export const HOMEROOM_NAME = 'Homeroom';
export const HOMEROOM_TAGLINE = 'The room behind the residency.';

const STATIC = process.env.HOMEROOM_STATIC_BASE || '/homeroom-assets';

const TABS = [
  { href: '/homeroom', label: 'Home', match: (p) => p === '/homeroom' },
  { href: '/homeroom/forum', label: 'Forum', match: (p) => /^\/homeroom\/(forum|post|ask|reply|comment)/.test(p) },
  { href: '/homeroom/people', label: 'People', match: (p) => /^\/homeroom\/(people|p\/)/.test(p) },
  { href: '/homeroom/labs', label: 'Labs', match: (p) => /^\/homeroom\/lab/.test(p) },
  { href: '/homeroom/deals', label: 'Deals', match: (p) => /^\/homeroom\/deal/.test(p) },
  { href: '/homeroom/funders', label: 'Funders', match: (p) => /^\/homeroom\/(funder|pipeline)/.test(p) },
  { href: '/homeroom/hours', label: 'Hours', match: (p) => p.startsWith('/homeroom/hours') },
  { href: '/homeroom/jobs', label: 'Jobs', match: (p) => p.startsWith('/homeroom/job') },
  { href: '/homeroom/events', label: 'Events', match: (p) => p.startsWith('/homeroom/event') },
  { href: '/homeroom/library', label: 'Library', match: (p) => p.startsWith('/homeroom/library') },
];

/**
 * Page chrome, in Haus livery.
 *
 * The forest bar and the warm canvas come from the site's own tokens, which
 * the stylesheet imports, so a change to the design system reaches Homeroom
 * without anything being copied.
 *
 * @param {object} ctx  request context: { user, csrf, path, fullPath, badges }
 */
export function homeroomLayout(ctx, { title, description, content, flash, error, wide = false }) {
  const fullTitle = title ? `${title} — Homeroom · Haus` : `Homeroom — ${HOMEROOM_TAGLINE}`;
  const desc = description
    || 'Homeroom — the members-only side of Haus: forum, member directory, lab directory, deals, funder reviews, office hours, jobs, events and library.';

  return raw(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="csrf-token" content="${esc(ctx.csrf || '')}" />
<meta name="robots" content="noindex, nofollow, noarchive" />
<meta name="theme-color" content="#1C3B2D" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap" />
<link rel="stylesheet" href="${STATIC}/style.css" />
</head>
<body>
${masthead(ctx)}
<main>
  <div class="wrap${wide ? ' wide' : ''}">
    ${error ? `<div class="notice bad">${esc(error)}</div>` : ''}
    ${flash ? `<div class="notice">${esc(flash)}</div>` : ''}
    ${content}
  </div>
</main>
${footer(ctx)}
<script src="${STATIC}/app.js" defer></script>
</body>
</html>`);
}

/** The bare shell the four pre-login pages use: no nav, nothing to explore. */
export function authLayout(ctx, { title, content, error, flash }) {
  return raw(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Homeroom · Haus</title>
<meta name="robots" content="noindex, nofollow, noarchive" />
<meta name="csrf-token" content="${esc(ctx.csrf || '')}" />
<meta name="theme-color" content="#1C3B2D" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap" />
<link rel="stylesheet" href="${STATIC}/style.css" />
</head>
<body class="plain">
<main class="authpage">
  <div class="authcard">
    <div class="authmark">
      <a href="/"><img src="/assets/logo-mark.svg" alt="Haus" /></a>
      <span>Homeroom</span>
    </div>
    ${error ? `<div class="notice bad">${esc(error)}</div>` : ''}
    ${flash ? `<div class="notice">${esc(flash)}</div>` : ''}
    ${content}
  </div>
</main>
</body>
</html>`);
}

function masthead(ctx) {
  const path = ctx.path || '/homeroom';
  const badges = ctx.badges || {};
  // A logged-out visitor gets no nav: every one of those links would only
  // bounce them back to the sign-in page.
  const tabs = ctx.user
    ? TABS.map((tab) => `<a href="${tab.href}" class="${tab.match(path) ? 'on' : ''}">${tab.label}</a>`).join('')
    : '';

  const alerts = Number(badges.notifications || 0);
  const me = ctx.user
    ? `<a class="count" href="/homeroom/messages">Messages${
        badges.messages ? `<b>${badges.messages}</b>` : ''
      }</a>
       <a class="count" href="/homeroom/notifications">Alerts${alerts ? `<b>${alerts}</b>` : ''}</a>
       <a class="who" href="/homeroom/p/${encodeURIComponent(ctx.user.id)}">${esc(ctx.user.id)}</a>`
    : `<a class="who" href="/homeroom/login">Sign in</a>`;

  return `<header class="bar">
  <div class="wrap">
    <a class="logo" href="/homeroom">
      <img src="/assets/logo-mark.svg" alt="Haus" />
      <span class="room">Homeroom</span>
    </a>
    <nav class="tabs">${tabs}</nav>
    <div class="me">${me}</div>
  </div>
</header>`;
}

function footer(ctx) {
  const out = ctx.user
    ? `<form method="post" action="/homeroom/logout" class="inline">
         <input type="hidden" name="csrf" value="${esc(ctx.csrf || '')}" />
         <button class="linkish" type="submit">Sign out</button>
       </form>`
    : '';
  return `<footer class="foot">
  <div class="wrap">
    <a href="/homeroom/search">Search</a>
    <a href="/homeroom/settings">Settings</a>
    <a href="/homeroom/saved">Saved</a>
    <a href="/homeroom/intros">Intros</a>
    <a href="/homeroom/about">About Homeroom</a>
    <a href="/">Haus</a>
    ${out}
    <div class="line">Members only &mdash; what is said here stays here.</div>
  </div>
</footer>`;
}
