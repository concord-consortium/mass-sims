import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from "react";

export interface UseModelStateOptions<IInput, IOutput, ITransient> {
  initialInput: IInput;
  initialOutput: IOutput;
  initialTransient: ITransient;
}

export interface UseModelStateReturn<IInput, IOutput, ITransient> {
  /** User-controlled parameters (slider values, dropdown selections, etc.). */
  input: IInput;
  /** Per-trial accumulated record (computed snapshots, summary stats, etc.). */
  output: IOutput;
  /** Per-frame model state (positions, velocities, current readings). */
  transient: ITransient;
  setInput: Dispatch<SetStateAction<IInput>>;
  setOutput: Dispatch<SetStateAction<IOutput>>;
  setTransient: Dispatch<SetStateAction<ITransient>>;
  /** Restore ONLY transient to its initial value — use between trials. */
  resetTransient: () => void;
  /** Restore ONLY output to its initial value — use between trials. */
  resetOutput: () => void;
  /** Restore all three to their initial values — use on full sim reset. */
  resetAll: () => void;
}

/**
 * The canonical state hook for a Mass Sims simulation. Three typed state shapes:
 *
 *   - `input` — user-controlled parameters (what the user is setting between trials).
 *   - `output` — per-trial accumulated record (what the model produced, displayed in
 *     the Data panel and recorded into trials).
 *   - `transient` — per-frame model state (positions, velocities, current readings).
 *
 * Sims pass an initial value for each. Setters follow standard `useState` semantics
 * (value-or-updater). Three reset helpers cover the common transition points:
 * `resetTransient` between trials, `resetOutput` to clear accumulated stats, `resetAll`
 * on full sim reset; each restores the value provided at mount.
 */
export function useModelState<IInput, IOutput, ITransient>(
  options: UseModelStateOptions<IInput, IOutput, ITransient>,
): UseModelStateReturn<IInput, IOutput, ITransient> {
  const { initialInput, initialOutput, initialTransient } = options;
  const [input, setInput] = useState<IInput>(initialInput);
  const [output, setOutput] = useState<IOutput>(initialOutput);
  const [transient, setTransient] = useState<ITransient>(initialTransient);
  // Capture the mount-time initials so reset always restores the values the state was seeded with,
  // regardless of later prop changes — and so the reset callbacks keep a stable identity.
  const mountInput = useRef(initialInput);
  const mountOutput = useRef(initialOutput);
  const mountTransient = useRef(initialTransient);
  const resetTransient = useCallback(() => setTransient(mountTransient.current), []);
  const resetOutput = useCallback(() => setOutput(mountOutput.current), []);
  const resetAll = useCallback(() => {
    setInput(mountInput.current);
    setOutput(mountOutput.current);
    setTransient(mountTransient.current);
  }, []);
  return {
    input,
    output,
    transient,
    setInput,
    setOutput,
    setTransient,
    resetTransient,
    resetOutput,
    resetAll,
  };
}
