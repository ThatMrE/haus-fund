// Threads you kept.

import { page, setHTML, html } from '../ui.js';
import * as api from '../api.js';
import { postRow, votedSet, wireVotes } from './_parts.js';

page(async (me) => {
  const posts = await api.savedPosts();
  const voted = await votedSet('post', posts);
  setHTML('#app', html`
    <h1>Saved</h1>
    <p class="lede">Threads you kept.</p>
    ${posts.length
      ? html`<ul class="cards">${posts.map((post) => postRow(post, voted.has(post.id), me.id))}</ul>`
      : html`<div class="empty">Nothing saved yet.</div>`}`);
  wireVotes();
});
