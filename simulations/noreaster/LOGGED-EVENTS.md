# Logged Events — Nor'easter

This document lists every analytics event the Nor'easter simulation logs, for researchers analyzing
portal-report data and for tools/LLMs that need a single reference.

Events reach `useLogEvent` two ways: the shared **controls' auto-emit** (passing an `action`/`actionParams`
to a shared `<Select>`, `<Button>`, `<Switch>`, etc. logs on its natural commit — used by the air-mass
selectors) and **explicit `useLogEvent` calls** in handlers that need computed data (the run's setup +
outcome) or whose control can't auto-emit (the raw map-view switch, the About-modal open/close at the
app root). `useLogEvent` dual-transports each event to
[`@concord-consortium/lara-interactive-api`](https://github.com/concord-consortium/lara-interactive-api)'s
`log(action, data)` (→ portal-report when embedded) and to GA4 via `gtag` (when configured). Both
transports silently no-op when unavailable. Event names are snake_case; payloads are flat objects.

## Common parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `trial` | string | The active trial's label. Present on every **trial-specific** event — i.e. every event except the global `info_modal_opened` / `info_modal_closed`. |

## Events

### Trials column (shared)

| Event | Trigger | Parameters |
| --- | --- | --- |
| `trial_added` | The **+ New** card creates a trial | `{ trial }` |
| `trial_selected` | A trial is selected (card click or keyboard nav) | `{ trial, previous }` |
| `trial_reset` | A trial's **Reset** affordance is pressed — the Trials-column per-trial reset **or** the Simulation panel's **Reset Trial** button | `{ trial }` |

### Simulation panel

| Event | Trigger | Parameters |
| --- | --- | --- |
| `air_mass_selected` | An air-mass selector commits a value | `{ trial, airMass, attribute, value }` |
| `simulation_run_started` | **Run** (or **Replay**) is pressed | `{ trial, replay, outcome, landPathway, landHumidity, landTemperature, oceanPathway, oceanHumidity }` |
| `simulation_run` | The run animation finishes and the outcome is committed | `{ trial, replay, outcome, landPathway, landHumidity, landTemperature, oceanPathway, oceanHumidity }` |
| `map_view_changed` | The Street/Satellite map-view toggle is switched | `{ trial, view }` |

### About modal (shared)

| Event | Trigger | Parameters |
| --- | --- | --- |
| `info_modal_opened` | The **About** modal is opened | _(none)_ |
| `info_modal_closed` | The **About** modal is closed (close button, Escape, or toggling the About button) | _(none)_ |

## Notes

- `trial_added` fires immediately before the `trial_selected` for the same new trial (creating a
  trial also selects it — two distinct actions).
- `trial_selected` carries `previous`, the letter that was selected before the change.
- `air_mass_selected` covers all five selectors; the field is identified by `airMass`
  (`"land"` | `"ocean"`) + `attribute` (`"pathway"` | `"humidity"` | `"temperature"`), with `value`
  the chosen option. (Ocean Temperature is derived, not selected, so it emits no event.)
- `simulation_run_started` fires on the **Run/Replay press** (the attempt); `simulation_run` fires at
  **finalize**, when the animation finishes and the outcome commits. Both carry `replay` (`false` on the
  first run of a trial, `true` on a Replay) and the resolved `outcome` (`"strong"` | `"moderate"` |
  `"weakCoastal"` | `"humidNoStorm"` | `"windy"` | `"fair"`).
- **Run setup fields:** both run events also carry the trial's full air-mass setup at run time — the
  five student selections `landPathway` (`"N/NW"` | `"W"`), `landHumidity` / `oceanHumidity` (`"Dry"` |
  `"Humid"`), `landTemperature` (`"Cold"` | `"Warm"`), and `oceanPathway` (`"S/SE"` | `"NE"`). This makes
  a single run record reconstruct the whole experiment (setup + outcome). Ocean **temperature** is
  intentionally omitted — it is derived from `oceanPathway` (`S/SE → Warm`, `NE → Cool`), not a student
  selection. The setup is captured when the run is armed and reused at finalize, so a completed run's
  start and completion events report identical setup values — a live edit to the selections mid-run
  won't change them. (A Reset instead cancels the run, so only the start event is emitted; see *Counting
  runs* below.)
- **Counting runs:** `simulation_run_started` = attempts, `simulation_run` = completions. A run aborted
  before finalize (Reset, a trial switch, AP hydration, or a backgrounded tab that never resumes) emits
  only the start — so the difference between the two is the abandon rate.
- `map_view_changed` carries the new `view` (`"street"` | `"satellite"`).
- `info_modal_opened` / `info_modal_closed` carry **no payload** (the About modal is global, not
  trial-scoped) and never fire on initial page load — only on real open↔close transitions.
