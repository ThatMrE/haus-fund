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
import * as desk from './mentordesk.js';
import * as mentormail from './mentormail.js';
import * as mentorsync from './mentorsync.js';
import * as mentorlife from './mentorlife.js';
import { homeroomLayout } from './views/layout.js';
import * as views from './views/pages.js';
import { parseWhen, toLocalInput } from './views/components.js';
import { S26_SEQUENCE } from './data/curriculum.js';

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
  render(
    ctx,
    views.homePage(ctx, {
      member,
      stats: bf.networkStats(),
      upcomingSlots: bf.listSlots({ upcoming: true, limit: 5 }),
      upcomingEvents: bf.listEvents({ upcoming: true, limit: 6 }),
      myOrgs: bf.userOrgs(ctx.user.id),
      deals: bf.listDeals({ limit: 6 }).deals,
      funders: bf.listFunders({ limit: 5 }).funders,
      mentors: bf.searchMentors({ limit: 5 }).mentors,
      modules: bf.listModules({ limit: 5 }),
      updates: bf.recentUpdates(4),
      intros: bf.introsFor(ctx.user.id).incoming.filter((i) => i.status === 'pending'),
      profileComplete: !!(member.headline && (member.expertise || []).length),
    }),
    { title: 'Home' },
  );
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
    { title: 'Directory', subnav: views.subnav(views.YEARBOOK_TABS, 'directory') },
  );
}

function memberHandler(ctx, { handle }) {
  const profile = bf.getMember(handle);
  if (!profile) return notFound(ctx);
  const isSelf = ctx.user.id.toLowerCase() === profile.user_id.toLowerCase();
  const outgoing = bf.introsFor(ctx.user.id).outgoing;
  render(
    ctx,
    views.memberPage(ctx, {
      profile,
      orgs: bf.userOrgs(profile.user_id),
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
  const back = (error) => render(ctx, views.settingsPage(ctx, {
    member: bf.ensureMember(ctx.user.id), passwordError: error, authMode,
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

  const account = bf.getUser(ctx.user.id);
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
    bf.setPassword(ctx.user.id, hashPassword(next));
  }

  // Everything else this account had open, gone — then a fresh session, so the
  // person who just changed it is not signed out by their own change.
  destroyAllSessions(ctx.user.id);
  const token = createSession(ctx.user.id);
  const proto = String(ctx.req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  ctx.res.writeHead(303, {
    location: '/homeroom/settings?password=1',
    'set-cookie': sessionCookie(token, { secure: proto ? proto === 'https' : !!process.env.NETLIFY }),
  });
  ctx.res.end();
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
  render(
    ctx,
    views.labPage(ctx, {
      org,
      team: bf.orgTeam(org.id),
      updates: bf.orgUpdates(org.id, { limit: 10 }),
      jobs: bf.listJobs({ orgId: org.id, limit: 10 }).jobs,
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

function perksHandler(ctx) {
  const category = ctx.query.get('category') || '';
  const q = ctx.query.get('q') || '';
  const { deals, total } = bf.listDeals({ category, q, limit: 300 });
  const claimed = new Set(bf.myClaims(ctx.user.id).map((d) => d.id));
  // Category counts come from the unfiltered set, so the filter bar does not
  // collapse to one option as soon as you use it.
  const counts = {};
  for (const perk of bf.listDeals({ limit: 500 }).deals) {
    counts[perk.category] = (counts[perk.category] || 0) + 1;
  }
  render(ctx, views.perksPage(ctx, { perks: deals, total, category, q, claimed, counts }),
    { title: 'Perks' });
}

function perkHandler(ctx, { slug }) {
  const perk = bf.getDeal(slug);
  if (!perk) return notFound(ctx);
  render(
    ctx,
    views.perkPage(ctx, {
      perk,
      claimed: bf.hasClaimed(perk.id, ctx.user.id),
      claimCount: bf.dealClaimCount(perk.id),
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
  const reviews = bf.funderReviews(funder.id, { sort: ctx.query.get('sort') === 'recent' ? 'recent' : 'helpful' });
  const ids = reviews.map((r) => r.id);
  render(
    ctx,
    views.funderPage(ctx, {
      funder,
      reviews,
      comments: bf.reviewComments(ids),
      myHelpful: bf.helpfulIds(ctx.user.id, ids),
      tags: bf.funderTagCloud(funder.id),
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
    { title: 'Office hours', subnav: views.subnav(views.MENTOR_TABS, 'hours') },
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
    { title: 'Events', subnav: views.subnav(views.EVENT_TABS, 'list') },
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
  const filters = { q: ctx.query.get('q') || '', track: ctx.query.get('track') || '' };
  const { modules } = filters.q || filters.track
    ? bf.listModules({ ...filters, userId: ctx.user.id })
    : { modules: [] };
  render(
    ctx,
    views.libraryPage(ctx, {
      tracks: bf.tracks(),
      progress: bf.progressSummary(ctx.user.id),
      modules,
      filters,
      entries: bf.listLibrary({ limit: 12 }).entries,
      sequence: S26_SEQUENCE,
    }),
    { title: 'Library' },
  );
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

function yearbookHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    cohort: ctx.query.get('cohort') || '',
    house: ctx.query.get('house') || '',
    tag: ctx.query.get('tag') || '',
  };
  const { members, total } = bf.yearbookWall({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  render(
    ctx,
    views.yearbookPage(ctx, {
      members, total, page, filters,
      cohorts: bf.wallCohorts(),
      houseList: bf.houses(),
      mine: bf.getYearbook(ctx.user.id),
      basePath: `/homeroom/yearbook${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Yearbook', subnav: views.subnav(views.YEARBOOK_TABS, 'wall') },
  );
}

function yearbookEntryHandler(ctx, { handle }) {
  const member = bf.getMember(handle);
  if (!member) return notFound(ctx);
  const signs = bf.signatures(member.user_id);
  render(
    ctx,
    views.yearbookEntryPage(ctx, {
      member,
      entry: bf.getYearbook(member.user_id),
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
  bf.upsertYearbook(ctx.user.id, {
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
  if (trimmed(fields.cohort, 20)) bf.updateMember(ctx.user.id, { cohort: trimmed(fields.cohort, 20) });
  seeOther(ctx, `/homeroom/yearbook/${encodeURIComponent(ctx.user.id)}`);
}

/* --------------------------------------------------------------- atlas */

function atlasHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    region: ctx.query.get('region') || '',
    country: ctx.query.get('country') || '',
    status: ctx.query.get('status') || '',
    kind: ctx.query.get('kind') || '',
    capability: ctx.query.get('capability') || '',
  };
  const { labs, total } = bf.searchLabs({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  render(
    ctx,
    views.atlasPage(ctx, {
      labs, total, filters, page,
      facets: bf.atlasFacets(),
      basePath: `/homeroom/labs${qs ? `?${qs}` : ''}`,
    }),
    { title: 'Biolab Atlas', subnav: views.subnav(views.LAB_TABS, 'atlas') },
  );
}

function atlasLabHandler(ctx, { slug }) {
  const lab = bf.getLab(slug);
  if (!lab) return notFound(ctx);
  render(ctx, views.atlasLabPage(ctx, { lab, reports: bf.labReports(lab.id) }), { title: lab.name });
}

async function atlasLabCreate(ctx) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  if (limited(ctx, 'create', LIMITS.create)) return;
  const name = trimmed(fields.name, 120);
  if (!name) {
    return render(ctx, views.labFormAtlasPage(ctx, { error: 'A lab needs a name.', values: fields }),
      { title: 'Add a lab', status: 400 });
  }
  const id = bf.upsertLab({
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
  const lab = bf.getLab(id);
  seeOther(ctx, `/homeroom/labs/at/${lab.slug}`);
}

/* ------------------------------------------------------------- mentors */

function mentorsHandler(ctx) {
  const page = pageParam(ctx);
  const filters = {
    q: ctx.query.get('q') || '',
    track: ctx.query.get('track') || '',
    tag: ctx.query.get('tag') || '',
    format: ctx.query.get('format') || '',
    vetted: ctx.query.get('vetted') === '1',
  };
  const { mentors, total } = bf.searchMentors({ ...filters, limit: 60, offset: (page - 1) * 60 });
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v).map(([k, v]) => [k, v === true ? '1' : v]),
  ).toString();
  render(
    ctx,
    views.mentorsPage(ctx, {
      mentors, total, filters, page,
      tags: bf.mentorTagCloud(40),
      vettedCount: bf.searchMentors({ vetted: true, limit: 1 }).total,
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
function deskStateFor(ctx, mentor) {
  if (!desk.gateEnabled()) {
    return { directLink: desk.schedulerFor(mentor.id) };
  }
  const open = desk.openRequest(mentor.id, ctx.user.id);
  if (open?.state === 'accepted') {
    const grant = desk.liveGrantFor(open.id);
    if (grant) return { grant, request: open };
  }
  if (open?.state === 'sent') return { pending: open };

  const verdict = desk.canRequest({ mentor, memberId: ctx.user.id });
  const capacity = verdict.capacity || desk.capacityFor(mentor);
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

function mentorHandler(ctx, { slug }) {
  const mentor = bf.getMentor(slug);
  if (!mentor) return notFound(ctx);
  if (!VISIBLE_MENTOR_STATES.has(mentor.state) && !ctx.user.is_admin) return notFound(ctx);
  render(
    ctx,
    views.mentorPage(ctx, {
      mentor,
      slots: bf.mentorSlots(mentor.id),
      member: mentor.user_id ? bf.getMember(mentor.user_id) : null,
      desk: deskStateFor(ctx, mentor),
    }),
    { title: mentor.name },
  );
}

/* ------------------------------------------------------------ calendar */

function calendarHandler(ctx) {
  const now = new Date();
  const year = clampInt(ctx.query.get('y'), 2000, 2100, now.getUTCFullYear());
  const month = clampInt(ctx.query.get('m'), 0, 11, now.getUTCMonth());
  const start = Math.floor(Date.UTC(year, month, 1) / 1000);
  const end = Math.floor(Date.UTC(year, month + 1, 1) / 1000);
  const sync = bf.lastSync('luma');
  render(
    ctx,
    views.calendarPage(ctx, {
      year, month,
      events: bf.eventsBetween(start, end),
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
function icsHandler(ctx) {
  const events = bf.listEvents({ upcoming: true, limit: 200 });
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

function trackHandler(ctx, { slug }) {
  const track = bf.getTrack(slug);
  if (!track) return notFound(ctx);
  const { modules } = bf.listModules({ track: slug, userId: ctx.user.id });
  const stat = bf.progressSummary(ctx.user.id).byTrack.find((row) => row.track === slug)
    || { total: modules.length, done: 0 };
  render(ctx, views.trackPage(ctx, { track, modules, stat }), { title: track.title });
}

function moduleHandler(ctx, { slug }) {
  const module = bf.getModule(slug);
  if (!module) return notFound(ctx);
  const track = bf.getTrack(module.track);
  const { modules } = bf.listModules({ track: module.track, userId: ctx.user.id });
  bf.bumpModuleReads(module.id);
  render(
    ctx,
    views.modulePage(ctx, {
      module, track,
      progress: bf.getProgress(ctx.user.id, module.id),
      neighbours: modules,
    }),
    { title: module.title },
  );
}

async function progressSubmit(ctx, { slug }) {
  const { fields } = await readBody(ctx.req);
  if (!csrfOk(ctx, fields)) return;
  const module = bf.getModule(slug);
  if (!module) return notFound(ctx);
  const state = ['started', 'done', 'none'].includes(fields.state) ? fields.state : 'started';
  bf.setProgress({
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

async function accessAdminHandler(ctx, lookup = null) {
  if (!stewardsOnly(ctx)) return;
  render(
    ctx,
    views.accessAdminPage(ctx, {
      counts: bf.rosterCounts(),
      mode: roster.accessMode(),
      // Actually probe it. A steward opening this page is usually here because
      // somebody cannot get in, and "is the door wired up" is the first thing
      // they need — a banner that assumes it is fine would be worse than none.
      health: await roster.health(),
      pending: bf.pendingRoster(),
      recent: bf.recentRoster({ limit: 40 }),
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
  render(
    ctx,
    views.publishPage(ctx, {
      submissions: bf.newsSubmissions(ctx.user.id),
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
  const fail = (message) => render(
    ctx,
    views.publishPage(ctx, {
      submissions: bf.newsSubmissions(ctx.user.id), supabase: { configured: supabase.configured(), reachable: true },
      error: message, values,
    }),
    { title: 'Publish to news', status: 400 },
  );

  if (!values.title) return fail('It needs a headline.');
  if (!values.url && !values.body) return fail('Give it a link or some context — ideally both.');

  const id = bf.recordNewsSubmission({ userId: ctx.user.id, ...values });
  const result = await supabase.submitToNews({ handle: ctx.user.id, ...values });

  if (!result.ok) {
    bf.updateNewsSubmission(id, { status: 'failed', error: result.error });
    return fail(result.unconfigured
      ? 'Publishing is not configured yet — your submission was saved here and can be sent once it is.'
      : `Could not reach the feed: ${result.error}`);
  }

  const remoteId = Array.isArray(result.data) ? result.data[0]?.id : result.data?.id;
  bf.updateNewsSubmission(id, { status: 'queued', remoteId: remoteId ? String(remoteId) : null });
  render(
    ctx,
    views.publishPage(ctx, {
      submissions: bf.newsSubmissions(ctx.user.id),
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

function mentorRequestForm(ctx, { slug }, error = null, values = {}) {
  const mentor = bf.getMentor(slug);
  if (!mentor) return notFound(ctx);
  const verdict = desk.canRequest({ mentor, memberId: ctx.user.id });
  if (!verdict.ok && !error) {
    // Never render a form that cannot be submitted. Send them back to the
    // profile, which already explains the reason in context.
    return seeOther(ctx, `/homeroom/mentor/${mentor.slug}`);
  }
  render(ctx, views.requestFormPage(ctx, {
    mentor,
    capacity: verdict.capacity || desk.capacityFor(mentor),
    error,
    values,
  }), { title: `Ask ${mentor.name}`, subnav: views.subnav(views.MENTOR_TABS, 'mentors') });
}

async function mentorRequestCreate(ctx, fields, params) {
  const mentor = bf.getMentor(params.slug);
  if (!mentor) return notFound(ctx);

  const values = {
    track: trimmed(fields.track, 40),
    need: trimmed(fields.need, 2000),
    why_them: trimmed(fields.why_them, 1000),
    tried: trimmed(fields.tried, 1000),
    asking_for: trimmed(fields.asking_for, 80),
  };

  const verdict = desk.canRequest({ mentor, memberId: ctx.user.id });
  if (!verdict.ok) return mentorRequestForm(ctx, params, verdict.message, values);
  if (values.need.length < 40) {
    return mentorRequestForm(ctx, params,
      'Say more about what you need — 40 characters is not enough for them to answer.', values);
  }
  if (values.why_them.length < 20) {
    return mentorRequestForm(ctx, params,
      'Say why this person. It is the difference between a request and a mail merge.', values);
  }

  const created = desk.createRequest({
    mentor,
    memberId: ctx.user.id,
    track: values.track,
    need: values.need,
    whyThem: values.why_them,
    tried: values.tried,
    askingFor: values.asking_for,
  });

  desk.logEvent({
    mentorId: mentor.id, requestId: created.id, actorId: ctx.user.id, actorKind: 'member',
    event: 'requested', detail: created.auto ? 'auto-accepted per consent mode' : '',
  });

  const member = bf.getMember(ctx.user.id);
  const to = desk.contactFor(mentor.id);
  const message = mentormail.requestMessage({
    mentor, to, member, request: values, token: created.token,
    capacity: desk.capacityFor(mentor),
  });
  await mentormail.deliver(created.auto
    // The mentor said "do not ask me". Tell them it happened; do not ask.
    ? { ...message, subject: `${member?.name || ctx.user.id} booked time with you` }
    : message);

  seeOther(ctx, '/homeroom/mentors/requests');
}

/** The grant redirect. The only path from a member to a scheduler URL. */
function mentorBook(ctx, { slug, grant }) {
  const mentor = bf.getMentor(slug);
  const result = desk.redeemGrant({
    grantId: grant, memberId: ctx.user.id, mentorId: mentor?.id,
  });
  if (!result.ok) {
    return render(ctx, views.grantGonePage(ctx, { mentor, reason: result.reason }),
      { title: 'Link no longer works', status: 410 });
  }
  desk.logEvent({
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

function mentorTokenPage(ctx, { token }) {
  const request = desk.findByToken(token);
  if (!request) {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  }
  if (request.state !== 'sent') {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'already' }), { status: 410 });
  }
  const mentor = bf.getMentor(request.mentor_id);
  const member = bf.getMember(request.member_id) || { user_id: request.member_id };
  sendHtml(ctx.res, views.mentorRequestPage({
    mentor, request, member, capacity: desk.capacityFor(mentor), token,
  }));
}

async function mentorTokenAnswer(ctx, { token }, decision) {
  const { fields } = await readBody(ctx.req);
  const result = desk.answerRequest({
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
  desk.logEvent({
    mentorId: mentor.id, requestId: request.id, actorKind: 'mentor',
    event: result.decision, detail: result.late ? 'answered after the window closed' : '',
  });

  if (result.decision === 'accept') {
    bf.notify({
      userId: request.member_id, kind: 'intro',
      text: `${mentor.name} said yes — your booking link is ready`,
      href: '/homeroom/mentors/requests',
    });
  } else {
    // Deliberately NOT revoking outstanding grants on a pause. A mentor who is
    // buried is saying "stop sending me requests", not "take back the yes I
    // already gave someone else" — and the member holding that grant did
    // nothing wrong. Pausing stops new requests; it does not cancel a yes.
    bf.notify({
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

function mentorStanding(ctx, { token }) {
  const row = mentorlife.findToken(token);
  if (!row) return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  const mentor = bf.getMentor(row.mentor_id);
  if (!mentor) return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: 'unknown' }), { status: 404 });
  sendHtml(ctx.res, views.mentorStandingPage({ mentor, token, state: mentor.state }));
}

async function mentorStandingAction(ctx, { token }, action) {
  await readBody(ctx.req);
  const result = action === 'confirm' ? mentorlife.confirm(token)
    : action === 'pause' ? mentorlife.pause(token, { days: 90 })
    : mentorlife.withdraw(token);

  if (!result.ok) {
    return sendHtml(ctx.res, views.mentorTokenGonePage({ reason: result.reason }), { status: 404 });
  }
  sendHtml(ctx.res, views.mentorStandingDonePage({ action, days: result.days || 0 }));
}

/* --------------------------------------------------- mentor desk: steward */

function mentorAdminHandler(ctx, { error = null, flash = null } = {}) {
  if (!stewardsOnly(ctx)) return;
  const status = mentorsync.status();
  render(ctx, views.mentorAdminPage(ctx, {
    pending: mentorsync.pendingSubmissions(),
    status,
    stuck: mentorsync.stuckRequests(),
    roster: status.byState,
    metrics: mentorlife.metrics(),
    error,
    flash,
  }), { title: 'Mentor desk' });
}

async function mentorSyncNow(ctx) {
  if (!stewardsOnly(ctx)) return;
  const result = await mentorsync.sync();
  // Fail closed and say so. The roster is untouched either way, which is the
  // property worth being loud about: a failed sync is not a smaller roster.
  mentorAdminHandler(ctx, result.ok
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
  ['GET', '/homeroom/yearbook/edit', (ctx) => render(ctx, views.yearbookFormPage(ctx, {
    entry: bf.getYearbook(ctx.user.id), member: bf.ensureMember(ctx.user.id),
  }), { title: 'Your yearbook entry', subnav: views.subnav(views.YEARBOOK_TABS, 'mine') })],
  ['POST', '/homeroom/yearbook/edit', yearbookSubmit],
  ['GET', '/homeroom/yearbook', yearbookHandler],
  ['POST', '/homeroom/yearbook/:handle/sign', action((ctx, fields, p) => {
    const target = bf.getMember(p.handle);
    if (!target) return notFound(ctx);
    const result = bf.signYearbook({
      userId: target.user_id, authorId: ctx.user.id, body: trimmed(fields.body, 600),
    });
    if (!result.ok) return oops(ctx, result.error);
    bf.notify({
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
  ['GET', '/homeroom/settings', (ctx) => render(ctx, views.settingsPage(ctx, {
    member: bf.ensureMember(ctx.user.id),
    saved: ctx.query.get('saved') === '1',
    passwordSaved: ctx.query.get('password') === '1',
    authMode: sbAuth.configured() ? 'supabase' : 'local',
  }), { title: 'Your profile' })],
  ['POST', '/homeroom/settings', settingsSubmit],
  ['POST', '/homeroom/password', passwordSubmit],

  ['GET', '/homeroom/labs/new', (ctx) => render(ctx, views.labFormAtlasPage(ctx, {}),
    { title: 'Add a lab', subnav: views.subnav(views.LAB_TABS, 'atlas') })],
  ['POST', '/homeroom/labs/new', atlasLabCreate],
  ['GET', '/homeroom/labs/cores', (ctx) => render(ctx, views.coresPage(ctx),
    { title: 'Core Facility Finder', subnav: views.subnav(views.LAB_TABS, 'cores'), wide: true })],
  ['GET', '/homeroom/labs/member', labsHandler],
  ['GET', '/homeroom/labs/member/new', (ctx) => render(ctx, views.labFormPage(ctx, {}),
    { title: 'Add your lab' })],
  ['POST', '/homeroom/labs/member/new', labCreate],
  ['POST', '/homeroom/labs/at/:slug/report', action((ctx, fields, p) => {
    const lab = bf.getLab(p.slug);
    if (!lab) return notFound(ctx);
    const result = bf.reportLab({
      labId: lab.id, userId: ctx.user.id,
      status: String(fields.status || ''), body: trimmed(fields.body, 2000),
    });
    if (!result.ok) return oops(ctx, result.error);
    seeOther(ctx, `/homeroom/labs/at/${lab.slug}`);
  })],
  ['GET', '/homeroom/labs/at/:slug', atlasLabHandler],
  ['GET', '/homeroom/labs', atlasHandler],
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

  ['GET', '/homeroom/perks/new', (ctx) => render(ctx, views.dealFormPage(ctx, {}), { title: 'Add a perk' })],
  ['POST', '/homeroom/perks/new', dealCreate],
  ['GET', '/homeroom/perks', perksHandler],
  ['POST', '/homeroom/perk/:slug/claim', action((ctx, fields, p) => {
    const perk = bf.getDeal(p.slug);
    if (!perk) return notFound(ctx);
    bf.claimDeal(perk.id, ctx.user.id);
    seeOther(ctx, `/homeroom/perk/${perk.slug}`);
  })],
  ['POST', '/homeroom/perk/:slug/code', action((ctx, fields, p) => {
    if (!ctx.user.is_admin) return oops(ctx, 'Stewards only.', 403);
    const perk = bf.getDeal(p.slug);
    if (!perk) return notFound(ctx);
    bf.setDealCode(perk.id, trimmed(fields.code, 120));
    seeOther(ctx, `/homeroom/perk/${perk.slug}`);
  })],
  ['GET', '/homeroom/perk/:slug', perkHandler],

  /* Deals became Perks. Old links, and anything bookmarked, still land. */
  ['GET', '/homeroom/deals', (ctx) => seeOther(ctx, `/homeroom/perks${ctx.url.search || ''}`)],
  ['GET', '/homeroom/deals/new', (ctx) => seeOther(ctx, '/homeroom/perks/new')],
  ['GET', '/homeroom/deal/:slug', (ctx, p) => seeOther(ctx, `/homeroom/perk/${encodeURIComponent(p.slug)}`)],

  ['GET', '/homeroom/funders/new', (ctx) => render(ctx, views.funderFormPage(ctx, {}), { title: 'Add a funder' })],
  ['POST', '/homeroom/funders/new', funderCreate],
  ['GET', '/homeroom/funders', fundersHandler],
  ['GET', '/homeroom/pipeline', (ctx) => render(ctx, views.pipelinePage(ctx, { rows: bf.pipeline(ctx.user.id) }),
    { title: 'Pipeline' })],
  ['POST', '/homeroom/funder/:slug/review', reviewSubmit],
  ['POST', '/homeroom/review/:id/helpful', action((ctx, fields, p) => {
    const review = bf.getReview(Number(p.id));
    if (!review) return notFound(ctx);
    if (review.user_id === ctx.user.id) return oops(ctx, 'You cannot vouch for your own review.', 403);
    bf.toggleReviewHelpful(review.id, ctx.user.id);
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/review/:id/comment', action((ctx, fields, p) => {
    const review = bf.getReview(Number(p.id));
    if (!review) return notFound(ctx);
    if (limited(ctx, 'comment', LIMITS.comment)) return;
    const result = bf.addReviewComment({
      reviewId: review.id, authorId: ctx.user.id,
      body: trimmed(fields.body, 4000), anonymous: checkbox(fields.anonymous),
    });
    if (!result.ok) return oops(ctx, result.error);
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/review/comment/:id/delete', action((ctx, fields, p) => {
    if (!bf.deleteReviewComment(Number(p.id), ctx.user.id, { isAdmin: !!ctx.user.is_admin })) {
      return oops(ctx, 'Not yours to delete.', 403);
    }
    seeOther(ctx, safeGoto(fields.goto, '/homeroom/funders'));
  })],
  ['POST', '/homeroom/funder/:slug/track', trackSubmit],
  ['POST', '/homeroom/funder/:slug/untrack', action((ctx, fields, p) => {
    const funder = bf.getFunder(p.slug);
    if (!funder) return notFound(ctx);
    bf.removePipeline(ctx.user.id, funder.id);
    seeOther(ctx, `/homeroom/funder/${funder.slug}`);
  })],
  ['GET', '/homeroom/funder/:slug', funderHandler],

  ['GET', '/homeroom/mentors', mentorsHandler],
  ['GET', '/homeroom/mentors/requests', (ctx) => render(ctx, views.myRequestsPage(ctx, {
    requests: desk.requestsFor(ctx.user.id).map((r) => ({ ...r, outcome: desk.outcomeFor(r.id) })),
  }), { title: 'Your mentor requests', subnav: views.subnav(views.MENTOR_TABS, 'requests') })],
  ['GET', '/homeroom/mentor/:slug/request', (ctx, p) => mentorRequestForm(ctx, p)],
  ['POST', '/homeroom/mentor/:slug/request', action(mentorRequestCreate)],
  ['GET', '/homeroom/mentor/:slug/book/:grant', mentorBook],
  ['POST', '/homeroom/mentor/request/:id/withdraw', action((ctx, fields, p) => {
    desk.withdrawRequest(p.id, ctx.user.id);
    seeOther(ctx, '/homeroom/mentors/requests');
  })],
  ['POST', '/homeroom/mentor/request/:id/outcome', action((ctx, fields, p) => {
    const request = desk.getRequest(p.id);
    if (!request || request.member_id !== ctx.user.id) return notFound(ctx);
    desk.logOutcome({
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
  ['POST', '/homeroom/me/:token/confirm', (ctx, p) => mentorStandingAction(ctx, p, 'confirm')],
  ['POST', '/homeroom/me/:token/pause', (ctx, p) => mentorStandingAction(ctx, p, 'pause')],
  ['POST', '/homeroom/me/:token/withdraw', (ctx, p) => mentorStandingAction(ctx, p, 'withdraw')],
  ['POST', '/homeroom/m/:token/accept', (ctx, p) => mentorTokenAnswer(ctx, p, 'accept')],
  ['POST', '/homeroom/m/:token/decline', (ctx, p) => mentorTokenAnswer(ctx, p, 'decline')],
  ['POST', '/homeroom/m/:token/later', (ctx, p) => mentorTokenAnswer(ctx, p, 'later')],

  ['GET', '/homeroom/mentor/:slug', mentorHandler],

  ['GET', '/homeroom/hours/new', (ctx) => render(ctx, views.slotFormPage(ctx, { defaultStart: defaultStart() }),
    { title: 'Offer office hours', subnav: views.subnav(views.MENTOR_TABS, 'hours') })],
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
  ['GET', '/homeroom/events/list', eventsHandler],
  ['POST', '/homeroom/events/sync', lumaSyncHandler],
  ['GET', '/homeroom/events.ics', icsHandler],
  ['GET', '/homeroom/events', calendarHandler],
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
  ['GET', '/homeroom/library/notes', (ctx) => render(ctx, views.deliverablesPage(ctx, {
    rows: bf.deliverables(ctx.user.id), progress: bf.progressSummary(ctx.user.id),
  }), { title: 'Your deliverables' })],
  ['GET', '/homeroom/library/track/:slug', trackHandler],
  ['GET', '/homeroom/library/module/:slug', moduleHandler],
  ['POST', '/homeroom/library/module/:slug/progress', progressSubmit],
  ['GET', '/homeroom/library/entry/:slug', libraryEntryHandler],
  ['GET', '/homeroom/library', libraryHandler],
  /* Member-written entries used to live at /library/:slug. Keep those links. */
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
  ['GET', '/homeroom/search', (ctx) => {
    const query = (ctx.query.get('q') || '').trim().slice(0, 120);
    const results = bf.globalSearch(query);
    render(ctx, views.searchPage(ctx, { query, results }),
      { title: query ? `Search: ${query}` : 'Search' });
  }],
  ['GET', '/homeroom/stewards/mentors', (ctx) => mentorAdminHandler(ctx)],
  ['POST', '/homeroom/stewards/mentors/sync', action(mentorSyncNow)],
  ['POST', '/homeroom/stewards/mentors/:id/rule', action((ctx, fields, p) => {
    if (!stewardsOnly(ctx)) return;
    const decision = fields.decision === 'list' ? 'list' : 'reject';
    const note = trimmed(fields.note, 300);
    // A rejection without a reason is a decision the next steward cannot read.
    if (decision === 'reject' && !note) {
      return mentorAdminHandler(ctx, { error: 'Say why, so the next steward is not guessing.' });
    }
    const ruled = mentorsync.rule({ mentorId: p.id, decision, actorId: ctx.user.id, note });
    if (!ruled) return notFound(ctx);
    seeOther(ctx, '/homeroom/stewards/mentors');
  })],
  ['GET', '/homeroom/stewards/access', (ctx) => accessAdminHandler(ctx)],
  ['POST', '/homeroom/stewards/access/lookup', accessLookupHandler],
  ['POST', '/homeroom/stewards/access/:hash/decide', action((ctx, fields, p) => {
    if (!stewardsOnly(ctx)) return;
    const decision = fields.decision === 'allow' ? 'allow' : 'deny';
    const row = bf.rosterRow(p.hash);
    if (!row) return notFound(ctx);
    bf.decideRoster({ hash: p.hash, userId: ctx.user.id, decision, note: trimmed(fields.note, 500) });
    seeOther(ctx, '/homeroom/stewards/access');
  })],

  ['GET', '/homeroom/publish', publishHandler],
  ['POST', '/homeroom/publish', publishSubmit],

  ['GET', '/homeroom/about', (ctx) => render(ctx, views.aboutPage(ctx, { stats: bf.networkStats() }), { title: 'About' })],

  ['GET', '/homeroom/api/mentors', (ctx) => {
    const { mentors, total } = bf.searchMentors({
      q: ctx.query.get('q') || '', track: ctx.query.get('track') || '',
      tag: ctx.query.get('tag') || '', vetted: ctx.query.get('vetted') === '1',
      limit: clampInt(ctx.query.get('limit'), 1, 200, 60),
    });
    sendJson(ctx.res, { ok: true, total, mentors });
  }],
  ['GET', '/homeroom/api/atlas', (ctx) => sendJson(ctx.res, {
    ok: true,
    ...bf.searchLabs({
      q: ctx.query.get('q') || '', region: ctx.query.get('region') || '',
      status: ctx.query.get('status') || '', limit: clampInt(ctx.query.get('limit'), 1, 500, 200),
    }),
  })],
  ['GET', '/homeroom/api/perks', (ctx) => sendJson(ctx.res, {
    ok: true, ...bf.listDeals({ category: ctx.query.get('category') || '', limit: 300 }),
  })],
  ['GET', '/homeroom/api/library', (ctx) => sendJson(ctx.res, {
    ok: true, tracks: bf.tracks(),
    ...bf.listModules({ track: ctx.query.get('track') || '', q: ctx.query.get('q') || '', userId: ctx.user.id }),
  })],
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
      bf.ensureMember(ctx.user.id);
    } else if (route.isPublic) {
      if (ctx.user) bf.ensureMember(ctx.user.id);
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
