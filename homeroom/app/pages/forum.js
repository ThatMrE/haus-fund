// The forum index.

import {
  page, setHTML, html, param, plural, labelFor, CATEGORIES, POST_KINDS,
} from '../ui.js';
import * as api from '../api.js';
import { postRow, votedSet, wireVotes, filterRow, pager } from './_parts.js';

page(async (me) => {
  const category = param('category');
  const kind = param('kind');
  const tag = param('tag');
  const sort = param('sort', 'hot');
  const unanswered = param('unanswered') === '1';
  const current = Math.max(1, Number(param('p', '1')) || 1);

  const [{ posts, total }, counts, tags] = await Promise.all([
    api.feed({ sort, category, kind, tag, unanswered, page: current }),
    api.categoryCounts(),
    api.tagCloud(24),
  ]);
  const voted = await votedSet('post', posts);

  const keep = (changes) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    params.delete('p');
    const qs = params.toString();
    return `/homeroom/forum.html${qs ? `?${qs}` : ''}`;
  };

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Forum</h1>
        <p class="lede">${plural(total, 'thread')}. High signal because everyone in the room
          has a bench.</p>
      </div>
      <a class="btn" href="/homeroom/ask.html">New post</a>
    </div>

    ${filterRow(CATEGORIES.map(([slug, label]) => [slug, `${label} ${counts[slug] ?? 0}`]),
      { active: category, base: '/homeroom/forum.html', param: 'category', allLabel: 'All channels' })}

    <div class="toolbar">
      <span class="mono">Sort</span>
      ${['hot', 'new', 'active', 'top', 'discussed'].map((value) =>
        html`<a class="tag ${sort === value ? 'on' : ''}" href="${keep({ sort: value === 'hot' ? '' : value })}">${value}</a>`)}
      <span class="sep">/</span>
      <span class="mono">Type</span>
      ${POST_KINDS.map(([value, label]) =>
        html`<a class="tag ${kind === value ? 'on' : ''}" href="${keep({ kind: kind === value ? '' : value })}">${label}</a>`)}
      <a class="tag ${unanswered ? 'on' : ''}" href="${keep({ unanswered: unanswered ? '' : '1' })}">Unanswered</a>
    </div>

    ${tag ? html`<div class="notice">Filtered to <b>${tag}</b>.
      <a href="${keep({ tag: '' })}">Clear</a></div>` : ''}

    ${posts.length
      ? html`<ul class="cards">${posts.map((post) => postRow(post, voted.has(post.id), me.id))}</ul>`
      : html`<div class="empty">Nothing matches. Loosen a filter, or ask it yourself.</div>`}
    ${pager({ page: current, total })}

    ${tags.length ? html`<div class="tagcloud"><span class="mono">Tags</span>
      ${tags.map(([name, count]) => html`<a class="tag ${tag === name ? 'on' : ''}"
        href="${keep({ tag: tag === name ? '' : name })}">${name} ${count}</a>`)}</div>` : ''}`);

  wireVotes();
});
