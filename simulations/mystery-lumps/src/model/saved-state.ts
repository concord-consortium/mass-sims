import type { Trial } from "./trial";

/**
 * Only plain JSON. Captions are not stored — they are derived from `observe()` on render, so a
 * wording fix reaches work a student saved earlier. Animation progress is never persisted.
 */
export interface SavedState {
  trials: Trial[];
  selectedId: string;
}
