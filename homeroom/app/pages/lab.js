// One lab: what they do, their team, their updates and their open roles.

import {
  page, setHTML, html, param, prose, when, plural, memberLink, pill, labelFor,
  flash, readableError, ORG_KINDS, ORG_STAGES,
} from '../ui.js';
import * as api from '../api.js';
import { postRow, votedSet, wireVotes } from './_parts.js';

page(async (me) => {
  const slug = param('slug');
  const org = await api.org(slug);
  if (!org) return setHTML('#app', html`<div class="empty">No such lab.</div>`);

  const [team, updates, jobs, { posts }] = await Promise.all([
    api.orgTeam(org.id),
    api.orgUpdates(org.id),
    api.jobs({ orgId: org.id }),
    api.feed({ orgId: org.id, sort: 'new', limit: 6 }),
  ]);
  const voted = await votedSet('post', posts);
  const mine = team.find((row) => row.member_id === me.id);
  const isAdmin = !!mine?.is_admin || me.is_steward;

  setHTML('#app', html`
    <div class="profilehead">
      <div class="grow">
        <h1>${org.name}</h1>
        ${org.tagline ? html`<p class="lede">${org.tagline}</p>` : ''}
        <div class="mono" style="margin-top:8px">
          ${labelFor(ORG_KINDS, org.kind)} <span class="sep">/</span> ${labelFor(ORG_STAGES, org.stage)}
          ${org.location ? html`<span class="sep">/</span> ${org.location}` : ''}
          ${org.cohort ? html`<span class="sep">/</span> ${org.cohort}` : ''}
          ${org.founded ? html`<span class="sep">/</span> founded ${org.founded}` : ''}
          ${org.headcount ? html`<span class="sep">/</span> ${plural(org.headcount, 'person', 'people')}` : ''}
          ${org.website ? html`<span class="sep">/</span>
            <a href="${org.website}" rel="nofollow noopener" target="_blank">${String(org.website).replace(/^https?:\/\//, '')}</a>` : ''}
        </div>
      </div>
      <div class="actions">
        ${mine ? html`<button class="btn js-update" type="button">Post update</button>` : ''}
        ${!mine ? html`<button class="btn ghost js-join" type="button">I work here</button>` : ''}
        ${mine && !isAdmin ? html`<button class="btn ghost js-leave" type="button">Leave</button>` : ''}
      </div>
    </div>

    <div id="updateform"></div>

    <div class="cols">
      <div>
        ${org.description ? html`<section class="panel"><h2>What they do</h2>
          <div class="prose">${prose(org.description)}</div></section>` : ''}
        <section class="panel"><h2>Updates</h2>
          ${updates.length
            ? html`<ul class="rail-list wide">${updates.map((row) => html`<li>
                <div class="mono">${row.period ? html`${row.period} <span class="sep">/</span> ` : ''}
                  ${memberLink(row.author)} <span class="sep">/</span> ${when(row.created_at)}</div>
                <div class="prose">${prose(row.body)}</div>
                ${row.metrics ? html`<div class="metrics">${row.metrics}</div>` : ''}
                ${row.asks ? html`<div class="asks"><b>Asks</b>${row.asks}</div>` : ''}
              </li>`)}</ul>`
            : html`<p class="sm">No updates posted yet.</p>`}
        </section>
        ${posts.length ? html`<section class="panel"><h2>Threads from this lab</h2>
          <ul class="cards">${posts.map((post) => postRow(post, voted.has(post.id), me.id))}</ul>
        </section>` : ''}
      </div>
      <aside class="rail">
        <section class="panel"><h2>Team</h2>
          ${team.length
            ? html`<ul class="rail-list">${team.map((row) => html`<li>
                ${memberLink(row.member)}
                <span class="mono">${row.role || 'member'}${row.is_admin ? ' · admin' : ''}</span></li>`)}</ul>`
            : html`<p class="sm">Nobody listed.</p>`}
        </section>
        <section class="panel"><h2>Open roles</h2>
          ${jobs.length
            ? html`<ul class="rail-list">${jobs.map((job) => html`<li>
                <a href="/homeroom/jobs.html?id=${job.id}">${job.title}</a>
                <span class="mono">${job.location || 'location unlisted'}${job.remote ? ' · remote ok' : ''}</span></li>`)}</ul>`
            : html`<p class="sm">None posted.${mine ? html` <a href="/homeroom/jobs.html?new=1&org=${org.id}">Post one</a>.` : ''}</p>`}
        </section>
        ${(org.tags ?? []).length ? html`<section class="panel"><h2>Tags</h2>
          <div class="tagcloud" style="margin:0">${org.tags.map((tag) => pill(tag))}</div></section>` : ''}
      </aside>
    </div>`);

  wireVotes();

  document.querySelector('.js-join')?.addEventListener('click', async () => {
    try { await api.joinOrg(org.id, me.id); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
  document.querySelector('.js-leave')?.addEventListener('click', async () => {
    try { await api.leaveOrg(org.id, me.id); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
  document.querySelector('.js-update')?.addEventListener('click', () => {
    setHTML('#updateform', html`
      <form class="stack wide" id="uform" style="margin-bottom:26px">
        <h2>Update from ${org.name}</h2>
        <p class="sm">What moved, what did not, what you need. Short is fine.</p>
        <div class="field"><label for="period">Period</label>
          <input id="period" name="period" maxlength="40" placeholder="Week of 10 August"></div>
        <div class="field"><label for="body">Update</label>
          <textarea id="body" name="body" rows="7" required></textarea></div>
        <div class="field"><label for="metrics">Numbers</label>
          <input id="metrics" name="metrics" maxlength="200"
            placeholder="12 constructs screened · 3 hits · 9 months runway"></div>
        <div class="field"><label for="asks">Asks</label>
          <input id="asks" name="asks" maxlength="300"
            placeholder="An intro to anyone running a BSL-2 in Berlin"></div>
        <button class="btn" type="submit">Post update</button>
      </form>`);
    document.querySelector('#uform').addEventListener('submit', async (event) => {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(event.target));
      try {
        await api.createUpdate({
          org_id: org.id, author_id: me.id,
          period: fields.period.trim(), body: fields.body.trim(),
          metrics: fields.metrics.trim(), asks: fields.asks.trim(),
        });
        location.reload();
      } catch (error) { flash(readableError(error)); }
    });
    document.querySelector('#uform textarea').focus();
  });
});
