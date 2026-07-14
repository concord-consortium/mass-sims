import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page object for the shared `<SimulationFrame>` chrome that every sim renders
 * (packages/shared/src/components/simulation-frame). Holds locators + actions for the parts
 * common to all sims: the header (title, tagline, About button), the About panel (a
 * `complementary` landmark) and its close paths, and the three named slot regions
 * (Trials / Simulation / Data).
 *
 * There is deliberately NO `goto()`: the base chrome has no canonical URL, so navigation lives
 * only on per-sim subclasses, which read their URL from the sims registry via getSimUrl(name).
 * Specs call `await <sim>.goto()`, never page.goto('/').
 *
 * Locators favor accessible queries (getByRole / getByLabel / getByText), falling back to CSS
 * class selectors only where the element has no good accessible name (e.g. the header container
 * and the tagline).
 */
export class SimulationFramePage {
  constructor(protected page: Page) {}

  /** The frame header bar. CSS fallback: the <header> has no accessible name of its own. */
  get header(): Locator {
    return this.page.locator("header.title-bar");
  }

  /** The sim title — the single <h1> in the frame (text varies per sim). */
  get simTitle(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  /** The tagline beside the title. CSS fallback: a plain <span> with no role. */
  get tagline(): Locator {
    return this.header.locator(".tagline");
  }

  /** The header "About" button that toggles the About info panel. */
  get aboutButton(): Locator {
    return this.page.getByRole("button", { name: /about/i });
  }

  /**
   * The About info panel — a `complementary` landmark (not a dialog), named by its "About the …
   * Simulation" heading; only present in the DOM while open.
   */
  get aboutPanel(): Locator {
    return this.page.getByRole("complementary", { name: /About the .* Simulation/ });
  }

  /** The close ("✕") button inside the About panel (aria-label "Close"). */
  get closeAboutButton(): Locator {
    return this.aboutPanel.getByRole("button", { name: "Close" });
  }

  /** The Trials slot region (aria-label "Trials"). */
  get trialsSlot(): Locator {
    return this.page.getByRole("region", { name: "Trials" });
  }

  /** The Simulation slot region (aria-label "Simulation"). */
  get simulationSlot(): Locator {
    return this.page.getByRole("region", { name: "Simulation" });
  }

  /** The Data slot region (aria-label "Data"). */
  get dataSlot(): Locator {
    return this.page.getByRole("region", { name: "Data" });
  }

  /**
   * The Trials-region scroll container (`.content` inside the Trials Section). This is the element
   * `useScrollFocusRing` toggles `tabindex="0"` on while the trials list overflows — shared by all
   * sims via the `Section scrollFocusRing` opt-in.
   */
  get trialsScrollRegion(): Locator {
    return this.trialsSlot.locator(".content");
  }

  /** The About panel's scrollable body (`.modal-body`), a `useScrollFocusRing` scroll region. */
  get modalBody(): Locator {
    return this.page.locator(".modal-body");
  }

  /**
   * Whether `locator`'s element overflows (`scrollHeight > clientHeight`) — the exact condition
   * `useScrollFocusRing` uses to add/remove `tabindex="0"`. Lets a spec confirm the overflow
   * precondition in-page before asserting the resulting tabindex, so an assertion never depends on
   * an assumed layout.
   */
  async overflows(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => el.scrollHeight > el.clientHeight);
  }

  async openAbout(): Promise<void> {
    await this.aboutButton.click();
    await expect(this.aboutPanel).toBeVisible();
  }

  async closeAboutViaButton(): Promise<void> {
    await this.closeAboutButton.click();
    await expect(this.aboutPanel).toBeHidden();
  }

  async closeAboutViaEscape(): Promise<void> {
    await this.press("Escape");
    await expect(this.aboutPanel).toBeHidden();
  }

  /** Press a key on the keyboard (acts on the focused element). Keeps `page` encapsulated. */
  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async isFocusWithin(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => el.contains(document.activeElement));
  }

  /**
   * Assert whether the standalone reload warning is currently armed.
   *
   * A sim arms it by registering a `beforeunload` handler that calls `preventDefault()` (see the
   * shared `useReloadWarning` hook). We detect that by dispatching a synthetic *cancelable*
   * `beforeunload` event and reading `defaultPrevented`: true iff some handler cancelled it.
   *
   * Why not close the page and watch for the native dialog (`page.close({ runBeforeUnload: true })`
   * + a `dialog` event)? That's unreliable under Playwright tracing — in UI mode / `--trace on`
   * the instrumented close surfaces a spurious `beforeunload` dialog even on a clean page, so the
   * negative case gets a false positive. The synthetic-dispatch approach is deterministic and
   * mode-independent (headless, headed, UI, traced) because it never closes the page or depends on
   * a dialog, and it checks the exact contract the hook implements. Lives on the base class so
   * every sim's reload-warning test reuses it.
   */
  async assertReloadWarning(expected: boolean): Promise<void> {
    const warned = await this.page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(warned).toBe(expected);
  }
}
