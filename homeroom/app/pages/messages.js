// Direct and group threads.

import {
  page, setHTML, html, param, prose, when, avatar, pill, snippet,
  flash, readableError,
} from '../ui.js';
import * as api from '../api.js';

page(async (me) => {
  if (param('thread')) return threadView(me, Number(param('thread')));
  if (param('new') === '1') return composeView();

  const rows = await api.threads();
  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Messages</h1>
        <p class="lede">Direct and group threads. Nothing here is public.</p>
      </div>
      <a class="btn" href="/homeroom/messages.html?new=1">New message</a>
    </div>
    ${rows.length ? html`<ul class="cards">${rows.map((row) => {
      const others = (row.members ?? []).filter((entry) => entry.member_id !== me.id);
      const last = (row.messages ?? []).slice().sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at))[0];
      const mineEntry = (row.members ?? []).find((entry) => entry.member_id === me.id);
      const unread = (row.messages ?? []).filter((message) =>
        message.sender_id !== me.id && new Date(message.created_at) > new Date(mineEntry?.last_read_at ?? 0)).length;
      const names = others.map((entry) => entry.member?.name || entry.member?.handle).join(', ');
      return html`<li class="card">
        <a class="cardlink" href="/homeroom/messages.html?thread=${row.id}"
           style="display:flex;gap:12px;align-items:flex-start">
          ${avatar(others[0]?.member?.handle ?? me.handle)}
          <div class="grow">
            <div class="name">${row.subject || names || 'You'}
              ${unread ? pill(String(unread), 'good') : ''}</div>
            <div class="meta">${others.length > 1 ? `${others.length} members · ` : ''}${when(row.last_at)}</div>
            ${last ? html`<p class="summary">${snippet(last.body, 140)}</p>` : ''}
          </div>
        </a>
      </li>`;
    })}</ul>` : html`<div class="empty">No threads yet.</div>`}`);
});

async function threadView(me, id) {
  const [thread, rows] = await Promise.all([api.thread(id), api.messages(id)]);
  if (!thread) return setHTML('#app', html`<div class="empty">No such thread.</div>`);
  const others = (thread.members ?? []).filter((entry) => entry.member_id !== me.id);

  setHTML('#app', html`
    <h1>${thread.subject || others.map((entry) => entry.member?.name || entry.member?.handle).join(', ') || 'Thread'}</h1>
    <div class="mono">${(thread.members ?? []).map((entry) => entry.member?.handle).join(', ')}
      <span class="sep">/</span> started ${when(thread.created_at)}</div>
    <div class="messages">
      ${rows.length ? rows.map((row) => html`<div class="msg ${row.sender_id === me.id ? 'mine' : ''}">
        <div class="mono">${row.sender?.name || row.sender?.handle} <span class="sep">/</span> ${when(row.created_at)}</div>
        <div class="prose">${prose(row.body)}</div>
      </div>`) : html`<div class="empty">No messages yet.</div>`}
    </div>
    <form class="stack" id="send">
      <div class="field"><textarea name="text" rows="4" required placeholder="Write something."></textarea></div>
      <button class="btn" type="submit">Send</button>
    </form>
    <p style="margin-top:20px"><a class="linkish" href="/homeroom/messages.html">All messages</a></p>`);

  api.markThreadRead(id);

  document.querySelector('#send').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    const button = event.target.querySelector('button');
    button.disabled = true;
    try { await api.sendMessage(id, fields.text.trim()); location.reload(); }
    catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}

function composeView() {
  setHTML('#app', html`
    <h1>New message</h1>
    <form class="stack" id="form">
      <div class="field"><label for="to">To</label>
        <input id="to" name="to" required value="${param('to')}"
          placeholder="A handle, or several separated by commas">
        <div class="hint">More than one handle makes it a group thread.</div></div>
      <div class="field"><label for="subject">Subject</label>
        <input id="subject" name="subject" maxlength="120"></div>
      <div class="field"><label for="text">Message</label>
        <textarea id="text" name="text" rows="6" required></textarea></div>
      <button class="btn" type="submit">Send</button>
      <a class="btn ghost" href="/homeroom/messages.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    const handles = fields.to.split(',').map((handle) => handle.trim()).filter(Boolean);
    try {
      const thread = handles.length === 1 && !fields.subject.trim()
        ? await api.openDirectThread(handles[0])
        : await api.createGroupThread(handles, fields.subject.trim());
      await api.sendMessage(thread, fields.text.trim());
      location.href = `/homeroom/messages.html?thread=${thread}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
