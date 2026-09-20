/** Signals passed between the header and the garden, which never render together. */

/** Detail is the requested open state of the agent list. */
export const AGENTS_TOGGLE_EVENT = "agent-garden:toggle-agents";

/** Fired once a pick has been parked in session storage, below. */
export const SPOTLIGHT_EVENT = "agent-garden:spotlight";

/**
 * The picked agent id. Session storage rather than an event argument, so a pick
 * made from another page survives the navigation back to the garden.
 */
export const SPOTLIGHT_KEY = "agent-garden:spotlight-id";

export function requestSpotlight(agentId: string) {
  window.sessionStorage.setItem(SPOTLIGHT_KEY, agentId);
  window.dispatchEvent(new Event(SPOTLIGHT_EVENT));
}

export function takeSpotlightRequest(): string | null {
  const id = window.sessionStorage.getItem(SPOTLIGHT_KEY);
  if (id) window.sessionStorage.removeItem(SPOTLIGHT_KEY);
  return id;
}
