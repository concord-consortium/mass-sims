// Per-trial data shapes. These are placeholders: the Nor'easter model story defines the real
// input the user configures and the output a run records. For now a trial carries only its
// deterministic-identity seed, and has no recorded output fields yet.

/** Inputs the user configures for a trial before running it. */
export interface SimInput {
  /** Seed for deterministic re-runs — same seed → same trial. */
  seed: string;
}

/** Per-trial recorded output — `null` until the trial has been run. No fields defined yet. */
export type SimOutput = Record<string, never>;

/**
 * A trial's recorded data — created empty, becomes "recorded" once it has been run. Reset clears a
 * trial back to empty; trials are never deleted. This mirrors the MST `TrialModel`'s snapshot
 * (`stores/trial-model.ts`, `TrialState`). There is no `id` — a trial's identity is its letter (the
 * key in the RootStore's `trials` map).
 */
export interface RecordedTrial {
  input: SimInput;
  output: SimOutput | null;
}
