import { describe, expect, it } from "vitest";
import {
  type ClipProbe,
  hasFlaggedAncestor,
  isEscaping,
  isTextClipped,
  measureOverflow,
  type ScrollBox,
} from "./use-frame-issues";

/** A frame's document box: content of `scroll*` inside a viewport of `client*`. */
function box(over: Partial<ScrollBox>): ScrollBox {
  return { scrollWidth: 1044, clientWidth: 1044, scrollHeight: 562, clientHeight: 562, ...over };
}

describe("measureOverflow", () => {
  it("reports nothing when the content fits its allocation exactly", () => {
    expect(measureOverflow(box({}))).toEqual({ x: 0, y: 0 });
  });

  it("reports nothing when the content is smaller than its allocation", () => {
    expect(measureOverflow(box({ scrollHeight: 400, scrollWidth: 900 }))).toEqual({ x: 0, y: 0 });
  });

  it("reports how many px too tall the content is", () => {
    expect(measureOverflow(box({ scrollHeight: 580 }))).toEqual({ x: 0, y: 18 });
  });

  it("reports how many px too wide the content is", () => {
    expect(measureOverflow(box({ scrollWidth: 1050 }))).toEqual({ x: 6, y: 0 });
  });

  it("reports both axes at once", () => {
    expect(measureOverflow(box({ scrollWidth: 1050, scrollHeight: 580 }))).toEqual({ x: 6, y: 18 });
  });

  it("ignores sub-pixel slop, so zoom transforms don't cry wolf", () => {
    // Fractional layout routinely leaves a fraction of a px of scrollable area behind.
    expect(measureOverflow(box({ scrollHeight: 562.5, scrollWidth: 1044.4 }))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("rounds a real overflow to whole px", () => {
    expect(measureOverflow(box({ scrollHeight: 579.6 }))).toEqual({ x: 0, y: 18 });
  });
});

/** A leaf element whose text is wider than its box and hard-clipped — i.e. losing characters. */
function clipProbe(over: Partial<ClipProbe> = {}): ClipProbe {
  return {
    overflowX: "hidden",
    textOverflow: "clip",
    scrollWidth: 200,
    clientWidth: 150,
    childElementCount: 0,
    text: "Fungus Resistance",
    ...over,
  };
}

describe("isTextClipped", () => {
  it("flags text hard-clipped by a hidden overflow", () => {
    expect(isTextClipped(clipProbe())).toBe(true);
  });

  it("ignores an intentional ellipsis — a designed truncation, not a bug", () => {
    expect(isTextClipped(clipProbe({ textOverflow: "ellipsis" }))).toBe(false);
  });

  it("ignores scrollable elements, since the text is still reachable", () => {
    expect(isTextClipped(clipProbe({ overflowX: "auto" }))).toBe(false);
    expect(isTextClipped(clipProbe({ overflowX: "visible" }))).toBe(false);
  });

  it("ignores non-leaf elements, so a clipped child isn't reported twice", () => {
    expect(isTextClipped(clipProbe({ childElementCount: 2 }))).toBe(false);
  });

  it("ignores elements with no text — a clipped spacer isn't a text bug", () => {
    expect(isTextClipped(clipProbe({ text: "" }))).toBe(false);
  });

  it("ignores text that fits, and sub-pixel slop", () => {
    expect(isTextClipped(clipProbe({ scrollWidth: 150 }))).toBe(false);
    expect(isTextClipped(clipProbe({ scrollWidth: 150.5 }))).toBe(false);
  });
});

describe("isEscaping", () => {
  const frame = { left: 0, right: 1044 };

  it("passes an element inside the frame", () => {
    expect(isEscaping({ left: 10, right: 900 }, frame)).toBe(false);
  });

  it("passes an element flush with the frame's edges", () => {
    expect(isEscaping({ left: 0, right: 1044 }, frame)).toBe(false);
  });

  it("flags an element punching out the right edge", () => {
    // The standalone container clips with overflow:hidden, so this is silently cut off in the UI.
    expect(isEscaping({ left: 900, right: 1060 }, frame)).toBe(true);
  });

  it("flags an element punching out the left edge", () => {
    expect(isEscaping({ left: -12, right: 200 }, frame)).toBe(true);
  });

  it("tolerates sub-pixel slop on either edge", () => {
    expect(isEscaping({ left: -0.4, right: 1044.6 }, frame)).toBe(false);
  });
});

describe("hasFlaggedAncestor", () => {
  // When a container escapes the frame, so does every descendant inside it. Reporting all of them
  // would bury the one element you'd go fix under dozens of consequences of it.
  function tree() {
    const root = document.createElement("div");
    const mid = document.createElement("div");
    const leaf = document.createElement("span");
    root.appendChild(mid);
    mid.appendChild(leaf);
    return { root, mid, leaf };
  }

  it("is false when nothing above the element is flagged", () => {
    const { root, leaf } = tree();

    expect(hasFlaggedAncestor(leaf, new Set([root.cloneNode()] as Element[]))).toBe(false);
    expect(hasFlaggedAncestor(leaf, new Set())).toBe(false);
  });

  it("is true for a descendant of a flagged element, however deep", () => {
    const { root, mid, leaf } = tree();

    expect(hasFlaggedAncestor(mid, new Set([root]))).toBe(true);
    expect(hasFlaggedAncestor(leaf, new Set([root]))).toBe(true);
  });

  it("does not treat an element as its own ancestor", () => {
    const { leaf } = tree();

    expect(hasFlaggedAncestor(leaf, new Set([leaf]))).toBe(false);
  });
});
