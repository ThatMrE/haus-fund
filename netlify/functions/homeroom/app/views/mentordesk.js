/**
 * Mentor desk views.
 *
 * Two audiences that never overlap. Members are signed in and see Homeroom
 * chrome; mentors have no account at all and see the pre-login chrome, having
 * arrived from an email on a phone. Keeping them in one file makes the
 * difference visible — the mentor pages below take no `ctx.user` and render
 * nothing that assumes a session.
 */

import { html, raw } from '../util.js';
import { csrfField, section, empty, pill, relTime, stamp } from './components.js';
import { MENTOR_TRACKS } from '../data/mentors.js';
import { authLayout } from './layout.js';

const ASKS = [
  '30 minutes on a call',
  'An async look at something',
  'One introduction',
  'A short written answer',
];

/* ---------------------------------------------------------------- member */

/**
 * The request form.
 *
 * Headed by what this mentor actually covers, because the most common reason a
 * mentor declines is being asked about something they do not do — which is a
 * routing failure, not a mentor failure, and the cheapest place to fix it is
 * before the member types.
 */
export function requestFormPage(ctx, { mentor, capacity, error = null, values = {} }) {
  const topics = mentor.tags.length ? mentor.tags.join(', ') : mentor.role;
  return html`<div class="pagehead">
    <div>
      <h1>Ask ${mentor.name} for time</h1>
      <p class="lede"><b>${mentor.name} helps with ${topics}.</b> If that is not what you need,
        they are the wrong person — a steward can find you a better one, and it costs everybody
        less than a decline.</p>
    </div>
  </div>

  ${error ? html`<div class="notice bad">${error}</div>` : ''}

  <div class="notice">They take up to ${capacity.cap} sessions a month and have
    ${capacity.cap - capacity.used} left. They see this request in an email and answer yes or no;
    you will hear either way.</div>

  <form method="post" action="/homeroom/mentor/${mentor.slug}/request" class="stack">
    ${csrfField(ctx)}

    <label>What is this about?
      <select name="track">
        ${MENTOR_TRACKS.map((t) => html`<option value="${t.slug}"
          ${raw(values.track === t.slug ? 'selected' : '')}>${t.label}</option>`)}
      </select>
    </label>

    <label>What do you need? <span class="dim">Be specific. This is what they read first.</span>
      <textarea name="need" rows="4" required minlength="40"
        placeholder="We are 6 weeks from a GRAS self-affirmation filing and cannot tell whether our expert panel needs a toxicologist."
        >${values.need || ''}</textarea>
    </label>

    <label>Why them? <span class="dim">What in their background made you pick them.</span>
      <textarea name="why_them" rows="2" required minlength="20"
        >${values.why_them || ''}</textarea>
    </label>

    <label>What have you already tried? <span class="dim">The fastest way past the first ten minutes.</span>
      <textarea name="tried" rows="2">${values.tried || ''}</textarea>
    </label>

    <label>What are you asking for?
      <select name="asking_for">
        ${ASKS.map((a) => html`<option value="${a}"
          ${raw(values.asking_for === a ? 'selected' : '')}>${a}</option>`)}
      </select>
    </label>

    <div class="row">
      <button class="btn solid" type="submit">Send the request</button>
      <a class="btn ghost" href="/homeroom/mentor/${mentor.slug}">Back</a>
    </div>
  </form>`;
}

const REQUEST_STATE = {
  sent: ['waiting on them', ''],
  accepted: ['accepted', 'ok'],
  declined: ['passed', ''],
  expired: ['no answer', ''],
  withdrawn: ['withdrawn', ''],
};

export function myRequestsPage(ctx, { requests }) {
  return html`<div class="pagehead">
    <div>
      <h1>Your mentor requests</h1>
      <p class="lede">A booking link appears here once a mentor says yes, and expires after a
        couple of weeks. Log what came of it — it is the only way anyone knows whether the desk
        works.</p>
    </div>
    <a class="btn ghost" href="/homeroom/mentors">Find a mentor</a>
  </div>

  ${requests.length ? html`<ul class="rail-list wide">${requests.map((r) => {
    const [label, cls] = REQUEST_STATE[r.state] || [r.state, ''];
    return html`<li class="slot">
      <div class="mono">
        <a href="/homeroom/mentor/${r.mentor_slug}"><b>${r.mentor_name}</b></a>
        ${r.mentor_org ? html`<span class="sep">/</span> ${r.mentor_org}` : ''}
        <span class="sep">/</span> ${pill(label, cls)}
        <span class="sep">/</span> asked ${relTime(r.created_at)}
      </div>
      <div>${r.need}</div>
      ${r.state === 'declined' && r.decline_note
        ? html`<div class="dim">They said: ${r.decline_note}</div>` : ''}
      ${r.state === 'accepted' && r.grant
        ? html`<div class="row tight">
            <a class="btn solid" href="/homeroom/mentor/${r.mentor_slug}/book/${r.grant.id}">
              Book with ${r.mentor_name}</a>
            <span class="mono dim tiny">link expires ${stamp(r.grant.expires_at)}</span>
          </div>` : ''}
      ${r.state === 'accepted' && !r.grant
        ? html`<div class="mono dim tiny">That booking link has expired. Ask again if you still
            need the time.</div>` : ''}
      ${['accepted', 'declined', 'expired'].includes(r.state)
        ? html`<form method="post" action="/homeroom/mentor/request/${r.id}/outcome" class="inline">
            ${csrfField(ctx)}
            <label class="check inline"><input type="checkbox" name="met" value="1"
              ${raw(r.outcome?.met ? 'checked' : '')} /> we met</label>
            <input type="text" name="note" maxlength="200" placeholder="what came of it"
              value="${r.outcome?.note || ''}" />
            <button class="btn ghost" type="submit">Log it</button>
          </form>` : ''}
      ${r.state === 'sent'
        ? html`<form method="post" action="/homeroom/mentor/request/${r.id}/withdraw" class="inline">
            ${csrfField(ctx)}<button class="btn ghost" type="submit">Withdraw</button>
          </form>` : ''}
    </li>`;
  })}</ul>` : empty('No mentor requests yet.')}`;
}

/* ---------------------------------------------------------------- mentor */

/*
 * Everything below renders for someone with no account, arriving from an email.
 * No nav, no session, nothing to sign in to. `authLayout` is the pre-login
 * chrome the sign-in and reset pages already use.
 */

function mentorShell(title, content) {
  return authLayout({ path: '/homeroom', csrf: '' }, { title, content });
}

export function mentorRequestPage({ mentor, request, member, capacity, token }) {
  return mentorShell('A request for your time', html`
    <h1>A Biopunk resident asked for time</h1>
    <p class="lede">${member.name || member.user_id}${member.org ? html`, ${member.org}` : ''}
      would like ${request.asking_for || 'some time'} with you.</p>

    ${section('What they need', html`<p>${request.need}</p>
      ${request.why_them ? html`<p class="dim"><b>Why you:</b> ${request.why_them}</p>` : ''}
      ${request.tried ? html`<p class="dim"><b>Already tried:</b> ${request.tried}</p>` : ''}`)}

    <p class="mono dim">You are at ${capacity.used} of ${capacity.cap} sessions this month.</p>

    <form method="post" action="/homeroom/m/${token}/accept" class="stack">
      <button class="btn solid" type="submit">Yes, send them my booking link</button>
    </form>

    <form method="post" action="/homeroom/m/${token}/decline" class="stack">
      <label>Not this one <span class="dim">— a line back to them, if you want. Optional.</span>
        <input type="text" name="note" maxlength="200"
          placeholder="Not my area, but happy to look at scale-up questions." />
      </label>
      <button class="btn ghost" type="submit">Pass on this one</button>
    </form>

    <form method="post" action="/homeroom/m/${token}/later" class="stack">
      <button class="btn ghost" type="submit">Not right now — pause me for 30 days</button>
    </form>

    <p class="mono dim tiny">Saying no costs you nothing and we will not ask you about this one
      again. Your booking link is only ever shown to a member after you accept, and the link we
      give them expires — though we cannot stop someone who has already opened it from saving it.</p>`);
}

export function mentorAnsweredPage({ mentor, decision, paused = false }) {
  const copy = {
    accept: ['Sent', 'They have your booking link now. It works for the next couple of weeks and only for them.'],
    decline: ['Noted', 'We have told them you are not able to take this one. Nothing else is needed from you.'],
    later: ['Paused', 'We have told them, and we will not send you requests for the next 30 days.'],
  }[decision] || ['Done', 'Nothing else is needed from you.'];
  return mentorShell(copy[0], html`
    <h1>${copy[0]}</h1>
    <p class="lede">${copy[1]}</p>
    ${paused ? html`<p class="mono dim">Anyone already holding a link from you keeps it — pausing
      stops new requests, it does not cancel a yes you already gave.</p>` : ''}
    <p class="mono dim">Thank you. ${mentor?.name ? '' : ''}</p>`);
}

export function mentorTokenGonePage({ reason }) {
  const copy = {
    unknown: ['That link is not valid', 'It may have been used already, or the request was withdrawn.'],
    already: ['You already answered this one', 'Nothing else is needed. If you meant to change your answer, reply to the email and a steward will sort it out.'],
    'at-capacity': ['That month is full', 'Someone else took the last slot before you answered. The member has been told, and they can ask again next month.'],
  }[reason] || ['That link is not valid', 'It may have been used already.'];
  return mentorShell(copy[0], html`
    <h1>${copy[0]}</h1>
    <p class="lede">${copy[1]}</p>`);
}

/* ------------------------------------------------------- the grant redirect */

export function grantGonePage(ctx, { mentor, reason }) {
  const copy = {
    expired: 'That booking link has expired.',
    revoked: 'That booking link was withdrawn.',
    'not-yours': 'That booking link belongs to somebody else.',
    'no-scheduler': 'There is no booking link on file for them right now.',
    unknown: 'That booking link is not valid.',
  }[reason] || 'That booking link is not valid.';
  return html`<div class="pagehead"><div>
    <h1>Link no longer works</h1>
    <p class="lede">${copy}</p>
  </div></div>
  <p>${mentor
    ? html`<a class="btn" href="/homeroom/mentor/${mentor.slug}">Ask ${mentor.name} again</a>`
    : html`<a class="btn" href="/homeroom/mentors">Back to the mentors</a>`}</p>`;
}

/* --------------------------------------------------------------- steward */

/**
 * Gate A: the queue of people nobody has ruled on yet.
 *
 * The whole submission is shown, not a summary. A steward is deciding whether
 * to put a stranger in front of members, and the fields they most need are the
 * ones a summary drops — the bio in full, the org, and whether there is a
 * booking link at all.
 */
export function mentorAdminPage(ctx, { pending, status, stuck, roster, error = null, flash = null }) {
  const last = status.last;
  return html`<div class="pagehead">
    <div>
      <h1>Mentor desk</h1>
      <p class="lede">Every submission from the onboarding form lands here and is listed nowhere
        until you rule on it. The form is a public URL, so this queue is the only thing between
        it and the roster.</p>
    </div>
    <form method="post" action="/homeroom/stewards/mentors/sync">
      ${csrfField(ctx)}
      <button class="btn ghost" type="submit" ${raw(status.configured ? '' : 'disabled')}>Sync now</button>
    </form>
  </div>

  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  ${flash ? html`<div class="notice">${flash}</div>` : ''}

  ${!status.configured ? html`<div class="notice bad">No Airtable token is set, so the form does
    not reach Homeroom. Set <code>HOMEROOM_MENTOR_SYNC_TOKEN</code> or
    <code>AIRTABLE_TOKEN</code>.</div>` : ''}

  <div class="statrow">
    ${Object.entries(roster).map(([state, n]) => html`<div class="stat">
      <b>${n}</b><span>${state}</span></div>`)}
  </div>

  <p class="mono dim">${last
    ? html`Last sync ${relTime(last.at)}: ${last.ok
        ? html`${last.seen} seen, ${last.created} new, ${last.updated} updated`
        : html`<b>failed</b> — ${last.error}`}`
    : 'No sync has run in this container yet.'}</p>

  ${section(`Waiting on a steward (${pending.length})`, pending.length
    ? html`<ul class="rail-list wide">${pending.map((m) => html`<li class="slot">
        <div class="mono"><b>${m.name}</b>
          ${m.role ? html`<span class="sep">/</span> ${m.role}` : ''}
          ${m.org ? html`<span class="sep">/</span> ${m.org}` : ''}
          <span class="sep">/</span> ${m.track}
          <span class="sep">/</span> up to ${m.capacity || 2} a month
          <span class="sep">/</span> ${m.consent_mode}</div>
        ${m.bio ? html`<div>${m.bio}</div>` : html`<div class="dim">No bio given.</div>`}
        <div class="tagrow">${String(m.tags || '').split(',').filter(Boolean)
          .map((t) => html`<span class="tag ghost">${t}</span>`)}</div>
        <form method="post" action="/homeroom/stewards/mentors/${m.id}/rule" class="inline">
          ${csrfField(ctx)}
          <input type="text" name="note" maxlength="300" placeholder="why (required to reject)" />
          <button class="btn solid" type="submit" name="decision" value="list">List them</button>
          <button class="btn ghost" type="submit" name="decision" value="reject">Reject</button>
        </form>
      </li>`)}</ul>`
    : empty('Nothing waiting. New form submissions appear here within six hours.'))}

  ${section(`Waiting on a mentor (${stuck.length})`, stuck.length
    ? html`<ul class="rail-list wide">${stuck.map((r) => html`<li class="slot">
        <div class="mono"><a href="/homeroom/mentor/${r.mentor_slug}">${r.mentor_name}</a>
          <span class="sep">/</span> asked ${relTime(r.created_at)}
          <span class="sep">/</span> by ${r.member_id}</div>
      </li>`)}</ul>`
    : empty('No requests have been left sitting.'))}`;
}
