import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FRAME_HEIGHT, STANDALONE_OUTER_HEIGHT, TARGET_WIDTHS } from "../layout/target-widths";
import { describeIssues, WidthPreview } from "./width-preview";

const SIM_URL = "/index.html";

function renderPreview() {
  return render(<WidthPreview simName="bananas" simUrl={SIM_URL} />);
}

/** The iframes, in the order the cards are laid out. */
function frames(): HTMLIFrameElement[] {
  return screen.getAllByTitle(/bananas at/);
}

describe("WidthPreview", () => {
  it("renders one frame per target width, in order", () => {
    renderPreview();

    expect(frames().map((f) => f.getAttribute("width"))).toEqual(
      TARGET_WIDTHS.map((w) => String(w.px)),
    );
  });

  it("points every frame at the sim URL the plugin supplied", () => {
    renderPreview();

    for (const frame of frames()) {
      expect(frame.getAttribute("src")).toMatch(new RegExp(`^${SIM_URL}\\?standalone=`));
    }
  });

  it("defaults each frame to its mode's real standalone treatment", () => {
    renderPreview();

    const byWidth = new Map(frames().map((f) => [Number(f.getAttribute("width")), f]));
    for (const width of TARGET_WIDTHS) {
      expect(byWidth.get(width.px)?.getAttribute("src")).toBe(
        `${SIM_URL}?standalone=${width.standalone}`,
      );
    }
  });

  it("sizes standalone frames to include the border, and AP frames to the bare allocation", () => {
    // The standalone chrome draws a 2px border outside the 562px content box. A frame sized to
    // FRAME_HEIGHT would clip it.
    renderPreview();

    for (const frame of frames()) {
      const width = Number(frame.getAttribute("width"));
      const standalone = TARGET_WIDTHS.find((w) => w.px === width)?.standalone;
      expect(frame.getAttribute("height")).toBe(
        String(standalone ? STANDALONE_OUTER_HEIGHT : FRAME_HEIGHT),
      );
    }
  });

  it("re-points a frame — and resizes it — when its standalone toggle is flipped", () => {
    renderPreview();

    // 1044 is an AP width, so it starts non-standalone.
    const toggles = screen.getAllByLabelText(/standalone/i);
    fireEvent.click(toggles[0]);

    const frame = screen.getByTitle("bananas at 1044 px, standalone");
    expect(frame.getAttribute("src")).toBe(`${SIM_URL}?standalone=true`);
    expect(frame.getAttribute("height")).toBe(String(STANDALONE_OUTER_HEIGHT));
  });

  it("remounts only the reloaded frame, leaving its siblings' instances alone", () => {
    renderPreview();

    const before = frames();
    fireEvent.click(screen.getByRole("button", { name: `Reload ${TARGET_WIDTHS[0].px} px frame` }));
    const after = frames();

    // A remount is what actually resets a frame's sim state, so identity — not src — is the signal.
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("remounts every frame on reload-all", () => {
    renderPreview();

    const before = frames();
    fireEvent.click(screen.getByRole("button", { name: "Reload all" }));
    const after = frames();

    for (const [i, frame] of after.entries()) {
      expect(frame).not.toBe(before[i]);
    }
  });
});

describe("WidthPreview zoom", () => {
  /** The transform applied to a card's viewport box, e.g. "scale(0.5)". */
  function transforms(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".card-viewport")).map(
      (el) => el.style.transform,
    );
  }

  it("renders unscaled by default in a layout-less environment", () => {
    // "Fit to window" is the default, but with no measurable container (jsdom, or the very first
    // paint) it must fall back to 1 rather than collapsing every frame to nothing.
    renderPreview();

    expect(transforms()).toEqual(TARGET_WIDTHS.map(() => "scale(1)"));
  });

  it("scales every frame when a fixed zoom is chosen", () => {
    renderPreview();

    fireEvent.change(screen.getByLabelText(/zoom/i), { target: { value: "0.5" } });

    expect(transforms()).toEqual(TARGET_WIDTHS.map(() => "scale(0.5)"));
  });

  it("keeps each frame laid out at its true width while scaling it", () => {
    // The sim must never be told it has less room than it really does — only the rendering shrinks,
    // or the preview would be showing a layout that never happens in production.
    renderPreview();

    fireEvent.change(screen.getByLabelText(/zoom/i), { target: { value: "0.5" } });

    expect(frames().map((f) => f.getAttribute("width"))).toEqual(
      TARGET_WIDTHS.map((w) => String(w.px)),
    );
  });

  it("shrinks each card's layout footprint to the scaled size, so cards can sit side by side", () => {
    renderPreview();

    fireEvent.change(screen.getByLabelText(/zoom/i), { target: { value: "0.5" } });

    const scalers = Array.from(document.querySelectorAll<HTMLElement>(".card-scaler"));
    expect(scalers.map((el) => el.style.width)).toEqual(
      TARGET_WIDTHS.map((w) => `${w.px * 0.5}px`),
    );
  });
});

describe("WidthPreview problem warnings", () => {
  /**
   * Point every frame's `contentDocument` at a stub reporting the given scroll box. jsdom never
   * loads an iframe's src, so the real document is empty and reports nothing — this is how we
   * simulate a sim that renders past its allocation.
   */
  function stubFrameContent(scrollHeight: number, scrollWidth = 1044) {
    for (const frame of frames()) {
      Object.defineProperty(frame, "contentDocument", {
        configurable: true,
        value: {
          documentElement: {
            scrollWidth,
            clientWidth: Number(frame.getAttribute("width")),
            scrollHeight,
            clientHeight: Number(frame.getAttribute("height")),
          },
          // No .simulation-frame → the clipped/escaping walk is skipped, leaving overflow alone.
          querySelector: () => null,
          defaultView: null,
        },
      });
    }
  }

  it("stays quiet when every frame's content fits", () => {
    renderPreview();

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("flags a frame whose content is taller than its allocation, and says by how much", () => {
    vi.useFakeTimers();
    try {
      renderPreview();
      stubFrameContent(580);

      // The hook polls; advance past one tick.
      act(() => {
        vi.advanceTimersByTime(600);
      });

      const warnings = screen.getAllByRole("status");
      expect(warnings).toHaveLength(TARGET_WIDTHS.length);
      expect(warnings[0].textContent).toContain("18 px too tall");
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the offending frame's viewport so it is visible at any zoom", () => {
    vi.useFakeTimers();
    try {
      renderPreview();
      stubFrameContent(580);

      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(document.querySelectorAll(".card-viewport.overflowing")).toHaveLength(
        TARGET_WIDTHS.length,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("describeIssues", () => {
  const none = { overflow: { x: 0, y: 0 }, clipped: [], escaping: [] };

  it("says nothing when there is nothing wrong", () => {
    expect(describeIssues(none)).toEqual([]);
  });

  it("names the axis and the amount, because 'it does not fit' is not actionable", () => {
    expect(describeIssues({ ...none, overflow: { x: 0, y: 18 } })).toEqual([
      "Content doesn\u2019t fit \u2014 18 px too tall",
    ]);
    expect(describeIssues({ ...none, overflow: { x: 6, y: 18 } })).toEqual([
      "Content doesn\u2019t fit \u2014 18 px too tall, 6 px too wide",
    ]);
  });

  it("names the clipped elements rather than only counting them", () => {
    const [message] = describeIssues({ ...none, clipped: ['span.tagline ("An interactive")'] });

    expect(message).toBe('Text is clipped in 1 element: span.tagline ("An interactive")');
  });

  it("pluralizes, and caps the named elements so a broken layout doesn't flood the card", () => {
    const [message] = describeIssues({ ...none, clipped: ["a", "b", "c"] });

    expect(message).toBe("Text is clipped in 3 elements: a, b");
  });

  it("reports content escaping the frame", () => {
    const [message] = describeIssues({ ...none, escaping: ["div.data-area"] });

    expect(message).toBe("1 element outside the frame: div.data-area");
  });

  it("reports every distinct problem a frame has at once", () => {
    expect(
      describeIssues({ overflow: { x: 0, y: 18 }, clipped: ["a"], escaping: ["b"] }),
    ).toHaveLength(3);
  });
});
