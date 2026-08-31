// Replies, accepted answers, bookings, applications, intros and messages.

import { page, setHTML, html, when } from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const items = await api.notifications();
  setHTML('#app', html`
    <h1>Notifications</h1>
    ${items.length
      ? html`<ul class="rail-list wide">${items.map((row) => html`<li>
          <a href="${row.href}">${row.body}</a>
          <span class="mono">${row.actor ? html`${row.actor.handle} <span class="sep">/</span> ` : ''}${when(row.created_at)}</span>
        </li>`)}</ul>`
      : html`<div class="empty">Nothing yet.</div>`}`);
  // Marked read after rendering, so the unread ones are still visible once.
  api.markNotificationsRead();
});
