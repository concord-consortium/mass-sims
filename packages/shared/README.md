# @concord-consortium/mass-sims-shared

Shared components, hooks, styles, and build helpers for Mass Sims. The package is consumed as source — its `exports` point at `src/` — so each sim's Vite build and Vitest run transforms this package's TypeScript directly.

## SVG / icon imports

Two import styles, chosen by what the SVG is for:

| Import | Resolves to | Use for |
| --- | --- | --- |
| `import url from "./icon.svg"` | a hashed URL string | multi-color / brand art rendered via `<img src={url}>` (e.g. the DESE + Concord Consortium logos) |
| `import Icon from "./icon.svg?react"` | a React component | monochrome icons that need to be themed |

A `?react` icon should paint with `fill="currentColor"` in the asset, so the rendered glyph takes its color from its container's CSS `color`. That's how a sim recolors an icon without touching the shared asset — e.g. the Bananas About panel themes its info/close glyphs by setting `color` on `.modal-header-icon` / `.modal-close-icon`.

```tsx
import InfoIcon from "../assets/info-icon.svg?react"; // <svg><path fill="currentColor" …/></svg>

<InfoIcon className="modal-header-icon" aria-hidden="true" />;
```

```scss
.modal-header-icon {
  color: #5c4813; // recolors the glyph
}
```

### Build wiring

The `?react` transform comes from `vite-plugin-svgr`, exposed as `svgrPlugin()` in [`src/vite-config.ts`](./src/vite-config.ts) (svgo is disabled so `fill="currentColor"` and the `viewBox` survive untouched). Because these imports live in this package's source, **every** consumer that bundles or tests it needs the plugin:

- **Vite build** — `createSimViteConfig()` already includes it; an inline config adds `svgrPlugin()` to its `plugins` array.
- **Vitest** — add `svgrPlugin()` to the jsdom config's `plugins` (needed by any test that renders a component using a `?react` import).
- **tsconfig** — add `"vite-plugin-svgr/client"` to `compilerOptions.types` so `tsc` resolves the `*.svg?react` module.

New sims scaffolded with `yarn new-sim` inherit all of this from the starter template, so no manual setup is required.
