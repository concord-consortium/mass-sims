// Phase 1 verification — placeholder sim #1.
// The `import testImage from "./assets/test-image.png"` and the <img> below exist to verify
// that the dynamic publicPath / index-top.html pattern resolves asset URLs correctly. The
// imported value is a runtime expression (Vite's `experimental.renderBuiltUrl` emits
// `new URL("../" + "assets/test-image-<hash>.png", import.meta.url).href`), so when this
// bundle is loaded from /mass-sims/version/v1.2.3/sim-one/assets/main-<hash>.js — whether
// via the per-version HTML or via the promoted top-level HTML at /mass-sims/sim-one/ — the
// image URL still resolves to /mass-sims/version/v1.2.3/sim-one/assets/test-image-<hash>.png.

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
