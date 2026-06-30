# Mass Sims

Educational science simulations monorepo. Each simulation is a standalone, statically deployed web app built on a shared component library and a reusable starter template.

## Status

Phase 0 (repo bootstrap). The scaffold exists; the first hello-world deploy is the next milestone.

## Planning documents

- **Infrastructure Plan** (`docs/infrastructure-plan.md`) — tooling, file structure, dependencies, build, CI/CD, deployment, transferability. Source of truth for infrastructure decisions.
- **UI Design Plan** (`docs/ui-design-plan.md`) — layout, dimensions, regions, responsive behavior, palette. Iterates on a different cadence than infrastructure.

## Tech stack

- **React 19.2** + **TypeScript 6**
- **Vite 6+** for build/dev (replaces Webpack from FOSS reference repo)
- **Yarn 1.x workspaces + Lerna 4** for monorepo orchestration
- **Vitest** for unit tests, **Playwright** for E2E
- **Biome** for lint + format (replaces ESLint + Prettier)
- **Lefthook** for git precommit hooks
- **GitHub Actions + OIDC** → S3 (`models-resources/mass-sims/`)

## Quick start

```sh
# Install dependencies (and install lefthook hooks via postinstall)
yarn install

# Run the starter sim locally (Vite dev server, port 8080 — see the port note below)
yarn workspace starter dev

# Build everything
yarn build

# Lint everything
yarn lint

# Typecheck everything
yarn typecheck

# Run the Playwright end-to-end suite (builds the sims first)
yarn test:playwright:build
```

> **Local ports.** Each sim's dev server (`yarn workspace <sim> dev`) and the Playwright preview
> server both default to port 8080, so a running dev server collides with the e2e suite. Stop the
> dev server before running e2e, or start it on another port (`yarn workspace <sim> dev --port 8100`).
> See [`docs/playwright.md`](docs/playwright.md) for the full conventions.

## Repository layout

```
mass-sims/
├── packages/
│   ├── shared/        Shared component library (@concord-consortium/mass-sims-shared)
│   └── starter/       Re-usable starter simulation template
├── simulations/       Per-sim workspaces (scaffolded from packages/starter)
├── .github/workflows/ CI/CD (build, test, OIDC-based S3 deploy)
├── biome.json         Lint + format config
├── lefthook.yml       Git precommit hooks
├── lerna.json         Monorepo orchestrator
├── tsconfig.base.json Shared TS settings (extended by each workspace)
└── package.json       Yarn workspaces root
```

## Deployment

- Branch builds → `s3://models-resources/mass-sims/branch/<branch-name>/<sim-name>/`
- Tagged releases → `s3://models-resources/mass-sims/version/<tag>/<sim-name>/`

Per-repo IAM deploy role is created by running [`create-deploy-role.sh`](https://github.com/concord-consortium/starter-projects/blob/main/scripts/create-deploy-role.sh) from a `starter-projects` clone (see the infrastructure plan §8 for details).

## License

MIT — see [LICENSE](./LICENSE).
