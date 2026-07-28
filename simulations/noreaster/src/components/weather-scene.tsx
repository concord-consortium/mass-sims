import { type RefObject, useRef } from "react";
import type { Outcome } from "../model/weather";
import { useWeatherAnimation } from "./use-weather-animation";
import type { SceneSpec } from "./weather-scenes";

import "./weather-scene.scss";

/**
 * The decorative Data-panel header weather scene — a thin, props-driven child (the panel resolves `scene`,
 * `animate`, and the refs). The backdrop is a CSS gradient selected by `data-scene` (`"default"` renders
 * nothing); the particles ride a transparent `<canvas>` driven by `useWeatherAnimation`. `data-animate`
 * gates the appearance transition (fade vs. instant). The subtree is `aria-hidden` — decorative; every
 * attribute is still named in the table. The hook measures via `panelRef`, not this out-of-flow layer.
 */
export function WeatherScene({
  scene,
  outcome,
  animate,
  panelRef,
}: {
  scene: SceneSpec;
  outcome: Outcome | null;
  animate: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWeatherAnimation(canvasRef, panelRef, scene);

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
