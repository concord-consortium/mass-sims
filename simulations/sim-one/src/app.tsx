// Phase 1 verification — placeholder sim #1.
// Exists alongside sim-two to prove the multi-sim monorepo deploy pattern works.
// Replaced by real content in a later phase.

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
      <h1>Mass Sims — Sim One</h1>
      <p>Phase 1 deploy verification. If you can read this, the first-sim deploy pipeline works.</p>
      <p>
        <small>
          Build info: {import.meta.env.MODE} mode · base path{" "}
          <code>{import.meta.env.BASE_URL}</code>
        </small>
      </p>
    </main>
  );
}
