// One library entry.

import { page, setHTML, html, param, prose, when, plural, memberLink, pill, labelFor, LIBRARY_KINDS } from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const entry = await api.libraryEntry(param('slug'));
  if (!entry) return setHTML('#app', html`<div class="empty">No such entry.</div>`);
  api.bumpReads(entry.id);

  setHTML('#app', html`<article class="doc">
    <h1>${entry.title}</h1>
    <div class="mono">${labelFor(LIBRARY_KINDS, entry.kind)}
      ${entry.author ? html`<span class="sep">/</span> ${memberLink(entry.author)}` : ''}
      <span class="sep">/</span> updated ${when(entry.updated_at)}
      <span class="sep">/</span> ${plural(entry.reads, 'read')}</div>
    ${entry.summary ? html`<p class="lede" style="margin-top:12px">${entry.summary}</p>` : ''}
    <div class="prose" style="margin-top:18px">${prose(entry.body)}</div>
    ${(entry.tags ?? []).length ? html`<div class="tagcloud">${entry.tags.map((tag) => pill(tag))}</div>` : ''}
    <p style="margin-top:24px"><a class="linkish" href="/homeroom/library.html">Back to the library</a></p>
  </article>`);
});
