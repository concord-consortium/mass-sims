import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const pill = container.querySelector(".wo-pill-label--outcome");
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

      expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent(
        OUTCOME_VALUES[outcome].label,
      );
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
    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent(
      OUTCOME_VALUES.strong.label,
    );

    act(() => {
      store.resetTrial();
    });

    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent("–");
    for (const value of container.querySelectorAll(".wo-value"))
      expect(value.textContent).toBe("–");
    expect(container.querySelectorAll(".wo-icon svg")).toHaveLength(0);
  });

  it("clears when an unrun trial is selected", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // trial A → strong
    const added = store.addTrial(); // trial B, unrun
    const { container } = renderWithStore(store);
    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent(
      OUTCOME_VALUES.strong.label,
    );

    act(() => {
      store.ui.selectTrial(added as string);
    });

    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent("–");
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
    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent(
      OUTCOME_VALUES.strong.label,
    );

    act(() => {
      store.ui.selectTrial(b);
    });

    // Selecting the other run trial repopulates the panel with ITS outcome, not the previous trial's.
    expect(container.querySelector(".wo-pill-label--outcome")).toHaveTextContent(
      OUTCOME_VALUES.fair.label,
    );
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

describe("NoreasterDataPanel — pill run state", () => {
  // Under <StrictMode> (as the app mounts) to guard `usePillPhase`'s adjust-state-during-render edge
  // against the dev double-invoke — the same reason the weather-scene block below uses it.
  function renderWithStore(store: RootStoreInstance) {
    return render(
      <StrictMode>
        <RootStoreProvider store={store}>
          <NoreasterDataPanel />
        </RootStoreProvider>
      </StrictMode>,
    );
  }
  const pill = (c: HTMLElement) => c.querySelector(".wo-pill");
  const outcomeLabel = (c: HTMLElement) => c.querySelector(".wo-pill-label--outcome");

  // Rendering BEFORE arming the run is deliberate: `usePillPhase` seeds to the mounted counters, so the
  // "start" edge is only observed when `runId` advances AFTER mount. Begin and finalize are in SEPARATE
  // `act`s because they land in separate commits in reality (finalize fires seconds later), and the phase
  // hook reads `runId` (start) vs. `runCompletedToken` (complete) — batching them would collapse the edge.

  it("shows the aria-hidden 'Simulating…' overlay during a first run", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    act(() => {
      store.beginRun();
    });
    expect(pill(container)).toHaveAttribute("data-phase", "simulating");
    expect(pill(container)).toHaveAttribute("data-animate", "fade");
    const sim = container.querySelector(".wo-pill-label--simulating");
    expect(sim).toHaveTextContent("Simulating…");
    expect(sim).toHaveAttribute("aria-hidden", "true");
    // Outcome not committed yet — the outcome layer still carries the placeholder.
    expect(outcomeLabel(container)).toHaveTextContent("–");
  });

  it("keeps the outcome label (simulating-replay) during a replay", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // A → strong, committed
    const { container } = renderWithStore(store);
    act(() => {
      store.beginRun(); // replay begins (trial already hasRun)
    });
    expect(pill(container)).toHaveAttribute("data-phase", "simulating-replay");
    expect(pill(container)).toHaveAttribute("data-animate", "fade");
    expect(outcomeLabel(container)).toHaveTextContent(OUTCOME_VALUES.strong.label);
  });

  it("resolves to filled with data-animate='fade' on completion", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    let id: number | null = null;
    act(() => {
      id = store.beginRun();
    });
    expect(pill(container)).toHaveAttribute("data-phase", "simulating");
    act(() => {
      if (id != null) store.finalizeRun(id);
    });
    expect(pill(container)).toHaveAttribute("data-phase", "filled");
    expect(pill(container)).toHaveAttribute("data-animate", "fade");
    expect(outcomeLabel(container)).toHaveTextContent(OUTCOME_VALUES.strong.label);
  });

  // Canceling a replay by switching to another already-run trial must NOT play the completion fade —
  // neither counter advances on the switch.
  it("stays instant when a replay is CANCELED by switching to another run trial", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // A → strong
    const b = store.addTrial() as string;
    const trialB = store.trials.get(b);
    if (!trialB) throw new Error(`trial ${b} was not added`);
    runSetup(trialB, SETUPS.fair); // B → fair
    const { container } = renderWithStore(store); // viewing A
    act(() => {
      store.beginRun(); // replay on A
    });
    expect(pill(container)).toHaveAttribute("data-phase", "simulating-replay");

    act(() => store.ui.selectTrial(b)); // cancels the run and shows B
    expect(pill(container)).toHaveAttribute("data-phase", "filled");
    expect(pill(container)).toHaveAttribute("data-animate", "instant");
    expect(outcomeLabel(container)).toHaveTextContent(OUTCOME_VALUES.fair.label);
  });

  it("clears to empty + instant on Reset", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    act(() => store.resetTrial());
    expect(pill(container)).toHaveAttribute("data-phase", "empty");
    expect(pill(container)).toHaveAttribute("data-animate", "instant");
    expect(outcomeLabel(container)).toHaveTextContent("–");
  });

  // Canceling a FIRST run (Reset before finalize) advances neither counter and the outcome was never
  // committed, so only the running edge signals the end: the pill must go instant and the fill must hide.
  it("hides the fill + goes instant when a first run is reset before completion", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    act(() => {
      store.beginRun();
    });
    expect(pill(container)).toHaveAttribute("data-phase", "simulating");
    const fill = container.querySelector<HTMLElement>(".wo-progress-fill");
    expect(fill?.style.opacity).toBe("1"); // shown during the run

    act(() => store.resetTrial()); // cancel before the outcome is ever committed
    expect(pill(container)).toHaveAttribute("data-phase", "empty");
    expect(pill(container)).toHaveAttribute("data-animate", "instant");
    expect(fill?.style.opacity).toBe("0"); // hidden, not left mid-sweep
  });
});

describe("NoreasterDataPanel — staggered row fade-on", () => {
  function renderWithStore(store: RootStoreInstance) {
    return render(
      <RootStoreProvider store={store}>
        <NoreasterDataPanel />
      </RootStoreProvider>,
    );
  }
  const table = (c: HTMLElement) => c.querySelector(".wo-table");

  // The table fade flag reuses `useJustFinalized` (token + outcome), so batching begin+finalize is fine
  // here — unlike the pill's `runId`-vs-token edge.
  it("marks the table data-animate='fade' on a fresh first-run finalize", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    expect(table(container)).toHaveAttribute("data-animate", "instant"); // nothing run yet
    act(() => {
      const id = store.beginRun();
      if (id != null) store.finalizeRun(id);
    });
    expect(table(container)).toHaveAttribute("data-animate", "fade");
  });

  it("is instant on a replay — the rows are already shown, no re-stagger", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    act(() => {
      const id = store.beginRun();
      if (id != null) store.finalizeRun(id);
    });
    expect(table(container)).toHaveAttribute("data-animate", "fade");
    act(() => {
      const id = store.beginRun(); // replay — same outcome, no re-fade
      if (id != null) store.finalizeRun(id);
    });
    expect(table(container)).toHaveAttribute("data-animate", "instant");
  });

  it("assigns each row a 0-based --wo-row-index for the stagger delay", () => {
    const store = createRootStore();
    const { container } = renderWithStore(store);
    const rows = [...container.querySelectorAll<HTMLElement>(".wo-row")];
    expect(rows).toHaveLength(ATTRIBUTES.length);
    rows.forEach((row, i) => {
      expect(row.style.getPropertyValue("--wo-row-index")).toBe(String(i));
    });
  });
});

describe("NoreasterDataPanel — reduced motion", () => {
  // `useReducedMotion` seeds from `window.matchMedia(...).matches`; stub it on for this block.
  const REDUCED = {
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  };
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => REDUCED);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderWithStore(store: RootStoreInstance) {
    return render(
      <RootStoreProvider store={store}>
        <NoreasterDataPanel />
      </RootStoreProvider>,
    );
  }
  const pill = (c: HTMLElement) => c.querySelector(".wo-pill");

  // The simulating faces are gated off, so the pill never flashes "Simulating…" — it resolves straight to
  // the outcome regardless of when React flushes the run's finalize.
  it("never shows the 'simulating' face on a first run", () => {
    const store = createRootStore();
    configure(store.activeTrial, SETUPS.strong);
    const { container } = renderWithStore(store);
    let id: number | null = null;
    act(() => {
      id = store.beginRun();
    });
    expect(pill(container)).toHaveAttribute("data-phase", "empty"); // not "simulating"
    act(() => {
      if (id != null) store.finalizeRun(id);
    });
    expect(pill(container)).toHaveAttribute("data-phase", "filled");
  });

  it("stays on the outcome during a replay (no 'simulating-replay' face)", () => {
    const store = createRootStore();
    runSetup(store.activeTrial, SETUPS.strong); // committed
    const { container } = renderWithStore(store);
    act(() => {
      store.beginRun(); // replay armed
    });
    expect(pill(container)).toHaveAttribute("data-phase", "filled"); // not "simulating-replay"
  });
});
