/*
 * The members-only surfaces. app.js owns the session and the pre-login pages
 * and hands anything else here.
 *
 * The table is a list of [method, pattern, handler]. Patterns are literal
 * paths or `:param` segments; the first match wins, so the concrete routes
 * (/library/new) are listed before the wildcards (/library/:slug).
 */

import { sendHtml, sendJson, readBody, rateLimit } from './http.js';
import {
  checkCsrf, hashPassword, verifyPassword, validatePassword, destroyAllSessions,
  createSession, sessionCookie,
} from './auth.js';
import { clampInt, nowSeconds, normalizeUrl } from './util.js';
import * as bf from './models.js';
import * as supabase from './supabase.js';
import * as roster from './roster.js';
import * as access from './access.js';
import * as luma from './luma.js';
import * as sbAuth from './supabase-auth.js';
import * as invites from './invites.js';
import * as desk from './mentordesk.js';
import * as mentormail from './mentormail.js';
import * as mentorsync from './mentorsync.js';
import * as mentorlife from './mentorlife.js';
import { homeroomLayout } from './views/layout.js';
import * as views from './views/pages.js';
import { parseWhen, toLocalInput } from './views/components.js';
import { S26_SEQUENCE, LIBRARY_MODULES } from './data/curriculum.js';

/*
 * How many nodes the skill tree draws. The tree lives outside this function's
 * bundle (tools/biopunk-skill-tree), so the count is stated here rather than
 * imported — and tools/biopunk-skill-tree/scripts/validate.mjs fails if this
 * number and the generated tree ever disagree, so it cannot quietly rot.
 */
const SKILL_TREE_NODES = 47;

const PER_PAGE = bf.PAGE_SIZE;

const LIMITS = {
  post: { limit: 10, windowMs: 60 * 60_000 },
  comment: { limit: 40, windowMs: 10 * 60_000 },
  message: { limit: 60, windowMs: 10 * 60_000 },
  create: { limit: 20, windowMs: 60 * 60_000 },
  // Chat is meant to be fast, so this is deliberately loose — it exists to stop
  // a script, not to make anyone think before typing.
  chat: { limit: 120, windowMs: 5 * 60_000 },
  // Publishing reaches the public feed. Five an hour is more than anyone needs.
  publish: { limit: 5, windowMs: 60 * 60_000 },
};

/* ------------------------------------------------------------- plumbing */

export async function render(ctx, content, { title, description, status = 200, flash, error, subnav } = {}) {
  ctx.badges = ctx.user
    ? {
        messages: await bf.unreadMessageCount(ctx.user.id),
        notifications: await bf.unreadNotificationCount(ctx.user.id) + await bf.pendingIntroCount(ctx.user.id),
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

const notFound = async (ctx) => await render(ctx, views.notFoundPage(), { title: 'Not found', status: 404 });
const oops = async (ctx, message, status = 400) => await render(ctx, views.errorPage(message), { title: 'Error', status });

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
async function gate(ctx) {
  if (ctx.user) {
    await bf.ensureMember(ctx.user.id);
    return true;
  }
  if (ctx.req.method === 'POST') {
    seeOther(ctx, `/homeroom/login?next=${encodeURIComponent(ctx.fullPath || '/homeroom')}`);
    return false;
  }
  await render(ctx, views.gatePage(ctx, { stats: await bf.networkStats() }), { title: 'Members only' });
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

async function homeHandler(ctx) {
  const member = await bf.ensureMember(ctx.user.id);
  await bf.touchMember(ctx.user.id);
  const onboarding = await bf.onboardingProgress(ctx.user.id);
  await render(
    ctx,
    views.homePage(ctx, {
      member,
      stats: await bf.networkStats(),
      upcomingSlots: await bf.listSlots({ upcoming: true, limit: 5 }),
      upcomingEvents: await bf.listEvents({ upcoming: true, limit: 6 }),
      myOrgs: await bf.userOrgs(ctx.user.id),
      deals: (await bf.listDeals({ limit: 6 })).deals,
      funders: (await bf.listFunders({ limit: 5 })).funders,
      mentors: (await bf.searchMentors({ limit: 5 })).mentors,
      modules: await bf.listModules({ limit: 5 }),
      updates: await bf.recentUpdates(4),
      intros: (await bf.introsFor(ctx.user.id)).incoming.filter((i) => i.status === 'pending'),
      onboardingComplete: onboarding.complete,
      onboardingLeft: onboarding.total - onboarding.done,
    }),
    { title: 'Home' },
  );
}

/* ------------------------------------------------------------- directory */

async function peopleHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    tag: ctx.query.get('tag') || '',
    cohort: ctx.query.get('cohort') || '',
    location: ctx.query.get('location') || '',
    open: ctx.query.get('open') || '',
  };
  const { members, total } = await bf.searchMembers({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  await render(
    ctx,
    views.peoplePage(ctx, {
      members, total, page, filters,
      tags: await bf.expertiseCloud(30),
      cohortList: await bf.cohorts(),
      basePath: `/homeroom/people${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Directory', subnav: views.subnav(views.YEARBOOK_TABS, 'directory') },
  );
}

async function memberHandler(ctx, { handle }) {
  const profile = await bf.getMember(handle);
  if (!profile) return notFound(ctx);
  const isSelf = ctx.user.id.toLowerCase() === profile.user_id.toLowerCase();
  const outgoing = (await bf.introsFor(ctx.user.id)).outgoing;
  await render(
    ctx,
    views.memberPage(ctx, {
      profile,
      orgs: await bf.userOrgs(profile.user_id),
      slots: await bf.listSlots({ upcoming: true, hostId: profile.user_id, limit: 5 }),
      isSelf,
      introSent: outgoing.some((i) => i.target_id === profile.user_id && i.status === 'pending'),
      canRequestIntro: !isSelf && !!profile.open_intros
        && !outgoing.some((i) => i.target_id === profile.user_id && i.status === 'pending'),
      threadId: isSelf ? null : await bf.findDirectThread(ctx.user.id, profile.user_id),
    }),
    { title: profile.name || profile.user_id },
  );
}

async function settingsSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  await bf.updateMember(ctx.user.id, {
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

/**
 * Change your own password.
 *
 * Requires the current one. That is not ceremony: without it, a session cookie
 * someone left open on a shared laptop is enough to lock its owner out of their
 * own account permanently. It is also exactly what Supabase needs — proving the
 * old password is what mints the token authorising the new one — so the same
 * form works whichever side is holding the credential.
 */
async function passwordSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;

  const authMode = sbAuth.configured() ? 'supabase' : 'local';
  const back = async (error) => await render(ctx, views.settingsPage(ctx, {
    member: await bf.ensureMember(ctx.user.id), passwordError: error, authMode,
  }), { title: 'Your profile', status: error ? 400 : 200 });

  // Per account rather than per address: guessing a current password should not
  // get cheaper by moving to a second machine.
  if (!rateLimit(`password:${ctx.user.id}`, { limit: 6, windowMs: 60 * 60_000 })) {
    return back('Too many attempts. Wait an hour.');
  }

  const next = String(fields.password || '');
  if (next !== String(fields.confirm || '')) return back('Those two do not match.');
  const weak = validatePassword(next);
  if (weak) return back(weak);

  const account = await bf.getUser(ctx.user.id);
  const current = String(fields.current || '');

  if (authMode === 'supabase') {
    if (!account.email) return back('This account has no email address, so Supabase cannot verify it.');
    const signedIn = await sbAuth.signInWithPassword({ email: account.email, password: current });
    if (!signedIn.ok) {
      if (signedIn.code === 'unreachable' || signedIn.code === 'timeout' || signedIn.status >= 500) {
        return back('Supabase is unreachable, so the password cannot be changed right now.');
      }
      return back('That current password is wrong.');
    }
    const updated = await sbAuth.updatePassword({
      accessToken: signedIn.session.accessToken,
      password: next,
    });
    if (!updated.ok) return back(updated.error);
    await sbAuth.signOut(signedIn.session.accessToken);
  } else {
    if (!verifyPassword(current, account.password_hash)) return back('That current password is wrong.');
    await bf.setPassword(ctx.user.id, hashPassword(next));
  }

  // Everything else this account had open, gone — then a fresh session, so the
  // person who just changed it is not signed out by their own change.
  await destroyAllSessions(ctx.user.id);
  const token = await createSession(ctx.user.id);
  const proto = String(ctx.req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  ctx.res.writeHead(303, {
    location: '/homeroom/settings?password=1',
    'set-cookie': sessionCookie(token, { secure: proto ? proto === 'https' : !!process.env.NETLIFY }),
  });
  ctx.res.end();
}

/* ------------------------------------------------------------------ labs */

async function labsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    kind: ctx.query.get('kind') || '',
    stage: ctx.query.get('stage') || '',
    tag: ctx.query.get('tag') || '',
  };
  const { orgs, total } = await bf.searchOrgs({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  await render(ctx, views.labsPage(ctx, { orgs, total, page, filters, basePath: `/homeroom/labs${qs ? `?${qs}` : ''}` }),
    { title: 'Labs' });
}

async function labHandler(ctx, { slug }) {
  const org = await bf.getOrg(slug);
  if (!org) return notFound(ctx);
  await render(
    ctx,
    views.labPage(ctx, {
      org,
      team: await bf.orgTeam(org.id),
      updates: await bf.orgUpdates(org.id, { limit: 10 }),
      jobs: (await bf.listJobs({ orgId: org.id, limit: 10 })).jobs,
      isMember: await bf.isOrgMember(org.id, ctx.user.id),
      isAdmin: await bf.isOrgAdmin(org.id, ctx.user.id) || !!ctx.user.is_admin,
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
    return await render(ctx, views.labFormPage(ctx, { error: 'A lab needs a name.' }), { status: 400 });
  }
  const id = await bf.createOrg({ ...patch, createdBy: ctx.user.id });
  seeOther(ctx, `/homeroom/lab/${(await bf.getOrg(id)).slug}`);
}

async function labEdit(ctx, { slug }) {
  const org = await bf.getOrg(slug);
  if (!org) return notFound(ctx);
  if (!await bf.isOrgAdmin(org.id, ctx.user.id) && !ctx.user.is_admin) return oops(ctx, 'Only lab admins can edit this.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const patch = labFields(fields);
  if (patch.name.length < 2) {
    return await render(ctx, views.labFormPage(ctx, { org, error: 'A lab needs a name.' }), { status: 400 });
  }
  await bf.updateOrg(org.id, patch);
  seeOther(ctx, `/homeroom/lab/${org.slug}`);
}

async function labUpdatePost(ctx, { slug }) {
  const org = await bf.getOrg(slug);
  if (!org) return notFound(ctx);
  if (!await bf.isOrgMember(org.id, ctx.user.id)) return oops(ctx, 'Only the team can post updates.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const body = trimmed(fields.body, 8000);
  if (!body) {
    return await render(ctx, views.updateFormPage(ctx, { org, error: 'Write something.' }), { status: 400 });
  }
  await bf.createUpdate({
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

async function perksHandler(ctx) {
  const category = ctx.query.get('category') || '';
  const q = ctx.query.get('q') || '';
  const { deals, total } = await bf.listDeals({ category, q, limit: 300 });
  const claimed = new Set((await bf.myClaims(ctx.user.id)).map((d) => d.id));
  // Category counts come from the unfiltered set, so the filter bar does not
  // collapse to one option as soon as you use it.
  const counts = {};
  for (const perk of (await bf.listDeals({ limit: 500 })).deals) {
    counts[perk.category] = (counts[perk.category] || 0) + 1;
  }
  await render(ctx, views.perksPage(ctx, { perks: deals, total, category, q, claimed, counts }),
    { title: 'Perks' });
}

async function perkHandler(ctx, { slug }) {
  const perk = await bf.getDeal(slug);
  if (!perk) return notFound(ctx);
  await render(
    ctx,
    views.perkPage(ctx, {
      perk,
      claimed: await bf.hasClaimed(perk.id, ctx.user.id),
      claimCount: await bf.dealClaimCount(perk.id),
    }),
    { title: `${perk.vendor} — perk` },
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
    return await render(ctx, views.dealFormPage(ctx, { values, error: 'Vendor and a real description, please.' }), { status: 400 });
  }
  const id = await bf.createDeal({ ...values, postedBy: ctx.user.id });
  seeOther(ctx, `/homeroom/deal/${(await bf.getDeal(id)).slug}`);
}

/* --------------------------------------------------------------- funders */

async function fundersHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    kind: ctx.query.get('kind') || '',
    sort: ctx.query.get('sort') || 'rating',
  };
  const { funders, total } = await bf.listFunders({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  await render(
    ctx,
    views.fundersPage(ctx, {
      funders, total, page, filters,
      tracked: new Set((await bf.pipeline(ctx.user.id)).map((row) => row.funder_id)),
      basePath: `/homeroom/funders${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Funders' },
  );
}

async function funderHandler(ctx, { slug }) {
  const funder = await bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  const reviews = await bf.funderReviews(funder.id, { sort: ctx.query.get('sort') === 'recent' ? 'recent' : 'helpful' });
  const ids = reviews.map((r) => r.id);
  await render(
    ctx,
    views.funderPage(ctx, {
      funder,
      reviews,
      comments: await bf.reviewComments(ids),
      myHelpful: await bf.helpfulIds(ctx.user.id, ids),
      tags: await bf.funderTagCloud(funder.id),
      myReview: await bf.myReview(funder.id, ctx.user.id),
      entry: await bf.pipelineEntry(ctx.user.id, funder.id),
      orgs: await bf.userOrgs(ctx.user.id),
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
    return await render(ctx, views.funderFormPage(ctx, { values, error: 'Name it.' }), { status: 400 });
  }
  const id = await bf.createFunder({ ...values, addedBy: ctx.user.id });
  seeOther(ctx, `/homeroom/funder/${(await bf.getFunder(id)).slug}`);
}

async function reviewSubmit(ctx, { slug }) {
  const funder = await bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const rating = clampInt(fields.rating, 1, 5, 0);
  if (!rating) return oops(ctx, 'Pick a rating between 1 and 5.');
  await bf.upsertReview({
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
  const funder = await bf.getFunder(slug);
  if (!funder) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const orgId = Number(fields.org) || null;
  await bf.upsertPipeline({
    userId: ctx.user.id,
    funderId: funder.id,
    orgId: orgId && await bf.isOrgMember(orgId, ctx.user.id) ? orgId : null,
    status: bf.labelFor(bf.PIPELINE_STATUSES, fields.status) ? fields.status : 'researching',
    amount: trimmed(fields.amount, 60),
    notes: trimmed(fields.notes, 4000),
  });
  seeOther(ctx, `/homeroom/funder/${funder.slug}`);
}

/* ----------------------------------------------------------- office hours */

async function hoursHandler(ctx) {
  const slots = await bf.listSlots({ upcoming: true, limit: 60 });
  await render(
    ctx,
    views.hoursPage(ctx, {
      slots: slots.filter((s) => s.host_id !== ctx.user.id),
      mine: await bf.myBookings(ctx.user.id),
      hosting: slots.filter((s) => s.host_id === ctx.user.id),
    }),
    { title: 'Office hours', subnav: views.subnav(views.MENTOR_TABS, 'hours') },
  );
}

async function slotHandler(ctx, { id }) {
  const slot = await bf.getSlot(id);
  if (!slot) return notFound(ctx);
  const bookings = await bf.slotBookings(slot.id);
  await render(
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
  const fail = async (message) =>
    await render(ctx, views.slotFormPage(ctx, { error: message, defaultStart: fields.starts_at || defaultStart() }),
      { status: 400 });
  if (title.length < 4) return fail('Say what the session is for.');
  if (!startsAt) return fail('That start time did not parse.');
  if (startsAt < nowSeconds()) return fail('Pick a time in the future.');
  const format = fields.format === 'group' ? 'group' : 'one-on-one';
  const id = await bf.createSlot({
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
  await bf.updateMember(ctx.user.id, { open_hours: true });
  seeOther(ctx, `/homeroom/hours/${id}`);
}

/* ------------------------------------------------------------------ jobs */

async function jobsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    discipline: ctx.query.get('discipline') || '',
    remote: ctx.query.get('remote') === '1',
  };
  const { jobs, total } = await bf.listJobs({ ...filters, limit: PER_PAGE, offset: offsetFor(page) });
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.discipline) params.set('discipline', filters.discipline);
  if (filters.remote) params.set('remote', '1');
  const qs = params.toString();
  await render(
    ctx,
    views.jobsPage(ctx, {
      jobs, total, page, filters,
      canPost: (await bf.userOrgs(ctx.user.id)).length > 0,
      basePath: `/homeroom/jobs${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Jobs' },
  );
}

async function jobHandler(ctx, { id }) {
  const job = await bf.getJob(id);
  if (!job) return notFound(ctx);
  const canManage = await bf.isOrgAdmin(job.org_id, ctx.user.id) || job.posted_by === ctx.user.id;
  await render(
    ctx,
    views.jobPage(ctx, {
      job,
      applied: await bf.hasApplied(job.id, ctx.user.id),
      applicants: canManage ? await bf.jobApplicants(job.id) : [],
      canManage,
    }),
    { title: job.title },
  );
}

async function jobCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const orgs = await bf.userOrgs(ctx.user.id);
  const orgId = Number(fields.org) || 0;
  const values = {
    org: fields.org, title: trimmed(fields.title, 120),
    discipline: fields.discipline, employment: fields.employment,
    location: trimmed(fields.location, 80), comp: trimmed(fields.comp, 60),
    equity: trimmed(fields.equity, 40), description: trimmed(fields.description, 12_000),
    tags: fields.tags || '',
  };
  const fail = async (message) =>
    await render(ctx, views.jobFormPage(ctx, { orgs, values, error: message }), { status: 400 });
  if (!await bf.isOrgMember(orgId, ctx.user.id)) return fail('Pick a lab you are listed with.');
  if (values.title.length < 3) return fail('The role needs a title.');
  const id = await bf.createJob({
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

async function eventsHandler(ctx) {
  const kind = ctx.query.get('kind') || '';
  await render(
    ctx,
    views.eventsPage(ctx, {
      events: await bf.listEvents({ upcoming: true, kind }),
      past: await bf.listEvents({ upcoming: false, kind, limit: 6 }),
      kind,
    }),
    { title: 'Events', subnav: views.subnav(views.EVENT_TABS, 'list') },
  );
}

async function eventHandler(ctx, { id }) {
  const event = await bf.getEvent(id);
  if (!event) return notFound(ctx);
  await render(
    ctx,
    views.eventPage(ctx, {
      event,
      attendees: await bf.eventAttendees(event.id),
      myStatus: await bf.myRsvp(event.id, ctx.user.id),
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
  const fail = async (message) =>
    await render(ctx, views.eventFormPage(ctx, { error: message, defaultStart: fields.starts_at || defaultStart() }),
      { status: 400 });
  if (title.length < 4) return fail('Give the event a title.');
  if (!startsAt) return fail('That start time did not parse.');
  const id = await bf.createEvent({
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
  await bf.rsvp(id, ctx.user.id, 'going');
  seeOther(ctx, `/homeroom/event/${id}`);
}

/* --------------------------------------------------------------- library */

async function libraryHandler(ctx) {
  const filters = { q: ctx.query.get('q') || '', track: ctx.query.get('track') || '' };
  const { modules } = filters.q || filters.track
    ? await bf.listModules({ ...filters, userId: ctx.user.id })
    : { modules: [] };
  await render(
    ctx,
    views.libraryPage(ctx, {
      tracks: await bf.tracks(),
      progress: await bf.progressSummary(ctx.user.id),
      modules,
      filters,
      entries: (await bf.listLibrary({ limit: 12 })).entries,
      sequence: S26_SEQUENCE,
    }),
    { title: 'Library', subnav: views.subnav(views.LIBRARY_TABS, 'manual') },
  );
}

async function libraryEntryHandler(ctx, { slug }) {
  const entry = await bf.getLibraryEntry(slug);
  if (!entry) return notFound(ctx);
  await bf.bumpReads(entry.id);
  await render(ctx, views.libraryEntryPage(ctx, { entry }), { title: entry.title });
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
    return await render(ctx, views.libraryFormPage(ctx, { values, error: 'A title and something worth reading, please.' }),
      { status: 400 });
  }
  const id = await bf.createLibraryEntry({ ...values, tags: bf.parseTags(values.tags, 8).join(','), authorId: ctx.user.id });
  seeOther(ctx, `/homeroom/library/${(await bf.getLibraryEntry(id)).slug}`);
}

/* ---------------------------------------------------------------- intros */

async function introCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const target = await bf.getMember(fields.to);
  if (!target) return notFound(ctx);
  if (target.user_id === ctx.user.id) return oops(ctx, 'You already know yourself.');
  if (!target.open_intros) return oops(ctx, 'That member is not taking intro requests.', 403);
  const reason = trimmed(fields.reason, 2000);
  if (reason.length < 20) {
    return await render(ctx, views.introFormPage(ctx, { target, error: 'Say more than that — twenty characters minimum.' }),
      { status: 400 });
  }
  const result = await bf.requestIntro({ requesterId: ctx.user.id, targetId: target.user_id, reason });
  if (!result.ok) return oops(ctx, result.error);
  await bf.notify({
    userId: target.user_id,
    kind: 'intro',
    actorId: ctx.user.id,
    text: `${ctx.user.id} asked you for an intro`,
    href: '/homeroom/intros',
  });
  seeOther(ctx, '/homeroom/intros');
}

async function introResolve(ctx, { id }) {
  const intro = await bf.getIntro(id);
  if (!intro) return notFound(ctx);
  if (intro.target_id !== ctx.user.id) return oops(ctx, 'Not yours to answer.', 403);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const decision = fields.decision === 'accepted' ? 'accepted' : 'declined';
  const result = await bf.resolveIntro(intro.id, decision);
  if (result?.threadId) {
    await bf.notify({
      userId: intro.requester_id,
      kind: 'intro',
      actorId: ctx.user.id,
      text: `${ctx.user.id} accepted your intro request`,
      href: `/homeroom/messages/${result.threadId}`,
    });
    return seeOther(ctx, `/homeroom/messages/${result.threadId}`);
  }
  await bf.notify({
    userId: intro.requester_id,
    kind: 'intro',
    actorId: ctx.user.id,
    text: `${ctx.user.id} declined your intro request`,
    href: '/homeroom/intros',
  });
  seeOther(ctx, '/homeroom/intros');
}

/* -------------------------------------------------------------- messages */

async function threadHandler(ctx, { id }) {
  const thread = await bf.getThread(id, ctx.user.id);
  if (!thread) return notFound(ctx);
  await bf.markThreadRead(thread.id, ctx.user.id);
  await render(ctx, views.threadPage(ctx, { thread }), { title: thread.subject || 'Thread' });
}

async function threadReply(ctx, { id }) {
  const thread = await bf.getThread(id, ctx.user.id);
  if (!thread) return notFound(ctx);
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'message', LIMITS.message)) return;
  const text = trimmed(fields.text, 12_000);
  if (text) {
    await bf.sendMessage({ threadId: thread.id, senderId: ctx.user.id, body: text });
    for (const member of thread.members) {
      await bf.notify({
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
  const fail = async (message) =>
    await render(ctx, views.newMessagePage(ctx, { to: fields.to || '', error: message }), { status: 400 });
  if (!handles.length) return fail('Who is it for?');
  if (!text) return fail('Write something.');

  const members = [];
  for (const handle of handles) {
    const member = await bf.getMember(handle);
    if (!member) return fail(`No member called “${handle}”.`);
    if (member.user_id !== ctx.user.id) members.push(member.user_id);
  }
  if (!members.length) return fail('Pick someone other than yourself.');

  const subject = trimmed(fields.subject, 120);
  const threadId = members.length === 1 && !subject
    ? await bf.openDirectThread(ctx.user.id, members[0])
    : await bf.createThread({ createdBy: ctx.user.id, subject, memberIds: members });
  await bf.sendMessage({ threadId, senderId: ctx.user.id, body: text });
  for (const member of members) {
    await bf.notify({
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

/* ---------------------------------------------------------- route table */

/* ------------------------------------------------------------ yearbook */

async function yearbookHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    cohort: ctx.query.get('cohort') || '',
    house: ctx.query.get('house') || '',
    tag: ctx.query.get('tag') || '',
  };
  const { members, total } = await bf.yearbookWall({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  await render(
    ctx,
    views.yearbookPage(ctx, {
      members, total, page, filters,
      cohorts: await bf.wallCohorts(),
      houseList: await bf.houses(),
      mine: await bf.getYearbook(ctx.user.id),
      basePath: `/homeroom/yearbook${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Yearbook', subnav: views.subnav(views.YEARBOOK_TABS, 'wall') },
  );
}

async function yearbookEntryHandler(ctx, { handle }) {
  const member = await bf.getMember(handle);
  if (!member) return notFound(ctx);
  const signs = await bf.signatures(member.user_id);
  await render(
    ctx,
    views.yearbookEntryPage(ctx, {
      member,
      entry: await bf.getYearbook(member.user_id),
      signs,
      mySign: signs.find((s) => s.author_id === ctx.user.id) || null,
      canSign: member.user_id !== ctx.user.id,
    }),
    { title: member.name || member.user_id },
  );
}

async function yearbookSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  await bf.upsertYearbook(ctx.user.id, {
    cohort: trimmed(fields.cohort, 20),
    house: trimmed(fields.house, 40),
    venture: trimmed(fields.venture, 80),
    one_liner: trimmed(fields.one_liner, 160),
    quote: trimmed(fields.quote, 300),
    building: trimmed(fields.building, 4000),
    before_haus: trimmed(fields.before_haus, 2000),
    photo_url: normalizeUrl(fields.photo_url) || '',
    site_url: normalizeUrl(fields.site_url) || '',
  });
  // Keep the profile's cohort in step, so the directory and the wall agree.
  if (trimmed(fields.cohort, 20)) await bf.updateMember(ctx.user.id, { cohort: trimmed(fields.cohort, 20) });
  seeOther(ctx, `/homeroom/yearbook/${encodeURIComponent(ctx.user.id)}`);
}

/* --------------------------------------------------------------- atlas */

async function atlasHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    region: ctx.query.get('region') || '',
    country: ctx.query.get('country') || '',
    status: ctx.query.get('status') || '',
    kind: ctx.query.get('kind') || '',
    capability: ctx.query.get('capability') || '',
  };
  const { labs, total } = await bf.searchLabs({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  await render(
    ctx,
    views.atlasPage(ctx, {
      labs, total, filters, page,
      facets: await bf.atlasFacets(),
      basePath: `/homeroom/labs${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Biolab Atlas', subnav: views.subnav(views.LAB_TABS, 'atlas') },
  );
}

async function atlasLabHandler(ctx, { slug }) {
  const lab = await bf.getLab(slug);
  if (!lab) return notFound(ctx);
  await render(ctx, views.atlasLabPage(ctx, { lab, reports: await bf.labReports(lab.id) }), { title: lab.name });
}

async function atlasLabCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const name = trimmed(fields.name, 120);
  if (!name) {
    return await render(ctx, views.labFormAtlasPage(ctx, { error: 'A lab needs a name.', values: fields }),
      { title: 'Add a lab', status: 400 });
  }
  const id = await bf.upsertLab({
    name,
    city: trimmed(fields.city, 80),
    country: trimmed(fields.country, 80),
    region: trimmed(fields.region, 40),
    kind: trimmed(fields.kind, 20) || 'community',
    status: ['active', 'limited', 'dormant', 'unknown'].includes(fields.status) ? fields.status : 'unknown',
    bsl: trimmed(fields.bsl, 20),
    website: normalizeUrl(fields.website),
    capabilities: trimmed(fields.capabilities, 300),
    note: trimmed(fields.note, 2000),
    source: `member: ${ctx.user.id}`,
  });
  const lab = await bf.getLab(id);
  seeOther(ctx, `/homeroom/labs/at/${lab.slug}`);
}

/* ------------------------------------------------------------- mentors */

async function mentorsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    track: ctx.query.get('track') || '',
    tag: ctx.query.get('tag') || '',
    format: ctx.query.get('format') || '',
    vetted: ctx.query.get('vetted') === '1',
  };
  const { mentors, total } = await bf.searchMentors({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v).map(([k, v]) => [k, v === true ? '1' : v]),
  ).toString();
  await render(
    ctx,
    views.mentorsPage(ctx, {
      mentors, total, filters, page,
      tags: await bf.mentorTagCloud(40),
      vettedCount: (await bf.searchMentors({ vetted: true, limit: 1 })).total,
      basePath: `/homeroom/mentors${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Mentors', subnav: views.subnav(views.MENTOR_TABS, 'mentors') },
  );
}

/**
 * Work out what this member may do about this mentor's calendar.
 *
 * Assembled here rather than in the view so the view never has the scheduler
 * URL to leak in the first place. `directLink` is populated only when the gate
 * is switched off, and only by asking for it by name.
 */
async function deskStateFor(ctx, mentor) {
  if (!desk.gateEnabled()) {
    return { directLink: await desk.schedulerFor(mentor.id) };
  }
  const open = await desk.openRequest(mentor.id, ctx.user.id);
  if (open?.state === 'accepted') {
    const grant = await desk.liveGrantFor(open.id);
    if (grant) return { grant, request: open };
  }
  if (open?.state === 'sent') return { pending: open };

  const verdict = await desk.canRequest({ mentor, memberId: ctx.user.id });
  const capacity = verdict.capacity || await desk.capacityFor(mentor);
  return {
    canAsk: verdict.ok,
    reason: verdict.message,
    capacity,
    resetsAt: verdict.reason === 'at-capacity' ? capacity.resetsAt : null,
  };
}

/* Which states a member may see a profile for at all. Same allowlist as the
   roster query: a pending submission is an unvetted stranger's self-written
   bio, and it should not be readable at a guessable URL just because it is not
   in the list. */
const VISIBLE_MENTOR_STATES = new Set(['listed', 'paused']);

async function mentorHandler(ctx, { slug }) {
  const mentor = await bf.getMentor(slug);
  if (!mentor) return notFound(ctx);
  if (!VISIBLE_MENTOR_STATES.has(mentor.state) && !ctx.user.is_admin) return notFound(ctx);
  await render(
    ctx,
    views.mentorPage(ctx, {
      mentor,
      slots: await bf.mentorSlots(mentor.id),
      member: mentor.user_id ? await bf.getMember(mentor.user_id) : null,
      desk: await deskStateFor(ctx, mentor),
    }),
    { title: mentor.name },
  );
}

/* ------------------------------------------------------------ calendar */

async function calendarHandler(ctx) {
  const now = new Date();
  const year = clampInt(ctx.query.get('y'), 2000, 2100, now.getUTCFullYear());
  const month = clampInt(ctx.query.get('m'), 0, 11, now.getUTCMonth());
  const start = Math.floor(Date.UTC(year, month, 1) / 1000);
  const end = Math.floor(Date.UTC(year, month + 1, 1) / 1000);
  const sync = await bf.lastSync('luma');
  await render(
    ctx,
    views.calendarPage(ctx, {
      year, month,
      events: await bf.eventsBetween(start, end),
      kind: ctx.query.get('kind') || '',
      luma: {
        configured: luma.configured(),
        calendarUrl: luma.calendarUrl(),
        count: sync?.n || 0,
        at: sync?.at || 0,
      },
    }),
    { title: 'Calendar', subnav: views.subnav(views.EVENT_TABS, 'calendar'), wide: true },
  );
}

/**
 * An iCalendar feed of everything upcoming.
 *
 * Members-only like every other surface, so it works in a signed-in browser and
 * in any calendar client that can carry the session cookie. Even then it
 * publishes only title, time and place — never the description or the attendee
 * list, because a calendar file gets forwarded far more casually than a page.
 */
async function icsHandler(ctx) {
  const events = await bf.listEvents({ upcoming: true, limit: 200 });
  const stamp = (seconds) => new Date(seconds * 1000).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const escape = (text) => String(text || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Haus//Homeroom//EN',
    'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Haus Homeroom',
  ];
  for (const event of events) {
    if (event.canceled) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:homeroom-${event.id}@haus.fund`,
      `DTSTAMP:${stamp(event.created_at)}`,
      `DTSTART:${stamp(event.starts_at)}`,
      `DTEND:${stamp(event.starts_at + event.minutes * 60)}`,
      `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape(event.place)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  ctx.res.writeHead(200, {
    'content-type': 'text/calendar; charset=utf-8',
    'cache-control': 'no-store, private',
  });
  ctx.res.end(lines.join('\r\n'));
}

async function lumaSyncHandler(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (!ctx.user.is_admin) return oops(ctx, 'Stewards only.', 403);
  const result = await luma.sync({ hostId: ctx.user.id });
  const message = result.ok
    ? `Luma sync: ${result.created} added, ${result.updated} updated.`
    : `Luma sync failed: ${result.error}`;
  seeOther(ctx, `/homeroom/events?flash=${encodeURIComponent(message)}`);
}

/* -------------------------------------------------------------- library */

async function trackHandler(ctx, { slug }) {
  const track = await bf.getTrack(slug);
  if (!track) return notFound(ctx);
  const { modules } = await bf.listModules({ track: slug, userId: ctx.user.id });
  const stat = (await bf.progressSummary(ctx.user.id)).byTrack.find((row) => row.track === slug)
    || { total: modules.length, done: 0 };
  await render(ctx, views.trackPage(ctx, { track, modules, stat }), { title: track.title });
}

async function moduleHandler(ctx, { slug }) {
  const module = await bf.getModule(slug);
  if (!module) return notFound(ctx);
  const track = await bf.getTrack(module.track);
  const { modules } = await bf.listModules({ track: module.track, userId: ctx.user.id });
  await bf.bumpModuleReads(module.id);
  await render(
    ctx,
    views.modulePage(ctx, {
      module, track,
      progress: await bf.getProgress(ctx.user.id, module.id),
      neighbours: modules,
    }),
    { title: module.title },
  );
}

async function progressSubmit(ctx, { slug }) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const module = await bf.getModule(slug);
  if (!module) return notFound(ctx);
  const state = ['started', 'done', 'none'].includes(fields.state) ? fields.state : 'started';
  await bf.setProgress({
    userId: ctx.user.id,
    moduleId: module.id,
    state,
    note: trimmed(fields.note, 4000),
    link: normalizeUrl(fields.link) || '',
  });
  seeOther(ctx, `/homeroom/library/module/${module.slug}`);
}

/* ------------------------------------------------------- the front door */

function stewardsOnly(ctx) {
  if (ctx.user.is_admin) return true;
  oops(ctx, 'Stewards only.', 403);
  return false;
}

/* ------------------------------------------------------------- onboarding */

async function welcomeHandler(ctx) {
  await render(
    ctx,
    views.welcomePage(ctx, {
      member: await bf.ensureMember(ctx.user.id),
      progress: await bf.onboardingProgress(ctx.user.id),
      stats: await bf.networkStats(),
    }),
    { title: 'Welcome' },
  );
}

/* -------------------------------------------------------- steward: invites */

async function invitesHandler(ctx, { minted = null, error = null, flash = null } = {}) {
  if (!stewardsOnly(ctx)) return;
  const listed = await invites.list({ limit: 100 });
  await render(
    ctx,
    views.invitesPage(ctx, {
      invites: listed.invites,
      health: invites.health(),
      rosterMode: roster.accessMode(),
      minted,
      error: error || (listed.ok ? null : listed.error),
      flash,
    }),
    { title: 'Invites' },
  );
}

async function inviteCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (!stewardsOnly(ctx)) return;

  const email = invites.normalizeEmail(fields.email);
  if (!email.includes('@')) {
    return await invitesHandler(ctx, { error: 'That does not look like an email address.' });
  }
  if (await bf.getUserByEmail(email)) {
    return await invitesHandler(ctx, { error: `${email} already has an account.` });
  }

  /*
   * Check the roster, but do not obey it. A steward inviting someone by name is
   * itself an admission decision — often made precisely because the roster is
   * behind, or the person applied under a different address. So the verdict is
   * recorded rather than enforced, and a verdict that is not a clean pass needs
   * the steward to say so on purpose.
   */
  const assessment = await access.assess(email);

  // Only a definite negative needs a steward to insist. `closed` means self
  // signup is off — which is the normal state, and the whole reason an invite
  // is being sent — and `error` or `open` mean the roster has no usable opinion
  // either way. Making any of those demand a tick would train stewards to tick
  // the box every time, which is the same as not having it.
  const blocking = assessment.verdict === 'deny' || assessment.verdict === 'review';
  const override = fields.override === '1';
  if (blocking && !override) {
    return await invitesHandler(ctx, {
      error: `The roster says "${assessment.verdict}: ${assessment.reason}" for ${email}. `
        + 'Tick the override box to send it anyway — it will be recorded against the invite.',
    });
  }

  const created = await invites.create({
    email,
    invitedBy: ctx.user.id,
    note: trimmed(fields.note, 200),
    rosterVerdict: blocking ? `override:${assessment.verdict}:${assessment.reason}`
      : `${assessment.verdict}:${assessment.reason}`,
    ttlDays: clampInt(fields.days, 14, 1, 90),
  });
  if (!created.ok) return await invitesHandler(ctx, { error: created.error });

  return await invitesHandler(ctx, {
    minted: {
      email,
      url: invites.inviteUrl(origin(ctx), created.token),
      expiresAt: nowSeconds() + clampInt(fields.days, 14, 1, 90) * 86400,
    },
  });
}

async function inviteRevoke(ctx, { id }) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (!stewardsOnly(ctx)) return;
  const result = await invites.revoke(id);
  if (!result.ok) return await invitesHandler(ctx, { error: result.error });
  return await invitesHandler(ctx, {
    flash: result.revoked ? 'Invite revoked. That link no longer works.'
      : 'Nothing to revoke — it was already used or revoked.',
  });
}

/** Absolute origin, for building an invite link a steward can paste anywhere. */
function origin(ctx) {
  const proto = ctx.req.headers['x-forwarded-proto'] || 'https';
  const host = ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host || 'haus.fund';
  return `${String(proto).split(',')[0].trim()}://${host}`;
}

async function accessAdminHandler(ctx, lookup = null) {
  if (!stewardsOnly(ctx)) return;
  await render(
    ctx,
    views.accessAdminPage(ctx, {
      counts: await bf.rosterCounts(),
      mode: roster.accessMode(),
      // Actually probe it. A steward opening this page is usually here because
      // somebody cannot get in, and "is the door wired up" is the first thing
      // they need — a banner that assumes it is fine would be worse than none.
      health: await roster.health(),
      pending: await bf.pendingRoster(),
      recent: await bf.recentRoster({ limit: 40 }),
      lookup,
    }),
    { title: 'Front door' },
  );
}

/**
 * Live lookup for a steward chasing "why can't they sign in".
 *
 * Deliberately does NOT write to the cache: a steward checking somebody should
 * not change what happens the next time that person tries the door, or the
 * queue above would quietly empty itself as it was read.
 */
async function accessLookupHandler(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (!stewardsOnly(ctx)) return;
  const email = trimmed(fields.email, 200);
  const result = await roster.lookup(email);
  await accessAdminHandler(ctx, result.ok
    ? { email, verdict: result.verdict, reason: result.reason, person: result.person }
    : { email, verdict: 'error', reason: 'roster-unreachable', error: result.error });
}

/* -------------------------------------------------------------- publish */

async function publishHandler(ctx) {
  await render(
    ctx,
    views.publishPage(ctx, {
      submissions: await bf.newsSubmissions(ctx.user.id),
      supabase: await supabase.health(),
    }),
    { title: 'Publish to news' },
  );
}

/**
 * Send a member's post to the public feed.
 *
 * The local receipt is written first and updated with the outcome, so a
 * Supabase failure leaves a row the member can see and a steward can retry —
 * rather than an error page and no record that they ever tried.
 */
async function publishSubmit(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'publish', LIMITS.publish)) return;

  const values = {
    title: trimmed(fields.title, 300),
    url: normalizeUrl(fields.url) || '',
    body: trimmed(fields.body, 20_000),
    topic: trimmed(fields.topic, 40) || 'general',
  };
  const fail = async (message) => await render(
    ctx,
    views.publishPage(ctx, {
      submissions: await bf.newsSubmissions(ctx.user.id), supabase: { configured: supabase.configured(), reachable: true },
      error: message, values,
    }),
    { title: 'Publish to news', status: 400 },
  );

  if (!values.title) return fail('It needs a headline.');
  if (!values.url && !values.body) return fail('Give it a link or some context — ideally both.');

  const id = await bf.recordNewsSubmission({ userId: ctx.user.id, ...values });
  const result = await supabase.submitToNews({ handle: ctx.user.id, ...values });

  if (!result.ok) {
    await bf.updateNewsSubmission(id, { status: 'failed', error: result.error });
    return fail(result.unconfigured
      ? 'Publishing is not configured yet — your submission was saved here and can be sent once it is.'
      : `Could not reach the feed: ${result.error}`);
  }

  const remoteId = Array.isArray(result.data) ? result.data[0]?.id : result.data?.id;
  await bf.updateNewsSubmission(id, { status: 'queued', remoteId: remoteId ? String(remoteId) : null });
  await render(
    ctx,
    views.publishPage(ctx, {
      submissions: await bf.newsSubmissions(ctx.user.id),
      supabase: { configured: true, reachable: true },
      sent: true,
    }),
    { title: 'Publish to news' },
  );
}

function defaultStart() {
  return toLocalInput(nowSeconds() + 3 * 86400);
}

/** Small POST helper: read the body, check CSRF, run `fn(ctx, fields, params)`. */
/* ---------------------------------------------------------- mentor desk */

/*
 * Gating the booking link. See docs/MENTOR-ENGINE.md, and mentordesk.js for
 * why capacity rather than invisibility is the mechanism here.
 *
 * Three things in this block are load-bearing:
 *
 *   - the scheduler URL is never handed to a view. The member gets a grant id,
 *     and /book/:grant resolves it server-side at click time.
 *   - the /homeroom/m/:token pages run with NO session. Mentors have no
 *     Homeroom account and never will; the token in the URL is the credential.
 *   - state changes are POST only, because mail gateways fetch every link in a
 *     message before delivering it and a GET that accepts would be fired by a
 *     scanner rather than by a mentor.
 */

async function mentorRequestForm(ctx, { slug }, error = null, values = {}) {
  const mentor = await bf.getMentor(slug);
  if (!mentor) return notFound(ctx);
  const verdict = await desk.canRequest({ mentor, memberId: ctx.user.id });
  if (!verdict.ok && !error) {
    // Never render a form that cannot be submitted. Send them back to the
    // profile, which already explains the reason in context.
    return seeOther(ctx, `/homeroom/mentor/${mentor.slug}`);
  }
  await render(ctx, views.requestFormPage(ctx, {
    mentor,
    capacity: verdict.capacity || await desk.capacityFor(mentor),
    error,
    values,
  }), { title: `Ask ${mentor.name}`, subnav: views.subnav(views.MENTOR_TABS, 'mentors') });
}

async function mentorRequestCreate(ctx, fields, params) {
  const mentor = await bf.getMentor(params.slug);
  if (!mentor) return notFound(ctx);

  const values = {
    track: trimmed(fields.track, 40),
    need: trimmed(fields.need, 2000),
    why_them: trimmed(fields.why_them, 1000),
    tried: trimmed(fields.tried, 1000),
    asking_for: trimmed(fields.asking_for, 80),
  };

  const verdict = await desk.canRequest({ mentor, memberId: ctx.user.id });
  if (!verdict.ok) return await mentorRequestForm(ctx, params, verdict.message, values);
  if (values.need.length < 40) {
    return await mentorRequestForm(ctx, params,
      'Say more about what you need — 40 characters is not enough for them to answer.', values);
  }
  if (values.why_them.length < 20) {
    return await mentorRequestForm(ctx, params,
      'Say why this person. It is the difference between a request and a mail merge.', values);
  }

  const created = await desk.createRequest({
    mentor,
    memberId: ctx.user.id,
    track: values.track,
    need: values.need,
    whyThem: values.why_them,
    tried: values.tried,
    askingFor: values.asking_for,
  });

  await desk.logEvent({
    mentorId: mentor.id, requestId: created.id, actorId: ctx.user.id, actorKind: 'member',
    event: 'requested', detail: created.auto ? 'auto-accepted per consent mode' : '',
  });

  const member = await bf.getMember(ctx.user.id);
  const to = await desk.contactFor(mentor.id);
  const message = mentormail.requestMessage({
    mentor, to, member, request: values, token: created.token,
    capacity: await desk.capacityFor(mentor),
  });
  await mentormail.deliver(created.auto
    // The mentor said "do not ask me". Tell them it happened; do not ask.
    ? { ...message, subject: `${member?.name || ctx.user.id} booked time with you` }
    : message);

  seeOther(ctx, '/homeroom/mentors/requests');
}

/** The grant redirect. The only path from a member to a scheduler URL. */
async function mentorBook(ctx, { slug, grant }) {
  const mentor = await bf.getMentor(slug);
  const result = await desk.redeemGrant({
    grantId: grant, memberId: ctx.user.id, mentorId: mentor?.id,
  });
  if (!result.ok) {
    return await render(ctx, views.grantGonePage(ctx, { mentor, reason: result.reason }),
      { title: 'Link no longer works', status: 410 });
  }
  await desk.logEvent({
    mentorId: result.grant.mentor_id, requestId: result.grant.request_id,
    actorId: ctx.user.id, actorKind: 'member', event: 'booking-opened',
  });
  // 302 rather than 303: this is a redirect to a resource, not the result of a
  // form. `noreferrer` cannot be set on a redirect, so the scheduler will see
  // the Homeroom path in the Referer — which is why the URL carries a random
  // grant id and nothing about the member.
  ctx.res.writeHead(302, { location: result.url, 'referrer-policy': 'no-referrer' });
  ctx.res.end();
}

/* --- the mentor's side: no account, no session, token in the URL --------- */

async function mentorTokenPage(ctx, { token }) {
  const request = await desk.findByToken(token);
  if (!request) {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  }
  if (request.state !== 'sent') {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'already' }), { status: 410 });
  }
  const mentor = await bf.getMentor(request.mentor_id);
  const member = await bf.getMember(request.member_id) || { user_id: request.member_id };
  sendHtml(ctx.res, views.mentorRequestPage({
    mentor, request, member, capacity: await desk.capacityFor(mentor), token,
  }));
}

async function mentorTokenAnswer(ctx, { token }, decision) {
  const { fields } = await readBody(ctx.req);
  const result = await desk.answerRequest({
    token,
    decision,
    note: trimmed(fields.note, 200),
    pauseDays: decision === 'later' ? 30 : 0,
  });

  if (!result.ok) {
    const status = result.reason === 'unknown' ? 404 : 410;
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: result.reason }), { status });
  }

  const { mentor, request } = result;
  await desk.logEvent({
    mentorId: mentor.id, requestId: request.id, actorKind: 'mentor',
    event: result.decision, detail: result.late ? 'answered after the window closed' : '',
  });

  if (result.decision === 'accept') {
    await bf.notify({
      userId: request.member_id, kind: 'intro',
      text: `${mentor.name} said yes — your booking link is ready`,
      href: '/homeroom/mentors/requests',
    });
  } else {
    // Deliberately NOT revoking outstanding grants on a pause. A mentor who is
    // buried is saying "stop sending me requests", not "take back the yes I
    // already gave someone else" — and the member holding that grant did
    // nothing wrong. Pausing stops new requests; it does not cancel a yes.
    await bf.notify({
      userId: request.member_id, kind: 'intro',
      text: `${mentor.name} passed on your request`,
      href: '/homeroom/mentors/requests',
    });
  }

  sendHtml(ctx.res, views.mentorAnsweredPage({
    mentor, decision: result.decision, paused: !!result.paused,
  }));
}

/* ------------------------------- mentor desk: a mentor's own standing consent */

/*
 * /homeroom/me/:token — no session, ever. Same reasoning as /homeroom/m/:token
 * and the same POST-only rule for anything that changes state, because these
 * links live in mail that gateways pre-fetch.
 */

async function mentorStanding(ctx, { token }) {
  const row = await mentorlife.findToken(token);
  if (!row) return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  const mentor = await bf.getMentor(row.mentor_id);
  if (!mentor) return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  sendHtml(ctx.res, views.mentorStandingPage({ mentor, token, state: mentor.state }));
}

async function mentorStandingAction(ctx, { token }, action) {
  await readBody(ctx.req);
  const result = action === 'confirm' ? await mentorlife.confirm(token)
    : action === 'pause' ? await mentorlife.pause(token, { days: 90 })
    : await mentorlife.withdraw(token);

  if (!result.ok) {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: result.reason }), { status: 404 });
  }
  sendHtml(ctx.res, views.mentorStandingDonePage({ action, days: result.days || 0 }));
}

/* --------------------------------------------------- mentor desk: steward */

async function mentorAdminHandler(ctx, { error = null, flash = null } = {}) {
  if (!stewardsOnly(ctx)) return;
  const status = await mentorsync.status();
  await render(ctx, views.mentorAdminPage(ctx, {
    pending: await mentorsync.pendingSubmissions(),
    status,
    stuck: await mentorsync.stuckRequests(),
    roster: status.byState,
    metrics: await mentorlife.metrics(),
    error,
    flash,
  }), { title: 'Mentor desk' });
}

async function mentorSyncNow(ctx) {
  if (!stewardsOnly(ctx)) return;
  const result = await mentorsync.sync();
  // Fail closed and say so. The roster is untouched either way, which is the
  // property worth being loud about: a failed sync is not a smaller roster.
  await mentorAdminHandler(ctx, result.ok
    ? { flash: `${result.seen} seen, ${result.created} new, ${result.updated} updated.` }
    : { error: `${result.error} Nothing was changed.` });
}

function action(fn) {
  return async (ctx, params) => {
    const { fields } = await readBody(ctx.req);
    if (!csrfOk(ctx, fields)) return;
    await fn(ctx, fields, params);
  };
}

const ROUTES = [
  ['GET', '/homeroom', homeHandler],
  /* ---- yearbook ---- */
  ['GET', '/homeroom/yearbook/edit', async (ctx) => await render(ctx, views.yearbookFormPage(ctx, {
    entry: await bf.getYearbook(ctx.user.id), member: await bf.ensureMember(ctx.user.id),
  }), { title: 'Your yearbook entry', subnav: views.subnav(views.YEARBOOK_TABS, 'mine') })],
  ['POST', '/homeroom/yearbook/edit', yearbookSubmit],
  ['GET', '/homeroom/yearbook', yearbookHandler],
  ['POST', '/homeroom/yearbook/:handle/sign', action(async (ctx, fields, p) => {
    const target = await bf.getMember(p.handle);
    if (!target) return notFound(ctx);
    const result = await bf.signYearbook({
      userId: target.user_id, authorId: ctx.user.id, body: trimmed(fields.body, 600),
    });
    if (!result.ok) return oops(ctx, result.error);
    await bf.notify({
      userId: target.user_id,
      kind: 'signature',
      actorId: ctx.user.id,
      text: `${ctx.user.id} signed your yearbook`,
      href: `/homeroom/yearbook/${encodeURIComponent(target.user_id)}`,
    });
    seeOther(ctx, `/homeroom/yearbook/${encodeURIComponent(target.user_id)}`);
  })],
  ['GET', '/homeroom/yearbook/:handle', yearbookEntryHandler],

  ['GET', '/homeroom/people', peopleHandler],
  ['GET', '/homeroom/p/:handle', memberHandler],
  ['GET', '/homeroom/settings', async (ctx) => await render(ctx, views.settingsPage(ctx, {
    member: await bf.ensureMember(ctx.user.id),
    saved: ctx.query.get('saved') === '1',
    passwordSaved: ctx.query.get('password') === '1',
    authMode: sbAuth.configured() ? 'supabase' : 'local',
  }), { title: 'Your profile' })],
  ['POST', '/homeroom/settings', settingsSubmit],
  ['POST', '/homeroom/password', passwordSubmit],

  ['GET', '/homeroom/labs/new', async (ctx) => await render(ctx, views.labFormAtlasPage(ctx, {}),
    { title: 'Add a lab', subnav: views.subnav(views.LAB_TABS, 'atlas') })],
  ['POST', '/homeroom/labs/new', atlasLabCreate],
  ['GET', '/homeroom/labs/cores', async (ctx) => await render(ctx, views.coresPage(ctx),
    { title: 'Core Facility Finder', subnav: views.subnav(views.LAB_TABS, 'cores'), wide: true })],
  ['GET', '/homeroom/labs/member', labsHandler],
  ['GET', '/homeroom/labs/member/new', async (ctx) => await render(ctx, views.labFormPage(ctx, {}),
    { title: 'Add your lab' })],
  ['POST', '/homeroom/labs/member/new', labCreate],
  ['POST', '/homeroom/labs/at/:slug/report', action(async (ctx, fields, p) => {
    const lab = await bf.getLab(p.slug);
    if (!lab) return notFound(ctx);
    const result = await bf.reportLab({
      labId: lab.id, userId: ctx.user.id,
      status: String(fields.status || ''), body: trimmed(fields.body, 2000),
    });
    if (!result.ok) return oops(ctx, result.error);
    seeOther(ctx, `/homeroom/labs/at/${lab.slug}`);
  })],
  ['GET', '/homeroom/labs/at/:slug', atlasLabHandler],
  ['GET', '/homeroom/labs', atlasHandler],
  ['GET', '/homeroom/lab/:slug/edit', async (ctx, p) => {
    const org = await bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    if (!await bf.isOrgAdmin(org.id, ctx.user.id) && !ctx.user.is_admin) return oops(ctx, 'Only lab admins can edit this.', 403);
    await render(ctx, views.labFormPage(ctx, { org }), { title: `Edit ${org.name}` });
  }],
  ['POST', '/homeroom/lab/:slug/edit', labEdit],
  ['GET', '/homeroom/lab/:slug/update', async (ctx, p) => {
    const org = await bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    if (!await bf.isOrgMember(org.id, ctx.user.id)) return oops(ctx, 'Only the team can post updates.', 403);
    await render(ctx, views.updateFormPage(ctx, { org }), { title: `Update from ${org.name}` });
  }],
  ['POST', '/homeroom/lab/:slug/update', labUpdatePost],
  ['POST', '/homeroom/lab/:slug/join', action(async (ctx, fields, p) => {
    const org = await bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    await bf.joinOrg(org.id, ctx.user.id);
    seeOther(ctx, `/homeroom/lab/${org.slug}`);
  })],
  ['POST', '/homeroom/lab/:slug/leave', action(async (ctx, fields, p) => {
    const org = await bf.getOrg(p.slug);
    if (!org) return notFound(ctx);
    await bf.leaveOrg(org.id, ctx.user.id);
    seeOther(ctx, `/homeroom/lab/${org.slug}`);
  })],
  ['GET', '/homeroom/lab/:slug', labHandler],

  ['GET', '/homeroom/perks/new', async (ctx) => await render(ctx, views.dealFormPage(ctx, {}), { title: 'Add a perk' })],
  ['POST', '/homeroom/perks/new', dealCreate],
  ['GET', '/homeroom/perks', perksHandler],
  ['POST', '/homeroom/perk/:slug/claim', action(async (ctx, fields, p) => {
    const perk = await bf.getDeal(p.slug);
    if (!perk) return notFound(ctx);
    await bf.claimDeal(perk.id, ctx.user.id);
    seeOther(ctx, `/homeroom/perk/${perk.slug}`);
  })],
  ['POST', '/homeroom/perk/:slug/code', action(async (ctx, fields, p) => {
    if (!ctx.user.is_admin) return oops(ctx, 'Stewards only.', 403);
    const perk = await bf.getDeal(p.slug);
    if (!perk) return notFound(ctx);
    await bf.setDealCode(perk.id, trimmed(fields.code, 120));
    seeOther(ctx, `/homeroom/perk/${perk.slug}`);
  })],
  ['GET', '/homeroom/perk/:slug', perkHandler],

  /* Deals became Perks. Old links, and anything bookmarked, still land. */
  ['GET', '/homeroom/deals', (ctx) => seeOther(ctx, `/homeroom/perks${ctx.url.search || ''}`)],
  ['GET', '/homeroom/deals/new', (ctx) => seeOther(ctx, '/homeroom/perks/new')],
  ['GET', '/homeroom/deal/:slug', (ctx, p) => seeOther(ctx, `/homeroom/perk/${encodeURIComponent(p.slug)}`)],

  ['GET', '/homeroom/funders/new', async (ctx) => await render(ctx, views.funderFormPage(ctx, {}), { title: 'Add a funder' })],
  ['POST', '/homeroom/funders/new', funderCreate],
  ['GET', '/homeroom/funders', fundersHandler],
  ['GET', '/homeroom/pipeline', async (ctx) => await render(ctx, views.pipelinePage(ctx, { rows: await bf.pipeline(ctx.user.id) }),
    { title: 'Pipeline' })],
  ['POST', '/homeroom/funder/:slug/review', reviewSubmit],
  ['POST', '/homeroom/review/:id/helpful', action(async (ctx, fields, p) => {
    const review = await bf.getReview(Number(p.id));
    if (!review) return notFound(ctx);
    if (review.user_id === ctx.user.id) return oops(ctx, 'You cannot vouch for your own review.', 403);
    await bf.toggleReviewHelpful(review.id, ctx.user.id);
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/review/:id/comment', action(async (ctx, fields, p) => {
    const review = await bf.getReview(Number(p.id));
    if (!review) return notFound(ctx);
    if (limited(ctx, 'comment', LIMITS.comment)) return;
    const result = await bf.addReviewComment({
      reviewId: review.id, authorId: ctx.user.id,
      body: trimmed(fields.body, 4000), anonymous: checkbox(fields.anonymous),
    });
    if (!result.ok) return oops(ctx, result.error);
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/review/comment/:id/delete', action(async (ctx, fields, p) => {
    if (!await bf.deleteReviewComment(Number(p.id), ctx.user.id, { isAdmin: !!ctx.user.is_admin })) {
      return oops(ctx, 'Not yours to delete.', 403);
    }
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/funder/:slug/track', trackSubmit],
  ['POST', '/homeroom/funder/:slug/untrack', action(async (ctx, fields, p) => {
    const funder = await bf.getFunder(p.slug);
    if (!funder) return notFound(ctx);
    await bf.removePipeline(ctx.user.id, funder.id);
    seeOther(ctx, `/homeroom/funder/${funder.slug}`);
  })],
  ['GET', '/homeroom/funder/:slug', funderHandler],

  ['GET', '/homeroom/mentors', mentorsHandler],
  ['GET', '/homeroom/mentors/requests', async (ctx) => {
    // Each row's outcome is its own read, so they go out together rather than
    // one after another — this list is as long as the member's history.
    const requests = await Promise.all(
      (await desk.requestsFor(ctx.user.id))
        .map(async (r) => ({ ...r, outcome: await desk.outcomeFor(r.id) })),
    );
    await render(ctx, views.myRequestsPage(ctx, { requests }),
      { title: 'Your mentor requests', subnav: views.subnav(views.MENTOR_TABS, 'requests') });
  }],
  ['GET', '/homeroom/mentor/:slug/request', async (ctx, p) => await mentorRequestForm(ctx, p)],
  ['POST', '/homeroom/mentor/:slug/request', action(mentorRequestCreate)],
  ['GET', '/homeroom/mentor/:slug/book/:grant', mentorBook],
  ['POST', '/homeroom/mentor/request/:id/withdraw', action(async (ctx, fields, p) => {
    await desk.withdrawRequest(p.id, ctx.user.id);
    seeOther(ctx, '/homeroom/mentors/requests');
  })],
  ['POST', '/homeroom/mentor/request/:id/outcome', action(async (ctx, fields, p) => {
    const request = await desk.getRequest(p.id);
    if (!request || request.member_id !== ctx.user.id) return notFound(ctx);
    await desk.logOutcome({
      requestId: request.id,
      met: checkbox(fields.met),
      useful: clampInt(fields.useful, 1, 5, null),
      note: trimmed(fields.note, 200),
    });
    seeOther(ctx, '/homeroom/mentors/requests');
  })],

  /* The mentor's own three pages. No session: see homeroomRoute below. */
  ['GET', '/homeroom/m/:token', mentorTokenPage],
  ['GET', '/homeroom/me/:token', mentorStanding],
  ['POST', '/homeroom/me/:token/confirm', async (ctx, p) => await mentorStandingAction(ctx, p, 'confirm')],
  ['POST', '/homeroom/me/:token/pause', async (ctx, p) => await mentorStandingAction(ctx, p, 'pause')],
  ['POST', '/homeroom/me/:token/withdraw', async (ctx, p) => await mentorStandingAction(ctx, p, 'withdraw')],
  ['POST', '/homeroom/m/:token/accept', async (ctx, p) => await mentorTokenAnswer(ctx, p, 'accept')],
  ['POST', '/homeroom/m/:token/decline', async (ctx, p) => await mentorTokenAnswer(ctx, p, 'decline')],
  ['POST', '/homeroom/m/:token/later', async (ctx, p) => await mentorTokenAnswer(ctx, p, 'later')],

  ['GET', '/homeroom/mentor/:slug', mentorHandler],

  ['GET', '/homeroom/hours/new', async (ctx) => await render(ctx, views.slotFormPage(ctx, { defaultStart: defaultStart() }),
    { title: 'Offer office hours', subnav: views.subnav(views.MENTOR_TABS, 'hours') })],
  ['POST', '/homeroom/hours/new', slotCreate],
  ['GET', '/homeroom/hours', hoursHandler],
  ['POST', '/homeroom/hours/:id/book', action(async (ctx, fields, p) => {
    const result = await bf.bookSlot(Number(p.id), ctx.user.id, trimmed(fields.question, 2000));
    if (!result.ok) return oops(ctx, result.error);
    if (result.hostId) {
      await bf.notify({
        userId: result.hostId,
        kind: 'booking',
        actorId: ctx.user.id,
        text: `${ctx.user.id} booked your office hours`,
        href: `/homeroom/hours/${p.id}`,
      });
    }
    seeOther(ctx, `/homeroom/hours/${p.id}`);
  })],
  ['POST', '/homeroom/hours/:id/unbook', action(async (ctx, fields, p) => {
    await bf.cancelBooking(Number(p.id), ctx.user.id);
    seeOther(ctx, `/homeroom/hours/${p.id}`);
  })],
  ['POST', '/homeroom/hours/:id/cancel', action(async (ctx, fields, p) => {
    const slot = await bf.getSlot(p.id);
    if (!slot) return notFound(ctx);
    if (slot.host_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Only the host can cancel.', 403);
    for (const booking of await bf.slotBookings(slot.id)) {
      await bf.notify({
        userId: booking.user_id,
        kind: 'booking',
        actorId: ctx.user.id,
        text: `${slot.host_id} canceled “${slot.title}”`,
        href: `/homeroom/hours/${slot.id}`,
      });
    }
    await bf.cancelSlot(slot.id);
    seeOther(ctx, '/homeroom/hours');
  })],
  ['GET', '/homeroom/hours/:id', slotHandler],

  ['GET', '/homeroom/jobs/new', async (ctx) => {
    const orgs = await bf.userOrgs(ctx.user.id);
    if (!orgs.length) return oops(ctx, 'Add your lab first — roles hang off a lab.', 400);
    await render(ctx, views.jobFormPage(ctx, { orgs, values: Object.fromEntries(ctx.query) }), { title: 'Post a role' });
  }],
  ['POST', '/homeroom/jobs/new', jobCreate],
  ['GET', '/homeroom/jobs', jobsHandler],
  ['POST', '/homeroom/job/:id/apply', action(async (ctx, fields, p) => {
    const job = await bf.getJob(p.id);
    if (!job || job.closed) return notFound(ctx);
    await bf.applyToJob(job.id, ctx.user.id, trimmed(fields.note, 4000));
    await bf.notify({
      userId: job.posted_by,
      kind: 'application',
      actorId: ctx.user.id,
      text: `${ctx.user.id} applied for ${job.title}`,
      href: `/homeroom/job/${job.id}`,
    });
    seeOther(ctx, `/homeroom/job/${job.id}`);
  })],
  ['POST', '/homeroom/job/:id/close', action(async (ctx, fields, p) => {
    const job = await bf.getJob(p.id);
    if (!job) return notFound(ctx);
    if (job.posted_by !== ctx.user.id && !await bf.isOrgAdmin(job.org_id, ctx.user.id)) {
      return oops(ctx, 'Not yours to close.', 403);
    }
    await bf.closeJob(job.id, !job.closed);
    seeOther(ctx, `/homeroom/job/${job.id}`);
  })],
  ['GET', '/homeroom/job/:id', jobHandler],

  ['GET', '/homeroom/events/new', async (ctx) => await render(ctx, views.eventFormPage(ctx, { defaultStart: defaultStart() }),
    { title: 'Add an event' })],
  ['POST', '/homeroom/events/new', eventCreate],
  ['GET', '/homeroom/events/list', eventsHandler],
  ['POST', '/homeroom/events/sync', lumaSyncHandler],
  ['GET', '/homeroom/events.ics', icsHandler],
  ['GET', '/homeroom/events', calendarHandler],
  ['POST', '/homeroom/event/:id/rsvp', action(async (ctx, fields, p) => {
    const event = await bf.getEvent(p.id);
    if (!event) return notFound(ctx);
    const status = ['going', 'maybe', 'none'].includes(fields.status) ? fields.status : 'going';
    if (status === 'going' && event.capacity && event.going >= event.capacity && await bf.myRsvp(event.id, ctx.user.id) !== 'going') {
      return oops(ctx, 'That event is full.');
    }
    await bf.rsvp(event.id, ctx.user.id, status);
    seeOther(ctx, `/homeroom/event/${event.id}`);
  })],
  ['POST', '/homeroom/event/:id/cancel', action(async (ctx, fields, p) => {
    const event = await bf.getEvent(p.id);
    if (!event) return notFound(ctx);
    if (event.host_id !== ctx.user.id && !ctx.user.is_admin) return oops(ctx, 'Only the host can cancel.', 403);
    await bf.cancelEvent(event.id);
    seeOther(ctx, `/homeroom/event/${event.id}`);
  })],
  ['GET', '/homeroom/event/:id', eventHandler],

  ['GET', '/homeroom/library/new', async (ctx) => await render(ctx, views.libraryFormPage(ctx, {}), { title: 'Write for the library' })],
  ['POST', '/homeroom/library/new', libraryCreate],
  ['GET', '/homeroom/library/tree', async (ctx) => await render(ctx, views.treePage(ctx, {
    moduleCount: LIBRARY_MODULES.length, nodeCount: SKILL_TREE_NODES,
  }), { title: 'Skill tree', subnav: views.subnav(views.LIBRARY_TABS, 'tree'), wide: true })],
  ['GET', '/homeroom/library/notes', async (ctx) => await render(ctx, views.deliverablesPage(ctx, {
    rows: await bf.deliverables(ctx.user.id), progress: await bf.progressSummary(ctx.user.id),
  }), { title: 'Your deliverables', subnav: views.subnav(views.LIBRARY_TABS, 'notes') })],
  ['GET', '/homeroom/library/track/:slug', trackHandler],
  ['GET', '/homeroom/library/module/:slug', moduleHandler],
  ['POST', '/homeroom/library/module/:slug/progress', progressSubmit],
  ['GET', '/homeroom/library/entry/:slug', libraryEntryHandler],
  ['GET', '/homeroom/library', libraryHandler],
  /* Member-written entries used to live at /library/:slug. Keep those links. */
  ['GET', '/homeroom/library/:slug', libraryEntryHandler],

  ['GET', '/homeroom/intros/new', async (ctx) => {
    const target = await bf.getMember(ctx.query.get('to'));
    if (!target) return notFound(ctx);
    await render(ctx, views.introFormPage(ctx, { target }), { title: 'Request an intro' });
  }],
  ['POST', '/homeroom/intros/new', introCreate],
  ['POST', '/homeroom/intros/:id/resolve', introResolve],
  ['GET', '/homeroom/intros', async (ctx) => await render(ctx, views.introsPage(ctx, await bf.introsFor(ctx.user.id)), { title: 'Intros' })],

  ['GET', '/homeroom/messages/new', async (ctx) => await render(ctx, views.newMessagePage(ctx, { to: ctx.query.get('to') || '' }),
    { title: 'New message' })],
  ['POST', '/homeroom/messages/new', messageCreate],
  ['GET', '/homeroom/messages', async (ctx) => await render(ctx, views.messagesPage(ctx, { threads: await bf.threadsFor(ctx.user.id) }),
    { title: 'Messages' })],
  ['GET', '/homeroom/messages/:id', threadHandler],
  ['POST', '/homeroom/messages/:id', threadReply],

  ['GET', '/homeroom/notifications', async (ctx) => {
    const items = await bf.notifications(ctx.user.id);
    await render(ctx, views.notificationsPage(ctx, { items }), { title: 'Notifications' });
    await bf.markNotificationsRead(ctx.user.id);
  }],
  ['GET', '/homeroom/search', async (ctx) => {
    const query = (ctx.query.get('q') || '').trim().slice(0, 120);
    const results = await bf.globalSearch(query);
    await render(ctx, views.searchPage(ctx, { query, results }),
      { title: query ? `Search: ${query}` : 'Search' });
  }],
  ['GET', '/homeroom/welcome', welcomeHandler],
  ['GET', '/homeroom/stewards/invites', async (ctx) => await invitesHandler(ctx)],
  ['POST', '/homeroom/stewards/invites', inviteCreate],
  ['POST', '/homeroom/stewards/invites/:id/revoke', inviteRevoke],
  ['GET', '/homeroom/stewards/mentors', async (ctx) => await mentorAdminHandler(ctx)],
  ['POST', '/homeroom/stewards/mentors/sync', action(mentorSyncNow)],
  ['POST', '/homeroom/stewards/mentors/:id/rule', action(async (ctx, fields, p) => {
    if (!stewardsOnly(ctx)) return;
    const decision = fields.decision === 'list' ? 'list' : 'reject';
    const note = trimmed(fields.note, 300);
    // A rejection without a reason is a decision the next steward cannot read.
    if (decision === 'reject' && !note) {
      return await mentorAdminHandler(ctx, { error: 'Say why, so the next steward is not guessing.' });
    }
    const ruled = await mentorsync.rule({ mentorId: p.id, decision, actorId: ctx.user.id, note });
    if (!ruled) return notFound(ctx);
    seeOther(ctx, '/homeroom/stewards/mentors');
  })],
  ['GET', '/homeroom/stewards/access', async (ctx) => await accessAdminHandler(ctx)],
  ['POST', '/homeroom/stewards/access/lookup', accessLookupHandler],
  ['POST', '/homeroom/stewards/access/:hash/decide', action(async (ctx, fields, p) => {
    if (!stewardsOnly(ctx)) return;
    const decision = fields.decision === 'allow' ? 'allow' : 'deny';
    const row = await bf.rosterRow(p.hash);
    if (!row) return notFound(ctx);
    await bf.decideRoster({ hash: p.hash, userId: ctx.user.id, decision, note: trimmed(fields.note, 500) });
    seeOther(ctx, '/homeroom/stewards/access');
  })],

  ['GET', '/homeroom/publish', publishHandler],
  ['POST', '/homeroom/publish', publishSubmit],

  ['GET', '/homeroom/about', async (ctx) => await render(ctx, views.aboutPage(ctx, { stats: await bf.networkStats() }), { title: 'About' })],

  ['GET', '/homeroom/api/mentors', async (ctx) => {
    const { mentors, total } = await bf.searchMentors({
      q: ctx.query.get('q') || '', track: ctx.query.get('track') || '',
      tag: ctx.query.get('tag') || '', vetted: ctx.query.get('vetted') === '1',
      limit: clampInt(ctx.query.get('limit'), 1, 200, 60),
    });
    sendJson(ctx.res, { ok: true, total, mentors });
  }],
  ['GET', '/homeroom/api/atlas', async (ctx) => sendJson(ctx.res, {
    ok: true,
    ...await bf.searchLabs({
      q: ctx.query.get('q') || '', region: ctx.query.get('region') || '',
      status: ctx.query.get('status') || '', limit: clampInt(ctx.query.get('limit'), 1, 500, 200),
    }),
  })],
  ['GET', '/homeroom/api/perks', async (ctx) => sendJson(ctx.res, {
    ok: true, ...await bf.listDeals({ category: ctx.query.get('category') || '', limit: 300 }),
  })],
  ['GET', '/homeroom/api/library', async (ctx) => sendJson(ctx.res, {
    ok: true, tracks: await bf.tracks(),
    ...await bf.listModules({ track: ctx.query.get('track') || '', q: ctx.query.get('q') || '', userId: ctx.user.id }),
  })],
  ['GET', '/homeroom/api/members', async (ctx) => {
    const { members, total } = await bf.searchMembers({
      q: ctx.query.get('q') || '',
      tag: ctx.query.get('tag') || '',
      cohort: ctx.query.get('cohort') || '',
      limit: clampInt(ctx.query.get('limit'), 1, 100, PER_PAGE),
    });
    sendJson(ctx.res, { ok: true, total, members: members.map(publicMember) });
  }],
  ['GET', '/homeroom/api/member/:handle', async (ctx, p) => {
    const member = await bf.getMember(p.handle);
    if (!member) return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
    sendJson(ctx.res, { ok: true, member: publicMember(member) });
  }],
  ['GET', '/homeroom/api/labs', async (ctx) => {
    const { orgs, total } = await bf.searchOrgs({ q: ctx.query.get('q') || '', kind: ctx.query.get('kind') || '' });
    sendJson(ctx.res, { ok: true, total, labs: orgs });
  }],
  ['GET', '/homeroom/api/deals', async (ctx) => sendJson(ctx.res, { ok: true, ...await bf.listDeals({ category: ctx.query.get('category') || '' }) })],
  ['GET', '/homeroom/api/funders', async (ctx) => sendJson(ctx.res, { ok: true, ...await bf.listFunders({ q: ctx.query.get('q') || '' }) })],
  ['GET', '/homeroom/api/search', async (ctx) => sendJson(ctx.res, {
    ok: true, results: await bf.globalSearch(ctx.query.get('q') || ''),
  })],
];

/** Compile "/homeroom/lab/:slug/edit" into a matcher once, at module load. */
const COMPILED = ROUTES.map(([method, pattern, handler]) => {
  const segments = pattern.split('/').filter(Boolean);
  return {
    method, segments, handler,
    isApi: pattern.startsWith('/homeroom/api/'),
    // /homeroom/m/* is the mentor's side of the desk. Mentors have no Homeroom
    // account — roster.js admits residents and alumni, and a mentor is neither
    // — so these pages cannot be behind the members-only gate. The token in the
    // URL is the credential, and it is stored only as a hash.
    isPublic: pattern.startsWith('/homeroom/m/') || pattern.startsWith('/homeroom/me/'),
  };
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
      await bf.ensureMember(ctx.user.id);
    } else if (route.isPublic) {
      if (ctx.user) await bf.ensureMember(ctx.user.id);
    } else if (!await gate(ctx)) {
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
export async function homeroomNotFound(ctx) {
  if (ctx.path.startsWith('/homeroom/api/')) {
    return sendJson(ctx.res, { ok: false, error: 'not found' }, { status: 404 });
  }
  if (ctx.user) await bf.ensureMember(ctx.user.id);
  notFound(ctx);
}
