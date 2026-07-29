import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { OUTCOMES, type Outcome } from "../model/weather";
import { WeatherScene } from "./weather-scene";

/**
 * `WeatherScene` DOM contract. Renders ONLY the scene layer — the panel-root `data-scene-theme` is asserted
 * in `data-panel.test.tsx` (a `WeatherScene`-only render has no parent panel to carry it). No pixel
 * assertions — canvas output isn't rendered in jsdom.
 */
function renderScene(outcome: Outcome | null, animate: boolean) {
  // A detached ref is fine: the hook only reads `panelRef.current` (null here → measure no-ops), and the
  // shared test-setup stubs `getContext("2d")` → null, so the animation takes its jsdom no-op path.
  const panelRef = createRef<HTMLDivElement>();
  return render(<WeatherScene outcome={outcome} animate={animate} panelRef={panelRef} />);
}

describe("WeatherScene", () => {
  it("marks the whole layer aria-hidden (decorative)", () => {
    const { container } = renderScene(null, false);
    expect(container.querySelector(".wo-scene")).toHaveAttribute("aria-hidden", "true");
  });

  it('sets data-scene to "default" when there is no outcome', () => {
    const { container } = renderScene(null, false);
    expect(container.querySelector(".wo-scene")).toHaveAttribute("data-scene", "default");
  });

  it("sets data-scene to the outcome key for each of the six outcomes", () => {
    for (const outcome of OUTCOMES) {
      const { container, unmount } = renderScene(outcome, false);
      expect(container.querySelector(".wo-scene")).toHaveAttribute("data-scene", outcome);
      unmount();
    }
  });

  it('sets data-animate to "fade" when animate is true and "instant" when false', () => {
    const fade = renderScene("strong", true);
    expect(fade.container.querySelector(".wo-scene")).toHaveAttribute("data-animate", "fade");
    fade.unmount();

    const instant = renderScene("strong", false);
    expect(instant.container.querySelector(".wo-scene")).toHaveAttribute("data-animate", "instant");
  });

  it("renders (canvas present) without throwing when the 2D context is absent — the null-context guard", () => {
    expect(() => renderScene("strong", true)).not.toThrow();
    const { container } = renderScene("strong", true);
    expect(container.querySelector(".wo-scene-canvas")).toBeInTheDocument();
  });
});
