import { expect, type Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { PARENT_LABELS, type ParentId } from "../testdata/bananas-testdata";
import { SimulationFramePage } from "./simulation-frame-page";

/**
 * Page object for the Bananas genetics sim. Extends the shared-chrome base with Bananas-specific
 * controls (parent selectors, the fungus switch, the Cross Plants / Reset Trial control bar, the
 * offspring grid, the trial tablist, the Data-panel charts) plus the actions Task 4's functional
 * spec drives. Locators favor accessible queries; CSS fallbacks are used only for elements with no
 * good accessible name (the active-trial badge, the status pill, offspring rows).
 */
export class BananasPage extends SimulationFramePage {
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("bananas"));
  }

  // --- Parent selection ---------------------------------------------------

  get parent1Select(): Locator {
    return this.page.getByRole("button", { name: /parent 1/i });
  }

  get parent2Select(): Locator {
    return this.page.getByRole("button", { name: /parent 2/i });
  }

  private async pickParent(trigger: Locator, id: ParentId): Promise<void> {
    await trigger.click();
    // Only the open listbox renders options, so the label is unambiguous across both selects.
    await this.page.getByRole("option", { name: PARENT_LABELS[id], exact: true }).click();
  }

  async pickParent1(id: ParentId): Promise<void> {
    await this.pickParent(this.parent1Select, id);
  }

  async pickParent2(id: ParentId): Promise<void> {
    await this.pickParent(this.parent2Select, id);
  }

  // --- Fungus + control bar ----------------------------------------------

  /** The Fungus toggle (role="switch"). NOTE: this is the visually-hidden 13×13 native input
   *  behind the visual control — use it for state assertions (toBeChecked), not for clicking. */
  get fungusSwitch(): Locator {
    return this.page.getByRole("switch", { name: "Fungus" });
  }

  async toggleFungus(): Promise<void> {
    // Click the VISIBLE switch button, not the hidden input getByRole("switch") resolves to:
    // a direct click on the tiny input hit-tests onto the svg layered on top of it. The svg is a
    // descendant of `.fungus-switch-button`, so clicking the button is unambiguous and toggles it.
    await this.page.locator(".fungus-switch-button").click();
  }

  get crossPlantsButton(): Locator {
    return this.page.getByRole("button", { name: "Cross Plants", exact: true });
  }

  async crossPlants(): Promise<void> {
    await this.crossPlantsButton.click();
  }

  /**
   * The control-bar "Reset Trial" button. `exact` is required: without it, the default
   * case-insensitive substring match also captures the selected card's "Reset trial X" overhang.
   */
  get resetTrialButton(): Locator {
    return this.page.getByRole("button", { name: "Reset Trial", exact: true });
  }

  /** Reset the active trial via the control-bar button. */
  async resetActiveTrial(): Promise<void> {
    await this.resetTrialButton.click();
  }

  // --- Offspring grid -----------------------------------------------------

  get offspringGrid(): Locator {
    return this.page.locator(".offspring-grid");
  }

  get offspringRows(): Locator {
    return this.offspringGrid.locator(".offspring-row");
  }

  async scrollOffspringGridToBottom(): Promise<void> {
    await this.offspringGrid.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }

  crossRowButton(index: number): Locator {
    return this.offspringRows.nth(index).locator(".offspring-row-button");
  }

  /** The offspring-plant icons within the Nth cross row (0-based) — 5–20 per cross. */
  offspringPlants(index: number): Locator {
    return this.offspringRows.nth(index).locator(".offspring-plant");
  }

  async getCrossCount(): Promise<number> {
    return this.offspringRows.count();
  }

  async selectCross(index: number): Promise<void> {
    await this.crossRowButton(index).click();
  }

  async isCrossSelected(index: number): Promise<boolean> {
    return (await this.crossRowButton(index).getAttribute("aria-pressed")) === "true";
  }

  get maxCrossesNotice(): Locator {
    return this.page.getByText("Max number of crosses reached");
  }

  // --- Trials panel -------------------------------------------------------

  get trialsTablist(): Locator {
    return this.page.getByRole("tablist", { name: "Trials" });
  }

  trialTab(letter: string): Locator {
    return this.page.getByRole("tab", { name: new RegExp(`^Trial ${letter}\\b`) });
  }

  /** The aria-label of the currently focused element (for roving-tabindex keyboard-nav asserts). */
  async focusedAriaLabel(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  }

  get newTrialCard(): Locator {
    return this.page.getByRole("button", { name: "Add new trial" });
  }

  /** The "Max number of trials reached" notice that replaces "+ New" at MAX_TRIALS. */
  get maxTrialsNotice(): Locator {
    return this.page.getByText("Max number of trials reached");
  }

  async addTrial(): Promise<void> {
    await this.newTrialCard.click();
  }

  async selectTrial(letter: string): Promise<void> {
    await this.trialTab(letter).click();
  }

  /**
   * Reset a trial via its per-card reset overhang (only present on the selected card). This is a
   * different code path from the control-bar "Reset Trial" button — it resets the acted-on card.
   */
  async resetTrialViaCardOverhang(letter: string): Promise<void> {
    await this.page.getByRole("button", { name: `Reset trial ${letter}`, exact: true }).click();
  }

  // --- Simulation panel -------------------------------------

  get activeTrialBadge(): Locator {
    return this.page.locator(".active-trial-badge");
  }

  async getActiveTrialLetter(): Promise<string> {
    return (await this.activeTrialBadge.textContent())?.trim() ?? "";
  }

  get statusPill(): Locator {
    return this.page.locator(".status-pill");
  }

  // --- Data panel -------------------------------------

  get phenotypePie(): Locator {
    return this.dataSlot.getByRole("img", { name: /offspring phenotypes/i });
  }

  get resistanceChart(): Locator {
    return this.dataSlot.getByRole("img", { name: /fungus resistance/i });
  }

  get pillChip(): Locator {
    return this.page.locator(".pill-chip");
  }

  // --- Composite helpers --------------------------------------------------

  /**
   * Set up a cross-ready trial: pick both parents (and optionally turn fungus on BEFORE the first
   * cross, since fungus locks at the first cross). Does not click Cross Plants.
   */
  async pickParents(p1: ParentId, p2: ParentId): Promise<void> {
    await this.pickParent1(p1);
    await this.pickParent2(p2);
    await expect(this.crossPlantsButton).toBeEnabled();
  }
}
