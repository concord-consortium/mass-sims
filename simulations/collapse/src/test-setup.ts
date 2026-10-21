// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
// on Vitest's expect, and — because this file is in the tsconfig include — provides the
// global type augmentation so those matchers typecheck in *.test.tsx files.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, Testing Library does not auto-register its `afterEach(cleanup)`
// (it only does so when it detects injected test-runner globals). Without this, rendered
// DOM accumulates across tests and queries like `getByRole` match elements from prior
// tests. Register cleanup explicitly so each test starts from a clean document.
afterEach(() => {
  cleanup();
});
