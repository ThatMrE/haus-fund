import {
  sendHtml, sendJson, sendText, redirect, readBody, serveStatic, rateLimit, clientIp,
} from './http.js';
import {
  SESSION_COOKIE, sessionCookie, clearCookie, createSession, destroySession, getSessionUser,
  hashPassword, verifyPassword, csrfToken, checkCsrf, validateUsername, validatePassword,
} from './auth.js';
import * as db from './models.js';
import * as review from './review.js';
import * as points from './points.js';
import * as digests from './digests.js';
import { AGENTS, agentByKey } from './agents/index.js';
import { surface, tokenOk, bearer } from './intake.js';
import { agentStatus } from './ingest.js';
import { layout, SITE_NAME, TAGLINE } from './views/layout.js';
import * as views from './views/pages.js';
import { parseCookies, normalizeUrl, clampInt, nowSeconds, esc, u, stripBase, BASE, STATIC_BASE } from './util.js';

const PAGE_SIZE = db.PAGE_SIZE;
const SECURE_COOKIES = process.env.NODE_ENV === 'production';

const LIMITS = {
  read: { limit: 240, windowMs: 60_000 },
  write: { limit: 40, windowMs: 60_000 },
  submit: { limit: 8, windowMs: 60 * 60_000 },
  comment: { limit: 30, windowMs: 10 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  login: { limit: 12, windowMs: 10 * 60_000 },
};

/* ------------------------------------------------------------ dispatcher */

export async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // `pathname` is app-relative so routing never needs to know the mount point;
  // `fullPath` keeps the prefix, because that is what links and redirects use.
  const pathname = stripBase(url.pathname).replace(/\/+$/, '') || '/';

  // Static assets are matched on the raw path: in production the CDN serves
  // them and this never runs, but the local dev server has no CDN in front.
  if (url.pathname.startsWith(`${STATIC_BASE}/`)) {
    if (await serveStatic(req, res, url.pathname)) return;
  }

  const ip = clientIp(req);
  const isWrite = req.method === 'POST';
  if (!rateLimit(`${isWrite ? 'w' : 'r'}:${ip}`, isWrite ? LIMITS.write : LIMITS.read)) {
    return sendText(res, 'Slow down — rate limited.', { status: 429 });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  const user = await getSessionUser(token);
  const ctx = {
    req, res, url, ip,
    path: pathname,
    fullPath: u(pathname) + (url.search || ''),
    query: url.searchParams,
    user,
    token,
    csrf: csrfToken(token),
    // Only a reviewer sees the queue badge, so only a reviewer pays for the count.
    queueCount: review.canReview(user) ? await review.pendingCount() : 0,
  };

  try {
    const handler = route(req.method, pathname);
    if (!handler) return render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
    await handler(ctx);
  } catch (err) {
    if (err?.status === 413) return sendText(res, 'Payload too large.', { status: 413 });
    console.error(`[error] ${req.method} ${req.url}`, err);
    if (!res.headersSent) {
      if (pathname.startsWith('/api/')) return sendJson(res, { ok: false, error: 'server error' }, { status: 500 });
      return render(ctx, views.errorPage(), { title: 'Error', status: 500 });
    }
    res.end();
  }
}

function route(method, pathname) {
  const table = method === 'POST' ? POST_ROUTES : GET_ROUTES;
  if (table[pathname]) return table[pathname];
  // Parameterised API routes: /api/item/123, /api/user/foo
  const apiItem = /^\/api\/item\/(\d+)$/.exec(pathname);
  if (method === 'GET' && apiItem) return async (ctx) => apiItemHandler(ctx, Number(apiItem[1]));
  const apiUser = /^\/api\/user\/([^/]+)$/.exec(pathname);
  if (method === 'GET' && apiUser) return async (ctx) => apiUserHandler(ctx, decodeURIComponent(apiUser[1]));
  return null;
}

/* ------------------------------------------------------------- rendering */

async function render(ctx, content, { title, description, status = 200, flash, error } = {}) {
  const body = layout(ctx, {
    title,
    description,
    content,
    flash: flash ?? ctx.query?.get('flash') ?? undefined,
    error,
    ticker: await tickerEntries(),
  });
  sendHtml(ctx.res, body, { status });
}

let tickerCache = { at: 0, entries: [] };

/** Marquee strip: freshest headlines plus a couple of site vitals. */
async function tickerEntries() {
  const now = Date.now();
  if (now - tickerCache.at < 30_000 && tickerCache.entries.length) return tickerCache.entries;
  const stats = await db.siteStats();
  const today = await db.postedSince(nowSeconds() - 24 * 3600);
  const entries = [
    `<b>${today.human}</b> submitted today`,
    `<b>${today.agent}</b> filed by the morning run`,
    `<b>${stats.stories}</b> stories`,
    `<b>${stats.comments}</b> comments`,
    `<b>${stats.users}</b> members`,
  ];
  tickerCache = { at: now, entries };
  return entries;
}

function invalidateTicker() {
  tickerCache = { at: 0, entries: [] };
}

function pageParam(ctx) {
  return clampInt(ctx.query.get('p'), 1, 100, 1);
}

/**
 * Annotate a page of items with the viewer's flag/favourite state and return
 * the set of ids they have upvoted. Three queries for a whole page, not 3N.
 */
async function votedSet(ctx, items) {
  const ids = items.map((i) => i.id);
  const userId = ctx.user?.id;
  const voted = await db.votedItemIds(userId, ids);
  if (userId) {
    const flagged = await db.markedItemIds('flags', userId, ids);
    const favorited = await db.markedItemIds('favorites', userId, ids);
    for (const item of items) {
      item.flagged = flagged.has(item.id);
      item.favorited = favorited.has(item.id);
    }
  }
  return voted;
}

/** Only ever redirect to our own paths. */
function safeGoto(value, fallback = BASE || '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

async function requireUser(ctx) {
  if (ctx.user) return true;
  redirect(ctx.res, `${u('/login')}?next=${encodeURIComponent(ctx.fullPath)}`);
  return false;
}

/** Validate CSRF for a form POST; renders a 403 when it fails. */
async function guard(ctx, fields) {
  if (checkCsrf(ctx.token, fields.csrf)) return true;
  await render(ctx, views.errorPage('Stale session token. Reload the page and try again.'), {
    title: 'Rejected',
    status: 403,
  });
  return false;
}

/* ----------------------------------------------------------- GET handlers */

function listing(opts) {
  return async (ctx) => {
    const page = pageParam(ctx);
    const offset = (page - 1) * PAGE_SIZE;
    const { items, total } = await opts.query(ctx, { limit: PAGE_SIZE, offset });
    await render(
      ctx,
      views.listingPage(ctx, {
        heading: opts.heading(ctx),
        blurb: opts.blurb?.(ctx),
        items,
        page,
        total,
        basePath: opts.basePath(ctx),
        voted: await votedSet(ctx, items),
        topic: opts.topic?.(ctx) ?? null,
        showTopics: Boolean(opts.showTopics),
      }),
      { title: opts.title(ctx), description: opts.description?.(ctx) },
    );
  };
}

const frontHandler = listing({
  query: async (ctx, o) => db.frontPage(o),
  heading: () => 'Front',
  blurb: () => 'Ranked by upvotes, decayed by age, nudged by discussion.',
  basePath: () => '/',
  title: () => null,
  showTopics: true,
});

const GET_ROUTES = {
  '/': frontHandler,
  '/news': frontHandler,

  '/newest': listing({
    query: async (ctx, o) => db.newest(o),
    heading: () => 'New',
    blurb: () => 'Everything, unranked, freshest first.',
    basePath: () => '/newest',
    title: () => 'New',
  }),

  '/best': listing({
    query: async (ctx, o) => db.bestStories(o),
    heading: () => 'Best',
    blurb: () => 'Highest scoring submissions of the last 30 days.',
    basePath: () => '/best',
    title: () => 'Best',
  }),

  '/ask': listing({
    query: async (ctx, o) => db.byKind('ask', o),
    heading: () => 'Ask BN',
    blurb: () => 'Questions for the movement. Protocol help, career forks, hard problems.',
    basePath: () => '/ask',
    title: () => 'Ask BN',
  }),

  '/show': listing({
    query: async (ctx, o) => db.byKind('show', o),
    heading: () => 'Show BN',
    blurb: () => 'Things people built: rigs, organisms, software, spaces.',
    basePath: () => '/show',
    title: () => 'Show BN',
  }),

  '/topic': async (ctx) => {
    const topic = db.normalizeTopic(ctx.query.get('t'));
    if (!topic) return render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
    const page = pageParam(ctx);
    const { items, total } = await db.frontPage({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, topic });
    await render(
      ctx,
      views.listingPage(ctx, {
        heading: db.topicLabel(topic),
        blurb: 'Channel feed, same ranking as the front page.',
        items, page, total,
        basePath: `/topic?t=${topic}`,
        voted: await votedSet(ctx, items),
        topic,
        showTopics: true,
      }),
      { title: db.topicLabel(topic) },
    );
  },

  '/topics': async (ctx) => {
    const counts = {};
    for (const t of db.TOPICS) counts[t.slug] = (await db.frontPage({ limit: 1, topic: t.slug })).total;
    await render(ctx, views.topicsPage(ctx, { counts }), { title: 'Channels' });
  },

  '/from': async (ctx) => {
    const site = (ctx.query.get('site') || '').toLowerCase().trim();
    const page = pageParam(ctx);
    const { items, total } = await db.byDomain(site, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    await render(
      ctx,
      views.listingPage(ctx, {
        heading: site || 'Unknown source',
        blurb: 'Everything submitted from this domain.',
        items, page, total,
        basePath: `/from?site=${encodeURIComponent(site)}`,
        voted: await votedSet(ctx, items),
      }),
      { title: site },
    );
  },

  '/comments': async (ctx) => {
    const page = pageParam(ctx);
    const { items, total } = await db.recentComments({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    await db.withStoryTitles(items);
    await render(
      ctx,
      views.commentsFeedPage(ctx, {
        items, page, total,
        heading: 'Threads',
        blurb: 'Every comment on the site, newest first.',
        basePath: '/comments',
        voted: await votedSet(ctx, items),
      }),
      { title: 'Threads' },
    );
  },

  '/item': async (ctx) => {
    const item = await db.getItem(ctx.query.get('id'));
    if (!item || item.deleted) return render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });

    if (item.type === 'story') {
      const comments = await db.commentTree(item.id);
      const voted = await votedSet(ctx, [item, ...comments]);
      return render(ctx, views.itemPage(ctx, { story: item, comments, voted, opId: item.by }), {
        title: item.title,
        description: (item.text || `${item.title} — discussion on ${SITE_NAME}`).slice(0, 200),
      });
    }

    const story = await db.getItem(item.story_id);
    const replies = descendantsOf(await db.commentTree(item.story_id), item.id);
    const voted = await votedSet(ctx, [item, ...replies]);
    return render(
      ctx,
      views.commentPermalinkPage(ctx, { comment: item, story, replies, voted, opId: story?.by }),
      { title: `Comment by ${item.by}` },
    );
  },

  '/reply': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const parent = await db.getItem(ctx.query.get('id'));
    if (!parent || parent.deleted) return render(ctx, views.notFoundPage(), { status: 404 });
    const story = parent.type === 'story' ? parent : await db.getItem(parent.story_id);
    await render(ctx, views.replyPage(ctx, { parent, story }), { title: 'Reply' });
  },

  '/submit': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    await render(ctx, views.submitPage(ctx, { values: Object.fromEntries(ctx.query) }), { title: 'Submit' });
  },

  '/edit': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const item = await db.getItem(ctx.query.get('id'));
    if (!item) return render(ctx, views.notFoundPage(), { status: 404 });
    if (!db.canEdit(item, ctx.user)) {
      return render(ctx, views.errorPage('That is not yours to edit, or the two-hour window closed.'), {
        title: 'Locked', status: 403,
      });
    }
    await render(ctx, views.editPage(ctx, { item }), { title: 'Edit' });
  },

  '/login': async (ctx) => {
    if (ctx.user) return redirect(ctx.res, safeGoto(ctx.query.get('next')));
    await render(ctx, views.loginPage(ctx, { next: safeGoto(ctx.query.get('next')) }), { title: 'Log in' });
  },

  '/user': async (ctx) => {
    const id = ctx.query.get('id') || ctx.user?.id;
    const profile = id ? await db.getUser(id) : null;
    if (!profile) return render(ctx, views.notFoundPage(), { title: 'No such handle', status: 404 });
    await render(
      ctx,
      views.userPage(ctx, {
        profile,
        stats: await db.userStats(profile.id),
        isSelf: ctx.user?.id === profile.id,
        saved: ctx.query.get('saved') === '1',
      }),
      { title: profile.id },
    );
  },

  '/submitted': listing({
    query: async (ctx, o) => db.userSubmissions(ctx.query.get('id') || '', o),
    heading: (ctx) => `Submissions by ${ctx.query.get('id')}`,
    basePath: (ctx) => `/submitted?id=${encodeURIComponent(ctx.query.get('id') || '')}`,
    title: (ctx) => `${ctx.query.get('id')}'s submissions`,
  }),

  '/threads': async (ctx) => {
    const id = ctx.query.get('id') || ctx.user?.id;
    if (!id) return redirect(ctx.res, `${u('/login')}?next=${encodeURIComponent(u('/threads'))}`);
    const page = pageParam(ctx);
    const { items, total } = await db.userComments(id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    await db.withStoryTitles(items);
    await render(
      ctx,
      views.commentsFeedPage(ctx, {
        items, page, total,
        heading: `Comments by ${id}`,
        basePath: `/threads?id=${encodeURIComponent(id)}`,
        voted: await votedSet(ctx, items),
      }),
      { title: `${id}'s comments` },
    );
  },

  '/favorites': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const page = pageParam(ctx);
    const items = await db.listFavorites(ctx.user.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    await render(
      ctx,
      views.listingPage(ctx, {
        heading: 'Favorites',
        blurb: 'Items you saved.',
        items, page,
        total: await db.countFavorites(ctx.user.id),
        basePath: '/favorites',
        voted: await votedSet(ctx, items),
      }),
      { title: 'Favorites' },
    );
  },

  '/search': async (ctx) => {
    const query = (ctx.query.get('q') || '').trim().slice(0, 120);
    const page = pageParam(ctx);
    const result = query
      ? await db.search(query, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      : { items: [], total: 0 };
    await render(
      ctx,
      views.searchPage(ctx, { query, items: result.items, page, total: result.total, voted: await votedSet(ctx, result.items) }),
      { title: query ? `Search: ${query}` : 'Search' },
    );
  },

  '/about': async (ctx) => render(ctx, views.aboutPage(ctx, { stats: await db.siteStats() }), { title: 'About' }),
  '/guidelines': async (ctx) => render(ctx, views.guidelinesPage(), { title: 'Guidelines' }),
  '/api': async (ctx) => render(ctx, views.apiPage(), { title: 'API' }),

  '/rss': async (ctx) => {
    const { items } = await db.frontPage({ limit: 30 });
    sendText(ctx.res, rssFeed(ctx, items), { type: 'application/rss+xml; charset=utf-8' });
  },

  /* ---- review, scouts, agents, issues ---- */

  '/review': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    if (!review.canReview(ctx.user)) {
      return render(ctx, views.errorPage('The queue is for reviewers.'), { title: 'Review', status: 403 });
    }
    const items = await review.pendingQueue();
    await render(ctx, views.reviewPage(ctx, { items }), { title: 'Review queue' });
  },

  '/queue': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const items = await review.pendingFor(ctx.user.id);
    await render(ctx, views.queuePage(ctx, { items }), { title: 'Your queue' });
  },

  '/scouts': async (ctx) => {
    const leaders = await points.leaderboard();
    await render(ctx, views.scoutsPage(ctx, { leaders, rewards: points.REWARDS }), { title: 'Scouts' });
  },

  '/points': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    await render(
      ctx,
      views.pointsPage(ctx, {
        balance: await points.balanceOf(ctx.user.id),
        ledger: await points.ledgerFor(ctx.user.id),
        rewards: points.REWARDS,
        redemptions: await points.redemptionsFor(ctx.user.id),
        error: ctx.query.get('error'),
      }),
      { title: 'Your points' },
    );
  },

  '/agents': async (ctx) => {
    await render(ctx, views.agentsPage(ctx, { agents: AGENTS, status: await agentStatus() }), {
      title: 'The agents',
    });
  },

  '/agent': async (ctx) => {
    const agent = agentByKey(ctx.query.get('key') || '');
    if (!agent) return render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
    const page = pageParam(ctx);
    const { items, total } = await db.byAgent(agent.key, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    await render(
      ctx,
      views.listingPage(ctx, {
        heading: agent.label,
        blurb: agent.about,
        items, page, total,
        basePath: `/agent?key=${agent.key}`,
        voted: await votedSet(ctx, items),
      }),
      { title: agent.label },
    );
  },

  '/bench-notes': (ctx) => digestRoute(ctx, 'bench-notes'),
  '/field-notes': (ctx) => digestRoute(ctx, 'field-notes'),
  '/live': (ctx) => digestRoute(ctx, 'live'),

  '/health': async (ctx) => sendJson(ctx.res, { ok: true, ...(await db.siteStats()), now: nowSeconds() }),

  '/robots.txt': async (ctx) =>
    sendText(ctx.res, `User-agent: *\nAllow: ${u('/')}\nDisallow: ${u('/login')}\nDisallow: ${u('/submit')}\nSitemap: ${origin(ctx)}${u('/rss')}\n`),

  /* ---- JSON read API ---- */
  '/api/stories': async (ctx) => {
    const limit = clampInt(ctx.query.get('limit'), 1, 100, PAGE_SIZE);
    const page = pageParam(ctx);
    const offset = (page - 1) * limit;
    const topic = db.normalizeTopic(ctx.query.get('topic'));
    const sort = ctx.query.get('sort') || 'top';
    const result =
      sort === 'new' ? await db.newest({ limit, offset, topic })
      : sort === 'best' ? await db.bestStories({ limit, offset })
      : sort === 'ask' ? await db.byKind('ask', { limit, offset })
      : sort === 'show' ? await db.byKind('show', { limit, offset })
      : await db.frontPage({ limit, offset, topic });
    sendJson(ctx.res, {
      ok: true, sort, page, total: result.total,
      stories: result.items.map(publicItem),
    });
  },

  '/api/topics': async (ctx) => {
    const topics = [];
    for (const t of db.TOPICS) {
      const { total } = await db.frontPage({ limit: 1, topic: t.slug });
      topics.push({ ...t, count: total });
    }
    sendJson(ctx.res, { ok: true, topics });
  },

  '/api/search': async (ctx) => {
    const query = (ctx.query.get('q') || '').trim().slice(0, 120);
    if (!query) return sendJson(ctx.res, { ok: false, error: 'q is required' }, { status: 400 });
    const limit = clampInt(ctx.query.get('limit'), 1, 100, PAGE_SIZE);
    const page = pageParam(ctx);
    const { items, total } = await db.search(query, { limit, offset: (page - 1) * limit });
    sendJson(ctx.res, { ok: true, query, total, results: items.map(publicItem) });
  },
};

/** One handler for all three issues: index when no `i`, otherwise that issue. */
async function digestRoute(ctx, kind) {
  const spec = digests.KINDS[kind];
  const slug = ctx.query.get('i');

  if (!slug) {
    const latest = await digests.latestDigest(kind);
    if (!latest) {
      return render(ctx, views.digestIndexPage(ctx, { kind, spec, issues: [] }), { title: spec.title });
    }
    const items = await digests.itemsOf(latest);
    return render(
      ctx,
      views.digestPage(ctx, { spec, issue: latest, items, voted: await votedSet(ctx, items) }),
      { title: latest.title, description: latest.intro },
    );
  }

  if (slug === 'all') {
    const issues = await digests.listDigests(kind);
    return render(ctx, views.digestIndexPage(ctx, { kind, spec, issues }), { title: spec.title });
  }

  const issue = await digests.getDigest(kind, slug);
  if (!issue) return render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
  const items = await digests.itemsOf(issue);
  return render(
    ctx,
    views.digestPage(ctx, { spec, issue, items, voted: await votedSet(ctx, items) }),
    { title: issue.title, description: issue.intro },
  );
}

/**
 * Everything under `ancestorId`, resolved from the story's already-loaded
 * comment list — the whole subtree without going back to the database.
 */
function descendantsOf(comments, ancestorId) {
  const byParent = new Map();
  for (const comment of comments) {
    if (!byParent.has(comment.parent_id)) byParent.set(comment.parent_id, []);
    byParent.get(comment.parent_id).push(comment);
  }
  const out = [];
  const queue = [...(byParent.get(ancestorId) ?? [])];
  while (queue.length) {
    const node = queue.shift();
    out.push(node);
    queue.push(...(byParent.get(node.id) ?? []));
  }
  return out;
}

async function apiItemHandler(ctx, id) {
  const item = await db.getItem(id);
  if (!item || item.deleted) return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
  const payload = publicItem(item);
  if (item.type === 'story') payload.comments = (await db.commentTree(item.id)).map(publicItem);
  sendJson(ctx.res, { ok: true, item: payload });
}

async function apiUserHandler(ctx, id) {
  const profile = await db.getUser(id);
  if (!profile) return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
  const stats = await db.userStats(profile.id);
  sendJson(ctx.res, {
    ok: true,
    user: {
      id: profile.id,
      karma: profile.karma,
      about: profile.about,
      created_at: profile.created_at,
      submissions: stats.stories || 0,
      comments: stats.comments || 0,
    },
  });
}

function publicItem(item) {
  return {
    id: item.id,
    type: item.type,
    kind: item.kind,
    by: item.by,
    created_at: item.created_at,
    title: item.title ?? undefined,
    url: item.url ?? undefined,
    domain: item.domain ?? undefined,
    text: item.text ?? undefined,
    topic: item.topic ?? undefined,
    points: item.points,
    comment_count: item.comment_count,
    parent_id: item.parent_id ?? undefined,
    story_id: item.story_id ?? undefined,
    depth: item.depth,
  };
}

function origin(ctx) {
  const proto = ctx.req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${ctx.req.headers.host || 'localhost'}`;
}

function rssFeed(ctx, items) {
  const base = origin(ctx);
  const entries = items
    .map(
      (item) => `    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(item.url || `${base}${u('/item')}?id=${item.id}`)}</link>
      <guid isPermaLink="false">haus-news-${item.id}</guid>
      <pubDate>${new Date(item.created_at * 1000).toUTCString()}</pubDate>
      <dc:creator>${esc(item.by)}</dc:creator>
      <description>${esc(
        `${item.points} points, ${item.comment_count} comments — ${base}${u('/item')}?id=${item.id}${item.text ? ` — ${item.text.slice(0, 400)}` : ''}`,
      )}</description>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${base}${u('/')}</link>
    <description>${esc(TAGLINE)} Community-ranked biotech, synthetic biology and DIYbio.</description>
    <language>en</language>
${entries}
  </channel>
</rss>`;
}

/* ---------------------------------------------------------- POST handlers */

const POST_ROUTES = {
  '/login': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    const next = safeGoto(fields.next);
    const mode = fields.mode === 'signup' ? 'signup' : 'login';
    const id = (fields.id || '').trim();
    const password = fields.password || '';

    const bucket = mode === 'signup' ? LIMITS.signup : LIMITS.login;
    if (!rateLimit(`${mode}:${ctx.ip}`, bucket)) {
      return render(ctx, views.loginPage(ctx, { error: 'Too many attempts. Wait a few minutes.', next, mode, values: { id } }), {
        title: 'Log in', status: 429,
      });
    }

    const fail = (message, status = 400) =>
      render(ctx, views.loginPage(ctx, { error: message, next, mode, values: { id } }), { title: 'Log in', status });

    if (mode === 'signup') {
      const idError = validateUsername(id);
      if (idError) return fail(idError);
      const pwError = validatePassword(password);
      if (pwError) return fail(pwError);
      if (await db.getUser(id)) return fail('That handle is taken.');
      const founding = review.isFoundingAdmin(id);
      const user = await db.createUser({
        id,
        passwordHash: hashPassword(password),
        isAdmin: founding,
        trusted: founding,
      });
      return finishLogin(ctx, user, next);
    }

    const user = await db.getUser(id);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail('Bad handle or passphrase.', 401);
    }
    if (user.banned) return fail('That handle is banned.', 403);
    return finishLogin(ctx, user, next);
  },

  '/logout': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    if (ctx.user && !checkCsrf(ctx.token, fields.csrf)) return redirect(ctx.res, u('/'));
    await destroySession(ctx.token);
    redirect(ctx.res, u('/'), { headers: { 'set-cookie': clearCookie() } });
  },

  '/submit': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;

    const values = {
      title: (fields.title || '').trim(),
      url: (fields.url || '').trim(),
      text: (fields.text || '').trim(),
      topic: db.normalizeTopic(fields.topic),
    };
    const fail = (message) =>
      render(ctx, views.submitPage(ctx, { values, error: message }), { title: 'Submit', status: 400 });

    if (!rateLimit(`submit:${ctx.user.id}`, LIMITS.submit)) {
      return fail('You have hit the submission limit for this hour. Let the culture grow.');
    }
    if (values.title.length < 6) return fail('Give it a real title (6 characters or more).');
    if (values.title.length > 120) return fail('Titles cap at 120 characters.');
    if (!values.url && !values.text) return fail('Supply a URL or some text.');
    if (values.url && values.text) return fail('URL or text — not both. Put context in the first comment.');
    if (values.text.length > 12_000) return fail('That text is too long. Link to it instead.');

    let normalizedUrl = null;
    if (values.url) {
      normalizedUrl = normalizeUrl(values.url);
      if (!normalizedUrl) return fail('That URL does not parse. http(s) links only.');
      const existing = await db.findByUrl(normalizedUrl);
      if (existing) return redirect(ctx.res, `${u('/item')}?id=${existing.id}`);
    }

    const reviewState = review.initialReviewState(ctx.user);
    const id = await db.createStory({
      by: ctx.user.id,
      title: values.title,
      url: normalizedUrl,
      text: values.text || null,
      topic: values.topic,
      kind: detectKind(values.title, normalizedUrl),
      surfacedBy: ctx.user.id,
      reviewState,
    });
    invalidateTicker();
    if (reviewState === 'pending') {
      return redirect(ctx.res, `${u('/queue')}?flash=${encodeURIComponent('Submitted. A reviewer will look at it shortly.')}`);
    }
    await points.award({ userId: ctx.user.id, reason: 'surfaced-approved', itemId: id });
    redirect(ctx.res, `${u('/item')}?id=${id}`);
  },

  '/review': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    if (!review.canReview(ctx.user)) {
      return render(ctx, views.errorPage('The queue is for reviewers.'), { status: 403 });
    }

    const id = Number(fields.id);
    const note = (fields.note || '').trim().slice(0, 200) || null;
    const result =
      fields.verdict === 'approve'
        ? await review.approve(id, ctx.user.id, { note })
        : await review.reject(id, ctx.user.id, { note });

    invalidateTicker();
    const flash = result.ok
      ? fields.verdict === 'approve' ? 'Approved.' : 'Rejected.'
      : result.error;
    redirect(ctx.res, `${u('/review')}?flash=${encodeURIComponent(flash)}`);
  },

  '/redeem': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;

    const result = await points.redeem(ctx.user.id, fields.reward, {
      note: (fields.note || '').trim().slice(0, 200) || null,
    });
    if (!result.ok) {
      return redirect(ctx.res, `${u('/points')}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(
      ctx.res,
      `${u('/points')}?flash=${encodeURIComponent(`Requested: ${result.redemption.reward.label}. We will be in touch.`)}`,
    );
  },

  /**
   * Channel intake. Token-authenticated, so it is exempt from the CSRF check
   * that protects browser forms — there is no session and no cookie here.
   */
  '/api/surface': async (ctx) => {
    if (!tokenOk(bearer(ctx.req.headers.authorization), process.env.NEWS_INTAKE_TOKEN)) {
      return sendJson(ctx.res, { ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!rateLimit(`intake:${ctx.ip}`, { limit: 60, windowMs: 60 * 60_000 })) {
      return sendJson(ctx.res, { ok: false, error: 'rate limited' }, { status: 429 });
    }

    const { fields } = await readBody(ctx.req);
    const result = await surface({
      url: fields.url,
      title: fields.title,
      handle: fields.handle,
      channel: (fields.channel || 'Discord').slice(0, 24),
      topic: fields.topic,
    });
    invalidateTicker();
    sendJson(ctx.res, result, { status: result.ok ? 200 : 400 });
  },

  '/comment': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;

    const parent = await db.getItem(fields.parent);
    const text = (fields.text || '').trim();
    if (!parent || parent.deleted) return render(ctx, views.notFoundPage(), { status: 404 });
    const storyId = parent.type === 'story' ? parent.id : parent.story_id;

    if (!text) return redirect(ctx.res, `${u('/item')}?id=${storyId}`);
    if (text.length > 12_000) {
      return render(ctx, views.errorPage('That comment is too long (12,000 character cap).'), { status: 400 });
    }
    if (!rateLimit(`comment:${ctx.user.id}`, LIMITS.comment)) {
      return render(ctx, views.errorPage('You are commenting too fast. Take a breath.'), { status: 429 });
    }

    const id = await db.createComment({ by: ctx.user.id, parentId: parent.id, text });
    invalidateTicker();
    redirect(ctx.res, `${u('/item')}?id=${storyId}#c${id}`);
  },

  '/vote': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    const id = Number(fields.id);
    if (fields.dir === 'down') await db.unvote(ctx.user.id, id);
    else await db.vote(ctx.user.id, id);
    redirect(ctx.res, safeGoto(fields.goto));
  },

  '/flag': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    await db.toggleFlag(ctx.user.id, Number(fields.id));
    redirect(ctx.res, safeGoto(fields.goto));
  },

  '/favorite': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    await db.toggleFavorite(ctx.user.id, Number(fields.id));
    redirect(ctx.res, safeGoto(fields.goto));
  },

  '/edit': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    const item = await db.getItem(fields.id);
    if (!item) return render(ctx, views.notFoundPage(), { status: 404 });
    if (!db.canEdit(item, ctx.user)) {
      return render(ctx, views.errorPage('The edit window has closed.'), { title: 'Locked', status: 403 });
    }
    const title = item.type === 'story' ? (fields.title || '').trim().slice(0, 120) : null;
    if (item.type === 'story' && title.length < 6) {
      return render(ctx, views.editPage(ctx, { item, error: 'Give it a real title.' }), { status: 400 });
    }
    await db.editItem(item.id, {
      title,
      text: (fields.text || '').trim() || null,
      topic: item.type === 'story' ? db.normalizeTopic(fields.topic) : null,
    });
    invalidateTicker();
    redirect(ctx.res, `${u('/item')}?id=${item.type === 'story' ? item.id : item.story_id}`);
  },

  '/delete': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    const item = await db.getItem(fields.id);
    if (!item) return render(ctx, views.notFoundPage(), { status: 404 });
    if (!db.canEdit(item, ctx.user)) {
      return render(ctx, views.errorPage('The delete window has closed.'), { title: 'Locked', status: 403 });
    }
    await db.deleteItem(item.id);
    invalidateTicker();
    redirect(ctx.res, item.type === 'story' ? u('/newest') : `${u('/item')}?id=${item.story_id}`);
  },

  '/user': async (ctx) => {
    if (!(await requireUser(ctx))) return;
    const { fields } = await readBody(ctx.req);
    if (!(await guard(ctx, fields))) return;
    await db.updateUser(ctx.user.id, { about: (fields.about || '').slice(0, 2000) });
    redirect(ctx.res, `${u('/user')}?id=${encodeURIComponent(ctx.user.id)}&saved=1`);
  },

  /* ---- JSON write API ---- */
  '/api/vote': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    if (!ctx.user) return sendJson(ctx.res, { ok: false, error: 'sign in to vote' }, { status: 401 });
    if (!apiCsrfOk(ctx, fields)) return sendJson(ctx.res, { ok: false, error: 'bad csrf token' }, { status: 403 });
    const id = Number(fields.id);
    if (!Number.isInteger(id)) return sendJson(ctx.res, { ok: false, error: 'id is required' }, { status: 400 });
    const result = fields.dir === 'down' ? await db.unvote(ctx.user.id, id) : await db.vote(ctx.user.id, id);
    sendJson(ctx.res, result, { status: result.ok ? 200 : 400 });
  },

  '/api/submit': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    if (!ctx.user) return sendJson(ctx.res, { ok: false, error: 'sign in to submit' }, { status: 401 });
    if (!apiCsrfOk(ctx, fields)) return sendJson(ctx.res, { ok: false, error: 'bad csrf token' }, { status: 403 });
    if (!rateLimit(`submit:${ctx.user.id}`, LIMITS.submit)) {
      return sendJson(ctx.res, { ok: false, error: 'submission rate limit' }, { status: 429 });
    }
    const title = (fields.title || '').trim();
    const url = fields.url ? normalizeUrl(fields.url) : null;
    const text = (fields.text || '').trim() || null;
    if (title.length < 6) return sendJson(ctx.res, { ok: false, error: 'title too short' }, { status: 400 });
    if (fields.url && !url) return sendJson(ctx.res, { ok: false, error: 'invalid url' }, { status: 400 });
    if (!url && !text) return sendJson(ctx.res, { ok: false, error: 'url or text required' }, { status: 400 });
    const id = await db.createStory({
      by: ctx.user.id, title, url, text,
      topic: db.normalizeTopic(fields.topic),
      kind: detectKind(title, url),
    });
    invalidateTicker();
    sendJson(ctx.res, { ok: true, item: publicItem(await db.getItem(id)) }, { status: 201 });
  },

  '/api/comment': async (ctx) => {
    const { fields } = await readBody(ctx.req);
    if (!ctx.user) return sendJson(ctx.res, { ok: false, error: 'sign in to comment' }, { status: 401 });
    if (!apiCsrfOk(ctx, fields)) return sendJson(ctx.res, { ok: false, error: 'bad csrf token' }, { status: 403 });
    if (!rateLimit(`comment:${ctx.user.id}`, LIMITS.comment)) {
      return sendJson(ctx.res, { ok: false, error: 'comment rate limit' }, { status: 429 });
    }
    const parent = await db.getItem(fields.parent);
    const text = (fields.text || '').trim();
    if (!parent || parent.deleted) return sendJson(ctx.res, { ok: false, error: 'no such parent' }, { status: 404 });
    if (!text) return sendJson(ctx.res, { ok: false, error: 'text is required' }, { status: 400 });
    const id = await db.createComment({ by: ctx.user.id, parentId: parent.id, text });
    invalidateTicker();
    sendJson(ctx.res, { ok: true, item: publicItem(await db.getItem(id)) }, { status: 201 });
  },
};

function apiCsrfOk(ctx, fields) {
  const header = ctx.req.headers['x-csrf-token'];
  return checkCsrf(ctx.token, typeof header === 'string' ? header : fields.csrf);
}

async function finishLogin(ctx, user, next) {
  const token = await createSession(user.id);
  redirect(ctx.res, next || u('/'), {
    headers: { 'set-cookie': sessionCookie(token, { secure: SECURE_COOKIES }) },
  });
}

/** "Ask BN: ..." / "Show BN: ..." route a submission into its channel. */
export function detectKind(title, url) {
  const t = (title || '').trim().toLowerCase();
  if (/^ask\s*(bn|hn)?\s*[:\-]/.test(t)) return 'ask';
  if (/^show\s*(bn|hn)?\s*[:\-]/.test(t)) return 'show';
  if (!url) return 'ask';
  return 'link';
}
