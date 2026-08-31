// The funder database, sorted by what members actually said about them.

import {
  page, setHTML, html, param, plural, options, stars, pill, labelFor,
  flash, readableError, FUNDER_KINDS,
} from '../ui.js';
import * as api from '../api.js';
import { pager } from './_parts.js';

page(async (me) => {
  if (param('new') === '1') return addForm(me);

  const filters = { q: param('q'), kind: param('kind'), sort: param('sort', 'rating') };
  const current = Math.max(1, Number(param('p', '1')) || 1);
  const [{ funders, total }, tracked] = await Promise.all([
    api.funders({ ...filters, page: current }),
    api.pipeline(),
  ]);
  const inPipeline = new Set(tracked.map((row) => row.funder_id));

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Funders</h1>
        <p class="lede">${plural(total, 'funder')} on file, rated by members who actually took their
          money — or did not. Reviews are anonymous by default.</p>
      </div>
      <div class="actions">
        <a class="btn ghost" href="/homeroom/pipeline.html">Your pipeline</a>
        <a class="btn" href="/homeroom/funders.html?new=1">Add a funder</a>
      </div>
    </div>
    <form class="searchbar" method="get" action="/homeroom/funders.html">
      <input type="search" name="q" value="${filters.q}" placeholder="Name, thesis, geography">
      <select name="kind">${options(FUNDER_KINDS, filters.kind, 'Any kind')}</select>
      <select name="sort">${options([['rating', 'Best rated'], ['reviews', 'Most reviewed'],
        ['name', 'Name'], ['new', 'Newest']], filters.sort)}</select>
      <button class="btn" type="submit">Filter</button>
    </form>
    ${funders.length ? html`<ul class="cards">${funders.map((funder) => html`<li class="card">
      <div class="grow">
        <div class="title-line"><a href="/homeroom/funder.html?slug=${funder.slug}">${funder.name}</a>
          ${pill(labelFor(FUNDER_KINDS, funder.kind))}
          ${funder.dilutive ? '' : pill('Non-dilutive', 'good')}
          ${inPipeline.has(funder.id) ? pill('In your pipeline', 'cool') : ''}</div>
        <div class="subline">${funder.focus || 'no stated focus'}
          ${funder.stages ? html`<span class="sep">/</span> ${funder.stages}` : ''}
          ${funder.check_size ? html`<span class="sep">/</span> ${funder.check_size}` : ''}
          ${funder.location ? html`<span class="sep">/</span> ${funder.location}` : ''}</div>
      </div>
      <div>${stars(funder.avg_rating, funder.review_count)}</div>
    </li>`)}</ul>` : html`<div class="empty">Nothing matches. Add the funder and be the first to review it.</div>`}
    ${pager({ page: current, total })}`);
});

function addForm(me) {
  setHTML('#app', html`
    <h1>Add a funder</h1>
    <p class="lede">Grants and prizes count. So do the funds nobody warns you about.</p>
    <form class="stack wide" id="form">
      <div class="row">
        <div class="field"><label for="name">Name</label>
          <input id="name" name="name" required maxlength="120"></div>
        <div class="field"><label for="kind">Kind</label>
          <select id="kind" name="kind">${options(FUNDER_KINDS, 'vc')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label for="focus">Focus</label>
          <input id="focus" name="focus" maxlength="140" placeholder="Synbio tooling, biomanufacturing"></div>
        <div class="field"><label for="stages">Stages</label>
          <input id="stages" name="stages" maxlength="80" placeholder="pre-seed, seed"></div>
      </div>
      <div class="row">
        <div class="field"><label for="check_size">Cheque size</label>
          <input id="check_size" name="check_size" maxlength="60"></div>
        <div class="field"><label for="location">Location</label>
          <input id="location" name="location" maxlength="80"></div>
        <div class="field"><label for="website">Website</label>
          <input id="website" name="website" type="url" maxlength="200"></div>
      </div>
      <div class="field"><label for="description">Notes</label>
        <textarea id="description" name="description" rows="6"></textarea></div>
      <label class="check"><input type="checkbox" name="nondilutive" value="1">
        <span>Non-dilutive: a grant, prize or foundation</span></label>
      <button class="btn" type="submit">Add funder</button>
      <a class="btn ghost" href="/homeroom/funders.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const created = await api.createFunder({
        name: fields.name.trim(), kind: fields.kind, focus: fields.focus.trim(),
        stages: fields.stages.trim(), check_size: fields.check_size.trim(),
        location: fields.location.trim(), website: fields.website.trim() || null,
        description: fields.description.trim(), dilutive: fields.nondilutive !== '1',
        added_by: me.id,
      });
      location.href = `/homeroom/funder.html?slug=${created.slug}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
