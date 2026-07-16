# CLAUDE.md

Operational cheat-sheet for working in this repo. Keep it lean — it points at the docs rather than
restating them, so it stays current. When a convention changes, update the linked doc; only update
here if a *command* or *gotcha* changes.

Mass Sims is a Yarn-workspaces + Lerna monorepo of standalone, statically-deployed educational
simulations built on a shared library. `packages/shared` (the library), `packages/starter` (the
template `yarn new-sim` copies), and `simulations/*` (the sims; **bananas** is the first complete one).

## Commands

- `yarn build` / `yarn test` / `yarn lint` / `yarn typecheck` — whole repo (Lerna fans out).
- `yarn workspace <name> test` / `dev` / `build` — one workspace.
- **`/__preview` on any sim's dev server** — that sim at all four target widths at once (real
  interactive iframes), flagging content that overflows its allocation, clipped text, and elements
  escaping the frame. Dev-only, zero per-sim setup; the URL is printed in the Vite banner.
- `yarn test:playwright:build` — build every sim **then** run e2e. Use this most of the time.
- `yarn test:playwright` — runs e2e assuming `dist/` already exists (does **not** build).
- `yarn new-sim <name>` — scaffold a sim from `packages/starter`. Then `yarn install`.
- `yarn gen-index` / `yarn gen-workflows` — regenerate the root `index.html` and per-sim CI workflows.

## Gotchas that actually bite

- **Ports collide.** A sim's dev server (`yarn workspace <sim> dev`) and Playwright's preview servers
  both want ports 8080+. Stop the dev server before running e2e, or run it on another port
  (`--port 8100`).
- **Regenerated files must be committed.** `gen-index` and `gen-workflows` have `--check` modes CI runs
  on every push — a stale root `index.html` or a missing `.github/workflows/sim-<name>.yml` **fails CI**.
  Run both and commit their output when adding a sim.
- **Playwright testdata imports the pure `constants` module, not the barrel.** The package barrel pulls
  in component scss/svg side-effects the Playwright tsconfig can't resolve. Import trial-list constants
  from `packages/shared/src/trials/constants` directly.
- **e2e tests the built artifacts, not the dev server** — `vite dev` and `vite preview` are different
  code paths. `reuseExistingServer: false`, so a stray server makes Playwright fail loudly.
- **Biome minor version is pinned on purpose.** The config schema shifts across minors; bump the
  `$schema` URL in `biome.json` in the same commit as the package bump.
- **The four target widths live in two places.** `packages/shared/src/layout/target-widths.ts`
  is the TypeScript source of truth (the width preview + `playwright.config.ts`'s project matrix both
  read it); `tokens.scss` carries its own copy. Change one, change the other.

## Conventions not obvious at a glance

- **Shared controls are thin `react-aria-components` wrappers.** Import controls from the
  `@concord-consortium/mass-sims-shared` barrel; do **not** add `react-aria-components` to a sim. Needing
  an unwrapped primitive is the signal to add a wrapper. Controls auto-emit a log event when given an
  `action` (snake_case) prop.
- **Styling is plain (global) SCSS scoped under a single root class** (e.g. `.button { … }`) — no CSS
  Modules, no `styles.x` mapping. Tokens come from `@use "…/styles/tokens"`; nothing outside
  `tokens.scss` hard-codes color/size/spacing.
- **Tests import from `"vitest"` explicitly** (`globals: false`). No injected globals.
- **State split:** MST owns the trial **list** (what trials exist, which is selected, each trial's
  recorded result); `useModelState` owns the **per-frame transient state** of the running trial. Don't
  merge them.
- **Accessibility is a first-class contract** — the trials column is a `listbox`/`option` with roving
  tabindex, narration goes through one `<Announcer>`, disabled controls follow a deliberate split. See
  the accessibility doc before touching ARIA.

## Docs map

- [README.md](./README.md) — overview, quick start, layout, deployment.
- [docs/adding-a-new-sim.md](./docs/adding-a-new-sim.md) — scaffolding a sim end-to-end (model, stores,
  saved-state, logging, e2e).
- [docs/infrastructure-plan.md](./docs/infrastructure-plan.md) — tooling, build, CI/CD, deployment, the
  shared-library API surface. Source of truth for infrastructure decisions.
- [docs/ui-design-plan.md](./docs/ui-design-plan.md) — layout, dimensions, regions, palette, tokens.
- [docs/accessibility.md](./docs/accessibility.md) — the cross-cutting a11y conventions every sim follows.
- [docs/playwright.md](./docs/playwright.md) — e2e suite conventions.
- [packages/shared/README.md](./packages/shared/README.md) — shared-library API reference (components,
  hooks, trial-list infra, utils, styles, build helpers) + the SVG import convention.
