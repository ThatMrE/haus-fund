/* Every Homeroom page. Server-rendered strings, same as the news side. */

import { html, raw, plural } from '../util.js';
import {
  ORG_KINDS, ORG_STAGES, FUNDER_KINDS, PIPELINE_STATUSES, MENTOR_TRACKS,
  DEAL_CATEGORIES, JOB_DISCIPLINES, EVENT_KINDS, LIBRARY_KINDS, EXPERTISE_SUGGESTIONS,
  labelFor, tagList,
} from '../models.js';
import {
  avatar, memberLink, memberCard, stars, pill, body, empty, pager,
  filterBar, csrfField, select, section, when, stamp, relTime, snippet,
} from './components.js';
import { HOMEROOM_TAGLINE } from './layout.js';
import { TRACKS } from '../data/curriculum.js';

const PER_PAGE = 20;

/* ------------------------------------------------------------------- gate */

export function gatePage(ctx, { stats }) {
  return html`<div class="gate">
    <div class="over">Members only</div>
    <h1>Homeroom</h1>
    <p class="lede">The room behind the residency. Everything the public site cannot hold:
      what a reagent actually costs, which funder returns calls, who has a spare minus-80 in
      Lisbon, and the questions you would not put your name to in public.</p>
    <ul class="gatelist">
      <li><b>Yearbook</b> every founder, every cohort — what they are building and what they were before.</li>
      <li><b>Labs</b> the Global Biolab Atlas: ${stats.atlas} community and open-science labs, ${stats.atlasActive} confirmed open. Plus the Core Facility Finder.</li>
      <li><b>Perks</b> ${stats.deals} programmes across every category of startup support, from cloud credits to gene synthesis to non-dilutive capital.</li>
      <li><b>Funders</b> ${stats.funders} on the capital map with ${stats.reviews} member-written reviews. Rated on speed, value, terms and whether they would raise again.</li>
      <li><b>Mentors</b> ${stats.vetted} vetted mentors of ${stats.mentors}, bookable straight on their calendar.</li>
      <li><b>Library</b> the Biopunk Founder Manual: ${stats.modules} modules across six tracks, each ending in something you actually produced.</li>
      <li><b>Jobs and events</b> the rest of the scaffolding.</li>
    </ul>
    <p class="fineprint">Accounts are for people on the Biopunk programme roster — residents,
      alumni, and anyone holding an accepted place. Sign up with the email address on your
      application and it is checked against that roster.</p>
    <div class="gateactions">
      <a class="btn solid" href="/homeroom/signup">Create an account</a>
      <a class="btn ghost" href="/homeroom/login">Sign in</a>
      <a class="btn ghost" href="/">Back to Haus</a>
    </div>
    <p class="fineprint">Homeroom is never indexed, and nothing inside it is visible to a
      logged-out visitor.</p>
  </div>`;
}

/* ------------------------------------------------------------------ auth */

export function loginPage(ctx, { values = {}, error = null, next = '/homeroom' }) {
  return html`<h1>Sign in</h1>
  <p class="lede">Homeroom is the members-only side of Haus.</p>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/login">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <input type="hidden" name="next" value="${next}" />
    <div class="field"><label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required autofocus
        value="${values.email || ''}" /></div>
    <div class="field"><label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required /></div>
    <button class="btn solid wide" type="submit">Sign in</button>
  </form>
  <div class="alt">
    <a href="/homeroom/signup">Create an account</a>
    <a href="/homeroom/forgot">Forgot your password?</a>
  </div>`;
}

export function signupPage(ctx, { values = {}, error = null, mode = 'open' }) {
  return html`<h1>Create an account</h1>
  <p class="lede">Residents and alumni of the Biopunk programme. One account covers all of
    Homeroom.</p>
  ${mode === 'roster' ? html`<div class="notice">Use the email address on your application. It is
    checked against the programme roster, so a different address will not be recognised even if it
    is yours.</div>` : ''}
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/signup">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <div class="field"><label for="handle">Handle</label>
      <input id="handle" name="handle" required autofocus minlength="2" maxlength="20"
        pattern="[A-Za-z0-9_-]{2,20}" value="${values.handle || ''}" placeholder="ada-fell" />
      <div class="hint">2 to 20 characters: letters, numbers, dashes and underscores. This is how
        the rest of Homeroom will see you, and it cannot be changed later.</div></div>
    <div class="field"><label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required
        value="${values.email || ''}" />
      <div class="hint">Used to sign in and to reset your password. Never shown to other members.</div></div>
    <div class="field"><label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password"
        required minlength="10" />
      <div class="hint">At least 10 characters. Longer beats complicated.</div></div>
    <button class="btn solid wide" type="submit">Create account</button>
  </form>
  <div class="alt"><a href="/homeroom/login">I already have an account</a></div>`;
}

/*
 * The three ways the front door can say no.
 *
 * They are separate pages because they are separate situations, and a member
 * standing in front of one needs to know which: "we cannot check right now" and
 * "you are not on the list" call for completely different next actions, and
 * collapsing them into one message would leave a real resident guessing.
 */

/** Denied, or held for review. One page for both, and for found and not-found. */
export function notOnRosterPage(ctx, { email }) {
  return html`<h1>Residents only</h1>
  <p class="lede">Homeroom is open to people who are on the Biopunk programme roster —
    residents, alumni, and anyone with an accepted place. <b>${email}</b> is not showing as one of
    them.</p>
  <p>Two things are worth checking before anything else:</p>
  <ul class="rules">
    <li><b>The address.</b> Use the one on your application. If you applied with a university
      address and signed up with a personal one, the roster will not match them.</li>
    <li><b>The timing.</b> Records are updated by hand. If you were accepted in the last day or two
      it may not have reached the roster yet.</li>
  </ul>
  <p>If both look right, mail <a href="mailto:hello@haus.fund">hello@haus.fund</a> and a
    steward will check it against the programme records. Say which address you applied with.</p>
  <div class="alt"><a href="/homeroom/login">I already have an account</a></div>`;
}

/** The roster is unreachable. Our problem, and it should read like our problem. */
export function rosterUnavailablePage(ctx, { values = {} }) {
  return html`<h1>Try again shortly</h1>
  <p class="lede">We could not reach the programme roster just now, so we cannot confirm your
    place — and we would rather make you wait than guess.</p>
  <p>Nothing you typed was saved. Try again in a few minutes; if it keeps happening, mail
    <a href="mailto:hello@haus.fund">hello@haus.fund</a>.</p>
  <form class="stack" method="get" action="/homeroom/signup">
    <button class="btn solid wide" type="submit">Back to signup</button>
  </form>
  ${values.handle ? html`<p class="mono dim">Your handle, so you do not have to remember it:
    ${values.handle}</p>` : ''}`;
}

export function signupClosedPage() {
  return html`<h1>Accounts are closed</h1>
  <p class="lede">Homeroom is not taking new accounts at the moment. A steward creates them
    directly during onboarding.</p>
  <p>If you are a resident and do not have one, mail
    <a href="mailto:hello@haus.fund">hello@haus.fund</a>.</p>
  <div class="alt"><a href="/homeroom/login">I already have an account</a></div>`;
}

/** An existing account whose place has since been rescinded. */
export function accessRevokedPage() {
  return html`<h1>Access ended</h1>
  <p class="lede">This account is no longer on the programme roster, so it cannot open Homeroom.
    Everything you wrote stays where it is.</p>
  <p>If that is wrong — and it can be, the roster is maintained by hand — mail
    <a href="mailto:hello@haus.fund">hello@haus.fund</a> and a steward will look at it.</p>
  <div class="alt"><a href="/">Back to Haus</a></div>`;
}

/* --------------------------------------------------------------- joining */

export function joinPage(ctx, { token, invite, values = {}, error = null }) {
  return html`<h1>Join Homeroom</h1>
  <p class="lede">${invite.invitedBy
    ? html`<b>${invite.invitedBy}</b> invited you.`
    : 'You have been invited.'} Pick a handle and a password and you are in.</p>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/join/${token}">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <div class="field"><label>Email</label>
      <input value="${invite.email}" disabled />
      <div class="hint">Fixed by the invite. Sign in with this address afterwards.</div></div>
    <div class="field"><label for="handle">Handle</label>
      <input id="handle" name="handle" value="${values.handle || ''}" required
        minlength="2" maxlength="20" autofocus autocomplete="username" />
      <div class="hint">2–20 characters: letters, numbers, dashes and underscores. This is how
        you appear everywhere, and it cannot be changed later.</div></div>
    <div class="field"><label for="password">Password</label>
      <input id="password" name="password" type="password" required minlength="10"
        autocomplete="new-password" />
      <div class="hint">At least 10 characters. Longer beats complicated.</div></div>
    <div class="field"><label for="confirm">Password again</label>
      <input id="confirm" name="confirm" type="password" required autocomplete="new-password" /></div>
    <button class="btn solid wide" type="submit">Create my account</button>
  </form>
  <div class="alt"><a href="/homeroom/login">I already have an account</a></div>`;
}

/** Expired, revoked, already used, or never existed — all one page, on purpose. */
export function inviteDeadPage(invite = null) {
  const spent = invite && invite.status === 'redeemed';
  return html`<h1>${spent ? 'That invite has been used' : 'This invite is not usable'}</h1>
  <p class="lede">${spent
    ? 'An account was already created with this link. If that was you, sign in.'
    : 'Invite links expire, and a steward can revoke one. This one is no longer live.'}</p>
  <p>Mail <a href="mailto:hello@haus.fund">hello@haus.fund</a> and a steward will send a new one.
    Say which address the invite went to.</p>
  <div class="alt"><a href="/homeroom/login">Sign in</a></div>`;
}

/** The roster says this person's place ended between the invite and the click. */
export function inviteRevokedPage() {
  return html`<h1>This invite is no longer valid</h1>
  <p class="lede">The programme roster no longer lists this address as holding a place, so the
    invite cannot be used.</p>
  <p>If that is wrong — and it can be, the roster is maintained by hand — mail
    <a href="mailto:hello@haus.fund">hello@haus.fund</a> and a steward will look at it.</p>
  <div class="alt"><a href="/">Back to Haus</a></div>`;
}

/** Our problem, and it should read like our problem. */
export function inviteUnavailablePage(detail = '') {
  return html`<h1>Try again shortly</h1>
  <p class="lede">We could not check your invite just now. Nothing you typed was saved, and the
    invite has not been used up.</p>
  ${detail ? html`<p class="mono dim">${detail}</p>` : ''}
  <p>Try again in a few minutes. If it keeps happening, mail
    <a href="mailto:hello@haus.fund">hello@haus.fund</a>.</p>`;
}

/**
 * The invite was spent but the account could not be made.
 *
 * The worst state in this flow, so it gets its own page rather than a generic
 * error: the person cannot retry with the same link, and only a steward can fix
 * it. Saying that plainly beats a 500.
 */
export function joinFailedPage(detail, invite) {
  return html`<h1>Could not finish creating your account</h1>
  <p class="lede">Your invite has been used up, but the account was not created. This is our
    fault, not yours.</p>
  ${detail ? html`<p class="mono dim">${detail}</p>` : ''}
  <p>Mail <a href="mailto:hello@haus.fund">hello@haus.fund</a>${invite?.invitedBy
    ? html` — or tell <b>${invite.invitedBy}</b>, who invited you` : ''} and ask for a new link.
    Quote this address: <b>${invite?.email || 'the one the invite went to'}</b>.</p>`;
}

export function forgotPage(ctx, { error = null, values = {} }) {
  return html`<h1>Reset your password</h1>
  <p class="lede">We will email you a link that lets you set a new one. It works once and
    expires in an hour.</p>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/forgot">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <div class="field"><label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required autofocus
        value="${values.email || ''}" /></div>
    <button class="btn solid wide" type="submit">Send the link</button>
  </form>
  <div class="alt"><a href="/homeroom/login">Back to sign in</a></div>`;
}

/**
 * The same answer whether or not the address has an account. Whether someone is
 * a member here is not something a stranger gets to find out by guessing.
 */
export function forgotSentPage(ctx, { email, link = null }) {
  return html`<h1>Check your email</h1>
  <p class="lede">If ${email} has a Homeroom account, a reset link is on its way. It works once
    and expires in an hour.</p>
  ${link ? html`<div class="notice">
    <b>No mail sender is configured</b>, so the link could not be sent. A steward can find it in
    the function log, or use this one:
    <div class="code" style="margin-top:10px"><a href="${link}">${link}</a></div>
  </div>` : ''}
  <div class="alt">
    <a href="/homeroom/login">Back to sign in</a>
    <a href="/homeroom/forgot">Ask again</a>
  </div>`;
}

export function resetPage(ctx, { token, error = null, tokenHash = '', supabase = false }) {
  return html`<h1>Choose a password</h1>
  <p class="lede">This replaces the old one, and signs out every other session.</p>
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/reset" id="reset-form">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <input type="hidden" name="token" value="${token}" />
    ${supabase ? html`
      <input type="hidden" name="token_hash" value="${tokenHash}" />
      <input type="hidden" name="access_token" id="reset-access-token" value="" />` : ''}
    <div class="field"><label for="password">New password</label>
      <input id="password" name="password" type="password" autocomplete="new-password"
        required minlength="10" autofocus />
      <div class="hint">At least 10 characters.</div></div>
    <div class="field"><label for="confirm">New password again</label>
      <input id="confirm" name="confirm" type="password" autocomplete="new-password" required /></div>
    <button class="btn solid wide" type="submit">Save password</button>
  </form>
  ${supabase ? resetFragmentScript() : ''}`;
}

/**
 * Move a recovery token out of the URL fragment and into the form.
 *
 * Supabase's default recovery email uses the implicit flow, which returns the
 * token after a `#`. A fragment is never sent to a server — that is the whole
 * point of one — so a server-rendered page cannot see it without this. The
 * token goes into a hidden field, the fragment is wiped from the address bar so
 * it stays out of history and out of any Referer header, and the password is
 * submitted normally.
 *
 * Projects whose email template carries a `token_hash` instead never run this:
 * that token arrives as a query parameter the server can verify directly, which
 * is the better of the two and the one worth configuring.
 */
function resetFragmentScript() {
  return raw(`<script>
(function () {
  var hash = window.location.hash || '';
  if (hash.indexOf('access_token=') === -1) return;
  var params = new URLSearchParams(hash.slice(1));
  var token = params.get('access_token');
  if (!token) return;
  var field = document.getElementById('reset-access-token');
  if (field) field.value = token;
  history.replaceState(null, '', window.location.pathname);
})();
</script>`);
}

/**
 * The project requires a confirmed address, so the account exists but has no
 * key yet. Saying this plainly beats a sign-in that fails for no visible reason.
 */
export function confirmEmailPage(ctx, { email }) {
  return html`<h1>Confirm your email</h1>
  <p class="lede">Your account is created. We sent a confirmation link to ${email} — click it, then
    sign in.</p>
  <p>The link comes from Supabase, which handles passwords for Homeroom. If it does not arrive
    within a few minutes, check the spam folder before asking a steward.</p>
  <div class="alt"><a href="/homeroom/login">Back to sign in</a></div>`;
}

export function resetExpiredPage() {
  return html`<h1>That link has expired</h1>
  <p class="lede">Reset links work once and last an hour.</p>
  <a class="btn solid wide" href="/homeroom/forgot">Send a new link</a>
  <div class="alt"><a href="/homeroom/login">Back to sign in</a></div>`;
}

export function resetDonePage() {
  return html`<h1>Password saved</h1>
  <p class="lede">Every other session has been signed out. Sign in with the new one.</p>
  <a class="btn solid wide" href="/homeroom/login">Sign in</a>`;
}


/* ------------------------------------------------------------------- home */

export function homePage(ctx, {
  member, stats, upcomingSlots, upcomingEvents, myOrgs, deals, funders, mentors, modules,
  updates, intros, onboardingComplete, onboardingLeft,
}) {
  return html`<div class="hero">
    <div>
      <h1>${member.name || ctx.user.id}, <span class="dim">welcome back.</span></h1>
      <p class="lede">${HOMEROOM_TAGLINE} ${stats.members} members, ${stats.deals} perks,
        ${stats.funders} funders, ${stats.atlas} labs on the atlas, ${stats.modules} manual modules.</p>
    </div>
    <div class="heroactions">
      <a class="btn solid" href="/homeroom/mentors">Find a mentor</a>
      <a class="btn ghost" href="/homeroom/perks">Browse perks</a>
    </div>
  </div>

  ${!onboardingComplete ? html`<div class="notice">
    You are ${onboardingLeft === 1 ? 'one step' : `${onboardingLeft} steps`} into settling in.
    <a href="/homeroom/welcome">Pick up where you left off</a>.</div>` : ''}

  ${intros.length ? html`<div class="notice">
    ${plural(intros.length, 'intro request')} waiting on you.
    <a href="/homeroom/intros">Answer ${intros.length === 1 ? 'it' : 'them'}</a>.</div>` : ''}

  <div class="cols">
    <div class="main">
      ${section('Perks worth claiming', deals.length
        ? html`<ul class="cards">${deals.map((d) => html`<li class="card">
          <a class="cardlink" href="/homeroom/perk/${d.slug}">
            <div class="grow">
              <div class="title-line"><span class="title">${d.vendor}</span>
                ${d.worth ? pill(d.worth) : ''}</div>
              <div class="headline">${d.title}</div>
              <div class="meta mono">${labelFor(DEAL_CATEGORIES, d.category, d.category)}
                ${d.requirement ? html`<span class="sep">/</span> ${d.requirement}` : ''}</div>
            </div></a></li>`)}</ul>`
        : empty('No perks yet.'), { href: '/homeroom/perks' })}

      ${section('Where the money is', funders.length
        ? html`<ul class="cards">${funders.map((f) => html`<li class="card">
          <a class="cardlink" href="/homeroom/funder/${f.slug}">
            <div class="grow">
              <div class="title-line"><span class="title">${f.name}</span>
                ${stars(f.avg_rating, { count: f.review_count })}</div>
              <div class="headline">${f.summary || f.thesis || ''}</div>
              <div class="meta mono">${labelFor(FUNDER_KINDS, f.kind, f.kind)}
                ${f.cheque ? html`<span class="sep">/</span> ${f.cheque}` : ''}</div>
            </div></a></li>`)}</ul>`
        : empty('The capital map is empty.'), { href: '/homeroom/funders' })}

      ${updates.length ? section(
        'Lab updates',
        html`<ul class="cards">${updates.map((u) => html`<li class="card">
          <div class="grow">
            <div class="title-line"><a class="title" href="/homeroom/lab/${u.org_slug}">${u.org_name}</a>
              ${u.period ? pill(u.period) : ''}</div>
            <div class="prose small">${snippet(u.body, 320)}</div>
            <div class="subline mono">${memberLink(u.author_id)} <span class="sep">/</span> ${when(u.created_at)}</div>
          </div></li>`)}</ul>`,
      ) : ''}
    </div>

    <aside class="rail">
      ${section('Your labs', myOrgs.length
        ? html`<ul class="rail-list">${myOrgs.map((o) => html`<li>
            <a href="/homeroom/lab/${o.slug}">${o.name}</a>
            <span class="mono dim">${labelFor(ORG_STAGES, o.stage, o.stage)}</span></li>`)}</ul>`
        : html`<p class="mono dim">None yet. <a href="/homeroom/labs/new">Add your lab</a>.</p>`,
        { href: '/homeroom/labs' })}

      ${section('Next office hours', upcomingSlots.length
        ? html`<ul class="rail-list">${upcomingSlots.map((s) => html`<li>
            <a href="/homeroom/hours/${s.id}">${s.title}</a>
            <span class="mono dim">${relTime(s.starts_at)} <span class="sep">/</span> ${s.booked}/${s.capacity} booked</span></li>`)}</ul>`
        : html`<p class="mono dim">No slots posted. <a href="/homeroom/hours/new">Offer some</a>.</p>`,
        { href: '/homeroom/hours' })}

      ${section('Upcoming events', upcomingEvents.length
        ? html`<ul class="rail-list">${upcomingEvents.map((e) => html`<li>
            <a href="/homeroom/event/${e.id}">${e.title}</a>
            <span class="mono dim">${relTime(e.starts_at)} <span class="sep">/</span> ${e.going} going</span></li>`)}</ul>`
        : html`<p class="mono dim">Nothing scheduled.</p>`, { href: '/homeroom/events' })}

      ${section('Mentors on call', mentors.length
        ? html`<ul class="rail-list">${mentors.map((m) => html`<li>
            <a href="/homeroom/mentor/${m.slug}">${m.name}</a>
            <span class="mono dim">${labelFor(MENTOR_TRACKS, m.track, m.track)}</span></li>`)}</ul>`
        : html`<p class="mono dim">No mentors listed yet.</p>`, { href: '/homeroom/mentors' })}

      ${section('Start the manual', modules.length
        ? html`<ul class="rail-list">${modules.map((m) => html`<li>
            <a href="/homeroom/library/module/${m.slug}">${m.title}</a>
            <span class="mono dim">${m.week ? `week ${m.week}` : labelFor(TRACKS, m.track, m.track)}</span></li>`)}</ul>`
        : html`<p class="mono dim">The manual is empty.</p>`, { href: '/homeroom/library' })}
    </aside>
  </div>`;
}

/* ----------------------------------------------------------------- people */

export function peoplePage(ctx, { members, total, page, filters, tags, cohortList, basePath }) {
  const openFilters = [
    ['intros', 'open to intros'], ['hours', 'offers office hours'],
    ['collab', 'open to collaborate'], ['hiring', 'hiring'],
  ];
  return html`<div class="pagehead">
    <div><h1>People</h1>
      <p class="lede">${plural(total, 'member')} matching. Everyone here has tagged what they can
        actually help with — search that, not job titles.</p></div>
    <a class="btn ghost" href="/homeroom/settings">Edit your profile</a>
  </div>

  <form class="searchbar" method="get" action="/homeroom/people">
    <input type="search" name="q" value="${filters.q}" placeholder="name, lab, technique, what they are working on" />
    <input type="text" name="location" value="${filters.location}" placeholder="location" class="narrow" />
    ${select('cohort', cohortList.map((c) => ({ slug: c.cohort, label: `${c.cohort} (${c.count})` })), filters.cohort, { blank: 'any cohort' })}
    <button class="btn" type="submit">Filter</button>
  </form>

  <div class="toolbar mono">
    <span class="dim">open to</span>
    ${openFilters.map(([slug, label]) => html`<a class="${filters.open === slug ? 'on' : ''}"
      href="/homeroom/people?${raw(queryWith(filters, { open: filters.open === slug ? '' : slug }))}">${label}</a>`)}
  </div>

  ${tags.length ? html`<div class="tagcloud">
    <span class="mono dim">expertise</span>
    ${tags.map((t) => html`<a class="tag ${filters.tag === t.tag ? 'on' : 'ghost'}"
      href="/homeroom/people?${raw(queryWith(filters, { tag: filters.tag === t.tag ? '' : t.tag }))}">${t.tag} <span class="n">${t.count}</span></a>`)}
  </div>` : ''}

  ${members.length
    ? html`<ul class="cards grid">${members.map(memberCard)}</ul>`
    : empty('Nobody matches that yet.')}
  ${pager({ page, total, perPage: PER_PAGE, basePath })}`;
}

function queryWith(filters, extra) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function memberPage(ctx, {
  profile, orgs, slots, isSelf, introSent, canRequestIntro, threadId,
}) {
  const links = tagList(profile.links);
  return html`<div class="profilehead">
    ${avatar(profile.user_id, { size: 76 })}
    <div class="grow">
      <h1>${profile.name || profile.user_id}</h1>
      <div class="handle mono">@${profile.user_id}
        ${profile.cohort ? pill(profile.cohort, 'cohort') : ''}
        ${profile.is_admin ? pill('steward', 'admin') : ''}
        <span class="sep">/</span> ${profile.karma} karma
        <span class="sep">/</span> joined ${when(profile.joined_at)}</div>
      ${profile.headline ? html`<p class="headline">${profile.headline}</p>` : ''}
      <div class="mono dim">
        ${profile.role ? html`${profile.role} ` : ''}
        ${profile.org ? html`at ${profile.org} ` : ''}
        ${profile.location ? html`<span class="sep">/</span> ${profile.location} ` : ''}
        ${profile.bsl ? html`<span class="sep">/</span> works at ${profile.bsl}` : ''}
      </div>
    </div>
    <div class="profileactions">
      ${isSelf ? html`<a class="btn ghost" href="/homeroom/settings">Edit profile</a>` : ''}
      ${!isSelf && ctx.user ? html`<a class="btn ghost" href="/homeroom/messages/new?to=${encodeURIComponent(profile.user_id)}">${threadId ? 'Open thread' : 'Message'}</a>` : ''}
      ${canRequestIntro ? html`<a class="btn solid" href="/homeroom/intros/new?to=${encodeURIComponent(profile.user_id)}">Request intro</a>` : ''}
      ${introSent ? html`<span class="pill">intro requested</span>` : ''}
    </div>
  </div>

  <div class="openrow mono big">
    ${profile.open_intros ? html`<span class="open">open to intros</span>` : ''}
    ${profile.open_hours ? html`<span class="open">offers office hours</span>` : ''}
    ${profile.open_collab ? html`<span class="open">open to collaborate</span>` : ''}
    ${profile.open_hiring ? html`<span class="open">hiring</span>` : ''}
  </div>

  <div class="cols">
    <div class="main">
      ${profile.bio ? section('About', body(profile.bio)) : ''}
      ${profile.working_on ? section('Working on', body(profile.working_on)) : ''}
      ${profile.ask_me_about ? section('Ask me about', body(profile.ask_me_about)) : ''}
    </div>
    <aside class="rail">
      ${section('Expertise', (profile.expertise || []).length
        ? html`<div class="tagcloud">${profile.expertise.map((t) => html`<a class="tag" href="/homeroom/people?tag=${t}">${t}</a>`)}</div>`
        : html`<p class="mono dim">No tags yet.</p>`)}
      ${section('Labs', orgs.length
        ? html`<ul class="rail-list">${orgs.map((o) => html`<li><a href="/homeroom/lab/${o.slug}">${o.name}</a>
            <span class="mono dim">${o.role || labelFor(ORG_KINDS, o.kind, o.kind)}</span></li>`)}</ul>`
        : html`<p class="mono dim">Not listed with a lab.</p>`)}
      ${slots.length ? section('Office hours on offer', html`<ul class="rail-list">${slots.map((s) => html`<li>
        <a href="/homeroom/hours/${s.id}">${s.title}</a>
        <span class="mono dim">${relTime(s.starts_at)}</span></li>`)}</ul>`) : ''}
      ${links.length ? section('Links', html`<ul class="rail-list">${links.map((l) => html`<li>
        <a href="${l}" rel="nofollow noopener ugc" target="_blank">${l.replace(/^https?:\/\//, '')}</a></li>`)}</ul>`) : ''}
    </aside>
  </div>`;
}

export function settingsPage(ctx, {
  member, error = null, saved = false,
  passwordError = null, passwordSaved = false, authMode = 'local',
}) {
  const checked = (flag) => raw(member[flag] ? 'checked' : '');
  return html`<h1>Your profile</h1>
  <p class="lede">This is what the directory searches. Vague profiles get no intros.</p>
  ${saved ? html`<div class="notice">Saved.</div>` : ''}
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/settings">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="name">Name</label>
        <input id="name" name="name" value="${member.name}" maxlength="80" /></div>
      <div class="field"><label for="cohort">Cohort</label>
        <input id="cohort" name="cohort" value="${member.cohort || ''}" maxlength="12" placeholder="S26" />
        <div class="hint">However you group yourself: a batch, a year, a lab generation.</div></div>
    </div>
    <div class="field"><label for="headline">Headline</label>
      <input id="headline" name="headline" value="${member.headline}" maxlength="140"
        placeholder="Directed evolution of thermostable enzymes, in a garage in Porto" /></div>
    <div class="row">
      <div class="field"><label for="org">Lab or org</label>
        <input id="org" name="org" value="${member.org}" maxlength="80" /></div>
      <div class="field"><label for="role">Role</label>
        <input id="role" name="role" value="${member.role}" maxlength="80" /></div>
    </div>
    <div class="row">
      <div class="field"><label for="location">Location</label>
        <input id="location" name="location" value="${member.location}" maxlength="80" /></div>
      <div class="field"><label for="bsl">Containment you work at</label>
        <input id="bsl" name="bsl" value="${member.bsl || ''}" maxlength="24" placeholder="BSL-1" /></div>
    </div>
    <div class="field"><label for="bio">About</label>
      <textarea id="bio" name="bio" rows="5" maxlength="4000">${member.bio}</textarea></div>
    <div class="field"><label for="working_on">Working on</label>
      <textarea id="working_on" name="working_on" rows="3" maxlength="2000">${member.working_on}</textarea></div>
    <div class="field"><label for="ask_me_about">Ask me about</label>
      <textarea id="ask_me_about" name="ask_me_about" rows="3" maxlength="2000"
        placeholder="Things you have actually done and would answer a 3am message about.">${member.ask_me_about}</textarea></div>
    <div class="field"><label for="expertise">Expertise tags</label>
      <input id="expertise" name="expertise" value="${(member.expertise || []).join(', ')}" />
      <div class="hint">Comma separated, up to twelve. Common ones:
        ${EXPERTISE_SUGGESTIONS.slice(0, 14).join(', ')}.</div></div>
    <div class="field"><label for="links">Links</label>
      <input id="links" name="links" value="${member.links}" placeholder="https://…, https://…" />
      <div class="hint">Comma separated.</div></div>
    <fieldset class="checks">
      <legend class="mono">Open to</legend>
      <label class="check"><input type="checkbox" name="open_intros" value="1" ${checked('open_intros')} /> intro requests</label>
      <label class="check"><input type="checkbox" name="open_hours" value="1" ${checked('open_hours')} /> giving office hours</label>
      <label class="check"><input type="checkbox" name="open_collab" value="1" ${checked('open_collab')} /> collaborations</label>
      <label class="check"><input type="checkbox" name="open_hiring" value="1" ${checked('open_hiring')} /> being contacted about jobs</label>
    </fieldset>
    <button class="btn solid" type="submit">Save profile</button>
  </form>

  ${passwordForm(ctx, { error: passwordError, saved: passwordSaved, authMode })}`;
}

/**
 * Change your own password.
 *
 * Asks for the current one, which is not ceremony: it is what stops a borrowed
 * laptop or a stolen session cookie from becoming a permanent takeover of the
 * account. It is also the token exchange when Supabase holds the credential —
 * proving the old password is how a new one gets authorised.
 */
function passwordForm(ctx, { error, saved, authMode }) {
  return html`<h2 id="password">Password</h2>
  <p class="lede">Changing it signs out every other session, including any you have forgotten
    about.</p>
  ${saved ? html`<div class="notice">Password changed. Your other sessions are signed out.</div>` : ''}
  ${error ? html`<div class="notice bad">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/password">
    ${csrfField(ctx)}
    <div class="field"><label for="current">Current password</label>
      <input id="current" name="current" type="password" autocomplete="current-password" required /></div>
    <div class="row">
      <div class="field"><label for="new-password">New password</label>
        <input id="new-password" name="password" type="password" autocomplete="new-password"
          required minlength="10" />
        <div class="hint">At least 10 characters. Longer beats complicated.</div></div>
      <div class="field"><label for="new-confirm">New password again</label>
        <input id="new-confirm" name="confirm" type="password" autocomplete="new-password" required /></div>
    </div>
    <button class="btn solid" type="submit">Change password</button>
  </form>
  ${authMode === 'supabase' ? html`<p class="hint">Passwords for Homeroom are held by Supabase, so
    this changes it everywhere the account is used.</p>` : ''}`;
}

/* ------------------------------------------------------------------- labs */

export function labsPage(ctx, { orgs, total, page, filters, basePath }) {
  return html`<div class="pagehead">
    <div><h1>Labs</h1><p class="lede">${plural(total, 'lab')} in the network — startups, community
      labs, foundries, collectives and one-person garages.</p></div>
    <a class="btn solid" href="/homeroom/labs/new">Add a lab</a>
  </div>
  <form class="searchbar" method="get" action="/homeroom/labs">
    <input type="search" name="q" value="${filters.q}" placeholder="name, what they do, where they are" />
    ${select('kind', ORG_KINDS, filters.kind, { blank: 'any kind' })}
    ${select('stage', ORG_STAGES, filters.stage, { blank: 'any stage' })}
    <button class="btn" type="submit">Filter</button>
  </form>
  ${orgs.length ? html`<ul class="cards grid">${orgs.map((o) => html`<li class="card lab">
    <a class="cardlink" href="/homeroom/lab/${o.slug}">
      <div class="grow">
        <div class="name">${o.name} ${o.cohort ? pill(o.cohort, 'cohort') : ''}</div>
        <div class="headline">${o.tagline || 'No tagline yet.'}</div>
        <div class="meta mono">${labelFor(ORG_KINDS, o.kind, o.kind)}
          <span class="sep">/</span> ${labelFor(ORG_STAGES, o.stage, o.stage)}
          <span class="sep">/</span> ${o.location || 'location unlisted'}
          <span class="sep">/</span> ${plural(o.team_count, 'member')}</div>
      </div></a>
    ${tagList(o.tags).length ? html`<div class="tagrow">${tagList(o.tags).map((t) => html`<span class="tag ghost">${t}</span>`)}</div>` : ''}
  </li>`)}</ul>` : empty('No labs match that.')}
  ${pager({ page, total, perPage: PER_PAGE, basePath })}`;
}

export function labPage(ctx, { org, team, updates, jobs, isMember, isAdmin }) {
  return html`<div class="profilehead">
    <div class="grow">
      <h1>${org.name} ${org.cohort ? pill(org.cohort, 'cohort') : ''}</h1>
      <p class="headline">${org.tagline}</p>
      <div class="mono dim">${labelFor(ORG_KINDS, org.kind, org.kind)}
        <span class="sep">/</span> ${labelFor(ORG_STAGES, org.stage, org.stage)}
        ${org.location ? html` <span class="sep">/</span> ${org.location}` : ''}
        ${org.founded ? html` <span class="sep">/</span> founded ${org.founded}` : ''}
        ${org.headcount ? html` <span class="sep">/</span> ${plural(org.headcount, 'person', 'people')}` : ''}
        ${org.website ? html` <span class="sep">/</span> <a href="${org.website}" rel="nofollow noopener" target="_blank">${org.website.replace(/^https?:\/\//, '')}</a>` : ''}</div>
    </div>
    <div class="profileactions">
      ${isAdmin ? html`<a class="btn ghost" href="/homeroom/lab/${org.slug}/edit">Edit</a>` : ''}
      ${isMember ? html`<a class="btn solid" href="/homeroom/lab/${org.slug}/update">Post update</a>` : ''}
      ${ctx.user && !isMember ? html`<form method="post" action="/homeroom/lab/${org.slug}/join">
        ${csrfField(ctx)}<button class="btn ghost" type="submit">I work here</button></form>` : ''}
      ${isMember && !isAdmin ? html`<form method="post" action="/homeroom/lab/${org.slug}/leave">
        ${csrfField(ctx)}<button class="btn ghost" type="submit">Leave</button></form>` : ''}
    </div>
  </div>

  <div class="cols">
    <div class="main">
      ${org.description ? section('What they do', body(org.description)) : ''}
      ${section('Updates', updates.length
        ? html`<ul class="rail-list wide">${updates.map((u) => html`<li>
            <div class="mono dim">${u.period ? html`${u.period} <span class="sep">/</span> ` : ''}
              ${memberLink(u.author_id)} <span class="sep">/</span> ${when(u.created_at)}</div>
            ${body(u.body)}
            ${u.metrics ? html`<div class="metrics mono">${u.metrics}</div>` : ''}
            ${u.asks ? html`<div class="asks"><b class="mono">asks</b> ${u.asks}</div>` : ''}
          </li>`)}</ul>`
        : html`<p class="mono dim">No updates posted yet.</p>`)}
    </div>
    <aside class="rail">
      ${section('Team', team.length ? html`<ul class="rail-list">${team.map((t) => html`<li>
        <a href="/homeroom/p/${encodeURIComponent(t.user_id)}">${t.name || t.user_id}</a>
        <span class="mono dim">${t.role || 'member'}${t.admin ? ' · admin' : ''}</span></li>`)}</ul>`
        : html`<p class="mono dim">Nobody listed.</p>`)}
      ${section('Open roles', jobs.length
        ? html`<ul class="rail-list">${jobs.map((j) => html`<li><a href="/homeroom/job/${j.id}">${j.title}</a>
            <span class="mono dim">${j.location || 'location unlisted'}${j.remote ? ' · remote ok' : ''}</span></li>`)}</ul>`
        : html`<p class="mono dim">None posted.${isMember ? html` <a href="/homeroom/jobs/new?org=${org.id}">Post one</a>.` : ''}</p>`)}
      ${tagList(org.tags).length ? section('Tags',
        html`<div class="tagcloud">${tagList(org.tags).map((t) => html`<a class="tag" href="/homeroom/labs?tag=${t}">${t}</a>`)}</div>`) : ''}
    </aside>
  </div>`;
}

export function labFormPage(ctx, { org = null, error = null }) {
  const value = (field, fallback = '') => (org ? org[field] ?? fallback : fallback);
  return html`<h1>${org ? `Edit ${org.name}` : 'Add a lab'}</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="${org ? `/homeroom/lab/${org.slug}/edit` : '/homeroom/labs/new'}">
    ${csrfField(ctx)}
    <div class="field"><label for="name">Name</label>
      <input id="name" name="name" value="${value('name')}" maxlength="80" required /></div>
    <div class="field"><label for="tagline">One line</label>
      <input id="tagline" name="tagline" value="${value('tagline')}" maxlength="140"
        placeholder="Cell-free protein synthesis kits for teaching labs" /></div>
    <div class="row">
      <div class="field"><label for="kind">Kind</label>${select('kind', ORG_KINDS, value('kind', 'startup'))}</div>
      <div class="field"><label for="stage">Stage</label>${select('stage', ORG_STAGES, value('stage', 'idea'))}</div>
    </div>
    <div class="row">
      <div class="field"><label for="location">Location</label>
        <input id="location" name="location" value="${value('location')}" maxlength="80" /></div>
      <div class="field"><label for="website">Website</label>
        <input id="website" name="website" value="${value('website')}" maxlength="200" /></div>
    </div>
    <div class="row">
      <div class="field"><label for="cohort">Cohort</label>
        <input id="cohort" name="cohort" value="${value('cohort')}" maxlength="12" /></div>
      <div class="field"><label for="founded">Founded</label>
        <input id="founded" name="founded" type="number" min="1900" max="2100" value="${value('founded')}" /></div>
      <div class="field"><label for="headcount">Headcount</label>
        <input id="headcount" name="headcount" type="number" min="1" max="100000" value="${value('headcount')}" /></div>
    </div>
    <div class="field"><label for="description">What you do</label>
      <textarea id="description" name="description" rows="8" maxlength="8000">${value('description')}</textarea></div>
    <div class="field"><label for="tags">Tags</label>
      <input id="tags" name="tags" value="${value('tags')}" placeholder="cell-free, education, kits" /></div>
    <button class="btn solid" type="submit">${org ? 'Save' : 'Add lab'}</button>
  </form>`;
}

export function updateFormPage(ctx, { org, error = null }) {
  return html`<h1>Update from ${org.name}</h1>
  <p class="lede">What moved, what did not, what you need. Short is fine.</p>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/lab/${org.slug}/update">
    ${csrfField(ctx)}
    <div class="field"><label for="period">Period</label>
      <input id="period" name="period" maxlength="40" placeholder="Week of 10 Aug" /></div>
    <div class="field"><label for="body">Update</label>
      <textarea id="body" name="body" rows="8" required></textarea></div>
    <div class="field"><label for="metrics">Numbers</label>
      <input id="metrics" name="metrics" maxlength="200" placeholder="12 constructs screened · 3 hits · 9 months runway" /></div>
    <div class="field"><label for="asks">Asks</label>
      <input id="asks" name="asks" maxlength="300" placeholder="Intro to anyone running a BSL-2 in Berlin" /></div>
    <button class="btn solid" type="submit">Post update</button>
  </form>`;
}

/* ------------------------------------------------------------------ deals */



export function dealFormPage(ctx, { error = null, values = {} }) {
  return html`<h1>Add a deal</h1>
  <p class="lede">Something you negotiated that other members can use too.</p>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/perks/new">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="vendor">Vendor</label>
        <input id="vendor" name="vendor" value="${values.vendor || ''}" maxlength="80" required /></div>
      <div class="field"><label for="category">Category</label>${select('category', DEAL_CATEGORIES, values.category || 'other')}</div>
    </div>
    <div class="field"><label for="title">What you get</label>
      <input id="title" name="title" value="${values.title || ''}" maxlength="140" required
        placeholder="30% off oligos, no minimum" /></div>
    <div class="row">
      <div class="field"><label for="worth">Worth</label>
        <input id="worth" name="worth" value="${values.worth || ''}" maxlength="60" placeholder="~€2,000/yr" /></div>
      <div class="field"><label for="code">Code</label>
        <input id="code" name="code" value="${values.code || ''}" maxlength="80" />
        <div class="hint">Only shown to members who claim it.</div></div>
    </div>
    <div class="field"><label for="url">Link</label><input id="url" name="url" value="${values.url || ''}" maxlength="300" /></div>
    <div class="field"><label for="summary">Summary</label>
      <input id="summary" name="summary" value="${values.summary || ''}" maxlength="200" /></div>
    <div class="field"><label for="details">Details</label>
      <textarea id="details" name="details" rows="6">${values.details || ''}</textarea></div>
    <button class="btn solid" type="submit">Add deal</button>
  </form>`;
}

/* ---------------------------------------------------------------- funders */



export function funderFormPage(ctx, { error = null, values = {} }) {
  return html`<h1>Add a funder</h1>
  <p class="lede">Grants and prizes count. So do the funds nobody warns you about.</p>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/funders/new">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="name">Name</label>
        <input id="name" name="name" value="${values.name || ''}" maxlength="120" required /></div>
      <div class="field"><label for="kind">Kind</label>${select('kind', FUNDER_KINDS, values.kind || 'vc')}</div>
    </div>
    <div class="row">
      <div class="field"><label for="focus">Focus</label>
        <input id="focus" name="focus" value="${values.focus || ''}" maxlength="140" placeholder="Synbio tooling, biomanufacturing" /></div>
      <div class="field"><label for="stages">Stages</label>
        <input id="stages" name="stages" value="${values.stages || ''}" maxlength="80" placeholder="pre-seed, seed" /></div>
    </div>
    <div class="row">
      <div class="field"><label for="check_size">Cheque size</label>
        <input id="check_size" name="check_size" value="${values.check_size || ''}" maxlength="60" /></div>
      <div class="field"><label for="location">Location</label>
        <input id="location" name="location" value="${values.location || ''}" maxlength="80" /></div>
      <div class="field"><label for="website">Website</label>
        <input id="website" name="website" value="${values.website || ''}" maxlength="200" /></div>
    </div>
    <div class="field"><label for="description">Notes</label>
      <textarea id="description" name="description" rows="6">${values.description || ''}</textarea></div>
    <label class="check"><input type="checkbox" name="nondilutive" value="1" /> non-dilutive (grant, prize, foundation)</label>
    <button class="btn solid" type="submit">Add funder</button>
  </form>`;
}

export function pipelinePage(ctx, { rows }) {
  const byStatus = new Map(PIPELINE_STATUSES.map((s) => [s.slug, []]));
  for (const row of rows) (byStatus.get(row.status) || byStatus.get('researching')).push(row);
  return html`<div class="pagehead">
    <div><h1>Pipeline</h1><p class="lede">Your fundraise, tracked. Private to you —
      other members see none of this.</p></div>
    <a class="btn ghost" href="/homeroom/funders">Browse funders</a>
  </div>
  ${rows.length ? html`<div class="board">${PIPELINE_STATUSES.map((status) => html`<div class="column">
    <h2 class="mono">${status.label} <span class="n">${byStatus.get(status.slug).length}</span></h2>
    ${byStatus.get(status.slug).map((row) => html`<div class="card mini">
      <a href="/homeroom/funder/${row.funder_slug}">${row.funder_name}</a>
      <div class="mono dim">${row.amount || labelFor(FUNDER_KINDS, row.funder_kind, row.funder_kind)}
        ${row.avg_rating ? html` <span class="sep">/</span> ${row.avg_rating}★` : ''}</div>
      ${row.notes ? html`<div class="prose small">${snippet(row.notes, 180)}</div>` : ''}
      <div class="mono dim">updated ${when(row.updated_at)}</div>
    </div>`)}
  </div>`)}</div>` : empty('Nothing tracked yet. Open a funder and add it to your pipeline.')}`;
}

/* ----------------------------------------------------------- office hours */

export function hoursPage(ctx, { slots, mine, hosting }) {
  return html`<div class="pagehead">
    <div><h1>Office hours</h1><p class="lede">Book half an hour with someone who has already
      done the thing you are about to do.</p></div>
    <a class="btn solid" href="/homeroom/hours/new">Offer office hours</a>
  </div>
  ${mine.length ? section('Your bookings', html`<ul class="rail-list wide">${mine.map((s) => html`<li>
    <a href="/homeroom/hours/${s.id}">${s.title}</a> with ${memberLink(s.host_id)}
    <span class="mono dim">${stamp(s.starts_at)} <span class="sep">/</span> ${relTime(s.starts_at)}</span>
  </li>`)}</ul>`) : ''}
  ${hosting.length ? section('You are hosting', html`<ul class="rail-list wide">${hosting.map((s) => html`<li>
    <a href="/homeroom/hours/${s.id}">${s.title}</a>
    <span class="mono dim">${stamp(s.starts_at)} <span class="sep">/</span> ${s.booked}/${s.capacity} booked</span>
  </li>`)}</ul>`) : ''}
  ${section('Open slots', slots.length ? html`<ul class="cards">${slots.map((s) => html`<li class="card slot">
    <div class="grow">
      <div class="title-line"><a class="title" href="/homeroom/hours/${s.id}">${s.title}</a>
        ${pill(s.format === 'group' ? 'group' : '1:1')}
        ${s.booked >= s.capacity ? pill('full', 'warn') : pill(`${s.capacity - s.booked} left`, 'ok')}</div>
      <div class="subline mono">${memberLink(s.host_id)}
        <span class="sep">/</span> ${stamp(s.starts_at)}
        <span class="sep">/</span> ${s.minutes} min
        <span class="sep">/</span> ${relTime(s.starts_at)}
        ${s.topics ? html`<span class="sep">/</span> ${s.topics}` : ''}</div>
    </div>
  </li>`)}</ul>` : empty('No open slots. Offer some yourself — that is how this fills up.'))}`;
}

export function slotPage(ctx, { slot, bookings, isHost, booked }) {
  return html`<h1>${slot.title}</h1>
  <div class="mono dim">${memberLink(slot.host_id)}
    <span class="sep">/</span> ${stamp(slot.starts_at)}
    <span class="sep">/</span> ${slot.minutes} minutes
    <span class="sep">/</span> ${slot.format === 'group' ? 'group session' : 'one on one'}
    <span class="sep">/</span> ${bookings.length}/${slot.capacity} booked
    ${slot.canceled ? html` <span class="sep">/</span> <b class="warn">canceled</b>` : ''}</div>
  ${slot.topics ? html`<p class="mono">${slot.topics}</p>` : ''}
  ${slot.description ? body(slot.description) : ''}
  ${slot.place ? html`<p class="mono dim">Where: ${slot.place}</p>` : ''}

  ${slot.canceled ? html`<div class="notice error">This session was canceled.</div>`
    : isHost
      ? html`${section('Who booked', bookings.length
          ? html`<ul class="rail-list wide">${bookings.map((b) => html`<li>
              ${memberLink(b.user_id)} <span class="mono dim">${when(b.created_at)}</span>
              ${b.question ? html`<div class="prose small">${b.question}</div>` : ''}</li>`)}</ul>`
          : html`<p class="mono dim">Nobody yet.</p>`)}
        <form method="post" action="/homeroom/hours/${slot.id}/cancel"
          onsubmit="return confirm('Cancel this session for everyone?')">
          ${csrfField(ctx)}<button class="btn ghost" type="submit">Cancel session</button></form>`
      : booked
        ? html`<div class="notice">You are booked. It is on you to show up.</div>
          <form method="post" action="/homeroom/hours/${slot.id}/unbook">
            ${csrfField(ctx)}<button class="btn ghost" type="submit">Give up my slot</button></form>`
        : bookings.length >= slot.capacity
          ? html`<div class="notice">Full.</div>`
          : html`<form class="stack" method="post" action="/homeroom/hours/${slot.id}/book">
              ${csrfField(ctx)}
              <div class="field"><label for="question">What do you want out of it?</label>
                <textarea id="question" name="question" rows="4"
                  placeholder="One concrete question beats a general ask."></textarea></div>
              <button class="btn solid" type="submit">Book this slot</button>
            </form>`}`;
}

export function slotFormPage(ctx, { error = null, defaultStart }) {
  return html`<h1>Offer office hours</h1>
  <p class="lede">Pick a time, say what you can help with, and let people book it. All times UTC.</p>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/hours/new">
    ${csrfField(ctx)}
    <div class="field"><label for="title">Title</label>
      <input id="title" name="title" maxlength="120" required
        placeholder="Scaling fermentation from 1L to 100L — ask me anything" /></div>
    <div class="row">
      <div class="field"><label for="starts_at">Starts (UTC)</label>
        <input id="starts_at" name="starts_at" type="datetime-local" value="${defaultStart}" required /></div>
      <div class="field"><label for="minutes">Minutes</label>
        <input id="minutes" name="minutes" type="number" min="10" max="240" value="30" /></div>
    </div>
    <div class="row">
      <div class="field"><label for="format">Format</label>
        ${select('format', [{ slug: 'one-on-one', label: 'One on one' }, { slug: 'group', label: 'Group' }], 'one-on-one')}</div>
      <div class="field"><label for="capacity">Capacity</label>
        <input id="capacity" name="capacity" type="number" min="1" max="50" value="1" /></div>
    </div>
    <div class="field"><label for="place">Where</label>
      <input id="place" name="place" maxlength="200" placeholder="Video link, or a bench in Lisbon" /></div>
    <div class="field"><label for="topics">Topics</label>
      <input id="topics" name="topics" maxlength="140" placeholder="fermentation, scale-up, CMOs" /></div>
    <div class="field"><label for="description">Details</label>
      <textarea id="description" name="description" rows="5"></textarea></div>
    <button class="btn solid" type="submit">Post slot</button>
  </form>`;
}

/* ------------------------------------------------------------------- jobs */

export function jobsPage(ctx, { jobs, total, page, filters, basePath, canPost }) {
  return html`<div class="pagehead">
    <div><h1>Jobs</h1><p class="lede">${plural(total, 'open role')} across the network.
      Members only, so you can ask the founder directly.</p></div>
    ${canPost ? html`<a class="btn solid" href="/homeroom/jobs/new">Post a role</a>`
      : html`<a class="btn ghost" href="/homeroom/labs/new">Add your lab to post roles</a>`}
  </div>
  <form class="searchbar" method="get" action="/homeroom/jobs">
    <input type="search" name="q" value="${filters.q}" placeholder="title, lab, skill" />
    ${select('discipline', JOB_DISCIPLINES, filters.discipline, { blank: 'any discipline' })}
    <label class="check inline"><input type="checkbox" name="remote" value="1" ${raw(filters.remote ? 'checked' : '')} /> remote ok</label>
    <button class="btn" type="submit">Filter</button>
  </form>
  ${jobs.length ? html`<ul class="cards">${jobs.map((j) => html`<li class="card job">
    <div class="grow">
      <div class="title-line"><a class="title" href="/homeroom/job/${j.id}">${j.title}</a>
        <a class="tag" href="/homeroom/lab/${j.org_slug}">${j.org_name}</a></div>
      <div class="subline mono">${labelFor(JOB_DISCIPLINES, j.discipline, j.discipline)}
        <span class="sep">/</span> ${j.employment}
        <span class="sep">/</span> ${j.location || 'location unlisted'}${j.remote ? ' · remote ok' : ''}
        ${j.comp ? html`<span class="sep">/</span> ${j.comp}` : ''}
        <span class="sep">/</span> ${when(j.created_at)}</div>
    </div>
  </li>`)}</ul>` : empty('No roles match that.')}
  ${pager({ page, total, perPage: PER_PAGE, basePath })}`;
}

export function jobPage(ctx, { job, applied, applicants, canManage }) {
  return html`<h1>${job.title}</h1>
  <div class="mono dim"><a href="/homeroom/lab/${job.org_slug}">${job.org_name}</a>
    <span class="sep">/</span> ${labelFor(JOB_DISCIPLINES, job.discipline, job.discipline)}
    <span class="sep">/</span> ${job.employment}
    <span class="sep">/</span> ${job.location || 'location unlisted'}${job.remote ? ' · remote ok' : ''}
    ${job.comp ? html`<span class="sep">/</span> ${job.comp}` : ''}
    ${job.equity ? html`<span class="sep">/</span> ${job.equity} equity` : ''}
    <span class="sep">/</span> posted ${when(job.created_at)} by ${memberLink(job.posted_by)}</div>
  ${job.description ? body(job.description) : ''}
  ${tagList(job.tags).length ? html`<div class="tagcloud">${tagList(job.tags).map((t) => html`<span class="tag ghost">${t}</span>`)}</div>` : ''}

  ${job.closed ? html`<div class="notice">This role is closed.</div>`
    : applied ? html`<div class="notice">You applied. ${memberLink(job.posted_by)} can see your profile and note.</div>`
    : html`<form class="stack" method="post" action="/homeroom/job/${job.id}/apply">
        ${csrfField(ctx)}
        <div class="field"><label for="note">Note to the team</label>
          <textarea id="note" name="note" rows="5"
            placeholder="What you have built that is closest to this."></textarea></div>
        <button class="btn solid" type="submit">Apply</button>
      </form>`}

  ${canManage ? section(`Applicants (${applicants.length})`, applicants.length
    ? html`<ul class="rail-list wide">${applicants.map((a) => html`<li>
        ${memberLink(a.user_id, { label: a.name || a.user_id })}
        <span class="mono dim">${a.headline || ''} <span class="sep">/</span> ${when(a.created_at)}</span>
        ${a.note ? html`<div class="prose small">${a.note}</div>` : ''}</li>`)}</ul>`
    : html`<p class="mono dim">Nobody yet.</p>`) : ''}
  ${canManage ? html`<form method="post" action="/homeroom/job/${job.id}/close">
    ${csrfField(ctx)}<button class="btn ghost" type="submit">${job.closed ? 'Reopen' : 'Close'} this role</button></form>` : ''}`;
}

export function jobFormPage(ctx, { orgs, error = null, values = {} }) {
  return html`<h1>Post a role</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/jobs/new">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="org">Lab</label>
        ${select('org', orgs.map((o) => ({ slug: String(o.id), label: o.name })), values.org || '')}</div>
      <div class="field"><label for="discipline">Discipline</label>${select('discipline', JOB_DISCIPLINES, values.discipline || 'wetlab')}</div>
    </div>
    <div class="field"><label for="title">Title</label>
      <input id="title" name="title" value="${values.title || ''}" maxlength="120" required /></div>
    <div class="row">
      <div class="field"><label for="employment">Employment</label>
        ${select('employment', [
          { slug: 'full-time', label: 'Full time' }, { slug: 'part-time', label: 'Part time' },
          { slug: 'contract', label: 'Contract' }, { slug: 'intern', label: 'Internship' },
        ], values.employment || 'full-time')}</div>
      <div class="field"><label for="location">Location</label>
        <input id="location" name="location" value="${values.location || ''}" maxlength="80" /></div>
      <div class="field"><label for="comp">Comp</label>
        <input id="comp" name="comp" value="${values.comp || ''}" maxlength="60" /></div>
      <div class="field"><label for="equity">Equity</label>
        <input id="equity" name="equity" value="${values.equity || ''}" maxlength="40" /></div>
    </div>
    <label class="check"><input type="checkbox" name="remote" value="1" /> remote is fine</label>
    <div class="field"><label for="description">The role</label>
      <textarea id="description" name="description" rows="9">${values.description || ''}</textarea></div>
    <div class="field"><label for="tags">Tags</label><input id="tags" name="tags" value="${values.tags || ''}" /></div>
    <button class="btn solid" type="submit">Post role</button>
  </form>`;
}

/* ----------------------------------------------------------------- events */

export function eventsPage(ctx, { events, past, kind }) {
  return html`<div class="pagehead">
    <div><h1>Events</h1><p class="lede">Meetups, open labs, demo days and talks.</p></div>
    <a class="btn solid" href="/homeroom/events/new">Add an event</a>
  </div>
  ${filterBar(EVENT_KINDS, { active: kind, basePath: '/homeroom/events', param: 'kind', allLabel: 'everything' })}
  ${events.length ? html`<ul class="cards">${events.map((e) => html`<li class="card event">
    <div class="datechip mono"><b>${stamp(e.starts_at).slice(0, 10)}</b>
      <span>${stamp(e.starts_at).slice(-9)}</span></div>
    <div class="grow">
      <div class="title-line"><a class="title" href="/homeroom/event/${e.id}">${e.title}</a>
        ${pill(labelFor(EVENT_KINDS, e.kind, e.kind))}</div>
      <div class="subline mono">${memberLink(e.host_id)}
        <span class="sep">/</span> ${e.place || 'location tbc'}
        <span class="sep">/</span> ${relTime(e.starts_at)}
        <span class="sep">/</span> ${plural(e.going, 'going', 'going')}</div>
    </div>
  </li>`)}</ul>` : empty('Nothing on the calendar.')}
  ${past.length ? section('Recently', html`<ul class="rail-list wide">${past.map((e) => html`<li>
    <a href="/homeroom/event/${e.id}">${e.title}</a>
    <span class="mono dim">${when(e.starts_at)} <span class="sep">/</span> ${e.going} attended</span></li>`)}</ul>`) : ''}`;
}

export function eventPage(ctx, { event, attendees, myStatus, isHost }) {
  return html`<h1>${event.title}</h1>
  <div class="mono dim">${labelFor(EVENT_KINDS, event.kind, event.kind)}
    <span class="sep">/</span> hosted by ${memberLink(event.host_id)}
    <span class="sep">/</span> ${stamp(event.starts_at)}
    <span class="sep">/</span> ${event.minutes} min
    <span class="sep">/</span> ${relTime(event.starts_at)}
    ${event.canceled ? html` <span class="sep">/</span> <b class="warn">canceled</b>` : ''}</div>
  ${event.place ? html`<p class="mono">Where: ${event.place}</p>` : ''}
  ${event.url ? html`<p class="mono"><a href="${event.url}" rel="nofollow noopener" target="_blank">${event.url}</a></p>` : ''}
  ${event.description ? body(event.description) : ''}

  ${event.canceled ? html`<div class="notice error">Canceled.</div>` : html`<form class="rsvp" method="post" action="/homeroom/event/${event.id}/rsvp">
    ${csrfField(ctx)}
    <button class="btn ${myStatus === 'going' ? 'solid' : 'ghost'}" name="status" value="going" type="submit">Going</button>
    <button class="btn ${myStatus === 'maybe' ? 'solid' : 'ghost'}" name="status" value="maybe" type="submit">Maybe</button>
    <button class="btn ghost" name="status" value="none" type="submit">Not going</button>
    ${event.capacity ? html`<span class="mono dim">${event.going}/${event.capacity} places</span>` : ''}
  </form>`}

  ${section(`Attending (${attendees.filter((a) => a.status === 'going').length})`, attendees.length
    ? html`<ul class="rail-list">${attendees.map((a) => html`<li>
        ${memberLink(a.user_id, { label: a.name || a.user_id })}
        <span class="mono dim">${a.status}${a.headline ? ` · ${a.headline}` : ''}</span></li>`)}</ul>`
    : html`<p class="mono dim">Nobody has said yes yet.</p>`)}

  ${isHost && !event.canceled ? html`<form method="post" action="/homeroom/event/${event.id}/cancel"
      onsubmit="return confirm('Cancel this event?')">
    ${csrfField(ctx)}<button class="btn ghost" type="submit">Cancel event</button></form>` : ''}`;
}

export function eventFormPage(ctx, { error = null, defaultStart }) {
  return html`<h1>Add an event</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/events/new">
    ${csrfField(ctx)}
    <div class="field"><label for="title">Title</label>
      <input id="title" name="title" maxlength="140" required /></div>
    <div class="row">
      <div class="field"><label for="kind">Kind</label>${select('kind', EVENT_KINDS, 'meetup')}</div>
      <div class="field"><label for="starts_at">Starts (UTC)</label>
        <input id="starts_at" name="starts_at" type="datetime-local" value="${defaultStart}" required /></div>
      <div class="field"><label for="minutes">Minutes</label>
        <input id="minutes" name="minutes" type="number" min="15" max="1440" value="120" /></div>
    </div>
    <div class="row">
      <div class="field"><label for="place">Where</label><input id="place" name="place" maxlength="200" /></div>
      <div class="field"><label for="capacity">Capacity</label>
        <input id="capacity" name="capacity" type="number" min="0" max="10000" value="0" />
        <div class="hint">0 for unlimited.</div></div>
    </div>
    <div class="field"><label for="url">Link</label><input id="url" name="url" maxlength="300" /></div>
    <div class="field"><label for="description">Details</label>
      <textarea id="description" name="description" rows="7"></textarea></div>
    <button class="btn solid" type="submit">Add event</button>
  </form>`;
}

/* ---------------------------------------------------------------- library */


export function libraryEntryPage(ctx, { entry }) {
  return html`<article class="doc">
    <h1>${entry.title}</h1>
    <div class="mono dim">${labelFor(LIBRARY_KINDS, entry.kind, entry.kind)}
      ${entry.author_id ? html` <span class="sep">/</span> ${memberLink(entry.author_id)}` : ''}
      <span class="sep">/</span> updated ${when(entry.updated_at)}
      <span class="sep">/</span> ${plural(entry.reads, 'read')}</div>
    ${entry.summary ? html`<p class="lede">${entry.summary}</p>` : ''}
    ${body(entry.body)}
    ${tagList(entry.tags).length ? html`<div class="tagcloud">${tagList(entry.tags).map((t) => html`<span class="tag ghost">${t}</span>`)}</div>` : ''}
  </article>`;
}

export function libraryFormPage(ctx, { error = null, values = {} }) {
  return html`<h1>Write for the library</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack wide" method="post" action="/homeroom/library/new">
    ${csrfField(ctx)}
    <div class="row">
      <div class="field"><label for="title">Title</label>
        <input id="title" name="title" value="${values.title || ''}" maxlength="140" required /></div>
      <div class="field"><label for="kind">Kind</label>${select('kind', LIBRARY_KINDS, values.kind || 'guide')}</div>
    </div>
    <div class="field"><label for="summary">One line</label>
      <input id="summary" name="summary" value="${values.summary || ''}" maxlength="200" /></div>
    <div class="field"><label for="lbody">Body</label>
      <textarea id="lbody" name="body" rows="16" required>${values.body || ''}</textarea></div>
    <div class="field"><label for="tags">Tags</label><input id="tags" name="tags" value="${values.tags || ''}" /></div>
    <button class="btn solid" type="submit">Publish</button>
  </form>`;
}

/* ----------------------------------------------------------------- intros */

export function introsPage(ctx, { incoming, outgoing }) {
  return html`<h1>Intros</h1>
  <p class="lede">A request is a promise that you have done your homework. Accepting opens a thread
    with both of you in it.</p>
  ${section('Asked of you', incoming.length ? html`<ul class="rail-list wide">${incoming.map((i) => html`<li>
    <div class="mono">${memberLink(i.requester_id)} <span class="sep">/</span> ${when(i.created_at)}
      ${pill(i.status, i.status === 'accepted' ? 'ok' : i.status === 'declined' ? 'warn' : '')}</div>
    <div class="prose small">${i.reason}</div>
    ${i.status === 'pending' ? html`<form class="inline" method="post" action="/homeroom/intros/${i.id}/resolve">
      ${csrfField(ctx)}
      <button class="btn small solid" name="decision" value="accepted" type="submit">Accept</button>
      <button class="btn small ghost" name="decision" value="declined" type="submit">Decline</button>
    </form>` : ''}
  </li>`)}</ul>` : html`<p class="mono dim">Nothing waiting.</p>`)}
  ${section('You asked for', outgoing.length ? html`<ul class="rail-list wide">${outgoing.map((i) => html`<li>
    <div class="mono">${memberLink(i.target_id)} <span class="sep">/</span> ${when(i.created_at)}
      ${pill(i.status, i.status === 'accepted' ? 'ok' : i.status === 'declined' ? 'warn' : '')}</div>
    <div class="prose small">${i.reason}</div>
  </li>`)}</ul>` : html`<p class="mono dim">You have not asked for any.</p>`)}`;
}

export function introFormPage(ctx, { target, error = null }) {
  return html`<h1>Request an intro to ${target.name || target.user_id}</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <p class="lede">Say what you want and why them. They see this before deciding.</p>
  <form class="stack" method="post" action="/homeroom/intros/new">
    ${csrfField(ctx)}
    <input type="hidden" name="to" value="${target.user_id}" />
    <div class="field"><label for="reason">Why</label>
      <textarea id="reason" name="reason" rows="6" required
        placeholder="I am scaling a 5L fermenter and you did this at Loam. Twenty minutes on contamination control."></textarea></div>
    <button class="btn solid" type="submit">Send request</button>
  </form>`;
}

/* --------------------------------------------------------------- messages */

export function messagesPage(ctx, { threads }) {
  return html`<div class="pagehead">
    <div><h1>Messages</h1><p class="lede">Direct and group threads. Nothing here is public.</p></div>
    <a class="btn solid" href="/homeroom/messages/new">New message</a>
  </div>
  ${threads.length ? html`<ul class="cards">${threads.map((t) => {
    const others = t.members.filter((m) => m !== ctx.user.id);
    return html`<li class="card convo ${t.unread ? 'unread' : ''}">
      <a class="cardlink" href="/homeroom/messages/${t.id}">
        ${avatar(others[0] || ctx.user.id, { size: 34 })}
        <div class="grow">
          <div class="name">${t.subject || others.join(', ') || 'you'}
            ${t.unread ? pill(String(t.unread), 'ok') : ''}</div>
          <div class="meta mono">${others.length > 1 ? `${others.length} members · ` : ''}${when(t.last_at)}</div>
          <p class="summary">${t.last_sender ? `${t.last_sender}: ` : ''}${(t.last_body || '').slice(0, 140)}</p>
        </div></a>
    </li>`;
  })}</ul>` : empty('No threads yet.')}`;
}

export function threadPage(ctx, { thread }) {
  const others = thread.members.filter((m) => m !== ctx.user.id);
  return html`<h1>${thread.subject || others.join(', ') || 'Thread'}</h1>
  <div class="mono dim">${thread.members.map((m) => memberLink(m))} <span class="sep">/</span> started ${when(thread.created_at)}</div>
  <div class="messages">
    ${thread.messages.length ? thread.messages.map((m) => html`<div class="msg ${m.sender_id === ctx.user.id ? 'mine' : ''}">
      <div class="mono dim">${memberLink(m.sender_id)} <span class="sep">/</span> ${when(m.created_at)}</div>
      ${body(m.body)}
    </div>`) : empty('No messages yet.')}
  </div>
  <form class="stack" method="post" action="/homeroom/messages/${thread.id}">
    ${csrfField(ctx)}
    <div class="field"><textarea name="text" rows="4" required placeholder="Write something."></textarea></div>
    <button class="btn solid" type="submit">Send</button>
  </form>`;
}

export function newMessagePage(ctx, { to = '', error = null }) {
  return html`<h1>New message</h1>
  ${error ? html`<div class="notice error">${error}</div>` : ''}
  <form class="stack" method="post" action="/homeroom/messages/new">
    ${csrfField(ctx)}
    <div class="field"><label for="to">To</label>
      <input id="to" name="to" value="${to}" required placeholder="handle, or several separated by commas" />
      <div class="hint">More than one handle makes it a group thread.</div></div>
    <div class="field"><label for="subject">Subject</label>
      <input id="subject" name="subject" maxlength="120" /></div>
    <div class="field"><label for="text">Message</label>
      <textarea id="text" name="text" rows="6" required></textarea></div>
    <button class="btn solid" type="submit">Send</button>
  </form>`;
}

/* ---------------------------------------------- notifications, saved, etc */

export function notificationsPage(ctx, { items }) {
  return html`<h1>Notifications</h1>
  ${items.length ? html`<ul class="rail-list wide">${items.map((n) => html`<li class="${n.read_at ? '' : 'unread'}">
    <a href="${raw(n.href)}">${n.text}</a>
    <span class="mono dim">${n.actor_id ? html`${n.actor_id} <span class="sep">/</span> ` : ''}${when(n.created_at)}</span>
  </li>`)}</ul>` : empty('Nothing yet.')}`;
}

export function searchPage(ctx, { query, results }) {
  const has = query && Object.values(results).some((list) => list.length);
  return html`<h1>Search</h1>
  <form class="searchbar" method="get" action="/homeroom/search">
    <input type="search" name="q" value="${query}" placeholder="people, labs, funders, perks, library" autofocus />
    <button class="btn" type="submit">Search</button>
  </form>
  ${!query ? empty('Type something. It searches every surface at once.')
    : !has ? empty(`Nothing found for “${query}”.`)
    : html`
      ${results.members.length ? section('People', html`<ul class="cards grid">${results.members.map(memberCard)}</ul>`) : ''}
      ${results.orgs.length ? section('Labs', html`<ul class="rail-list wide">${results.orgs.map((o) => html`<li>
        <a href="/homeroom/lab/${o.slug}">${o.name}</a> <span class="mono dim">${o.tagline}</span></li>`)}</ul>`) : ''}
      ${results.funders.length ? section('Funders', html`<ul class="rail-list wide">${results.funders.map((f) => html`<li>
        <a href="/homeroom/funder/${f.slug}">${f.name}</a> ${stars(f.avg_rating, { count: f.review_count })}</li>`)}</ul>`) : ''}
      ${results.deals.length ? section('Perks', html`<ul class="rail-list wide">${results.deals.map((d) => html`<li>
        <a href="/homeroom/perk/${d.slug}">${d.vendor}</a> <span class="mono dim">${d.title}</span></li>`)}</ul>`) : ''}
      ${results.library.length ? section('Library', html`<ul class="rail-list wide">${results.library.map((e) => html`<li>
        <a href="/homeroom/library/${e.slug}">${e.title}</a> <span class="mono dim">${e.summary}</span></li>`)}</ul>`) : ''}
    `}`;
}

export function aboutPage(ctx, { stats }) {
  return html`<h1>About Homeroom</h1>
  <p class="lede">Homeroom is the members-only side of Haus. The public site is the front door;
    this is the back room, where people say what a thing actually cost and which funder wasted
    three months of their life.</p>
  <div class="statstrip">
    <span><b>${stats.members}</b> members</span>
    <span><b>${stats.orgs}</b> labs</span>
    <span><b>${stats.funders}</b> funders</span>
    <span><b>${stats.reviews}</b> reviews</span>
    <span><b>${stats.deals}</b> perks</span>
    <span><b>${stats.mentors}</b> mentors</span>
    <span><b>${stats.atlas}</b> atlas labs</span>
    <span><b>${stats.modules}</b> manual modules</span>
    <span><b>${stats.jobs}</b> roles</span>
  </div>
  <h2>The rules</h2>
  <ol class="rules">
    <li><b>What is said here stays here.</b> No screenshots, no quoting members outside without asking.
      The whole value is that people can be specific.</li>
    <li><b>Answer from experience.</b> If you have not done it, say so. Speculation labelled as
      speculation is welcome; speculation dressed as fact is not.</li>
    <li><b>Reviews are about behaviour, not outcomes.</b> A funder who passed politely and fast
      deserves a better review than one who strung you along and wired.</li>
    <li><b>Anonymity is for candour, not cover.</b> Use it for the honest review. Stewards can
      still see who posted.</li>
    <li><b>Nothing that helps anyone hurt people.</b> No protocols, sequences or acquisition routes
      for agents that could cause mass harm — same line as the public side, no exceptions here either.</li>
  </ol>
  <h2>Where things live</h2>
  <p><b>Yearbook</b> for who everyone is and what they were before. <b>Labs</b> for where you can
    physically do the work: the Global Biolab Atlas for community and open-science labs worldwide,
    with an activity status a member has confirmed, and the Core Facility Finder for instrument time
    by technique. <b>Perks</b> for money you do not have to spend. <b>Funders</b> for who to talk to
    and what happened to the last person who did. <b>Mentors</b> and office hours for a real half
    hour with someone who has done it. <b>Library</b> for the Founder Manual, which is a training
    system rather than a reading list: every module ends in something you produced — and for the
    question whose answer should still be findable in a year, which is what the entries members
    write alongside it are for. Search covers all of it at once.</p>
  <p><b>Publishing.</b> Anything worth the public seeing goes out through
    <a href="/homeroom/publish">Publish to news</a>, under your handle, after a steward reads it.
    That is the only door between this room and the public site, and it only opens outward.</p>
  <p class="mono dim">Homeroom pages carry <code>noindex</code> and are invisible to logged-out visitors.
    Your email is used to sign in and to reset your password, and is never shown to other
    members.</p>`;
}

export function notFoundPage() {
  return html`<div class="empty mono">Nothing here. <a href="/homeroom">Back to the network</a>.</div>`;
}

export function errorPage(message = 'Something went wrong.') {
  return html`<div class="empty mono">${message}</div>`;
}

/*
 * The community rebuild's own pages live next door and are re-exported here, so
 * routes.js keeps its single `import * as views from './views/pages.js'`.
 */
export * from './surfaces.js';
export * from './mentordesk.js';
