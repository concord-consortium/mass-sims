import { act, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OUTCOME_VALUES } from "../../model/outcome-values";
import { type AirMassSetup, OUTCOMES, type Outcome } from "../../model/weather";
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "../../stores/trial-model";
import { outcomeLabelLines, TrialCardBody, trialAriaLabel } from "./trial-card-body";

// A fresh trial with the given fields applied via the model's actions (so derived views and `run()`
// behave as in the app). Typed as `Partial<AirMassSetup>` so a bad field name/value is a compile error.
function makeTrial(fields: Partial<AirMassSetup> = {}): TrialModelInstance {
  const trial = TrialModel.create(emptyTrialSnapshot());
  if (fields.landPathway) trial.setLandPathway(fields.landPathway);
  if (fields.landHumidity) trial.setLandHumidity(fields.landHumidity);
  if (fields.landTemperature) trial.setLandTemperature(fields.landTemperature);
  if (fields.oceanPathway) trial.setOceanPathway(fields.oceanPathway);
  if (fields.oceanHumidity) trial.setOceanHumidity(fields.oceanHumidity);
  return trial;
}

// The strong-nor'easter setup (N/NW · Dry · Cold land, S/SE · Humid ocean → derived Warm).
const STRONG_SETUP = {
  landPathway: "N/NW",
  landHumidity: "Dry",
  landTemperature: "Cold",
  oceanPathway: "S/SE",
  oceanHumidity: "Humid",
} satisfies AirMassSetup;

// The approved two-line break for every outcome.
const OUTCOME_LINES: Record<Outcome, [string, string]> = {
  strong: ["Strong", "nor’easter"],
  moderate: ["Moderate", "nor’easter"],
  weakCoastal: ["Weak", "coastal storm"],
  humidNoStorm: ["Humid,", "no storm"],
  windy: ["Windy,", "no storm"],
  fair: ["Fair", "weather"],
};

describe("outcomeLabelLines", () => {
  // Feed the SINGLE-SOURCE label (never a re-typed copy) through the helper for every outcome and
  // assert the two produced lines match the approved break table — so the curly apostrophe is
  // preserved and a label edit that broke a wrap trips this test.
  it.each(
    OUTCOMES,
  )("splits %s's label at the first space into the approved two lines", (outcome) => {
    const label = OUTCOME_VALUES[outcome].label;
    expect(outcomeLabelLines(label)).toEqual(OUTCOME_LINES[outcome]);
  });

  it("recombines to the original label (line1 + ' ' + line2)", () => {
    for (const outcome of OUTCOMES) {
      const label = OUTCOME_VALUES[outcome].label;
      const [a, b] = outcomeLabelLines(label);
      expect(`${a} ${b}`).toBe(label);
    }
  });
});

describe("trialAriaLabel", () => {
  it("labels an empty trial with just its letter", () => {
    expect(trialAriaLabel("A", makeTrial())).toBe("Trial A");
  });

  it("lists only the set land fields for a land-only partial", () => {
    const trial = makeTrial({ landPathway: "N/NW", landHumidity: "Dry", landTemperature: "Cold" });
    expect(trialAriaLabel("A", trial)).toBe("Trial A. Land: N/NW, Dry, Cold");
  });

  it("includes the derived ocean temperature for an ocean-only partial", () => {
    const trial = makeTrial({ oceanPathway: "S/SE", oceanHumidity: "Humid" });
    expect(trialAriaLabel("A", trial)).toBe("Trial A. Ocean: S/SE, Humid, Warm");
  });

  it("lists both clauses (no outcome) for a fully-configured, unrun trial", () => {
    const trial = makeTrial(STRONG_SETUP);
    expect(trialAriaLabel("A", trial)).toBe(
      "Trial A. Land: N/NW, Dry, Cold. Ocean: S/SE, Humid, Warm",
    );
  });

  it("appends the outcome label (from OUTCOME_VALUES) once run", () => {
    const trial = makeTrial(STRONG_SETUP);
    trial.run();
    expect(trialAriaLabel("A", trial)).toBe(
      `Trial A. Land: N/NW, Dry, Cold. Ocean: S/SE, Humid, Warm. ${OUTCOME_VALUES.strong.label}`,
    );
  });

  it("lists only the fields present in a partial clause", () => {
    const trial = makeTrial({ landPathway: "N/NW" });
    expect(trialAriaLabel("A", trial)).toBe("Trial A. Land: N/NW");
  });
});

describe("TrialCardBody", () => {
  it("renders nothing but the (empty) body for an unconfigured trial", () => {
    const { container } = render(<TrialCardBody trial={makeTrial()} />);
    const body = container.querySelector(".trial-card-body") as HTMLElement;
    expect(body).toBeInTheDocument();
    expect(body.querySelectorAll(".nor-card-am-section")).toHaveLength(0);
    expect(body.querySelector(".nor-card-outcome")).toBeNull();
  });

  it("renders one section with only the set field rows for a land-only partial", () => {
    const trial = makeTrial({ landHumidity: "Dry" });
    const { container } = render(<TrialCardBody trial={trial} />);
    const sections = container.querySelectorAll(".nor-card-am-section");
    expect(sections).toHaveLength(1); // land only — no ocean section
    const section = sections[0] as HTMLElement;
    // The air-mass glyph is present (the section has data), and only the humidity row's label shows.
    expect(section.querySelector(".nor-card-am-icon")).toBeInTheDocument();
    expect(within(section).getByText("Dry")).toBeInTheDocument();
    expect(section.querySelectorAll(".nor-card-label")).toHaveLength(1);
  });

  it("renders both sections with the derived ocean temperature and no banner before a run", () => {
    const trial = makeTrial(STRONG_SETUP);
    const { container } = render(<TrialCardBody trial={trial} />);
    expect(container.querySelectorAll(".nor-card-am-section")).toHaveLength(2);
    // Ocean pathway S/SE derives a "Warm" temperature row.
    expect(within(container).getByText("Warm")).toBeInTheDocument();
    expect(container.querySelector(".nor-card-outcome")).toBeNull();
  });

  it("shows the two-line outcome banner (sourced from OUTCOME_VALUES) once run", () => {
    const trial = makeTrial(STRONG_SETUP);
    trial.run();
    const { container } = render(<TrialCardBody trial={trial} />);
    const banner = container.querySelector(".nor-card-outcome") as HTMLElement;
    const lines = Array.from(banner.querySelectorAll(".nor-card-outcome-line")).map(
      (n) => n.textContent,
    );
    // The rendered lines are the single-source label split — not a re-typed copy.
    const [line1, line2] = outcomeLabelLines(OUTCOME_VALUES.strong.label);
    expect(lines).toEqual([line1, line2]);
    expect(`${lines[0]} ${lines[1]}`).toBe(OUTCOME_VALUES.strong.label);
  });

  it("reacts to a field set on an already-mounted card (this is why it's an observer)", () => {
    const trial = makeTrial();
    const { container } = render(<TrialCardBody trial={trial} />);
    expect(container.querySelectorAll(".nor-card-am-section")).toHaveLength(0);
    // Mutate AFTER mount: without the observer wrapper the rendered body would not update.
    act(() => trial.setLandHumidity("Dry"));
    expect(container.querySelectorAll(".nor-card-am-section")).toHaveLength(1);
    expect(within(container).getByText("Dry")).toBeInTheDocument();
  });
});
