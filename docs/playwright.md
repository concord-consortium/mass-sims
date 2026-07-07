# Playwright end-to-end tests

The `playwright/` suite drives the **built** sims in a real browser across the four canonical
viewport widths. It complements the per-workspace Vitest unit tests: Vitest covers model/reducer/
view logic in isolation; Playwright covers the assembled app — shared chrome, controls, cross-panel
behavior — against the same static artifacts users get.

- **Config:** [`playwright.config.ts`](../playwright.config.ts) at the **repo root**.
- **Suite:** [`playwright/`](../playwright/) — `sims.ts` (registry), `pages/` (page objects),
  `testdata/`, `tests/smoke/`, `tests/functional/`.
- **Browser:** Chromium only.

## Running locally

| Command | What it does |
| --- | --- |
| `yarn test:playwright:build` | **Full cycle** — builds every sim, then runs the suite. Use this most of the time. |
| `yarn test:playwright` | Runs the suite **assuming `dist/` already exists** (it does NOT build). Fast iteration after a build. |
| `yarn test:playwright:open` | Playwright UI mode (watch + time-travel debugging). |
| `yarn test:playwright --project=chromium-1044` | One viewport only (fastest iteration). |
| `yarn test:playwright playwright/tests/smoke` | One tier (smoke / functional). |
| `yarn playwright:install` | Install the Chromium binary (once per machine / after a Playwright bump). |
| `yarn typecheck:playwright` | Type-check the suite (`tsc -p playwright/tsconfig.json`). |

First-time setup: `yarn playwright:install`.

## The build contract

`yarn test:playwright` **never builds.** The `webServer` config only runs `vite preview` against
each sim's pre-built `dist/`. So either:

- run `yarn test:playwright:build` (builds then runs), or
- run `yarn build && yarn test:playwright`, or
- in CI, the `playwright` job runs `yarn build` as an explicit step before `yarn test:playwright`.

Testing the **built artifacts** (not the dev server) is deliberate: `vite dev` and `vite preview`
are different code paths, and the e2e suite is where preview-only bugs surface.

`reuseExistingServer: false` everywhere — Playwright always launches its own preview servers and
never reuses one already on the port. This means **you must stop any `vite dev`/`preview` server
on ports 8080–8081 before running e2e** (a stray server makes Playwright fail loudly with
"port already in use" rather than silently testing the wrong app).

## Architecture

- **Config at the repo root** so `playwright test` discovers it with no `--config=` flag. Only
  tests / page objects / testdata / the registry live under `playwright/`.
- **The sims registry is the single source of truth.** [`playwright/sims.ts`](../playwright/sims.ts)
  maps each sim to a preview port; the URL is *derived* (`getSimUrl(name)`), never stored, so a
  port and its URL can't drift. Both `playwright.config.ts` (for `webServer`) and every page
  object's `goto()` read from it.

  | Sim | Port |
  | --- | --- |
  | starter | 8080 |
  | bananas | 8081 |
  | _(new sims)_ | next free port, assigned automatically by `yarn new-sim` |

- **No `baseURL`.** Different specs target different sims at different ports; a single `baseURL`
  would silently route one sim's tests at another the moment a page object forgot to be explicit.
  Every page object navigates explicitly via `getSimUrl(name)`.

  > ⚠️ **Don't add a `baseURL` to make a relative `page.goto('/')` work.** A relative goto failing
  > ("Cannot navigate to invalid URL") is *expected* — the fix is to navigate via the page object's
  > `goto()` (which resolves the sim's URL from the registry), **not** to add a `baseURL`. A
  > `baseURL` would make a forgotten/relative navigation silently hit whichever sim it points at,
  > which is the exact cross-sim routing hazard this design avoids.
- **Page objects are classes.** [`SimulationFramePage`](../playwright/pages/simulation-frame-page.ts)
  is the shared-chrome base (header, About modal, three slots); each sim subclasses it
  (`StarterPage`, `BananasPage`) with its own controls **and its own `goto()`** (the base has no
  canonical URL, so it has no `goto()`).
- **Test data re-exports the source constants, never duplicates them.** Each sim has a
  `<sim>-testdata.ts`. The trial-list constants (`TRIAL_LETTERS`, `MAX_TRIALS`) live in the
  **shared package** that all sims build on, so for example,
  [`starter-testdata.ts`](../playwright/testdata/starter-testdata.ts) and
  [`bananas-testdata.ts`](../playwright/testdata/bananas-testdata.ts) both re-export them from
  `packages/shared/src/trials/constants`; Bananas additionally re-exports its own catalogs (parent
  ids/labels, `MAX_CROSSES`). Catalogs grow with the sim, so specs pick up new entries for free.
  Every imported module is **pure** (no React / vite-svg / scss), which is why importing into the
  Playwright-run suite is safe. Note the shared constants are imported via a **direct path to the
  pure `constants` module**, not the package barrel (the barrel pulls in component scss/svg
  side-effects the Playwright tsconfig can't resolve). Behavior-defining caps are imported **and**
  asserted against literals in the smoke spec (`expect(MAX_TRIALS).toBe(10)`,
  `expect(MAX_CROSSES).toBe(6)`) so an accidental change surfaces immediately.
- **Locator strategy:** prefer accessible queries (`getByRole` / `getByLabel` / `getByText`); fall
  back to CSS class selectors only for elements with no good accessible name (e.g. the active-trial
  badge, the status pill, the visually-hidden fungus `<input>`). Each test is isolated — a fresh
  `goto()` per `test.beforeEach`, no shared state (standalone mode has no persistence, so a fresh
  load is a clean slate).

## Ports: preview vs dev server

There are **two separate ports per sim**, configured in **two different places**, and they can
collide:

| Port | Used by | Configured in |
| --- | --- | --- |
| **Preview port** | Playwright's `webServer` (`vite preview`) | [`playwright/sims.ts`](../playwright/sims.ts) — starter 8080, bananas 8081 |
| **Dev-server port** | `yarn workspace <sim> dev` (`vite`) | each sim's `vite.config.ts` (`createSimViteConfig({ port: … })`) — currently **8080 for every sim** |

Today both default to 8080 for Starter, so **`yarn workspace starter dev` and the e2e suite's
Starter preview both want 8080** — they can't run at the same time. (The two sims' dev servers also
both default to 8080, so only one dev server can run at a time regardless of e2e.)

Because `reuseExistingServer: false`, Playwright launches its own preview servers and won't reuse a
stray one — a collision fails loudly ("port already in use") rather than silently testing the wrong
app. So before running `yarn test:playwright`, either:

- **stop your dev server(s)** on 8080–8081, or
- **run the dev server on a different port** so it doesn't overlap the preview range:
  `yarn workspace <sim> dev --port 8100`.

> A fully zero-config fix (Playwright discovering a randomly-chosen preview port, so ports never
> need coordinating) is a tracked follow-up — it needs server-discovery infrastructure Vite doesn't
> provide out of the box. For now, the two rules above are the contract.

## The four-width matrix

The suite runs once per Chromium project at **1044 / 1024 / 989 / 767** (all × 562 height) — the AP
allocation widths. The same specs run four times; Playwright reports per-project pass/fail. This
catches width-responsive layout regressions ("this control doesn't fit at 767") cheaply. A test that
passes at 1044 but fails at 767 is usually a **real product bug**, not a test-scope problem.

**Standalone-mode caveat:** standalone rendering adds a 2 px / 10 px-radius outer container, so the
sim content area is a few pixels narrower than the raw viewport. This is fine for behavioral
coverage (a few pixels doesn't change which controls fit), but these tests are **not** AP-pixel-
perfect — visual/pixel-precise coverage is deferred (see below).

## The reload-warning pattern

Standalone sims arm a "leave site?" warning by registering a `beforeunload` handler that calls
`preventDefault()` (the shared `useReloadWarning` hook). The base-class helper
`assertReloadWarning(expected)` detects this by dispatching a **synthetic cancelable `beforeunload`
event in-page** and reading `defaultPrevented`.

We do **not** use `page.close({ runBeforeUnload: true })` + a `dialog` listener: under Playwright
tracing (UI mode / `--trace on`) the instrumented close surfaces a spurious `beforeunload` dialog
even on a clean page, giving the negative case a false positive. The synthetic-dispatch approach is
deterministic and mode-independent because it never closes the page or depends on a dialog.

For **Starter** specifically, the warning is gated on a trial running to **completion**
(`output !== null`), not merely starting — so the positive test drives a trial to completion first
via `completeOneTrial()` (shorten the run via the on-page NumberField, then Step to the end).

## The trial-selector pattern

All sims render their Trials column as a single-select **listbox**: a `role="listbox"` container
(`aria-orientation="vertical"`, `aria-label="Trials"`) holds the trial cards as `role="option"`
elements. The `+ New` card and max-trials notice are siblings *outside* the listbox — a listbox must
not own focusable non-options. Cards carry `aria-selected`, roving tabindex (only the selected card
is tabbable), and an enriched accessible name (e.g. Starter's "Trial A. Walker count 50, step size
1").

Page objects expose this via `trialsListbox`, `trialOption(letter)` (matched on the leading "Trial
X", since the accessible name is enriched), `newTrialCard` (accessible name **"Add new trial"**),
`maxTrialsNotice`, and `focusedAriaLabel()` for roving-tabindex keyboard-nav asserts. Keyboard
contract: Up/Down move focus **and** selection to the adjacent card and **wrap** (last→first,
first→last); Home/End jump to first/last; Left/Right are ignored (vertical orientation). At the cap,
`+ New` is replaced by a plain-text notice (the trials-reached announcement is narrated once via the
shared `<Announcer>`, not an inline live region).

Each sim also emits `trial_added` / `trial_selected` / `trial_reset` log events on these mutations.
The e2e suite doesn't assert log payloads (that's unit-test territory) — it covers the visible/ARIA
behavior, and the trial-selector locators above are the page-object surface a new sim inherits from
Starter.

### Keyboard focus & scrollable regions

Scrollable regions (the Trials list, the About modal body, and a sim's own scrollers such as Bananas'
offspring grid) become keyboard-operable only while they actually overflow: the shared
`useScrollFocusRing` hook adds `tabindex="0"` when `scrollHeight > clientHeight` and removes it
otherwise, and a sibling `.scroll-focus-ring` draws an inset ring on `:focus-visible`. A shared
`Section` opts in via its `scrollFocusRing` prop (already set on the Trials column, so every sim
inherits it). The base `SimulationFramePage` exposes `trialsScrollRegion`, `modalBody`, and
`overflows(locator)` (the in-page `scrollHeight > clientHeight` check) so a focus test asserts the
overflow precondition rather than assuming layout. To assert a `:focus-visible` ring or react-aria's
`data-focus-visible` in a real browser, establish keyboard modality with the `focus()` →
`Shift+Tab` → `Tab` round-trip (programmatic `.focus()` alone does not set focus-visible).

Custom toggles should activate on **both** Space and Enter. react-aria's Switch handles Space
(native checkbox) but not Enter; Bananas' Fungus switch adds an Enter-only `onKeyDown` (Space stays
with react-aria to avoid a double toggle). The exactly-once property is testable without observing
outlines: one keypress must flip the `role="switch"` checked state (a double toggle nets to a no-op).

## Adding a new sim

`yarn new-sim <name>` wires up e2e coverage automatically (no manual steps): it appends a
`{ name, port }` entry to `playwright/sims.ts` with the next free port, copies the Starter page
object to `playwright/pages/<name>-page.ts` (class name + registry key substituted), and copies the
Starter smoke spec to `playwright/tests/smoke/<name>.test.ts` (class name + import path + the
`"<NEW SIM TITLE>"` placeholder substituted). The new sim's `webServer` entry materializes from the
registry append, so the spec runs with zero extra config.

After scaffolding, customize the page object's locators and update the `"<NEW SIM TITLE>"` assertion
in the smoke spec to your real title, then `yarn test:playwright:build playwright/tests/smoke/<name>.test.ts`
(note: `:build` — a brand-new sim has no `dist/` until it's built).

## CI

The `playwright` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs after
`checks`: it type-checks the suite, builds every sim, installs Chromium, runs `yarn test:playwright`,
and publishes the HTML report to S3 (`…/mass-sims/playwright-report/<branch-or-tag>/`) with a run
summary on every push (pass or fail). A failing e2e run does **not** block branch deploys — those
are separate jobs gated only on `checks`.

## Troubleshooting

- **"port 8080/8081 already in use"** — a `vite dev`/`preview` server (or an interrupted prior e2e
  run) is holding the port. Stop it: `lsof -ti:8080 -ti:8081 | xargs kill`. This is `reuseExistingServer:
  false` working as intended — it refuses to silently test against the wrong server.
- **Reload-warning test flaky** — it shouldn't be (the synthetic-dispatch detection is
  deterministic). If it ever is, the unit-level `useReloadWarning` coverage is the source of truth;
  mark the e2e test `test.fixme()` and rely on that.
- **A test passes at 1044 but fails at a narrower width** — treat it as a real responsive-layout bug
  to investigate, not something to paper over with a per-project `test.skip()`.
