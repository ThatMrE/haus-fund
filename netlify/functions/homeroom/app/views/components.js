/* Shared Homeroom fragments. Same tagged-template approach as the news views. */

import { html, raw, timeAgo, formatText, nowSeconds } from '../util.js';
import {
  ORG_KINDS, ORG_STAGES, FUNDER_KINDS, DEAL_CATEGORIES,
  JOB_DISCIPLINES, EVENT_KINDS, LIBRARY_KINDS, PIPELINE_STATUSES, labelFor,
} from '../models.js';

export const LISTS = {
  orgKind: ORG_KINDS, stage: ORG_STAGES,
  funderKind: FUNDER_KINDS, dealCategory: DEAL_CATEGORIES, discipline: JOB_DISCIPLINES,
  eventKind: EVENT_KINDS, libraryKind: LIBRARY_KINDS, pipelineStatus: PIPELINE_STATUSES,
};

/* ------------------------------------------------------------------- time */

/** Past or future, in the same voice: "3 hours ago" / "in 3 hours". */
export function relTime(seconds, now = nowSeconds()) {
  if (seconds >= now) {
    const delta = seconds - now;
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [label, size] of units) {
      if (delta >= size) {
        const n = Math.floor(delta / size);
        return `in ${n} ${label}${n === 1 ? '' : 's'}`;
      }
    }
    return 'starting now';
  }
  return timeAgo(seconds, now);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** UTC everywhere: a distributed lab network has no single local time. */
export function stamp(seconds) {
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function when(seconds) {
  return html`<time datetime="${new Date(seconds * 1000).toISOString()}"
    title="${stamp(seconds)}">${relTime(seconds)}</time>`;
}

/** `datetime-local` wants a naive UTC string; we round-trip it as UTC. */
export function toLocalInput(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 16);
}

export function parseWhen(value) {
  if (!value) return null;
  const ms = Date.parse(`${value}${/[Zz]|[+-]\d\d:?\d\d$/.test(value) ? '' : 'Z'}`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/* ---------------------------------------------------------------- people */

const AVATAR_HUES = ['#b4ff00', '#5fd7ff', '#ff6fa8', '#ffd600', '#9d7bff', '#54e6a0'];

function hue(handle) {
  let sum = 0;
  for (const char of String(handle)) sum = (sum * 31 + char.charCodeAt(0)) % 997;
  return AVATAR_HUES[sum % AVATAR_HUES.length];
}

export function avatar(handle, { size = 32 } = {}) {
  const initials = String(handle || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??';
  return html`<span class="avatar" style="--a:${hue(handle)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px"
    aria-hidden="true">${initials}</span>`;
}

export function memberLink(handle, { anonymous = false, label = null } = {}) {
  if (anonymous) return html`<span class="anon">anonymous member</span>`;
  return html`<a class="who" href="/homeroom/p/${encodeURIComponent(handle)}">${label || handle}</a>`;
}

/** Directory card: the unit the whole people surface is built from. */
export function memberCard(member) {
  const tags = (member.expertise || []).slice(0, 5);
  return html`<li class="card member">
    <a class="cardlink" href="/homeroom/p/${encodeURIComponent(member.user_id)}">
      ${avatar(member.user_id, { size: 42 })}
      <div class="grow">
        <div class="name">${member.name || member.user_id}
          <span class="handle">@${member.user_id}</span>
          ${member.cohort ? html`<span class="pill cohort">${member.cohort}</span>` : ''}
        </div>
        <div class="headline">${member.headline || 'No headline yet.'}</div>
        <div class="meta mono">
          ${member.org ? html`${member.org} <span class="sep">/</span> ` : ''}
          ${member.location || 'location unlisted'}
          <span class="sep">/</span> ${member.karma} karma
        </div>
      </div>
    </a>
    ${tags.length ? html`<div class="tagrow">${tags.map((t) => html`<a class="tag" href="/homeroom/people?tag=${t}">${t}</a>`)}</div>` : ''}
    <div class="openrow mono">
      ${member.open_intros ? html`<span class="open">intros</span>` : ''}
      ${member.open_hours ? html`<span class="open">office hours</span>` : ''}
      ${member.open_collab ? html`<span class="open">collab</span>` : ''}
      ${member.open_hiring ? html`<span class="open">hiring</span>` : ''}
    </div>
  </li>`;
}

/* ----------------------------------------------------------------- forum */




/* ------------------------------------------------------------------- bits */

export function stars(rating, { count = null } = {}) {
  if (rating === null || rating === undefined) {
    return html`<span class="stars none mono">no reviews</span>`;
  }
  const full = Math.round(rating);
  return html`<span class="stars" title="${rating} out of 5">
    <span class="glyphs">${raw('&#9733;'.repeat(full))}${raw('&#9734;'.repeat(Math.max(0, 5 - full)))}</span>
    <b>${rating}</b>${count === null ? '' : html` <span class="mono">(${count})</span>`}</span>`;
}

export function pill(text, cls = '') {
  return html`<span class="pill ${cls}">${text}</span>`;
}

export function body(text) {
  return html`<div class="prose">${formatText(text)}</div>`;
}

/** Truncate before escaping, so a cut never lands in the middle of an entity. */
export function snippet(text, max = 240) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function empty(message) {
  return html`<div class="empty mono">${message}</div>`;
}

export function pager({ page, total, perPage, basePath }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return '';
  const join = basePath.includes('?') ? '&' : '?';
  return html`<div class="more mono">
    ${page > 1 ? html`<a href="${raw(basePath)}${raw(join)}p=${page - 1}">&larr; previous</a>` : ''}
    <span>page ${page} of ${pages}</span>
    ${page < pages ? html`<a href="${raw(basePath)}${raw(join)}p=${page + 1}">next &rarr;</a>` : ''}
  </div>`;
}

export function filterBar(options, { active = '', basePath, param = 'category', allLabel = 'all' }) {
  const join = basePath.includes('?') ? '&' : '?';
  return html`<div class="topics">
    <a class="${active ? '' : 'on'}" href="${raw(basePath)}">${allLabel}</a>
    ${options.map((option) => html`<a class="${active === option.slug ? 'on' : ''}"
      href="${raw(basePath)}${raw(join)}${raw(param)}=${option.slug}">${option.label}${
      option.count === undefined ? '' : html` <span class="n">${option.count}</span>`}</a>`)}
  </div>`;
}

export function csrfField(ctx) {
  return html`<input type="hidden" name="csrf" value="${ctx.csrf}" />`;
}

export function select(name, options, current, { blank = null, id = null } = {}) {
  return html`<select name="${name}" id="${id || name}">
    ${blank ? html`<option value="">${blank}</option>` : ''}
    ${options.map((option) => html`<option value="${option.slug}" ${raw(option.slug === current ? 'selected' : '')}>${option.label}</option>`)}
  </select>`;
}

export function section(title, contents, { href = null, action = null } = {}) {
  return html`<section class="panel">
    <h2 class="mono">${href ? html`<a href="${raw(href)}">${title}</a>` : title}${action || ''}</h2>
    ${contents}
  </section>`;
}
