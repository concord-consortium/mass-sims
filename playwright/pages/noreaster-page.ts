// Page object for the `noreaster` sim. The Simulation panel is an empty shell for now (its content
// lands in a later story), so this exposes only the shared chrome (inherited from
// SimulationFramePage) and the Trials panel.
import type { Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { SimulationFramePage } from "./simulation-frame-page";

/**
 * Page object for the Nor'easter sim. The Simulation panel has no controls yet, so this adds only
 * the Trials-panel locators on top of the shared-chrome base and a `goto()` that navigates to the
 * Nor'easter preview URL sourced from the sims registry.
 */
export class NoreasterPage extends SimulationFramePage {
  /** Navigate to the Nor'easter preview server (URL derived from the sims registry). */
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("noreaster"));
  }

  // --- Trials panel -------------------------------------------------------
  // A single-select listbox: role="listbox" container, cards as role="option" with roving tabindex.

  /** The trial-selector listbox (vertical, labeled "Trials"). */
  get trialsListbox(): Locator {
    return this.page.getByRole("listbox", { name: "Trials" });
  }

  /**
   * A trial option by its letter, e.g. trialOption("A"). Cards are role="option" with the accessible
   * name "Trial A" (no per-trial data yet), so match on the leading "Trial X".
   */
  trialOption(letter: string): Locator {
    return this.page.getByRole("option", { name: new RegExp(`^Trial ${letter}\\b`) });
  }

  /** The "+ New" card that appends a trial. Replaced by the max-trials notice at MAX_TRIALS. */
  get newTrialCard(): Locator {
    return this.page.getByRole("button", { name: "Add new trial" });
  }

  trialResetButton(letter: string): Locator {
    return this.page.getByRole("button", { name: `Reset trial ${letter}` });
  }

  /** The "Max number of trials reached" notice that replaces "+ New" at the cap. */
  get maxTrialsNotice(): Locator {
    return this.page.getByText("Max number of trials reached");
  }

  async addTrial(): Promise<void> {
    await this.newTrialCard.click();
  }

  async selectTrial(letter: string): Promise<void> {
    await this.trialOption(letter).click();
  }

  /** The aria-label of the currently focused element (for roving-tabindex keyboard-nav asserts). */
  async focusedAriaLabel(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  }
}
