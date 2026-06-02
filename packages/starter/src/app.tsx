// Starter scaffold — `packages/starter` is the template `yarn new-sim` (Phase 1) will
// copy to bootstrap a new sim. Not deployed by CI; not part of any user-facing build.
// Replace this file's contents when scaffolding a real sim from the template.

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
