import { Select } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { useLayoutEffect, useRef } from "react";
import BananaTreeIcon from "../assets/icons/banana-tree.svg?react";
import { PARENT_GENOTYPES, PARENT_LABELS, type ParentId } from "../model/genetics";
import { useStores } from "../stores/root-store";

import "./parent-selectors.scss";

// Derived from the genetics catalog so the UI can't drift from the engine: adding a parent
// variety later only touches PARENT_GENOTYPES + PARENT_LABELS.
const PARENT_OPTIONS = (Object.keys(PARENT_GENOTYPES) as ParentId[]).map((id) => ({
  id,
  label: PARENT_LABELS[id],
}));

// ---------------------------------------------------------------------------
// Responsive parent-row scaling.
//
// The row's sizing depends on the rendered width of the parent-option labels, which CSS can't
// measure — so a ResizeObserver measures them and writes the resulting sizes as custom properties
// on `.parent-selectors` whenever the panel resizes; parent-selectors.scss only applies them. The
// sizing runs in two phases, keyed to the panel width: Phase 1 pins each trigger at its full
// (Lato) width and shrinks the parent circles to absorb the narrowing; Phase 2 locks the circles
// at their 42px minimum and shrinks the triggers instead, condensing their font once they drop
// below the full width.
// ---------------------------------------------------------------------------

const CIRCLE_MIN = 42;
const CIRCLE_MAX = 80;
const CROSS_W = 24;
const MIN_GAP = 5;
const FULL_GAP = 10;

// Trigger box widths at the two fonts, measured once (and again once web fonts load). Module-level
// so the (single) row only pays for the hidden-span measurement once across remounts.
let cachedLatoW: number | null = null;
let cachedCondensedW: number | null = null;

function measureTriggerWidths(labels: readonly string[]) {
  // Measure at weight 400 to match the design's trigger-box sizing. The trigger renders its label
  // bold (700), but the box is sized from the 400-weight width; measuring at 700 would make every
  // trigger a few pixels too wide.
  const span = document.createElement("span");
  span.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap;font-size:16px;font-weight:400;font-family:Lato,sans-serif";
  document.body.appendChild(span);
  let maxLato = 0;
  for (const label of labels) {
    span.textContent = label;
    maxLato = Math.max(maxLato, span.offsetWidth);
  }
  span.style.fontFamily = "'Roboto Condensed', sans-serif";
  let maxCondensed = 0;
  for (const label of labels) {
    span.textContent = label;
    maxCondensed = Math.max(maxCondensed, span.offsetWidth);
  }
  span.remove();
  // Trigger box = text + label→caret gap + caret + horizontal padding + border.
  cachedLatoW = maxLato + 6 + 24 + 20 + 4;
  cachedCondensedW = maxCondensed + 0 + 18 + 12 + 4;
}

function setCondensed(row: HTMLElement, condensed: boolean) {
  row.toggleAttribute("data-condensed", condensed);
  // The Select popover is portaled to <body>, outside the row, so its list keys off :root instead
  // (app.scss). This keeps the list font in lockstep with the trigger font.
  document.documentElement.toggleAttribute("data-parent-condensed", condensed);
}

function applyParentRowScaling(row: HTMLElement) {
  if (cachedLatoW === null || cachedCondensedW === null) return;
  const latoW = cachedLatoW;
  const condensedW = cachedCondensedW;
  const pw = row.clientWidth;
  const set = (name: string, value: string) => row.style.setProperty(name, value);

  // Phase 1: triggers pinned at the Lato width; the circles shrink to absorb the narrowing.
  const availLato = pw - latoW * 2 - CROSS_W - FULL_GAP * 4;
  const szLato = Math.max(CIRCLE_MIN, Math.min(CIRCLE_MAX, Math.floor(availLato / 2)));
  if (szLato > CIRCLE_MIN) {
    const t = (szLato - CIRCLE_MIN) / (CIRCLE_MAX - CIRCLE_MIN);
    set("--parent-group-flex", "1");
    set("--parent-trigger-width", `${latoW}px`);
    set("--parent-circle-size", `${szLato}px`);
    set(
      "--parent-row-gap",
      `${Math.max(MIN_GAP, Math.round(MIN_GAP + t * (FULL_GAP - MIN_GAP)))}px`,
    );
    set("--parent-cross-size", `${Math.round(20 + t * (24 - 20))}px`);
    set("--parent-dd-pad-left", "10px");
    set("--parent-dd-pad-right", "10px");
    set("--parent-dd-gap", "6px");
    set("--parent-caret-size", "24px");
    setCondensed(row, false);
    return;
  }

  // Phase 2: circles locked at the minimum; the triggers shrink and (below the Lato width) condense.
  set("--parent-group-flex", "none");
  set("--parent-circle-size", `${CIRCLE_MIN}px`);
  set("--parent-row-gap", `${MIN_GAP}px`);
  set("--parent-cross-size", "20px");
  const fixedSpace = CIRCLE_MIN * 2 + CROSS_W + MIN_GAP * 4;
  const ddBudget = Math.floor((pw - fixedSpace) / 2);
  const ddW = Math.max(condensedW, Math.min(latoW, ddBudget));
  const ddT = latoW > condensedW ? (ddW - condensedW) / (latoW - condensedW) : 0;
  set("--parent-trigger-width", `${ddW}px`);
  set("--parent-dd-pad-left", `${Math.round(7 + ddT * 3)}px`);
  set("--parent-dd-pad-right", `${Math.round(5 + ddT * 5)}px`);
  set("--parent-dd-gap", `${Math.round(ddT * 6)}px`);
  set("--parent-caret-size", `${Math.round(18 + ddT * 6)}px`);
  setCondensed(row, ddW < latoW);
}

function useParentRowScaling(rowRef: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const labels = Object.values(PARENT_LABELS);
    const update = () => applyParentRowScaling(row);

    measureTriggerWidths(labels);
    update();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(row);

    // Re-measure once the web fonts load — the first pass may have used fallback metrics.
    let active = true;
    document.fonts?.ready?.then(() => {
      if (!active) return;
      measureTriggerWidths(labels);
      update();
    });

    return () => {
      active = false;
      observer?.disconnect();
      document.documentElement.removeAttribute("data-parent-condensed");
    };
  }, [rowRef]);
}

interface ParentSlotProps {
  label: string;
  value: ParentId | null;
  isLocked: boolean;
  onSelect: (id: ParentId) => void;
  action: string;
  actionParams?: Record<string, unknown>;
}

/**
 * One parent control: an interactive `<Select>` before the first cross, swapped for a static
 * chip once the trial locks, and back to the `<Select>` on Reset (when `isLocked` goes false).
 */
function ParentSlot({ label, value, isLocked, onSelect, action, actionParams }: ParentSlotProps) {
  if (isLocked && value) {
    return (
      <div className="parent-chip">
        <div className="parent-chip-inner">
          <span className="parent-chip-label">{label}</span>
          <span className="parent-chip-value">{PARENT_LABELS[value]}</span>
        </div>
      </div>
    );
  }
  return (
    <Select<ParentId>
      label={label}
      options={PARENT_OPTIONS}
      placeholder="Select…"
      className="parent-select"
      selectedKey={value}
      isDisabled={isLocked}
      onSelectionChange={onSelect}
      action={action}
      actionParams={actionParams}
    />
  );
}

export const ParentSelectors = observer(function ParentSelectors() {
  const { activeTrial, ui } = useStores();
  const rowRef = useRef<HTMLDivElement>(null);
  useParentRowScaling(rowRef);
  // The trial letter targeted by this action, read at emit time from the active selection.
  const trial = ui.selectedTrialLetter;
  // The model stores parents as `types.string`; they are semantically `ParentId`, so cast at the
  // boundary into the `ParentId`-typed slot props.
  const p1 = activeTrial.p1 as ParentId | null;
  const p2 = activeTrial.p2 as ParentId | null;
  // The status pill appears once both parents are selected; the row reserves extra bottom space for
  // it then (and only then), so it doesn't sit too tall while the placeholder selects show.
  const hasStatusPill = !!(p1 && p2);

  return (
    <div className={`parent-selectors${hasStatusPill ? " has-status-pill" : ""}`} ref={rowRef}>
      <ParentSlot
        label="Parent 1"
        value={p1}
        isLocked={activeTrial.locked}
        onSelect={(id) => activeTrial.setP1(id)}
        action="parent_1_set"
        actionParams={{ trial }}
      />
      <div className="parent-circle" aria-hidden="true">
        {p1 ? <BananaTreeIcon className="parent-circle-plant" /> : null}
      </div>
      <span className="cross-symbol" aria-hidden="true">
        ×
      </span>
      <div className="parent-circle" aria-hidden="true">
        {p2 ? <BananaTreeIcon className="parent-circle-plant" /> : null}
      </div>
      <ParentSlot
        label="Parent 2"
        value={p2}
        isLocked={activeTrial.locked}
        onSelect={(id) => activeTrial.setP2(id)}
        action="parent_2_set"
        actionParams={{ trial }}
      />
    </div>
  );
});
