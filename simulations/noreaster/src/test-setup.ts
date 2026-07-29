// Registers @testing-library/jest-dom matchers on Vitest's `expect` (plus the global type augmentation for
// `*.test.tsx`, since this file is in the tsconfig include).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no 2D canvas context (`getContext` logs a "Not implemented" error). The weather scene renders a
// `<canvas>`; stub `getContext` → `null` so component/panel tests hit the hook's no-op path. The
// hook-lifecycle suite installs its own non-null mock.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

// With `globals: false`, Testing Library doesn't auto-register `afterEach(cleanup)`; do it explicitly so the
// DOM doesn't leak between tests.
afterEach(() => {
  cleanup();
});
