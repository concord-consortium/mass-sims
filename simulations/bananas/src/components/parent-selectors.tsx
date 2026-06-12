import { Select } from "@concord-consortium/mass-sims-shared";
import "./parent-selectors.scss";

const PARENT_OPTIONS = [
  { id: "wild-w1", label: "Wild W1" },
  { id: "wild-w2", label: "Wild W2" },
  { id: "wild-w3", label: "Wild W3" },
  { id: "cavendish-c1", label: "Cavendish C1" },
  { id: "cavendish-c2", label: "Cavendish C2" },
] as const;

export function ParentSelectors() {
  return (
    <div className="parent-selectors">
      <Select
        label="Parent 1"
        options={PARENT_OPTIONS}
        placeholder="Select…"
        className="parent-select"
      />
      <div className="parent-circle" aria-hidden="true" />
      <span className="cross-symbol" aria-hidden="true">
        ×
      </span>
      <div className="parent-circle" aria-hidden="true" />
      <Select
        label="Parent 2"
        options={PARENT_OPTIONS}
        placeholder="Select…"
        className="parent-select"
      />
    </div>
  );
}
