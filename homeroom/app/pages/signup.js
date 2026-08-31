// Create an account, then claim a handle.
//
// Two steps, because they answer to different systems: Supabase owns the
// email and password, Homeroom owns the handle and profile. The second step
// also runs on its own for anyone who confirmed an email and came back.

import { shell, message, onSubmit, requireConfig, supabase, html, setHTML } from './_auth.js';
import { claimHandle } from '../api.js';

const params = new URLSearchParams(location.search);

async function handleStep() {
  setHTML('#app', shell({
    title: 'Choose a handle',
    lede: 'This is how the rest of Homeroom will see you. It cannot be changed later.',
    body: html`<form class="stack" id="form">
      <div class="field">
        <label for="handle">Handle</label>
        <input id="handle" name="handle" required autofocus minlength="2" maxlength="20"
               pattern="[A-Za-z0-9_-]{2,20}" placeholder="ada-fell">
        <div class="hint">2 to 20 characters: letters, numbers, dashes and underscores.</div>
      </div>
      <div class="field">
        <label for="name">Name</label>
        <input id="name" name="name" maxlength="80" placeholder="Ada Fell">
        <div class="hint">Optional, and shown instead of your handle where there is room.</div>
      </div>
      <button class="btn wide" type="submit">Enter Homeroom</button>
    </form>`,
  }));

  onSubmit('#form', async ({ handle, name }) => {
    await claimHandle(handle.trim(), (name || '').trim());
    location.href = '/homeroom/settings.html?welcome=1';
  });
}

async function accountStep() {
  setHTML('#app', shell({
    title: 'Create an account',
    lede: 'Haus residents, alumni and mentors. One account covers Homeroom.',
    body: html`<form class="stack" id="form">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="new-password"
               required minlength="10">
        <div class="hint">At least 10 characters. Longer beats complicated.</div>
      </div>
      <button class="btn wide" type="submit">Create account</button>
    </form>`,
    alt: html`<a href="/homeroom/login.html">I already have an account</a>`,
  }));

  onSubmit('#form', async ({ email, password }) => {
    if (String(password).length < 10) return message('Use at least 10 characters.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/homeroom/signup.html?step=handle` },
    });
    if (error) throw error;

    // With email confirmation on, there is no session yet and the handle step
    // waits until they follow the link.
    if (data.session) return handleStep();
    setHTML('#app', shell({
      title: 'Check your email',
      lede: `We sent a confirmation link to ${email}. Open it and you will land back here to choose a handle.`,
      body: html`<p class="sm">Nothing arrived? Check spam, then
        <a href="/homeroom/signup.html">try again</a>.</p>`,
      alt: html`<a href="/homeroom/login.html">Back to sign in</a>`,
    }));
  });
}

if (requireConfig()) {
  const { data } = await supabase.auth.getSession();
  if (params.get('step') === 'handle' || data?.session) await handleStep();
  else await accountStep();
}
