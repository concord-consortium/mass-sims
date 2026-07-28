import { prefersReducedMotion, useFrameLoop } from "@concord-consortium/mass-sims-shared";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ARTBOARD_WIDTH, createWeatherPlayer, type WeatherPlayer } from "./weather-players";
import type { SceneSpec } from "./weather-scenes";

/**
 * Drives the Data-panel header weather scene — the particle systems in `weather-players.ts`, scheduled over
 * the shared `useFrameLoop`. Owns the lifecycle around that scheduler: canvas sizing + the DPR transform, the
 * reduced-motion / visibility gating, and start/stop/clear.
 *
 * Scheduling is a single `enabled` boolean (player + real 2D context + !reducedMotion + !hidden); pausing and
 * stopping fall out of it. Drawing uses a fixed 400px logical artboard, CSS-fitted with `object-fit:cover`;
 * the canvas backing store is `400 × min(DPR, 2)`, its height the measured header height (see `measure`).
 */

/** DPR clamp — cap the backing-store multiplier so hi-DPR tablets don't 2–3× raster for no gain. */
const MAX_DPR = 2;
/** Header height when layout / `ResizeObserver` is unavailable (jsdom). */
const FALLBACK_SCENE_HEIGHT = 120;

export function useWeatherAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
  scene: SceneSpec,
): void {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const heightRef = useRef(FALLBACK_SCENE_HEIGHT);
  const playerRef = useRef<WeatherPlayer | null>(null);

  // State (not just a ref) so `enabled` recomputes once the context is acquired; `null` (jsdom) keeps
  // `enabled` false → no frame scheduled.
  const [hasCtx, setHasCtx] = useState(false);
  // Initial snapshot; the `change` subscription below keeps it current for a mid-session OS toggle.
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  // Pause the loop while the tab is hidden.
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);

  // Measure the header (top of the 2nd `.wo-row` relative to the panel), size the layer + canvas, acquire the
  // 2D context, and apply the DPR transform.
  const measure = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Fall back to the constant when rows aren't laid out (jsdom).
    const rows = panel.querySelectorAll<HTMLElement>(".wo-row");
    let height = FALLBACK_SCENE_HEIGHT;
    if (rows.length >= 2) {
      const delta = rows[1].getBoundingClientRect().top - panel.getBoundingClientRect().top;
      if (delta > 0) height = delta;
    }
    heightRef.current = height;
    panel.style.setProperty("--wo-scene-height", `${height}px`);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // Only the backing store is sized here; the display height comes from CSS (`.wo-scene`), so no
    // `style.height`.
    const nextWidth = ARTBOARD_WIDTH * dpr;
    const nextHeight = Math.round(height * dpr);
    // Assign the backing store only when it changes — writing `canvas.width`/`height` (even to the same value)
    // wipes the bitmap and resets the transform, and the RO fires after the frame's draw, so an unconditional
    // reset would blank the just-drawn particles on a no-op (width-only) resize.
    const resized = canvas.width !== nextWidth || canvas.height !== nextHeight;
    if (resized) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    const ctx = ctxRef.current ?? canvas.getContext("2d");
    ctxRef.current = ctx;
    setHasCtx(ctx !== null); // drives `enabled` (false when null)
    // Re-apply the transform only when the resize reset it; a null context (jsdom) is a no-op.
    if (ctx && resized) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [panelRef, canvasRef]);

  // Re-measure on mount and every scene/outcome change: the panel is `height:100%`, so an outcome reflows the
  // header without resizing the panel (the RO wouldn't fire).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scene` is a deliberate re-measure trigger — the effect reads the DOM header height, which reflows with the outcome even though `measure` doesn't reference `scene` (same pattern as `useCondensedLabels`).
  useLayoutEffect(() => {
    measure();
  }, [measure, scene]);

  // (Re)build the player on scene change; clear on entry and exit. The canvas holds only particles, so a bare
  // rAF-cancel would freeze the last frame after Reset / trial-switch — clear it explicitly.
  useLayoutEffect(() => {
    playerRef.current = createWeatherPlayer(scene);
    const clear = () => {
      const ctx = ctxRef.current;
      if (ctx) ctx.clearRect(0, 0, ARTBOARD_WIDTH, heightRef.current);
    };
    clear();
    return clear;
  }, [scene]);

  // Observe the panel (not the out-of-flow scene) for width changes. Guarded for jsdom (no `ResizeObserver`).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [panelRef, measure]);

  // Subscribe to the media query's `change` (the shared snapshot util isn't reactive). Guarded for jsdom.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Pause when the tab is hidden; folded into `enabled` below.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const enabled = scene.player !== "none" && hasCtx && !reducedMotion && !hidden;

  // When motion stops for a non-scene-change reason (reduced-motion, hidden), wipe the leftover frame —
  // `useFrameLoop` only cancels the rAF.
  useEffect(() => {
    if (enabled) return;
    const ctx = ctxRef.current;
    if (ctx) ctx.clearRect(0, 0, ARTBOARD_WIDTH, heightRef.current);
  }, [enabled]);

  const draw = useCallback((deltaMs: number) => {
    const ctx = ctxRef.current;
    const player = playerRef.current;
    if (!ctx || !player) return;
    player.step(ctx, ARTBOARD_WIDTH, heightRef.current, deltaMs);
  }, []);

  useFrameLoop(draw, enabled);
}
