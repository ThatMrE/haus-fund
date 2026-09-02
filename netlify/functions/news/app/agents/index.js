import biorxiv from './biorxiv.js';
import formd from './formd.js';
import nih from './nih.js';
import arpah from './arpah.js';
import wires from './wires.js';
import calendars from './calendars.js';
import accounts from './accounts.js';

/**
 * The agents, in the order the morning run works through them.
 *
 * Each one is independent: it fetches, normalises, and hands back entries. It
 * does not decide what gets posted — that is the orchestrator's job in
 * `ingest.js`, which is what keeps the caps and the de-duplication in one
 * place.
 */
export const AGENTS = [biorxiv, formd, nih, arpah, wires, calendars, accounts];

export function agentByKey(key) {
  return AGENTS.find((agent) => agent.key === key) ?? null;
}

/** The handle an agent posts under. */
export function agentHandle(agent) {
  return `agent-${agent.key}`;
}

export function agentAbout(agent) {
  return `${agent.about} Posts here are filed automatically and marked Auto.`;
}
