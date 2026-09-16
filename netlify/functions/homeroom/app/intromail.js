/**
 * The intro engine's outgoing mail.
 *
 * Separate from mail.js (resets only) and from mentormail.js, because the
 * voices are genuinely different and one template file with a `kind` parameter
 * is how a permission ask for a stranger ends up phrased like a note to
 * somebody who already volunteered.
 *
 * These four messages ARE the product for the target. They have no Homeroom
 * account and never will; every decision they make happens in an email client,
 * on a phone, in under a minute. Anything that needs a login is not reachable.
 *
 * House style from SKILL.md: no emoji, no exclamation marks, digits for
 * numbers, sentence case.
 *
 * ── THE RULES THESE TEMPLATES ENCODE ─────────────────────────────────────
 *
 * ONE LINK, NOT THREE. The obvious design gives the target three links — yes,
 * no, never — so an answer is one tap. It is also how a corporate link scanner
 * answers on their behalf: plenty of mail gateways fetch every URL in a message
 * before delivering it, and a GET that changes state gets fired by a machine
 * with no opinion about introductions. So there is one link, to a page with
 * three buttons, and the buttons POST.
 *
 * NO TRACKING. No pixel, no wrapped links, no open receipts. Measuring whether
 * someone opened an email asking them a favour is exactly the behaviour that
 * turns a warm network into a CRM.
 *
 * AN EXPLICIT, COST-FREE OUT, in the connector's own words, in every message.
 * If declining is socially expensive then a yes is extracted rather than given,
 * and an extracted yes is worse than no introduction at all.
 */

const BASE = () => (process.env.HOMEROOM_BASE_URL || 'https://haus.fund').replace(/\/+$/, '');

export function mailerConfigured() {
  return !!(process.env.HOMEROOM_RESEND_KEY && from());
}

/**
 * Its own sender identity, falling back to the mentor one and then the shared
 * one. Intro mail goes to people who did not sign up for anything and will
 * occasionally be marked as spam. That reputation hit must not land on the one
 * message a locked-out member cannot do without.
 */
export function from() {
  return process.env.HOMEROOM_INTRO_MAIL_FROM
    || process.env.HOMEROOM_MENTOR_MAIL_FROM
    || process.env.HOMEROOM_MAIL_FROM
    || '';
}

/** Whose name is on these messages. */
export function connectorName() {
  return process.env.HOMEROOM_INTRO_CONNECTOR || 'Haus';
}

/** A real postal identity, required on mail to people outside the house. */
function postal() {
  return process.env.HOMEROOM_INTRO_POSTAL || '';
}

async function send({ to, subject, text, replyTo = '' }) {
  if (!mailerConfigured() || !to) {
    console.log(`[homeroom] intro mail not sent (${!to ? 'no address' : 'no sender configured'}): ${subject}`);
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
      body: JSON.stringify({
        from: from(),
        to,
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!response.ok) {
      console.warn(`[homeroom] intro mail failed: ${response.status}`);
      return { sent: false, reason: `provider returned ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.warn(`[homeroom] intro mail threw: ${error?.message}`);
    return { sent: false, reason: 'send failed' };
  }
}

const sign = () => [postal() ? '' : null, postal() || null].filter((l) => l !== null);

/**
 * 1. The permission ask — connector to target. The member is not a recipient
 *    and is never told this went out to a particular person.
 *
 * Under 120 words of substance, because the job is to let a busy person decide
 * in fifteen seconds. The evidence line is quoted from the search rather than
 * written fresh: a blurb that would fit anyone reads as a mail merge, which is
 * the impression to avoid.
 */
export function permissionMessage({ request, member, token, to }) {
  const url = `${BASE()}/homeroom/i/${token}`;
  const evidence = (request.evidence || [])[0] || '';
  return {
    to,
    subject: 'Quick one — worth an intro?',
    text: [
      `${request.name} — one of the founders at Biopunk is working on something you have done,`,
      'and I would rather ask you than hand out your address.',
      '',
      `${member.name || member.user_id}${member.org ? `, ${member.org}` : ''}`,
      member.working_on ? `Working on: ${member.working_on}` : null,
      '',
      `What they need: ${request.need}`,
      request.why_them ? `Why you: ${request.why_them}` : null,
      evidence ? `What I had on you: ${evidence}` : null,
      '',
      `They are asking for ${request.asking_for || 'a short conversation'}.`,
      '',
      'Answer here — yes, not now, or never ask me again:',
      `  ${url}`,
      '',
      'No is a completely fine answer, it takes one tap, and I will not mention it to them.',
      'They do not know I wrote to you.',
      '',
      `— ${connectorName()}`,
      ...sign(),
    ].filter((l) => l !== null).join('\n'),
  };
}

/**
 * 2. The introduction — connector to both, on yes.
 *
 * The "moving myself to bcc" line is not a flourish. It is the connector
 * leaving, which is what makes this a connection rather than a mediated
 * conversation, and it tells the member the follow-up is theirs.
 */
export function introductionMessage({ request, member, to, memberEmail }) {
  const name = member.name || member.user_id;
  return {
    to,
    replyTo: memberEmail || '',
    subject: `Intro: ${name} ↔ ${request.name}`,
    text: [
      `${request.name}, meet ${name}${member.org ? ` of ${member.org}` : ''}`
        + `${member.working_on ? ` — ${member.working_on}` : ''}.`,
      `${name}, meet ${request.name}${request.title ? ` — ${request.title}` : ''}`
        + `${request.org ? ` at ${request.org}` : ''}.`,
      '',
      `${name} is after ${request.asking_for || 'a short conversation'}: ${request.need}`,
      '',
      `${request.name} has said they are happy to talk. ${name}, over to you — take it from here.`,
      '',
      'Moving myself to bcc.',
      '',
      `— ${connectorName()}`,
      ...sign(),
    ].filter((l) => l !== null).join('\n'),
  };
}

/** 3. To the member, on a yes. Says an introduction is coming, names nobody new. */
export function memberIntroducedMessage({ request }) {
  return {
    subject: `An introduction to ${request.name} is on its way`,
    text: [
      `${request.name} said yes. The introduction is in your inbox with both of you on it.`,
      '',
      'Two things that decide whether this was worth spending:',
      '  Reply the same day. A warm intro cools in about 48 hours.',
      '  Ask the specific thing you wrote down, not "can I pick your brain".',
      '',
      `And log what came of it: ${BASE()}/homeroom/intros`,
    ].join('\n'),
  };
}

/**
 * 4. Closing the loop — to the target, once, when the member logs an outcome.
 *
 * This is the message that makes somebody say yes the next time, and the one
 * every intro system forgets to send.
 */
export function closingMessage({ request, member, outcome, to }) {
  return {
    to,
    subject: `That intro to ${member.name || member.user_id}`,
    text: [
      `${request.name} — a short note on what came of the introduction you agreed to.`,
      '',
      outcome.met ? 'They met.' : 'They have not managed to meet yet.',
      outcome.note ? `${member.name || member.user_id} said: ${outcome.note}` : null,
      '',
      'Thank you for the time. Nothing is needed from you.',
      '',
      `— ${connectorName()}`,
      ...sign(),
    ].filter((l) => l !== null).join('\n'),
  };
}

export async function deliver(message) {
  return await send(message);
}
