import { type RefObject, useRef } from "react";
import { sceneFor } from "../animation/weather-scenes";
import { useWeatherAnimation } from "../hooks/use-weather-animation";
import type { Outcome } from "../model/weather";

import "./weather-scene.scss";

/**
 * The decorative Data-panel header weather scene — a thin, props-driven child (the panel supplies `outcome`,
 * `animate`, and the refs). `outcome` is the single source: both the CSS backdrop (`data-scene`) and the
 * particle system (`sceneFor` → `useWeatherAnimation`) derive from it here, so the two can't disagree. The
 * backdrop is a CSS gradient (`"default"` renders nothing); the particles ride a transparent `<canvas>`.
 * `data-animate` gates the appearance transition (fade vs. instant). The subtree is `aria-hidden` —
 * decorative; every attribute is still named in the table. The hook measures via `panelRef`, not this layer.
 */
export function WeatherScene({
  outcome,
  animate,
  panelRef,
}: {
  outcome: Outcome | null;
  animate: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWeatherAnimation(canvasRef, panelRef, sceneFor(outcome));

  return (
    <div
      className="wo-scene"
      data-scene={outcome ?? "default"}
      data-animate={animate ? "fade" : "instant"}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="wo-scene-canvas" />
    </div>
  );
}
