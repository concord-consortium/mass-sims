// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
// on Vitest's expect, and — because this file is in the tsconfig include — provides the
// global type augmentation so those matchers typecheck in *.test.tsx files.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom doesn't implement ResizeObserver. Provide a synchronous mock that fires once on
// .observe() with a default width, so any component that gates rendering on width > 0 (per the
// LineChart container-ref pattern) has its SVG mounted by the time render() returns and queries.
class MockResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe() {
    this.cb(
      [
        {
          contentRect: {
            width: 300,
            height: 0,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof globalThis.ResizeObserver;

// With `globals: false`, Testing Library does not auto-register its `afterEach(cleanup)`
// (it only does so when it detects injected test-runner globals). Without this, rendered
// DOM accumulates across tests and queries like `getByRole` match elements from prior
// tests. Register cleanup explicitly so each test starts from a clean document.
afterEach(() => {
  cleanup();
});
