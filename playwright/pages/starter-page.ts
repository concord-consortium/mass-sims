import { expect, type Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { SimulationFramePage } from "./simulation-frame-page";

/**
 * Page object for the Starter (Random Walk) sim. This is the CANONICAL template a new sim's
 * page object is copied from (via `yarn new-sim`) — keep it readable and representative.
 *
 * Extends the shared-chrome base with Starter-specific controls (the simulation view, its
 * play/pause/step/reset buttons, the parameter fields) and a `goto()` that navigates to the
 * Starter preview URL sourced from the sims registry.
 */
export class StarterPage extends SimulationFramePage {
  /** Navigate to the Starter preview server (URL derived from the sims registry). */
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("starter"));
  }

  /** The random-walk canvas (aria-label "Random walk visualization"). */
  get simulationCanvas(): Locator {
    return this.page.getByLabel("Random walk visualization");
  }

  /** Play button. Toggles to "Pause" while the runner is active. */
  get playButton(): Locator {
    return this.page.getByRole("button", { name: "Play", exact: true });
  }

  /** Pause button — only present (as the toggled label) while the runner is playing. */
  get pauseButton(): Locator {
    return this.page.getByRole("button", { name: "Pause", exact: true });
  }

  /** Step button — advances the run one frame. */
  get stepButton(): Locator {
    return this.page.getByRole("button", { name: "Step", exact: true });
  }

  /**
   * The control-bar Reset button. Distinct from the trials-panel "Reset trial X" affordance —
   * `exact` keeps this from matching that reset's accessible name.
   */
  get resetButton(): Locator {
    return this.page.getByRole("button", { name: "Reset", exact: true });
  }

  /** "Frames per Trial" number field (role textbox; commits on Enter/blur). */
  get framesPerTrialField(): Locator {
    return this.page.getByRole("textbox", { name: /frames per trial/i });
  }

  /** "Walker Count" slider. */
  get walkerCountSlider(): Locator {
    return this.page.getByRole("slider", { name: /walker count/i });
  }

  // --- Trials panel -------------------------------------------------------
  // A single-select listbox: role="listbox" container, cards as role="option" with roving tabindex
  // and enriched accessible names.

  /** The trial-selector listbox (vertical, labeled "Trials"). */
  get trialsListbox(): Locator {
    return this.page.getByRole("listbox", { name: "Trials" });
  }

  /**
   * A trial option by its letter, e.g. trialOption("A"). Cards are role="option" with an enriched
   * accessible name ("Trial A. Walker count 50, step size 1…"), so match on the leading "Trial X".
   */
  trialOption(letter: string): Locator {
    return this.page.getByRole("option", { name: new RegExp(`^Trial ${letter}\\b`) });
  }

  /** The "+ New" card that appends a trial. Replaced by the max-trials notice at MAX_TRIALS. */
  get newTrialCard(): Locator {
    return this.page.getByRole("button", { name: "Add new trial" });
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

  /**
   * Drive the selected trial to COMPLETION through the on-page UI — the only way to flip the
   * sim into the "dirty" state that arms the reload warning (Starter's `useReloadWarning` is
   * gated on `output !== null`, set only when a trial runs its full frame count; see
   * packages/starter/src/app.tsx ~L79). There is no URL param for this, so we shorten the run
   * via the on-page NumberField and Step through every frame (deterministic, no animation
   * timing), mirroring the unit test at packages/starter/src/app.test.tsx ~L20.
   */
  async completeOneTrial(frames = 2): Promise<void> {
    await this.framesPerTrialField.fill(String(frames));
    await this.framesPerTrialField.press("Enter");
    // Step exactly `frames` times: each click advances one frame; the final click reaches
    // framesPerTrial and commits the trial output. The button disables on completion, so the
    // last click must land while it's still enabled — which it is (frame N-1 < framesPerTrial).
    for (let i = 0; i < frames; i++) {
      await this.stepButton.click();
    }
    // Completion is observable: the selected trial card now shows its recorded "avg" stat.
    await expect(this.page.getByText(/avg \d/i)).toBeVisible();
  }
}
