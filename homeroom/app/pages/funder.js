// One funder: what members said, and where it sits in your raise.

import {
  page, setHTML, html, raw, param, prose, when, stars, pill, memberLink, options, labelFor,
  flash, readableError, FUNDER_KINDS, PIPELINE_STATUSES,
} from '../ui.js';
import * as api from '../api.js';

const RATINGS = [[5, '5 — excellent'], [4, '4 — good'], [3, '3 — fine'], [2, '2 — poor'], [1, '1 — unusable']]
  .map(([value, label]) => [String(value), label]);

page(async (me) => {
  const funder = await api.funder(param('slug'));
  if (!funder) return setHTML('#app', html`<div class="empty">No such funder.</div>`);

  const [reviews, mine, entry, orgs] = await Promise.all([
    api.funderReviews(funder.id), api.myReview(funder.id),
    api.pipelineEntry(funder.id), api.myOrgs(me.id),
  ]);

  setHTML('#app', html`
    <div class="profilehead">
      <div class="grow">
        <h1>${funder.name}</h1>
        <div class="mono">${labelFor(FUNDER_KINDS, funder.kind)}
          ${funder.focus ? html`<span class="sep">/</span> ${funder.focus}` : ''}
          ${funder.stages ? html`<span class="sep">/</span> ${funder.stages}` : ''}
          ${funder.check_size ? html`<span class="sep">/</span> ${funder.check_size}` : ''}
          ${funder.location ? html`<span class="sep">/</span> ${funder.location}` : ''}
          ${funder.website ? html`<span class="sep">/</span>
            <a href="${funder.website}" rel="nofollow noopener" target="_blank">Site</a>` : ''}</div>
        <div style="display:flex;gap:18px;align-items:center;margin-top:12px;flex-wrap:wrap">
          ${stars(funder.avg_rating, funder.review_count)}
          ${funder.avg_speed ? html`<span class="mono">Speed ${funder.avg_speed} of 5</span>` : ''}
          ${funder.avg_value ? html`<span class="mono">Value ${funder.avg_value} of 5</span>` : ''}
          ${funder.dilutive ? '' : pill('Non-dilutive', 'good')}
        </div>
      </div>
    </div>
    ${funder.description ? html`<div class="prose">${prose(funder.description)}</div>` : ''}

    <div class="cols">
      <div>
        <section class="panel">
          <h2>Reviews (${reviews.length})</h2>
          ${reviews.length ? html`<ul class="rail-list wide">${reviews.map((review) => html`<li>
            <div class="mono" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              ${stars(review.rating)}
              <span class="sep">/</span>
              ${review.anonymous ? html`<span class="anon">anonymous member</span>` : memberLink(review.author)}
              <span class="sep">/</span> ${when(review.created_at)}
              ${review.invested ? pill('They invested', 'good') : pill('Did not invest')}
              ${review.speed ? html`<span>Speed ${review.speed}</span>` : ''}
              ${review.value_add ? html`<span>Value ${review.value_add}</span>` : ''}
            </div>
            ${review.body ? html`<div class="prose">${prose(review.body)}</div>` : ''}
          </li>`)}</ul>` : html`<p class="sm">No reviews yet. Yours would be the first.</p>`}
        </section>

        <section class="panel">
          <h2>${mine ? 'Update your review' : 'Write a review'}</h2>
          <form class="stack" id="review">
            <div class="row">
              <div class="field"><label for="rating">Overall</label>
                <select id="rating" name="rating">${options(RATINGS, String(mine?.rating ?? 3))}</select></div>
              <div class="field"><label for="speed">Speed to decide</label>
                <select id="speed" name="speed">${options(RATINGS, String(mine?.speed ?? ''), 'Not rated')}</select></div>
              <div class="field"><label for="value_add">Value beyond money</label>
                <select id="value_add" name="value_add">${options(RATINGS, String(mine?.value_add ?? ''), 'Not rated')}</select></div>
            </div>
            <div class="field"><label for="body">What happened</label>
              <textarea id="body" name="body" rows="6"
                placeholder="How they behaved in diligence, how fast, and what they did after the wire.">${mine?.body ?? ''}</textarea></div>
            <label class="check"><input type="checkbox" name="invested" value="1" ${raw(mine?.invested ? 'checked' : '')}>
              <span>They ended up investing</span></label>
            <label class="check"><input type="checkbox" name="anonymous" value="1" ${raw(mine && !mine.anonymous ? '' : 'checked')}>
              <span>Post anonymously</span></label>
            <button class="btn" type="submit">${mine ? 'Update review' : 'Post review'}</button>
          </form>
        </section>
      </div>

      <aside class="rail">
        <section class="panel">
          <h2>Your pipeline</h2>
          <form class="stack" id="track">
            <div class="field"><label for="status">Status</label>
              <select id="status" name="status">${options(PIPELINE_STATUSES, entry?.status ?? 'researching')}</select></div>
            <div class="field"><label for="org">For which lab</label>
              <select id="org" name="org"><option value="">None</option>
                ${orgs.map((org) => html`<option value="${org.id}" ${raw(entry?.org_id === org.id ? 'selected' : '')}>${org.name}</option>`)}
              </select></div>
            <div class="field"><label for="amount">Amount</label>
              <input id="amount" name="amount" maxlength="60" value="${entry?.amount ?? ''}" placeholder="150k EUR SAFE"></div>
            <div class="field"><label for="notes">Private notes</label>
              <textarea id="notes" name="notes" rows="4" maxlength="4000">${entry?.notes ?? ''}</textarea>
              <div class="hint">Only you can read these.</div></div>
            <button class="btn" type="submit">${entry ? 'Update' : 'Track this funder'}</button>
            ${entry ? html`<button class="linkish js-untrack" type="button" style="margin-top:10px">Remove from pipeline</button>` : ''}
          </form>
        </section>
      </aside>
    </div>`);

  document.querySelector('#review').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      await api.upsertReview({
        funder_id: funder.id,
        rating: Number(fields.rating),
        speed: fields.speed ? Number(fields.speed) : null,
        value_add: fields.value_add ? Number(fields.value_add) : null,
        invested: fields.invested === '1',
        anonymous: fields.anonymous === '1',
        body: fields.body.trim(),
      });
      location.reload();
    } catch (error) { flash(readableError(error)); }
  });

  document.querySelector('#track').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      await api.upsertPipeline({
        funder_id: funder.id,
        org_id: fields.org ? Number(fields.org) : null,
        status: fields.status,
        amount: fields.amount.trim(),
        notes: fields.notes.trim(),
      });
      location.reload();
    } catch (error) { flash(readableError(error)); }
  });

  document.querySelector('.js-untrack')?.addEventListener('click', async () => {
    try { await api.removePipeline(funder.id); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
});
