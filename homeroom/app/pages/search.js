// One box over threads, people, labs, funders, deals and the library.

import { page, setHTML, html, param, stars, memberLink, labelFor, LIBRARY_KINDS } from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const query = param('q').trim();
  const results = query ? await api.search(query) : {};
  const has = Object.values(results).some((list) => Array.isArray(list) && list.length);

  const section = (title, rows, render) =>
    rows?.length ? html`<section class="panel"><h2>${title}</h2>
      <ul class="rail-list wide">${rows.map(render)}</ul></section>` : '';

  setHTML('#app', html`
    <h1>Search</h1>
    <form class="searchbar" method="get" action="/homeroom/search.html">
      <input type="search" name="q" value="${query}" autofocus
        placeholder="People, labs, threads, funders, deals, library">
      <button class="btn" type="submit">Search</button>
    </form>
    ${!query ? html`<div class="empty">Type something. It searches every surface at once.</div>`
      : !has ? html`<div class="empty">Nothing found for ${query}.</div>`
      : html`
        ${section('Threads', results.posts, (row) => html`<li>
          <a href="/homeroom/post.html?id=${row.id}">${row.title}</a>
          <span class="mono">${row.points} points <span class="sep">/</span> ${row.comment_count} replies</span></li>`)}
        ${section('People', results.members, (row) => html`<li>
          ${memberLink(row)} <span class="mono">${row.headline || ''}${row.location ? ` · ${row.location}` : ''}</span></li>`)}
        ${section('Labs', results.orgs, (row) => html`<li>
          <a href="/homeroom/lab.html?slug=${row.slug}">${row.name}</a>
          <span class="mono">${row.tagline || ''}</span></li>`)}
        ${section('Funders', results.funders, (row) => html`<li>
          <a href="/homeroom/funder.html?slug=${row.slug}">${row.name}</a>
          ${stars(row.avg_rating, row.review_count)}</li>`)}
        ${section('Deals', results.deals, (row) => html`<li>
          <a href="/homeroom/deal.html?slug=${row.slug}">${row.vendor}</a>
          <span class="mono">${row.title}</span></li>`)}
        ${section('Library', results.library, (row) => html`<li>
          <a href="/homeroom/entry.html?slug=${row.slug}">${row.title}</a>
          <span class="mono">${labelFor(LIBRARY_KINDS, row.kind)}${row.summary ? ` · ${row.summary}` : ''}</span></li>`)}`}`);
});
