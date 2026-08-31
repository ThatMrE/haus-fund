// The lab directory, with the "add a lab" form folded in behind ?new=1.

import {
  page, setHTML, html, param, plural, options, flash, readableError,
  ORG_KINDS, ORG_STAGES,
} from '../ui.js';
import * as api from '../api.js';
import { orgCard, pager } from './_parts.js';

page(async (me) => {
  if (param('new') === '1') return addForm(me);

  const filters = { q: param('q'), kind: param('kind'), stage: param('stage') };
  const current = Math.max(1, Number(param('p', '1')) || 1);
  const { orgs, total } = await api.orgs({ ...filters, page: current });

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Labs</h1>
        <p class="lede">${plural(total, 'lab')} in the network — startups, community labs,
          foundries, collectives and one-person garages.</p>
      </div>
      <a class="btn" href="/homeroom/labs.html?new=1">Add a lab</a>
    </div>
    <form class="searchbar" method="get" action="/homeroom/labs.html">
      <input type="search" name="q" value="${filters.q}" placeholder="Name, what they do, where they are">
      <select name="kind">${options(ORG_KINDS, filters.kind, 'Any kind')}</select>
      <select name="stage">${options(ORG_STAGES, filters.stage, 'Any stage')}</select>
      <button class="btn" type="submit">Filter</button>
    </form>
    ${orgs.length ? html`<ul class="cards grid">${orgs.map(orgCard)}</ul>`
      : html`<div class="empty">No labs match that.</div>`}
    ${pager({ page: current, total })}`);
});

function addForm(me) {
  setHTML('#app', html`
    <h1>Add a lab</h1>
    <p class="lede">You will be its first admin. Anyone else on the team can join from the lab page.</p>
    <form class="stack wide" id="form">
      <div class="field"><label for="name">Name</label>
        <input id="name" name="name" required maxlength="80"></div>
      <div class="field"><label for="tagline">One line</label>
        <input id="tagline" name="tagline" maxlength="140"
          placeholder="Cell-free protein synthesis kits for teaching labs"></div>
      <div class="row">
        <div class="field"><label for="kind">Kind</label>
          <select id="kind" name="kind">${options(ORG_KINDS, 'startup')}</select></div>
        <div class="field"><label for="stage">Stage</label>
          <select id="stage" name="stage">${options(ORG_STAGES, 'idea')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label for="location">Location</label>
          <input id="location" name="location" maxlength="80"></div>
        <div class="field"><label for="website">Website</label>
          <input id="website" name="website" type="url" maxlength="200"></div>
      </div>
      <div class="row">
        <div class="field"><label for="cohort">Cohort</label>
          <input id="cohort" name="cohort" maxlength="12"></div>
        <div class="field"><label for="founded">Founded</label>
          <input id="founded" name="founded" type="number" min="1900" max="2100"></div>
        <div class="field"><label for="headcount">Headcount</label>
          <input id="headcount" name="headcount" type="number" min="1" max="100000"></div>
      </div>
      <div class="field"><label for="description">What you do</label>
        <textarea id="description" name="description" rows="8" maxlength="8000"></textarea></div>
      <div class="field"><label for="tags">Tags</label>
        <input id="tags" name="tags" placeholder="cell-free, education, kits"></div>
      <button class="btn" type="submit">Add lab</button>
      <a class="btn ghost" href="/homeroom/labs.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      // No slug and no team row: a trigger mints the slug and makes the
      // creator the lab's first admin, which RLS will not let a client do.
      const created = await api.createOrg({
        name: fields.name.trim(),
        tagline: fields.tagline.trim(),
        description: fields.description.trim(),
        kind: fields.kind,
        stage: fields.stage,
        location: fields.location.trim(),
        website: fields.website.trim() || null,
        cohort: fields.cohort.trim() || null,
        founded: fields.founded ? Number(fields.founded) : null,
        headcount: fields.headcount ? Number(fields.headcount) : null,
        tags: api.parseTags(fields.tags, 8),
        created_by: me.id,
      });
      location.href = `/homeroom/lab.html?slug=${created.slug}`;
    } catch (error) {
      flash(readableError(error));
      button.disabled = false;
    }
  });
}
