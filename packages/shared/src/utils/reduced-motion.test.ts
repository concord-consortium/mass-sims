import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, smoothScrollIntoView } from "./reduced-motion";

/** Point `window.matchMedia` at a stub reporting the given `.matches` value. */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe("reduced-motion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  describe("prefersReducedMotion", () => {
    it("returns the matchMedia .matches value when matchMedia is present", () => {
      mockMatchMedia(true);
      expect(prefersReducedMotion()).toBe(true);

      mockMatchMedia(false);
      expect(prefersReducedMotion()).toBe(false);
    });

    it("returns false when matchMedia is absent", () => {
      // @ts-expect-error temporarily remove matchMedia to simulate jsdom/SSR without the API
      window.matchMedia = undefined;
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe("smoothScrollIntoView", () => {
    it("scrolls smoothly when reduced motion is not preferred", () => {
      mockMatchMedia(false);
      const el = document.createElement("div");
      // jsdom doesn't implement scrollIntoView; define it so it can be spied on.
      el.scrollIntoView = vi.fn();
      smoothScrollIntoView(el);
      expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    });

    it("scrolls instantly when reduced motion is preferred", () => {
      mockMatchMedia(true);
      const el = document.createElement("div");
      // jsdom doesn't implement scrollIntoView; define it so it can be spied on.
      el.scrollIntoView = vi.fn();
      smoothScrollIntoView(el);
      expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
    });

    it("is a no-op when scrollIntoView is undefined on the element", () => {
      mockMatchMedia(false);
      const el = document.createElement("div");
      // @ts-expect-error simulate an environment (jsdom/SSR) lacking scrollIntoView
      el.scrollIntoView = undefined;
      expect(() => smoothScrollIntoView(el)).not.toThrow();
    });
  });
});
