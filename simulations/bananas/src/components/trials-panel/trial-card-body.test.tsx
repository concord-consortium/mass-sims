import { render } from "@testing-library/react";
import type { SnapshotIn } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import type { OffspringPlant } from "../../model/genetics";
import { createTestStore } from "../../stores/test-helpers";
import type { TrialModel, TrialModelInstance } from "../../stores/trial-model";
import { abbrev, TrialCardBody, trialAriaLabel } from "./trial-card-body";

function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

// 3 plants: 2 healthy + 1 infected → 67% / 33%.
const CROSS = [plant(false), plant(false), plant(true)];

/** Seed a single-trial store and return its trial instance (the prop TrialCardBody takes). */
function trialWith(trial: Partial<SnapshotIn<typeof TrialModel>>): TrialModelInstance {
  return createTestStore({ trial }).activeTrial;
}

describe("abbrev", () => {
  it("returns the last whitespace-separated word", () => {
    expect(abbrev("Wild W1")).toBe("W1");
    expect(abbrev("Cavendish C1")).toBe("C1");
    expect(abbrev("Solo")).toBe("Solo");
  });
});

describe("TrialCardBody", () => {
  it("renders nothing for an empty trial (no parents, no crosses)", () => {
    const { container } = render(<TrialCardBody trial={trialWith({})} />);
    expect(container.querySelector(".trial-card-parents")).not.toBeInTheDocument();
    expect(container.querySelector(".trial-card-offspring")).not.toBeInTheDocument();
    expect(container.querySelector(".trial-card-phenotypes")).not.toBeInTheDocument();
  });

  it("renders 'W1 × …' with only the first parent set", () => {
    const { container } = render(<TrialCardBody trial={trialWith({ p1: "wild-w1" })} />);
    expect(container.querySelector(".trial-card-parent--left")).toHaveTextContent("W1");
    expect(container.querySelector(".trial-card-parent--right")).toHaveTextContent("…");
    expect(container.querySelector(".trial-card-offspring")).not.toBeInTheDocument();
  });

  it("renders '… × C1' with only the second parent set (reachable order)", () => {
    const { container } = render(<TrialCardBody trial={trialWith({ p2: "cavendish-c1" })} />);
    expect(container.querySelector(".trial-card-parent--left")).toHaveTextContent("…");
    expect(container.querySelector(".trial-card-parent--right")).toHaveTextContent("C1");
  });

  it("renders both parents but no offspring/phenotype rows before any cross", () => {
    const { container } = render(
      <TrialCardBody trial={trialWith({ p1: "wild-w1", p2: "cavendish-c1" })} />,
    );
    const parents = container.querySelector(".trial-card-parents");
    expect(parents).toHaveTextContent("W1");
    expect(parents).toHaveTextContent("C1");
    expect(container.querySelector(".trial-card-offspring")).not.toBeInTheDocument();
    expect(container.querySelector(".trial-card-phenotypes")).not.toBeInTheDocument();
  });

  it("renders offspring count and healthy/infected percentages once crossed", () => {
    const { container } = render(
      <TrialCardBody
        trial={trialWith({ p1: "wild-w1", p2: "cavendish-c1", locked: true, crosses: [CROSS] })}
      />,
    );
    expect(container.querySelector(".trial-card-offspring")).toHaveTextContent("Offspring: 3");
    const phen = container.querySelector(".trial-card-phenotypes");
    expect(phen).toHaveTextContent("67%");
    expect(phen).toHaveTextContent("33%");
    expect(container.querySelectorAll(".trial-card-swatch")).toHaveLength(2);
  });

  it("marks the body aria-hidden (the card's aria-label carries the canonical text)", () => {
    const { container } = render(<TrialCardBody trial={trialWith({ p1: "wild-w1" })} />);
    expect(container.querySelector(".trial-card-body")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the Fungus row above two spacer rows before a cross (so it sits at the bottom)", () => {
    const { container } = render(
      <TrialCardBody trial={trialWith({ p1: "wild-w1", p2: "cavendish-c1", fungusOn: true })} />,
    );
    expect(container.querySelector(".trial-card-fungus")).toHaveTextContent("Fungus");
    expect(container.querySelectorAll(".trial-card-row-spacer")).toHaveLength(2);
  });

  it("renders the Fungus row without spacers once crossed (offspring/percentage rows fill the slot)", () => {
    const { container } = render(
      <TrialCardBody
        trial={trialWith({
          p1: "wild-w1",
          p2: "cavendish-c1",
          fungusOn: true,
          locked: true,
          crosses: [CROSS],
        })}
      />,
    );
    expect(container.querySelector(".trial-card-fungus")).toBeInTheDocument();
    expect(container.querySelectorAll(".trial-card-row-spacer")).toHaveLength(0);
  });
});

describe("trialAriaLabel", () => {
  it("is just 'Trial X' for an empty trial", () => {
    expect(trialAriaLabel("A", trialWith({}))).toBe("Trial A");
  });

  it("notes a missing second parent", () => {
    expect(trialAriaLabel("A", trialWith({ p1: "wild-w1" }))).toBe(
      "Trial A. W1, second parent not selected",
    );
  });

  it("notes a missing first parent", () => {
    expect(trialAriaLabel("B", trialWith({ p2: "cavendish-c1" }))).toBe(
      "Trial B. C1, first parent not selected",
    );
  });

  it("summarizes parents and offspring counts once crossed", () => {
    const trial = trialWith({ p1: "wild-w1", p2: "cavendish-c1", locked: true, crosses: [CROSS] });
    expect(trialAriaLabel("A", trial)).toBe(
      "Trial A. W1 crossed with C1. 3 offspring, 2 healthy, 1 infected",
    );
  });

  it("appends 'Fungus active' when fungus is on (before any cross)", () => {
    const trial = trialWith({ p1: "wild-w1", p2: "cavendish-c1", fungusOn: true });
    expect(trialAriaLabel("A", trial)).toBe("Trial A. W1 crossed with C1. Fungus active");
  });

  it("appends 'Fungus active' after the offspring summary once crossed", () => {
    const trial = trialWith({
      p1: "wild-w1",
      p2: "cavendish-c1",
      fungusOn: true,
      locked: true,
      crosses: [CROSS],
    });
    expect(trialAriaLabel("A", trial)).toBe(
      "Trial A. W1 crossed with C1. 3 offspring, 2 healthy, 1 infected. Fungus active",
    );
  });
});
