// Your raise, tracked. Private to you: RLS returns nobody else's rows.

import { page, setHTML, html, when, labelFor, snippet, PIPELINE_STATUSES, FUNDER_KINDS } from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const rows = await api.pipeline();
  const byStatus = new Map(PIPELINE_STATUSES.map(([slug]) => [slug, []]));
  for (const row of rows) (byStatus.get(row.status) ?? byStatus.get('researching')).push(row);

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Pipeline</h1>
        <p class="lede">Your fundraise, tracked. Private to you — other members see none of this.</p>
      </div>
      <a class="btn ghost" href="/homeroom/funders.html">Browse funders</a>
    </div>
    ${rows.length ? html`<div class="board">${PIPELINE_STATUSES.map(([slug, label]) => html`
      <div class="column">
        <h2>${label} <b>${byStatus.get(slug).length}</b></h2>
        ${byStatus.get(slug).map((row) => html`<div class="card">
          <a href="/homeroom/funder.html?slug=${row.funder?.slug}">${row.funder?.name}</a>
          <div class="mono">${row.amount || labelFor(FUNDER_KINDS, row.funder?.kind)}</div>
          ${row.notes ? html`<div class="prose small">${snippet(row.notes, 160)}</div>` : ''}
          <div class="mono">Updated ${when(row.updated_at)}</div>
        </div>`)}
      </div>`)}</div>`
      : html`<div class="empty">Nothing tracked yet. Open a funder and add it to your pipeline.</div>`}`);
});
