import { svgrPlugin } from "@concord-consortium/mass-sims-shared/vite-config";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svgrPlugin(), react()],
  server: { port: 8090, open: false },
});
