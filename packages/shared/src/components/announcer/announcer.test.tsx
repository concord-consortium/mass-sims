import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnnounceFn, Announcer, CLEAR_MS, DWELL_MS, useAnnounce } from "./announcer";

// Capture the context's announce fn so a test can push messages synchronously (same tick), which a
// button-click harness can't do. useAnnounce returns a stable callback, so the last captured value
// is the one to call.
let captured: AnnounceFn = () => {};
function Capture() {
  captured = useAnnounce();
  return null;
}

function renderAnnouncer() {
  const utils = render(
    <Announcer>
      <Capture />
    </Announcer>,
  );
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { ...utils, region };
}

describe("Announcer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a single visually-hidden polite, atomic live region", () => {
    const { region } = renderAnnouncer();
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region.textContent).toBe("");
  });

  it("puts an announced message into the region", () => {
    const { region } = renderAnnouncer();
    act(() => captured("Fungus introduced."));
    expect(region.textContent).toBe("Fungus introduced.");
  });

  it("shows BOTH messages, in order, when two are announced in the same tick (nothing dropped)", () => {
    const { region } = renderAnnouncer();
    act(() => {
      captured("A");
      captured("B");
    });
    // The first message is shown immediately...
    expect(region.textContent).toBe("A");
    // ...then after its dwell + the clear gap, the queued second message replaces it.
    act(() => vi.advanceTimersByTime(DWELL_MS + CLEAR_MS));
    expect(region.textContent).toBe("B");
  });

  it("re-announces an identical consecutive message (clears to '' between the two)", () => {
    const { region } = renderAnnouncer();
    act(() => {
      captured("Trial A reset.");
      captured("Trial A reset.");
    });
    expect(region.textContent).toBe("Trial A reset.");
    // Cleared to "" after the dwell — the blank is the change that lets the repeat register.
    act(() => vi.advanceTimersByTime(DWELL_MS));
    expect(region.textContent).toBe("");
    // Then the second identical message is set again.
    act(() => vi.advanceTimersByTime(CLEAR_MS));
    expect(region.textContent).toBe("Trial A reset.");
  });

  it("drains a queued burst to empty without leaving anything unshown", () => {
    const { region } = renderAnnouncer();
    act(() => {
      captured("one");
      captured("two");
      captured("three");
    });
    const seen = [region.textContent];
    for (let i = 0; i < 3; i++) {
      act(() => vi.advanceTimersByTime(DWELL_MS + CLEAR_MS));
      seen.push(region.textContent);
    }
    expect(seen).toContain("one");
    expect(seen).toContain("two");
    expect(seen).toContain("three");
  });

  it("clears its pending timers on unmount (no error when timers would have fired)", () => {
    const { region, unmount } = renderAnnouncer();
    act(() => {
      captured("A");
      captured("B");
    });
    expect(region.textContent).toBe("A");
    unmount();
    // Advancing past every scheduled timer must not throw or setState on the unmounted region.
    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
  });

  it("is a safe no-op when used with no <Announcer> ancestor", () => {
    function Solo() {
      const announce = useAnnounce();
      return (
        <button type="button" onClick={() => announce("nobody listening")}>
          go
        </button>
      );
    }
    const { getByRole } = render(<Solo />);
    expect(() => fireEvent.click(getByRole("button"))).not.toThrow();
  });
});
