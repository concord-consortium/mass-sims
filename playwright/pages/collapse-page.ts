import { expect, type Locator } from "@playwright/test";
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

  // --- Timeline + year stepper --------------------------------------------

  get timelineSlider(): Locator {
    return this.page.getByRole("slider", { name: "Years before collapse" });
  }

  get earlierButton(): Locator {
    return this.page.getByRole("button", { name: "Earlier, more years before collapse" });
  }

  get laterButton(): Locator {
    return this.page.getByRole("button", { name: "Later, fewer years before collapse" });
  }

  /** The stepper's digital display. It is `aria-hidden`, so it has no role to find it by. */
  get yearDisplay(): Locator {
    return this.page.locator(".collapse-step-value");
  }

  /** The timeline track; it carries the `dragging` class while a drag is live. */
  get timelineTrack(): Locator {
    return this.page.locator(".collapse-tl");
  }

  /** The page position of a landmark's dot (`index` in list order, 0 = 200,000 yr). */
  async stopDotCenter(index: number): Promise<{ x: number; y: number }> {
    const box = await this.page
      .locator(".collapse-tl-stop")
      .nth(index)
      .locator(".collapse-tl-dot")
      .boundingBox();
    if (!box) throw new Error(`stop ${index} has no dot`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** The page box of part of a landmark: its artwork (`"art"`) or its last label line (`"label"`). */
  async stopPartBox(
    index: number,
    part: "art" | "label",
  ): Promise<{ x: number; y: number; width: number; height: number }> {
    const stop = this.page.locator(".collapse-tl-stop").nth(index);
    const el =
      part === "art"
        ? stop.locator(".collapse-tl-ico svg")
        : stop.locator(".collapse-tl-ev").last();
    const box = await el.boundingBox();
    if (!box) throw new Error(`stop ${index} has no ${part}`);
    return box;
  }

  /** The page x of the handle (the ring under the flag), which marks the chosen value. */
  async handleX(): Promise<number> {
    const box = await this.page.locator(".collapse-tl-handle").boundingBox();
    if (!box) throw new Error("handle not found");
    return box.x;
  }

  // --- Sample button + data table ------------------------------------------

  get sampleButton(): Locator {
    return this.page.getByRole("button", { name: "Sample", exact: true });
  }

  /** The sample rows, in display order (not the spacer row under them). */
  get tableRows(): Locator {
    return this.page.locator(".collapse-table-wrap .collapse-rows tr");
  }

  get tableScroller(): Locator {
    return this.page.locator(".collapse-table-wrap");
  }

  /** A sample row, by the start of its label ("Sample at 150,000 years …"). */
  sampleRow(years: number): Locator {
    return this.page.getByRole("row", {
      name: new RegExp(`^Sample at ${years.toLocaleString("en-US")} years before collapse`),
    });
  }

  /** A sort heading's button, by its full heading: e.g. "Erosion rate (mm/1,000 yr)". */
  sortButton(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** The column header holding a sort button; it carries `aria-sort`. */
  sortHeader(name: string): Locator {
    return this.page.getByRole("columnheader", { name, exact: true });
  }

  deleteButton(years: number): Locator {
    return this.page.getByRole("button", {
      name: `Delete the sample at ${years.toLocaleString("en-US")} years before collapse`,
    });
  }

  get averageRow(): Locator {
    return this.page.locator(".collapse-foot");
  }

  get promptPill(): Locator {
    return this.page.locator(".collapse-prompt-pill");
  }

  get crossSectionCaption(): Locator {
    return this.crossSectionRegion.locator(".collapse-pic-caption");
  }

  /** Moves the timeline to `years` (one of the sixteen values) with the keyboard, then samples. */
  async sampleAt(years: number): Promise<void> {
    await this.timelineSlider.focus();
    await this.page.keyboard.press("Home");
    for (let i = 0; i < 16; i++) {
      if ((await this.timelineSlider.getAttribute("aria-valuenow")) === String(years)) break;
      await this.page.keyboard.press("ArrowRight");
    }
    await expect(this.timelineSlider).toHaveAttribute("aria-valuenow", String(years));
    await this.sampleButton.click();
  }

  // --- Compare Trials -----------------------------------------------------

  get compareButton(): Locator {
    return this.page.getByRole("button", { name: "Compare Trials", exact: true });
  }

  get compareDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Compare trials" });
  }

  get compareCloseButton(): Locator {
    return this.compareDialog.getByRole("button", { name: "Close the trial comparison" });
  }

  get compareGrid(): Locator {
    return this.page.locator(".collapse-compare-grid");
  }

  /** Trial `letter`'s column (A–D, in order). */
  compareColumn(letter: string): Locator {
    return this.page.locator(".collapse-compare-col").nth("ABCD".indexOf(letter));
  }

  /** Trial `letter`'s sample rows, in display order. */
  compareRows(letter: string): Locator {
    return this.compareColumn(letter).locator("tbody.collapse-rows > tr");
  }

  /** A row in trial `letter`'s column, by the start of its label ("Trial B, 0 years …"). */
  compareRow(letter: string, years: number): Locator {
    return this.compareColumn(letter).getByRole("row", {
      name: new RegExp(`^Trial ${letter}, ${years.toLocaleString("en-US")} years before collapse`),
    });
  }

  /** A sort button in trial `letter`'s column, by its full name: e.g. "Erosion rate (mm/1,000 yr)". */
  compareSortButton(letter: string, name: string): Locator {
    return this.compareColumn(letter).getByRole("button", { name, exact: true });
  }

  /** The `th` holding a compare sort button; it carries `aria-sort`. */
  compareSortHeader(letter: string, name: string): Locator {
    return this.compareColumn(letter).locator("th", {
      has: this.page.getByRole("button", { name, exact: true }),
    });
  }

  compareAverageRow(letter: string): Locator {
    return this.compareColumn(letter).locator(".collapse-foot");
  }

  get comparePromptPill(): Locator {
    return this.compareDialog.locator(".collapse-prompt-pill");
  }

  compareEmptyNotice(letter: string): Locator {
    return this.compareColumn(letter).locator(".collapse-compare-empty");
  }

  /**
   * The compare headings whose label or chevron does not hit their own sort button, tested at the
   * left edge, the center and the right edge of each. Empty when every heading is hit.
   */
  compareHeadingMisses(): Promise<string[]> {
    return this.page.evaluate(() => {
      const out: string[] = [];
      for (const button of document.querySelectorAll<HTMLElement>(
        ".collapse-compare .collapse-th-sort",
      )) {
        for (const part of Array.from(button.children)) {
          const box = part.getBoundingClientRect();
          for (const x of [box.left + 1, (box.left + box.right) / 2, box.right - 1]) {
            const hit = document.elementFromPoint(x, box.top + box.height / 2);
            if (hit?.closest(".collapse-th-sort") !== button) out.push(button.textContent ?? "");
          }
        }
      }
      return out;
    });
  }

  async isInert(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => el.closest("[inert]") !== null);
  }

  /**
   * Adds a button after the sim, as the page around an embedded sim would have. Without one, Tab
   * runs off the end of the page and the browser starts again inside the sim, so a test of the
   * focus trap would pass without the trap.
   */
  async addOutsideButton(): Promise<void> {
    await this.page.evaluate(() => {
      const outside = document.createElement("button");
      outside.textContent = "Outside";
      document.body.append(outside);
    });
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

  /**
   * Gap between the Simulation slot's right edge and the right edge of `.sim-main`'s content box. Near
   * zero when the shared frame's two-column rule gives Simulation the whole row.
   */
  async simulationSlotRightGap(): Promise<number> {
    return this.page.evaluate(() => {
      const main = document.querySelector(".sim-main");
      const sim = document.querySelector(".simulation-area");
      if (!main || !sim) throw new Error("frame regions not found");
      const style = getComputedStyle(main);
      const contentRight =
        main.getBoundingClientRect().right -
        Number.parseFloat(style.paddingRight) -
        Number.parseFloat(style.borderRightWidth);
      return contentRight - sim.getBoundingClientRect().right;
    });
  }

  async focusedAriaLabel(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  }
}
