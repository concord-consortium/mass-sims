import { Section, SimulationFrame } from "@concord-consortium/mass-sims-shared";

// The four exact widths from ui-design-plan.md §6. Height is fixed at 562 px by the frame.
const WIDTHS: Array<{ px: number; label: string; note?: string }> = [
  { px: 1044, label: "1044 — Activity Player Full Width" },
  { px: 1024, label: "1024 — Standalone" },
  { px: 989, label: "989 — AP 2-col, left hidden (tightest wide)" },
  {
    px: 676,
    label: "676 — AP 2-col, left shown (NARROW)",
    note: "Narrow-mode layout is deferred (Q30). The wide 3-column grid intentionally overflows here.",
  },
];

const PLACEHOLDER_TRIALS = [1, 2, 3, 4, 5, 6, 7, 8];

function PlaceholderTrials() {
  return (
    <>
      {PLACEHOLDER_TRIALS.map((n) => (
        <div key={n} style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
          Trial {n}
        </div>
      ))}
    </>
  );
}

function FrameAtWidth({ px, label, note }: { px: number; label: string; note?: string }) {
  return (
    <figure style={{ margin: "0 0 32px" }}>
      <figcaption style={{ fontFamily: "system-ui", fontSize: 13, marginBottom: 6 }}>
        <strong>{label}</strong>
        {note ? <span style={{ color: "#b45309" }}> — {note}</span> : null}
      </figcaption>
      {/* Outer box clamps width to the target; overflow:auto reveals any overflow honestly. */}
      <div style={{ width: px, maxWidth: "100%", overflow: "auto", border: "1px solid #999" }}>
        <SimulationFrame
          simTitle="Preview Sim"
          tagline="Placeholder tagline"
          infoModalContent={<p>Placeholder info modal content.</p>}
        >
          <SimulationFrame.Trials>
            <PlaceholderTrials />
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
            <Section title="Sub-section A">data placeholder A</Section>
            <Section title="Sub-section B">data placeholder B</Section>
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
