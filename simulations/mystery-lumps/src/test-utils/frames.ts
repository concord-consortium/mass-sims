import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Drives `requestAnimationFrame` by hand.
 *
 * jsdom never paints, so anything built on `useFrameLoop` can only ever be observed in its
 * initial state. A test that asserts "the bar has not moved" therefore passes whether or not
 * the code that holds it still exists. Stub the clock with `stubFrames()` in a `beforeEach`
 * and advance it with `paint()` to test those components for real.
 */
let pending: FrameRequestCallback[] = [];

export function stubFrames(): void {
  pending = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => pending.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
}

/** Runs every frame callback queued so far, as if the browser painted at `timestampMs`. */
export function paint(timestampMs: number): void {
  const due = pending;
  pending = [];
  act(() => {
    for (const cb of due) cb(timestampMs);
  });
}
