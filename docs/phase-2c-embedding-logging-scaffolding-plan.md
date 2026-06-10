# Phase 2c — AP Embedding, Action Logging, react-aria Foundation, Scaffolding

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire Mass Sims into the Activity Player embedding contract; ship the dual-transport `useLogEvent` hook (portal-report via `@concord-consortium/lara-interactive-api` + GA4 via inline `gtag.js`); land the **react-aria-components** foundation with a shared `<Button>` as the first wrapper + migrate the Starter sim's existing Play / Pause / Step / Reset buttons onto it; ship the scaffolding scripts (`yarn new-sim`, `scripts/gen-workflows.ts`) that prepare the repo for 20+ sims. Cap with a manual Activity Player smoke test that exercises lara-interactive-api state sync and a logged event end-to-end.

**Architecture:** AP state sync is **not** wrapped in a custom shared hook — sims import `useInitMessage` and `useInteractiveState` from `@concord-consortium/lara-interactive-api` directly, matching established Concord Consortium convention across other CC repos. The library handles standalone-vs-embedded detection internally: when standalone, `useInitMessage()` stays `null` and `setInteractiveState()` is a no-op. The shared library's contribution to AP integration in this phase is documentation (infra plan §3 "AP state sync" subsection) and a worked example in `docs/adding-a-new-sim.md`, not a wrapper.

The one new shared hook is `useLogEvent`, which fans events out to two transports: lara-interactive-api's `log()` (for portal-report when embedded) and `window.gtag('event', …)` (for GA4 when `VITE_GA_PROPERTY_ID` is set at build time). The two transports are independent — each no-ops when its transport isn't configured. The gtag snippet is injected at build time by a tiny Vite plugin that lives in the shared library's `vite-config.ts`.

The **react-aria-components** foundation is documented in [infrastructure-plan.md §3 "Shared controls policy"](./infrastructure-plan.md): every shared interactive control is a thin wrapper around a react-aria primitive that (a) applies our tokens and SCSS, (b) wires `useLogEvent` auto-emit via an `action?: string` prop, and (c) forwards all other react-aria props unchanged. `<Button>` is the first such wrapper. After Phase 2c lands, Phase 3 ports the remaining controls (Slider, Switch, Select, Checkbox, NumberField) mechanically against this established pattern.

`yarn new-sim <name>` copies `packages/starter/` into `simulations/<name>/`, runs name/title substitution, and reminds the developer to run `yarn install` and `yarn gen-index`. (It does **not** edit the root `workspaces` list — the `simulations/*` glob picks up the new package automatically.) `scripts/gen-workflows.ts` generates a per-sim CI workflow file (`.github/workflows/sim-<name>.yml`) from a template so adding a sim doesn't require hand-editing CI — and the existing `ci.yml` becomes a cross-cutting "checks" job (lint / typecheck / test / gen-index --check / gen-workflows --check) decoupled from per-sim build+deploy.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, Vitest 4 + @testing-library/react (jsdom), plain (global) SCSS via side-effect imports scoped under a root class, `clsx` for class composition, Biome (lint/format), `tsx` for `.ts` scripts run from npm. New runtime additions in this phase: `react-aria-components ^1.18`, `iframe-phone ^1.3.1`, `@concord-consortium/lara-interactive-api ^1.9.4`. No new dev dependencies.

---

## Conventions discovered in the codebase (follow these exactly)

These were verified by reading the existing code. Honoring them keeps the diff idiomatic.

- **Tests import from `"vitest"` explicitly** — `globals: false` is set in every `vitest.config.ts`. Never rely on injected globals.
- **`@testing-library/jest-dom` is wired** via per-workspace `test-setup.ts` files referenced from `vitest.config.ts` `setupFiles`. Component tests use `toBeInTheDocument()` / `toHaveAttribute()` / `toHaveClass()` directly.
- **`@testing-library/user-event` is NOT installed.** Use `fireEvent` for clicks and keyboard. react-aria-components' `Button` listens for **pointer events** (it emits its own synthetic `PressEvent`), so prefer `fireEvent.click(el)` over `fireEvent.pointerDown(el)` in component tests — the click event triggers react-aria's press handling correctly in jsdom.
- **Hook tests use `@testing-library/react`'s `renderHook` + `act`** — see `packages/shared/src/hooks/*.test.ts` for the established style.
- **Component styles are plain (global) SCSS imported for side-effect** — `import "./button.scss";`, NOT `import styles from "./button.module.scss"`. JSX uses plain string class names composed with `clsx`. Scope every component's rules under a single root class.
- **Tokens accessed via `@use "../../styles/tokens" as tokens`** from a relative path inside shared-library SCSS, then `tokens.$foo`. The Starter (an external consumer) uses `@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens` instead.
- **The shared barrel** at `packages/shared/src/index.ts` re-exports everything sims import. New hooks and components are added there.
- **TS scripts** in `scripts/` use the `#!/usr/bin/env tsx` shebang and import via the `node:` prefix for built-ins. Run via `tsx scripts/foo.ts` in `package.json` scripts.
- **Biome formatting:** double quotes, semicolons, trailing commas "all", 2-space indent, 100-char lines, `always` arrow parens. Run `yarn lint:fix` before staging if unsure.
- **`@testing-library/react`'s `cleanup`** is registered globally in each workspace's `test-setup.ts` via `afterEach(cleanup)` — required because `globals: false` disables Testing Library's automatic cleanup.

---

## Scope guardrails (what this plan deliberately does NOT do)

- **No additional shared controls beyond `<Button>`.** Slider, Switch, Select, Checkbox, NumberField, Table, and graphing primitives are all Phase 3. The Starter's existing native HTML range/number inputs stay native HTML for now.
- **No automated Activity Player integration test.** Task 8's AP smoke test is **manual**: ship to a branch S3 path, load into a CC dev portal AP page, verify the round-trip by eye and via portal-report. A Playwright-based AP fixture is Phase 5.
- **No Storybook.** Established Phase 0 decision (#22).
- **No `@axe-core/react` integration.** Phase 3 or Phase 5.
- **No multi-sim per-workspace gen-workflows yet.** `gen-workflows` generates one `.github/workflows/sim-<name>.yml` per simulation directory in `simulations/`. `packages/starter` is a template and gets no workflow. `packages/sim-frame-preview` is a non-deployed dev tool and gets no workflow.
- **No theme variants on `<Button>`.** The button has `variant?: "primary" | "secondary"` mapped to the token palette; no dark mode, no custom themes.
- **No Recharts / Visx / charting library decision.** Q19 in UI design plan §15 still open; first sim that needs charting forces it.
- **No custom AP state-sync hook in shared.** Sims use lara-interactive-api's `useInitMessage` / `useInteractiveState` directly. If a future sim needs a raw `iframe-phone` channel (outside lara-interactive-api's vocabulary), that's an additive change.
- **No persistence to localStorage / sessionStorage.** Out of scope (and the demo design didn't ask for it).
- **No Starter migration of the "+ New" trial card to `<Button>`.** That card is a sim-specific composite with distinct styling; it stays a native `<button>` until Phase 3 introduces a TrialCard-aware add affordance or a more general dashed-card primitive.

---

## Task 0: Confirm branch + green baseline

**Files:** none (git + verification only).

**Step 1: Confirm the branch**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
git branch --show-current
```

Expected: a fresh Phase 2c branch (e.g. `phase-2c-embedding-logging`) branched off `main` (after Phase 2b merges) or off the Phase 2b branch `phase-2b-starter-sim` if 2b is still in review.

**Step 2: Confirm baseline is green BEFORE any changes**

```bash
yarn typecheck && yarn lint && yarn test && yarn gen-index --check
```

Expected: all pass. If anything fails here, STOP and report — pre-existing failure.

---

## Task 1: Add react-aria-components, iframe-phone, lara-interactive-api deps

Land the three new runtime dependencies on the shared library so Tasks 2–4 can import them. No code changes yet beyond `package.json` and the lockfile.

**Files:**
- Modify: `packages/shared/package.json`

**Step 1: Add the deps**

In `packages/shared/package.json`, add to the `"dependencies"` block (alphabetical order alongside existing `clsx` and `seedrandom`):

```json
"dependencies": {
  "@concord-consortium/lara-interactive-api": "^1.9.4",
  "clsx": "^2.1.1",
  "iframe-phone": "^1.3.1",
  "react-aria-components": "^1.18.0",
  "seedrandom": "^3.0.5"
}
```

(`iframe-phone` is also a transitive dep of lara-interactive-api; declaring it explicitly pins it for the case where a future sim wants to drop down to raw iframe-phone usage.)

**Step 2: Install + verify**

```bash
yarn install
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared test
```

Expected: install resolves cleanly, all checks still pass. (No new code; just new resolutions in `yarn.lock`.)

**Step 3: Stop and wait for user review before doing anything else**

Suggest the commit message: `chore(shared): add react-aria-components, iframe-phone, lara-interactive-api deps`

(Suggested files to stage when the user is ready: `packages/shared/package.json`, `yarn.lock`.)

---

## Task 2: `useLogEvent` hook + GA injection (TDD)

The dual-transport action-logging hook from infrastructure-plan §5 and §11 #27–#32. Two transports, each independent:

1. **portal-report via lara-interactive-api `log()`** — fires when embedded; the library handles "not embedded → no-op" internally so we don't have to.
2. **GA4 via `window.gtag('event', name, params)`** — fires when `VITE_GA_PROPERTY_ID` is set at build time and the gtag snippet has loaded.

The gtag snippet is injected into each sim's `index.html` at build time by a tiny Vite plugin shipped from the shared library's `vite-config.ts`. Setting `VITE_GA_PROPERTY_ID=""` (the default) disables injection entirely.

Validation: event names enforce GA4's stricter constraints (`snake_case`, ≤ 40 chars), and param keys/values are sanity-checked. Validation failures throw in dev mode (so misnamed events are caught at the source) and silently drop in production.

**Files:**
- Create: `packages/shared/src/hooks/use-log-event.ts`
- Create: `packages/shared/src/hooks/use-log-event.test.ts`
- Modify: `packages/shared/src/vite-config.ts` (add the gtag plugin)
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/starter/index.html` (inject placeholder `<!--GA-->` marker)
- Modify: `packages/starter/vite.config.ts` (use the new plugin) — if Starter doesn't already consume shared `vite-config.ts`, wire it through.
- Modify: `simulations/sim-one/index.html`, `simulations/sim-two/index.html` (same marker)
- Modify: `simulations/sim-one/vite.config.ts`, `simulations/sim-two/vite.config.ts` if they don't already use the shared config.

**Step 1: Write the failing tests**

Hook tests cover the validation rules + transport routing. They mock both transports.

```ts
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the module body, so the mock fn must be created via
// `vi.hoisted` to exist when the factory runs (a plain top-level `const` would be
// referenced before initialization under Vitest 4).
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  log,
}));

import { useLogEvent } from "./use-log-event";

describe("useLogEvent", () => {
  beforeEach(() => {
    log.mockReset();
    // Default: gtag not present.
    (globalThis as { gtag?: unknown }).gtag = undefined;
  });
  afterEach(() => {
    (globalThis as { gtag?: unknown }).gtag = undefined;
  });

  it("returns a stable function reference across rerenders", () => {
    const { result, rerender } = renderHook(() => useLogEvent());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("forwards a valid event to lara-interactive-api log()", () => {
    const { result } = renderHook(() => useLogEvent());
    result.current("play_pressed", { trial: "A" });
    expect(log).toHaveBeenCalledWith("play_pressed", { trial: "A" });
  });

  it("forwards a valid event to window.gtag when present", () => {
    const gtag = vi.fn();
    (globalThis as { gtag?: typeof gtag }).gtag = gtag;
    const { result } = renderHook(() => useLogEvent());
    result.current("play_pressed", { trial: "A" });
    expect(gtag).toHaveBeenCalledWith("event", "play_pressed", { trial: "A" });
  });

  it("does NOT throw when gtag is absent (standalone, GA disabled)", () => {
    const { result } = renderHook(() => useLogEvent());
    expect(() => result.current("play_pressed")).not.toThrow();
  });

  it("throws on a non-snake_case event name in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    expect(() => result.current("PlayPressed")).toThrow(/snake_case/i);
    expect(() => result.current("play-pressed")).toThrow(/snake_case/i);
    expect(() => result.current("play pressed")).toThrow(/snake_case/i);
  });

  it("throws on an event name longer than 40 chars in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    const tooLong = `a_${"x".repeat(40)}`;
    expect(() => result.current(tooLong)).toThrow(/40 char/);
  });

  it("throws on more than 25 param keys in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    const params: Record<string, number> = {};
    for (let i = 0; i < 26; i++) params[`p${i}`] = i;
    expect(() => result.current("evt", params)).toThrow(/25 param/);
  });

  it("calls both transports independently — log() still fires when gtag is absent", () => {
    const { result } = renderHook(() => useLogEvent());
    result.current("trial_started");
    expect(log).toHaveBeenCalled();
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test use-log-event` — expect FAIL.

**Step 2: Write the hook**

Create `packages/shared/src/hooks/use-log-event.ts`:

```ts
import { log } from "@concord-consortium/lara-interactive-api";
import { useCallback } from "react";

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_EVENT_NAME_LEN = 40;
const MAX_PARAM_KEYS = 25;
const MAX_PARAM_VALUE_LEN = 100;

declare global {
  // gtag is loaded via the gtag.js snippet injected at build time when
  // VITE_GA_PROPERTY_ID is set; undefined when GA is disabled.
  interface Window {
    gtag?: (command: "event", name: string, params?: Record<string, unknown>) => void;
  }
}

export type LogEvent = (
  eventName: string,
  parameters?: Record<string, unknown>,
) => void;

/**
 * Dual-transport action logging. Returns a stable function that:
 *
 *  1. Validates the event name and params against GA4's constraints (snake_case,
 *     ≤ 40-char names, ≤ 25 params, ≤ 100-char values). In dev, validation
 *     failures throw — misnamed events get caught at the source.
 *  2. Forwards the event to `@concord-consortium/lara-interactive-api`'s `log()`,
 *     which fires into portal-report when embedded and no-ops when standalone.
 *  3. Forwards the event to `window.gtag('event', …)` when GA is configured
 *     (gtag.js loaded by the build-time-injected snippet in index.html).
 *
 * The two transports are independent: when GA is disabled, portal-report still
 * gets the event; when standalone (not embedded), GA still gets it. Both
 * transports are silent no-ops when their transport isn't available.
 *
 * Sims either call this directly for sim-specific events ("trial_started",
 * "fungus_introduced") or rely on shared controls' built-in auto-emit via their
 * `action` prop.
 *
 * See infrastructure-plan.md §5 and §11 #27–#32 for the contract.
 */
export function useLogEvent(): LogEvent {
  return useCallback((eventName, parameters) => {
    validate(eventName, parameters);
    try {
      // lara-interactive-api's `log(action, data)` — the event name is the action,
      // params are the data payload. Fires into portal-report when embedded.
      log(eventName, parameters);
    } catch {
      // lara-interactive-api throws if it hasn't initialized — treat as no-op.
    }
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, parameters);
    }
  }, []);
}

function validate(eventName: string, parameters?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (!EVENT_NAME_PATTERN.test(eventName)) {
    throw new Error(
      `useLogEvent: event name "${eventName}" must be snake_case (lowercase, digits, underscores; starting with a letter).`,
    );
  }
  if (eventName.length > MAX_EVENT_NAME_LEN) {
    throw new Error(
      `useLogEvent: event name "${eventName}" exceeds 40 chars (${eventName.length}).`,
    );
  }
  if (parameters) {
    const keys = Object.keys(parameters);
    if (keys.length > MAX_PARAM_KEYS) {
      throw new Error(
        `useLogEvent: event "${eventName}" has ${keys.length} params (max 25 params).`,
      );
    }
    for (const key of keys) {
      const value = parameters[key];
      if (typeof value === "string" && value.length > MAX_PARAM_VALUE_LEN) {
        throw new Error(
          `useLogEvent: event "${eventName}" param "${key}" value exceeds 100 chars.`,
        );
      }
    }
  }
}
```

**Step 3: Write the Vite plugin for gtag injection**

Open `packages/shared/src/vite-config.ts` and add the plugin alongside the existing shared config. Append to the bottom of the file (or co-locate inside the existing config factory):

```ts
import type { Plugin } from "vite";

/**
 * Vite plugin: when VITE_GA_PROPERTY_ID is set at build/dev time, inject the
 * gtag.js loader + bootstrap snippet into each sim's index.html in place of the
 * `<!--GA-->` placeholder. When the env var is empty/unset, the placeholder is
 * removed and no GA code ships.
 *
 * Pairs with `useLogEvent`, which fires `window.gtag('event', …)` only when the
 * snippet has loaded and `gtag` is defined. The snippet is tiny (~600 bytes
 * gzipped) and async-loaded, so disabling GA leaves zero overhead in the bundle.
 */
export function gtagInjector(): Plugin {
  // Read VITE_GA_PROPERTY_ID from Vite's resolved env (which merges `.env*` files and
  // matching `process.env` vars) rather than `process` directly — the shared package's
  // tsconfig has no Node types and we keep it that way (no new dev deps).
  let id = "";
  return {
    name: "mass-sims:gtag-injector",
    configResolved(config) {
      id = String(config.env.VITE_GA_PROPERTY_ID ?? "").trim();
    },
    transformIndexHtml(html) {
      if (!id) return html.replace(/<!--GA-->/g, "");
      const snippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${id}', { send_page_view: false });
</script>`;
      return html.replace(/<!--GA-->/g, snippet);
    },
  };
}
```

> **Implementation note (deviations from the original draft):** the real
> `@concord-consortium/lara-interactive-api` exports `log(action: string, data?: object)`,
> not `log({ event, parameters })` — the hook and its test call/assert the
> two-argument form. The gtag plugin reads `config.env` via `configResolved`
> instead of `process.env` because the shared package intentionally ships no Node
> types. And the validation test uses `vi.hoisted` for the `log` mock (Vitest 4
> hoists `vi.mock` above plain top-level `const`s).

Then ensure each sim's Vite config includes the plugin. If `packages/shared/src/vite-config.ts` already exports a `defineMassSimsConfig()` (or similar) used by Starter and the sims, add `plugins.push(gtagInjector())` inside it. If not, document for the developer in the commit message that each sim's `vite.config.ts` needs `import { gtagInjector } from "@concord-consortium/mass-sims-shared/vite-config"; plugins: [react(), gtagInjector()]`.

**Step 4: Add the `<!--GA-->` placeholder to each sim's index.html**

For each of `packages/starter/index.html`, `simulations/sim-one/index.html`, `simulations/sim-two/index.html`, add the placeholder inside `<head>`, immediately above the existing `<title>` (or wherever feels natural):

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--GA-->
  <title>…</title>
  …
</head>
```

The plugin replaces the comment with the loader snippet (or removes it entirely when `VITE_GA_PROPERTY_ID` is unset).

**Step 5: Export from the barrel**

In `packages/shared/src/index.ts`, add:

```ts
export { useLogEvent, type LogEvent } from "./hooks/use-log-event";
```

(`gtagInjector` is exported from the `./vite-config` subpath, not the main barrel — sims import it directly from `@concord-consortium/mass-sims-shared/vite-config`.)

**Step 6: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test use-log-event
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint

# Spot-check the build (with and without GA set):
yarn workspace starter build
VITE_GA_PROPERTY_ID=G-TEST123 yarn workspace starter build
```

After both builds, inspect `packages/starter/dist/index.html`. The first build should have no `<!--GA-->` and no gtag snippet; the second should have the gtag loader pointing at `G-TEST123`.

**Step 7: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): useLogEvent — dual-transport action logging (portal-report + GA4)`

(Suggested files to stage when the user is ready: `packages/shared/src/hooks/use-log-event.ts`, `packages/shared/src/hooks/use-log-event.test.ts`, `packages/shared/src/vite-config.ts`, `packages/shared/src/index.ts`, the three `index.html` files, and any `vite.config.ts` files that needed the plugin wired in.)

---

## Task 3: Shared `<Button>` component on react-aria-components (TDD)

The first wrapper around a `react-aria-components` primitive — the template every subsequent control in Phase 3 follows. Three responsibilities (per infrastructure-plan §3 "Shared controls policy"):

1. Apply our tokens / SCSS (press / hover / focus / disabled states).
2. Auto-emit via `useLogEvent` when an `action?: string` prop is supplied.
3. Forward all other react-aria props unchanged (`isDisabled`, `onPress`, `aria-label`, `type`, …).

(Visual variants are intentionally out of scope. The demo uses one button shape across Play / Pause / Step / Reset / About; if a Phase 3 control needs a lower-emphasis treatment, we'll add `variant` then and migrate consumers.)

**Files:**
- Create: `packages/shared/src/components/button/button.tsx`
- Create: `packages/shared/src/components/button/button.scss`
- Create: `packages/shared/src/components/button/button.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the module body, so the spy must be created via
// `vi.hoisted` to exist when the factory runs (Vitest 4 hoists `vi.mock` above
// plain top-level `const`s).
const { logEventSpy } = vi.hoisted(() => ({ logEventSpy: vi.fn() }));
vi.mock("../../hooks/use-log-event", () => ({
  useLogEvent: () => logEventSpy,
}));

import { Button } from "./button";

describe("Button", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders its children as the label", () => {
    const { getByRole } = render(<Button>Play</Button>);
    expect(getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("applies the .button class", () => {
    const { getByRole } = render(<Button>Play</Button>);
    expect(getByRole("button")).toHaveClass("button");
  });

  it("forwards onPress and calls it on click", () => {
    const onPress = vi.fn();
    const { getByRole } = render(<Button onPress={onPress}>Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("forwards isDisabled to the underlying control", () => {
    const onPress = vi.fn();
    const { getByRole } = render(
      <Button onPress={onPress} isDisabled>
        Play
      </Button>,
    );
    expect(getByRole("button")).toBeDisabled();
    fireEvent.click(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("auto-emits a log event when action is supplied", () => {
    const { getByRole } = render(<Button action="play_pressed">Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).toHaveBeenCalledWith("play_pressed", undefined);
  });

  it("forwards the actionParams object to the log event", () => {
    const { getByRole } = render(
      <Button action="trial_reset" actionParams={{ trial: "A" }}>
        Reset
      </Button>,
    );
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).toHaveBeenCalledWith("trial_reset", { trial: "A" });
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Button>Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("does NOT emit a log event when disabled (click suppressed)", () => {
    const { getByRole } = render(
      <Button action="play_pressed" isDisabled>
        Play
      </Button>,
    );
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("composes a custom className with the .button class", () => {
    const { getByRole } = render(
      <Button className="extra-class">Play</Button>,
    );
    expect(getByRole("button")).toHaveClass("button");
    expect(getByRole("button")).toHaveClass("extra-class");
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test button` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/button/button.tsx`:

```tsx
import clsx from "clsx";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";
import "./button.scss";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  /**
   * Optional log-event name fired on press. When omitted, no log event is sent.
   * Use snake_case per GA4's constraints — `useLogEvent` validates the format in dev.
   */
  action?: string;
  /** Optional parameters merged into the log event. */
  actionParams?: Record<string, unknown>;
  /**
   * Additional class names appended to `button`. Useful for one-off positioning
   * (e.g. inside a Section's tools row).
   */
  className?: string;
}

/**
 * The shared button wrapper around `react-aria-components` `Button`. Applies the
 * token-driven visual treatment, auto-emits via `useLogEvent` when `action` is
 * supplied, and forwards everything else to react-aria unchanged (`isDisabled`,
 * `onPress`, `aria-label`, `type`, …).
 *
 * Pattern reference for Phase 3 controls (Slider, Switch, …). See
 * infrastructure-plan.md §3 "Shared controls policy".
 */
export function Button({
  action,
  actionParams,
  onPress,
  className,
  children,
  ...rest
}: ButtonProps) {
  const logEvent = useLogEvent();
  return (
    <AriaButton
      {...rest}
      className={clsx("button", className)}
      onPress={(e) => {
        if (action) logEvent(action, actionParams);
        onPress?.(e);
      }}
    >
      {children}
    </AriaButton>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/button/button.scss`. Token mapping mirrors the demo's button treatment in `~/Documents/webdev/demos` (Play / Pause / Step / Reset / About all use the same shape — 2 px border, 6 px radius, surface hover/active states, focus outline).

```scss
@use "../../styles/tokens" as tokens;

.button {
  align-items: center;
  background: tokens.$color-surface;
  border: tokens.$border-strong;
  border-radius: tokens.$radius-md;
  color: tokens.$color-text;
  cursor: pointer;
  display: inline-flex;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;
  font-weight: 700;
  justify-content: center;
  line-height: tokens.$line-height-sm;
  // Sized to clear the 44 px touch-target minimum via an expanded ::after — visible
  // box stays 34 px so dense control rows don't bloat. Matches `.info-button` in
  // simulation-frame.scss.
  min-height: 34px;
  min-width: 60px;
  padding: 3px tokens.$space-3;
  position: relative;
  user-select: none;

  // Expanded touch target (7 px above and below → 48 px effective). Matches the
  // existing pattern on .info-button.
  &::after {
    bottom: -7px;
    content: "";
    left: 0;
    position: absolute;
    right: 0;
    top: -7px;
  }

  &[data-hovered],
  &:focus-visible {
    background: tokens.$color-surface-hover;
  }

  &[data-pressed] {
    background: tokens.$color-surface-active;
  }

  &:focus-visible {
    outline: tokens.$focus-outline;
    outline-offset: tokens.$focus-outline-offset;
  }

  &[data-disabled] {
    color: tokens.$color-text-muted;
    cursor: not-allowed;
    opacity: 0.5;
  }
}
```

(Note on the `data-*` attribute selectors: react-aria-components exposes its state via `data-hovered`, `data-pressed`, `data-focused`, `data-disabled` attributes rather than CSS pseudo-classes. This is intentional — `:hover` triggers on touchscreen taps and react-aria's pointer state machine handles cross-device behavior more carefully. Documented at https://react-spectrum.adobe.com/react-aria/styling.html.)

**Step 4: Export from the barrel**

In `packages/shared/src/index.ts`, add:

```ts
export { Button, type ButtonProps } from "./components/button/button";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test button
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

Expected: all 9 tests pass.

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): Button — first react-aria wrapper, with useLogEvent auto-emit`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 4: Migrate Starter's Play / Pause / Step / Reset to shared `<Button>`

The Starter sim's `simulation-view.tsx` currently uses four native `<button>` elements. Replace them with the shared `<Button>` to:
- Prove the wrapper in a real sim end-to-end.
- Get auto-emit log events for the four core control actions.
- Set the migration template for Phase 3's slider/number-input migration.

**Files:**
- Modify: `packages/starter/src/components/simulation-view.tsx`
- Modify: `packages/starter/src/components/simulation-view.scss` (drop any native-button styling now superseded by the shared `.button` rules)
- Modify: `packages/starter/src/components/simulation-view.test.tsx` (update test queries if needed)

**Step 1: Replace the four buttons in `simulation-view.tsx`**

Import the shared Button:

```ts
import { Button } from "@concord-consortium/mass-sims-shared";
```

Replace the existing buttons:

```tsx
<div className="buttons">
  <Button
    action={isPlaying ? "pause_pressed" : "play_pressed"}
    actionParams={{ trial: trialLabel }}
    onPress={() => (isPlaying ? pause() : play())}
    isDisabled={isComplete}
  >
    {isPlaying ? "Pause" : "Play"}
  </Button>
  <Button
    action="step_pressed"
    actionParams={{ trial: trialLabel }}
    onPress={() => step()}
    isDisabled={isComplete}
  >
    Step
  </Button>
  <Button
    action="reset_pressed"
    actionParams={{ trial: trialLabel }}
    onPress={onReset}
    isDisabled={transient.frame === 0}
  >
    Reset
  </Button>
</div>
```

Note the swap from `disabled` (HTML attr) to `isDisabled` (react-aria prop) and from `onClick` to `onPress` — react-aria's pointer abstraction handles touch + mouse + keyboard uniformly. The `actionParams` carry the selected trial letter so portal-report and GA4 can attribute the press to a specific trial.

**Step 2: Trim now-redundant styles from `simulation-view.scss`**

In the existing `simulation-view.scss`, the `.buttons button { … }` rules that styled the native buttons are now redundant (the shared `.button` rules apply). Delete just those rules; keep `.buttons` (the layout container) untouched.

**Step 3: Update component tests for the new accessible names + disabled semantics**

The Starter's existing test file uses `getByRole("button", { name: /play/i })` etc. — these still work because react-aria's `Button` renders a `role="button"`. But a few tests check `disabled` via `toBeDisabled()` and that still works: react-aria marks the button with both `data-disabled` and the HTML `disabled` attribute when `isDisabled` is true. Re-run them; if any fail, the failure points at a real regression, not a renaming issue.

Add one new test verifying the action prop emits a log event.

> **Mock the transport, not the hook.** Mocking the shared barrel's `useLogEvent`
> (and asserting a `logEventSpy`) does **not** work: the real `<Button>` closes
> over its own module-relative `useLogEvent` import, so replacing the package
> entry's export never rebinds what runs inside `Button` — the spy is never
> called. Instead mock `@concord-consortium/lara-interactive-api`'s `log` — the
> actual transport the real `Button → useLogEvent → log(action, data)` chain
> calls — and assert the end-to-end path.

```tsx
// At the top of the test file, alongside other imports:
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

it("emits play_pressed when Play is clicked", () => {
  log.mockReset();
  const { getByRole } = render(<SimulationView … />);
  fireEvent.click(getByRole("button", { name: /play/i }));
  expect(log).toHaveBeenCalledWith(
    "play_pressed",
    expect.objectContaining({ trial: expect.any(String) }),
  );
});
```

**Step 4: Run checks**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

Expected: all pass.

**Step 5: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): migrate Play/Pause/Step/Reset to shared Button (with auto-emit)`

(Suggested files to stage when the user is ready: the three modified files above.)

---

## Task 5: `scripts/new-sim.ts` — copy Starter into a new simulation

The first half of the scaffolding work. `yarn new-sim <name>` should:

1. Validate the sim name (kebab-case, alphanumerics + hyphens; not a reserved word like `shared`, `starter`, `sim-frame-preview`).
2. Refuse to overwrite an existing `simulations/<name>/` directory.
3. Copy `packages/starter/` to `simulations/<name>/` recursively (skipping `node_modules`, `dist`, `.vite`, `coverage`, etc.).
4. Walk every file in the copy and:
   - Replace `"starter"` → `"<name>"` in `package.json` (the name field).
   - Replace the human-readable "Random Walk" sim title in `app.tsx` with a `<NEW SIM TITLE>` placeholder the developer fills in.
5. Print next-step instructions:
   - `yarn install` (to link the new workspace)
   - `yarn gen-index` (to refresh the root index.html)
   - `yarn gen-workflows` (to generate the per-sim CI workflow)

> **No workspaces edit.** The root `package.json` `workspaces` array uses globs
> (`["packages/*", "simulations/*"]`), and `gen-index` discovers sims by scanning
> `simulations/*` for a `package.json`. A freshly-copied `simulations/<name>/` is
> therefore picked up automatically — the script does **not** edit `workspaces`
> (pushing an explicit `simulations/<name>` entry would just pollute the glob list).
> The `tagline` is filled in manually per the next-steps message; `substituteInFile`
> only rewrites the `package.json` name and the `app.tsx` `simTitle`.

**Files:**
- Create: `scripts/new-sim.ts`
- Create: `scripts/new-sim.test.ts` (tests for the validation + name-substitution logic; not the FS copy itself — that's verified by the smoke step in Task 10)
- Create: root `vitest.config.ts` (scoped to `scripts/**/*.test.ts`, node env) — there is no root test runner otherwise; `yarn test` is `lerna run test` (per-workspace only).
- Modify: root `package.json` to add the `new-sim` and `test:scripts` scripts

(No root `tsconfig.json` exists and `scripts/` is not in any tsconfig's include path — existing scripts run via `tsx` without a separate typecheck — so there is nothing to modify there.)

**Step 1: Write the failing tests for the pure logic**

Tests cover name validation and the substitution table. The FS work is covered by Task 10's smoke check (`yarn new-sim demo-sim` end-to-end).

```ts
import { describe, expect, it } from "vitest";
import { isValidSimName, substituteInFile } from "./new-sim";

describe("isValidSimName", () => {
  it("accepts kebab-case names", () => {
    expect(isValidSimName("bananas")).toBe(true);
    expect(isValidSimName("sim-one")).toBe(true);
    expect(isValidSimName("photo-synth-2")).toBe(true);
  });

  it("rejects names with uppercase, spaces, underscores, or leading hyphens", () => {
    expect(isValidSimName("Bananas")).toBe(false);
    expect(isValidSimName("photo synth")).toBe(false);
    expect(isValidSimName("photo_synth")).toBe(false);
    expect(isValidSimName("-leading")).toBe(false);
    expect(isValidSimName("")).toBe(false);
  });

  it("rejects reserved words", () => {
    expect(isValidSimName("shared")).toBe(false);
    expect(isValidSimName("starter")).toBe(false);
    expect(isValidSimName("sim-frame-preview")).toBe(false);
  });
});

describe("substituteInFile", () => {
  it("replaces the package name in package.json", () => {
    const before = `{ "name": "starter", "version": "0.0.1" }`;
    const after = substituteInFile(before, "starter", "bananas", "package.json");
    expect(after).toContain(`"name": "bananas"`);
  });

  it("does NOT touch unrelated occurrences of the substring", () => {
    const before = `// starter is the template — see infrastructure-plan.md`;
    const after = substituteInFile(before, "starter", "bananas", "src/comment.ts");
    // Heuristic: only replace name-shaped occurrences, not arbitrary prose.
    expect(after).toBe(before);
  });

  it("replaces the sim title in app.tsx", () => {
    const before = `simTitle="Random Walk"`;
    const after = substituteInFile(before, "starter", "bananas", "src/app.tsx");
    expect(after).toContain(`simTitle="<NEW SIM TITLE>"`);
  });
});
```

Run `yarn test:scripts new-sim` — expect FAIL. (`test:scripts` runs the root `vitest.config.ts`, scoped to `scripts/**/*.test.ts`.)

**Step 2: Write the script**

Create `scripts/new-sim.ts`:

```ts
#!/usr/bin/env tsx
//
// scripts/new-sim.ts — scaffold a new simulation from packages/starter.
//
// Usage:
//   yarn new-sim <name>
//
// Where <name> is the kebab-case name (matches the directory name AND the
// package name in package.json — they always agree).
//
// What it does:
//   1. Validates the name.
//   2. Copies packages/starter/ to simulations/<name>/ (skipping node_modules,
//      dist, coverage, .vite, and *.tsbuildinfo files).
//   3. Substitutes the name + title placeholders.
//   4. Prints next-step reminders.
//
// Note: the root package.json `workspaces` array uses globs (`simulations/*`), so a
// new sim directory is picked up automatically — this script does NOT edit workspaces.

import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const SIM_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESERVED = new Set(["shared", "starter", "sim-frame-preview", "mass-sims"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".vite"]);

/** Paths excluded from the starter copy: build/dep directories and any *.tsbuildinfo file. */
function shouldSkipCopy(src: string): boolean {
  const base = basename(src);
  return SKIP_DIRS.has(base) || base.endsWith(".tsbuildinfo");
}

export function isValidSimName(name: string): boolean {
  if (!SIM_NAME_PATTERN.test(name)) return false;
  if (RESERVED.has(name)) return false;
  return true;
}

/**
 * Apply name/title substitutions. The substitution rules are file-specific so we
 * don't accidentally rewrite documentation prose that happens to contain the word
 * "starter".
 */
export function substituteInFile(
  content: string,
  oldName: string,
  newName: string,
  relPath: string,
): string {
  if (relPath.endsWith("package.json")) {
    return content.replace(`"name": "${oldName}"`, `"name": "${newName}"`);
  }
  if (relPath.endsWith("src/app.tsx")) {
    return content.replace(/simTitle=".*?"/, `simTitle="<NEW SIM TITLE>"`);
  }
  return content;
}

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error("Usage: yarn new-sim <name>");
    process.exit(1);
  }
  if (!isValidSimName(name)) {
    console.error(
      `Invalid sim name "${name}". Use kebab-case (lowercase, digits, hyphens; starting with a letter). ` +
        `Reserved: shared, starter, sim-frame-preview, mass-sims.`,
    );
    process.exit(1);
  }
  const targetDir = join(REPO_ROOT, "simulations", name);
  if (existsSync(targetDir)) {
    console.error(`Refusing to overwrite existing directory: ${targetDir}`);
    process.exit(1);
  }

  const sourceDir = join(REPO_ROOT, "packages", "starter");
  console.log(`Copying ${sourceDir} → ${targetDir}`);
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (src) => !shouldSkipCopy(src),
  });

  // Walk the copied tree and substitute.
  walk(targetDir, (filePath) => {
    // Normalize to forward slashes so substituteInFile's path checks (e.g. "src/app.tsx") work on
    // Windows, where filePath uses backslash separators.
    const relPath = filePath
      .slice(targetDir.length + 1)
      .split(sep)
      .join("/");
    const content = readFileSync(filePath, "utf8");
    const next = substituteInFile(content, "starter", name, relPath);
    if (next !== content) writeFileSync(filePath, next);
  });

  console.log(`\n✓ Scaffolded simulations/${name}`);
  console.log("\nNext steps:");
  console.log("  1. yarn install            # link the new workspace");
  console.log("  2. yarn gen-index          # refresh the root index.html");
  console.log("  3. yarn gen-workflows      # generate the per-sim CI workflow");
  console.log(`  4. Edit simulations/${name}/src/app.tsx — fill in simTitle and tagline`);
}

function walk(dir: string, visit: (filePath: string) => void) {
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);
    const s = statSync(filePath);
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(filePath, visit);
    } else {
      visit(filePath);
    }
  }
}

// Run main() only when executed directly (not when imported by tests).
const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) main();
```

**Step 3: Add the npm scripts + root vitest config**

There is no root test runner today (`yarn test` is `lerna run test`, per-workspace only), so create a root `vitest.config.ts` scoped to the script tests:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

Then in root `package.json`, under `"scripts"`, add both:

```json
"test:scripts": "vitest run",
"new-sim": "tsx scripts/new-sim.ts"
```

(`yarn test` stays `lerna run test`; CI gets an explicit `yarn test:scripts` step in Task 6.)

**Step 4: Run tests + verify**

```bash
yarn test:scripts new-sim
yarn typecheck
yarn lint
```

Expected: tests pass. Also run a quick smoke check (since the script no longer
edits any tracked files, reverting is just removing the new directory):

```bash
yarn new-sim demo-throwaway
ls simulations/demo-throwaway/   # confirm files exist
git status                       # only an untracked simulations/demo-throwaway/
rm -rf simulations/demo-throwaway  # revert
```

**Step 5: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(scripts): yarn new-sim — scaffold simulation from packages/starter`

(Suggested files to stage when the user is ready: `scripts/new-sim.ts`, `scripts/new-sim.test.ts`, root `vitest.config.ts`, root `package.json`.)

---

## Task 6: `scripts/gen-workflows.ts` + CI restructure

The second half of the scaffolding work. Splits the existing single `ci.yml` into:

1. **`ci.yml`** — repo-wide checks (lint, typecheck, test, `gen-index --check`, `gen-workflows --check`). Runs on every push/PR. Fast — no per-sim builds.
2. **`sim-<name>.yml`** (generated, one per simulation) — that sim's build+deploy, with path filters so it only runs when files relevant to that sim change (its own directory, `packages/shared/**`, or the workflow file itself).

`scripts/gen-workflows.ts` walks `simulations/*` and writes `.github/workflows/sim-<name>.yml` from a template. Two modes:
- `yarn gen-workflows` — regenerate all sim workflows.
- `yarn gen-workflows --check` — verify they match what would be generated; exit non-zero with a diff hint if stale.

**Files:**
- Create: `scripts/gen-workflows.ts`
- Create: `scripts/workflows/sim-template.yml` (the per-sim deploy template)
- Create: `.github/workflows/sim-sim-one.yml` (generated; committed)
- Create: `.github/workflows/sim-sim-two.yml` (generated; committed)
- Modify: `.github/workflows/ci.yml` (drop the build+deploy job; keep the checks)
- Modify: root `package.json` to add `gen-workflows` + `gen-workflows:check` scripts
- Create: `scripts/gen-workflows.test.ts`

**Step 1: Decide and document the per-sim workflow shape**

Create `scripts/workflows/sim-template.yml` (the placeholder `__SIM_NAME__` is replaced at generation time):

```yaml
# THIS FILE IS GENERATED by scripts/gen-workflows.ts. Do not edit by hand.
# To change the template, edit scripts/workflows/sim-template.yml and run
# `yarn gen-workflows` to regenerate every sim-*.yml file.

name: Deploy __SIM_NAME__

on:
  push:
    branches: ["**"]
    tags: ["v*"]
    paths:
      - "simulations/__SIM_NAME__/**"
      - "packages/shared/**"
      - ".github/workflows/sim-__SIM_NAME__.yml"
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

env:
  NODE_VERSION: "24"
  AWS_REGION: us-east-1
  S3_BUCKET: models-resources
  PROJECT_PREFIX: mass-sims
  SIM_NAME: __SIM_NAME__

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "yarn"
      - run: yarn install --frozen-lockfile

      - name: Determine deploy path
        id: deploy_path
        run: |
          if [[ "${GITHUB_REF}" == refs/tags/* ]]; then
            echo "path=version/${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          elif [[ "${GITHUB_REF}" == refs/heads/* ]]; then
            echo "path=branch/${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          else
            echo "path=version/release" >> "$GITHUB_OUTPUT"
          fi

      - name: Build
        env:
          MASS_SIMS_VERSION_PATH: ${{ steps.deploy_path.outputs.path }}
        run: yarn workspace ${{ env.SIM_NAME }} build

      - name: Configure AWS credentials (OIDC)
        if: github.event_name == 'push'
        uses: aws-actions/configure-aws-credentials@v6.1.3
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to S3
        if: github.event_name == 'push'
        env:
          DEPLOY_PATH: ${{ steps.deploy_path.outputs.path }}
        run: |
          set -e
          pkg_dir="simulations/${SIM_NAME}"
          aws s3 sync "$pkg_dir/dist" \
            "s3://${S3_BUCKET}/${PROJECT_PREFIX}/${DEPLOY_PATH}/${SIM_NAME}/" \
            --delete \
            --cache-control "public,max-age=31536000,immutable" \
            --exclude "index.html" \
            --exclude "index-top.html"
          aws s3 cp "$pkg_dir/dist/index.html" \
            "s3://${S3_BUCKET}/${PROJECT_PREFIX}/${DEPLOY_PATH}/${SIM_NAME}/index.html" \
            --cache-control "public,max-age=60,must-revalidate"
          if [ -f "$pkg_dir/dist/index-top.html" ]; then
            aws s3 cp "$pkg_dir/dist/index-top.html" \
              "s3://${S3_BUCKET}/${PROJECT_PREFIX}/${DEPLOY_PATH}/${SIM_NAME}/index-top.html" \
              --cache-control "public,max-age=60,must-revalidate"
          fi
```

**Step 2: Write the generator + tests**

`scripts/gen-workflows.ts`:

```ts
#!/usr/bin/env tsx
//
// scripts/gen-workflows.ts — regenerate per-sim CI workflows from the template.
//
// Modes:
//   yarn gen-workflows          → regenerate every .github/workflows/sim-*.yml
//   yarn gen-workflows --check  → verify they match what would be generated
//
// The single source of truth for the sim list is the root package.json
// "workspaces" array — same convention as gen-index.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const TEMPLATE_PATH = join(SCRIPT_DIR, "workflows", "sim-template.yml");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

export function renderWorkflow(template: string, simName: string): string {
  return template.replaceAll("__SIM_NAME__", simName);
}

export function discoverSims(): string[] {
  const simsDir = join(REPO_ROOT, "simulations");
  if (!existsSync(simsDir)) return [];
  return readdirSync(simsDir).filter((name) =>
    existsSync(join(simsDir, name, "package.json")),
  ).sort();
}

function main() {
  const check = process.argv.includes("--check");
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const sims = discoverSims();
  let stale = false;
  for (const sim of sims) {
    const rendered = renderWorkflow(template, sim);
    const target = join(WORKFLOWS_DIR, `sim-${sim}.yml`);
    if (check) {
      const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
      if (existing !== rendered) {
        console.error(`Stale workflow file: ${target}`);
        stale = true;
      }
    } else {
      writeFileSync(target, rendered);
      console.log(`Wrote ${target}`);
    }
  }
  if (check && stale) {
    console.error("\nRun `yarn gen-workflows` and commit the result.");
    process.exit(1);
  }
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) main();
```

Tests in `scripts/gen-workflows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderWorkflow } from "./gen-workflows";

describe("renderWorkflow", () => {
  it("replaces every __SIM_NAME__ occurrence", () => {
    const tpl =
      "name: Deploy __SIM_NAME__\nSIM_NAME: __SIM_NAME__\npaths:\n  - simulations/__SIM_NAME__/**\n";
    const out = renderWorkflow(tpl, "bananas");
    expect(out).toBe(
      "name: Deploy bananas\nSIM_NAME: bananas\npaths:\n  - simulations/bananas/**\n",
    );
  });

  it("leaves the template untouched when there are no markers", () => {
    const tpl = "name: CI\nruns-on: ubuntu-latest\n";
    expect(renderWorkflow(tpl, "bananas")).toBe(tpl);
  });
});
```

**Step 3: Restructure `ci.yml` — `checks` job + `deploy_root` job**

`ci.yml` becomes two jobs: a cross-cutting `checks` job (lint / typecheck / test / `test:scripts` / `gen-index --check` / `gen-workflows --check`) that runs on every push and PR, and a `deploy_root` job that uploads the repo-root `index.html` (the landing page that lists every sim) to the correct versioned/branch S3 path. Per-sim builds and deploys are entirely in the generated `sim-<name>.yml` files; the root index doesn't fit cleanly into any per-sim workflow (it's cross-cutting) and the per-sim workflows don't deploy it, so it lives here. This matches dese-models' pattern (its `ci.yml` does the per-sim matrix in one job and the root assets in a separate `s3-deploy` job).

Replace the existing build+deploy job in `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: ["**"]
    tags: ["v*"]
  pull_request:
  workflow_dispatch:

env:
  NODE_VERSION: "24"

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "yarn"
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn typecheck
      - run: yarn test
      - run: yarn test:scripts
      - run: yarn gen-index --check
      - run: yarn gen-workflows --check

  deploy_root:
    name: Deploy root index.html
    needs: checks
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    env:
      AWS_REGION: us-east-1
      S3_BUCKET: models-resources
      PROJECT_PREFIX: mass-sims
    steps:
      - uses: actions/checkout@v5

      - name: Determine deploy path
        id: deploy_path
        run: |
          if [[ "${GITHUB_REF}" == refs/tags/* ]]; then
            echo "path=version/${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          elif [[ "${GITHUB_REF}" == refs/heads/* ]]; then
            echo "path=branch/${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          else
            echo "path=version/release" >> "$GITHUB_OUTPUT"
          fi

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v6.1.3
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Upload root index.html
        env:
          DEPLOY_PATH: ${{ steps.deploy_path.outputs.path }}
        run: |
          aws s3 cp index.html \
            "s3://${S3_BUCKET}/${PROJECT_PREFIX}/${DEPLOY_PATH}/index.html" \
            --cache-control "public,max-age=60,must-revalidate"
```

Per-sim build+deploy moves to the generated `sim-<name>.yml` files.

Notes on the `deploy_root` job:

- **No path filter on the trigger** — `ci.yml` already fires on every push, and the root index needs to land at the new path even when its content didn't change (a fresh-branch push needs `…/branch/<name>/index.html` to exist). Letting the job always run on push is cheap (single S3 cp of a small file).
- **`needs: checks`** — fails fast on lint/typecheck/test/gen-* errors before doing anything AWS-y. Mirrors dese-models' `s3-deploy needs: build_test` posture.
- **No build step** — mass-sims' `index.html` is committed (gen-index regenerates and commits it; CI's `gen-index --check` enforces freshness), so no `yarn build` is needed here. dese-models has a build step because their static index isn't committed; ours is simpler because of `gen-index`.
- **Same OIDC role as the per-sim workflows** — uses `vars.AWS_DEPLOY_ROLE_ARN`, identical to `sim-<name>.yml`. No new IAM setup.

The existing `release.yml` (top-level promotion) doesn't need to change. Tag pushes now publish `…/version/<tag>/index.html` via this `deploy_root` job, so release.yml's "Promote root index.html" step finds its source where it expects.

**Step 4: Generate the initial sim workflows**

```bash
yarn gen-workflows
git status .github/workflows/
```

Expected: two new files, `.github/workflows/sim-sim-one.yml` and `.github/workflows/sim-sim-two.yml`.

**Step 5: Add the npm scripts**

In root `package.json`:

```json
"gen-workflows": "tsx scripts/gen-workflows.ts",
"gen-workflows:check": "tsx scripts/gen-workflows.ts --check"
```

**Step 6: Run tests + verify**

```bash
yarn test gen-workflows
yarn gen-workflows --check  # should pass since we just regenerated
yarn typecheck && yarn lint
```

**Step 7: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(scripts,ci): per-sim workflow generation + ci.yml restructure`

(Suggested files to stage when the user is ready: `scripts/gen-workflows.ts`, `scripts/gen-workflows.test.ts`, `scripts/workflows/sim-template.yml`, `.github/workflows/ci.yml`, the two generated `sim-*.yml`, and root `package.json`.)

> **Note on PR review.** This task adds two new CI workflows the first time it runs in a PR. GitHub queues them on the PR's commit but won't actually trigger them via path filters until subsequent pushes match the paths. Confirm they appear in the GitHub Actions UI and re-run a fresh push that touches one sim to verify the path-filter triggering is correct.

---

## Task 7: Wire Starter to Activity Player saved state (TDD)

When the Starter is embedded in Activity Player (or any lara-interactive-api-compatible host), student progress should round-trip — running a trial, leaving, and returning should restore the trial list and selection. The infra plan §3 "AP state sync" subsection establishes the convention: sims import `useInitMessage` and `setInteractiveState` from `@concord-consortium/lara-interactive-api` **directly**, no wrapper. This task adds that wiring to the Starter so it actually works end-to-end (otherwise Task 8's smoke test would have nothing to verify) and so the scaffolded sims that `yarn new-sim` produces inherit a correct AP-integrated template.

**Behavior:**
- **Restore on init.** When AP completes the handshake and the init message carries a previously-saved `interactiveState`, the Starter replaces its initial trial list + selectedId with the saved values.
- **Push on change.** Every time the trial list or selection changes (add / select / reset / complete), the Starter calls `setInteractiveState({ trials, selectedId })` to push the new state to AP.
- **Standalone-safe.** `useInitMessage()` returns `null` and `setInteractiveState()` is a no-op when there's no AP parent; no special-casing required in sim code.
- **Reload warning only in standalone.** `useReloadWarning` is gated on `!isEmbedded` (where `isEmbedded = useInitMessage() !== null`). In standalone, in-memory progress is still at risk, so the `beforeunload` prompt fires once a trial has been run. When embedded, AP persists every change via `setInteractiveState`, so progress isn't at risk on reload — and an iframe `beforeunload` prompt would otherwise fire spuriously during AP's normal page-to-page navigation.
- **NOT persisted:** per-frame transient state (walker positions, current frame counter, in-progress live series). Students restart trials from the beginning when they return; mid-run resumption would require snapshot-and-replay machinery and isn't worth the complexity for the template.

**Files:**
- Create: `packages/starter/src/model/saved-state.ts`
- Modify: `packages/starter/src/app.tsx`
- Modify: `packages/starter/src/app.test.tsx`

**Step 1: Define the saved-state shape**

Create `packages/starter/src/model/saved-state.ts`:

```ts
import type { RecordedTrial } from "./types";

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. Plain
 * JSON-serializable values only — `trials` is `RecordedTrial[]` whose `input`, `output`,
 * and `finalTransient` (when present) are also plain objects. Per-frame transient state
 * (the live walker positions, frame counter, and `liveSeries` from the in-progress run)
 * is intentionally NOT persisted; students restart trials from the beginning when they
 * return to the activity.
 */
export interface SavedState {
  trials: RecordedTrial[];
  selectedId: string;
}
```

**Step 2: Write the failing tests**

Append to `packages/starter/src/app.test.tsx`. Mock both `useInitMessage` and `setInteractiveState` from lara-interactive-api so the tests can drive the init scenario directly:

```tsx
// Mock the lara-interactive-api surface the Starter uses for AP saved-state sync.
// Hoisted because `vi.mock` is hoisted above the module body (a plain top-level `const`
// would be referenced before initialization under Vitest 4). The hook returns null by
// default (standalone); individual tests override per-case via the `beforeEach` below.
// Note: `log` is intentionally NOT re-exported here — the shared <Button>'s useLogEvent
// imports it from this module, but it's only called on press (and is wrapped in a
// try/catch), so an undefined `log` is a harmless no-op in these tests.
const { useInitMessageMock, setInteractiveStateMock } = vi.hoisted(() => ({
  useInitMessageMock: vi.fn(),
  setInteractiveStateMock: vi.fn(),
}));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  useInitMessage: useInitMessageMock,
  setInteractiveState: setInteractiveStateMock,
}));

// ... existing imports ...

// Default every test to standalone — the real useInitMessage returns null (never
// undefined) when there's no AP parent, and App derives `isEmbedded = initMsg !== null`.
// Without this, the pre-existing "registers a beforeunload listener" test would see
// `undefined` (a vi.fn default) → `undefined !== null` → embedded → warning suppressed.
// Place at the top level so it covers the existing `describe("Starter App")` block too.
beforeEach(() => {
  useInitMessageMock.mockReturnValue(null);
});

describe("Starter App — AP saved state", () => {
  beforeEach(() => {
    useInitMessageMock.mockReturnValue(null);
    setInteractiveStateMock.mockReset();
  });

  it("renders the default empty trial when no init message arrives (standalone)", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Trial B" })).toBeNull();
  });

  it("restores trials + selectedId from a runtime init message's interactiveState", () => {
    // Build a saved state with two trials, the second selected.
    const trialA = {
      id: "saved-A",
      input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "saved-A" },
      output: { avgDistance: 3.14, stdDevDistance: 0.5, avgDistanceSeries: [1, 2, 3] },
      finalTransient: null,
    };
    const trialB = {
      id: "saved-B",
      input: { walkerCount: 100, stepSize: 2, framesPerTrial: 200, seed: "saved-B" },
      output: null,
      finalTransient: null,
    };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { trials: [trialA, trialB], selectedId: "saved-B" },
    });
    const view = render(<App />);
    // Both saved trials render as cards, and the saved selection is honored.
    expect(view.getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Trial B" })).toBeInTheDocument();
    // Trial A's avg-distance readout shows the saved output.
    expect(view.getByText(/avg 3/i)).toBeInTheDocument();
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const view = render(<App />);
    expect(view.getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Trial B" })).toBeNull();
  });

  it("calls setInteractiveState on every trial-list change (add / complete / reset)", () => {
    const view = render(<App />);
    // Initial mount triggers at least one push (the default state).
    expect(setInteractiveStateMock).toHaveBeenCalled();
    setInteractiveStateMock.mockClear();

    // Add Trial B → push.
    fireEvent.click(view.getByRole("button", { name: "New trial" }));
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const lastCall = setInteractiveStateMock.mock.calls.at(-1)?.[0] as { trials: unknown[] };
    expect(lastCall.trials).toHaveLength(2);
  });

  it("does NOT register a beforeunload listener when embedded (AP persists progress)", () => {
    // Embedded: an init message is present, so progress round-trips through AP and the
    // standalone reload warning is suppressed even after a trial has been run.
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const addSpy = vi.spyOn(window, "addEventListener");
    const view = render(<App />);
    runSelectedTrial(view);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
```

Run `yarn workspace starter test app` — expect FAIL.

**Step 3: Wire the hooks into `app.tsx`**

Add the imports near the top:

```tsx
import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { useCallback, useEffect, useState } from "react";
import type { SavedState } from "./model/saved-state";
```

(`useEffect` is added if it's not already imported.)

Then inside `App`, after the existing `useState` declarations (and before the existing `selected` derivation), add:

```tsx
// AP saved-state sync — restore on init, push on every trial-list change. The
// lara-interactive-api hooks handle standalone-vs-embedded internally: outside AP,
// useInitMessage stays null and setInteractiveState is a no-op, so no guards are
// needed here. See infrastructure-plan.md §3 "AP state sync" for the convention.
const initMsg = useInitMessage<SavedState>();
// Embedded once the AP handshake has delivered an init message; null in standalone.
const isEmbedded = initMsg !== null;
useEffect(() => {
  // The `interactiveState` field is present on runtime + report init messages. In
  // runtime mode it's null on the very first session and populated thereafter; in
  // report mode it's always populated (we render the saved data read-only). For
  // the Starter as a template we accept both — a sim with report-mode interactivity
  // restrictions can layer that on with `initMsg.mode === "report"`.
  if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
    setState(initMsg.interactiveState);
  }
}, [initMsg]);
useEffect(() => {
  // Pushing on every trials/selectedId change is fine — these mutate on user actions
  // (add/select/reset/complete), not per-frame, so the call rate stays low. The
  // per-frame walker movement and liveSeries are NOT included in SavedState by design.
  setInteractiveState<SavedState>({ trials, selectedId });
}, [trials, selectedId]);
```

Then gate the existing `useReloadWarning` call on `!isEmbedded` (see the "Reload
warning only in standalone" behavior note above):

```tsx
useReloadWarning(!isEmbedded && trials.some((t) => t.output !== null));
```

The two state-sync effects are deliberately independent. Restore fires once when init arrives; that update flows into the push effect via the `trials`/`selectedId` dependencies, so AP receives the restored state echoed back (harmless — it's the same payload). No state-loop risk because `useInitMessage` fires once per session.

**Step 4: Run tests + verify**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

Expected: the four new tests pass, plus all existing tests continue to pass (mockReturnValue(null) by default means the existing tests see standalone behavior, which matches what they were written against).

**Step 5: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): wire Activity Player saved state (restore on init, push on change)`

(Suggested files to stage when the user is ready: `packages/starter/src/model/saved-state.ts`, `packages/starter/src/app.tsx`, `packages/starter/src/app.test.tsx`.)

---

## Task 8: Activity Player smoke test (manual)

Verify the lara-interactive-api state-sync + `useLogEvent` integration end-to-end. This task has no code changes — it's a manual ship + verify against a real Activity Player instance + portal-report.

**Prerequisites:**
- AWS S3 deploy from the Phase 2c branch has succeeded (CI ran `sim-starter.yml`).
- Access to a Concord-Consortium dev portal account + portal-report dev URL.
- (Optional) A configured `VITE_GA_PROPERTY_ID` value for GA verification — typically a test property created for this purpose.

> **Note:** packages/starter is a template and isn't deployed by the per-sim workflows generated in Task 6. For the smoke test you can either (a) temporarily promote one of `sim-one` / `sim-two` to use the starter's full Phase 2b sim code, or (b) ship the starter manually via `yarn workspace starter build` + `aws s3 sync`. Option (b) is simpler and doesn't pollute a sim. The instructions below assume option (b).

**Step 1: Deploy the starter to a branch path**

```bash
git push origin phase-2c-embedding-logging   # if not already pushed
# Wait for CI checks to pass.

# Build and ship the starter manually for the smoke test:
yarn workspace starter build
aws s3 sync packages/starter/dist \
  s3://models-resources/mass-sims/branch/phase-2c-embedding-logging/starter/ \
  --delete \
  --cache-control "public,max-age=60,must-revalidate"
```

Confirm the URL loads in a browser:
`https://models-resources.concord.org/mass-sims/branch/phase-2c-embedding-logging/starter/index.html`

**Step 2: Wire it into an Activity Player page**

Create or open an existing dev AP page configured to load an "interactive" with a custom URL. Point the interactive URL at the deployed starter URL. (Concrete steps depend on the dev portal's UI; ask the team's portal-report or AP contact if unsure.)

**Step 3: Verify lara-interactive-api init + restore**

- Reload the AP page. The starter should load inside AP.
- Run a trial in the starter, then reload the AP page. Verify the trials list and selected trial restore from the saved interactive state.
- If the restore round-trip works → the sim's `useInitMessage` / `useInteractiveState` wiring is correct. If it doesn't → check the browser console for lara-interactive-api init errors and verify the sim is calling `setInteractiveState(currentState)` (or using `useInteractiveState`'s setter) on state changes. The wiring lives in the sim; Task 9's `docs/adding-a-new-sim.md` shows the established pattern.

**Step 4: Verify portal-report logging**

- Press Play / Pause / Step / Reset a few times in the embedded starter.
- Open portal-report's interactive-event view for the activity. Verify `play_pressed`, `pause_pressed`, `step_pressed`, `reset_pressed` events appear with the `{ trial: "A" }` parameter.

**Step 5: (Optional) Verify GA4 logging**

If `VITE_GA_PROPERTY_ID` is set in CI as a repo env var, redeploy with it, then:

- Open the configured GA4 property's DebugView (Admin → DebugView).
- Hit the deployed starter URL with `?debug_mode=1` (the gtag snippet doesn't need a special flag — DebugView auto-attaches in dev tools).
- Press buttons, watch the events appear.

**Step 6: Record findings**

In the PR description for this branch, summarize what was verified:
- Init / restore: ✓ or ✗
- portal-report events: ✓ (with sample event names + params) or ✗
- GA4 events: ✓ or ✗ (or skipped)

No code change; no commit for Task 8.

---

## Task 9: Documentation updates

Lock in Phase 2c's concrete contracts. Mirrors Phase 2b's Task 9.

**Files:**
- Modify: `docs/infrastructure-plan.md`
- Modify: `docs/ui-design-plan.md`
- Create: `docs/adding-a-new-sim.md`
- (Optionally) Modify: `packages/shared/README.md`

**Step 1: Lock in the concrete `useLogEvent` signature in infrastructure-plan.md §3**

The "AP state sync" subsection and the Phase 2c framing of the `useLogEvent` bullet were already added to `docs/infrastructure-plan.md` §3 when this plan was drafted. Now that the hook actually ships, replace the bullet with the locked-in signature so future readers see what's real, not what was planned:

```markdown
- `useLogEvent()` — returns `LogEvent`, `(eventName: string, parameters?: Record<string, unknown>) => void`. Stable across rerenders. Dual-transport: portal-report via lara-interactive-api `log()` (when embedded), GA4 via `window.gtag('event', …)` (when the gtag snippet has loaded — `VITE_GA_PROPERTY_ID` configured at build time). In dev, validates event name (snake_case, ≤ 40 chars) and params (≤ 25 keys, values ≤ 100 chars); throws on violation.
```

**Step 2: Update infrastructure-plan.md §3 component list**

Add `<Button>` to the components catalog. Below `<DataSubsection>` is the natural location:

```markdown
### `<Button>` component

Exported from the shared library; the first wrapper around a `react-aria-components` primitive per the Shared controls policy. Used wherever a sim needs an interactive press button.

```tsx
<Button action="play_pressed" actionParams={{ trial: "A" }} onPress={play}>
  Play
</Button>
```

Props: `action?: string` (snake_case event name; omitted disables logging), `actionParams?: Record<string, unknown>`, plus all react-aria `ButtonProps` (`isDisabled`, `onPress`, `aria-label`, `type`, …). The wrapper applies token-driven hover/press/focus/disabled treatment, auto-emits via `useLogEvent` when `action` is present, and forwards everything else to react-aria unchanged. Visual variants are intentionally not exposed yet — the demo uses one button shape everywhere; Phase 3 may add `variant?: …` if a control needs a lower-emphasis treatment.
```

**Step 3: Update infrastructure-plan.md §10 risks**

Add a note about portal-report event-shape compatibility being verified by Task 8's smoke test — point at the resolved decision.

**Step 4: Close UI design plan §15 Q9**

In `docs/ui-design-plan.md` §15, find Q9 (UI library) and mark it **Closed.** with a one-liner: "Resolved to `react-aria-components`. See infrastructure-plan.md §11 #9 and §3 'Shared controls policy.'"

**Step 5: Create `docs/adding-a-new-sim.md`**

A short how-to for sim authors. Covers:
- `yarn new-sim <name>` to scaffold
- `yarn install` to link
- `yarn gen-index` + `yarn gen-workflows` to refresh derived artifacts
- Edit `app.tsx`'s `simTitle` and `tagline`
- Replace the random-walk model in `src/model/` with your own
- (Optional) Wire AP state sync using lara-interactive-api's hooks directly — include a worked example like:
  ```tsx
  import { useInitMessage, useInteractiveState } from "@concord-consortium/lara-interactive-api";

  interface SavedState { trials: RecordedTrial[]; selectedId: string }
  const init = useInitMessage<{}, SavedState>();
  const [interactiveState, setInteractiveState] =
    useInteractiveState<SavedState>({ trials: [makeEmptyTrial()], selectedId: "…" });

  // Restore on init:
  useEffect(() => {
    if (init?.interactiveState) {
      setTrials(init.interactiveState.trials);
      setSelectedId(init.interactiveState.selectedId);
    }
  }, [init, setTrials, setSelectedId]);

  // Push on sim-state change:
  useEffect(() => {
    setInteractiveState({ trials, selectedId });
  }, [trials, selectedId, setInteractiveState]);

  // Suppress the standalone outer container when AP is providing chrome:
  const isEmbedded = init !== null;
  return <SimulationFrame standalone={!isEmbedded} … />;
  ```
- Naming conventions for log events (snake_case, ≤ 40 chars)
- Where to put assets (`src/assets/`)
- How to deploy (push to branch → S3; tag → versioned URL)

Target: 100–180 lines. Concrete code snippets. Link to the infra plan §3 for the API surface details.

**Step 6: (Optional) Touch up `packages/shared/README.md`**

If the README has a "components" or "hooks" section, add one-line entries for `Button` and `useLogEvent` so the package's public surface is discoverable from the source root. (lara-interactive-api state-sync hooks aren't re-exported by the shared barrel — sims import them directly — so the README doesn't list them.)

**Step 7: Run checks**

```bash
yarn lint
```

(Docs only; no typecheck / test run needed.)

**Step 8: Stop and wait for user review before doing anything else**

Suggest the commit message: `docs: lock in Phase 2c contracts; add adding-a-new-sim.md`

(Suggested files to stage when the user is ready: `docs/infrastructure-plan.md`, `docs/ui-design-plan.md`, `docs/adding-a-new-sim.md`, and `packages/shared/README.md` if touched.)

---

## Task 10: Full-repo verification

**Step 1: Run all the cross-cutting checks**

```bash
yarn typecheck
yarn lint
yarn test
yarn gen-index --check
yarn gen-workflows --check
```

Expected: all pass.

**Step 2: Confirm sims still build**

```bash
MASS_SIMS_VERSION_PATH=version/release yarn build
```

Expected: `sim-one`, `sim-two`, `starter` (template), `sim-frame-preview` (dev tool) all build cleanly.

**Step 3: Verify the gtag injection is gated on the env var**

```bash
# Without VITE_GA_PROPERTY_ID:
yarn workspace starter build
grep -c "googletagmanager" packages/starter/dist/index.html  # expect 0

# With it set:
VITE_GA_PROPERTY_ID=G-TEST123 yarn workspace starter build
grep -c "googletagmanager" packages/starter/dist/index.html  # expect 1+
grep -c "G-TEST123" packages/starter/dist/index.html         # expect 1+
```

**Step 4: End-to-end new-sim smoke**

```bash
yarn new-sim demo-throwaway
yarn install
yarn workspace demo-throwaway typecheck
yarn workspace demo-throwaway build
yarn gen-index
yarn gen-workflows
ls .github/workflows/sim-demo-throwaway.yml  # confirm exists

# Revert (don't commit the throwaway sim):
git checkout -- package.json index.html
rm -rf simulations/demo-throwaway .github/workflows/sim-demo-throwaway.yml
yarn install  # unlink
```

Expected: the throwaway sim scaffolds, builds, and registers its CI workflow without errors.

**Step 5: Final visual sweep**

```bash
yarn workspace starter dev
```

Open the printed URL and confirm:
- All Phase 2b visual checks still pass (trials, simulation view, data panel, About panel, reload warning, four-width responsive flex).
- Play / Pause / Step / Reset use the new shared `<Button>` (the styling should be visually identical to Phase 2b's buttons since the demo's button design hasn't changed).
- Press states feel right (hover background, active darker, focus outline visible via Tab).
- Disabled state works (Step disabled when complete; Reset disabled at frame 0).
- The browser console shows no errors from react-aria, lara-interactive-api, or the gtag plugin.

**Step 6: Smoke test deploy URLs**

After pushing the branch, confirm the CI matrix in GitHub Actions:
- `CI / checks` runs once.
- `Deploy sim-one` runs (path filter triggered by shared/** changes).
- `Deploy sim-two` runs (same reason).

(Each per-sim deploy may run because `packages/shared/**` changed in this branch — that's expected. Subsequent pushes that touch only one sim should only trigger that sim's workflow.)

No commit for Task 10 — verification only.

---

## Done criteria

- [ ] AP state-sync convention documented in infra plan §3 ("AP state sync" subsection); sims use `useInitMessage` / `useInteractiveState` from `@concord-consortium/lara-interactive-api` directly. No custom wrapper hook in shared.
- [ ] Starter sim is actually wired to AP saved state (Task 7): `SavedState` type defined, `useInitMessage` restores on init, `setInteractiveState` pushes on every `trials`/`selectedId` change. Standalone mode unaffected (hooks no-op). Tests cover restore, no-restore-when-null, and push-on-change.
- [ ] `useLogEvent` exported, tested, and documented in infra plan §3. Dual-transport: portal-report + GA4. GA injection is gated on `VITE_GA_PROPERTY_ID`; verified disabled when empty.
- [ ] `<Button>` exported, tested, and documented in infra plan §3. Built on `react-aria-components`. Auto-emits via `useLogEvent` when `action` prop is supplied.
- [ ] Starter's Play / Pause / Step / Reset migrated to shared `<Button>`. The four button presses emit log events in dev (visible in the browser console via the validation throw path if misnamed; visible in portal-report after Task 8's smoke test).
- [ ] `yarn new-sim <name>` scaffolds a new simulation from packages/starter. Validation rejects invalid names. Smoke-tested end-to-end in Task 10.
- [ ] `scripts/gen-workflows.ts` generates per-sim CI workflows. `--check` mode verifies they're up to date and is wired into CI.
- [ ] CI restructured: `ci.yml` runs cross-cutting checks; `sim-<name>.yml` runs build+deploy with path filters.
- [ ] AP smoke test (Task 8) verified: init/restore round-trip works, portal-report receives events, (optionally) GA4 DebugView receives events.
- [ ] `docs/infrastructure-plan.md` reflects the locked-in Phase 2c contracts. Q9 (UI library) closed.
- [ ] `docs/adding-a-new-sim.md` exists and walks an author through the scaffolding flow.
- [ ] `yarn typecheck && yarn lint && yarn test && yarn gen-index --check && yarn gen-workflows --check && yarn build` all green.

---

## Deferred follow-ups (out of scope here)

- Phase 3: port the remaining V2 controls (Slider, Switch, Select, Checkbox, NumberField, Table) as react-aria-components wrappers following the Button template.
- Phase 3: migrate Starter's walker-count slider, step-size slider, and frames-per-trial number input to the new shared controls.
- Phase 3: charting library choice (Recharts vs Visx vs raw canvas vs D3 — UI design plan §15 Q19).
- Phase 5: Playwright suite for critical paths in every sim, including an AP-embedded fixture page that automates the Task 8 smoke test.
- Phase 3: a multi-sim test harness workspace (`packages/sim-test-harness`) that loads every sim at the four target widths via `<iframe>` cards. Reuses `scripts/gen-index.ts`'s sim discovery; points at deployed branch URLs in CI or local dev URLs at the dev workstation. Complements `sim-frame-preview` (which is frame-only with placeholders) by surveying real sims across widths. Sized as a one-week add inside Phase 3; will be a Phase 5 input for visual-regression snapshots.
- Phase 4: a framework-level pattern for in-progress transient state escaping `useModelState` / `useSimulationRunner` to consumers outside the Simulation slot (e.g. live charts in the Data panel). The Starter's `output`-only data flow currently shows "No data" while a run is in progress; the first real sim with a live visualization will force the question and shape the abstraction (`onTransientChange` option, pub-sub primitive, hoisted transient state — TBD). A small starter-side callback (`onProgress` from `<SimulationView>` to App, App holds `liveSeries`, DataPanel prefers live over output) is a one-screen change that addresses the Starter's instructional-template gap without committing to a framework shape.
- `@axe-core/react` integration for dev-time a11y warnings (Phase 3 or 5).
- A dedicated `<TrialCard>` "add" variant or a more general dashed-card primitive to replace the Starter's ad-hoc "+ New" trial card with a shared component.
- A `useTrialList<I, O>` hook if the per-sim ad-hoc trial-list state proves repetitive across the next 2–3 sims.
- Localization / multi-locale support — repo is committed to English-only (decision #23).
- Custom domain GA4 properties per-sim (decision #30 keeps it repo-wide).
