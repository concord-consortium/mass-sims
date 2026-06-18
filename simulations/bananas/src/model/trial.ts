import type { OffspringPlant, ParentId } from "./genetics";

export interface TrialState {
  p1: ParentId | null;
  p2: ParentId | null;
  /** True after the first cross — locks the parent selectors and Fungus switch. */
  locked: boolean;
  /** Per-cross plant arrays, oldest first (crosses[0] is row A1). */
  crosses: OffspringPlant[][];
  /** Whether fungus is active for the trial. Frozen after the first cross; when true,
   * non-resistant offspring are infected. */
  fungusOn: boolean;
}

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. The whole
 * `TrialState` is JSON-serializable — `crosses` holds plain `OffspringPlant` objects — so it
 * round-trips verbatim, with no per-frame transient to strip. Named distinctly because this is
 * a wire format: changing `TrialState`'s shape changes what restores from saved sessions.
 */
export type SavedState = TrialState;

/**
 * Factory (not a shared constant): each call returns a fresh object, so resets and separate
 * trials never share the mutable `crosses` array.
 */
export function emptyTrial(): TrialState {
  return {
    p1: null,
    p2: null,
    locked: false,
    crosses: [],
    fungusOn: false,
  };
}
