// Compose a post.

import {
  page, setHTML, html, options, param, flash, readableError,
  CATEGORIES, POST_KINDS,
} from '../ui.js';
import * as api from '../api.js';

page(async (me) => {
  const orgs = await api.myOrgs(me.id);

  setHTML('#app', html`
    <h1>New post</h1>
    <p class="lede">Ask the thing you actually need answered. Specifics get specifics.</p>
    <form class="stack wide" id="form">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" name="title" required minlength="8" maxlength="160"
          value="${param('title')}"
          placeholder="Anyone got a supplier for Taq that ships to Portugal without a customs hold?">
      </div>
      <div class="row">
        <div class="field">
          <label for="kind">Type</label>
          <select id="kind" name="kind">${options(POST_KINDS, param('kind', 'question'))}</select>
        </div>
        <div class="field">
          <label for="category">Channel</label>
          <select id="category" name="category">${options(CATEGORIES, param('category', 'general'))}</select>
        </div>
      </div>
      <div class="field">
        <label for="body">Body</label>
        <textarea id="body" name="body" rows="10"
          placeholder="Context, what you already tried, and the constraint that matters."></textarea>
      </div>
      <div class="field" id="polls" hidden>
        <label for="poll">Poll options</label>
        <textarea id="poll" name="poll" rows="4" placeholder="One option per line"></textarea>
        <div class="hint">Used only when the type is Poll. Up to 8.</div>
      </div>
      <div class="row">
        <div class="field">
          <label for="tags">Tags</label>
          <input id="tags" name="tags" placeholder="crispr, sourcing, eu">
          <div class="hint">Comma separated, up to 6.</div>
        </div>
        <div class="field">
          <label for="org">Posting for</label>
          <select id="org" name="org">
            <option value="">Just me</option>
            ${orgs.map((org) => html`<option value="${org.id}">${org.name}</option>`)}
          </select>
        </div>
      </div>
      <label class="check"><input type="checkbox" name="anonymous" value="1">
        <span>Post anonymously. Your handle is hidden from other members, and the database does
        not return it — though stewards can still look it up.</span></label>
      <button class="btn" type="submit">Post to the network</button>
    </form>`);

  const kind = document.querySelector('#kind');
  const polls = document.querySelector('#polls');
  const syncPoll = () => { polls.hidden = kind.value !== 'poll'; };
  kind.addEventListener('change', syncPoll);
  syncPoll();

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const id = await api.createPost({
        title: fields.title.trim(),
        body: (fields.body ?? '').trim(),
        kind: fields.kind,
        category: fields.category,
        tags: api.parseTags(fields.tags),
        orgId: fields.org ? Number(fields.org) : null,
        anonymous: fields.anonymous === '1',
        options: (fields.poll ?? '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8),
      });
      location.href = `/homeroom/post.html?id=${id}`;
    } catch (error) {
      flash(readableError(error));
      button.disabled = false;
    }
  });
});
