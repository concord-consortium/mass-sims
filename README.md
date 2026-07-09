# Mass Sims

Educational science simulations monorepo. Each simulation is a standalone, statically deployed web app built on a shared component library and a reusable starter template.

## Status

Under active development. The shared library, the `starter` template, and the CI/CD + deployment pipeline are in place, and **Bananas** — the first full simulation — has shipped.

## Planning & Reference Documents

- **[Adding a new simulation](docs/adding-a-new-sim.md)** — the step-by-step for scaffolding a new sim from the Starter template.
- **[Infrastructure Plan](docs/infrastructure-plan.md)** — tooling, file structure, dependencies, build, CI/CD, deployment, the shared-library API surface. Source of truth for infrastructure decisions.
- **[UI Design Plan](docs/ui-design-plan.md)** — layout, dimensions, regions, responsive behavior, palette. Iterates on a different cadence than infrastructure.
- **[Accessibility conventions](docs/accessibility.md)** — the cross-cutting a11y rules every sim follows (the split disabled-control policy, the trials listbox, the single Announcer, focus management, known gaps).
- **[Playwright end-to-end tests](docs/playwright.md)** — the e2e suite conventions (page objects, the four-width matrix, the build contract, CI).
- **[Shared package README](packages/shared/README.md)** — API reference for the shared library (components, hooks, trial-list infra, utils, styles, build helpers) plus the SVG/icon import convention.

## Tech stack

- **React 19.2** + **TypeScript 6**
- **Vite 8** for build/dev
- **mobx-state-tree** (MST) for per-sim state (the trial list); shared trial-list infrastructure lives in `packages/shared`
- **react-aria-components** — every shared interactive control is a thin, token-styled wrapper around a react-aria primitive
- **Yarn 1.x workspaces + Lerna 4** for monorepo orchestration
- **Vitest 4** for unit tests, **Playwright** for E2E
- **Biome 2** for lint + format
- **Lefthook** for git precommit hooks
- **GitHub Actions + OIDC** → S3 (`models-resources/mass-sims/`)

## Quick start

```sh
# Install dependencies (and install lefthook hooks via postinstall)
yarn install

# Run a sim locally (Vite dev server, port 8080 — see the port note below)
yarn workspace bananas dev      # the first complete sim
yarn workspace starter dev      # the reusable template

# Build everything
yarn build

# Lint everything
yarn lint

# Typecheck everything (workspaces + the Playwright suite)
yarn typecheck

# Run unit tests (per-workspace Vitest)
yarn test

# Run the Playwright end-to-end suite (builds the sims first)
yarn test:playwright:build
```

> **Local ports.** Each sim's dev server (`yarn workspace <sim> dev`) and the Playwright preview
> servers both live in the 8080+ range, so a running dev server collides with the e2e suite. Stop the
> dev server before running e2e, or start it on another port (`yarn workspace <sim> dev --port 8100`).
> See [`docs/playwright.md`](docs/playwright.md) for the full conventions.

## Adding a new simulation

```sh
yarn new-sim <name>     # scaffold simulations/<name>/ from packages/starter
yarn install            # link the new workspace
yarn gen-index          # refresh the root index.html that lists every sim
yarn gen-workflows      # generate .github/workflows/sim-<name>.yml
```

See **[docs/adding-a-new-sim.md](docs/adding-a-new-sim.md)** for the full walkthrough (model/stores, saved-state wiring, logging, e2e coverage).

## Repository layout

```
mass-sims/
├── packages/
│   ├── shared/            Shared library (@concord-consortium/mass-sims-shared) — components, hooks, trial-list infra, styles
│   ├── starter/           Re-usable starter simulation template (scaffolded by `yarn new-sim`)
│   └── sim-frame-preview/ Dev-only preview of SimulationFrame at the four target widths (not deployed)
├── simulations/           Per-sim workspaces
│   └── bananas/           The first complete simulation
├── playwright/            E2E suite (registry, page objects, testdata, tests)
├── scripts/               new-sim, gen-index, gen-workflows, index-top/top-test build helpers
├── .github/workflows/     CI/CD (ci.yml, release.yml, per-sim sim-<name>.yml)
├── docs/                  Reference docs + historical build plans
├── index.html             Auto-generated landing page linking to each sim
├── biome.json             Lint + format config
├── lefthook.yml           Git precommit hooks
├── lerna.json             Monorepo orchestrator
├── playwright.config.ts   Playwright config (repo root)
├── tsconfig.base.json     Shared TS settings (extended by each workspace)
└── package.json           Yarn workspaces root
```

## Deployment

- Branch builds → `s3://models-resources/mass-sims/branch/<branch-name>/<sim-name>/`
- Tagged releases → `s3://models-resources/mass-sims/version/<tag>/<sim-name>/`
- Promotion of a tagged release to the top-level URL is a separate, deliberate step via the **Release** workflow (Actions → Release → Run workflow).

Each sim has its own generated `sim-<name>.yml` workflow, triggered when the sim's directory, `packages/shared/**`, or its workflow file changes. Per-repo IAM deploy role is created by running [`create-deploy-role.sh`](https://github.com/concord-consortium/starter-projects/blob/main/scripts/create-deploy-role.sh) from a `starter-projects` clone (see the infrastructure plan §8 for details).

## License

MIT — see [LICENSE](./LICENSE).
