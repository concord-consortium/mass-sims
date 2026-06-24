import { getEnv, type Instance, type SnapshotOut, types } from "mobx-state-tree";
import { MAX_CROSSES, makeCross, type OffspringPlant, type ParentId } from "../model/genetics";

/**
 * Canonical declaration of trial state. `getSnapshot(trial)` is the `SavedState` wire format
 * exactly (no version field) — see `TrialState`/`SavedState` below.
 *
 * RNG NOTE: `crossPlants` reads its RNG from the MST environment (`getEnv(self).rng`). The
 * environment is shared across the whole tree, so any model — including child models added later —
 * can reach the rng via `getEnv` without it being threaded in explicitly. It also stays out of
 * snapshots, so LARA's `interactiveState` never carries a function reference. (`types.volatile`
 * state is excluded from snapshots too, but only the environment gives that tree-wide access.)
 */
export const TrialModel = types
  .model("Trial", {
    p1: types.maybeNull(types.string),
    p2: types.maybeNull(types.string),
    locked: types.boolean,
    fungusOn: types.boolean,
    crosses: types.array(types.array(types.frozen<OffspringPlant>())),
  })
  .views((self) => ({
    get bothParentsSelected(): boolean {
      return !!(self.p1 && self.p2);
    },
    get atCrossCap(): boolean {
      return self.crosses.length >= MAX_CROSSES;
    },
    get canCross(): boolean {
      return this.bothParentsSelected && !this.atCrossCap;
    },
    get isFungusLocked(): boolean {
      return !this.bothParentsSelected || self.crosses.length > 0;
    },
    get canReset(): boolean {
      return !!(self.p1 || self.p2 || self.fungusOn || self.crosses.length > 0);
    },
    get totalOffspring(): number {
      return self.crosses.reduce((sum, cross) => sum + cross.length, 0);
    },
  }))
  .actions((self) => ({
    setP1(id: ParentId) {
      if (self.locked) return;
      self.p1 = id;
    },
    setP2(id: ParentId) {
      if (self.locked) return;
      self.p2 = id;
    },
    setFungus(value: boolean) {
      if (!self.p1 || !self.p2 || self.crosses.length > 0) return;
      self.fungusOn = value;
    },
    // Build a cross and append it. RNG comes from the MST environment, never a model property.
    crossPlants() {
      if (!self.p1 || !self.p2 || self.crosses.length >= MAX_CROSSES) return;
      const { rng } = getEnv<{ rng: () => number }>(self);
      const plants = makeCross(self.p1 as ParentId, self.p2 as ParentId, self.fungusOn, rng);
      self.crosses.push(plants);
      self.locked = true;
    },
    reset() {
      self.p1 = null;
      self.p2 = null;
      self.locked = false;
      self.fungusOn = false;
      self.crosses.clear();
    },
  }));

export type TrialModelInstance = Instance<typeof TrialModel>;

/**
 * Factory (not a shared constant): each call returns a fresh snapshot, so resets and separate
 * trials never share a mutable `crosses` array.
 *
 * The return type is intentionally left to inference (the precise empty-trial literal) rather
 * than annotated as `SnapshotIn<typeof TrialModel>`: the literal is assignable both to `SnapshotIn`
 * (for `RootStore.create`) and to `TrialState` (whose `p1`/`p2` keep their `ParentId | null` type),
 * so callers seed an empty trial without casts.
 */
export function emptyTrialSnapshot() {
  return {
    p1: null,
    p2: null,
    locked: false,
    fungusOn: false,
    crosses: [],
  };
}

/**
 * The trial state shape, derived from `TrialModel` so the wire format can't drift from the store.
 * `locked`, `fungusOn`, and `crosses` come straight from the model snapshot; `p1`/`p2` retain their
 * `ParentId | null` literal type (the model stores them as `types.string` for snapshot simplicity,
 * but consumers still treat them as parent ids).
 */
export type TrialState = Omit<SnapshotOut<typeof TrialModel>, "p1" | "p2"> & {
  p1: ParentId | null;
  p2: ParentId | null;
};

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. Identical to
 * `TrialState` — a snapshot of the current trial, JSON-serializable and round-trips verbatim.
 * Named distinctly because this is a wire format: changing its shape changes what restores from
 * saved sessions. (Versioning is a deliberate follow-up; no version field yet.)
 */
export type SavedState = TrialState;
