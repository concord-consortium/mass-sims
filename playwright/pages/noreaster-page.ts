import type { Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { SimulationFramePage } from "./simulation-frame-page";

/**
 * Page object for the Nor'easter sim. Adds the Trials-panel locators and the Simulation-panel
 * locators (dropdowns, map image, map-view toggle, Run / Reset Trial) on top of the shared-chrome
 * base, plus a `goto()` that navigates to the Nor'easter preview URL from the sims registry.
 */
export class NoreasterPage extends SimulationFramePage {
  /** Navigate to the Nor'easter preview server (URL derived from the sims registry). */
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("noreaster"));
  }

  // --- Simulation panel ---------------------------------------------------

  /**
   * An air-mass dropdown trigger by its field label, e.g. `dropdown("Pathway for Land Air Mass")`.
   * react-aria names the trigger by its value (placeholder) then the field label, so match on the
   * field label as a substring.
   */
  dropdown(field: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(field) });
  }

  /** The base map — an informative image named by its full description. */
  get mapImage(): Locator {
    return this.page.getByRole("img", { name: /Map of the eastern United States/ });
  }

  /** The Street ⇄ Satellite map-view toggle (a role="switch"). */
  get mapViewToggle(): Locator {
    return this.page.getByRole("switch", { name: /Map view/ });
  }

  /** The Run button. */
  get runButton(): Locator {
    return this.page.getByRole("button", { name: "Run", exact: true });
  }

  /** The Run button once the trial has been run (it relabels to Replay). */
  get replayButton(): Locator {
    return this.page.getByRole("button", { name: "Replay", exact: true });
  }

  /** The on-map "Click Run…" prompt pill, shown once the setup is complete (pre-run). */
  get runPrompt(): Locator {
    return this.page.locator(".nor-prompt");
  }

  /** The map stage — carries `data-map-view` ("street" | "satellite"). */
  get mapStage(): Locator {
    return this.page.locator(".nor-stage");
  }

  /** Open an air-mass dropdown by its field label and pick an option by its accessible name. */
  async selectOption(field: string, optionName: string): Promise<void> {
    await this.dropdown(field).click();
    await this.page.getByRole("option", { name: optionName, exact: true }).click();
  }

  /** Complete all five air-mass selections (a strong-nor'easter setup). */
  async completeSetup(): Promise<void> {
    await this.selectOption("Pathway for Land Air Mass", "1 N/NW");
    await this.selectOption("Humidity for Land Air Mass", "Dry");
    await this.selectOption("Temperature for Land Air Mass", "Cold");
    await this.selectOption("Pathway for Ocean Air Mass", "2 S/SE");
    await this.selectOption("Humidity for Ocean Air Mass", "Humid");
  }

  /** Toggle the map view by clicking the visible switch button (not the hidden input). */
  async toggleMapView(): Promise<void> {
    await this.page.locator(".map-view-button").click();
  }

  /**
   * The control-bar Reset Trial button. `exact` so it doesn't also match a Trials-panel per-trial
   * reset ("Reset trial A", a case-insensitive substring of it).
   */
  get resetTrialButton(): Locator {
    return this.page.getByRole("button", { name: "Reset Trial", exact: true });
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
