import { Select } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
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

interface ParentSlotProps {
  label: string;
  value: ParentId | null;
  isLocked: boolean;
  onSelect: (id: ParentId) => void;
  action: string;
}

/**
 * One parent control: an interactive `<Select>` before the first cross, swapped for a static
 * chip once the trial locks, and back to the `<Select>` on Reset (when `isLocked` goes false).
 */
function ParentSlot({ label, value, isLocked, onSelect, action }: ParentSlotProps) {
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
    />
  );
}

export const ParentSelectors = observer(function ParentSelectors() {
  const { trial } = useStores();
  // The model stores parents as `types.string`; they are semantically `ParentId`, so cast at the
  // boundary into the `ParentId`-typed slot props.
  const p1 = trial.p1 as ParentId | null;
  const p2 = trial.p2 as ParentId | null;
  return (
    <div className="parent-selectors">
      <ParentSlot
        label="Parent 1"
        value={p1}
        isLocked={trial.locked}
        onSelect={(id) => trial.setP1(id)}
        action="parent_1_set"
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
        isLocked={trial.locked}
        onSelect={(id) => trial.setP2(id)}
        action="parent_2_set"
      />
    </div>
  );
});
