import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import BananaTreeIcon from "../assets/icons/banana-tree.svg?react";
import BananaTreeInfectedIcon from "../assets/icons/banana-tree-infected.svg?react";
import FungusAddedIcon from "../assets/icons/fungus-added.svg?react";
import { MAX_CROSSES, makeCross, type ParentId } from "../model/genetics";
import { emptyTrial, type TrialState } from "../model/trial";
import { ControlBar } from "./control-bar";
import { ParentSelectors } from "./parent-selectors";

import "./simulation-panel.scss";

export interface SimulationPanelProps {
  /** RNG injection seam. Defaults to `Math.random`; tests pass a seeded PRNG for deterministic crosses. */
  rng?: () => number;
}

/** Builds the status pill content, or `null` when both parents aren't selected yet (no pill). */
function renderStatusPill(trial: TrialState) {
  const both = !!(trial.p1 && trial.p2);
  if (!both) return null; // No pill until both parents are selected.

  if (trial.crosses.length === 0) {
    return trial.fungusOn ? (
      <>
        Cross plants to see their offspring ·{" "}
        <span className="fungus-active-label">Fungus active</span>
      </>
    ) : (
      <>
        Click <strong>Cross Plants</strong> to see their offspring
      </>
    );
  }
  const total = trial.crosses.reduce((sum, group) => sum + group.length, 0);
  return (
    <>
      Crosses: <strong>{trial.crosses.length}</strong> · Offspring: <strong>{total}</strong>
      {trial.fungusOn ? (
        <>
          {" "}
          · <span className="fungus-active-label">Fungus active</span>
        </>
      ) : null}
    </>
  );
}

/**
 * Renders the offspring grid: a single top "Fungus introduced" marker when fungus is on (it's
 * all-or-nothing for the trial, so no between-row markers), the cross rows or an empty-state
 * hint, and the "Max crosses reached" notice at the cap.
 */
function renderOffspringGrid(trial: TrialState) {
  const fungusMarker = trial.fungusOn ? (
    <div className="fungus-marker" role="presentation">
      <span className="fungus-marker-label">
        <FungusAddedIcon className="fungus-marker-icon" aria-hidden="true" />
        Fungus introduced
      </span>
    </div>
  ) : null;

  if (trial.crosses.length === 0) {
    return (
      <>
        {fungusMarker}
        <p className="offspring-grid-placeholder">Each cross will produce 5–20 offspring.</p>
      </>
    );
  }

  return (
    <>
      {fungusMarker}
      {trial.crosses.map((plants, gi) => {
        const healthy = plants.filter((p) => !p.infected).length;
        const infected = plants.length - healthy;
        return (
          // biome-ignore lint/a11y/useSemanticElements: the list interleaves presentational markers, so native <li> can't be used
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: crosses are append-only, index is stable
            key={gi}
            className="offspring-row"
            role="listitem"
            aria-label={`Cross ${gi + 1}, ${plants.length} offspring, ${healthy} healthy, ${infected} infected`}
          >
            <div className="offspring-row-label">
              <span className="offspring-row-name">{`A${gi + 1}`}</span>
              <span className="offspring-row-count">{`(${plants.length})`}</span>
            </div>
            <div className="offspring-row-plants">
              {plants.map((plant, pi) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: plants within a cross are positional and stable
                  key={pi}
                  className={clsx("offspring-plant", plant.infected && "infected")}
                >
                  {plant.infected ? (
                    <BananaTreeInfectedIcon aria-hidden="true" />
                  ) : (
                    <BananaTreeIcon aria-hidden="true" />
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {trial.crosses.length >= MAX_CROSSES ? (
        <div className="offspring-grid-max" role="status" aria-live="polite">
          Max number of crosses reached
        </div>
      ) : null}
    </>
  );
}

export function SimulationPanel({ rng = Math.random }: SimulationPanelProps) {
  const [trial, setTrial] = useState<TrialState>(emptyTrial);

  const onSelectParent1 = (id: ParentId) => setTrial((t) => (t.locked ? t : { ...t, p1: id }));
  const onSelectParent2 = (id: ParentId) => setTrial((t) => (t.locked ? t : { ...t, p2: id }));

  const onCrossPlants = () =>
    setTrial((t) => {
      if (!t.p1 || !t.p2 || t.crosses.length >= MAX_CROSSES) return t;
      const plants = makeCross(t.p1, t.p2, t.fungusOn, rng);
      return { ...t, locked: true, crosses: [...t.crosses, plants] };
    });

  // Defensive guard: ignore writes the UI shouldn't have allowed (no parents, or crossing
  // started). The switch already enforces isFungusLocked; this is the last line of defense.
  const onSetFungus = (value: boolean) =>
    setTrial((t) => (!t.p1 || !t.p2 || t.crosses.length > 0 ? t : { ...t, fungusOn: value }));

  const onResetTrial = () => setTrial(emptyTrial());

  const bothParentsSelected = !!(trial.p1 && trial.p2);
  const atCrossCap = trial.crosses.length >= MAX_CROSSES;
  const canCross = bothParentsSelected && !atCrossCap;
  const isFungusLocked = !bothParentsSelected || trial.crosses.length > 0;
  const canReset = !!(trial.p1 || trial.p2 || trial.fungusOn || trial.crosses.length > 0);

  const pillContent = renderStatusPill(trial);

  // After each cross, scroll the grid to the newest row (no-op when it already fits). Gated on
  // a non-empty grid so it doesn't run on mount/reset.
  const gridRef = useRef<HTMLElement>(null);
  const crossCount = trial.crosses.length;
  useEffect(() => {
    if (crossCount === 0) return;
    const el = gridRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [crossCount]);

  return (
    <div className="bananas-simulation-panel">
      <ParentSelectors
        p1={trial.p1}
        p2={trial.p2}
        isLocked={trial.locked}
        onSelectParent1={onSelectParent1}
        onSelectParent2={onSelectParent2}
      />

      {pillContent ? (
        <div className="status-pill-wrap">
          <div className="status-pill" role="status" aria-live="polite">
            {pillContent}
          </div>
        </div>
      ) : null}

      {/* biome-ignore lint/a11y/useSemanticElements: list holds presentational markers + a status placeholder, native <ul> can't contain them */}
      <section className="offspring-grid" role="list" aria-label="Crosses" ref={gridRef}>
        {renderOffspringGrid(trial)}
      </section>

      <ControlBar
        canCross={canCross}
        fungusOn={trial.fungusOn}
        isFungusLocked={isFungusLocked}
        canReset={canReset}
        onCrossPlants={onCrossPlants}
        onSetFungus={onSetFungus}
        onResetTrial={onResetTrial}
      />
    </div>
  );
}
