import { svgrPlugin } from "@concord-consortium/mass-sims-shared/vite-config";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svgrPlugin(), react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
