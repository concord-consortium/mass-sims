# Logged Events — Nor'easter

This document lists every analytics event the Nor'easter simulation logs, for researchers analyzing
portal-report data and for tools/LLMs that need a single reference.

Events are emitted through the shared controls' auto-emit: passing an `action` (and optional
`actionParams`) to a shared `<Slider>`, `<NumberField>`, `<Select>`, `<Switch>`, `<Checkbox>`, or
`<Button>` makes it call `useLogEvent` on its natural commit event. `useLogEvent` dual-transports each
event to [`@concord-consortium/lara-interactive-api`](https://github.com/concord-consortium/lara-interactive-api)'s
`log(action, data)` (→ portal-report when embedded) and to GA4 via `gtag` (when configured). Both
transports silently no-op when unavailable. Event names are snake_case; payloads are flat objects.

## Common parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `trial` | string | The active trial's label. Present on every event. |

## Events

The Simulation and Data panels have no controls yet — their content, and the events it emits, arrive
in later stories. Today the only events come from the shared Trials column:

| Event | Trigger | Parameters |
| --- | --- | --- |
| `trial_added` | The **+ New** card creates a trial | `{ trial }` |
| `trial_selected` | A trial is selected (card click or keyboard nav) | `{ trial, previous }` |
| `trial_reset` | The selected trial's **Reset** affordance is pressed | `{ trial }` |

## Notes

- `trial_added` fires immediately before the `trial_selected` for the same new trial (creating a
  trial also selects it — two distinct actions).
- `trial_selected` carries `previous`, the letter that was selected before the change.
