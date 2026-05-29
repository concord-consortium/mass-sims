// Phase 0 hello-world. Intentionally bare:
//   - Confirms React 19 renders.
//   - Confirms the Vite build emits relative-path assets (see vite.config.ts `base: "./"`).
//   - Confirms the CI deploy lands the bundle at the expected S3 path and loads correctly.
//
// Phase 1 replaces this with a real <SimulationFrame> demo from the shared library.

export function App() {
  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "2rem",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <h1>Mass Sims — Starter</h1>
      <p>Phase 0 hello-world. If you can read this, the build + deploy loop works.</p>
      <p>
        <small>
          Build info: {import.meta.env.MODE} mode · base path{" "}
          <code>{import.meta.env.BASE_URL}</code>
        </small>
      </p>
    </main>
  );
}
