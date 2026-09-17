/**
 * The intro engine's views.
 *
 * Three audiences, and the gaps between what they are shown are the feature.
 *
 *   Members    search the network, click to ask, and afterwards see four
 *              possible words about their own request. Never a decline.
 *   Targets    have no account, arrive from an email on a phone, and get one
 *              page with three buttons that POST.
 *   Stewards   see everything, because a connector who cannot see who said no
 *              cannot do the job.
 *
 * The member pages and the steward pages are separate functions rather than
 * one template with fields hidden. Hiding fields in a shared template is how a
 * field comes back six months later in an endpoint nobody re-read — which is
 * exactly how the mentor desk leaked booking links.
 *
 * The existing member-to-member intros live in pages.js and stay there. This
 * file is the outside-the-house half, and the index page labels the two as
 * "In the house" and "Outside the house", which is the distinction members
 * actually care about.
 */

import { html, raw } from '../util.js';
import { csrfField, section, empty, pill, relTime, stamp } from './components.js';
import { subnav as stewardSubnav, STEWARD_TABS } from './surfaces.js';
import { authLayout } from './layout.js';

const ASKS = [
  '20 minutes on a call',
  'A short written answer',
  'An async look at something',
  'One introduction onward',
];

export const INTRO_TABS = [
  { key: 'house', href: '/homeroom/intros', label: 'In the house' },
  { key: 'outside', href: '/homeroom/intros/search', label: 'Outside the house' },
  { key: 'mine', href: '/homeroom/intros/mine', label: 'Your requests' },
];

/* ---------------------------------------------------------------- member */

/**
 * The search box, and the results.
 *
 * Results carry evidence and the mutual they are reachable through, because
 * both are what makes a member's "why them" honest rather than invented. They
 * carry no score and no ranking badge: a member choosing by relevance to their
 * problem beats a member choosing by a number they cannot interpret.
 */
export function networkSearchPage(ctx, {
  query = '', search = null, people = [], running = false, error = null, flash = null,
  configured = true, budget = null, load = null,
}) {
  return html`<div class="pagehead">
    <div>
      <h1>Outside the house</h1>
      <p class="lede">Search the Haus network by what you need — a skill, a filing, a market, a
        machine. Everyone here is a real contact of somebody at Haus, and none of them has agreed
        to anything yet, which is why asking goes through a steward.</p>
    </div>
  </div>

  ${subnavRow('outside')}

  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  ${flash ? html`<div class="notice">${flash}</div>` : ''}

  ${!configured ? html`<div class="notice bad">Network search is not switched on yet. A steward
    needs to set <code>HOMEROOM_HAPPENSTANCE_KEY</code>.</div>` : ''}

  <form class="stack" method="post" action="/homeroom/intros/search">
    ${csrfField(ctx)}
    <label>Who are you looking for?
      <span class="dim">Describe the person by what they have done, not by a job title.</span>
      <input type="text" name="q" maxlength="300" required minlength="8" value="${query}"
        placeholder="someone who has taken a fermentation-derived ingredient through FDA GRAS self-affirmation" />
    </label>
    <div class="row">
      <button class="btn solid" type="submit" ${raw(configured ? '' : 'disabled')}>Search the network</button>
      ${budget ? html`<span class="mono dim tiny">${budget.spent} of ${budget.budget} search credits
        used this month. Repeat searches are free.</span>` : ''}
    </div>
  </form>

  ${running ? html`<div class="notice">Searching. This takes up to a minute.
    <a href="/homeroom/intros/search?s=${search?.id}&amp;q=${encodeURIComponent(query)}">Refresh</a>
    to see the results.</div>` : ''}

  ${search && search.state === 'complete' ? html`<div class="mono dim">
    ${people.length} ${people.length === 1 ? 'person' : 'people'} in the network
    ${search.created_at ? html`<span class="sep">/</span> searched ${relTime(search.created_at)}` : ''}
  </div>` : ''}

  ${load && load.open >= 1 ? html`<p class="mono dim tiny">You have ${load.open} request${load.open === 1 ? '' : 's'}
    in flight and have used ${load.monthly} of this month’s.</p>` : ''}

  ${people.length ? html`<ul class="rail-list wide">${people.map((person) => personCard(ctx, person))}</ul>`
    : search && search.state === 'complete'
      ? empty('Nobody in the network matched that. Try describing the problem rather than the role.')
      : ''}`;
}

function personCard(ctx, person) {
  return html`<li class="slot">
    <div class="mono">
      <b>${person.name}</b>
      ${person.title ? html`<span class="sep">/</span> ${person.title}` : ''}
      ${person.org ? html`<span class="sep">/</span> ${person.org}` : ''}
    </div>
    ${person.summary ? html`<div>${person.summary}</div>` : ''}
    ${person.evidence.length ? html`<ul class="tight small">${person.evidence.map((e) => html`<li class="dim">${e}</li>`)}</ul>` : ''}
    ${person.through.length
      ? html`<div class="mono dim tiny">Reachable through ${person.through.join(', ')}</div>`
      : html`<div class="mono dim tiny">No named mutual — a steward will work out who should send it.</div>`}
    <div class="row tight">
      <a class="btn solid" href="/homeroom/intros/ask/${person.id}">Introduce me</a>
      ${person.profile_url ? html`<a class="btn ghost" href="${person.profile_url}"
        rel="nofollow noopener" target="_blank">Profile</a>` : ''}
    </div>
  </li>`;
}

/**
 * The ask form.
 *
 * Minimum lengths are enforced because "can you intro me to investors" is not
 * an ask, it is a chore handed to the connector. The copy says plainly what
 * happens next, including the part members get wrong: the click sends nothing.
 */
export function introAskPage(ctx, { person, error = null, values = {} }) {
  return html`<div class="pagehead">
    <div>
      <h1>Ask for an introduction to ${person.name}</h1>
      <p class="lede">${person.title || ''}${person.title && person.org ? ', ' : ''}${person.org || ''}</p>
    </div>
  </div>

  ${error ? html`<div class="notice bad">${error}</div>` : ''}

  <div class="notice"><b>Nothing is sent when you submit this.</b> A steward reads it, decides
    whether to put their name on it, and asks ${person.name} privately whether they are open to an
    introduction.
    <br /><br />
    <b>You will hear back only if the answer is yes.</b> Until then this reads as still open, and it
    keeps reading that way whether we are mid-conversation or it did not come off. We will not tell
    you that ${person.name} said no, and we will not tell you when — a no that the person asking can
    see is a no that costs something to give, and then it stops being a real answer.</div>

  ${person.evidence.length ? section('Why the search picked them', html`<ul class="tight small">
    ${person.evidence.map((e) => html`<li class="dim">${e}</li>`)}</ul>`) : ''}

  <form class="stack" method="post" action="/homeroom/intros/ask/${person.id}">
    ${csrfField(ctx)}
    <label>What do you need? <span class="dim">Specific. This is what they read first.</span>
      <textarea name="need" rows="4" required minlength="40"
        placeholder="We are 6 weeks from a GRAS self-affirmation filing and cannot tell whether our expert panel needs a toxicologist on it."
        >${values.need || ''}</textarea>
    </label>
    <label>Why them? <span class="dim">What in their background made you pick them.</span>
      <textarea name="why_them" rows="2" required minlength="20">${values.why_them || ''}</textarea>
    </label>
    <label>What are you asking for?
      <select name="asking_for">
        ${ASKS.map((a) => html`<option value="${a}" ${raw(values.asking_for === a ? 'selected' : '')}>${a}</option>`)}
      </select>
    </label>
    <div class="row">
      <button class="btn solid" type="submit">Send it to a steward</button>
      <a class="btn ghost" href="/homeroom/intros/search">Back to the search</a>
    </div>
  </form>`;
}

/**
 * A member's own requests.
 *
 * Every row is a `memberView()`, so the four stages below are the complete
 * vocabulary. "Still open" is what a member sees when the target said no, when
 * the target said nothing, and when a steward declined to forward it, and it
 * is honest: the ask is still open and a steward is still on it.
 */
const STAGES = {
  introduced: ['introduced', 'ok'],
  'still open': ['still open', ''],
  withdrawn: ['withdrawn', ''],
};

export function introRequestsPage(ctx, { requests, outcomes = {} }) {
  return html`<div class="pagehead">
    <div>
      <h1>Your introduction requests</h1>
      <p class="lede">Outside the house. A request reads as still open until an introduction
        happens, whatever is going on behind it. We never report back on the person you named —
        that is what lets them answer honestly, and it is the reason any of them answer.</p>
    </div>
    <a class="btn ghost" href="/homeroom/intros/search">Search the network</a>
  </div>

  ${subnavRow('mine')}

  ${requests.length ? html`<ul class="rail-list wide">${requests.map((r) => {
    const [label, cls] = STAGES[r.stage] || [r.stage, ''];
    const outcome = outcomes[r.id];
    return html`<li class="slot">
      <div class="mono">
        <b>${r.name}</b>
        ${r.org ? html`<span class="sep">/</span> ${r.org}` : ''}
        <span class="sep">/</span> ${pill(label, cls)}
        <span class="sep">/</span> asked ${relTime(r.created_at)}
      </div>
      <div>${r.need}</div>
      ${r.introduced ? html`<form method="post" action="/homeroom/intros/mine/${r.id}/outcome" class="inline">
          ${csrfField(ctx)}
          <label class="check inline"><input type="checkbox" name="met" value="1"
            ${raw(outcome?.met ? 'checked' : '')} /> we met</label>
          <input type="text" name="note" maxlength="200" placeholder="what came of it"
            value="${outcome?.note || ''}" />
          <button class="btn ghost" type="submit">Log it</button>
        </form>` : ''}
      ${r.canWithdraw ? html`<form method="post" action="/homeroom/intros/mine/${r.id}/withdraw" class="inline">
          ${csrfField(ctx)}<button class="btn ghost" type="submit">Withdraw</button>
        </form>` : ''}
    </li>`;
  })}</ul>` : empty('No requests outside the house yet.')}`;
}

function subnavRow(active) {
  return raw(`<nav class="subnav">${INTRO_TABS
    .map((t) => `<a href="${t.href}" class="${t.key === active ? 'on' : ''}">${t.label}</a>`)
    .join('')}</nav>`);
}

/* ---------------------------------------------------------------- target */

/*
 * Everything below renders for somebody with no account, arriving from an
 * email. No nav, no session, nothing to sign into. Three buttons, all POST,
 * because mail gateways pre-fetch every URL in a message and a GET that
 * answers on their behalf is a scanner volunteering their time.
 */

function targetShell(title, content) {
  return authLayout({ path: '/homeroom', csrf: '' }, { title, content });
}

export function introPermissionPage({ request, member, token, connector }) {
  return targetShell('Worth an introduction?', html`
    <h1>Worth an introduction?</h1>
    <p class="lede">${member.name || member.user_id}${member.org ? html`, ${member.org}` : ''}
      is a founder at Biopunk, and ${connector} thinks you are the right person for what they are
      stuck on. They have not been told we wrote to you.</p>

    ${section('What they need', html`<p>${request.need}</p>
      ${request.why_them ? html`<p class="dim"><b>Why you:</b> ${request.why_them}</p>` : ''}
      ${member.working_on ? html`<p class="dim"><b>Working on:</b> ${member.working_on}</p>` : ''}
      <p class="mono dim">They are asking for ${request.asking_for || 'a short conversation'}.</p>`)}

    <form method="post" action="/homeroom/i/${token}/yes" class="stack">
      <button class="btn solid" type="submit">Yes, introduce us</button>
    </form>

    <form method="post" action="/homeroom/i/${token}/no" class="stack">
      <label>Not right now <span class="dim">— a line back, if you want. Optional, and they only
        ever see it if you write one.</span>
        <input type="text" name="note" maxlength="200" placeholder="Not my area, but happy to look at scale-up." />
      </label>
      <button class="btn ghost" type="submit">No thanks</button>
    </form>

    <form method="post" action="/homeroom/i/${token}/never" class="stack">
      <button class="btn ghost" type="submit">Never ask me about this again</button>
    </form>

    <p class="mono dim tiny">No is a normal answer and costs you nothing. We will not chase, we do
      not track whether you opened this, and "never" means never — you come off the list before
      anybody at Haus sees it again.</p>`);
}

export function introAnsweredPage({ decision }) {
  const copy = {
    yes: ['Sent', 'The introduction is going out now with both of you on it. Nothing else is needed from you.'],
    no: ['Noted', 'We have closed it. They are told the ask is still open, not that you said no, and we will not ask you about this one again.'],
    never: ['Done', 'You are off the list. Nobody at Haus will be shown your name for an introduction again.'],
  }[decision] || ['Done', 'Nothing else is needed from you.'];
  return targetShell(copy[0], html`<h1>${copy[0]}</h1><p class="lede">${copy[1]}</p>`);
}

export function introTokenGonePage({ reason }) {
  const copy = {
    unknown: ['That link has expired', 'It may have already been used, or the request was withdrawn. Nothing is needed from you.'],
    already: ['You have already answered', 'Your answer is recorded and nothing else is needed from you.'],
  }[reason] || ['That link no longer works', 'Nothing is needed from you.'];
  return targetShell(copy[0], html`<h1>${copy[0]}</h1><p class="lede">${copy[1]}</p>`);
}

/* --------------------------------------------------------------- steward */

/**
 * The queue.
 *
 * The permission form shows the exact outgoing text before it is sent, not a
 * preview of a template. A steward who cannot read the words that will arrive
 * in somebody's inbox is not meaningfully consenting on the connector's
 * behalf, and the gate becomes decorative.
 */
export function introStewardPage(ctx, { queue, closed, stats, balance, error = null, flash = null, preview = null }) {
  return html`<div class="pagehead">
    <div>
      <h1>Introductions</h1>
      <p class="lede">Members find people in the network and ask. Nothing reaches anybody until you
        click. Your name is on every message that goes out.</p>
    </div>
  </div>

  ${stewardSubnav(STEWARD_TABS, 'intros')}

  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  ${flash ? html`<div class="notice">${flash}</div>` : ''}

  ${!stats.configured ? html`<div class="notice bad">No Happenstance key is set, so members cannot
    search. Existing requests still work.</div>` : ''}

  ${stats.stuckAfterYes ? html`<div class="notice bad"><b>${stats.stuckAfterYes} said yes and have
    not been introduced.</b> This is the one number that should always be zero — a yes that goes
    nowhere is the worst outcome the engine has.</div>` : ''}

  <div class="statstrip">
    <span><b>${stats.waitingOnSteward}</b> waiting on you</span>
    <span><b>${stats.waitingOnTarget}</b> waiting on a reply</span>
    <span><b>${stats.yesRate === null ? '—' : `${stats.yesRate}%`}</b> say yes</span>
    <span><b>${stats.neverAskAgain}</b> never ask again</span>
    <span><b>${stats.thisWeek}/${stats.weeklyCap}</b> asked this week</span>
    <span><b>${balance === null ? '—' : balance}</b> credits left</span>
  </div>

  ${stats.thisWeek >= stats.weeklyCap ? html`<div class="notice bad">The weekly cap is reached.
    That is a rate limit on the connector's reputation, not a bug — these wait.</div>` : ''}

  ${preview ? previewPanel(ctx, preview) : ''}

  ${section(`Waiting on you (${queue.filter((r) => r.status === 'requested').length})`,
    renderQueue(ctx, queue.filter((r) => r.status === 'requested'), 'requested'))}

  ${section(`Waiting on a reply (${queue.filter((r) => r.status === 'permission_sent').length})`,
    renderQueue(ctx, queue.filter((r) => r.status === 'permission_sent'), 'permission_sent'))}

  ${section(`Said yes, not yet introduced (${queue.filter((r) => r.status === 'agreed').length})`,
    renderQueue(ctx, queue.filter((r) => r.status === 'agreed'), 'agreed'))}

  ${section('Recently closed', closed.length
    ? html`<ul class="rail-list wide">${closed.map((r) => html`<li class="slot">
      <div class="mono"><b>${r.name}</b>
        <span class="sep">/</span> ${pill(r.status.replace('_', ' '), r.status === 'introduced' ? 'ok' : '')}
        <span class="sep">/</span> for ${r.member_id}
        <span class="sep">/</span> ${relTime(r.updated_at)}</div>
      ${r.answer_note ? html`<div class="dim">They said: ${r.answer_note}</div>` : ''}
    </li>`)}</ul>`
    : empty('Nothing closed yet.'))}`;
}

function renderQueue(ctx, rows, kind) {
  if (!rows.length) {
    return empty(kind === 'requested' ? 'Nothing waiting on you.'
      : kind === 'agreed' ? 'Nobody is waiting on an introduction.'
        : 'Nobody has been left waiting.');
  }
  return html`<ul class="rail-list wide">${rows.map((r) => html`<li class="slot">
    <div class="mono"><b>${r.name}</b>
      ${r.title ? html`<span class="sep">/</span> ${r.title}` : ''}
      ${r.org ? html`<span class="sep">/</span> ${r.org}` : ''}
      <span class="sep">/</span> for <a href="/homeroom/p/${r.member_id}">${r.member_id}</a>
      <span class="sep">/</span> ${relTime(r.created_at)}</div>
    <div>${r.need}</div>
    ${r.why_them ? html`<div class="dim"><b>Why them:</b> ${r.why_them}</div>` : ''}
    ${r.through.length ? html`<div class="mono dim tiny">Reachable through ${r.through.join(', ')}</div>` : ''}
    ${r.profile_url ? html`<div class="mono tiny"><a href="${r.profile_url}" rel="nofollow noopener"
      target="_blank">Profile</a></div>` : ''}

    ${kind === 'requested' ? html`<form method="post" action="/homeroom/stewards/intros/${r.id}/compose" class="inline">
        ${csrfField(ctx)}
        <input type="email" name="to" maxlength="200" required placeholder="their email address" />
        <button class="btn solid" type="submit">Read the message before it goes</button>
      </form>
      <form method="post" action="/homeroom/stewards/intros/${r.id}/refuse" class="inline">
        ${csrfField(ctx)}
        <input type="text" name="note" maxlength="200" placeholder="why not (the member never sees this)" />
        <button class="btn ghost" type="submit">Not this one</button>
      </form>` : ''}

    ${kind === 'permission_sent' ? html`<div class="mono dim tiny">
      Asked ${relTime(r.sent_at)} ${r.token_expires ? html`<span class="sep">/</span> ages out ${stamp(r.token_expires)}` : ''}
      <span class="sep">/</span> <a href="/homeroom/stewards/intros/${r.id}/audit">Trail</a></div>` : ''}

    ${kind === 'agreed' ? html`<form method="post" action="/homeroom/stewards/intros/${r.id}/introduce" class="inline">
        ${csrfField(ctx)}
        <button class="btn solid" type="submit">Send the introduction</button>
        <span class="mono dim tiny">They said yes ${relTime(r.answered_at)}</span>
      </form>
      ${r.answer_note ? html`<div class="dim">They said: ${r.answer_note}</div>` : ''}` : ''}
  </li>`)}</ul>`;
}

function previewPanel(ctx, { request, to, subject, text }) {
  return html`<div class="panel">
    <h2 class="mono">Exactly what ${request.name} will receive</h2>
    <p class="mono dim tiny">To ${to} <span class="sep">/</span> subject: ${subject}</p>
    <form method="post" action="/homeroom/stewards/intros/${request.id}/permission" class="stack">
      ${csrfField(ctx)}
      <input type="hidden" name="to" value="${to}" />
      <pre class="prose small">${text}</pre>
      <div class="row">
        <button class="btn solid" type="submit">Send it</button>
        <a class="btn ghost" href="/homeroom/stewards/intros">Cancel</a>
      </div>
    </form>
  </div>`;
}

export function introAuditPage(ctx, { request, events }) {
  return html`<div class="pagehead">
    <div>
      <h1>${request.name}</h1>
      <p class="lede">Why this person was contacted, in order. Stewards only, never shown to a member.</p>
    </div>
    <a class="btn ghost" href="/homeroom/stewards/intros">Back to the queue</a>
  </div>

  ${section('The request', html`<div class="mono">for ${request.member_id}
    <span class="sep">/</span> ${pill(request.status.replace('_', ' '))}</div>
    <div>${request.need}</div>
    ${request.why_them ? html`<div class="dim"><b>Why them:</b> ${request.why_them}</div>` : ''}`)}

  ${section('The trail', events.length ? html`<ul class="rail-list wide">${events.map((e) => html`<li>
    <div class="mono"><b>${e.event}</b>
      <span class="sep">/</span> ${e.actor_kind}${e.actor_id ? html` ${e.actor_id}` : ''}
      <span class="sep">/</span> ${stamp(e.created_at)}</div>
    ${e.detail ? html`<div class="dim small">${e.detail}</div>` : ''}
  </li>`)}</ul>` : empty('Nothing recorded.'))}`;
}

