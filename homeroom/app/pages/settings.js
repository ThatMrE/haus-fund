// Your own profile. This is what the directory searches.

import {
  page, setHTML, html, raw, param, flash, readableError, EXPERTISE_SUGGESTIONS,
} from '../ui.js';
import * as api from '../api.js';

page(async (me) => {
  const tags = (me.expertise ?? []).map((row) => row.tag).join(', ');
  const checked = (flag) => raw(me[flag] ? 'checked' : '');

  setHTML('#app', html`
    <h1>Your profile</h1>
    <p class="lede">This is what the directory searches. Vague profiles get no intros.</p>
    ${param('welcome') === '1' ? html`<div class="notice">Welcome to Homeroom. Fill this in once and
      the rest of the network can find you.</div>` : ''}
    <form class="stack wide" id="form">
      <div class="row">
        <div class="field"><label for="name">Name</label>
          <input id="name" name="name" maxlength="80" value="${me.name}"></div>
        <div class="field"><label for="cohort">Cohort</label>
          <input id="cohort" name="cohort" maxlength="12" value="${me.cohort ?? ''}" placeholder="S26">
          <div class="hint">However you group yourself: a batch, a year, a residency.</div></div>
      </div>
      <div class="field"><label for="headline">Headline</label>
        <input id="headline" name="headline" maxlength="140" value="${me.headline}"
          placeholder="Directed evolution of thermostable enzymes, in a garage in Porto"></div>
      <div class="row">
        <div class="field"><label for="org">Lab or org</label>
          <input id="org" name="org" maxlength="80" value="${me.org}"></div>
        <div class="field"><label for="role">Role</label>
          <input id="role" name="role" maxlength="80" value="${me.role}"></div>
      </div>
      <div class="row">
        <div class="field"><label for="location">Location</label>
          <input id="location" name="location" maxlength="80" value="${me.location}"></div>
        <div class="field"><label for="bsl">Containment you work at</label>
          <input id="bsl" name="bsl" maxlength="24" value="${me.bsl ?? ''}" placeholder="BSL-1"></div>
      </div>
      <div class="field"><label for="bio">About</label>
        <textarea id="bio" name="bio" rows="5" maxlength="4000">${me.bio}</textarea></div>
      <div class="field"><label for="working_on">Working on</label>
        <textarea id="working_on" name="working_on" rows="3" maxlength="2000">${me.working_on}</textarea></div>
      <div class="field"><label for="ask_me_about">Ask me about</label>
        <textarea id="ask_me_about" name="ask_me_about" rows="3" maxlength="2000"
          placeholder="Things you have actually done and would answer a message about at 3am.">${me.ask_me_about}</textarea></div>
      <div class="field"><label for="expertise">Expertise tags</label>
        <input id="expertise" name="expertise" value="${tags}">
        <div class="hint">Comma separated, up to 12. Common ones: ${EXPERTISE_SUGGESTIONS.slice(0, 12).join(', ')}.</div></div>
      <div class="field"><label for="links">Links</label>
        <input id="links" name="links" value="${(me.links ?? []).join(', ')}" placeholder="https://…, https://…">
        <div class="hint">Comma separated.</div></div>
      <fieldset class="checks">
        <legend>Open to</legend>
        <label class="check"><input type="checkbox" name="open_intros" value="1" ${checked('open_intros')}> <span>Intro requests</span></label>
        <label class="check"><input type="checkbox" name="open_hours" value="1" ${checked('open_hours')}> <span>Giving office hours</span></label>
        <label class="check"><input type="checkbox" name="open_collab" value="1" ${checked('open_collab')}> <span>Collaborations</span></label>
        <label class="check"><input type="checkbox" name="open_hiring" value="1" ${checked('open_hiring')}> <span>Being contacted about jobs</span></label>
      </fieldset>
      <button class="btn" type="submit">Save profile</button>
    </form>`);

  document.querySelector('#form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(event.target));
    try {
      await api.updateMember(me.id, {
        name: fields.name.trim(),
        headline: fields.headline.trim(),
        org: fields.org.trim(),
        role: fields.role.trim(),
        cohort: fields.cohort.trim() || null,
        location: fields.location.trim(),
        bio: fields.bio.trim(),
        working_on: fields.working_on.trim(),
        ask_me_about: fields.ask_me_about.trim(),
        bsl: fields.bsl.trim() || null,
        links: (fields.links ?? '').split(',').map((link) => link.trim()).filter(Boolean).slice(0, 8),
        open_intros: fields.open_intros === '1',
        open_hours: fields.open_hours === '1',
        open_collab: fields.open_collab === '1',
        open_hiring: fields.open_hiring === '1',
      });
      await api.setExpertise(me.id, api.parseTags(fields.expertise, 12));
      flash('Saved.', '');
    } catch (error) {
      flash(readableError(error));
    } finally {
      button.disabled = false;
    }
  });
});
