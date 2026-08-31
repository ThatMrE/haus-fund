// Shared furniture for the four pre-login pages.
//
// These are the only Homeroom pages a signed-out visitor can render, so they
// carry their own mark and never call the members-only chrome.

import { supabase, configured } from '../client.js';
import { html, raw, setHTML, esc, readableError } from '../ui.js';

export function shell({ title, lede, body, alt = '' }) {
  return html`<div class="authcard">
    <div class="authmark">
      <a href="/"><img src="/assets/logo-mark.svg" alt="Haus"></a>
      <span>Homeroom</span>
    </div>
    <h1>${title}</h1>
    <p class="lede">${lede}</p>
    <div class="js-message"></div>
    ${body}
    ${alt ? html`<div class="alt">${alt}</div>` : ''}
  </div>`;
}

export function message(text, tone = 'bad') {
  setHTML('.js-message', text ? html`<div class="notice ${tone}">${text}</div>` : '');
}

/** Only ever send people to our own paths after signing in. */
export function safeNext(fallback = '/homeroom/') {
  const next = new URLSearchParams(location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

/** Run a submit handler with the button disabled and errors surfaced. */
export function onSubmit(selector, handler) {
  const form = document.querySelector(selector);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Working'; }
    message('');
    try {
      await handler(Object.fromEntries(new FormData(form)), form);
    } catch (error) {
      message(readableError(error));
    } finally {
      if (button) { button.disabled = false; button.textContent = label; }
    }
  });
}

/** Every auth page needs a configured project before it can do anything. */
export function requireConfig() {
  if (configured) return true;
  setHTML('#app', shell({
    title: 'Not connected yet',
    lede: 'Homeroom needs a Supabase project before anyone can sign in.',
    body: html`<ol class="prose" style="padding-left:18px">
      <li>Create a project at supabase.com.</li>
      <li>Run <code>homeroom/supabase/schema.sql</code> in its SQL editor.</li>
      <li>Put the project URL and anon key in <code>homeroom/app/config.js</code>.</li>
    </ol>
    <p class="sm" style="margin-top:16px">The walkthrough is in <code>homeroom/README.md</code>.</p>`,
  }));
  return false;
}

export { supabase, html, raw, setHTML, esc };
