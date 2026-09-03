/**
 * The mentor desk's outgoing mail.
 *
 * Separate from mail.js, which stays password-reset-only, and separate from
 * whatever the intro engine grows: the two voices are genuinely different, and
 * one template file with a `kind` parameter is how a permission ask for a
 * stranger ends up addressed to a mentor who already volunteered.
 *
 * These messages ARE the product surface. A mentor has no Homeroom account —
 * roster.js admits residents and alumni, and a mentor is neither — so every
 * decision they ever make about the desk happens in an email client, on a
 * phone, in under a minute. Anything that needs a login is not reachable.
 *
 * House style from SKILL.md: no emoji, no exclamation marks, digits for
 * numbers, sentence case.
 *
 * With no provider configured the message is written to the log and the flow
 * still completes — the same choice mail.js makes for resets, and for the same
 * reason: a missing API key should not lose a mentor's answer.
 *
 * ── ONE LINK, NOT THREE ──────────────────────────────────────────────────
 *
 * The obvious design gives the mentor three links — yes, no, not now — so an
 * answer is a single tap. It is also how a corporate link scanner accepts on
 * their behalf: plenty of mail gateways fetch every URL in a message before
 * delivering it, and a GET that changes state will be fired by a machine that
 * has no opinion about mentoring.
 *
 * So there is one link, to a page with three buttons, and the buttons POST.
 * One extra tap for the mentor, and no possibility of a scanner having
 * volunteered their calendar.
 */

const BASE = () => (process.env.HOMEROOM_BASE_URL || 'https://haus.fund').replace(/\/+$/, '');

export function mailerConfigured() {
  return !!(process.env.HOMEROOM_RESEND_KEY && from());
}

/**
 * Its own sender identity, falling back to the shared one.
 *
 * Mentor mail goes to people outside the house and will occasionally be marked
 * as spam by someone who forgot they signed up. Sharing the sender with
 * password resets means that reputation hit lands on the one message a locked
 * out member cannot do without.
 */
function from() {
  return process.env.HOMEROOM_MENTOR_MAIL_FROM || process.env.HOMEROOM_MAIL_FROM || '';
}

async function send({ to, subject, text }) {
  if (!mailerConfigured() || !to) {
    console.log(`[homeroom] mentor mail not sent (${!to ? 'no address' : 'no sender configured'}): ${subject}`);
    if (process.env.HOMEROOM_SHOW_RESET_LINK === '1') console.log(text);
    return { sent: false, reason: to ? 'not configured' : 'no address' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.HOMEROOM_RESEND_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: from(), to, subject, text }),
    });
    if (!response.ok) {
      console.warn(`[homeroom] mentor mail failed: ${response.status}`);
      return { sent: false, reason: `provider returned ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.warn(`[homeroom] mentor mail threw: ${error?.message}`);
    return { sent: false, reason: 'send failed' };
  }
}

const line = (label, value) => (value ? `${label}: ${value}` : null);

/**
 * 1. The request — the one message that decides whether any of this works.
 *
 * The capacity line is not decoration. A mentor who can see they are at 2 of 2
 * makes a better decision than one who cannot, and a mentor who accepts
 * without knowing is the one who resents it later.
 */
export function requestMessage({ mentor, to, member, request, token, capacity }) {
  const url = `${BASE()}/homeroom/m/${token}`;
  return {
    to,
    subject: `${request.asking_for || 'Time'} with a Biopunk resident?`,
    text: [
      `${mentor.name} — a Biopunk resident asked for time with you.`,
      '',
      `${member.name || member.user_id}${member.org ? `, ${member.org}` : ''}`,
      member.working_on ? `Working on: ${member.working_on}` : null,
      '',
      line('They need', request.need),
      line('Why you', request.why_them),
      line('Already tried', request.tried),
      line('Asking for', request.asking_for),
      '',
      'Answer it here — yes, not this one, or not right now:',
      `  ${url}`,
      '',
      `You are at ${capacity.used} of ${capacity.cap} sessions this month.`,
      'Saying no is a normal answer and costs you nothing here.',
      '',
      '— Homeroom, for Biopunk',
    ].filter((l) => l !== null).join('\n'),
  };
}

/** 2. The link — to the member, on accept. */
export function grantMessage({ mentor, request, grant, late = false }) {
  const url = `${BASE()}/homeroom/mentor/${mentor.slug}/book/${grant.id}`;
  const days = Math.max(1, Math.round((grant.expiresAt - Math.floor(Date.now() / 1000)) / 86400));
  return {
    subject: `${mentor.name} said yes`,
    text: [
      `${mentor.name} is happy to take your request.`,
      late ? 'Their answer came in after the window closed, so this is a little late.' : null,
      request.decline_note ? `They said: ${request.decline_note}` : null,
      '',
      `Book a time: ${url}`,
      `The link works for the next ${days} days, and only for you.`,
      '',
      'Before you book:',
      '  Send the question in advance. A mentor who has read it arrives useful.',
      '  Bring the artefact — the deck, the term sheet, the assay — not a summary.',
      '  Say what you have already tried.',
    ].filter((l) => l !== null).join('\n'),
  };
}

/**
 * 3. Not this one — to the member, on decline.
 *
 * No reason is invented when the mentor left none. And it ends in a next step:
 * a decline that dead-ends is how a member stops using the desk, when what
 * actually happened is that they picked the wrong person for the question.
 */
export function declineMessage({ mentor, request, alternatives = [] }) {
  return {
    subject: `${mentor.name} passed on this one`,
    text: [
      `${mentor.name} is not able to take this one.`,
      request.decline_note ? '' : null,
      request.decline_note ? `They said: ${request.decline_note}` : null,
      '',
      alternatives.length
        ? ['Others in the network who cover similar ground:',
          ...alternatives.map((m) => `  ${m.name} — ${BASE()}/homeroom/mentor/${m.slug}`)].join('\n')
        : `Other mentors, by what they help with: ${BASE()}/homeroom/mentors`,
    ].filter((l) => l !== null).join('\n'),
  };
}

/** 4. Still up for this — the re-confirmation. Built here, sent in Phase 3. */
export function reconfirmMessage({ mentor, to, token }) {
  const url = `${BASE()}/homeroom/m/${token}`;
  return {
    to,
    subject: 'Still up for mentoring Biopunk founders?',
    text: [
      `${mentor.name} — a quick check, once every 6 months.`,
      '',
      'What we have on file:',
      `  ${mentor.role}${mentor.org ? ` at ${mentor.org}` : ''}`,
      `  Topics: ${mentor.tags || '—'}`,
      `  Up to ${mentor.capacity} sessions a month`,
      '',
      `Confirm, pause or withdraw here: ${url}`,
      '',
      'No answer and we will quietly pause you rather than keep sending requests.',
    ].join('\n'),
  };
}

/**
 * 5. You have been paused — after three unanswered requests.
 *
 * Deliberately not an accusation and not a sequence. One note, leading with the
 * button that brings them back. Someone in this state is usually buried or has
 * changed address, and neither deserves a guilt trip.
 */
export function autoPausedMessage({ mentor, to, token }) {
  return {
    to,
    subject: 'Pausing your mentor requests',
    text: [
      `${mentor.name} — a few requests went unanswered, so we have stopped sending them.`,
      '',
      'That is usually a sign of a busy month, or an address that is not the one',
      'you read. Either is fine and nothing is wrong.',
      '',
      `Start them again whenever you like: ${BASE()}/homeroom/me/${token}`,
      '',
      'Nobody is waiting on you, and we will not chase this.',
    ].join('\n'),
  };
}

/** 6. Quietly off the list, and one click back on. */
export function dormantMessage({ mentor, to, token }) {
  return {
    to,
    subject: 'Taking you off the mentor list for now',
    text: [
      `${mentor.name} — we asked twice whether you were still up for mentoring and`,
      'did not hear back, so we have taken you off the list rather than keep',
      'sending founders to a name that does not answer.',
      '',
      'Nothing is deleted, and coming back is one click:',
      `  ${BASE()}/homeroom/me/${token}`,
      '',
      'Thank you for the time you did give.',
    ].join('\n'),
  };
}

export async function deliver(message) {
  return send(message);
}
