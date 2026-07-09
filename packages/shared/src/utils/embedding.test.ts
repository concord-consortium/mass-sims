import { afterEach, describe, expect, it } from "vitest";
import { inIframe } from "./embedding";

/** Override `window.top` with a getter, returning a restore fn. jsdom's `top` is configurable. */
function stubTop(get: () => unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(window, "top");
  Object.defineProperty(window, "top", { configurable: true, get: get as () => Window });
  return () => {
    if (original) Object.defineProperty(window, "top", original);
  };
}

describe("inIframe", () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("returns false at the top level (self === top)", () => {
    // jsdom runs as the top window: window.self === window.top.
    expect(inIframe()).toBe(false);
  });

  it("returns true when framed (self !== top)", () => {
    restore = stubTop(() => ({}) as Window);
    expect(inIframe()).toBe(true);
  });

  it("returns true when reading window.top throws (locked-down cross-origin)", () => {
    restore = stubTop(() => {
      throw new Error("cross-origin");
    });
    expect(inIframe()).toBe(true);
  });
});
