// Office hours: offer a session, or book half an hour with someone.

import {
  page, setHTML, html, param, plural, options, stamp, relTime, memberLink, pill, prose,
  toLocalInput, fromLocalInput, flash, readableError,
} from '../ui.js';
import * as api from '../api.js';

page(async (me) => {
  if (param('new') === '1') return offerForm();
  if (param('slot')) return slotDetail(me, Number(param('slot')));

  const [slots, mine] = await Promise.all([api.slots({ upcoming: true }), api.myBookings()]);
  const hosting = slots.filter((slot) => slot.host_id === me.id);
  const open = slots.filter((slot) => slot.host_id !== me.id);

  setHTML('#app', html`
    <div class="pagehead">
      <div>
        <h1>Office hours</h1>
        <p class="lede">Book half an hour with someone who has already done the thing you are
          about to do.</p>
      </div>
      <a class="btn" href="/homeroom/hours.html?new=1">Offer office hours</a>
    </div>

    ${mine.length ? html`<section class="panel"><h2>Your bookings</h2>
      <ul class="rail-list wide">${mine.map((slot) => html`<li>
        <a href="/homeroom/hours.html?slot=${slot.id}">${slot.title}</a> with ${memberLink(slot.host)}
        <span class="mono">${stamp(slot.starts_at)} <span class="sep">/</span> ${relTime(slot.starts_at)}</span>
      </li>`)}</ul></section>` : ''}

    ${hosting.length ? html`<section class="panel"><h2>You are hosting</h2>
      <ul class="rail-list wide">${hosting.map((slot) => html`<li>
        <a href="/homeroom/hours.html?slot=${slot.id}">${slot.title}</a>
        <span class="mono">${stamp(slot.starts_at)} <span class="sep">/</span>
          ${slot.bookings?.[0]?.count ?? 0} of ${slot.capacity} booked</span>
      </li>`)}</ul></section>` : ''}

    <section class="panel"><h2>Open sessions</h2>
      ${open.length ? html`<ul class="cards">${open.map((slot) => {
        const booked = slot.bookings?.[0]?.count ?? 0;
        return html`<li class="card"><div class="grow">
          <div class="title-line"><a href="/homeroom/hours.html?slot=${slot.id}">${slot.title}</a>
            ${pill(slot.format === 'group' ? 'Group' : 'One on one')}
            ${booked >= slot.capacity ? pill('Full', 'bad') : pill(`${slot.capacity - booked} left`, 'good')}</div>
          <div class="subline">${memberLink(slot.host)}
            <span class="sep">/</span> ${stamp(slot.starts_at)}
            <span class="sep">/</span> ${slot.minutes} minutes
            <span class="sep">/</span> ${relTime(slot.starts_at)}
            ${slot.topics ? html`<span class="sep">/</span> ${slot.topics}` : ''}</div>
        </div></li>`;
      })}</ul>` : html`<div class="empty">No open sessions. Offer some yourself — that is how this fills up.</div>`}
    </section>`);
});

async function slotDetail(me, id) {
  const [slot, bookings] = await Promise.all([api.slot(id), api.slotBookings(id)]);
  if (!slot) return setHTML('#app', html`<div class="empty">No such session.</div>`);
  const isHost = slot.host_id === me.id;
  const booked = bookings.some((row) => row.member_id === me.id);

  setHTML('#app', html`
    <h1>${slot.title}</h1>
    <div class="mono">${memberLink(slot.host)}
      <span class="sep">/</span> ${stamp(slot.starts_at)}
      <span class="sep">/</span> ${slot.minutes} minutes
      <span class="sep">/</span> ${slot.format === 'group' ? 'group session' : 'one on one'}
      <span class="sep">/</span> ${bookings.length} of ${slot.capacity} booked
      ${slot.canceled ? html`<span class="sep">/</span> <b class="warn">canceled</b>` : ''}</div>
    ${slot.topics ? html`<p class="mono" style="margin-top:10px">${slot.topics}</p>` : ''}
    ${slot.description ? html`<div class="prose" style="margin-top:14px">${prose(slot.description)}</div>` : ''}
    ${slot.place ? html`<p class="sm" style="margin-top:10px">Where: ${slot.place}</p>` : ''}

    ${slot.canceled ? html`<div class="notice bad">This session was canceled.</div>`
      : isHost ? html`
        <section class="panel" style="margin-top:26px"><h2>Who booked</h2>
          ${bookings.length ? html`<ul class="rail-list wide">${bookings.map((row) => html`<li>
            ${memberLink(row.member)} <span class="mono">${relTime(row.created_at)}</span>
            ${row.question ? html`<div class="prose small">${prose(row.question)}</div>` : ''}
          </li>`)}</ul>` : html`<p class="sm">Nobody yet.</p>`}
        </section>
        <button class="btn ghost js-cancel" type="button">Cancel session</button>`
      : booked ? html`
        <div class="notice">You are booked. It is on you to show up.</div>
        <button class="btn ghost js-unbook" type="button">Give up my slot</button>`
      : bookings.length >= slot.capacity ? html`<div class="notice">Full.</div>`
      : html`<form class="stack" id="book" style="margin-top:22px">
          <div class="field"><label for="question">What do you want out of it?</label>
            <textarea id="question" name="question" rows="4"
              placeholder="One concrete question beats a general chat."></textarea></div>
          <button class="btn" type="submit">Book this session</button>
        </form>`}
    <p style="margin-top:24px"><a class="linkish" href="/homeroom/hours.html">Back to office hours</a></p>`);

  document.querySelector('#book')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    try { await api.bookSlot(id, fields.question.trim()); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
  document.querySelector('.js-unbook')?.addEventListener('click', async () => {
    try { await api.cancelBooking(id, me.id); location.reload(); }
    catch (error) { flash(readableError(error)); }
  });
  document.querySelector('.js-cancel')?.addEventListener('click', async () => {
    if (!confirm('Cancel this session for everyone who booked?')) return;
    try { await api.cancelSlot(id); location.href = '/homeroom/hours.html'; }
    catch (error) { flash(readableError(error)); }
  });
}

function offerForm() {
  const suggested = toLocalInput(Date.now() + 3 * 86400e3);
  setHTML('#app', html`
    <h1>Offer office hours</h1>
    <p class="lede">Pick a time, say what you can help with, and let people book it. Times are UTC.</p>
    <form class="stack wide" id="form">
      <div class="field"><label for="title">Title</label>
        <input id="title" name="title" required maxlength="120"
          placeholder="Scaling fermentation from 1L to 100L — ask me anything"></div>
      <div class="row">
        <div class="field"><label for="starts_at">Starts (UTC)</label>
          <input id="starts_at" name="starts_at" type="datetime-local" required value="${suggested}"></div>
        <div class="field"><label for="minutes">Minutes</label>
          <input id="minutes" name="minutes" type="number" min="10" max="240" value="30"></div>
      </div>
      <div class="row">
        <div class="field"><label for="format">Format</label>
          <select id="format" name="format">${options([['one-on-one', 'One on one'], ['group', 'Group']], 'one-on-one')}</select></div>
        <div class="field"><label for="capacity">Capacity</label>
          <input id="capacity" name="capacity" type="number" min="1" max="50" value="1"></div>
      </div>
      <div class="field"><label for="place">Where</label>
        <input id="place" name="place" maxlength="200" placeholder="A video link, or a bench in Lisbon"></div>
      <div class="field"><label for="topics">Topics</label>
        <input id="topics" name="topics" maxlength="140" placeholder="fermentation, scale-up, CMOs"></div>
      <div class="field"><label for="description">Details</label>
        <textarea id="description" name="description" rows="5"></textarea></div>
      <button class="btn" type="submit">Post session</button>
      <a class="btn ghost" href="/homeroom/hours.html">Cancel</a>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      const { data: user } = await (await import('../client.js')).supabase.auth.getUser();
      const format = fields.format;
      const created = await api.createSlot({
        host_id: user.user.id,
        title: fields.title.trim(),
        description: fields.description.trim(),
        format,
        starts_at: fromLocalInput(fields.starts_at),
        minutes: Number(fields.minutes) || 30,
        capacity: format === 'group' ? (Number(fields.capacity) || 5) : 1,
        place: fields.place.trim(),
        topics: fields.topics.trim(),
      });
      location.href = `/homeroom/hours.html?slot=${created.id}`;
    } catch (error) { flash(readableError(error)); button.disabled = false; }
  });
}
