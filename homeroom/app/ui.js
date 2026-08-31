// Shared rendering for Homeroom: chrome, escaping, formatting, small parts.
//
// No framework and no build step, to match the rest of this repo. Templates
// are tagged strings that escape every interpolation by default; anything
// already-safe has to be passed through raw().

import { currentMember, signOut, supabase } from './client.js';

/* ── escaping ───────────────────────────────────────────────────────── */

const RAW = Symbol('raw');

export function raw(value) {
  return { [RAW]: String(value ?? '') };
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return esc(value);
}

/** Tagged template that escapes interpolations. Use raw() to opt out. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return raw(out);
}

export function setHTML(target, content) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node) node.innerHTML = render(content);
  return node;
}

/** Plain text with paragraph breaks and bare links made clickable. */
export function prose(text) {
  const paragraphs = String(text ?? '').split(/\n{2,}/).filter(Boolean);
  if (!paragraphs.length) return raw('');
  return raw(paragraphs.map((p) => {
    const body = esc(p).replace(/\n/g, '<br>').replace(
      /(https?:\/\/[^\s<]+)/g,
      (url) => `<a href="${url}" rel="nofollow noopener ugc" target="_blank">${url.replace(/^https?:\/\//, '')}</a>`,
    );
    return `<p>${body}</p>`;
  }).join(''));
}

export function snippet(text, max = 240) {
  const value = String(text ?? '').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/* ── time ───────────────────────────────────────────────────────────── */

const UNITS = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];

/** Past or future in the same voice: "3 hours ago" / "in 3 hours". */
export function relTime(value) {
  const then = new Date(value).getTime() / 1000;
  const delta = then - Date.now() / 1000;
  const size = Math.abs(delta);
  if (size < 60) return delta >= 0 ? 'starting now' : 'just now';
  for (const [label, seconds] of UNITS) {
    if (size >= seconds) {
      const n = Math.floor(size / seconds);
      const plural = n === 1 ? '' : 's';
      return delta > 0 ? `in ${n} ${label}${plural}` : `${n} ${label}${plural} ago`;
    }
  }
  return 'just now';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** UTC everywhere. A network spread across time zones has no local time. */
export function stamp(value) {
  const d = new Date(value);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function when(value) {
  return html`<time datetime="${new Date(value).toISOString()}" title="${stamp(value)}">${relTime(value)}</time>`;
}

export function toLocalInput(date) {
  return new Date(date).toISOString().slice(0, 16);
}

/** A `datetime-local` value is naive; Homeroom reads every time as UTC. */
export function fromLocalInput(value) {
  if (!value) return null;
  const ms = Date.parse(/[Zz]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ── taxonomies, shared with the database's check constraints ───────── */

export const CATEGORIES = [
  ['wetlab', 'Wet lab'], ['dry', 'Dry lab'], ['hardware', 'Hardware'], ['biosafety', 'Biosafety'],
  ['regulatory', 'Regulatory'], ['funding', 'Funding'], ['legal', 'Legal and IP'], ['hiring', 'Hiring'],
  ['space', 'Space and ops'], ['intros', 'Intros'], ['life', 'Founder life'], ['general', 'General'],
];
export const POST_KINDS = [
  ['question', 'Question'], ['discussion', 'Discussion'], ['intro', 'Intro request'],
  ['show', 'Show'], ['announce', 'Announcement'], ['poll', 'Poll'], ['launch', 'Launch'],
];
export const ORG_KINDS = [
  ['startup', 'Startup'], ['communitylab', 'Community lab'], ['academic', 'Academic lab'],
  ['foundry', 'Biofoundry'], ['nonprofit', 'Nonprofit'], ['collective', 'Collective'], ['solo', 'Solo'],
];
export const ORG_STAGES = [
  ['idea', 'Idea'], ['bench', 'At the bench'], ['prototype', 'Prototype'], ['preclinical', 'Preclinical'],
  ['revenue', 'Revenue'], ['clinical', 'Clinical'], ['scaling', 'Scaling'],
];
export const FUNDER_KINDS = [
  ['vc', 'Venture fund'], ['angel', 'Angel'], ['grant', 'Grant programme'], ['foundation', 'Foundation'],
  ['prize', 'Prize'], ['accelerator', 'Accelerator'], ['dao', 'DAO or collective'],
];
export const PIPELINE_STATUSES = [
  ['researching', 'Researching'], ['intro', 'Intro requested'], ['pitched', 'Pitched'],
  ['diligence', 'Diligence'], ['committed', 'Committed'], ['passed', 'Passed'], ['closed', 'Closed'],
];
export const DEAL_CATEGORIES = [
  ['reagents', 'Reagents'], ['sequencing', 'Sequencing'], ['synthesis', 'DNA synthesis'],
  ['cloudlab', 'Cloud lab'], ['compute', 'Compute'], ['equipment', 'Equipment'],
  ['software', 'Software'], ['services', 'Legal and services'], ['other', 'Other'],
];
export const JOB_DISCIPLINES = [
  ['wetlab', 'Wet lab'], ['computational', 'Computational'], ['engineering', 'Software or hardware'],
  ['ops', 'Lab ops'], ['regulatory', 'Regulatory and QA'], ['bizdev', 'Business'], ['other', 'Other'],
];
export const EVENT_KINDS = [
  ['meetup', 'Meetup'], ['talk', 'Talk'], ['workshop', 'Workshop'],
  ['demoday', 'Demo day'], ['openlab', 'Open lab'], ['online', 'Online'],
];
export const LIBRARY_KINDS = [
  ['guide', 'Guide'], ['protocol', 'Protocol'], ['essay', 'Essay'], ['template', 'Template'],
];
export const EXPERTISE_SUGGESTIONS = [
  'crispr', 'cloning', 'protein-expression', 'cell-culture', 'microscopy', 'flow-cytometry', 'ngs',
  'nanopore', 'mass-spec', 'fermentation', 'bioreactors', 'microfluidics', 'protein-design',
  'ml-for-bio', 'structural-biology', 'metagenomics', 'biosafety', 'irb', 'fda', 'export-control',
  'patents', 'mta', 'grant-writing', 'sbir', 'fundraising', 'lab-buildout',
];

export function labelFor(list, slug, fallback = '') {
  return list.find(([value]) => value === slug)?.[1] ?? (fallback || slug || '');
}

export function options(list, current, blank = null) {
  return html`${blank ? html`<option value="">${blank}</option>` : ''}${list.map(
    ([value, label]) => html`<option value="${value}" ${raw(value === current ? 'selected' : '')}>${label}</option>`,
  )}`;
}

/* ── small parts ────────────────────────────────────────────────────── */

const AVATAR_TONES = ['', 'bronze', 'steel'];

export function avatar(handle, { size = '' } = {}) {
  const text = String(handle ?? '?');
  const initials = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??';
  let sum = 0;
  for (const char of text) sum = (sum * 31 + char.charCodeAt(0)) % 997;
  return html`<span class="avatar ${size} ${AVATAR_TONES[sum % AVATAR_TONES.length]}">${initials}</span>`;
}

export function memberLink(member, { anonymous = false } = {}) {
  if (anonymous || !member) return html`<span class="anon">anonymous member</span>`;
  const handle = typeof member === 'string' ? member : member.handle;
  const label = typeof member === 'string' ? member : (member.name || member.handle);
  return html`<a href="/homeroom/profile.html?handle=${encodeURIComponent(handle)}">${label}</a>`;
}

export function stars(rating, count = null) {
  if (rating === null || rating === undefined) return html`<span class="stars none">no reviews</span>`;
  const value = Number(rating);
  const full = Math.round(value);
  return html`<span class="stars" title="${value} out of 5">
    <span class="glyphs">${raw('&#9733;'.repeat(full))}${raw('&#9734;'.repeat(Math.max(0, 5 - full)))}</span>
    <b>${value}</b>${count === null ? '' : html`<span class="mono">(${count})</span>`}</span>`;
}

export function pill(text, tone = '') {
  return html`<span class="pill ${tone}">${text}</span>`;
}

export function empty(message) {
  return html`<div class="empty">${message}</div>`;
}

export function notice(message, tone = '') {
  return html`<div class="notice ${tone}">${message}</div>`;
}

/** Surface an error where the reader is looking, rather than in the console. */
export function flash(message, tone = 'bad') {
  let bar = document.querySelector('.js-flash');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = `notice ${tone} js-flash`;
    document.querySelector('main .wrap, main')?.prepend(bar);
  }
  bar.className = `notice ${tone} js-flash`;
  bar.textContent = message;
  bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => bar.remove(), 6000);
}

export function param(name, fallback = '') {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

/** Postgres speaks in constraint names; members should not have to. */
export function readableError(error) {
  const message = error?.message || String(error || 'Something went wrong.');
  if (/duplicate key/i.test(message)) return 'That already exists.';
  if (/violates row-level security/i.test(message)) return 'You do not have access to that.';
  if (/permission denied/i.test(message)) return 'You do not have access to that.';
  if (/JWT|token/i.test(message)) return 'Your session expired. Sign in again.';
  return message.replace(/^.*?:\s*/, '').trim() || 'Something went wrong.';
}

/* ── chrome ─────────────────────────────────────────────────────────── */

const TABS = [
  ['/homeroom/', 'Home'],
  ['/homeroom/forum.html', 'Forum'],
  ['/homeroom/people.html', 'People'],
  ['/homeroom/labs.html', 'Labs'],
  ['/homeroom/deals.html', 'Deals'],
  ['/homeroom/funders.html', 'Funders'],
  ['/homeroom/hours.html', 'Hours'],
  ['/homeroom/jobs.html', 'Jobs'],
  ['/homeroom/events.html', 'Events'],
  ['/homeroom/library.html', 'Library'],
];

/**
 * Render the masthead and footer around a page. Unread counts come from one
 * round trip so the badges do not cost three.
 */
export async function chrome(member, activePath = location.pathname) {
  let counts = { messages: 0, notifications: 0, intros: 0 };
  try {
    const { data } = await supabase.rpc('hr_unread_counts');
    if (data && data[0]) counts = data[0];
  } catch { /* badges are a nicety, never a blocker */ }

  const active = (href) =>
    href === '/homeroom/'
      ? activePath === '/homeroom/' || activePath === '/homeroom/index.html'
      : activePath.startsWith(href.replace('.html', ''));

  const alerts = Number(counts.notifications || 0) + Number(counts.intros || 0);

  setHTML(document.querySelector('header.bar') || prependHeader(), html`<div class="wrap">
    <a class="logo" href="/homeroom/">
      <img src="/assets/logo-mark.svg" alt="Haus">
      <span class="room">Homeroom</span>
    </a>
    <nav class="tabs">
      ${TABS.map(([href, label]) => html`<a href="${href}" class="${active(href) ? 'on' : ''}">${label}</a>`)}
    </nav>
    <div class="me">
      <a class="count" href="/homeroom/messages.html" title="Messages">Messages${
        Number(counts.messages) ? html`<b>${counts.messages}</b>` : ''}</a>
      <a class="count" href="/homeroom/notifications.html" title="Notifications">Alerts${
        alerts ? html`<b>${alerts}</b>` : ''}</a>
      <a href="/homeroom/profile.html?handle=${encodeURIComponent(member.handle)}">${member.handle}</a>
    </div>
  </div>`);

  setHTML(document.querySelector('footer.foot') || appendFooter(), html`<div class="wrap">
    <a href="/homeroom/search.html">Search</a>
    <a href="/homeroom/settings.html">Settings</a>
    <a href="/homeroom/saved.html">Saved</a>
    <a href="/homeroom/intros.html">Intros</a>
    <a href="/homeroom/about.html">About Homeroom</a>
    <a href="/">Haus</a>
    <button class="linkish js-signout" type="button">Sign out</button>
    <div class="line">Members only &mdash; what is said here stays here.</div>
  </div>`);

  document.querySelector('.js-signout')?.addEventListener('click', signOut);
}

function prependHeader() {
  const header = document.createElement('header');
  header.className = 'bar';
  document.body.prepend(header);
  return header;
}

function appendFooter() {
  const footer = document.createElement('footer');
  footer.className = 'foot';
  document.body.append(footer);
  return footer;
}

/** Wire up a members-only page: gate, chrome, then the page's own render. */
export async function page(render) {
  const { requireMember } = await import('./client.js');
  const member = await requireMember();
  await chrome(member);
  try {
    await render(member);
  } catch (error) {
    console.error(error);
    flash(readableError(error));
  }
}

export { currentMember };
