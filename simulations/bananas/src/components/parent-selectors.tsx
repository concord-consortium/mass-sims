import { Select } from "@concord-consortium/mass-sims-shared";
import BananaTreeIcon from "../assets/icons/banana-tree.svg?react";
import { PARENT_GENOTYPES, PARENT_LABELS, type ParentId } from "../model/genetics";

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

export interface ParentSelectorsProps {
  p1: ParentId | null;
  p2: ParentId | null;
  isLocked: boolean;
  onSelectParent1: (id: ParentId) => void;
  onSelectParent2: (id: ParentId) => void;
}

export function ParentSelectors({
  p1,
  p2,
  isLocked,
  onSelectParent1,
  onSelectParent2,
}: ParentSelectorsProps) {
  return (
    <div className="parent-selectors">
      <ParentSlot
        label="Parent 1"
        value={p1}
        isLocked={isLocked}
        onSelect={onSelectParent1}
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
        isLocked={isLocked}
        onSelect={onSelectParent2}
        action="parent_2_set"
      />
    </div>
  );
}
