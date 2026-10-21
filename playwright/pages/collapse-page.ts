import type { Locator } from "@playwright/test";
import { getSimUrl } from "../sims";
import { SimulationFramePage } from "./simulation-frame-page";

/** Page object for the Collapse sim. The shared chrome comes from `SimulationFramePage`. */
export class CollapsePage extends SimulationFramePage {
  async goto(): Promise<void> {
    await this.page.goto(getSimUrl("collapse"));
  }

  get crossSectionRegion(): Locator {
    return this.page.getByRole("region", { name: "Cross Section" });
  }

  // --- Trials panel -------------------------------------------------------

  get trialsListbox(): Locator {
    return this.page.getByRole("listbox", { name: "Trials" });
  }

  /** Matches on the leading "Trial X" of the card's longer accessible name. */
  trialOption(letter: string): Locator {
    return this.page.getByRole("option", { name: new RegExp(`^Trial ${letter}\\b`) });
  }

  get trialOptions(): Locator {
    return this.trialsListbox.getByRole("option");
  }

  trialResetButton(letter: string): Locator {
    return this.page.getByRole("button", { name: `Reset trial ${letter}` });
  }

  async selectTrial(letter: string): Promise<void> {
    await this.trialOption(letter).click();
  }

  async focusedAriaLabel(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  }
}
