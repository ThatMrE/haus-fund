// A member's profile.

import {
  page, setHTML, html, param, prose, when, relTime, plural, avatar, pill, memberLink,
  labelFor, ORG_KINDS, flash, readableError, snippet,
} from '../ui.js';
import * as api from '../api.js';
import { postRow, votedSet, wireVotes } from './_parts.js';

page(async (me) => {
  const handle = param('handle') || me.handle;
  const profile = await api.member(handle);
  if (!profile) return setHTML('#app', html`<div class="empty">No such member.</div>`);

  const isSelf = profile.id === me.id;
  const [orgs, { posts }, slots, intros] = await Promise.all([
    api.myOrgs(profile.id),
    api.feed({ author: profile.handle, sort: 'new', limit: 8 }),
    api.slots({ upcoming: true, hostId: profile.id }),
    api.intros(),
  ]);
  const voted = await votedSet('post', posts);
  const pending = intros.some((row) =>
    row.status === 'pending' && row.requester?.handle === me.handle && row.target?.handle === profile.handle);
  const tags = (profile.expertise ?? []).map((row) => row.tag);
  const links = profile.links ?? [];

  setHTML('#app', html`
    <div class="profilehead">
      ${avatar(profile.handle, { size: 'lg' })}
      <div class="grow">
        <h1>${profile.name || profile.handle}</h1>
        <div class="mono">${profile.handle}
          ${profile.cohort ? pill(profile.cohort, 'cool') : ''}
          ${profile.is_steward ? pill('Steward', 'accent') : ''}
          <span class="sep">/</span> ${profile.karma} karma
          <span class="sep">/</span> joined ${when(profile.joined_at)}</div>
        ${profile.headline ? html`<p class="lede" style="margin-top:8px">${profile.headline}</p>` : ''}
        <div class="mono" style="margin-top:6px">
          ${profile.role ? html`${profile.role} ` : ''}${profile.org ? html`at ${profile.org}` : ''}
          ${profile.location ? html`<span class="sep">/</span> ${profile.location}` : ''}
          ${profile.bsl ? html`<span class="sep">/</span> works at ${profile.bsl}` : ''}
        </div>
      </div>
      <div class="actions">
        ${isSelf ? html`<a class="btn ghost" href="/homeroom/settings.html">Edit profile</a>` : ''}
        ${!isSelf ? html`<button class="btn ghost js-message" type="button">Message</button>` : ''}
        ${!isSelf && profile.open_intros && !pending
          ? html`<a class="btn" href="/homeroom/intros.html?to=${encodeURIComponent(profile.handle)}">Request intro</a>`
          : ''}
        ${pending ? pill('Intro requested', 'accent') : ''}
      </div>
    </div>

    <div class="openrow" style="margin-bottom:26px">
      ${profile.open_intros ? html`<span class="open">open to intros</span>` : ''}
      ${profile.open_hours ? html`<span class="open">offers office hours</span>` : ''}
      ${profile.open_collab ? html`<span class="open">open to collaborate</span>` : ''}
      ${profile.open_hiring ? html`<span class="open">open to hearing about jobs</span>` : ''}
    </div>

    <div class="cols">
      <div>
        ${profile.bio ? html`<section class="panel"><h2>About</h2><div class="prose">${prose(profile.bio)}</div></section>` : ''}
        ${profile.working_on ? html`<section class="panel"><h2>Working on</h2><div class="prose">${prose(profile.working_on)}</div></section>` : ''}
        ${profile.ask_me_about ? html`<section class="panel"><h2>Ask me about</h2><div class="prose">${prose(profile.ask_me_about)}</div></section>` : ''}
        ${posts.length ? html`<section class="panel"><h2>Posts</h2>
          <ul class="cards">${posts.map((post) => postRow(post, voted.has(post.id), me.id))}</ul></section>` : ''}
      </div>
      <aside class="rail">
        <section class="panel"><h2>Expertise</h2>
          ${tags.length
            ? html`<div class="tagcloud" style="margin:0">${tags.map(
                (tag) => html`<a class="tag" href="/homeroom/people.html?tag=${tag}">${tag}</a>`)}</div>`
            : html`<p class="sm">No tags yet.</p>`}
        </section>
        <section class="panel"><h2>Labs</h2>
          ${orgs.length
            ? html`<ul class="rail-list">${orgs.map((org) => html`<li>
                <a href="/homeroom/lab.html?slug=${org.slug}">${org.name}</a>
                <span class="mono">${org.role || labelFor(ORG_KINDS, org.kind)}</span></li>`)}</ul>`
            : html`<p class="sm">Not listed with a lab.</p>`}
        </section>
        ${slots.length ? html`<section class="panel"><h2>Office hours on offer</h2>
          <ul class="rail-list">${slots.map((slot) => html`<li>
            <a href="/homeroom/hours.html?slot=${slot.id}">${slot.title}</a>
            <span class="mono">${relTime(slot.starts_at)}</span></li>`)}</ul></section>` : ''}
        ${links.length ? html`<section class="panel"><h2>Links</h2>
          <ul class="rail-list">${links.map((link) => html`<li>
            <a href="${link}" rel="nofollow noopener ugc" target="_blank">${String(link).replace(/^https?:\/\//, '')}</a>
          </li>`)}</ul></section>` : ''}
      </aside>
    </div>`);

  wireVotes();
  document.querySelector('.js-message')?.addEventListener('click', async () => {
    try {
      const thread = await api.openDirectThread(profile.handle);
      location.href = `/homeroom/messages.html?thread=${thread}`;
    } catch (error) { flash(readableError(error)); }
  });
});
