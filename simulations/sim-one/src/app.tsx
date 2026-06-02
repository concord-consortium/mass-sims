// Phase 1 verification — placeholder sim #1. The test image import below is a canary for
// the dynamic publicPath pattern (see docs/infrastructure-plan.md §8). Removed when
// Phase 1 lands real assets.

import testImage from "./assets/test-image.png";

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
      <p>If you can see the test image below, the dynamic-publicPath asset resolution works.</p>
      <img src={testImage} alt="Asset URL verification test" style={{ width: "100%" }} />
      <p>
        <small>
          Build info: {import.meta.env.MODE} mode · base path{" "}
          <code>{import.meta.env.BASE_URL}</code>
        </small>
      </p>
    </main>
  );
}
