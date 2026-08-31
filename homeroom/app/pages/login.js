// Sign in.

import { shell, message, safeNext, onSubmit, requireConfig, supabase, html, setHTML } from './_auth.js';

if (requireConfig()) {
  // Already signed in? Do not make them type it again.
  const { data } = await supabase.auth.getSession();
  if (data?.session) location.replace(safeNext());

  setHTML('#app', shell({
    title: 'Sign in',
    lede: 'Homeroom is the members-only side of Haus.',
    body: html`<form class="stack" id="form">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn wide" type="submit">Sign in</button>
    </form>`,
    alt: html`<a href="/homeroom/signup.html">Create an account</a>
      <a href="/homeroom/forgot.html">Forgot your password?</a>`,
  }));

  onSubmit('#form', async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Deliberately vague: a precise message tells a stranger which addresses
    // are registered here.
    if (error) return message('That email and password do not match.');
    location.href = safeNext();
  });
}
