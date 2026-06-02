import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `globals: false` matches the project-wide convention — tests always import from
// "vitest" rather than relying on injected globals (see Addendum A.2 of the plan).

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
