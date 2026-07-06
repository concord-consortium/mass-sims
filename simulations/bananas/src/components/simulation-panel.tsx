import {
  smoothScrollIntoView,
  type TrialLetter,
  useAnnounce,
  useScrollFocusRing,
} from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import { type KeyboardEvent, type RefObject, useEffect, useState } from "react";
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

interface OffspringListProps {
  trial: TrialModelInstance;
  activeCross: number | null;
  selectCross: (idx: number | null) => void;
  trialLetter: TrialLetter;
}

/**
 * The <ul> of cross rows and its roving-tabindex keyboard navigation. Exactly one row button is in
 * the tab order at a time (`tabIndex={0}`); the rest are `-1`, so the whole list is a single tab
 * stop. Arrow/Home/End move FOCUS ONLY (they never change selection) and arrows WRAP; Enter/Space
 * toggle the row's selection. Every row's `onFocus` writes its index into the roving state, so any
 * focus source (arrow, click, or a programmatic `.focus()` from elsewhere) keeps the tabbable row
 * in sync.
 *
 * `activeCross` is the store's bounds-checked selection (the `RootStore.activeCross` view), never
 * the raw stored selection index — see the Selection access contract.
 */
const OffspringList = observer(function OffspringList({
  trial,
  activeCross,
  selectCross,
  trialLetter,
}: OffspringListProps) {
  const count = trial.crosses.length;
  const announce = useAnnounce();

  // Roving focus index: which row carries tabIndex={0}. Defaults to the selected cross, else the
  // first row. Independent of selection because arrow nav moves focus without selecting.
  const [focusedRow, setFocusedRow] = useState(activeCross ?? 0);

  // When a row gets SELECTED (activeCross transitions to a new index), move the roving index there
  // so the selected cross is the tab stop (matches the demo). Tracked as a transition, not a
  // constraint, so arrowing focus AWAY from a selected row afterward isn't snapped back.
  const [prevActiveCross, setPrevActiveCross] = useState(activeCross);
  if (activeCross !== prevActiveCross) {
    setPrevActiveCross(activeCross);
    if (activeCross !== null) setFocusedRow(activeCross);
  }

  // Keep the roving index valid as the crosses array changes (new cross appended, trial switched,
  // reset) so it never points past the end.
  const clamped = count === 0 ? 0 : Math.min(Math.max(focusedRow, 0), count - 1);
  if (clamped !== focusedRow) setFocusedRow(clamped);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLElement>(".offspring-row-button");
    if (!button || count === 0) return;
    const cur = clamped;
    let next: number;
    switch (e.key) {
      case "ArrowDown":
        next = (cur + 1) % count;
        break;
      case "ArrowUp":
        next = (cur - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    // preventScroll so the browser's default focus-scroll doesn't jump the row before our smooth
    // scrollIntoView runs; onFocus on the target button updates the roving index.
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>(".offspring-row-button");
    const nextButton = buttons[next];
    if (nextButton) {
      nextButton.focus({ preventScroll: true });
      smoothScrollIntoView(nextButton);
    }
  };

  return (
    <ul className="offspring-list" aria-label="Crosses" onKeyDown={onKeyDown}>
      {trial.crosses.map((plants, gi) => {
        const healthy = plants.filter((p) => !p.infected).length;
        const infected = plants.length - healthy;
        const selected = activeCross === gi;
        const toggle = () => {
          if (selected) {
            selectCross(null);
            announce("All crosses selected");
          } else {
            selectCross(gi);
            // Percentages match the pie's rounding (healthy rounded, infected = remainder).
            const total = plants.length;
            const healthyPct = total === 0 ? 0 : Math.round((healthy / total) * 100);
            const infectedPct = total === 0 ? 0 : 100 - healthyPct;
            announce(
              `Cross ${trialLetter}${gi + 1}: ${healthyPct}% healthy, ${infectedPct}% infected`,
            );
          }
        };

        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: crosses are append-only, index is stable
            key={gi}
            className={clsx("offspring-row", selected && "offspring-row--selected")}
          >
            <button
              aria-label={`Cross ${trialLetter}${gi + 1}, ${plants.length} offspring, ${healthy} healthy, ${infected} infected`}
              aria-pressed={selected}
              className="offspring-row-button"
              type="button"
              tabIndex={gi === clamped ? 0 : -1}
              onFocus={() => setFocusedRow(gi)}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <div className="offspring-row-label">
                <span className="offspring-row-name">{`${trialLetter}${gi + 1}`}</span>
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
  );
});

/**
 * Renders the offspring grid contents: a top "Fungus introduced" marker when fungus is on (it's
 * all-or-nothing for the trial, so no between-row markers), the list of cross rows (empty until
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
  trialLetter: TrialLetter,
) {
  const bothParentsSelected = !!(trial.p1 && trial.p2);
  const fungusMarker = trial.fungusOn ? (
    <div className="fungus-marker">
      <span className="fungus-marker-label">
        <FungusAddedIcon className="fungus-marker-icon" aria-hidden="true" />
        Fungus introduced
      </span>
    </div>
  ) : null;

  return (
    <>
      {fungusMarker}
      <OffspringList
        trial={trial}
        activeCross={activeCross}
        selectCross={selectCross}
        trialLetter={trialLetter}
      />
      {bothParentsSelected && trial.crosses.length === 0 ? (
        <p className="offspring-grid-placeholder">Each cross will produce 5–20 offspring.</p>
      ) : null}
      {trial.crosses.length >= MAX_CROSSES ? (
        // The cap is narrated once, composed into the cross-creation utterance, through the shared <Announcer>.
        <div className="offspring-grid-max">Max number of crosses reached</div>
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

  // Compose a scroll-focus-ring callback ref onto the App-passed gridRef so the grid is
  // keyboard-scrollable while still exposing its scroller element to App#scrollToCross. The
  // callback writes through to gridRef.current, so scrollToCross keeps reading the same element.
  const gridCallbackRef = useScrollFocusRing<HTMLElement>(gridRef);

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
            <div className={clsx("status-pill", pillCondensable && "status-pill--condensable")}>
              {pillContent}
            </div>
          </div>
        ) : null}

        <div className="offspring-grid-wrap">
          {/*
          This element is the scroller for App#scrollToCross. Two invariants must hold for
          scrollToCross to work: (1) this is the element whose scrollTop moves when the user
          scrolls the offspring list; (2) every cross row inside it carries the class
          `.offspring-row` and appears in cross-index order (row 0 is A1, row 1 is A2, …).
        */}
          <section className="offspring-grid scroll-region" ref={gridCallbackRef}>
            {renderOffspringGrid(
              trial,
              activeCross,
              (idx) => rootStore.ui.selectCross(idx),
              rootStore.ui.selectedTrialLetter,
            )}
          </section>
          <div className="scroll-focus-ring" aria-hidden="true" />
        </div>

        <ControlBar />
      </div>
    </>
  );
});
