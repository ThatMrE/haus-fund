// The library: answers worth writing down once.

import {
  page, setHTML, html, param, plural, options, when, labelFor,
  flash, readableError, LIBRARY_KINDS,
} from '../ui.js';
import * as api from '../api.js';
import { filterRow } from './_parts.js';

page(async (me) => {
  if (param('new') === '1') return writeForm(me);

  const kind = param('kind');
  const q = param('q');
  const entries = await api.library({ kind, q });

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Library</h1>
        <p class="lede">The answers worth writing down once. Guides, protocols, templates, and the
          arguments the network keeps rehashing.</p>
      </div>
      <a class="btn" href="/homeroom/library.html?new=1">Write one</a>
    </div>
    <form class="searchbar" method="get" action="/homeroom/library.html">
      <input type="search" name="q" value="${q}" placeholder="Search the library">
      <button class="btn" type="submit">Search</button>
    </form>
    ${filterRow(LIBRARY_KINDS, { active: kind, base: '/homeroom/library.html', param: 'kind', allLabel: 'Everything' })}
    ${entries.length ? html`<ul class="cards grid">${entries.map((entry) => html`<li class="card">
      <a class="cardlink" href="/homeroom/entry.html?slug=${entry.slug}">
        <div class="grow">
          <div class="name">${entry.title}</div>
          <div class="meta">${labelFor(LIBRARY_KINDS, entry.kind)}
            <span class="sep">/</span> ${plural(entry.reads, 'read')}
            <span class="sep">/</span> ${when(entry.updated_at)}</div>
          ${entry.summary ? html`<p class="summary">${entry.summary}</p>` : ''}
        </div></a>
    </li>`)}</ul>` : html`<div class="empty">Nothing in the library yet.</div>`}`);
});

function writeForm(me) {
  setHTML('#app', html`
    <h1>Write for the library</h1>
    <form class="stack wide" id="form">
      <div class="row">
        <div class="field"><label for="title">Title</label>
          <input id="title" name="title" required maxlength="140"></div>
        <div class="field"><label for="kind">Kind</label>
          <select id="kind" name="kind">${options(LIBRARY_KINDS, 'guide')}</select></div>
      </div>
      <div class="field"><label for="summary">One line</label>
        <input id="summary" name="summary" maxlength="200"></div>
      <div class="field"><label for="body">Body</label>
        <textarea id="body" name="body" rows="16" required minlength="40"></textarea></div>
      <div class="field"><label for="tags">Tags</label><input id="tags" name="tags"></div>
      <button class="btn" type="submit">Publish</button>
      <a class="btn ghost" href="/homeroom/library.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const created = await api.createLibraryEntry({
        title: fields.title.trim(), kind: fields.kind, summary: fields.summary.trim(),
        body: fields.body.trim(), tags: api.parseTags(fields.tags, 8), author_id: me.id,
      });
      location.href = `/homeroom/entry.html?slug=${created.slug}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
