import seedrandom from "seedrandom";

// The `seedrandom` types put each algorithm's state under its own member of the
// `seedrandom.State` namespace. The default algorithm is Arc4, which is what we use here.
// `ReturnType<typeof seedrandom>` is too broad (it resolves to a conditional-type catch-all);
// pinning the type explicitly keeps callers honest.
export type SeededRandomState = seedrandom.State.Arc4;
export type SeededRandom = seedrandom.StatefulPRNG<SeededRandomState>;

let seededRandomMap: Record<string, SeededRandom> = Object.create(null);

/**
 * Returns a deterministic PRNG identified by `key`. Calling with the same key returns the same
 * PRNG instance, so two callers can share a sequence by sharing a key. PRNGs are created lazily
 * on first request.
 *
 * The returned object is callable (`rng()` produces the next [0,1) number) and exposes `.state()`
 * for save/restore (see `saveSeededRandom`/`restoreSeededRandom`).
 */
export function seededRandom(key: string): SeededRandom {
  let prng = seededRandomMap[key];
  if (!prng) {
    // state: true enables state saving; entropy: false makes the sequence purely seed-driven.
    prng = seedrandom(key, { entropy: false, state: true });
    seededRandomMap[key] = prng;
  }
  return prng;
}

/** Clear every cached PRNG. Mostly useful in tests; consider scoping more narrowly otherwise. */
export function resetAll(): void {
  seededRandomMap = Object.create(null);
}

/** Clear one cached PRNG so the next `seededRandom(key)` call recreates it from the seed. */
export function resetSeededRandom(key: string): void {
  delete seededRandomMap[key];
}

/**
 * Capture the current state of a PRNG so it can be resumed later via `restoreSeededRandom`.
 * Throws if `key` has never been seen.
 */
export function saveSeededRandom(key: string): SeededRandomState {
  const prng = seededRandomMap[key];
  if (!prng) {
    throw new Error(`seededRandom("${key}") has not been initialized; nothing to save.`);
  }
  return prng.state();
}

/** Replace the PRNG for `key` with one whose state is set from a prior `saveSeededRandom`. */
export function restoreSeededRandom(key: string, state: SeededRandomState): void {
  seededRandomMap[key] = seedrandom(key, { state });
}
