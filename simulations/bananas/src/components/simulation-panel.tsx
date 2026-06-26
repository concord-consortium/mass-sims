import clsx from "clsx";
import { observer } from "mobx-react-lite";
import { type RefObject, useEffect } from "react";
import BananaTreeIcon from "../assets/icons/banana-tree.svg?react";
import BananaTreeInfectedIcon from "../assets/icons/banana-tree-infected.svg?react";
import FungusAddedIcon from "../assets/icons/fungus-added.svg?react";
import { MAX_CROSSES } from "../model/genetics";
import { useStores } from "../stores/root-store";
import type { TrialModelInstance } from "../stores/trial-model";
import { ControlBar } from "./control-bar";
import { ParentSelectors } from "./parent-selectors";

import "./simulation-panel.scss";

export interface SimulationPanelProps {
  gridRef: RefObject<HTMLElement | null>;
}

/** Builds the status pill content, or `null` when both parents aren't selected yet (no pill). */
function renderStatusPill(trial: TrialModelInstance) {
  const bothParentsSelected = !!(trial.p1 && trial.p2);
  if (!bothParentsSelected) return null;

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
 * Renders the offspring grid contents: a top "Fungus introduced" marker when fungus is on (it's
 * all-or-nothing for the trial, so no between-row markers), the <ul> of cross rows (empty until
 * the first cross), the empty-state hint, and the "Max crosses reached" notice at the cap. Only
 * the rows live inside the list; the marker, hint, and notice are siblings so it stays a clean
 * list of crosses for assistive tech.
 *
 * `activeCross` is the store's bounds-checked selection (the `RootStore.activeCross` view), never
 * the raw stored selection index — see the Selection access contract.
 */
function renderOffspringGrid(
  trial: TrialModelInstance,
  activeCross: number | null,
  selectCross: (idx: number | null) => void,
) {
  const bothParentsSelected = !!(trial.p1 && trial.p2);
  const fungusMarker = trial.fungusOn ? (
    <div className="fungus-marker" role="presentation">
      <span className="fungus-marker-label">
        <FungusAddedIcon className="fungus-marker-icon" aria-hidden="true" />
        Fungus introduced
      </span>
    </div>
  ) : null;

  return (
    <>
      {fungusMarker}
      <ul className="offspring-list" aria-label="Crosses">
        {trial.crosses.map((plants, gi) => {
          const healthy = plants.filter((p) => !p.infected).length;
          const infected = plants.length - healthy;
          const selected = activeCross === gi;
          const toggle = () => selectCross(selected ? null : gi);

          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: crosses are append-only, index is stable
              key={gi}
              className={clsx("offspring-row", selected && "offspring-row--selected")}
            >
              <button
                aria-label={`Cross ${gi + 1}, ${plants.length} offspring, ${healthy} healthy, ${infected} infected`}
                aria-pressed={selected}
                className="offspring-row-button"
                type="button"
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
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
              </button>
            </li>
          );
        })}
      </ul>
      {bothParentsSelected && trial.crosses.length === 0 ? (
        <p className="offspring-grid-placeholder">Each cross will produce 5–20 offspring.</p>
      ) : null}
      {trial.crosses.length >= MAX_CROSSES ? (
        <div className="offspring-grid-max" role="status" aria-live="polite">
          Max number of crosses reached
        </div>
      ) : null}
    </>
  );
}

export const SimulationPanel = observer(function SimulationPanel({
  gridRef,
}: SimulationPanelProps) {
  const rootStore = useStores();
  const trial = rootStore.activeTrial;
  const activeCross = rootStore.activeCross;

  const pillContent = renderStatusPill(trial);
  const pillCondensable = trial.fungusOn && trial.crosses.length === 0;

  // After each cross, scroll the grid to the newest row (no-op when it already fits). Gated on
  // a non-empty grid so it doesn't run on mount/reset. `observer` re-runs render when the length
  // changes, so `crossCount` retriggers the effect. Reads the App-passed `gridRef`.
  const crossCount = trial.crosses.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: gridRef is a stable ref passed from App; only crossCount should retrigger the scroll (refs aren't reactive deps).
  useEffect(() => {
    if (crossCount === 0) return;
    const el = gridRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [crossCount]);

  return (
    <>
      <span className="active-trial-badge" aria-hidden="true">
        {rootStore.ui.selectedTrialLetter}
      </span>
      <div className="bananas-simulation-panel">
        <ParentSelectors />

        {pillContent ? (
          <div className="status-pill-wrap">
            <div
              className={clsx("status-pill", pillCondensable && "status-pill--condensable")}
              role="status"
              aria-live="polite"
            >
              {pillContent}
            </div>
          </div>
        ) : null}

        {/*
        This element is the scroller for App#scrollToCross. Two invariants must hold for
        scrollToCross to work: (1) this is the element whose scrollTop moves when the user
        scrolls the offspring list; (2) every cross row inside it carries the class
        `.offspring-row` and appears in cross-index order (row 0 is A1, row 1 is A2, …).
      */}
        <section className="offspring-grid" ref={gridRef}>
          {renderOffspringGrid(trial, activeCross, (idx) => rootStore.ui.selectCross(idx))}
        </section>

        <ControlBar />
      </div>
    </>
  );
});
