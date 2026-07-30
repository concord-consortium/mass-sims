import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { OUTCOME_VALUES } from "../model/outcome-values";
import { OUTCOMES } from "../model/weather";
import { createRootStore, type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { configure, runSetup, SETUPS } from "../stores/test-helpers";
import { NoreasterDataPanel } from "./data-panel";

// The five weather attributes in their rendered order.
const ATTRIBUTES = ["Sky", "Wind", "Precipitation Type", "Precipitation Amount", "Storm Intensity"];

// The panel reads the active trial via `useStores()`, so it must render inside a `RootStoreProvider`. A
// fresh store seeds one unconfigured trial (outcome `null`) → the empty/default state these specs assert.
function renderPanel() {
  return render(
    <RootStoreProvider store={createRootStore()}>
      <NoreasterDataPanel />
    </RootStoreProvider>,
  );
}

describe("NoreasterDataPanel — static layout", () => {
  it("renders the 'Weather Outcome' subsection heading (level 3)", () => {
    const { getByRole } = renderPanel();
    expect(getByRole("heading", { level: 3, name: "Weather Outcome" })).toBeInTheDocument();
  });

  it("exposes each attribute value as a description-list definition", () => {
    const { getAllByRole } = renderPanel();
    expect(getAllByRole("definition")).toHaveLength(ATTRIBUTES.length);
  });

  it("renders the outcome pill in its empty default state (en-dash placeholder)", () => {
    const { container } = renderPanel();
    const pill = container.querySelector(".wo-pill");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent("–");
  });

  it("renders all five attributes as description terms, in order", () => {
    const { getAllByRole } = renderPanel();
    const terms = getAllByRole("term");
    expect(terms).toHaveLength(ATTRIBUTES.length);
    // Condensable rows also render the short span, so match the full label as a substring in order.
    terms.forEach((term, i) => {
      expect(term).toHaveTextContent(ATTRIBUTES[i]);
    });
  });

  it("names the condensable terms for assistive tech by their FULL attribute", () => {
    // The condensable rows hide their visible spans from AT and expose the full attribute via aria-label,
    // so AT reads "Precipitation Type"/"Amount" regardless of which form is visible.
    const { getByRole } = renderPanel();
    for (const label of ["Precipitation Type", "Precipitation Amount"]) {
      expect(getByRole("term", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a placeholder value cell (en-dash) for every attribute row", () => {
    const { container } = renderPanel();
    const values = container.querySelectorAll(".wo-value");
    expect(values).toHaveLength(ATTRIBUTES.length);
    for (const value of values) expect(value.textContent).toBe("–");
  });

  it("reserves an aria-hidden stand-in icon slot in every row", () => {
    const { container } = renderPanel();
    const icons = container.querySelectorAll(".wo-icon");
    expect(icons).toHaveLength(ATTRIBUTES.length);
    // The disc is CSS-only, so assert presence + aria-hidden (jsdom won't resolve the background).
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the condensable labels' short forms out of the accessibility tree", () => {
    const { container } = renderPanel();
    // Both visible label spans live under an aria-hidden wrapper (the row's accessible name is its
    // aria-label), so neither the full nor the short text double-announces.
    const condensableWrappers = container.querySelectorAll(".wo-label[aria-hidden='true']");
    expect(condensableWrappers).toHaveLength(2);
    expect(container.querySelectorAll(".wo-label-short")).toHaveLength(2);
    expect(container.querySelectorAll(".wo-label-full")).toHaveLength(2);
  });
});

describe("NoreasterDataPanel — filled state", () => {
  function renderWithStore(store: RootStoreInstance) {
    return render(
      <RootStoreProvider store={store}>
        <NoreasterDataPanel />
      </RootStoreProvider>,
    );
  }

  // The Data-panel value cells in row order, so the values array below lines up with the rendered `dd`s.
  const valuesInOrder = (o: (typeof OUTCOMES)[number]) => {
    const v = OUTCOME_VALUES[o];
    return [v.sky, v.wind, v.precipType, v.precipAmount, v.stormIntensity];
  };

  for (const outcome of OUTCOMES) {
    it(`fills the pill, values, and icons for the "${outcome}" outcome`, () => {
      const store = createRootStore();
      // Seed through the store: apply a real setup and run(), then confirm it produced this outcome.
      runSetup(store.activeTrial, SETUPS[outcome]);
      expect(store.activeTrial.outcome).toBe(outcome);

      const { container } = renderWithStore(store);

      expect(container.querySelector(".wo-pill")).toHaveTextContent(OUTCOME_VALUES[outcome].label);
      const values = [...container.querySelectorAll(".wo-value")].map((el) => el.textContent);
      expect(values).toEqual(valuesInOrder(outcome));
      // Every slot shows a real weather SVG (not the empty stand-in disc).
      expect(container.querySelectorAll(".wo-icon svg")).toHaveLength(ATTRIBUTES.length);
    });
  }

  it("clears to the default state on Reset Trial", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    expect(container.querySelector(".wo-pill")).toHaveTextContent(OUTCOME_VALUES.strong.label);

    act(() => {
      store.resetTrial();
    });

    expect(container.querySelector(".wo-pill")).toHaveTextContent("–");
    for (const value of container.querySelectorAll(".wo-value"))
      expect(value.textContent).toBe("–");
    expect(container.querySelectorAll(".wo-icon svg")).toHaveLength(0);
  });

  it("clears when an unrun trial is selected", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // trial A → strong
    const added = store.addTrial(); // trial B, unrun
    const { container } = renderWithStore(store);
    expect(container.querySelector(".wo-pill")).toHaveTextContent(OUTCOME_VALUES.strong.label);

    act(() => {
      store.ui.selectTrial(added as string);
    });

    expect(container.querySelector(".wo-pill")).toHaveTextContent("–");
    expect(container.querySelectorAll(".wo-icon svg")).toHaveLength(0);
  });

  it("repopulates with the selected run trial's own outcome when switching between run trials", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // trial A → strong (initially selected)
    const b = store.addTrial() as string;
    const trialB = store.trials.get(b);
    if (!trialB) throw new Error(`trial ${b} was not added`);
    runSetup(trialB, SETUPS.fair); // trial B → fair
    expect(trialB.outcome).toBe("fair");

    const { container } = renderWithStore(store);
    // Viewing A: strong.
    expect(container.querySelector(".wo-pill")).toHaveTextContent(OUTCOME_VALUES.strong.label);

    act(() => {
      store.ui.selectTrial(b);
    });

    // Selecting the other run trial repopulates the panel with ITS outcome, not the previous trial's.
    expect(container.querySelector(".wo-pill")).toHaveTextContent(OUTCOME_VALUES.fair.label);
    const values = [...container.querySelectorAll(".wo-value")].map((el) => el.textContent);
    expect(values).toEqual(valuesInOrder("fair"));
    expect(container.querySelectorAll(".wo-icon svg")).toHaveLength(ATTRIBUTES.length);
  });
});

describe("NoreasterDataPanel — weather scene", () => {
  // Wrapped in <StrictMode> ON PURPOSE: the app mounts under StrictMode (main.tsx), which double-invokes
  // render in dev. The `data-animate` fade signal must survive that (and discarded concurrent renders) — a
  // render-phase side-effect would consume the "just finalized" edge in the first pass and commit "instant"
  // in the second, silently killing the fade in dev. These assertions guard exactly that.
  function renderWithStore(store: RootStoreInstance) {
    return render(
      <StrictMode>
        <RootStoreProvider store={store}>
          <NoreasterDataPanel />
        </RootStoreProvider>
      </StrictMode>,
    );
  }

  const OUTCOME_DARK: Record<(typeof OUTCOMES)[number], boolean> = {
    strong: true,
    moderate: true,
    weakCoastal: true,
    humidNoStorm: true,
    windy: false,
    fair: false,
  };

  // A real Run goes through `beginRun()` → `finalizeRun()` (finalize records the outcome and bumps the
  // fade-signal token), which the panel's fade signal reads — so the tests drive that same path.
  function runActive(store: RootStoreInstance, outcome: (typeof OUTCOMES)[number]) {
    act(() => {
      configure(store.activeTrial, SETUPS[outcome]);
      const id = store.beginRun();
      if (id != null) store.finalizeRun(id);
    });
  }

  const scene = (c: HTMLElement) => c.querySelector(".wo-scene");
  const panel = (c: HTMLElement) => c.querySelector(".noreaster-data-panel");

  it("tracks data-scene: default → the outcome key on Run → default on Reset", () => {
    const store = createRootStore();
    const { container } = renderWithStore(store);
    expect(scene(container)).toHaveAttribute("data-scene", "default");

    runActive(store, "strong");
    expect(scene(container)).toHaveAttribute("data-scene", "strong");

    act(() => store.resetTrial());
    expect(scene(container)).toHaveAttribute("data-scene", "default");
  });

  it("sets data-scene-theme dark for the four storm-gray scenes and light otherwise (incl. default)", () => {
    for (const outcome of OUTCOMES) {
      const store = createRootStore();
      runSetup(store.activeTrial, SETUPS[outcome]); // records the outcome; theme is token-independent
      const { container, unmount } = renderWithStore(store);
      expect(panel(container)).toHaveAttribute(
        "data-scene-theme",
        OUTCOME_DARK[outcome] ? "dark" : "light",
      );
      unmount();
    }
    // No outcome → light (no backdrop, no heading treatment).
    const { container } = renderWithStore(createRootStore());
    expect(panel(container)).toHaveAttribute("data-scene-theme", "light");
  });

  describe("data-animate provenance", () => {
    it('is "fade" on the render where a run just finalized', () => {
      const store = createRootStore();
      const { container } = renderWithStore(store);
      expect(scene(container)).toHaveAttribute("data-animate", "instant"); // nothing run yet

      runActive(store, "strong");
      expect(scene(container)).toHaveAttribute("data-scene", "strong");
      expect(scene(container)).toHaveAttribute("data-animate", "fade");
    });

    it('is "instant" when switching from an unrun trial to a previously-run trial', () => {
      const store = createRootStore();
      runActive(store, "strong"); // trial A → strong (token bumped)
      const b = store.addTrial() as string;
      act(() => store.ui.selectTrial(b)); // now viewing the unrun B
      const { container } = renderWithStore(store);
      expect(scene(container)).toHaveAttribute("data-scene", "default");

      act(() => store.ui.selectTrial("A")); // back to the already-run A — no token bump
      expect(scene(container)).toHaveAttribute("data-scene", "strong");
      expect(scene(container)).toHaveAttribute("data-animate", "instant");
    });

    it('is "instant" when switching between two already-run trials', () => {
      const store = createRootStore();
      runActive(store, "strong"); // A → strong
      const b = store.addTrial() as string;
      act(() => store.ui.selectTrial(b));
      runActive(store, "fair"); // B → fair (now viewing B)
      const { container } = renderWithStore(store);
      expect(scene(container)).toHaveAttribute("data-scene", "fair");

      act(() => store.ui.selectTrial("A")); // B → A, both run — no token bump
      expect(scene(container)).toHaveAttribute("data-scene", "strong");
      expect(scene(container)).toHaveAttribute("data-animate", "instant");
    });

    it('is "instant" on a Replay of the same outcome — never a re-fade', () => {
      const store = createRootStore();
      const { container } = renderWithStore(store);

      runActive(store, "strong"); // Run → fade
      expect(scene(container)).toHaveAttribute("data-animate", "fade");

      // Replay: run again (same outcome), bumping the token. The outcome is unchanged, so no re-fade.
      act(() => {
        const id = store.beginRun();
        if (id != null) store.finalizeRun(id);
      });
      expect(scene(container)).toHaveAttribute("data-animate", "instant");
    });

    it('is "instant" on Reset — the scene clears without fading out', () => {
      const store = createRootStore();
      const { container } = renderWithStore(store);

      runActive(store, "strong"); // Run → fade
      expect(scene(container)).toHaveAttribute("data-animate", "fade");

      // Reset clears the outcome with no token bump, so `useJustFinalized` stays latched-false. If it ever
      // re-armed on token change alone, the scene would fade OUT over 0.6s here instead of clearing instantly.
      act(() => store.resetTrial());
      expect(scene(container)).toHaveAttribute("data-scene", "default");
      expect(scene(container)).toHaveAttribute("data-animate", "instant");
    });
  });
});
