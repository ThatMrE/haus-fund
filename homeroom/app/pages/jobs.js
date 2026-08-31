// Roles across the network. Every role hangs off a lab.

import {
  page, setHTML, html, raw, param, plural, options, when, prose, memberLink, labelFor,
  flash, readableError, JOB_DISCIPLINES,
} from '../ui.js';
import * as api from '../api.js';

const EMPLOYMENT = [['full-time', 'Full time'], ['part-time', 'Part time'],
  ['contract', 'Contract'], ['intern', 'Internship']];

page(async (me) => {
  if (param('new') === '1') return postForm(me);
  if (param('id')) return jobDetail(me, Number(param('id')));

  const filters = { q: param('q'), discipline: param('discipline'), remote: param('remote') === '1' };
  const [rows, orgs, applied] = await Promise.all([
    api.jobs(filters), api.myOrgs(me.id), api.myApplications(),
  ]);
  const mine = new Set(applied);

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Jobs</h1>
        <p class="lede">${plural(rows.length, 'open role')} across the network. Members only,
          so you can ask the founder directly.</p>
      </div>
      ${orgs.length
        ? html`<a class="btn" href="/homeroom/jobs.html?new=1">Post a role</a>`
        : html`<a class="btn ghost" href="/homeroom/labs.html?new=1">Add your lab to post roles</a>`}
    </div>
    <form class="searchbar" method="get" action="/homeroom/jobs.html">
      <input type="search" name="q" value="${filters.q}" placeholder="Title, lab, skill">
      <select name="discipline">${options(JOB_DISCIPLINES, filters.discipline, 'Any discipline')}</select>
      <label class="check" style="margin:0"><input type="checkbox" name="remote" value="1"
        ${raw(filters.remote ? 'checked' : '')}> <span>Remote ok</span></label>
      <button class="btn" type="submit">Filter</button>
    </form>
    ${rows.length ? html`<ul class="cards">${rows.map((job) => html`<li class="card"><div class="grow">
      <div class="title-line"><a href="/homeroom/jobs.html?id=${job.id}">${job.title}</a>
        <a class="tag" href="/homeroom/lab.html?slug=${job.org?.slug}">${job.org?.name}</a>
        ${mine.has(job.id) ? html`<span class="pill good">Applied</span>` : ''}</div>
      <div class="subline">${labelFor(JOB_DISCIPLINES, job.discipline)}
        <span class="sep">/</span> ${job.employment}
        <span class="sep">/</span> ${job.location || 'location unlisted'}${job.remote ? ' · remote ok' : ''}
        ${job.comp ? html`<span class="sep">/</span> ${job.comp}` : ''}
        <span class="sep">/</span> ${when(job.created_at)}</div>
    </div></li>`)}</ul>` : html`<div class="empty">No roles match that.</div>`}`);
});

async function jobDetail(me, id) {
  const job = await api.job(id);
  if (!job) return setHTML('#app', html`<div class="empty">No such role.</div>`);
  const team = await api.orgTeam(job.org.id);
  const canManage = job.posted_by === me.id || team.some((row) => row.member_id === me.id && row.is_admin);
  const [applicants, applied] = await Promise.all([
    canManage ? api.jobApplicants(id) : Promise.resolve([]),
    api.myApplications(),
  ]);
  const hasApplied = applied.includes(id);

  setHTML('#app', html`
    <h1>${job.title}</h1>
    <div class="mono"><a href="/homeroom/lab.html?slug=${job.org?.slug}">${job.org?.name}</a>
      <span class="sep">/</span> ${labelFor(JOB_DISCIPLINES, job.discipline)}
      <span class="sep">/</span> ${job.employment}
      <span class="sep">/</span> ${job.location || 'location unlisted'}${job.remote ? ' · remote ok' : ''}
      ${job.comp ? html`<span class="sep">/</span> ${job.comp}` : ''}
      ${job.equity ? html`<span class="sep">/</span> ${job.equity} equity` : ''}
      <span class="sep">/</span> posted ${when(job.created_at)}</div>
    ${job.description ? html`<div class="prose" style="margin-top:16px">${prose(job.description)}</div>` : ''}

    ${job.closed ? html`<div class="notice">This role is closed.</div>`
      : hasApplied ? html`<div class="notice">You applied. The team can see your profile and note.</div>`
      : html`<form class="stack" id="apply" style="margin-top:22px">
          <div class="field"><label for="note">Note to the team</label>
            <textarea id="note" name="note" rows="5"
              placeholder="What you have built that is closest to this."></textarea></div>
          <button class="btn" type="submit">Apply</button>
        </form>`}

    ${canManage ? html`<section class="panel" style="margin-top:30px">
      <h2>Applicants (${applicants.length})</h2>
      ${applicants.length ? html`<ul class="rail-list wide">${applicants.map((row) => html`<li>
        ${memberLink(row.member)} <span class="mono">${row.member?.headline ?? ''}
          <span class="sep">/</span> ${when(row.created_at)}</span>
        ${row.note ? html`<div class="prose small">${prose(row.note)}</div>` : ''}
      </li>`)}</ul>` : html`<p class="sm">Nobody yet.</p>`}
      <button class="btn ghost js-close" type="button" style="margin-top:14px">${job.closed ? 'Reopen' : 'Close'} this role</button>
    </section>` : ''}
    <p style="margin-top:24px"><a class="linkish" href="/homeroom/jobs.html">Back to jobs</a></p>`);

  document.querySelector('#apply')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    try { await api.applyToJob(id, fields.note.trim()); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
  document.querySelector('.js-close')?.addEventListener('click', async () => {
    try { await api.closeJob(id, !job.closed); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
}

async function postForm(me) {
  const orgs = await api.myOrgs(me.id);
  if (!orgs.length) {
    return setHTML('#app', html`<div class="empty">Add your lab first — roles hang off a lab.</div>`);
  }
  const preselect = param('org');
  setHTML('#app', html`
    <h1>Post a role</h1>
    <form class="stack wide" id="form">
      <div class="row">
        <div class="field"><label for="org">Lab</label>
          <select id="org" name="org">${orgs.map((org) =>
            html`<option value="${org.id}" ${raw(String(org.id) === preselect ? 'selected' : '')}>${org.name}</option>`)}</select></div>
        <div class="field"><label for="discipline">Discipline</label>
          <select id="discipline" name="discipline">${options(JOB_DISCIPLINES, 'wetlab')}</select></div>
      </div>
      <div class="field"><label for="title">Title</label>
        <input id="title" name="title" required maxlength="120"></div>
      <div class="row">
        <div class="field"><label for="employment">Employment</label>
          <select id="employment" name="employment">${options(EMPLOYMENT, 'full-time')}</select></div>
        <div class="field"><label for="location">Location</label>
          <input id="location" name="location" maxlength="80"></div>
        <div class="field"><label for="comp">Compensation</label>
          <input id="comp" name="comp" maxlength="60"></div>
        <div class="field"><label for="equity">Equity</label>
          <input id="equity" name="equity" maxlength="40"></div>
      </div>
      <label class="check"><input type="checkbox" name="remote" value="1"> <span>Remote is fine</span></label>
      <div class="field"><label for="description">The role</label>
        <textarea id="description" name="description" rows="9"></textarea></div>
      <div class="field"><label for="tags">Tags</label><input id="tags" name="tags"></div>
      <button class="btn" type="submit">Post role</button>
      <a class="btn ghost" href="/homeroom/jobs.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const created = await api.createJob({
        org_id: Number(fields.org), posted_by: me.id, title: fields.title.trim(),
        discipline: fields.discipline, employment: fields.employment,
        location: fields.location.trim(), remote: fields.remote === '1',
        comp: fields.comp.trim(), equity: fields.equity.trim(),
        description: fields.description.trim(), tags: api.parseTags(fields.tags, 8),
      });
      location.href = `/homeroom/jobs.html?id=${created.id}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
