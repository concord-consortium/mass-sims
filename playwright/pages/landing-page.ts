import type { FrameLocator, Locator, Page } from "@playwright/test";
import { getTopTestUrl } from "../sims";

/** Page object for the landing page (the root index.html), served from the top-test fixture. */
export class LandingPage {
  constructor(readonly page: Page) {}

  /** Open the page at a deploy path ("/", "/version/<tag>/", "/branch/<name>/"), with a query. */
  async goto(path = "/"): Promise<void> {
    await this.page.goto(getTopTestUrl(path));
  }

  /** By folder name: a sim's title also appears in the share buttons' accessible names. */
  simButton(name: string): Locator {
    return this.page.locator(`.sim-button[data-sim="${name}"]`);
  }

  get simButtons(): Locator {
    return this.page.locator(".sim-button");
  }

  get simFrame(): Locator {
    return this.page.locator(".sim-frame");
  }

  /** The sim running inside the iframe. */
  get sim(): FrameLocator {
    return this.page.frameLocator(".sim-frame");
  }

  /** The URL the iframe actually loaded. */
  async simFrameUrl(): Promise<string> {
    const frame = await (await this.simFrame.elementHandle())?.contentFrame();
    if (!frame) throw new Error("the sim iframe has no frame");
    return frame.url();
  }

  /** By id: the accessible name includes the sim's title and the label, which turns to "Copied". */
  shareButton(action: "open" | "copy-url" | "copy-embed"): Locator {
    return this.page.locator(`#share-${action}`);
  }

  get shareName(): Locator {
    return this.page.locator("#share-name");
  }

  get liveRegion(): Locator {
    return this.page.locator(".share [aria-live]");
  }

  get footerVersion(): Locator {
    return this.page.locator(".footer-version");
  }

  async clipboardText(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  /** True when the page is wider than the window, so it scrolls sideways. */
  async scrollsSideways(): Promise<boolean> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
  }
}
