// Adds the jest-dom matchers to Vitest's `expect`. This file is in the tsconfig include, so it also
// gives test files the matchers' types.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, Testing Library doesn't register its own `afterEach(cleanup)`, so rendered
// DOM would leak from one test into the next.
afterEach(() => {
  cleanup();
});

// jsdom has no `ResizeObserver`; the timeline observes its track for re-layout.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no Web Animations API; the data table's row slides use it. No-op stand-ins, which the
// slide tests replace with spies.
Element.prototype.getAnimations ??= () => [];
Element.prototype.animate ??= () => ({ cancel() {} }) as Animation;
