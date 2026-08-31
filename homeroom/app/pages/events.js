// Meetups, talks, workshops, demo days and open labs.

import {
  page, setHTML, html, param, options, stamp, relTime, prose, memberLink, pill, labelFor,
  toLocalInput, fromLocalInput, flash, readableError, EVENT_KINDS,
} from '../ui.js';
import * as api from '../api.js';
import { filterRow, eventRow } from './_parts.js';

page(async (me) => {
  if (param('new') === '1') return addForm(me);
  if (param('id')) return eventDetail(me, Number(param('id')));

  const kind = param('kind');
  const [upcoming, past] = await Promise.all([
    api.events({ upcoming: true, kind }), api.events({ upcoming: false, kind }),
  ]);

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Events</h1>
        <p class="lede">Meetups, open labs, demo days and talks.</p>
      </div>
      <a class="btn" href="/homeroom/events.html?new=1">Add an event</a>
    </div>
    ${filterRow(EVENT_KINDS, { active: kind, base: '/homeroom/events.html', param: 'kind', allLabel: 'Everything' })}
    ${upcoming.length ? html`<ul class="cards">${upcoming.map(eventRow)}</ul>`
      : html`<div class="empty">Nothing on the calendar.</div>`}
    ${past.length ? html`<section class="panel" style="margin-top:30px"><h2>Recently</h2>
      <ul class="rail-list wide">${past.map((row) => html`<li>
        <a href="/homeroom/events.html?id=${row.id}">${row.title}</a>
        <span class="mono">${relTime(row.starts_at)} <span class="sep">/</span>
          ${row.rsvps?.[0]?.count ?? 0} attended</span></li>`)}</ul></section>` : ''}`);
});

async function eventDetail(me, id) {
  const [row, going, mine] = await Promise.all([api.event(id), api.attendees(id), api.myRsvp(id)]);
  if (!row) return setHTML('#app', html`<div class="empty">No such event.</div>`);
  const attending = going.filter((person) => person.status === 'going');

  setHTML('#app', html`
    <h1>${row.title}</h1>
    <div class="mono">${labelFor(EVENT_KINDS, row.kind)}
      <span class="sep">/</span> hosted by ${memberLink(row.host)}
      <span class="sep">/</span> ${stamp(row.starts_at)}
      <span class="sep">/</span> ${row.minutes} minutes
      <span class="sep">/</span> ${relTime(row.starts_at)}
      ${row.canceled ? html`<span class="sep">/</span> <b class="warn">canceled</b>` : ''}</div>
    ${row.place ? html`<p class="mono" style="margin-top:10px">Where: ${row.place}</p>` : ''}
    ${row.url ? html`<p style="margin-top:6px"><a href="${row.url}" rel="nofollow noopener" target="_blank">${row.url}</a></p>` : ''}
    ${row.description ? html`<div class="prose" style="margin-top:14px">${prose(row.description)}</div>` : ''}

    ${row.canceled ? html`<div class="notice bad">Canceled.</div>` : html`
      <div class="actions" style="margin:22px 0">
        <button class="btn ${mine === 'going' ? '' : 'ghost'} js-rsvp" data-status="going" type="button">Going</button>
        <button class="btn ${mine === 'maybe' ? '' : 'ghost'} js-rsvp" data-status="maybe" type="button">Maybe</button>
        <button class="btn ghost js-rsvp" data-status="none" type="button">Not going</button>
        ${row.capacity ? html`<span class="mono">${attending.length} of ${row.capacity} places</span>` : ''}
      </div>`}

    <section class="panel"><h2>Attending (${attending.length})</h2>
      ${going.length ? html`<ul class="rail-list">${going.map((person) => html`<li>
        ${memberLink(person.member)} <span class="mono">${person.status}${
          person.member?.headline ? ` · ${person.member.headline}` : ''}</span></li>`)}</ul>`
        : html`<p class="sm">Nobody has said yes yet.</p>`}
    </section>

    ${row.host_id === me.id && !row.canceled
      ? html`<button class="btn ghost js-cancel" type="button">Cancel event</button>` : ''}
    <p style="margin-top:24px"><a class="linkish" href="/homeroom/events.html">Back to events</a></p>`);

  for (const button of document.querySelectorAll('.js-rsvp')) {
    button.addEventListener('click', async () => {
      try { await api.rsvp(id, button.dataset.status); location.reload(); }
      catch (error) { flash(readableError(error)); }
    });
  }
  document.querySelector('.js-cancel')?.addEventListener('click', async () => {
    if (!confirm('Cancel this event?')) return;
    try { await api.cancelEvent(id); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
}

function addForm(me) {
  const suggested = toLocalInput(Date.now() + 7 * 86400e3);
  setHTML('#app', html`
    <h1>Add an event</h1>
    <p class="lede">Times are UTC.</p>
    <form class="stack wide" id="form">
      <div class="field"><label for="title">Title</label>
        <input id="title" name="title" required maxlength="140"></div>
      <div class="row">
        <div class="field"><label for="kind">Kind</label>
          <select id="kind" name="kind">${options(EVENT_KINDS, 'meetup')}</select></div>
        <div class="field"><label for="starts_at">Starts (UTC)</label>
          <input id="starts_at" name="starts_at" type="datetime-local" required value="${suggested}"></div>
        <div class="field"><label for="minutes">Minutes</label>
          <input id="minutes" name="minutes" type="number" min="15" max="1440" value="120"></div>
      </div>
      <div class="row">
        <div class="field"><label for="place">Where</label>
          <input id="place" name="place" maxlength="200"></div>
        <div class="field"><label for="capacity">Capacity</label>
          <input id="capacity" name="capacity" type="number" min="0" max="10000" value="0">
          <div class="hint">0 for unlimited.</div></div>
      </div>
      <div class="field"><label for="url">Link</label><input id="url" name="url" type="url" maxlength="300"></div>
      <div class="field"><label for="description">Details</label>
        <textarea id="description" name="description" rows="7"></textarea></div>
      <button class="btn" type="submit">Add event</button>
      <a class="btn ghost" href="/homeroom/events.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const created = await api.createEvent({
        host_id: me.id, title: fields.title.trim(), kind: fields.kind,
        starts_at: fromLocalInput(fields.starts_at), minutes: Number(fields.minutes) || 90,
        place: fields.place.trim(), url: fields.url.trim() || null,
        capacity: Number(fields.capacity) || 0, description: fields.description.trim(),
      });
      await api.rsvp(created.id, 'going').catch(() => {});
      location.href = `/homeroom/events.html?id=${created.id}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
