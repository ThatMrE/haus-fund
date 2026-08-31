/**
 * Outgoing mail, for password resets.
 *
 * Homeroom sends one kind of message, so this is deliberately one function and
 * no dependency: a POST to a transactional API, or nothing.
 *
 * With no provider configured the reset still works — the token is minted and
 * the link is written to the function log, where a steward can find it. The
 * link is never shown to whoever asked for it: that would let a stranger reset
 * an account by typing someone else's address. HOMEROOM_SHOW_RESET_LINK=1 puts
 * it on screen for local development, and should never be set in production.
 */

export function mailerConfigured() {
  return !!(process.env.HOMEROOM_RESEND_KEY && process.env.HOMEROOM_MAIL_FROM);
}

export function showsResetLink() {
  return process.env.HOMEROOM_SHOW_RESET_LINK === '1';
}

export async function sendResetEmail({ to, link }) {
  if (!mailerConfigured()) {
    console.log(`[homeroom] no mail sender configured; reset link for ${to}: ${link}`);
    return { sent: false, reason: 'not configured' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.HOMEROOM_RESEND_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.HOMEROOM_MAIL_FROM,
        to,
        subject: 'Reset your Homeroom password',
        text: [
          'Someone asked to reset the password on your Homeroom account.',
          '',
          link,
          '',
          'The link works once and expires in an hour.',
          'If this was not you, ignore this message and nothing changes.',
        ].join('\n'),
      }),
    });
    if (!response.ok) {
      console.warn(`[homeroom] reset mail to ${to} failed: ${response.status}`);
      return { sent: false, reason: `provider returned ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    // A failed send must not tell the caller whether the address exists.
    console.warn(`[homeroom] reset mail to ${to} threw: ${error?.message}`);
    return { sent: false, reason: 'send failed' };
  }
}
