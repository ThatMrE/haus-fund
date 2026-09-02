/**
 * The channels a room opens with.
 *
 * Real editorial content, not sample data — which is why it lives here rather
 * than in seed.js. Deliberately few: a chat that opens with twenty channels
 * reads as abandoned on day one, and splitting a busy channel later is a much
 * easier conversation than reviving a dead one.
 */
export const CHANNELS = [
  ['general', 'general', 'Anything. The default room.', 'open'],
  ['wetlab', 'wetlab', 'Protocols going wrong, reagents going missing, kit that will not behave.', 'open'],
  ['fundraising', 'fundraising', 'Live raises, investor behaviour, term sheet questions. Say the real numbers.', 'open'],
  ['perks', 'perks', 'Codes, credits and who has actually redeemed what. Stewards post confirmed codes here.', 'open'],
  ['mentors', 'mentors', 'Who to ask about what, and intro requests that do not need a whole form.', 'open'],
  ['showcase', 'showcase', 'Wins, launches, papers, first customers. Post yours.', 'open'],
];
