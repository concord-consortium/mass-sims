import { DataSubsection, SimulationFrame, TrialCard } from "@concord-consortium/mass-sims-shared";
import { useState } from "react";

// The four exact widths from ui-design-plan.md §6. Height is fixed at 562 px by the frame.
const WIDTHS: Array<{ px: number; label: string; standalone: boolean }> = [
  { px: 1044, label: "1044 — Activity Player Full Width", standalone: false },
  { px: 1024, label: "1024 — Standalone", standalone: true },
  { px: 989, label: "989 — AP 2-col, instructions panel collapsed", standalone: false },
  { px: 767, label: "767 — AP 2-col, instructions panel visible", standalone: false },
];

// Eight placeholder trials (A–H), within the TrialCard A–J cap. Letters double as stable keys.
const PLACEHOLDER_TRIAL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function FrameAtWidth({
  px,
  label,
  standalone,
}: {
  px: number;
  label: string;
  standalone: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <figure style={{ margin: "0 0 32px" }}>
      <figcaption style={{ fontFamily: "system-ui", fontSize: 13, marginBottom: 6 }}>
        <strong>{label}</strong>
      </figcaption>
      {/* Outer box clamps width to the target; overflow:auto reveals any overflow honestly. */}
      <div style={{ width: px, maxWidth: "100%", overflow: "auto", border: "1px solid #999" }}>
        <SimulationFrame
          simTitle="Preview Sim"
          tagline="An interactive placeholder simulation"
          infoModalContent={<p>Placeholder info modal content.</p>}
          standalone={standalone}
        >
          <SimulationFrame.Trials>
            {PLACEHOLDER_TRIAL_LETTERS.map((letter, i) => (
              <TrialCard
                key={letter}
                index={i}
                selected={i === selectedIndex}
                onSelect={() => setSelectedIndex(i)}
                onReset={() => {
                  /* placeholder — no real state */
                }}
                // Static preview: no model to run a trial, so the reset stays disabled —
                // mirrors the demo's initial state. Enable-after-run logic arrives in Phase 2b.
                resetDisabled={true}
              >
                <span>Placeholder</span>
                <span>data</span>
              </TrialCard>
            ))}
          </SimulationFrame.Trials>
          <SimulationFrame.Simulation instruction="Placeholder instruction">
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: "100%",
                background: "#eef",
              }}
            >
              simulation placeholder
            </div>
          </SimulationFrame.Simulation>
          <SimulationFrame.Data>
            <DataSubsection title="Sub-section A">data placeholder A</DataSubsection>
            <DataSubsection title="Sub-section B">data placeholder B</DataSubsection>
          </SimulationFrame.Data>
        </SimulationFrame>
      </div>
    </figure>
  );
}

export function Preview() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "system-ui" }}>SimulationFrame — four target widths × 562 px</h1>
      {WIDTHS.map((w) => (
        <FrameAtWidth key={w.px} {...w} />
      ))}
    </main>
  );
}
