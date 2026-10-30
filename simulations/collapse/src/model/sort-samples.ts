import type { Sample, SortState } from "./types";

/** A sorted copy, so the trial keeps the order the student sampled in. */
export function sortedSamples(samples: readonly Sample[], { key, direction }: SortState): Sample[] {
  const view = samples.slice();
  if (key) view.sort((a, b) => (a[key] - b[key]) * direction);
  return view;
}
