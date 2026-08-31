// The dashboard: what is live in the forum, and what is waiting on you.

import { page, setHTML, html, plural, when, relTime, labelFor, ORG_STAGES, snippet, memberLink } from '../ui.js';
import * as api from '../api.js';
import { postRow, votedSet, wireVotes } from './_parts.js';

page(async (me) => {
  const [{ posts }, stats, slots, events, orgs, deals, updates, answerers, intros, unanswered] =
    await Promise.all([
      api.feed({ sort: 'hot', limit: 12 }),
      api.networkStats(),
      api.slots({ upcoming: true }),
      api.events({ upcoming: true }),
      api.myOrgs(me.id),
      api.deals({}),
      api.recentUpdates(3),
      api.topAnswerers(6),
      api.intros(),
      api.feed({ unanswered: true, kind: 'question', limit: 1 }),
    ]);

  const voted = await votedSet('post', posts);
  const waiting = intros.filter((row) => row.status === 'pending' && row.target?.handle === me.handle);
  const thin = !me.headline || !(me.expertise ?? []).length;

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>${me.name || me.handle}</h1>
        <p class="lede">${stats.members} members, ${stats.orgs} labs, ${stats.posts} threads,
          ${stats.reviews} funder reviews on file.</p>
      </div>
      <div class="actions">
        <a class="btn" href="/homeroom/ask.html">Ask the network</a>
        <a class="btn ghost" href="/homeroom/people.html">Find an expert</a>
      </div>
    </div>

    ${thin ? html`<div class="notice">Your profile is thin.
      <a href="/homeroom/settings.html">Add a headline and a few expertise tags</a> — the directory
      is the whole point, and it only works if people can find you.</div>` : ''}

    ${waiting.length ? html`<div class="notice">${plural(waiting.length, 'intro request')} waiting on you.
      <a href="/homeroom/intros.html">Answer ${waiting.length === 1 ? 'it' : 'them'}</a>.</div>` : ''}

    <div class="cols">
      <div>
        <section class="panel">
          <h2><a href="/homeroom/forum.html">Live in the forum</a></h2>
          ${posts.length
            ? html`<ul class="cards">${posts.map((post) => postRow(post, voted.has(post.id), me.id))}</ul>`
            : html`<div class="empty">Nothing yet. Be the first to ask something.</div>`}
        </section>

        ${updates.length ? html`<section class="panel">
          <h2><a href="/homeroom/labs.html">Lab updates</a></h2>
          <ul class="rail-list wide">${updates.map((row) => html`<li>
            <div class="title-line"><a href="/homeroom/lab.html?slug=${row.org?.slug}">${row.org?.name}</a>
              ${row.period ? html`<span class="mono">${row.period}</span>` : ''}</div>
            <div class="prose small">${snippet(row.body, 280)}</div>
            <span class="mono">${memberLink(row.author)} <span class="sep">/</span> ${when(row.created_at)}</span>
          </li>`)}</ul>
        </section>` : ''}
      </div>

      <aside class="rail">
        <section class="panel">
          <h2><a href="/homeroom/labs.html">Your labs</a></h2>
          ${orgs.length
            ? html`<ul class="rail-list">${orgs.map((org) => html`<li>
                <a href="/homeroom/lab.html?slug=${org.slug}">${org.name}</a>
                <span class="mono">${labelFor(ORG_STAGES, org.stage)}</span></li>`)}</ul>`
            : html`<p class="sm">None yet. <a href="/homeroom/labs.html?new=1">Add your lab</a>.</p>`}
        </section>

        <section class="panel">
          <h2><a href="/homeroom/hours.html">Next office hours</a></h2>
          ${slots.length
            ? html`<ul class="rail-list">${slots.slice(0, 5).map((slot) => html`<li>
                <a href="/homeroom/hours.html?slot=${slot.id}">${slot.title}</a>
                <span class="mono">${relTime(slot.starts_at)} <span class="sep">/</span>
                  ${slot.bookings?.[0]?.count ?? 0} of ${slot.capacity} booked</span></li>`)}</ul>`
            : html`<p class="sm">No sessions posted. <a href="/homeroom/hours.html?new=1">Offer some</a>.</p>`}
        </section>

        <section class="panel">
          <h2><a href="/homeroom/events.html">Upcoming events</a></h2>
          ${events.length
            ? html`<ul class="rail-list">${events.slice(0, 5).map((row) => html`<li>
                <a href="/homeroom/events.html?id=${row.id}">${row.title}</a>
                <span class="mono">${relTime(row.starts_at)} <span class="sep">/</span>
                  ${row.rsvps?.[0]?.count ?? 0} going</span></li>`)}</ul>`
            : html`<p class="sm">Nothing scheduled.</p>`}
        </section>

        <section class="panel">
          <h2><a href="/homeroom/deals.html">Fresh deals</a></h2>
          ${deals.length
            ? html`<ul class="rail-list">${deals.slice(0, 5).map((deal) => html`<li>
                <a href="/homeroom/deal.html?slug=${deal.slug}">${deal.vendor}</a>
                <span class="mono">${deal.worth || deal.title}</span></li>`)}</ul>`
            : html`<p class="sm">No deals yet.</p>`}
        </section>

        <section class="panel">
          <h2>Answering the most</h2>
          ${answerers?.length
            ? html`<ul class="rail-list">${answerers.map((row) => html`<li>
                <a href="/homeroom/profile.html?handle=${encodeURIComponent(row.handle)}">${row.name || row.handle}</a>
                <span class="mono">${plural(Number(row.answers), 'reply', 'replies')}
                  <span class="sep">/</span> ${row.points} points</span></li>`)}</ul>`
            : html`<p class="sm">Quiet month.</p>`}
        </section>

        ${unanswered.total ? html`<section class="panel">
          <h2>Needs an answer</h2>
          <p class="sm">${plural(unanswered.total, 'question')} with no replies yet.
            <a href="/homeroom/forum.html?unanswered=1">Take one</a>.</p>
        </section>` : ''}
      </aside>
    </div>`);

  wireVotes();
});
