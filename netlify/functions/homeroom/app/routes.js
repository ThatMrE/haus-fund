/*
 * The members-only surfaces. app.js owns the session and the pre-login pages
 * and hands anything else here.
 *
 * The table is a list of [method, pattern, handler]. Patterns are literal
 * paths or `:param` segments; the first match wins, so the concrete routes
 * (/library/new) are listed before the wildcards (/library/:slug).
 */

import { sendHtml, sendJson, readBody, rateLimit } from './http.js';
import { checkCsrf } from './auth.js';
import { clampInt, nowSeconds, normalizeUrl } from './util.js';
import * as bf from './models.js';
import { homeroomLayout } from './views/layout.js';
import * as views from './views/pages.js';
import { parseWhen, toLocalInput } from './views/components.js';

const PER_PAGE = bf.PAGE_SIZE;

const LIMITS = {
  post: { limit: 10, windowMs: 60 * 60_000 },
  comment: { limit: 40, windowMs: 10 * 60_000 },
  message: { limit: 60, windowMs: 10 * 60_000 },
  create: { limit: 20, windowMs: 60 * 60_000 },
};

/* ------------------------------------------------------------- plumbing */

export function render(ctx, content, { title, description, status = 200, flash, error, subnav } = {}) {
  ctx.badges = ctx.user
    ? {
        messages: bf.unreadMessageCount(ctx.user.id),
        notifications: bf.unreadNotificationCount(ctx.user.id) + bf.pendingIntroCount(ctx.user.id),
      }
    : {};
  sendHtml(
    ctx.res,
    homeroomLayout(ctx, {
      title,
      description,
      content,
      subnav,
      flash: flash ?? ctx.query?.get('flash') ?? undefined,
      error,
    }),
    { status },
  );
}

const notFound = (ctx) => render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
const oops = (ctx, message, status = 400) => render(ctx, views.errorPage(message), { title: 'Error', status });

function seeOther(ctx, location) {
  ctx.res.writeHead(303, { location });
  ctx.res.end();
}

/** Only ever bounce back to our own paths. */
function safeGoto(value, fallback = '/homeroom') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

/** Members-only: no session, no network. */
function gate(ctx) {
  if (ctx.user) {
    bf.ensureMember(ctx.user.id);
    return true;
  }
  if (ctx.req.method === 'POST') {
    seeOther(ctx, `/homeroom/login?next=${encodeURIComponent(ctx.fullPath || '/homeroom')}`);
    return false;
  }
  render(ctx, views.gatePage(ctx, { stats: bf.networkStats() }), { title: 'Members only' });
  return false;
}

function csrfOk(ctx, fields) {
  if (checkCsrf(ctx.token, fields.csrf)) return true;
  oops(ctx, 'That form expired. Go back, reload and try again.', 403);
  return false;
}

function limited(ctx, key, bucket) {
  if (rateLimit(`bf:${key}:${ctx.user.id}`, bucket)) return false;
  oops(ctx, 'You are doing that too fast. Give it a minute.', 429);
  return true;
}

const pageParam = (ctx) => clampInt(ctx.query.get('p'), 1, 500, 1);
const offsetFor = (page) => (page - 1) * PER_PAGE;
const checkbox = (value) => value === '1' || value === 'on' || value === 'true';
const trimmed = (value, max) => String(value || '').trim().slice(0, max);

/* -------------------------------------------------------------- the feed */

function homeHandler(ctx) {
  const member = bf.ensureMember(ctx.user.id);
  bf.touchMember(ctx.user.id);
  const { posts } = bf.feed({ sort: 'hot', limit: 12 });
  const voted = bf.votedIds(ctx.user.id, 'post', posts.map((p) => p.id));
  render(
    ctx,
    views.homePage(ctx, {
      member,
      posts,
      voted,
      stats: bf.networkStats(),
      upcomingSlots: bf.listSlots({ upcoming: true, limit: 5 }),
      upcomingEvents: bf.listEvents({ upcoming: true, limit: 5 }),
      myOrgs: bf.userOrgs(ctx.user.id),
      deals: bf.listDeals({ limit: 5 }).deals,
      updates: bf.recentUpdates(4),
      answerers: bf.topAnswerers(6),
      intros: bf.introsFor(ctx.user.id).incoming.filter((i) => i.status === 'pending'),
      unansweredCount: bf.feed({ unanswered: true, kind: 'question', limit: 1 }).total,
      profileComplete: !!(member.headline && (member.expertise || []).length),
    }),
    { title: 'Home' },
  );
}

function forumHandler(ctx) {
  const page = pageParam(ctx);
  const category = ctx.query.get('category') || '';
  const kind = ctx.query.get('kind') || '';
  const tag = ctx.query.get('tag') || '';
  const sort = ctx.query.get('sort') || 'hot';
  const unanswered = ctx.query.get('unanswered') === '1';
  const { posts, total } = bf.feed({
    sort, category, kind, tag, unanswered, limit: PER_PAGE, offset: offsetFor(page),
  });
  const params = new URLSearchParams();
  for (const [key, value] of [['category', category], ['kind', kind], ['tag', tag],
    ['sort', sort === 'hot' ? '' : sort], ['unanswered', unanswered ? '1' : '']]) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  render(
    ctx,
    views.forumPage(ctx, {
      posts,
      voted: bf.votedIds(ctx.user.id, 'post', posts.map((p) => p.id)),
      total, page, sort, category, kind, tag, unanswered,
      counts: bf.categoryCounts(),
      tags: bf.tagCloud(24),
      basePath: `/homeroom/forum${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Forum' },
  );
}

function postHandler(ctx, { id }) {
  const post = bf.getPost(id);
  if (!post || post.deleted) return notFound(ctx);
  bf.bumpViews(post.id);
  const comments = bf.commentTree(post.id);
  render(
    ctx,
    views.postPage(ctx, {
      post,
      comments,
      voted: bf.hasVoted(ctx.user.id, 'post', post.id),
      commentVoted: bf.votedIds(ctx.user.id, 'comment', comments.map((c) => c.id)),
      options: post.kind === 'poll' ? bf.pollOptions(post.id) : [],
      myOption: bf.myPollVote(post.id, ctx.user.id),
      following: bf.isFollowing(ctx.user.id, 'post', post.id),
      saved: bf.isSaved(ctx.user.id, 'post', post.id),
      canEdit: post.author_id === ctx.user.id || !!ctx.user.is_admin,
      isAuthor: post.author_id === ctx.user.id,
    }),
    { title: post.title },
  );
}

function askFormHandler(ctx) {
  render(
    ctx,
    views.composePage(ctx, { values: Object.fromEntries(ctx.query), orgs: bf.userOrgs(ctx.user.id) }),
    { title: 'New post' },
  );
}

async function askSubmitHandler(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'post', LIMITS.post)) return;

  const values = {
    title: trimmed(fields.title, 160),
    body: trimmed(fields.body, 20_000),
    kind: bf.normalizeKind(fields.kind),
    category: bf.normalizeCategory(fields.category),
    tags: fields.tags || '',
    org: fields.org || '',
    options: fields.options || '',
    anonymous: checkbox(fields.anonymous),
  };
  const fail = (message) =>
    render(ctx, views.composePage(ctx, { values, error: message, orgs: bf.userOrgs(ctx.user.id) }),
      { title: 'New post', status: 400 });

  if (values.title.length < 8) return fail('Give it a real title — eight characters or more.');
  const options = values.options.split('\n').map((line) => trimmed(line, 120)).filter(Boolean);
  if (values.kind === 'poll' && options.length < 2) return fail('A poll needs at least two options.');

  const orgId = Number(values.org) || null;
  if (orgId && !bf.isOrgMember(orgId, ctx.user.id)) return fail('You are not listed with that lab.');

  const id = bf.createPost({
    authorId: ctx.user.id,
    kind: values.kind,
    category: values.category,
    title: values.title,
    body: values.body,
    orgId,
    anonymous: values.anonymous,
    tags: bf.parseTags(values.tags),
    options,
  });
  seeOther(ctx, `/homeroom/post/${id}`);
}

async function editPostSubmit(ctx, { id }) {
  const post = bf.getPost(id);
  if (!post || post.deleted) return notFound(ctx);
  if (post.author_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Not yours to edit.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const title = trimmed(fields.title, 160);
  if (title.length < 8) {
    return render(ctx, views.editPostPage(ctx, { post, error: 'Give it a real title.' }), { status: 400 });
  }
  bf.editPost(post.id, {
    title,
    body: trimmed(fields.body, 20_000),
    category: bf.normalizeCategory(fields.category),
    tags: bf.parseTags(fields.tags),
  });
  seeOther(ctx, `/homeroom/post/${post.id}`);
}

async function commentSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'comment', LIMITS.comment)) return;
  const post = bf.getPost(fields.post);
  if (!post || post.deleted) return notFound(ctx);
  if (post.locked) return oops(ctx, 'That thread is locked.', 403);
  const text = trimmed(fields.text, 20_000);
  if (!text) return seeOther(ctx, `/homeroom/post/${post.id}`);
  const parentId = fields.parent ? Number(fields.parent) : null;
  if (parentId && bf.getComment(parentId)?.post_id !== post.id) return notFound(ctx);

  const anonymous = checkbox(fields.anonymous);
  const id = bf.createComment({ postId: post.id, parentId, authorId: ctx.user.id, body: text, anonymous });
  const who = anonymous ? 'An anonymous member' : ctx.user.id;
  bf.notifyFollowers({
    postId: post.id,
    actorId: ctx.user.id,
    text: `${who} replied to “${post.title}”`,
    href: `/homeroom/post/${post.id}#c${id}`,
  });
  // Replying subscribes you to the thread, but never unsubscribes you.
  if (!bf.isFollowing(ctx.user.id, 'post', post.id)) bf.toggleFollow(ctx.user.id, 'post', post.id);
  seeOther(ctx, `/homeroom/post/${post.id}#c${id}`);
}

/* ------------------------------------------------------------- directory */

function peopleHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    tag: ctx.query.get('tag') || '',
    cohort: ctx.query.get('cohort') || '',
    location: ctx.query.get('location') || '',
    open: ctx.query.get('open') || '',
  };
  const { members, total } = bf.searchMembers({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  render(
    ctx,
    views.peoplePage(ctx, {
      members, total, page, filters,
      tags: bf.expertiseCloud(30),
      cohortList: bf.cohorts(),
      basePath: `/homeroom/people${qs ? `?${qs}` : ''}`,
    }),
    { title: 'People' },
  );
}

function memberHandler(ctx, { handle }) {
  const profile = bf.getMember(handle);
  if (!profile) return notFound(ctx);
  const isSelf = ctx.user.id.toLowerCase() === profile.user_id.toLowerCase();
  const outgoing = bf.introsFor(ctx.user.id).outgoing;
  const posts = bf.feed({ author: profile.user_id, sort: 'new', limit: 8 }).posts.filter((p) => !p.anonymous);
  render(
    ctx,
    views.memberPage(ctx, {
      profile,
      orgs: bf.userOrgs(profile.user_id),
      posts,
      voted: bf.votedIds(ctx.user.id, 'post', posts.map((p) => p.id)),
      comments: bf.userComments(profile.user_id, { limit: 6 }).filter((c) => !c.anonymous),
      slots: bf.listSlots({ upcoming: true, hostId: profile.user_id, limit: 5 }),
      isSelf,
      introSent: outgoing.some((i) => i.target_id === profile.user_id && i.status === 'pending'),
      canRequestIntro: !isSelf && !!profile.open_intros
        && !outgoing.some((i) => i.target_id === profile.user_id && i.status === 'pending'),
      threadId: isSelf ? null : bf.findDirectThread(ctx.user.id, profile.user_id),
    }),
    { title: profile.name || profile.user_id },
  );
}

async function settingsSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  bf.updateMember(ctx.user.id, {
    name: trimmed(fields.name, 80),
    headline: trimmed(fields.headline, 140),
    org: trimmed(fields.org, 80),
    role: trimmed(fields.role, 80),
    cohort: trimmed(fields.cohort, 12) || null,
    location: trimmed(fields.location, 80),
    bio: trimmed(fields.bio, 4000),
    working_on: trimmed(fields.working_on, 2000),
    ask_me_about: trimmed(fields.ask_me_about, 2000),
    bsl: trimmed(fields.bsl, 24) || null,
    links: (fields.links || '').split(',').map((l) => normalizeUrl(l.trim())).filter(Boolean).slice(0, 8).join(','),
    expertise: bf.parseTags(fields.expertise, 12),
    open_intros: checkbox(fields.open_intros),
    open_hours: checkbox(fields.open_hours),
    open_collab: checkbox(fields.open_collab),
    open_hiring: checkbox(fields.open_hiring),
  });
  seeOther(ctx, '/homeroom/settings?saved=1');
}

/* ------------------------------------------------------------------ labs */

function labsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    kind: ctx.query.get('kind') || '',
    stage: ctx.query.get('stage') || '',
    tag: ctx.query.get('tag') || '',
  };
  const { orgs, total } = bf.searchOrgs({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  render(ctx, views.labsPage(ctx, { orgs, total, page, filters, basePath: `/homeroom/labs${qs ? `?${qs}` : ''}` }),
    { title: 'Labs' });
}

function labHandler(ctx, { slug }) {
  const org = bf.getOrg(slug);
  if (!org) return notFound(ctx);
  const posts = bf.feed({ sort: 'new', orgId: org.id, limit: 6 }).posts;
  render(
    ctx,
    views.labPage(ctx, {
      org,
      team: bf.orgTeam(org.id),
      updates: bf.orgUpdates(org.id, { limit: 10 }),
      jobs: bf.listJobs({ orgId: org.id, limit: 10 }).jobs,
      posts,
      voted: bf.votedIds(ctx.user.id, 'post', posts.map((p) => p.id)),
      isMember: bf.isOrgMember(org.id, ctx.user.id),
      isAdmin: bf.isOrgAdmin(org.id, ctx.user.id) || !!ctx.user.is_admin,
    }),
    { title: org.name },
  );
}

function labFields(fields) {
  return {
    name: trimmed(fields.name, 80),
    tagline: trimmed(fields.tagline, 140),
    description: trimmed(fields.description, 8000),
    kind: bf.labelFor(bf.ORG_KINDS, fields.kind) ? fields.kind : 'startup',
    stage: bf.labelFor(bf.ORG_STAGES, fields.stage) ? fields.stage : 'idea',
    location: trimmed(fields.location, 80),
    website: fields.website ? normalizeUrl(fields.website) : null,
    cohort: trimmed(fields.cohort, 12) || null,
    founded: fields.founded ? clampInt(fields.founded, 1900, 2100, null) : null,
    headcount: fields.headcount ? clampInt(fields.headcount, 1, 100_000, null) : null,
    tags: bf.parseTags(fields.tags, 8).join(','),
  };
}

async function labCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const patch = labFields(fields);
  if (patch.name.length < 2) {
    return render(ctx, views.labFormPage(ctx, { error: 'A lab needs a name.' }), { status: 400 });
  }
  const id = bf.createOrg({ ...patch, createdBy: ctx.user.id });
  seeOther(ctx, `/homeroom/lab/${bf.getOrg(id).slug}`);
}

async function labEdit(ctx, { slug }) {
  const org = bf.getOrg(slug);
  if (!org) return notFound(ctx);
  if (!bf.isOrgAdmin(org.id, ctx.user.id) && !ctx.user.is_admin) return oops(ctx, 'Only lab admins can edit this.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const patch = labFields(fields);
  if (patch.name.length < 2) {
    return render(ctx, views.labFormPage(ctx, { org, error: 'A lab needs a name.' }), { status: 400 });
  }
  bf.updateOrg(org.id, patch);
  seeOther(ctx, `/homeroom/lab/${org.slug}`);
}

async function labUpdatePost(ctx, { slug }) {
  const org = bf.getOrg(slug);
  if (!org) return notFound(ctx);
  if (!bf.isOrgMember(org.id, ctx.user.id)) return oops(ctx, 'Only the team can post updates.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const body = trimmed(fields.body, 8000);
  if (!body) {
    return render(ctx, views.updateFormPage(ctx, { org, error: 'Write something.' }), { status: 400 });
  }
  bf.createUpdate({
    orgId: org.id,
    authorId: ctx.user.id,
    period: trimmed(fields.period, 40),
    body,
    metrics: trimmed(fields.metrics, 200),
    asks: trimmed(fields.asks, 300),
  });
  seeOther(ctx, `/homeroom/lab/${org.slug}`);
}

/* ----------------------------------------------------------------- deals */

function dealsHandler(ctx) {
  const category = ctx.query.get('category') || '';
  const q = ctx.query.get('q') || '';
  const { deals, total } = bf.listDeals({ category, q });
  const claimed = new Set(bf.myClaims(ctx.user.id).map((d) => d.id));
  render(ctx, views.dealsPage(ctx, { deals, total, category, q, claimed }), { title: 'Deals' });
}

function dealHandler(ctx, { slug }) {
  const deal = bf.getDeal(slug);
  if (!deal) return notFound(ctx);
  render(
    ctx,
    views.dealPage(ctx, {
      deal,
      claimed: bf.hasClaimed(deal.id, ctx.user.id),
      claimCount: bf.dealClaimCount(deal.id),
    }),
    { title: `${deal.vendor} — deal` },
  );
}

async function dealCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const values = {
    vendor: trimmed(fields.vendor, 80),
    title: trimmed(fields.title, 140),
    category: bf.labelFor(bf.DEAL_CATEGORIES, fields.category) ? fields.category : 'other',
    summary: trimmed(fields.summary, 200),
    details: trimmed(fields.details, 6000),
    worth: trimmed(fields.worth, 60),
    code: trimmed(fields.code, 80),
    url: fields.url ? normalizeUrl(fields.url) : null,
  };
  if (!values.vendor || values.title.length < 4) {
    return render(ctx, views.dealFormPage(ctx, { values, error: 'Vendor and a real description, please.' }), { status: 400 });
  }
  const id = bf.createDeal({ ...values, postedBy: ctx.user.id });
  seeOther(ctx, `/homeroom/deal/${bf.getDeal(id).slug}`);
}

/* --------------------------------------------------------------- funders */

function fundersHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    kind: ctx.query.get('kind') || '',
    sort: ctx.query.get('sort') || 'rating',
  };
  const { funders, total } = bf.listFunders({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  render(
    ctx,
    views.fundersPage(ctx, {
      funders, total, page, filters,
      tracked: new Set(bf.pipeline(ctx.user.id).map((row) => row.funder_id)),
      basePath: `/homeroom/funders${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Funders' },
  );
}

function funderHandler(ctx, { slug }) {
  const funder = bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  render(
    ctx,
    views.funderPage(ctx, {
      funder,
      reviews: bf.funderReviews(funder.id),
      myReview: bf.myReview(funder.id, ctx.user.id),
      entry: bf.pipelineEntry(ctx.user.id, funder.id),
      orgs: bf.userOrgs(ctx.user.id),
    }),
    { title: funder.name },
  );
}

async function funderCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const values = {
    name: trimmed(fields.name, 120),
    kind: bf.labelFor(bf.FUNDER_KINDS, fields.kind) ? fields.kind : 'vc',
    focus: trimmed(fields.focus, 140),
    stages: trimmed(fields.stages, 80),
    checkSize: trimmed(fields.check_size, 60),
    location: trimmed(fields.location, 80),
    website: fields.website ? normalizeUrl(fields.website) : null,
    description: trimmed(fields.description, 6000),
    dilutive: !checkbox(fields.nondilutive),
  };
  if (values.name.length < 2) {
    return render(ctx, views.funderFormPage(ctx, { values, error: 'Name it.' }), { status: 400 });
  }
  const id = bf.createFunder({ ...values, addedBy: ctx.user.id });
  seeOther(ctx, `/homeroom/funder/${bf.getFunder(id).slug}`);
}

async function reviewSubmit(ctx, { slug }) {
  const funder = bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const rating = clampInt(fields.rating, 1, 5, 0);
  if (!rating) return oops(ctx, 'Pick a rating between 1 and 5.');
  bf.upsertReview({
    funderId: funder.id,
    userId: ctx.user.id,
    rating,
    speed: fields.speed ? clampInt(fields.speed, 1, 5, null) : null,
    valueAdd: fields.value_add ? clampInt(fields.value_add, 1, 5, null) : null,
    invested: checkbox(fields.invested),
    anonymous: checkbox(fields.anonymous),
    body: trimmed(fields.body, 6000),
  });
  seeOther(ctx, `/homeroom/funder/${funder.slug}`);
}

async function trackSubmit(ctx, { slug }) {
  const funder = bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const orgId = Number(fields.org) || null;
  bf.upsertPipeline({
    userId: ctx.user.id,
    funderId: funder.id,
    orgId: orgId && bf.isOrgMember(orgId, ctx.user.id) ? orgId : null,
    status: bf.labelFor(bf.PIPELINE_STATUSES, fields.status) ? fields.status : 'researching',
    amount: trimmed(fields.amount, 60),
    notes: trimmed(fields.notes, 4000),
  });
  seeOther(ctx, `/homeroom/funder/${funder.slug}`);
}

/* ----------------------------------------------------------- office hours */

function hoursHandler(ctx) {
  const slots = bf.listSlots({ upcoming: true, limit: 60 });
  render(
    ctx,
    views.hoursPage(ctx, {
      slots: slots.filter((s) => s.host_id !== ctx.user.id),
      mine: bf.myBookings(ctx.user.id),
      hosting: slots.filter((s) => s.host_id === ctx.user.id),
    }),
    { title: 'Office hours' },
  );
}

function slotHandler(ctx, { id }) {
  const slot = bf.getSlot(id);
  if (!slot) return notFound(ctx);
  const bookings = bf.slotBookings(slot.id);
  render(
    ctx,
    views.slotPage(ctx, {
      slot,
      bookings,
      isHost: slot.host_id === ctx.user.id,
      booked: bookings.some((b) => b.user_id === ctx.user.id),
    }),
    { title: slot.title },
  );
}

async function slotCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const startsAt = parseWhen(fields.starts_at);
  const title = trimmed(fields.title, 120);
  const fail = (message) =>
    render(ctx, views.slotFormPage(ctx, { error: message, defaultStart: fields.starts_at || defaultStart() }),
      { status: 400 });
  if (title.length < 4) return fail('Say what the session is for.');
  if (!startsAt) return fail('That start time did not parse.');
  if (startsAt < nowSeconds()) return fail('Pick a time in the future.');
  const format = fields.format === 'group' ? 'group' : 'one-on-one';
  const id = bf.createSlot({
    hostId: ctx.user.id,
    title,
    description: trimmed(fields.description, 4000),
    format,
    startsAt,
    minutes: clampInt(fields.minutes, 10, 240, 30),
    capacity: format === 'group' ? clampInt(fields.capacity, 1, 50, 5) : 1,
    place: trimmed(fields.place, 200),
    topics: trimmed(fields.topics, 140),
  });
  bf.updateMember(ctx.user.id, { open_hours: true });
  seeOther(ctx, `/homeroom/hours/${id}`);
}

/* ------------------------------------------------------------------ jobs */

function jobsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    discipline: ctx.query.get('discipline') || '',
    remote: ctx.query.get('remote') === '1',
  };
  const { jobs, total } = bf.listJobs({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.discipline) params.set('discipline', filters.discipline);
  if (filters.remote) params.set('remote', '1');
  const qs = params.toString();
  render(
    ctx,
    views.jobsPage(ctx, {
      jobs, total, page, filters,
      canPost: bf.userOrgs(ctx.user.id).length > 0,
      basePath: `/homeroom/jobs${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Jobs' },
  );
}

function jobHandler(ctx, { id }) {
  const job = bf.getJob(id);
  if (!job) return notFound(ctx);
  const canManage = bf.isOrgAdmin(job.org_id, ctx.user.id) || job.posted_by === ctx.user.id;
  render(
    ctx,
    views.jobPage(ctx, {
      job,
      applied: bf.hasApplied(job.id, ctx.user.id),
      applicants: canManage ? bf.jobApplicants(job.id) : [],
      canManage,
    }),
    { title: job.title },
  );
}

async function jobCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const orgs = bf.userOrgs(ctx.user.id);
  const orgId = Number(fields.org) || 0;
  const values = {
    org: fields.org, title: trimmed(fields.title, 120),
    discipline: fields.discipline, employment: fields.employment,
    location: trimmed(fields.location, 80), comp: trimmed(fields.comp, 60),
    equity: trimmed(fields.equity, 40), description: trimmed(fields.description, 12_000),
    tags: fields.tags || '',
  };
  const fail = (message) =>
    render(ctx, views.jobFormPage(ctx, { orgs, values, error: message }), { status: 400 });
  if (!bf.isOrgMember(orgId, ctx.user.id)) return fail('Pick a lab you are listed with.');
  if (values.title.length < 3) return fail('The role needs a title.');
  const id = bf.createJob({
    orgId,
    postedBy: ctx.user.id,
    title: values.title,
    discipline: bf.labelFor(bf.JOB_DISCIPLINES, values.discipline) ? values.discipline : 'other',
    employment: ['full-time', 'part-time', 'contract', 'intern'].includes(values.employment) ? values.employment : 'full-time',
    location: values.location,
    remote: checkbox(fields.remote),
    comp: values.comp,
    equity: values.equity,
    description: values.description,
    tags: bf.parseTags(values.tags, 8).join(','),
  });
  seeOther(ctx, `/homeroom/job/${id}`);
}

/* ---------------------------------------------------------------- events */

function eventsHandler(ctx) {
  const kind = ctx.query.get('kind') || '';
  render(
    ctx,
    views.eventsPage(ctx, {
      events: bf.listEvents({ upcoming: true, kind }),
      past: bf.listEvents({ upcoming: false, kind, limit: 6 }),
      kind,
    }),
    { title: 'Events' },
  );
}

function eventHandler(ctx, { id }) {
  const event = bf.getEvent(id);
  if (!event) return notFound(ctx);
  render(
    ctx,
    views.eventPage(ctx, {
      event,
      attendees: bf.eventAttendees(event.id),
      myStatus: bf.myRsvp(event.id, ctx.user.id),
      isHost: event.host_id === ctx.user.id,
    }),
    { title: event.title },
  );
}

async function eventCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const startsAt = parseWhen(fields.starts_at);
  const title = trimmed(fields.title, 140);
  const fail = (message) =>
    render(ctx, views.eventFormPage(ctx, { error: message, defaultStart: fields.starts_at || defaultStart() }),
      { status: 400 });
  if (title.length < 4) return fail('Give the event a title.');
  if (!startsAt) return fail('That start time did not parse.');
  const id = bf.createEvent({
    hostId: ctx.user.id,
    title,
    description: trimmed(fields.description, 8000),
    kind: bf.labelFor(bf.EVENT_KINDS, fields.kind) ? fields.kind : 'meetup',
    startsAt,
    minutes: clampInt(fields.minutes, 15, 1440, 120),
    place: trimmed(fields.place, 200),
    url: fields.url ? normalizeUrl(fields.url) : null,
    capacity: clampInt(fields.capacity, 0, 10_000, 0),
  });
  bf.rsvp(id, ctx.user.id, 'going');
  seeOther(ctx, `/homeroom/event/${id}`);
}

/* --------------------------------------------------------------- library */

function libraryHandler(ctx) {
  const kind = ctx.query.get('kind') || '';
  const q = ctx.query.get('q') || '';
  render(ctx, views.libraryPage(ctx, { entries: bf.listLibrary({ kind, q }).entries, kind, q }), { title: 'Library' });
}

function libraryEntryHandler(ctx, { slug }) {
  const entry = bf.getLibraryEntry(slug);
  if (!entry) return notFound(ctx);
  bf.bumpReads(entry.id);
  render(ctx, views.libraryEntryPage(ctx, { entry }), { title: entry.title });
}

async function libraryCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const values = {
    title: trimmed(fields.title, 140),
    kind: bf.labelFor(bf.LIBRARY_KINDS, fields.kind) ? fields.kind : 'guide',
    summary: trimmed(fields.summary, 200),
    body: trimmed(fields.body, 60_000),
    tags: fields.tags || '',
  };
  if (values.title.length < 4 || values.body.length < 40) {
    return render(ctx, views.libraryFormPage(ctx, { values, error: 'A title and something worth reading, please.' }),
      { status: 400 });
  }
  const id = bf.createLibraryEntry({ ...values, tags: bf.parseTags(values.tags, 8).join(','), authorId: ctx.user.id });
  seeOther(ctx, `/homeroom/library/${bf.getLibraryEntry(id).slug}`);
}

/* ---------------------------------------------------------------- intros */

async function introCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const target = bf.getMember(fields.to);
  if (!target) return notFound(ctx);
  if (target.user_id === ctx.user.id) return oops(ctx, 'You already know yourself.');
  if (!target.open_intros) return oops(ctx, 'That member is not taking intro requests.', 403);
  const reason = trimmed(fields.reason, 2000);
  if (reason.length < 20) {
    return render(ctx, views.introFormPage(ctx, { target, error: 'Say more than that — twenty characters minimum.' }),
      { status: 400 });
  }
  const result = bf.requestIntro({ requesterId: ctx.user.id, targetId: target.user_id, reason });
  if (!result.ok) return oops(ctx, result.error);
  bf.notify({
    userId: target.user_id,
    kind: 'intro',
    actorId: ctx.user.id,
    text: `${ctx.user.id} asked you for an intro`,
    href: '/homeroom/intros',
  });
  seeOther(ctx, '/homeroom/intros');
}

async function introResolve(ctx, { id }) {
  const intro = bf.getIntro(id);
  if (!intro) return notFound(ctx);
  if (intro.target_id !== ctx.user.id) return oops(ctx, 'Not yours to answer.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const decision = fields.decision === 'accepted' ? 'accepted' : 'declined';
  const result = bf.resolveIntro(intro.id, decision);
  if (result?.threadId) {
    bf.notify({
      userId: intro.requester_id,
      kind: 'intro',
      actorId: ctx.user.id,
      text: `${ctx.user.id} accepted your intro request`,
      href: `/homeroom/messages/${result.threadId}`,
    });
    return seeOther(ctx, `/homeroom/messages/${result.threadId}`);
  }
  bf.notify({
    userId: intro.requester_id,
    kind: 'intro',
    actorId: ctx.user.id,
    text: `${ctx.user.id} declined your intro request`,
    href: '/homeroom/intros',
  });
  seeOther(ctx, '/homeroom/intros');
}

/* -------------------------------------------------------------- messages */

function threadHandler(ctx, { id }) {
  const thread = bf.getThread(id, ctx.user.id);
  if (!thread) return notFound(ctx);
  bf.markThreadRead(thread.id, ctx.user.id);
  render(ctx, views.threadPage(ctx, { thread }), { title: thread.subject || 'Thread' });
}

async function threadReply(ctx, { id }) {
  const thread = bf.getThread(id, ctx.user.id);
  if (!thread) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'message', LIMITS.message)) return;
  const text = trimmed(fields.text, 12_000);
  if (text) {
    bf.sendMessage({ threadId: thread.id, senderId: ctx.user.id, body: text });
    for (const member of thread.members) {
      bf.notify({
        userId: member,
        kind: 'message',
        actorId: ctx.user.id,
        text: `${ctx.user.id} sent you a message`,
        href: `/homeroom/messages/${thread.id}`,
      });
    }
  }
  seeOther(ctx, `/homeroom/messages/${thread.id}`);
}

async function messageCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'message', LIMITS.message)) return;
  const handles = String(fields.to || '')
    .split(',').map((h) => h.trim()).filter(Boolean).slice(0, 12);
  const text = trimmed(fields.text, 12_000);
  const fail = (message) =>
    render(ctx, views.newMessagePage(ctx, { to: fields.to || '', error: message }), { status: 400 });
  if (!handles.length) return fail('Who is it for?');
  if (!text) return fail('Write something.');

  const members = [];
  for (const handle of handles) {
    const member = bf.getMember(handle);
    if (!member) return fail(`No member called “${handle}”.`);
    if (member.user_id !== ctx.user.id) members.push(member.user_id);
  }
  if (!members.length) return fail('Pick someone other than yourself.');

  const subject = trimmed(fields.subject, 120);
  const threadId = members.length === 1 && !subject
    ? bf.openDirectThread(ctx.user.id, members[0])
    : bf.createThread({ createdBy: ctx.user.id, subject, memberIds: members });
  bf.sendMessage({ threadId, senderId: ctx.user.id, body: text });
  for (const member of members) {
    bf.notify({
      userId: member,
      kind: 'message',
      actorId: ctx.user.id,
      text: `${ctx.user.id} sent you a message`,
      href: `/homeroom/messages/${threadId}`,
    });
  }
  seeOther(ctx, `/homeroom/messages/${threadId}`);
}

/* ------------------------------------------------------------- JSON API */

const publicPost = (post) => ({
  id: post.id,
  kind: post.kind,
  category: post.category,
  title: post.title,
  by: post.anonymous ? null : post.author_id,
  points: post.points,
  comments: post.comment_count,
  tags: post.tags || [],
  answered: !!post.answer_id,
  created_at: post.created_at,
  url: `/homeroom/post/${post.id}`,
});

const publicMember = (member) => ({
  handle: member.user_id,
  name: member.name,
  headline: member.headline,
  org: member.org,
  role: member.role,
  cohort: member.cohort,
  location: member.location,
  karma: member.karma,
  expertise: member.expertise || [],
  open: {
    intros: !!member.open_intros,
    office_hours: !!member.open_hours,
    collaboration: !!member.open_collab,
    hiring: !!member.open_hiring,
  },
  url: `/homeroom/p/${member.user_id}`,
});

function apiFeed(ctx) {
  const limit = clampInt(ctx.query.get('limit'), 1, 100, PER_PAGE);
  const page = pageParam(ctx);
  const { posts, total } = bf.feed({
    sort: ctx.query.get('sort') || 'hot',
    category: ctx.query.get('category') || '',
    kind: ctx.query.get('kind') || '',
    tag: ctx.query.get('tag') || '',
    limit,
    offset: (page - 1) * limit,
  });
  sendJson(ctx.res, { ok: true, page, total, posts: posts.map(publicPost) });
}

function apiPost(ctx, { id }) {
  const post = bf.getPost(id);
  if (!post || post.deleted) return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
  sendJson(ctx.res, {
    ok: true,
    post: { ...publicPost(post), body: post.body },
    comments: bf.commentTree(post.id).map((c) => ({
      id: c.id,
      parent: c.parent_id,
      by: c.anonymous ? null : c.author_id,
      body: c.deleted ? null : c.body,
      points: c.points,
      depth: c.depth,
      accepted: post.answer_id === c.id,
      created_at: c.created_at,
    })),
  });
}

async function apiVote(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!checkCsrf(ctx.token, fields.csrf ?? ctx.req.headers['x-csrf-token'])) {
    return sendJson(ctx.res, { ok: false, error: 'bad csrf token' }, { status: 403 });
  }
  const kind = fields.kind === 'comment' ? 'comment' : 'post';
  const id = Number(fields.id);
  if (!Number.isInteger(id)) return sendJson(ctx.res, { ok: false, error: 'id is required' }, { status: 400 });
  const result = fields.dir === 'down' ? bf.unvote(ctx.user.id, kind, id) : bf.vote(ctx.user.id, kind, id);
  sendJson(ctx.res, result, { status: result.ok ? 200 : 400 });
}

/* ---------------------------------------------------------- route table */

function defaultStart() {
  return toLocalInput(nowSeconds() + 3 * 86400);
}

/** Small POST helper: read the body, check CSRF, run `fn(ctx, fields, params)`. */
function action(fn) {
  return async (ctx, params) => {
    const { fields } = await readBody(ctx.req);
    if (!csrfOk(ctx, fields)) return;
    await fn(ctx, fields, params);
  };
}

const ROUTES = [
  ['GET', '/homeroom', homeHandler],
  ['GET', '/homeroom/forum', forumHandler],
  ['GET', '/homeroom/ask', askFormHandler],
  ['POST', '/homeroom/ask', askSubmitHandler],

  ['GET', '/homeroom/post/:id/edit', (ctx, p) => {
    const post = bf.getPost(p.id);
    if (!post || post.deleted) return notFound(ctx);
    if (post.author_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Not yours to edit.', 403);
    render(ctx, views.editPostPage(ctx, { post }), { title: 'Edit post' });
  }],
  ['POST', '/homeroom/post/:id/edit', editPostSubmit],
  ['POST', '/homeroom/post/:id/delete', action((ctx, fields, p) => {
    const post = bf.getPost(p.id);
    if (!post) return notFound(ctx);
    if (post.author_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Not yours to delete.', 403);
    bf.deletePost(post.id);
    seeOther(ctx, '/homeroom/forum');
  })],
  ['POST', '/homeroom/post/:id/pin', action((ctx, fields, p) => {
    if (!ctx.user.is_admin) return oops(ctx, 'Stewards only.', 403);
    const post = bf.getPost(p.id);
    if (!post) return notFound(ctx);
    bf.setPinned(post.id, !post.pinned);
    seeOther(ctx, safeGoto(fields.goto, `/homeroom/post/${post.id}`));
  })],
  ['POST', '/homeroom/post/:id/lock', action((ctx, fields, p) => {
    if (!ctx.user.is_admin) return oops(ctx, 'Stewards only.', 403);
    const post = bf.getPost(p.id);
    if (!post) return notFound(ctx);
    bf.setLocked(post.id, !post.locked);
    seeOther(ctx, safeGoto(fields.goto, `/homeroom/post/${post.id}`));
  })],
  ['GET', '/homeroom/post/:id', postHandler],

  ['GET', '/homeroom/reply/:id', (ctx, p) => {
    const parent = bf.getComment(p.id);
    if (!parent || parent.deleted) return notFound(ctx);
    const post = bf.getPost(parent.post_id);
    if (!post || post.locked) return oops(ctx, 'That thread is closed.', 403);
    render(ctx, views.replyPage(ctx, { parent, post }), { title: 'Reply' });
  }],
  ['POST', '/homeroom/comment', commentSubmit],
  ['GET', '/homeroom/comment/:id/edit', (ctx, p) => {
    const comment = bf.getComment(p.id);
    if (!comment || comment.author_id !== ctx.user.id) return notFound(ctx);
    render(ctx, views.editCommentPage(ctx, { comment }), { title: 'Edit reply' });
  }],
  ['POST', '/homeroom/comment/:id/edit', action((ctx, fields, p) => {
    const comment = bf.getComment(p.id);
    if (!comment || comment.author_id !== ctx.user.id) return notFound(ctx);
    const text = trimmed(fields.text, 20_000);
    if (text) bf.editComment(comment.id, text);
    seeOther(ctx, `/homeroom/post/${comment.post_id}#c${comment.id}`);
  })],
  ['POST', '/homeroom/comment/:id/delete', action((ctx, fields, p) => {
    const comment = bf.getComment(p.id);
    if (!comment || (comment.author_id !== ctx.user.id && !ctx.user.is_admin)) return notFound(ctx);
    bf.deleteComment(comment.id);
    seeOther(ctx, `/homeroom/post/${comment.post_id}`);
  })],

  ['POST', '/homeroom/vote', action((ctx, fields) => {
    const kind = fields.kind === 'comment' ? 'comment' : 'post';
    const id = Number(fields.id);
    if (fields.dir === 'down') bf.unvote(ctx.user.id, kind, id);
    else bf.vote(ctx.user.id, kind, id);
    seeOther(ctx, safeGoto(fields.goto));
  })],
  ['POST', '/homeroom/save', action((ctx, fields) => {
    bf.toggleSave(ctx.user.id, fields.kind === 'post' ? 'post' : 'other', Number(fields.id));
    seeOther(ctx, safeGoto(fields.goto));
  })],
  ['POST', '/homeroom/follow', action((ctx, fields) => {
    bf.toggleFollow(ctx.user.id, fields.kind === 'post' ? 'post' : 'other', Number(fields.id));
    seeOther(ctx, safeGoto(fields.goto));
  })],
  ['POST', '/homeroom/poll', action((ctx, fields) => {
    const postId = Number(fields.post);
    bf.castPollVote(postId, ctx.user.id, Number(fields.option));
    seeOther(ctx, `/homeroom/post/${postId}`);
  })],
  ['POST', '/homeroom/answer', action((ctx, fields) => {
    const post = bf.getPost(fields.post);
    if (!post) return notFound(ctx);
    if (post.author_id !== ctx.user.id) return oops(ctx, 'Only the person who asked can accept an answer.', 403);
    const commentId = Number(fields.comment) || null;
    bf.markAnswer(post.id, commentId);
    if (commentId) {
      const comment = bf.getComment(commentId);
      if (comment) {
        bf.notify({
          userId: comment.author_id,
          kind: 'answer',
          actorId: ctx.user.id,
          text: `${ctx.user.id} accepted your answer on “${post.title}”`,
          href: `/homeroom/post/${post.id}#c${commentId}`,
        });
      }
    }
    seeOther(ctx, `/homeroom/post/${post.id}`);
  })],

  ['GET', '/homeroom/people', peopleHandler],
  ['GET', '/homeroom/p/:handle', memberHandler],
  ['GET', '/homeroom/settings', (ctx) => render(ctx, views.settingsPage(ctx, {
    member: bf.ensureMember(ctx.user.id), saved: ctx.query.get('saved') === '1',
  }), { title: 'Your profile' })],
  ['POST', '/homeroom/settings', settingsSubmit],

  ['GET', '/homeroom/labs/new', (ctx) => render(ctx, views.labFormPage(ctx, {}), { title: 'Add a lab' })],
  ['POST', '/homeroom/labs/new', labCreate],
  ['GET', '/homeroom/labs', labsHandler],
  ['GET', '/homeroom/lab/:slug/edit', (ctx, p) => {
    const org = bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    if (!bf.isOrgAdmin(org.id, ctx.user.id) && !ctx.user.is_admin) return oops(ctx, 'Only lab admins can edit this.', 403);
    render(ctx, views.labFormPage(ctx, { org }), { title: `Edit ${org.name}` });
  }],
  ['POST', '/homeroom/lab/:slug/edit', labEdit],
  ['GET', '/homeroom/lab/:slug/update', (ctx, p) => {
    const org = bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    if (!bf.isOrgMember(org.id, ctx.user.id)) return oops(ctx, 'Only the team can post updates.', 403);
    render(ctx, views.updateFormPage(ctx, { org }), { title: `Update from ${org.name}` });
  }],
  ['POST', '/homeroom/lab/:slug/update', labUpdatePost],
  ['POST', '/homeroom/lab/:slug/join', action((ctx, fields, p) => {
    const org = bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    bf.joinOrg(org.id, ctx.user.id);
    seeOther(ctx, `/homeroom/lab/${org.slug}`);
  })],
  ['POST', '/homeroom/lab/:slug/leave', action((ctx, fields, p) => {
    const org = bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    bf.leaveOrg(org.id, ctx.user.id);
    seeOther(ctx, `/homeroom/lab/${org.slug}`);
  })],
  ['GET', '/homeroom/lab/:slug', labHandler],

  ['GET', '/homeroom/deals/new', (ctx) => render(ctx, views.dealFormPage(ctx, {}), { title: 'Add a deal' })],
  ['POST', '/homeroom/deals/new', dealCreate],
  ['GET', '/homeroom/deals', dealsHandler],
  ['POST', '/homeroom/deal/:slug/claim', action((ctx, fields, p) => {
    const deal = bf.getDeal(p.slug);
    if (!deal) return notFound(ctx);
    bf.claimDeal(deal.id, ctx.user.id);
    seeOther(ctx, `/homeroom/deal/${deal.slug}`);
  })],
  ['GET', '/homeroom/deal/:slug', dealHandler],

  ['GET', '/homeroom/funders/new', (ctx) => render(ctx, views.funderFormPage(ctx, {}), { title: 'Add a funder' })],
  ['POST', '/homeroom/funders/new', funderCreate],
  ['GET', '/homeroom/funders', fundersHandler],
  ['GET', '/homeroom/pipeline', (ctx) => render(ctx, views.pipelinePage(ctx, { rows: bf.pipeline(ctx.user.id) }),
    { title: 'Pipeline' })],
  ['POST', '/homeroom/funder/:slug/review', reviewSubmit],
  ['POST', '/homeroom/funder/:slug/track', trackSubmit],
  ['POST', '/homeroom/funder/:slug/untrack', action((ctx, fields, p) => {
    const funder = bf.getFunder(p.slug);
    if (!funder) return notFound(ctx);
    bf.removePipeline(ctx.user.id, funder.id);
    seeOther(ctx, `/homeroom/funder/${funder.slug}`);
  })],
  ['GET', '/homeroom/funder/:slug', funderHandler],

  ['GET', '/homeroom/hours/new', (ctx) => render(ctx, views.slotFormPage(ctx, { defaultStart: defaultStart() }),
    { title: 'Offer office hours' })],
  ['POST', '/homeroom/hours/new', slotCreate],
  ['GET', '/homeroom/hours', hoursHandler],
  ['POST', '/homeroom/hours/:id/book', action((ctx, fields, p) => {
    const result = bf.bookSlot(Number(p.id), ctx.user.id, trimmed(fields.question, 2000));
    if (!result.ok) return oops(ctx, result.error);
    if (result.hostId) {
      bf.notify({
        userId: result.hostId,
        kind: 'booking',
        actorId: ctx.user.id,
        text: `${ctx.user.id} booked your office hours`,
        href: `/homeroom/hours/${p.id}`,
      });
    }
    seeOther(ctx, `/homeroom/hours/${p.id}`);
  })],
  ['POST', '/homeroom/hours/:id/unbook', action((ctx, fields, p) => {
    bf.cancelBooking(Number(p.id), ctx.user.id);
    seeOther(ctx, `/homeroom/hours/${p.id}`);
  })],
  ['POST', '/homeroom/hours/:id/cancel', action((ctx, fields, p) => {
    const slot = bf.getSlot(p.id);
    if (!slot) return notFound(ctx);
    if (slot.host_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Only the host can cancel.', 403);
    for (const booking of bf.slotBookings(slot.id)) {
      bf.notify({
        userId: booking.user_id,
        kind: 'booking',
        actorId: ctx.user.id,
        text: `${slot.host_id} canceled “${slot.title}”`,
        href: `/homeroom/hours/${slot.id}`,
      });
    }
    bf.cancelSlot(slot.id);
    seeOther(ctx, '/homeroom/hours');
  })],
  ['GET', '/homeroom/hours/:id', slotHandler],

  ['GET', '/homeroom/jobs/new', (ctx) => {
    const orgs = bf.userOrgs(ctx.user.id);
    if (!orgs.length) return oops(ctx, 'Add your lab first — roles hang off a lab.', 400);
    render(ctx, views.jobFormPage(ctx, { orgs, values: Object.fromEntries(ctx.query) }), { title: 'Post a role' });
  }],
  ['POST', '/homeroom/jobs/new', jobCreate],
  ['GET', '/homeroom/jobs', jobsHandler],
  ['POST', '/homeroom/job/:id/apply', action((ctx, fields, p) => {
    const job = bf.getJob(p.id);
    if (!job || job.closed) return notFound(ctx);
    bf.applyToJob(job.id, ctx.user.id, trimmed(fields.note, 4000));
    bf.notify({
      userId: job.posted_by,
      kind: 'application',
      actorId: ctx.user.id,
      text: `${ctx.user.id} applied for ${job.title}`,
      href: `/homeroom/job/${job.id}`,
    });
    seeOther(ctx, `/homeroom/job/${job.id}`);
  })],
  ['POST', '/homeroom/job/:id/close', action((ctx, fields, p) => {
    const job = bf.getJob(p.id);
    if (!job) return notFound(ctx);
    if (job.posted_by !== ctx.user.id && !bf.isOrgAdmin(job.org_id, ctx.user.id)) {
      return oops(ctx, 'Not yours to close.', 403);
    }
    bf.closeJob(job.id, !job.closed);
    seeOther(ctx, `/homeroom/job/${job.id}`);
  })],
  ['GET', '/homeroom/job/:id', jobHandler],

  ['GET', '/homeroom/events/new', (ctx) => render(ctx, views.eventFormPage(ctx, { defaultStart: defaultStart() }),
    { title: 'Add an event' })],
  ['POST', '/homeroom/events/new', eventCreate],
  ['GET', '/homeroom/events', eventsHandler],
  ['POST', '/homeroom/event/:id/rsvp', action((ctx, fields, p) => {
    const event = bf.getEvent(p.id);
    if (!event) return notFound(ctx);
    const status = ['going', 'maybe', 'none'].includes(fields.status) ? fields.status : 'going';
    if (status === 'going' && event.capacity && event.going >= event.capacity && bf.myRsvp(event.id, ctx.user.id) !== 'going') {
      return oops(ctx, 'That event is full.');
    }
    bf.rsvp(event.id, ctx.user.id, status);
    seeOther(ctx, `/homeroom/event/${event.id}`);
  })],
  ['POST', '/homeroom/event/:id/cancel', action((ctx, fields, p) => {
    const event = bf.getEvent(p.id);
    if (!event) return notFound(ctx);
    if (event.host_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Only the host can cancel.', 403);
    bf.cancelEvent(event.id);
    seeOther(ctx, `/homeroom/event/${event.id}`);
  })],
  ['GET', '/homeroom/event/:id', eventHandler],

  ['GET', '/homeroom/library/new', (ctx) => render(ctx, views.libraryFormPage(ctx, {}), { title: 'Write for the library' })],
  ['POST', '/homeroom/library/new', libraryCreate],
  ['GET', '/homeroom/library', libraryHandler],
  ['GET', '/homeroom/library/:slug', libraryEntryHandler],

  ['GET', '/homeroom/intros/new', (ctx) => {
    const target = bf.getMember(ctx.query.get('to'));
    if (!target) return notFound(ctx);
    render(ctx, views.introFormPage(ctx, { target }), { title: 'Request an intro' });
  }],
  ['POST', '/homeroom/intros/new', introCreate],
  ['POST', '/homeroom/intros/:id/resolve', introResolve],
  ['GET', '/homeroom/intros', (ctx) => render(ctx, views.introsPage(ctx, bf.introsFor(ctx.user.id)), { title: 'Intros' })],

  ['GET', '/homeroom/messages/new', (ctx) => render(ctx, views.newMessagePage(ctx, { to: ctx.query.get('to') || '' }),
    { title: 'New message' })],
  ['POST', '/homeroom/messages/new', messageCreate],
  ['GET', '/homeroom/messages', (ctx) => render(ctx, views.messagesPage(ctx, { threads: bf.threadsFor(ctx.user.id) }),
    { title: 'Messages' })],
  ['GET', '/homeroom/messages/:id', threadHandler],
  ['POST', '/homeroom/messages/:id', threadReply],

  ['GET', '/homeroom/notifications', (ctx) => {
    const items = bf.notifications(ctx.user.id);
    render(ctx, views.notificationsPage(ctx, { items }), { title: 'Notifications' });
    bf.markNotificationsRead(ctx.user.id);
  }],
  ['GET', '/homeroom/saved', (ctx) => {
    const posts = bf.savedPosts(ctx.user.id);
    render(ctx, views.savedPage(ctx, {
      posts, voted: bf.votedIds(ctx.user.id, 'post', posts.map((p) => p.id)),
    }), { title: 'Saved' });
  }],
  ['GET', '/homeroom/search', (ctx) => {
    const query = (ctx.query.get('q') || '').trim().slice(0, 120);
    const results = bf.globalSearch(query);
    render(ctx, views.searchPage(ctx, {
      query, results, voted: bf.votedIds(ctx.user.id, 'post', results.posts.map((p) => p.id)),
    }), { title: query ? `Search: ${query}` : 'Search' });
  }],
  ['GET', '/homeroom/about', (ctx) => render(ctx, views.aboutPage(ctx, { stats: bf.networkStats() }), { title: 'About' })],

  ['GET', '/homeroom/api/feed', apiFeed],
  ['GET', '/homeroom/api/post/:id', apiPost],
  ['GET', '/homeroom/api/members', (ctx) => {
    const { members, total } = bf.searchMembers({
      q: ctx.query.get('q') || '',
      tag: ctx.query.get('tag') || '',
      cohort: ctx.query.get('cohort') || '',
      limit: clampInt(ctx.query.get('limit'), 1, 100, PER_PAGE),
    });
    sendJson(ctx.res, { ok: true, total, members: members.map(publicMember) });
  }],
  ['GET', '/homeroom/api/member/:handle', (ctx, p) => {
    const member = bf.getMember(p.handle);
    if (!member) return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
    sendJson(ctx.res, { ok: true, member: publicMember(member) });
  }],
  ['GET', '/homeroom/api/labs', (ctx) => {
    const { orgs, total } = bf.searchOrgs({ q: ctx.query.get('q') || '', kind: ctx.query.get('kind') || '' });
    sendJson(ctx.res, { ok: true, total, labs: orgs });
  }],
  ['GET', '/homeroom/api/deals', (ctx) => sendJson(ctx.res, { ok: true, ...bf.listDeals({ category: ctx.query.get('category') || '' }) })],
  ['GET', '/homeroom/api/funders', (ctx) => sendJson(ctx.res, { ok: true, ...bf.listFunders({ q: ctx.query.get('q') || '' }) })],
  ['GET', '/homeroom/api/search', (ctx) => sendJson(ctx.res, {
    ok: true, results: bf.globalSearch(ctx.query.get('q') || ''),
  })],
  ['POST', '/homeroom/api/vote', apiVote],
];

/** Compile "/homeroom/post/:id/edit" into a matcher once, at module load. */
const COMPILED = ROUTES.map(([method, pattern, handler]) => {
  const segments = pattern.split('/').filter(Boolean);
  return { method, segments, handler, isApi: pattern.startsWith('/homeroom/api/') };
});

function match(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  for (const route of COMPILED) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(parts[i]);
      else if (segment !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

/**
 * Entry point used by src/app.js. Returns a handler, or null when nothing
 * under /homeroom matches (so the caller can render its own 404).
 */
export function homeroomRoute(method, pathname) {
  const found = match(method, pathname);
  if (!found) return null;
  const { route, params } = found;
  return async (ctx) => {
    if (route.isApi) {
      // The API answers in JSON even when it is turning you away.
      if (!ctx.user) return sendJson(ctx.res, { ok: false, error: 'members only' }, { status: 401 });
      bf.ensureMember(ctx.user.id);
    } else if (!gate(ctx)) {
      return;
    }
    await route.handler(ctx, params);
  };
}

/** True for any path this module owns, matched or not. */
export function isHomeroomPath(pathname) {
  return pathname === '/homeroom' || pathname.startsWith('/homeroom/');
}

/** 404 in Homeroom chrome, so an unknown /homeroom path does not fall back to the news layout. */
export function homeroomNotFound(ctx) {
  if (ctx.path.startsWith('/homeroom/api/')) {
    return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
  }
  if (ctx.user) bf.ensureMember(ctx.user.id);
  notFound(ctx);
}
