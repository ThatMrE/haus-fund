// Set a new password. Reached from the emailed link, which Supabase turns
// into a short-lived session before this page runs.

import { shell, message, onSubmit, requireConfig, supabase, html, setHTML } from './_auth.js';

function expired() {
  setHTML('#app', shell({
    title: 'That link has expired',
    lede: 'Reset links work once and last an hour.',
    body: html`<a class="btn wide" href="/homeroom/forgot.html">Send a new link</a>`,
    alt: html`<a href="/homeroom/login.html">Back to sign in</a>`,
  }));
}

if (requireConfig()) {
  // detectSessionInUrl consumes the token, but it lands a moment after load.
  let session = (await supabase.auth.getSession()).data?.session;
  if (!session) {
    session = await new Promise((resolve) => {
      const { data } = supabase.auth.onAuthStateChange((_event, next) => resolve(next ?? null));
      setTimeout(() => { data.subscription.unsubscribe(); resolve(null); }, 2500);
    });
  }

  if (!session) {
    expired();
  } else {
    setHTML('#app', shell({
      title: 'Choose a password',
      lede: 'This replaces the old one everywhere.',
      body: html`<form class="stack" id="form">
        <div class="field">
          <label for="password">New password</label>
          <input id="password" name="password" type="password" autocomplete="new-password"
                 required minlength="10" autofocus>
          <div class="hint">At least 10 characters.</div>
        </div>
        <div class="field">
          <label for="confirm">New password again</label>
          <input id="confirm" name="confirm" type="password" autocomplete="new-password" required>
        </div>
        <button class="btn wide" type="submit">Save password</button>
      </form>`,
    }));

    onSubmit('#form', async ({ password, confirm }) => {
      if (password !== confirm) return message('Those two do not match.');
      if (String(password).length < 10) return message('Use at least 10 characters.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setHTML('#app', shell({
        title: 'Password saved',
        lede: 'You are signed in with the new one.',
        body: html`<a class="btn wide" href="/homeroom/">Go to Homeroom</a>`,
      }));
    });
  }
}
