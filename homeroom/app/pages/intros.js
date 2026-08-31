// Intro requests. Accepting opens a thread with both members in it.

import {
  page, setHTML, html, param, prose, when, pill, memberLink, flash, readableError,
} from '../ui.js';
import * as api from '../api.js';

page(async (me) => {
  const to = param('to');
  if (to) return requestForm(to);

  const rows = await api.intros();
  const incoming = rows.filter((row) => row.target?.handle === me.handle);
  const outgoing = rows.filter((row) => row.requester?.handle === me.handle);
  const tone = (status) => (status === 'accepted' ? 'good' : status === 'declined' ? 'bad' : '');

  setHTML('#app', html`
    <h1>Intros</h1>
    <p class="lede">A request is a claim that you have done your homework. Accepting opens a thread
      with both of you in it.</p>

    <section class="panel"><h2>Asked of you</h2>
      ${incoming.length ? html`<ul class="rail-list wide">${incoming.map((row) => html`<li>
        <div class="mono">${memberLink(row.requester)} <span class="sep">/</span> ${when(row.created_at)}
          ${pill(row.status, tone(row.status))}</div>
        <div class="prose small">${prose(row.reason)}</div>
        ${row.status === 'pending' ? html`<div class="actions" style="margin-top:10px">
          <button class="btn small js-resolve" data-id="${row.id}" data-decision="accepted" type="button">Accept</button>
          <button class="btn ghost small js-resolve" data-id="${row.id}" data-decision="declined" type="button">Decline</button>
        </div>` : ''}
      </li>`)}</ul>` : html`<p class="sm">Nothing waiting.</p>`}
    </section>

    <section class="panel"><h2>You asked for</h2>
      ${outgoing.length ? html`<ul class="rail-list wide">${outgoing.map((row) => html`<li>
        <div class="mono">${memberLink(row.target)} <span class="sep">/</span> ${when(row.created_at)}
          ${pill(row.status, tone(row.status))}</div>
        <div class="prose small">${prose(row.reason)}</div>
      </li>`)}</ul>` : html`<p class="sm">You have not asked for any.</p>`}
    </section>`);

  for (const button of document.querySelectorAll('.js-resolve')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const thread = await api.resolveIntro(Number(button.dataset.id), button.dataset.decision);
        location.href = thread ? `/homeroom/messages.html?thread=${thread}` : '/homeroom/intros.html';
      } catch (error) { flash(readableError(error)); button.disabled = false; }
    });
  }
});

async function requestForm(handle) {
  const target = await api.member(handle);
  if (!target) return setHTML('#app', html`<div class="empty">No such member.</div>`);
  setHTML('#app', html`
    <h1>Request an intro to ${target.name || target.handle}</h1>
    <p class="lede">Say what you want and why them. They see this before deciding.</p>
    <form class="stack" id="form">
      <div class="field"><label for="reason">Why</label>
        <textarea id="reason" name="reason" rows="6" required minlength="20"
          placeholder="I am scaling a 5L fermenter and you did this at Loam. Twenty minutes on contamination control."></textarea>
        <div class="hint">At least 20 characters.</div></div>
      <button class="btn" type="submit">Send request</button>
      <a class="btn ghost" href="/homeroom/profile.html?handle=${encodeURIComponent(handle)}">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      await api.requestIntro(handle, fields.reason.trim());
      location.href = '/homeroom/intros.html';
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
