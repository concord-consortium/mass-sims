# Logged Events — Nor'easter

This document lists every analytics event the Nor'easter simulation logs, for researchers analyzing
portal-report data and for tools/LLMs that need a single reference.

Events reach `useLogEvent` two ways: the shared **controls' auto-emit** (passing an `action`/`actionParams`
to a shared `<Select>`, `<Button>`, `<Switch>`, etc. logs on its natural commit — used by the air-mass
selectors) and **explicit `useLogEvent` calls** in handlers that need computed data (Run's outcome) or
whose control can't auto-emit (the raw map-view switch). `useLogEvent` dual-transports each event to
[`@concord-consortium/lara-interactive-api`](https://github.com/concord-consortium/lara-interactive-api)'s
`log(action, data)` (→ portal-report when embedded) and to GA4 via `gtag` (when configured). Both
transports silently no-op when unavailable. Event names are snake_case; payloads are flat objects.

> **Provisional:** the Simulation-panel event names/params below are wired in MAS-30; the definitive
> analytics catalog is the logging story's (MAS-34) and may rename or extend them.

## Common parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `trial` | string | The active trial's label. Present on every event. |

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
| `simulation_run` | **Run** (or **Replay**) is pressed | `{ trial, replay, outcome }` |
| `map_view_changed` | The Street/Satellite map-view toggle is switched | `{ trial, view }` |

## Notes

- `trial_added` fires immediately before the `trial_selected` for the same new trial (creating a
  trial also selects it — two distinct actions).
- `trial_selected` carries `previous`, the letter that was selected before the change.
- `air_mass_selected` covers all five selectors; the field is identified by `airMass`
  (`"land"` | `"ocean"`) + `attribute` (`"pathway"` | `"humidity"` | `"temperature"`), with `value`
  the chosen option. (Ocean Temperature is derived, not selected, so it emits no event.)
- `simulation_run` carries `replay` (`false` on the first run of a trial, `true` on a Replay) and the
  resolved `outcome` (`"strong"` | `"moderate"` | `"fair"`).
- `map_view_changed` carries the new `view` (`"street"` | `"satellite"`).
