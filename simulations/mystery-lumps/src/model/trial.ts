import { LUMP_IDS, type LumpId } from "./substances";
import type { SettingId, TestId } from "./tests";

export interface LumpRecord {
  handled: boolean;
  wafted: boolean;
  /** The one destructive test this lump has been given, or null while it still has material. */
  result: { test: TestId; setting: SettingId | null } | null;
}

export interface Trial {
  id: string;
  lumps: Record<LumpId, LumpRecord>;
}

// Ids are not security-sensitive; Math.random is fine, as in the Starter.
function makeTrialId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeEmptyTrial(): Trial {
  const lumps = {} as Record<LumpId, LumpRecord>;
  for (const id of LUMP_IDS) lumps[id] = { handled: false, wafted: false, result: null };
  return { id: makeTrialId(), lumps };
}

/** The lumps that still have material for a destructive test. */
export function untestedLumps(trial: Trial): LumpId[] {
  return LUMP_IDS.filter((id) => trial.lumps[id].result === null);
}

function withLump(trial: Trial, lump: LumpId, patch: Partial<LumpRecord>): Trial {
  return { ...trial, lumps: { ...trial.lumps, [lump]: { ...trial.lumps[lump], ...patch } } };
}

/**
 * Spends a lump's one shot. Returns the trial unchanged — same reference, so React skips the
 * render — if that lump has already been tested, which is the one-shot rule enforced in the
 * one place rather than in every caller.
 */
export function applyTest(
  trial: Trial,
  lump: LumpId,
  test: TestId,
  setting: SettingId | null,
): Trial {
  if (trial.lumps[lump].result !== null) return trial;
  return withLump(trial, lump, { result: { test, setting } });
}

export function markHandled(trial: Trial, lump: LumpId): Trial {
  return withLump(trial, lump, { handled: true });
}

export function markWafted(trial: Trial, lump: LumpId): Trial {
  return withLump(trial, lump, { wafted: true });
}

/**
 * Gives one lump its material back, undoing the test it was given. What the student already saw
 * by handling or wafting it stays — they did look at it, and looking costs nothing.
 *
 * This is the narrow undo behind "Reset Test". Clearing a whole trial is `clearTrial`, reached
 * only from the trial card.
 */
export function resetLumpTest(trial: Trial, lump: LumpId): Trial {
  if (trial.lumps[lump].result === null) return trial;
  return withLump(trial, lump, { result: null });
}

/** Empties a trial but keeps its identity, so its card stays in place. */
export function clearTrial(trial: Trial): Trial {
  return { ...makeEmptyTrial(), id: trial.id };
}
