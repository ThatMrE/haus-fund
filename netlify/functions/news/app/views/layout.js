import { raw, esc, u, s, BASE } from '../util.js';

export const SITE_NAME = 'Haus News';
export const TAGLINE = 'Early-stage biotech, ranked by the people building it.';

const TABS = [
  { href: '/', label: 'Front', match: (p) => p === '/' || p === '/news' },
  { href: '/newest', label: 'New', match: (p) => p === '/newest' },
  { href: '/best', label: 'Best', match: (p) => p === '/best' },
  { href: '/ask', label: 'Ask', match: (p) => p === '/ask' },
  { href: '/show', label: 'Show', match: (p) => p === '/show' },
  { href: '/comments', label: 'Threads', match: (p) => p === '/comments' },
  { href: '/topics', label: 'Channels', match: (p) => p === '/topics' || p === '/topic' },
  { href: '/field-notes', label: 'Field Notes', match: (p) => p.startsWith('/field-notes') },
  { href: '/scouts', label: 'Scouts', match: (p) => p === '/scouts' || p === '/points' },
  { href: '/submit', label: 'Submit', match: (p) => p === '/submit' },
];


/**
 * Wrap page content in the site chrome.
 *
 * @param {object} ctx  request context: { user, csrf, path }
 * @param {object} opts { title, description, ticker, flash, error, content }
 */
export function layout(ctx, { title, description, ticker = [], flash, error, content }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — early-stage biotech, ranked`;
  const desc =
    description ||
    'Haus News — a community-ranked feed of early-stage biotech startup news: seed and Series A rounds, spinouts, launches, and the tools behind them.';

  return raw(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="csrf-token" content="${esc(ctx.csrf || '')}" />
<meta name="base-path" content="${esc(BASE)}" />
<meta property="og:title" content="${esc(fullTitle)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#F8F7F3" />
<link rel="icon" href="${s('/favicon.svg')}" type="image/svg+xml" />
<link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${u('/rss')}" />
<link rel="stylesheet" href="${s('/style.css')}" />
</head>
<body>
${masthead(ctx)}
${statLine(ticker)}
<main>
  <div class="wrap">
    ${error ? `<div class="notice error">${esc(error)}</div>` : ''}
    ${flash ? `<div class="notice">${esc(flash)}</div>` : ''}
    ${content}
  </div>
</main>
${footer()}
<script src="${s('/app.js')}" defer></script>
</body>
</html>`);
}

function masthead(ctx) {
  const path = ctx.path || '/';
  const tabs = TABS.map(
    (tab) =>
      `<a href="${u(tab.href)}" class="${tab.match(path) ? 'on' : ''}">${tab.label}</a>`,
  ).join('');

  const me = ctx.user
    ? `<a href="${u('/user')}?id=${encodeURIComponent(ctx.user.id)}">${esc(ctx.user.id)}</a>
       <span class="karma" title="karma / scout points">(${ctx.user.karma}${ctx.user.points ? ` &middot; ${ctx.user.points}p` : ''})</span>
       ${ctx.queueCount ? `<a class="btn-nav" href="${u('/review')}">Queue ${ctx.queueCount}</a>` : ''}
       <form method="post" action="${u('/logout')}" style="display:inline">
         <input type="hidden" name="csrf" value="${esc(ctx.csrf)}" />
         <button class="btn-nav" type="submit">Log out</button>
       </form>`
    : `<a class="btn-nav" href="${u('/login')}?next=${encodeURIComponent(ctx.fullPath || '/')}">Log in</a>`;

  return `<header class="masthead">
  <div class="wrap">
    <a class="brand" href="${u('/')}"><span class="mark">Haus</span><span class="section">News</span></a>
    <nav class="tabs">${tabs}</nav>
    <div class="me">${me}</div>
  </div>
</header>`;
}

function statLine(entries) {
  if (!entries.length) return '';
  return `<div class="statline"><div class="wrap">${entries.map((e) => `<span>${e}</span>`).join('')}</div></div>`;
}

/** Review deploys run on an ephemeral disk; say so rather than let it surprise. */
const DEMO_NOTICE = process.env.BIOPUNK_DEMO
  ? '<div class="tagline">Demo deploy &mdash; sample content, and the database resets when the server sleeps.</div>'
  : '';

function footer() {
  return `<footer class="foot">
  <div class="wrap">
    <a href="${u('/guidelines')}">Guidelines</a>
    <a href="${u('/about')}">About</a>
    <a href="${u('/bench-notes')}">Bench Notes</a>
    <a href="${u('/live')}">Biopunk Live</a>
    <a href="${u('/agents')}">Agents</a>
    <a href="${u('/rss')}">RSS</a>
    <a href="${u('/api')}">API</a>
    <a href="${u('/search')}">Search</a>
    <a href="/">haus.fund</a>
    <a href="/portfolio.html">Portfolio</a>
    <a href="/expansion.html">Global</a>
    <div class="tagline">${esc(TAGLINE)}</div>
    ${DEMO_NOTICE}
  </div>
</footer>`;
}
