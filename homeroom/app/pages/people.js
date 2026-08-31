// The member directory. Every filter composes, which is the point of it.

import { page, setHTML, html, param, plural, options } from '../ui.js';
import * as api from '../api.js';
import { memberCard, pager } from './_parts.js';

page(async () => {
  const filters = {
    q: param('q'), tag: param('tag'), cohort: param('cohort'),
    location: param('location'), open: param('open'),
  };
  const current = Math.max(1, Number(param('p', '1')) || 1);

  const [{ members, total }, tags, cohorts] = await Promise.all([
    api.members({ ...filters, page: current }),
    api.expertiseCloud(30),
    api.cohorts(),
  ]);

  const keep = (changes) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    params.delete('p');
    const qs = params.toString();
    return `/homeroom/people.html${qs ? `?${qs}` : ''}`;
  };

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>People</h1>
        <p class="lede">${plural(total, 'member')} matching. Everyone here has tagged what they can
          actually help with — search that, not job titles.</p>
      </div>
      <a class="btn ghost" href="/homeroom/settings.html">Edit your profile</a>
    </div>

    <form class="searchbar" method="get" action="/homeroom/people.html">
      <input type="search" name="q" value="${filters.q}"
        placeholder="Name, lab, technique, what they are working on">
      <input type="text" name="location" value="${filters.location}" placeholder="Location">
      <select name="cohort">${options(cohorts.map(([name, count]) => [name, `${name} (${count})`]),
        filters.cohort, 'Any cohort')}</select>
      <button class="btn" type="submit">Filter</button>
    </form>

    <div class="toolbar">
      <span class="mono">Open to</span>
      ${[['intros', 'Intros'], ['hours', 'Office hours'], ['collab', 'Collaboration'], ['hiring', 'Hiring']]
        .map(([value, label]) => html`<a class="tag ${filters.open === value ? 'on' : ''}"
          href="${keep({ open: filters.open === value ? '' : value })}">${label}</a>`)}
    </div>

    ${tags.length ? html`<div class="tagcloud"><span class="mono">Expertise</span>
      ${tags.map(([name, count]) => html`<a class="tag ${filters.tag === name ? 'on' : ''}"
        href="${keep({ tag: filters.tag === name ? '' : name })}">${name} ${count}</a>`)}</div>` : ''}

    ${members.length
      ? html`<ul class="cards grid">${members.map(memberCard)}</ul>`
      : html`<div class="empty">Nobody matches that yet.</div>`}
    ${pager({ page: current, total })}`);
});
