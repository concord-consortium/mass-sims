// Sims registry — the single source of truth for sim → port mapping (Resolved decision #16).
//
// Every consumer reads from here so the mapping can never drift:
//   - playwright.config.ts derives its `webServer` entries from SIMS.
//   - Each per-sim page object's `goto()` navigates via getSimUrl(name).
//   - `yarn new-sim <name>` APPENDS a new entry with the next free port.
//
// The URL is DERIVED from the port (getSimUrl), never stored, so a port edit can't
// leave a stale URL behind. There is deliberately NO baseURL in playwright.config.ts:
// different specs target different sims at different ports, and a single baseURL would
// silently route one sim's tests at another the moment a page object forgot to be explicit.

export interface SimEntry {
  name: string;
  port: number;
}

export const SIMS: SimEntry[] = [
  { name: "starter", port: 8080 },
  { name: "bananas", port: 8081 },
];

/** Look up a sim entry by name. Throws if the sim is not registered. */
export function getSim(name: string): SimEntry {
  const sim = SIMS.find((s) => s.name === name);
  if (!sim) {
    const known = SIMS.map((s) => s.name).join(", ");
    throw new Error(`Unknown sim "${name}". Registered sims: ${known}.`);
  }
  return sim;
}

/** The preview-server URL for a sim, computed from its registered port. */
export function getSimUrl(name: string): string {
  return `http://localhost:${getSim(name).port}/`;
}
