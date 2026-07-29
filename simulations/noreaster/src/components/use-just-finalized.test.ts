import { render } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { describe, expect, it } from "vitest";
import type { Outcome } from "../model/weather";
import { useJustFinalized } from "./use-just-finalized";

/**
 * The fade-vs-instant decision in isolation. Through the panel each case needs a store, a provider and
 * StrictMode; here the hook's whole branch matrix — token changed × outcome changed × outcome null — is a few
 * lines. The panel tests keep the integration coverage. A `Probe` renders the boolean so re-renders can drive
 * the render-phase state machine exactly as the panel does.
 */
function Probe({ outcome, token }: { outcome: Outcome | null; token: number }) {
  const animate = useJustFinalized(outcome, token);
  return createElement("span", { "data-testid": "animate" }, String(animate));
}
const probe = (outcome: Outcome | null, token: number) => createElement(Probe, { outcome, token });
const read = (c: HTMLElement) => c.querySelector('[data-testid="animate"]')?.textContent;

describe("useJustFinalized", () => {
  it("does not animate on first mount (no prior finalization to compare against)", () => {
    const { container } = render(probe(null, 0));
    expect(read(container)).toBe("false");
  });

  it("animates only when the token advances AND the outcome changes (a real Run)", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 1));
    expect(read(container)).toBe("true");
  });

  it("stays instant on replay: token advances but the outcome is unchanged", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 1)); // fade in
    rerender(probe("strong", 2)); // replay same trial
    expect(read(container)).toBe("false");
  });

  it("stays instant on trial-switch: the outcome changes but the token does not", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 1));
    rerender(probe("fair", 1)); // switch to an already-run trial B
    expect(read(container)).toBe("false");
  });

  it("stays instant on hydration: an outcome appears with no token bump", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 0)); // saved state arrives
    expect(read(container)).toBe("false");
  });

  it("stays instant on Reset: the outcome clears with no token bump", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 1)); // fade in
    rerender(probe(null, 1)); // Reset — must NOT fade out
    expect(read(container)).toBe("false");
  });

  it("latches the fade across an unrelated re-render (flipping data-animate would cancel the fade)", () => {
    const { container, rerender } = render(probe(null, 0));
    rerender(probe("strong", 1));
    expect(read(container)).toBe("true");
    rerender(probe("strong", 1)); // same props, e.g. a parent re-render mid-fade
    expect(read(container)).toBe("true");
  });

  it("is StrictMode-safe: the double-invoked render still resolves the edge to a single fade", () => {
    const { container, rerender } = render(createElement(StrictMode, null, probe(null, 0)));
    rerender(createElement(StrictMode, null, probe("strong", 1)));
    expect(read(container)).toBe("true");
  });
});
