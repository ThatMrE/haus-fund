// Deals. The code stays hidden until you claim it.

import {
  page, setHTML, html, param, plural, options, labelFor, flash, readableError, DEAL_CATEGORIES,
} from '../ui.js';
import * as api from '../api.js';
import { filterRow } from './_parts.js';

page(async (me) => {
  if (param('new') === '1') return addForm(me);

  const category = param('category');
  const q = param('q');
  const [deals, claimed] = await Promise.all([api.deals({ category, q }), api.myClaims()]);
  const mine = new Set(claimed);

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Deals</h1>
        <p class="lede">${plural(deals.length, 'live deal')} negotiated for the community.
          Claim one to reveal the code.</p>
      </div>
      <a class="btn ghost" href="/homeroom/deals.html?new=1">Add a deal</a>
    </div>
    <form class="searchbar" method="get" action="/homeroom/deals.html">
      <input type="search" name="q" value="${q}" placeholder="Vendor, or what it covers">
      <button class="btn" type="submit">Search</button>
    </form>
    ${filterRow(DEAL_CATEGORIES, { active: category, base: '/homeroom/deals.html', param: 'category', allLabel: 'Everything' })}
    ${deals.length ? html`<ul class="cards grid">${deals.map((deal) => html`<li class="card">
      <a class="cardlink" href="/homeroom/deal.html?slug=${deal.slug}">
        <div class="grow">
          <div class="name">${deal.vendor} ${mine.has(deal.id) ? html`<span class="pill good">Claimed</span>` : ''}</div>
          <div class="headline">${deal.title}</div>
          <div class="meta">${labelFor(DEAL_CATEGORIES, deal.category)}
            ${deal.worth ? html`<span class="sep">/</span> ${deal.worth}` : ''}
            <span class="sep">/</span> ${plural(deal.claims?.[0]?.count ?? 0, 'claim')}</div>
          ${deal.summary ? html`<p class="summary">${deal.summary}</p>` : ''}
        </div></a>
    </li>`)}</ul>` : html`<div class="empty">No deals in this category yet.</div>`}`);
});

function addForm(me) {
  setHTML('#app', html`
    <h1>Add a deal</h1>
    <p class="lede">Something you negotiated that other members can use too.</p>
    <form class="stack wide" id="form">
      <div class="row">
        <div class="field"><label for="vendor">Vendor</label>
          <input id="vendor" name="vendor" required maxlength="80"></div>
        <div class="field"><label for="category">Category</label>
          <select id="category" name="category">${options(DEAL_CATEGORIES, 'other')}</select></div>
      </div>
      <div class="field"><label for="title">What you get</label>
        <input id="title" name="title" required maxlength="140" placeholder="30% off oligos, no minimum"></div>
      <div class="row">
        <div class="field"><label for="worth">Worth</label>
          <input id="worth" name="worth" maxlength="60" placeholder="About 2,400 EUR a year"></div>
        <div class="field"><label for="code">Code</label>
          <input id="code" name="code" maxlength="80">
          <div class="hint">Only shown to members who claim it.</div></div>
      </div>
      <div class="field"><label for="url">Link</label><input id="url" name="url" type="url" maxlength="300"></div>
      <div class="field"><label for="summary">Summary</label>
        <input id="summary" name="summary" maxlength="200"></div>
      <div class="field"><label for="details">Details</label>
        <textarea id="details" name="details" rows="6"></textarea></div>
      <button class="btn" type="submit">Add deal</button>
      <a class="btn ghost" href="/homeroom/deals.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const created = await api.createDeal({
        vendor: fields.vendor.trim(), title: fields.title.trim(), category: fields.category,
        summary: fields.summary.trim(), details: fields.details.trim(),
        worth: fields.worth.trim(), code: fields.code.trim(),
        url: fields.url.trim() || null, posted_by: me.id,
      });
      location.href = `/homeroom/deal.html?slug=${created.slug}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
