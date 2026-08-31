// Ask for a password reset link.

import { shell, onSubmit, requireConfig, supabase, html, setHTML } from './_auth.js';

if (requireConfig()) {
  setHTML('#app', shell({
    title: 'Reset your password',
    lede: 'We will email you a link that signs you in once, so you can set a new one.',
    body: html`<form class="stack" id="form">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      </div>
      <button class="btn wide" type="submit">Send the link</button>
    </form>`,
    alt: html`<a href="/homeroom/login.html">Back to sign in</a>`,
  }));

  onSubmit('#form', async ({ email }) => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/homeroom/reset.html`,
    });
    // The same answer either way: whether an address has an account here is
    // not something a stranger gets to find out.
    setHTML('#app', shell({
      title: 'Check your email',
      lede: `If ${email} has a Homeroom account, a reset link is on its way. The link works once and expires in an hour.`,
      body: html`<p class="sm">Nothing arrived? Check spam, then
        <a href="/homeroom/forgot.html">ask again</a>.</p>`,
      alt: html`<a href="/homeroom/login.html">Back to sign in</a>`,
    }));
  });
}
