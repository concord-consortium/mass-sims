// The shared chrome (header, About modal, slots) is inherited from SimulationFramePage.
import type { Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { SimulationFramePage } from "./simulation-frame-page";

/**
 * Page object for the Collapse sim. This is the CANONICAL template a new sim's
 * page object is copied from (via `yarn new-sim`) — keep it readable and representative.
 *
 * Extends the shared-chrome base with Collapse-specific locators (the four fixed trial tabs, the
 * Cross Section region) and a `goto()` that navigates to the Collapse preview URL sourced from the
 * sims registry.
 */
export class CollapsePage extends SimulationFramePage {
  /** Navigate to the Collapse preview server (URL derived from the sims registry). */
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("collapse"));
  }

  /** The Cross Section box inside the Simulation slot (a shared <Section>, so a named region). */
  get crossSectionRegion(): Locator {
    return this.page.getByRole("region", { name: "Cross Section" });
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
   * accessible name ("Trial A. Limestone, Dry, …"), so match on the leading "Trial X".
   */
  trialOption(letter: string): Locator {
    return this.page.getByRole("option", { name: new RegExp(`^Trial ${letter}\\b`) });
  }

  /** Every trial option, in rendered order. */
  get trialOptions(): Locator {
    return this.trialsListbox.getByRole("option");
  }

  trialResetButton(letter: string): Locator {
    return this.page.getByRole("button", { name: `Reset trial ${letter}` });
  }

  async selectTrial(letter: string): Promise<void> {
    await this.trialOption(letter).click();
  }

  /** The aria-label of the currently focused element (for roving-tabindex keyboard-nav asserts). */
  async focusedAriaLabel(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  }
}
