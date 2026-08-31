// One deal. Claiming reveals the code and is counted.

import {
  page, setHTML, html, param, prose, when, stamp, plural, memberLink, labelFor,
  flash, readableError, DEAL_CATEGORIES,
} from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const deal = await api.deal(param('slug'));
  if (!deal) return setHTML('#app', html`<div class="empty">No such deal.</div>`);
  const code = await api.myDealCode(deal.id);

  const render = (revealed) => setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>${deal.vendor}</h1>
        <p class="lede">${deal.title}</p>
        <div class="mono" style="margin-top:8px">${labelFor(DEAL_CATEGORIES, deal.category)}
          ${deal.worth ? html`<span class="sep">/</span> worth ${deal.worth}` : ''}
          <span class="sep">/</span> ${plural(deal.claims?.[0]?.count ?? 0, 'member')} claimed
          <span class="sep">/</span> posted by ${memberLink(deal.poster)} ${when(deal.created_at)}
          ${deal.expires_at ? html`<span class="sep">/</span> expires ${stamp(deal.expires_at)}` : ''}</div>
      </div>
    </div>
    ${deal.summary ? html`<p class="lede">${deal.summary}</p>` : ''}
    ${deal.details ? html`<div class="prose">${prose(deal.details)}</div>` : ''}
    ${revealed
      ? html`<div class="claimbox">
          <div class="mono">Your code</div>
          <div class="code">${revealed === true ? 'No code needed — use the link.' : revealed}</div>
          ${deal.url ? html`<a class="btn" href="${deal.url}" rel="nofollow noopener" target="_blank">Go to ${deal.vendor}</a>` : ''}
        </div>`
      : html`<button class="btn js-claim" type="button">Claim this deal</button>
        <p class="sm" style="margin-top:10px">Claiming records that you took it, so the community can
          renegotiate with real numbers.</p>`}`);

  render(code === null ? null : (code || true));

  document.querySelector('.js-claim')?.addEventListener('click', async () => {
    try {
      const revealed = await api.claimDeal(deal.id);
      render(revealed || true);
    } catch (error) { flash(readableError(error)); }
  });
});
