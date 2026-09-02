/*
 * The surfaces added in the community rebuild: chat, the yearbook, the biolab
 * atlas, perks, Rate My Funder, mentors, the events calendar, the training
 * library and publishing to the public feed.
 *
 * Same rules as pages.js — server-rendered strings, tagged templates that
 * escape every interpolation, no client framework. Re-exported from pages.js so
 * routes.js keeps its single `import * as views`.
 */

import { html, raw, plural } from '../util.js';
import {
  FUNDER_KINDS, DEAL_CATEGORIES, PERK_ACCESS, MENTOR_TRACKS, REVIEW_TAGS, REVIEW_OUTCOMES,
  LAB_STATUSES, LAB_KINDS, PIPELINE_STATUSES, labelFor, tagList,
} from '../models.js';
import {
  avatar, memberLink, stars, pill, body, empty, pager, filterBar, csrfField, select,
  section, when, stamp, relTime, snippet,
} from './components.js';

const PER_PAGE = 20;

/** The rating scale, shared by every axis on a funder review. */
export function ratingOptions() {
  const words = ['unusable', 'poor', 'fine', 'good', 'excellent'];
  return [5, 4, 3, 2, 1].map((n) => ({ slug: String(n), label: `${n} — ${words[n - 1]}` }));
}

/** A tab strip under the masthead, for sections that are more than one tool. */
export function subnav(items, active) {
  return raw(`<nav class="subnav">${items
    .map((item) => `<a href="${item.href}" class="${item.key === active ? 'on' : ''}">${item.label}</a>`)
    .join('')}</nav>`);
}

/* ==========================================================================
 * CHAT
 * ======================================================================== */


/** One message. Also rendered on its own by the poll endpoint, hence exported. */


/* ==========================================================================
 * YEARBOOK
 * ======================================================================== */

export const YEARBOOK_TABS = [
  { key: 'wall', href: '/homeroom/yearbook', label: 'The wall' },
  { key: 'directory', href: '/homeroom/people', label: 'Directory' },
  { key: 'mine', href: '/homeroom/yearbook/edit', label: 'Your entry' },
];

export function yearbookPage(ctx, { members, total, page, filters, cohorts, houseList, basePath, mine }) {
  return html`<div class="pagehead">
    <div>
      <h1>Yearbook</h1>
      <p class="lede">${plural(total, 'founder')} across every cohort — what they are building,
        what they were before, and the line they would want read out.</p>
    </div>
    <div class="heroactions">
      <a class="btn ${mine ? 'ghost' : 'solid'}" href="/homeroom/yearbook/edit">
        ${mine ? 'Edit your entry' : 'Add your entry'}</a>
    </div>
  </div>

  <form class="searchbar" method="get" action="/homeroom/yearbook">
    <input type="search" name="q" value="${filters.q}" placeholder="name, venture, what they build" />
    ${select('cohort', cohorts.map((c) => ({ slug: c.cohort, label: `${c.cohort} (${c.n})` })),
      filters.cohort, { blank: 'every cohort' })}
    ${houseList.length ? select('house', houseList.map((h) => ({ slug: h.house, label: h.house })),
      filters.house, { blank: 'every house' }) : ''}
    <button class="btn" type="submit">Filter</button>
  </form>

  ${members.length ? html`<ul class="wall">${members.map((m) => founderCard(m))}</ul>`
    : empty('Nobody matches that. Try a different cohort.')}
  ${pager({ page, total, perPage: 60, basePath })}`;
}

/**
 * A founder card.
 *
 * The photo is optional and the card must look deliberate without one, because
 * most people will never upload one — a wall that only works when everybody
 * fills in a photo is a wall of grey rectangles.
 */
function founderCard(member) {
  return html`<li class="wallcard ${member.featured ? 'featured' : ''}">
    <a class="cardlink" href="/homeroom/yearbook/${encodeURIComponent(member.user_id)}">
      <div class="portrait">
        ${member.photo_url
          ? html`<img src="${member.photo_url}" alt="" loading="lazy" />`
          : avatar(member.user_id, { size: 88 })}
      </div>
      <div class="grow">
        <div class="name">${member.name || member.user_id}</div>
        <div class="handle mono">@${member.user_id}${member.cohort ? html` · ${member.cohort}` : ''}${
          member.house ? html` · ${member.house}` : ''}</div>
        ${member.venture ? html`<div class="venture">${member.venture}</div>` : ''}
        <p class="oneliner">${member.one_liner || member.headline || 'No entry yet.'}</p>
        ${member.quote ? html`<blockquote class="pull">“${snippet(member.quote, 140)}”</blockquote>` : ''}
      </div>
    </a>
    <div class="tagrow">
      ${(member.expertise || []).slice(0, 4).map((t) => html`<a class="tag" href="/homeroom/yearbook?tag=${t}">${t}</a>`)}
      ${member.signatures ? html`<span class="tag ghost">${plural(member.signatures, 'signature')}</span>` : ''}
    </div>
  </li>`;
}

export function yearbookEntryPage(ctx, { member, entry, signs, mySign, canSign }) {
  return html`<div class="entryhead">
    <div class="portrait big">
      ${entry?.photo_url ? html`<img src="${entry.photo_url}" alt="" />` : avatar(member.user_id, { size: 140 })}
    </div>
    <div class="grow">
      <h1>${member.name || member.user_id}</h1>
      <div class="mono dim">@${member.user_id}
        ${entry?.cohort || member.cohort ? html` <span class="sep">/</span> ${entry?.cohort || member.cohort}` : ''}
        ${entry?.house ? html` <span class="sep">/</span> ${entry.house}` : ''}
        ${member.location ? html` <span class="sep">/</span> ${member.location}` : ''}</div>
      ${entry?.venture ? html`<p class="venture big">${entry.venture}${
        entry.site_url ? html` <a class="mono" href="${entry.site_url}" rel="nofollow noopener" target="_blank">site</a>` : ''}</p>` : ''}
      ${entry?.one_liner ? html`<p class="lede">${entry.one_liner}</p>` : ''}
      <div class="heroactions">
        <a class="btn ghost" href="/homeroom/p/${encodeURIComponent(member.user_id)}">Full profile</a>
        ${ctx.user?.id === member.user_id
          ? html`<a class="btn solid" href="/homeroom/yearbook/edit">Edit entry</a>`
          : html`<a class="btn solid" href="/homeroom/intros/new?to=${encodeURIComponent(member.user_id)}">Request an intro</a>`}
      </div>
    </div>
  </div>

  ${entry?.quote ? html`<blockquote class="bigquote">“${entry.quote}”</blockquote>` : ''}

  <div class="cols">
    <div class="main">
      ${entry?.building ? section('What they are building', body(entry.building)) : ''}
      ${entry?.before_haus ? section('Before Haus', body(entry.before_haus)) : ''}
      ${member.bio ? section('In their words', body(member.bio)) : ''}

      ${section(`Signatures (${signs.length})`, html`
        ${signs.length ? html`<ul class="signs">${signs.map((s) => html`<li class="sign">
          <div class="mono">${memberLink(s.author_id)} <span class="sep">/</span> ${when(s.created_at)}</div>
          ${body(s.body)}
        </li>`)}</ul>` : html`<p class="mono dim">Nobody has signed this yet.</p>`}
        ${canSign ? html`<form class="stack" method="post" action="/homeroom/yearbook/${encodeURIComponent(member.user_id)}/sign">
          ${csrfField(ctx)}
          <div class="field"><label for="sign">${mySign ? 'Update your signature' : 'Sign this yearbook'}</label>
            <textarea id="sign" name="body" rows="3" maxlength="600" required
              placeholder="The thing you would want them to remember about this cohort.">${mySign?.body || ''}</textarea></div>
          <button class="btn solid" type="submit">${mySign ? 'Update' : 'Sign'}</button>
        </form>` : ''}`)}
    </div>
    <aside class="rail">
      ${section('Ask them about', (member.expertise || []).length
        ? html`<div class="tagrow">${member.expertise.map((t) => html`<a class="tag" href="/homeroom/yearbook?tag=${t}">${t}</a>`)}</div>`
        : html`<p class="mono dim">Nothing listed.</p>`)}
      ${member.ask_me_about ? section('Happy to help with', body(member.ask_me_about)) : ''}
    </aside>
  </div>`;
}

export function yearbookFormPage(ctx, { entry, member, error = null }) {
  const value = (key) => entry?.[key] || '';
  return html`<h1>Your yearbook entry</h1>
  <p class="lede">The wall is the first thing a new cohort reads. Two good sentences beat a
    complete form.</p>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/yearbook/edit">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="cohort">Cohort</label>
        <input id="cohort" name="cohort" maxlength="20" value="${value('cohort') || member.cohort || ''}"
          placeholder="S26" /></div>
      <div class="field"><label for="house">House</label>
        <input id="house" name="house" maxlength="40" value="${value('house')}"
          placeholder="Punkhaus" /></div>
    </div>
    <div class="field"><label for="venture">Venture</label>
      <input id="venture" name="venture" maxlength="80" value="${value('venture')}"
        placeholder="Loam Foods" /></div>
    <div class="field"><label for="one_liner">One line</label>
      <input id="one_liner" name="one_liner" maxlength="160" value="${value('one_liner')}"
        placeholder="Single-cell protein that does not taste like a compromise." /></div>
    <div class="field"><label for="quote">Your quote</label>
      <textarea id="quote" name="quote" rows="2" maxlength="300"
        placeholder="The line you would want read out at the showcase.">${value('quote')}</textarea></div>
    <div class="field"><label for="building">What you are building</label>
      <textarea id="building" name="building" rows="5" maxlength="4000">${value('building')}</textarea></div>
    <div class="field"><label for="before_haus">Before Haus</label>
      <textarea id="before_haus" name="before_haus" rows="4" maxlength="2000"
        placeholder="The lab, the degree, the job, the thing that did not work.">${value('before_haus')}</textarea></div>
    <div class="row">
      <div class="field"><label for="photo_url">Photo URL</label>
        <input id="photo_url" name="photo_url" maxlength="500" value="${value('photo_url')}"
          placeholder="https://..." /></div>
      <div class="field"><label for="site_url">Venture site</label>
        <input id="site_url" name="site_url" maxlength="500" value="${value('site_url')}"
          placeholder="https://..." /></div>
    </div>
    <button class="btn solid" type="submit">Save entry</button>
  </form>`;
}

/* ==========================================================================
 * LABS: THE ATLAS AND THE CORE FINDER
 * ======================================================================== */

export const LAB_TABS = [
  { key: 'atlas', href: '/homeroom/labs', label: 'Biolab Atlas' },
  { key: 'cores', href: '/homeroom/labs/cores', label: 'Core Facility Finder' },
  { key: 'member', href: '/homeroom/labs/member', label: 'Member labs' },
];

export function atlasPage(ctx, { labs, total, filters, facets, basePath, page }) {
  const counts = Object.fromEntries(facets.statuses.map((s) => [s.slug, s.count]));
  return html`<div class="pagehead">
    <div>
      <h1>Global Biolab Atlas</h1>
      <p class="lede">Community biotech, DIYbio and open-science labs worldwide — with whether they
        are actually open. ${counts.active || 0} active of ${total} listed.</p>
    </div>
    <a class="btn ghost" href="/homeroom/labs/new">Add a lab</a>
  </div>

  <form class="searchbar wide" method="get" action="/homeroom/labs">
    <input type="search" name="q" value="${filters.q}" placeholder="lab, city, technique" />
    ${select('region', facets.regions.map((r) => ({ slug: r.slug, label: `${r.label} (${r.count})` })),
      filters.region, { blank: 'everywhere' })}
    ${select('status', LAB_STATUSES, filters.status, { blank: 'any status' })}
    ${select('kind', LAB_KINDS, filters.kind, { blank: 'any kind' })}
    <button class="btn" type="submit">Filter</button>
  </form>

  <p class="mono dim tiny">Sources: HTGAA nodes, the DIYbio.org lab list, DIYbiosphere and member
    reports. A member who has stood in the room outranks all of them — if you have been, say so on
    the lab’s page.</p>

  ${labs.length ? html`<ul class="cards grid atlas">${labs.map((lab) => html`<li class="card lab s-${lab.status}">
    <a class="cardlink" href="/homeroom/labs/at/${lab.slug}">
      <div class="grow">
        <div class="name">${lab.name} ${statusPill(lab.status)}</div>
        <div class="meta mono">${lab.city}${lab.country ? html` · ${lab.country}` : ''}
          <span class="sep">/</span> ${labelFor(LAB_KINDS, lab.kind, lab.kind)}
          ${lab.bsl ? html`<span class="sep">/</span> ${lab.bsl}` : ''}</div>
        <p class="summary">${snippet(lab.note, 180)}</p>
      </div>
    </a>
    <div class="tagrow">${lab.capabilities.slice(0, 4).map((c) => html`<a class="tag ghost"
      href="/homeroom/labs?capability=${encodeURIComponent(c)}">${c}</a>`)}</div>
  </li>`)}</ul>` : empty('No labs match. Widen the filters, or add the one you know about.')}
  ${pager({ page, total, perPage: 60, basePath })}`;
}

function statusPill(status) {
  const cls = { active: 'ok', limited: 'cohort', dormant: 'bad', unknown: '' }[status] || '';
  return pill(labelFor(LAB_STATUSES, status, status), cls);
}

export function atlasLabPage(ctx, { lab, reports }) {
  return html`<div class="profilehead">
    <div class="grow">
      <h1>${lab.name} ${statusPill(lab.status)}</h1>
      <div class="mono dim">${lab.city}${lab.country ? html` · ${lab.country}` : ''}
        <span class="sep">/</span> ${labelFor(LAB_KINDS, lab.kind, lab.kind)}
        ${lab.bsl ? html` <span class="sep">/</span> ${lab.bsl}` : ''}
        ${lab.website ? html` <span class="sep">/</span> <a href="${lab.website}" rel="nofollow noopener" target="_blank">site</a>` : ''}
        ${lab.source ? html` <span class="sep">/</span> listed by ${lab.source}` : ''}</div>
      ${lab.confirmed_at ? html`<div class="mono dim">last confirmed ${when(lab.confirmed_at)}
        by ${memberLink(lab.confirmed_by)}</div>` : html`<div class="mono dim">never confirmed by a member</div>`}
    </div>
  </div>
  ${lab.note ? body(lab.note) : ''}
  ${lab.capabilities.length ? html`<div class="tagrow">${lab.capabilities.map((c) => html`<span class="tag">${c}</span>`)}</div>` : ''}

  <div class="cols">
    <div class="main">
      ${section(`Member reports (${reports.length})`, reports.length
        ? html`<ul class="rail-list wide">${reports.map((r) => html`<li class="review">
            <div class="mono">${statusPill(r.status)} <span class="sep">/</span> ${memberLink(r.user_id)}
              <span class="sep">/</span> ${when(r.created_at)}</div>
            ${r.body ? body(r.body) : ''}
          </li>`)}</ul>`
        : html`<p class="mono dim">Nobody has reported on this one yet.</p>`)}
    </div>
    <aside class="rail">
      ${section('Been there?', html`
        <form class="stack" method="post" action="/homeroom/labs/at/${lab.slug}/report">
          ${csrfField(ctx)}
          <div class="field"><label for="status">What did you find</label>
            ${select('status', LAB_STATUSES, lab.status)}</div>
          <div class="field"><label for="rbody">Notes</label>
            <textarea id="rbody" name="body" rows="4" maxlength="2000"
              placeholder="Who to email, what the bench costs, what they actually have."></textarea></div>
          <button class="btn solid" type="submit">File a report</button>
          <p class="hint">This also updates the lab’s status. A first-hand account from last month
            beats any directory.</p>
        </form>`)}
    </aside>
  </div>`;
}

export function coresPage(ctx) {
  return html`<div class="pagehead">
    <div>
      <h1>Core Facility Finder</h1>
      <p class="lede">Research core facilities worldwide, searchable by technique, with the enquiry
        email drafted for you. Most cores take external customers at a fraction of a CRO quote.</p>
    </div>
    <a class="btn solid" href="/cores.html" target="_blank" rel="noopener">Open in a new tab</a>
  </div>
  <div class="toolframe">
    <iframe src="/cores.html" title="Core Facility Finder" loading="lazy"></iframe>
  </div>
  <p class="mono dim tiny">The finder is the same tool served at haus.fund/cores — embedded here so
    it sits next to the atlas, since the question "where can I run this" has both answers.</p>`;
}

export function labFormAtlasPage(ctx, { error = null, values = {} }) {
  return html`<h1>Add a lab to the atlas</h1>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/labs/new">
    ${csrfField(ctx)}
    <div class="field"><label for="name">Name</label>
      <input id="name" name="name" required maxlength="120" value="${values.name || ''}" /></div>
    <div class="row">
      <div class="field"><label for="city">City</label>
        <input id="city" name="city" maxlength="80" value="${values.city || ''}" /></div>
      <div class="field"><label for="country">Country</label>
        <input id="country" name="country" maxlength="80" value="${values.country || ''}" /></div>
      <div class="field"><label for="region">Region</label>
        ${select('region', ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America', 'Global']
          .map((r) => ({ slug: r, label: r })), values.region || '', { blank: '—' })}</div>
    </div>
    <div class="row">
      <div class="field"><label for="kind">Kind</label>${select('kind', LAB_KINDS, values.kind || 'community')}</div>
      <div class="field"><label for="status">Status</label>${select('status', LAB_STATUSES, values.status || 'unknown')}</div>
      <div class="field"><label for="bsl">Containment</label>
        <input id="bsl" name="bsl" maxlength="20" value="${values.bsl || ''}" placeholder="BSL-1" /></div>
    </div>
    <div class="field"><label for="website">Website</label>
      <input id="website" name="website" maxlength="300" value="${values.website || ''}" /></div>
    <div class="field"><label for="capabilities">Capabilities</label>
      <input id="capabilities" name="capabilities" maxlength="300" value="${values.capabilities || ''}"
        placeholder="molecular biology, tissue culture, classes" /></div>
    <div class="field"><label for="note">What a visitor should know</label>
      <textarea id="note" name="note" rows="4" maxlength="2000">${values.note || ''}</textarea></div>
    <button class="btn solid" type="submit">Add to the atlas</button>
  </form>`;
}

/* ==========================================================================
 * PERKS
 * ======================================================================== */

export function perksPage(ctx, { perks, total, category, q, claimed, counts }) {
  const options = DEAL_CATEGORIES
    .map((c) => ({ ...c, count: counts[c.slug] || 0 }))
    .filter((c) => c.count > 0);
  return html`<div class="pagehead">
    <div>
      <h1>Perks</h1>
      <p class="lede">${plural(total, 'programme')} across every category of startup support —
        cloud, AI, reagents, legal, banking, hiring, compliance and non-dilutive capital.</p>
    </div>
    <a class="btn ghost" href="/homeroom/perks/new">Add a perk</a>
  </div>

  <form class="searchbar" method="get" action="/homeroom/perks">
    <input type="search" name="q" value="${q}" placeholder="vendor, or what it covers" />
    <button class="btn" type="submit">Search</button>
  </form>
  ${filterBar(options, { active: category, basePath: '/homeroom/perks', param: 'category', allLabel: 'everything' })}

  <p class="mono dim tiny">Most of these are redeemed by application or a partner link, not by a
    code. Where a code exists a steward has entered the real one — we do not invent them, because a
    wrong code costs a founder an afternoon.</p>

  ${perks.length ? html`<ul class="cards grid perks">${perks.map((p) => html`<li class="card perk a-${p.access}">
    <a class="cardlink" href="/homeroom/perk/${p.slug}">
      <div class="grow">
        <div class="name">${p.vendor} ${claimed.has(p.id) ? pill('claimed', 'ok') : ''}</div>
        <div class="headline">${p.title}</div>
        <div class="meta mono">${labelFor(DEAL_CATEGORIES, p.category, p.category)}
          <span class="sep">/</span> ${labelFor(PERK_ACCESS, p.access, p.access)}
          ${p.claim_count ? html`<span class="sep">/</span> ${plural(p.claim_count, 'claim')}` : ''}</div>
        ${p.worth ? html`<div class="worth">${p.worth}</div>` : ''}
        <p class="summary">${p.summary}</p>
      </div></a>
  </li>`)}</ul>` : empty('Nothing in this category yet.')}`;
}

export function perkPage(ctx, { perk, claimed, claimCount }) {
  return html`<div class="profilehead">
    <div class="grow">
      <h1>${perk.vendor}</h1>
      <p class="headline">${perk.title}</p>
      <div class="mono dim">${labelFor(DEAL_CATEGORIES, perk.category, perk.category)}
        <span class="sep">/</span> ${labelFor(PERK_ACCESS, perk.access, perk.access)}
        ${perk.worth ? html` <span class="sep">/</span> <b class="worth">${perk.worth}</b>` : ''}
        <span class="sep">/</span> ${plural(claimCount, 'member')} claimed
        ${perk.checked ? html` <span class="sep">/</span> checked ${perk.checked}` : ''}</div>
    </div>
  </div>
  ${perk.summary ? html`<p class="lede">${perk.summary}</p>` : ''}
  ${perk.details ? body(perk.details) : ''}
  ${perk.requirement ? html`<div class="requirement"><span class="mono dim">Who qualifies</span>
    <p>${perk.requirement}</p></div>` : ''}

  ${claimed
    ? html`<div class="claimbox">
        <div class="mono dim">how to redeem</div>
        <div class="code">${perk.code || accessLine(perk.access)}</div>
        ${perk.url ? html`<a class="btn solid" href="${perk.url}"
          rel="${raw(perk.url.startsWith('/') ? '' : 'nofollow noopener')}"
          target="${raw(perk.url.startsWith('/') ? '_self' : '_blank')}">Go to ${perk.vendor}</a>` : ''}
        ${!perk.code && perk.access === 'code'
          ? html`<p class="mono dim">No code on file yet. Ask a steward — they can add the
            real one.</p>` : ''}
      </div>`
    : html`<form method="post" action="/homeroom/perk/${perk.slug}/claim">
        ${csrfField(ctx)}
        <button class="btn solid" type="submit">Claim this perk</button>
        <p class="mono dim">Claiming records that you took it, so the community can renegotiate on
          real numbers — and so we know which perks are worth keeping.</p>
      </form>`}`;
}

function accessLine(access) {
  return {
    open: 'Free to everyone — just use the link.',
    apply: 'Apply on the vendor’s own startup page using the link below.',
    partner: 'Unlocked through a partner. Ask a steward for the current referral link.',
    code: 'No code needed — use the link below.',
  }[access] || 'Use the link below.';
}

/* ==========================================================================
 * RATE MY FUNDER
 * ======================================================================== */

export function fundersPage(ctx, { funders, total, page, filters, basePath, tracked }) {
  return html`<div class="pagehead">
    <div>
      <h1>Rate My Funder</h1>
      <p class="lede">${plural(total, 'funder')} on the capital map — grants, accelerators,
        pre-seed and seed funds, studios, fellowships, angels and prizes — rated by the founders who
        actually sat across from them. Reviews are anonymous by default.</p>
    </div>
    <div class="heroactions">
      <a class="btn ghost" href="/homeroom/pipeline">Your pipeline</a>
      <a class="btn solid" href="/homeroom/funders/new">Add a funder</a>
    </div>
  </div>

  <form class="searchbar wide" method="get" action="/homeroom/funders">
    <input type="search" name="q" value="${filters.q}" placeholder="name, thesis, geography" />
    ${select('kind', FUNDER_KINDS, filters.kind, { blank: 'any kind of capital' })}
    ${select('sort', [
      { slug: 'rating', label: 'best rated' }, { slug: 'reviews', label: 'most reviewed' },
      { slug: 'name', label: 'name' }, { slug: 'new', label: 'newest' },
    ], filters.sort)}
    <button class="btn" type="submit">Filter</button>
  </form>

  ${funders.length ? html`<ul class="cards">${funders.map((f) => html`<li class="card funder">
    <div class="grow">
      <div class="title-line"><a class="title" href="/homeroom/funder/${f.slug}">${f.name}</a>
        ${pill(labelFor(FUNDER_KINDS, f.kind, f.kind))}
        ${f.dilutive ? '' : pill('non-dilutive', 'ok')}
        ${tracked.has(f.id) ? pill('in your pipeline', 'cohort') : ''}</div>
      <div class="subline mono">${f.focus || 'no stated focus'}
        ${f.stages ? html`<span class="sep">/</span> ${f.stages}` : ''}
        ${f.check_size ? html`<span class="sep">/</span> ${f.check_size}` : ''}
        ${f.location ? html`<span class="sep">/</span> ${f.location}` : ''}</div>
    </div>
    <div class="ratingcol">
      ${stars(f.avg_rating, { count: f.review_count })}
      ${f.would_again_pct === null ? '' : html`<div class="again mono">${f.would_again_pct}% would raise again</div>`}
    </div>
  </li>`)}</ul>` : empty('Nothing matches. Add the funder and be the first to review it.')}
  ${pager({ page, total, perPage: PER_PAGE, basePath })}`;
}

export function funderPage(ctx, { funder, reviews, comments, myReview, myHelpful, entry, orgs, tags }) {
  return html`<div class="profilehead">
    <div class="grow">
      <h1>${funder.name}</h1>
      <div class="mono dim">${labelFor(FUNDER_KINDS, funder.kind, funder.kind)}
        ${funder.focus ? html` <span class="sep">/</span> ${funder.focus}` : ''}
        ${funder.stages ? html` <span class="sep">/</span> ${funder.stages}` : ''}
        ${funder.check_size ? html` <span class="sep">/</span> ${funder.check_size}` : ''}
        ${funder.location ? html` <span class="sep">/</span> ${funder.location}` : ''}
        ${funder.website ? html` <span class="sep">/</span> <a href="${funder.website}" rel="nofollow noopener" target="_blank">site</a>` : ''}</div>
    </div>
  </div>

  <div class="scorecard">
    <div class="bigscore">
      ${stars(funder.avg_rating, { count: funder.review_count })}
      ${funder.would_again_pct === null
        ? html`<div class="again mono dim">would-raise-again withheld under three reviews</div>`
        : html`<div class="again">${funder.would_again_pct}% would raise from them again</div>`}
    </div>
    <ul class="axes">
      ${axis('Speed to decide', funder.avg_speed)}
      ${axis('Value beyond money', funder.avg_value)}
      ${axis('Founder-friendly', funder.avg_friendly)}
      ${axis('Terms', funder.avg_terms)}
    </ul>
  </div>

  ${tags.length ? html`<div class="tagrow big">${tags.map((t) => html`<span class="tag count">${t.label}
    <b>${t.count}</b></span>`)}</div>` : ''}

  ${funder.description ? body(funder.description) : ''}

  <div class="cols">
    <div class="main">
      ${section(`Reviews (${reviews.length})`, reviews.length
        ? html`<ul class="rail-list wide">${reviews.map((r) => reviewCard(ctx, funder, r, comments[r.id] || [], myHelpful.has(r.id)))}</ul>`
        : html`<p class="mono dim">No reviews yet. Yours would be the first, and the first one is
          what makes the second one possible.</p>`)}

      ${section(myReview ? 'Update your review' : 'Write a review', html`
        <form class="stack" method="post" action="/homeroom/funder/${funder.slug}/review">
          ${csrfField(ctx)}
          <div class="row">
            <div class="field"><label for="rating">Overall</label>
              ${select('rating', ratingOptions(), String(myReview?.rating || 3))}</div>
            <div class="field"><label for="speed">Speed to decide</label>
              ${select('speed', ratingOptions(), String(myReview?.speed || ''), { blank: '—' })}</div>
            <div class="field"><label for="value_add">Value beyond money</label>
              ${select('value_add', ratingOptions(), String(myReview?.value_add || ''), { blank: '—' })}</div>
          </div>
          <div class="row">
            <div class="field"><label for="founder_friendly">Founder-friendly</label>
              ${select('founder_friendly', ratingOptions(), String(myReview?.founder_friendly || ''), { blank: '—' })}</div>
            <div class="field"><label for="terms">Terms</label>
              ${select('terms', ratingOptions(), String(myReview?.terms || ''), { blank: '—' })}</div>
            <div class="field"><label for="outcome">What happened</label>
              ${select('outcome', REVIEW_OUTCOMES, myReview?.outcome || '', { blank: '—' })}</div>
          </div>
          <div class="field"><label for="stage">Stage you were at</label>
            <input id="stage" name="stage" maxlength="60" value="${myReview?.stage || ''}"
              placeholder="pre-seed, pre-revenue, one paper" /></div>
          <fieldset class="tagpicker">
            <legend>Tags</legend>
            ${REVIEW_TAGS.map((t) => html`<label class="check inline"><input type="checkbox" name="tags"
              value="${t.slug}" ${raw(tagList(myReview?.tags).includes(t.slug) ? 'checked' : '')} /> ${t.label}</label>`)}
          </fieldset>
          <div class="field"><label for="rbody">What happened, in detail</label>
            <textarea id="rbody" name="body" rows="6"
              placeholder="How they behaved in diligence, how long it took, what they did after the wire — or after the pass.">${myReview?.body || ''}</textarea></div>
          <label class="check"><input type="checkbox" name="would_again" value="1" ${raw(myReview?.would_again ? 'checked' : '')} /> I would raise from them again</label>
          <label class="check"><input type="checkbox" name="invested" value="1" ${raw(myReview?.invested ? 'checked' : '')} /> they ended up investing</label>
          <label class="check"><input type="checkbox" name="anonymous" value="1" ${raw(myReview && !myReview.anonymous ? '' : 'checked')} /> post anonymously</label>
          <button class="btn solid" type="submit">${myReview ? 'Update review' : 'Post review'}</button>
          <p class="hint">Anonymous hides your handle from members and from the API. Stewards can
            still look it up — anonymity here is for candour, not cover.</p>
        </form>`)}
    </div>
    <aside class="rail">
      ${section('Your pipeline', html`
        <form class="stack" method="post" action="/homeroom/funder/${funder.slug}/track">
          ${csrfField(ctx)}
          <div class="field"><label for="status">Status</label>
            ${select('status', PIPELINE_STATUSES, entry?.status || 'researching')}</div>
          <div class="field"><label for="org">For which lab</label>
            ${select('org', orgs.map((o) => ({ slug: String(o.id), label: o.name })), String(entry?.org_id || ''), { blank: '— none —' })}</div>
          <div class="field"><label for="amount">Amount</label>
            <input id="amount" name="amount" value="${entry?.amount || ''}" maxlength="60" placeholder="€150k SAFE" /></div>
          <div class="field"><label for="notes">Private notes</label>
            <textarea id="notes" name="notes" rows="4" maxlength="4000">${entry?.notes || ''}</textarea>
            <div class="hint">Only you can read these.</div></div>
          <button class="btn solid" type="submit">${entry ? 'Update' : 'Track this funder'}</button>
        </form>
        ${entry ? html`<form method="post" action="/homeroom/funder/${funder.slug}/untrack">
          ${csrfField(ctx)}<button class="linkish mono" type="submit">remove from pipeline</button></form>` : ''}`)}
    </aside>
  </div>`;
}

function axis(label, value) {
  if (!value) return html`<li class="axis none"><span class="mono">${label}</span><b>—</b></li>`;
  return html`<li class="axis"><span class="mono">${label}</span>
    <span class="bar"><i style="width:${Math.round((value / 5) * 100)}%"></i></span>
    <b>${value}</b></li>`;
}

function reviewCard(ctx, funder, review, replies, marked) {
  return html`<li class="review" id="r${review.id}">
    <div class="mono">${stars(review.rating)}
      <span class="sep">/</span> ${review.anonymous ? html`<span class="anon">anonymous member</span>` : memberLink(review.user_id)}
      <span class="sep">/</span> ${when(review.created_at)}
      ${review.invested ? pill('they invested', 'ok') : ''}
      ${review.would_again ? pill('would raise again', 'ok') : ''}
      ${review.outcome ? pill(labelFor(REVIEW_OUTCOMES, review.outcome, review.outcome)) : ''}
      ${review.stage ? html`<span class="dim">${review.stage}</span>` : ''}</div>
    <div class="mono dim tiny">
      ${review.speed ? html`speed ${review.speed}/5 · ` : ''}
      ${review.value_add ? html`value ${review.value_add}/5 · ` : ''}
      ${review.founder_friendly ? html`friendly ${review.founder_friendly}/5 · ` : ''}
      ${review.terms ? html`terms ${review.terms}/5` : ''}</div>
    ${tagList(review.tags).length ? html`<div class="tagrow">${tagList(review.tags)
      .map((t) => html`<span class="tag ghost">${labelFor(REVIEW_TAGS, t, t)}</span>`)}</div>` : ''}
    ${review.body ? body(review.body) : ''}

    <div class="reviewfoot mono">
      <form method="post" action="/homeroom/review/${review.id}/helpful" class="inline">
        ${csrfField(ctx)}
        <input type="hidden" name="goto" value="/homeroom/funder/${funder.slug}#r${review.id}" />
        <button class="react ${marked ? 'on' : ''}" type="submit">
          ${marked ? 'matches my experience' : 'this matches my experience'} <b>${review.helpful}</b>
        </button>
      </form>
    </div>

    ${replies.length ? html`<ul class="replies">${replies.map((c) => html`<li class="reply">
      <div class="mono">${c.anonymous ? html`<span class="anon">anonymous member</span>` : memberLink(c.author_id)}
        <span class="sep">/</span> ${when(c.created_at)}</div>
      ${body(c.body)}
    </li>`)}</ul>` : ''}

    <form class="replyform" method="post" action="/homeroom/review/${review.id}/comment">
      ${csrfField(ctx)}
      <input type="hidden" name="goto" value="/homeroom/funder/${funder.slug}#r${review.id}" />
      <textarea name="body" rows="2" maxlength="4000" required
        placeholder="Add what happened to you with the same fund."></textarea>
      <label class="check inline"><input type="checkbox" name="anonymous" value="1" checked /> anonymously</label>
      <button class="btn small" type="submit">Reply</button>
    </form>
  </li>`;
}

/* ==========================================================================
 * MENTORS AND OFFICE HOURS
 * ======================================================================== */

export const MENTOR_TABS = [
  { key: 'mentors', href: '/homeroom/mentors', label: 'Mentors' },
  { key: 'requests', href: '/homeroom/mentors/requests', label: 'Your requests' },
  { key: 'hours', href: '/homeroom/hours', label: 'Open office hours' },
  { key: 'mine', href: '/homeroom/hours?mine=1', label: 'Your bookings' },
];

export function mentorsPage(ctx, { mentors, total, filters, tags, basePath, page, vettedCount }) {
  return html`<div class="pagehead">
    <div>
      <h1>Mentors</h1>
      <p class="lede">${total} in the network, ${vettedCount} vetted and taking bookings. Filter by
        what you are actually stuck on, then book directly on their calendar. Anyone marked
        <em>from the network</em> is a real contact who has not confirmed bookings yet — ask a
        steward for an intro.</p>
    </div>
    <a class="btn ghost" href="/homeroom/hours/new">Offer office hours</a>
  </div>

  <form class="searchbar wide" method="get" action="/homeroom/mentors">
    <input type="search" name="q" value="${filters.q}" placeholder="name, org, expertise, city" />
    ${select('track', MENTOR_TRACKS, filters.track, { blank: 'every track' })}
    ${select('format', [
      { slug: 'one-on-one', label: 'one-on-one' }, { slug: 'group', label: 'group' },
    ], filters.format, { blank: 'any format' })}
    <label class="check inline"><input type="checkbox" name="vetted" value="1"
      ${raw(filters.vetted ? 'checked' : '')} /> vetted only</label>
    <button class="btn" type="submit">Filter</button>
  </form>

  ${tags.length ? html`<div class="tagrow big">
    ${tags.slice(0, 24).map((t) => html`<a class="tag ${filters.tag === t.slug ? 'on' : ''}"
      href="/homeroom/mentors?tag=${encodeURIComponent(t.slug)}">${t.label} <b>${t.count}</b></a>`)}
  </div>` : ''}

  ${mentors.length ? html`<ul class="cards grid mentors">${mentors.map((m) => html`<li class="card mentor">
    <a class="cardlink" href="/homeroom/mentor/${m.slug}">
      ${avatar(m.name, { size: 42 })}
      <div class="grow">
        <div class="name">${m.name} ${m.vetted ? pill('vetted', 'ok')
          : (m.source === 'calendar' ? pill('from the network') : '')}</div>
        <div class="headline">${m.role}${m.org ? html` · ${m.org}` : ''}</div>
        <div class="meta mono">${labelFor(MENTOR_TRACKS, m.track, m.track)}
          ${m.location ? html`<span class="sep">/</span> ${m.location}` : ''}
          ${m.open_slots ? html`<span class="sep">/</span> <b>${plural(m.open_slots, 'open slot')}</b>` : ''}</div>
      </div>
    </a>
    <div class="tagrow">${m.tags.slice(0, 3).map((t) => html`<a class="tag ghost"
      href="/homeroom/mentors?tag=${encodeURIComponent(t)}">${t}</a>`)}</div>
  </li>`)}</ul>` : empty('Nobody matches. Try a broader track, or ask in the forum.')}
  ${pager({ page, total, perPage: 60, basePath })}`;
}

/**
 * The booking section: the one place a member can reach a mentor's calendar.
 *
 * `mentor.scheduler` is not available here and that is deliberate — models.js
 * no longer selects the column, so this view could not render the raw link if
 * it tried. What it renders instead is one of four things: a live grant, a
 * request button, the reason there is no request button, or (with the gate
 * switched off) the old direct link, which the route has to fetch on purpose.
 */
function booking(mentor, desk) {
  if (desk.directLink) {
    return html`<p>Pick a time straight on their calendar.</p>
      <a class="btn solid" href="${desk.directLink}" rel="nofollow noopener" target="_blank">
        Open ${mentor.name}’s booking page</a>
      <p class="mono dim tiny">Booking happens on their own scheduler, so the slot lands in
        their real calendar rather than in a queue nobody watches.</p>`;
  }
  if (desk.grant) {
    return html`<p>${mentor.name} said yes. The link is yours and expires ${relTime(desk.grant.expires_at)}.</p>
      <a class="btn solid" href="/homeroom/mentor/${mentor.slug}/book/${desk.grant.id}">
        Book with ${mentor.name}</a>
      <p class="mono dim tiny">Booking happens on their own scheduler, so the slot lands in
        their real calendar rather than in a queue nobody watches.</p>`;
  }
  if (desk.pending) {
    return html`<p>You asked ${mentor.name} ${relTime(desk.pending.created_at)}. They answer by
      email, and you will hear either way.</p>
      <a class="btn ghost" href="/homeroom/mentors/requests">Your requests</a>`;
  }
  if (desk.canAsk) {
    return html`<p>${mentor.name} takes up to ${desk.capacity.cap} sessions a month and has
      ${desk.capacity.cap - desk.capacity.used} left. Tell them what you need; they say yes or no.</p>
      <a class="btn solid" href="/homeroom/mentor/${mentor.slug}/request">Ask for time</a>`;
  }
  return html`<p class="mono dim">${desk.reason || 'Not taking requests right now.'}</p>
    ${desk.resetsAt ? html`<p class="mono dim tiny">Their month resets ${relTime(desk.resetsAt)}.</p>` : ''}`;
}

export function mentorPage(ctx, { mentor, slots, member, desk }) {
  return html`<div class="profilehead">
    ${avatar(mentor.name, { size: 72 })}
    <div class="grow">
      <h1>${mentor.name} ${mentor.vetted ? pill('vetted', 'ok')
        : (mentor.source === 'calendar' ? pill('from the network') : pill('not yet vetted'))}</h1>
      <p class="headline">${mentor.role}${mentor.org ? html` · ${mentor.org}` : ''}</p>
      <div class="mono dim">${labelFor(MENTOR_TRACKS, mentor.track, mentor.track)}
        ${mentor.location ? html` <span class="sep">/</span> ${mentor.location}` : ''}
        <span class="sep">/</span> ${mentor.format}
        ${mentor.sessions ? html` <span class="sep">/</span> ${plural(mentor.sessions, 'session')} held` : ''}</div>
    </div>
  </div>
  ${mentor.bio ? body(mentor.bio) : ''}
  ${mentor.tags.length ? html`<div class="tagrow">${mentor.tags.map((t) => html`<a class="tag"
    href="/homeroom/mentors?tag=${encodeURIComponent(t)}">${t}</a>`)}</div>` : ''}

  <div class="cols">
    <div class="main">
      ${mentor.source === 'calendar' && !mentor.vetted
        ? html`<div class="notice">Added from the Haus network. They have <b>not</b> confirmed they
            take bookings, and there is no scheduling link on file — ask a steward for an intro
            rather than reaching out cold.</div>`
        : ''}

      ${section('Book time', html`
        ${booking(mentor, desk)}

        ${slots.length ? html`<ul class="rail-list wide">${slots.map((s) => html`<li class="slot">
          <div class="mono"><b>${stamp(s.starts_at)}</b> <span class="sep">/</span> ${relTime(s.starts_at)}
            <span class="sep">/</span> ${s.minutes} min
            <span class="sep">/</span> ${s.booked}/${s.capacity} booked</div>
          <div><a href="/homeroom/hours/${s.id}">${s.title}</a></div>
        </li>`)}</ul>` : html`<p class="mono dim">No Homeroom slots scheduled right now.</p>`}

        ${member
          ? html`<a class="btn ghost" href="/homeroom/messages/new?to=${encodeURIComponent(member.user_id)}">Message them here</a>`
          : html`<a class="btn ghost" href="/homeroom/intros/new">Ask a steward for an intro</a>`}`)}
    </div>
    <aside class="rail">
      ${section('Before you book', html`<ul class="tight">
        <li>Send the question in advance. A mentor who has read it arrives useful.</li>
        <li>Bring the artefact — the deck, the term sheet, the assay — not a summary of it.</li>
        <li>Say what you have already tried. It is the fastest way past the first ten minutes.</li>
      </ul>`)}
    </aside>
  </div>`;
}

/* ==========================================================================
 * EVENTS CALENDAR
 * ======================================================================== */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export const EVENT_TABS = [
  { key: 'calendar', href: '/homeroom/events', label: 'Calendar' },
  { key: 'list', href: '/homeroom/events/list', label: 'List' },
];

/**
 * A month grid.
 *
 * Weeks start Monday and the grid always renders six rows, so the page does not
 * change height between months — a calendar that jumps when you page through it
 * is unusable with a mouse.
 */
export function calendarPage(ctx, { year, month, events, luma, kind }) {
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - startDay));
  const byDay = new Map();
  for (const event of events) {
    const key = new Date(event.starts_at * 1000).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(event);
  }
  const today = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart.getTime() + i * 86400_000);
    const key = day.toISOString().slice(0, 10);
    const dayEvents = byDay.get(key) || [];
    cells.push(html`<li class="day ${day.getUTCMonth() === month ? '' : 'off'} ${key === today ? 'today' : ''}">
      <div class="daynum mono">${day.getUTCDate()}</div>
      <ul class="dayevents">${dayEvents.map((e) => html`<li>
        <a class="ev k-${e.kind} ${e.canceled ? 'off' : ''}" href="/homeroom/event/${e.id}"
          title="${e.title}">
          <span class="time mono">${String(new Date(e.starts_at * 1000).getUTCHours()).padStart(2, '0')}:${
            String(new Date(e.starts_at * 1000).getUTCMinutes()).padStart(2, '0')}</span>
          ${snippet(e.title, 40)}
        </a></li>`)}</ul>
    </li>`);
  }

  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return html`<div class="pagehead">
    <div>
      <h1>${MONTH_NAMES[month]} ${year}</h1>
      <p class="lede">${plural(events.length, 'event')} this month. Times are UTC — a distributed
        network has no single local time.</p>
    </div>
    <div class="heroactions">
      <a class="btn ghost" href="/homeroom/events?y=${prev.y}&m=${prev.m}">&larr; ${MONTH_NAMES[prev.m]}</a>
      <a class="btn ghost" href="/homeroom/events?y=${next.y}&m=${next.m}">${MONTH_NAMES[next.m]} &rarr;</a>
      <a class="btn solid" href="/homeroom/events/new">Add an event</a>
    </div>
  </div>

  ${lumaStrip(ctx, luma)}

  <div class="calendar">
    <ol class="weekdays mono">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map((d) => html`<li>${d}</li>`)}</ol>
    <ol class="grid month">${cells}</ol>
  </div>

  <p class="mono dim tiny">Subscribe in your own calendar:
    <a href="/homeroom/events.ics">/homeroom/events.ics</a></p>`;
}

/** What the Luma link-out or the sync state looks like above the grid. */
function lumaStrip(ctx, luma) {
  if (!luma) return '';
  if (!luma.configured) {
    return html`<div class="notice">
      Luma sync is off — set <code>LUMA_API_KEY</code> to pull
      <a href="${luma.calendarUrl}" rel="noopener" target="_blank">luma.com/biopunk</a> into this
      grid automatically. Until then the public calendar is the source of truth.
      <a class="btn ghost small" href="${luma.calendarUrl}" rel="noopener" target="_blank">Open on Luma</a>
    </div>`;
  }
  return html`<div class="lumastrip mono">
    <span>Luma: ${luma.count} events synced${luma.at ? html`, last ${relTime(luma.at)}` : ''}.</span>
    <a href="${luma.calendarUrl}" rel="noopener" target="_blank">luma.com/biopunk</a>
    ${ctx.user?.is_admin ? html`<form method="post" action="/homeroom/events/sync" class="inline">
      ${csrfField(ctx)}<button class="linkish" type="submit">sync now</button></form>` : ''}
  </div>`;
}

/* ==========================================================================
 * THE LIBRARY AS A TRAINING SYSTEM
 * ======================================================================== */

export function libraryPage(ctx, { tracks, progress, modules, filters, entries, sequence }) {
  return html`<div class="pagehead">
    <div>
      <h1>The Founder Manual</h1>
      <p class="lede">Six tracks, ${progress.total} modules, and a deliverable at the end of the ones
        that matter. Not a reading list — a module is done when the artefact exists.</p>
    </div>
    <a class="btn ghost" href="/homeroom/library/notes">Your deliverables</a>
  </div>

  <div class="progressbar">
    <div class="bar"><i style="width:${progress.percent}%"></i></div>
    <div class="mono">${progress.done} done · ${progress.started} in progress · ${progress.total} total
      <b>${progress.percent}%</b></div>
  </div>

  <form class="searchbar" method="get" action="/homeroom/library">
    <input type="search" name="q" value="${filters.q}" placeholder="search every module" />
    <button class="btn" type="submit">Search</button>
  </form>

  ${filters.q
    ? html`${section(`${modules.length} matching modules`, modules.length
        ? html`<ul class="cards">${modules.map((m) => moduleRow(m))}</ul>`
        : empty('Nothing matches.'))}`
    : html`<ul class="tracks">${tracks.map((t) => {
        const stat = progress.byTrack.find((row) => row.track === t.slug) || { total: 0, done: 0 };
        return html`<li class="card track">
          <a class="cardlink" href="/homeroom/library/track/${t.slug}">
            <div class="grow">
              <div class="name">${t.title}</div>
              <div class="meta mono">${t.focus}</div>
              <p class="summary">${t.blurb}</p>
              <div class="trackbar"><span class="bar"><i style="width:${
                stat.total ? Math.round(((stat.done || 0) / stat.total) * 100) : 0}%"></i></span>
                <span class="mono">${stat.done || 0}/${stat.total}</span></div>
            </div>
          </a>
        </li>`;
      })}</ul>`}

  ${section('Delivered live, S26', html`<ol class="sequence">${sequence.map(([date, title, topics]) => html`<li>
    <span class="mono when">${date}</span>
    <span class="grow"><b>${title}</b><span class="mono dim block">${topics}</span></span>
  </li>`)}</ol>
  <p class="mono dim tiny">The reference schedule. The Fall calendar maps the same curriculum onto
    twelve weeks; weeks 5 and 8 carry no workshops, which is deliberate — the retreat and the
    hackathon are the programming that week.</p>`)}

  ${entries.length ? section('Member-written entries', html`<ul class="cards grid">${entries.map((e) => html`<li class="card">
    <a class="cardlink" href="/homeroom/library/entry/${e.slug}">
      <div class="grow"><div class="name">${e.title}</div>
        <div class="meta mono">${plural(e.reads, 'read')} <span class="sep">/</span> ${when(e.updated_at)}</div>
        <p class="summary">${e.summary}</p></div></a>
  </li>`)}</ul>`, { action: html` <a class="mono" href="/homeroom/library/new">write one</a>` }) : ''}`;
}

function moduleRow(module) {
  return html`<li class="card module ${module.state || ''}">
    <div class="grow">
      <div class="title-line">
        <a class="title" href="/homeroom/library/module/${module.slug}">${module.title}</a>
        ${module.state === 'done' ? pill('done', 'ok') : module.state ? pill('in progress', 'cohort') : ''}
        ${module.week ? pill(`week ${module.week}`) : pill('async')}
      </div>
      <div class="subline mono">${module.kind} <span class="sep">/</span> ${module.minutes} min
        ${module.deliverable ? html`<span class="sep">/</span> <b>${module.deliverable}</b>` : ''}</div>
      <p class="summary">${snippet(module.summary, 200)}</p>
    </div>
  </li>`;
}

export function trackPage(ctx, { track, modules, stat }) {
  return html`<div class="pagehead">
    <div>
      <h1>${track.title}</h1>
      <p class="lede">${track.blurb}</p>
      <div class="mono dim">${track.focus}</div>
    </div>
  </div>
  <div class="progressbar">
    <div class="bar"><i style="width:${stat.total ? Math.round(((stat.done || 0) / stat.total) * 100) : 0}%"></i></div>
    <div class="mono">${stat.done || 0} of ${stat.total} done</div>
  </div>
  <ul class="cards">${modules.map((m) => moduleRow(m))}</ul>`;
}

export function modulePage(ctx, { module, track, progress, neighbours }) {
  return html`<div class="pagehead">
    <div>
      <div class="mono dim"><a href="/homeroom/library/track/${track.slug}">${track.title}</a></div>
      <h1>${module.title}</h1>
      <div class="mono dim">${module.kind} <span class="sep">/</span> ${module.minutes} min
        <span class="sep">/</span> ${module.week ? `delivered live in week ${module.week}` : 'async'}
        ${module.deliverable ? html` <span class="sep">/</span> deliverable: <b>${module.deliverable}</b>` : ''}</div>
    </div>
  </div>

  <p class="lede">${module.summary}</p>

  <div class="cols">
    <div class="main">
      ${module.outcomes.length ? section('After this you should be able to', html`
        <ul class="outcomes">${module.outcomes.map((o) => html`<li>${o}</li>`)}</ul>`) : ''}
      ${module.work.length ? section('The work', html`
        <ol class="worklist">${module.work.map((w) => html`<li>${w}</li>`)}</ol>`) : ''}

      ${section(module.deliverable ? `Deliverable — ${module.deliverable}` : 'Your notes', html`
        <form class="stack" method="post" action="/homeroom/library/module/${module.slug}/progress">
          ${csrfField(ctx)}
          <div class="field"><label for="link">Link to what you produced</label>
            <input id="link" name="link" maxlength="500" value="${progress?.link || ''}"
              placeholder="https://docs.google.com/..." /></div>
          <div class="field"><label for="note">Notes to yourself</label>
            <textarea id="note" name="note" rows="5" maxlength="4000">${progress?.note || ''}</textarea>
            <div class="hint">Only you can read these.</div></div>
          <div class="row">
            <button class="btn" name="state" value="started" type="submit">Save as in progress</button>
            <button class="btn solid" name="state" value="done" type="submit">Mark done</button>
            ${progress ? html`<button class="linkish mono" name="state" value="none" type="submit">clear</button>` : ''}
          </div>
        </form>`)}
    </div>
    <aside class="rail">
      ${section('In this track', html`<ul class="tight">${neighbours.map((n) => html`<li>
        ${n.slug === module.slug ? html`<b>${n.title}</b>`
          : html`<a href="/homeroom/library/module/${n.slug}">${n.title}</a>`}
        ${n.state === 'done' ? html` <span class="mono ok">done</span>` : ''}
      </li>`)}</ul>`)}
      ${section('Get unstuck', html`<ul class="tight">
        <li><a href="/homeroom/mentors?track=${track.slug}">Mentors on this track</a></li>
        <li><a href="/homeroom/hours">Book office hours</a></li>
        <li><a href="/homeroom/people?tag=${track.slug}">Members who know this</a></li>
      </ul>`)}
    </aside>
  </div>`;
}

export function deliverablesPage(ctx, { rows, progress }) {
  return html`<h1>Your deliverables</h1>
  <p class="lede">${progress.done} of ${progress.total} modules done. This is the portfolio the
    programme actually asks for.</p>
  ${rows.length ? html`<ul class="cards">${rows.map((r) => html`<li class="card ${r.state}">
    <div class="grow">
      <div class="title-line"><a class="title" href="/homeroom/library/module/${r.slug}">${r.deliverable}</a>
        ${r.state === 'done' ? pill('done', 'ok') : pill('in progress', 'cohort')}
        ${r.week ? pill(`week ${r.week}`) : ''}</div>
      <div class="subline mono">${r.title} <span class="sep">/</span> updated ${when(r.updated_at)}
        ${r.link ? html`<span class="sep">/</span> <a href="${r.link}" rel="nofollow noopener" target="_blank">the artefact</a>` : ''}</div>
      ${r.note ? html`<p class="summary">${snippet(r.note, 240)}</p>` : ''}
    </div>
  </li>`)}</ul>` : empty('Nothing yet. Start with the Risk Map in week 1.')}`;
}

/* ==========================================================================
 * PUBLISHING TO THE PUBLIC FEED
 * ======================================================================== */

export function publishPage(ctx, { submissions, supabase, error = null, values = {}, sent = false }) {
  return html`<div class="pagehead">
    <div>
      <h1>Publish to haus.fund/news</h1>
      <p class="lede">Send something from your account to the public feed. A steward reviews it
        before it goes live — the feed is public, and this room is not.</p>
    </div>
  </div>

  ${sent ? html`<div class="notice">Sent. It is in the queue for review.</div>` : ''}
  ${error ? html`<div class="notice bad">${error}</div>` : ''}

  ${supabase.configured
    ? (supabase.reachable ? '' : html`<div class="notice bad">Supabase is configured but not
        answering right now. Your submission will be recorded here and can be retried.</div>`)
    : html`<div class="notice bad">Publishing is not configured. Set
        <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> and run the migrations
        in <code>supabase/migrations/</code>.</div>`}

  <form class="stack" method="post" action="/homeroom/publish">
    ${csrfField(ctx)}
    <div class="field"><label for="title">Headline</label>
      <input id="title" name="title" required maxlength="300" value="${values.title || ''}"
        placeholder="What happened, in one line." /></div>
    <div class="field"><label for="url">Link</label>
      <input id="url" name="url" maxlength="500" value="${values.url || ''}"
        placeholder="https://... — the paper, the launch, the filing" /></div>
    <div class="field"><label for="topic">Topic</label>
      ${select('topic', [
        { slug: 'general', label: 'General' },
        { slug: 'research', label: 'Research' },
        { slug: 'funding', label: 'Funding' },
        { slug: 'launch', label: 'Launch' },
        { slug: 'policy', label: 'Policy' },
        { slug: 'community', label: 'Community' },
      ], values.topic || 'general')}</div>
    <div class="field"><label for="pbody">Context</label>
      <textarea id="pbody" name="body" rows="6" maxlength="20000"
        placeholder="Why it matters. Two paragraphs is plenty.">${values.body || ''}</textarea></div>
    <button class="btn solid" type="submit" ${raw(supabase.configured ? '' : 'disabled')}>Send for review</button>
    <p class="hint">It goes out under your handle, <b>${ctx.user?.id}</b>, not anonymously.
      Anything you would not want attached to your name belongs in the forum instead.</p>
  </form>

  ${section('Your submissions', submissions.length
    ? html`<ul class="cards">${submissions.map((s) => html`<li class="card sub s-${s.status}">
        <div class="grow">
          <div class="title-line"><span class="title">${s.title}</span> ${submissionPill(s.status)}</div>
          <div class="subline mono">${s.topic} <span class="sep">/</span> ${when(s.created_at)}
            ${s.url ? html`<span class="sep">/</span> <a href="${s.url}" rel="nofollow noopener" target="_blank">link</a>` : ''}</div>
          ${s.error ? html`<p class="summary bad">${s.error}</p>` : ''}
        </div>
      </li>`)}</ul>`
    : html`<p class="mono dim">Nothing sent yet.</p>`)}`;
}

function submissionPill(status) {
  const cls = { published: 'ok', rejected: 'bad', failed: 'bad', queued: 'cohort' }[status] || '';
  return pill(status, cls);
}

/* ==========================================================================
 * THE FRONT DOOR, FOR STEWARDS
 * ======================================================================== */

/**
 * Where a steward resolves the cases the rule will not decide.
 *
 * The queue at the top is the point of the page. Everything else is context for
 * the one question it asks: this person's dates say they live in the house and
 * their status says the offer was declined or deferred — which is true?
 */
export const STEWARD_TABS = [
  { key: 'access', href: '/homeroom/stewards/access', label: 'Front door' },
  { key: 'invites', href: '/homeroom/stewards/invites', label: 'Invites' },
];

export function accessAdminPage(ctx, { counts, mode, health, pending, recent, lookup = null }) {
  return html`<div class="pagehead">
    <div>
      <h1>Front door</h1>
      <p class="lede">Who the programme roster lets into Homeroom, and the conflicts it cannot
        settle on its own.</p>
    </div>
  </div>

  ${subnav(STEWARD_TABS, 'access')}

  <div class="statstrip">
    <span><b>${counts.pending}</b> awaiting a decision</span>
    <span><b>${counts.allow}</b> allowed</span>
    <span><b>${counts.deny}</b> denied</span>
    <span><b>${counts.review}</b> conflicts seen</span>
  </div>

  <div class="notice ${health.configured && health.reachable !== false ? '' : 'bad'}">
    Mode <b>${mode}</b>.
    ${mode === 'open' ? 'Anybody can create an account — this is the local-development setting, not a launch setting.' : ''}
    ${mode === 'closed' ? 'Self-signup is off; stewards create accounts by hand.' : ''}
    ${mode === 'roster' ? (health.configured
      ? (health.reachable === false
        ? 'The roster is configured but not answering. Signups are being refused with “try again shortly”, which is the correct behaviour but not a good one to leave running.'
        : 'Signups are checked against the Airtable People table.')
      : 'No token is set, so every signup is being refused. Set HOMEROOM_ROSTER_TOKEN.') : ''}
  </div>

  ${section('Needs a decision', pending.length
    ? html`<p class="mono dim tiny">The date fields and the status field disagree. Nobody has been
        let in and nobody has been turned away — the room is waiting on you.</p>
      <ul class="cards">${pending.map((row) => html`<li class="card review-row">
        <div class="grow">
          <div class="title-line"><span class="title">${row.name || row.masked}</span>
            ${pill('conflict', 'cohort')}</div>
          <div class="subline mono">${row.masked}
            <span class="sep">/</span> status <b>${row.status || '—'}</b>
            <span class="sep">/</span> lifecycle <b>${row.lifecycle || '—'}</b>
            ${row.resident_type ? html`<span class="sep">/</span> ${row.resident_type}` : ''}
            ${row.cohort ? html`<span class="sep">/</span> ${row.cohort}` : ''}
            <span class="sep">/</span> asked ${when(row.checked_at)}
            ${row.attempts > 1 ? html`<span class="sep">/</span> ${row.attempts} attempts` : ''}</div>
        </div>
        <div class="decide">
          <form method="post" action="/homeroom/stewards/access/${row.email_hash}/decide" class="inline">
            ${csrfField(ctx)}
            <input type="hidden" name="decision" value="allow" />
            <button class="btn small solid" type="submit">Let them in</button>
          </form>
          <form method="post" action="/homeroom/stewards/access/${row.email_hash}/decide" class="inline">
            ${csrfField(ctx)}
            <input type="hidden" name="decision" value="deny" />
            <button class="btn small" type="submit">Keep out</button>
          </form>
        </div>
      </li>`)}</ul>`
    : html`<p class="mono dim">Nothing waiting. Conflicts appear here the first time someone with
        one tries to sign up.</p>`)}

  ${section('Check an address', html`
    <form class="searchbar" method="post" action="/homeroom/stewards/access/lookup">
      ${csrfField(ctx)}
      <input type="email" name="email" required placeholder="the address they applied with"
        value="${lookup?.email || ''}" />
      <button class="btn" type="submit">Check the roster</button>
    </form>
    <p class="mono dim tiny">Asks Airtable live. Use this when somebody says they cannot get in —
      it answers “which of their addresses is on the record” in one go.</p>
    ${lookup ? html`<div class="lookup ${lookup.verdict}">
      <div class="mono"><b>${lookup.verdict}</b> <span class="sep">/</span> ${lookup.reason}
        ${lookup.error ? html`<span class="sep">/</span> ${lookup.error}` : ''}</div>
      ${lookup.person?.name ? html`<div>${lookup.person.name}
        <span class="mono dim">status ${lookup.person.status || '—'} ·
        lifecycle ${lookup.person.lifecycle || '—'} ·
        ${lookup.person.residentType || 'no resident type'}
        ${lookup.person.cohort ? html`· ${lookup.person.cohort}` : ''}</span></div>` : ''}
    </div>` : ''}`)}

  ${section('Recent checks', recent.length
    ? html`<ul class="rail-list wide">${recent.map((row) => html`<li class="mono">
        ${verdictPill(row.decision || row.verdict)}
        <span class="sep">/</span> ${row.masked}
        <span class="sep">/</span> ${row.decision ? html`decided by ${memberLink(row.decided_by)}` : row.reason}
        <span class="sep">/</span> ${when(row.checked_at)}
        ${row.user_id ? html`<span class="sep">/</span> ${memberLink(row.user_id)}` : ''}
      </li>`)}</ul>`
    : html`<p class="mono dim">Nothing yet.</p>`)}

  <p class="mono dim tiny">Addresses are stored here only as a SHA-256 and shown masked — this
    table is a decision log, not a copy of the roster.</p>`;
}

function verdictPill(verdict) {
  const cls = { allow: 'ok', deny: 'bad', review: 'cohort' }[verdict] || '';
  return pill(verdict, cls);
}


/* ============================================================== onboarding */

/**
 * Where a new member lands, and where anyone can come back to.
 *
 * Not a modal, not a wizard, and not skippable-once-and-gone: it is a page with
 * a URL, so a member who closed it on their first day can find it again in week
 * three. Every step links straight to the real surface rather than teaching a
 * tour, because the fastest way to learn what a room holds is to use it.
 */
export function welcomePage(ctx, { member, progress, stats, invitedBy = '' }) {
  const { steps, done, total, complete } = progress;
  return html`<div class="hero">
    <div>
      <h1>Welcome${member.name ? html`, ${member.name}` : ''}.</h1>
      <p class="lede">${invitedBy
        ? html`${memberLink(invitedBy)} invited you. `
        : ''}Homeroom holds ${stats.deals} perks, ${stats.funders} funders with member-written
        reviews, ${stats.atlas} labs on the atlas, ${stats.mentors} mentors and a
        ${stats.modules}-module founder manual. Here is the short way in.</p>
    </div>
  </div>

  ${complete
    ? html`<div class="notice">You have done everything on this list. It stays here if you
        want to come back to it.</div>`
    : html`<div class="notice">${done} of ${total} done.</div>`}

  <ol class="onboard">
    ${steps.map((step, index) => html`<li class="step ${step.done ? 'done' : ''}">
      <div class="stepnum mono">${step.done ? raw('&#10003;') : index + 1}</div>
      <div class="grow">
        <div class="title-line"><span class="title">${step.title}</span>
          ${step.optional ? pill('optional') : ''}</div>
        <p class="prose small">${step.why}</p>
        <a class="btn ${step.done ? 'ghost' : 'solid'}" href="${step.href}">
          ${step.done ? 'Change it' : step.action}</a>
      </div>
    </li>`)}
  </ol>

  <div class="cols">
    <div class="main">
      ${section('While you are here', html`<ul class="tight">
        <li><a href="/homeroom/people">The directory</a> — search by what people actually know.</li>
        <li><a href="/homeroom/funders">Rate My Funder</a> — read the reviews before the pitch,
          and write one after.</li>
        <li><a href="/homeroom/labs/cores">The Core Facility Finder</a> — instrument time you do
          not have to buy.</li>
        <li><a href="/homeroom/events">Events</a> — everything on the Biopunk calendar.</li>
        <li><a href="/homeroom/publish">Publish</a> — send something you have written to
          haus.fund/news.</li>
      </ul>`)}
    </div>
    <aside class="rail">
      ${section('House rules', html`<ul class="tight small">
        <li>Reviews and claims are attributed. Anonymity exists for candour, not for cover.</li>
        <li>Perk codes are negotiated for residents. Ask before you order at list price.</li>
        <li>A steward can see who wrote what. Nobody else can see it if you asked for it hidden.</li>
      </ul>`)}
      ${section('Stuck', html`<p class="mono dim">Mail
        <a href="mailto:hello@haus.fund">hello@haus.fund</a> and a steward will pick it up.</p>`)}
    </aside>
  </div>`;
}

/* ------------------------------------------------------- steward: invites */

export function invitesPage(ctx, {
  invites: rows, health, minted = null, error = null, flash = null, rosterMode,
}) {
  return html`<div class="pagehead">
    <div><h1>Invites</h1>
      <p class="lede">How a new resident gets an account while signup is closed. You vouch once;
        they do the rest.</p></div>
  </div>

  ${subnav(STEWARD_TABS, 'invites')}

  ${!health.durable ? html`<div class="notice bad">
    <b>Invites are being stored locally.</b> ${health.warning} A link minted now may stop working
    the moment this container recycles — set it up properly before sending any.</div>` : ''}

  ${rosterMode === 'open' ? html`<div class="notice">
    <b>Signup is open</b>, so anyone with the URL can already create an account and invites are
    not what is keeping the room closed.</div>` : ''}

  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  ${flash ? html`<div class="notice">${flash}</div>` : ''}

  ${minted ? html`<div class="notice good">
    <b>Invite created for ${minted.email}.</b> Send them this link — it is shown once and is not
    stored anywhere, so copy it now.
    <div class="code copyme" style="margin-top:10px">${minted.url}</div>
    <p class="mono dim" style="margin-top:8px">Expires ${stamp(minted.expiresAt)}. Creating another
      invite for the same address revokes this one.</p>
  </div>` : ''}

  <form class="stack wide" method="post" action="/homeroom/stewards/invites">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="email">Email address</label>
        <input id="email" name="email" type="email" required
          placeholder="the address on their application" />
        <div class="hint">Use the address they applied with, so the roster check matches.</div></div>
      <div class="field"><label for="days">Expires in</label>
        <select id="days" name="days">
          <option value="7">7 days</option>
          <option value="14" selected>14 days</option>
          <option value="30">30 days</option>
        </select></div>
    </div>
    <div class="field"><label for="note">Note</label>
      <input id="note" name="note" maxlength="200"
        placeholder="S26 core resident — confirmed with Elliot" />
      <div class="hint">For the other stewards. The invitee never sees it.</div></div>
    <label class="check"><input type="checkbox" name="override" value="1" />
      Send it even if the roster does not confirm them</label>
    <button class="btn solid" type="submit">Create invite</button>
  </form>

  ${section(`Sent (${rows.length})`, rows.length
    ? html`<table class="grid"><thead><tr>
        <th>Address</th><th>Status</th><th>Roster</th><th>By</th><th>Note</th><th></th>
      </tr></thead><tbody>
      ${rows.map((row) => html`<tr class="${row.status}">
        <td>${row.email}</td>
        <td>${inviteStatus(row)}</td>
        <td class="mono dim">${row.rosterVerdict || '—'}</td>
        <td class="mono dim">${row.invitedBy}</td>
        <td class="mono dim">${row.note || ''}</td>
        <td>${row.status === 'pending' && !row.expired
          ? html`<form method="post" action="/homeroom/stewards/invites/${row.id}/revoke">
              ${csrfField(ctx)}
              <button class="btn tiny" type="submit">Revoke</button></form>`
          : ''}</td>
      </tr>`)}
    </tbody></table>`
    : empty('None yet.'))}`;
}

function inviteStatus(row) {
  if (row.status === 'redeemed') {
    return html`<span class="pill answered">used${row.redeemedBy
      ? html` by ${memberLink(row.redeemedBy)}` : ''}</span>`;
  }
  if (row.status === 'revoked') return pill('revoked', 'locked');
  if (row.expired) return pill('expired', 'locked');
  return html`<span class="pill">live until ${stamp(row.expiresAt)}</span>`;
}
