# Logged Events — Starter

This document lists every analytics event the Starter simulation logs, for researchers analyzing
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

For value-bearing controls the shared wrapper emits `{ value, ...actionParams }`; `<Button>` emits the
`actionParams` only (no `value`).

## Events

| Event | Trigger | Parameters |
| --- | --- | --- |
| `walkers_set` | The **Walker Count** slider is committed | `{ value: number, trial }` |
| `step_size_set` | The **Step Size** slider is committed | `{ value: number, trial }` |
| `frames_per_trial_set` | The **Frames per Trial** number field changes | `{ value: number, trial }` |
| `dot_color_set` | The **Dot Color** dropdown selection changes | `{ value: string, trial }` |
| `show_origin_set` | The **Show origin** switch is toggled | `{ value: boolean, trial }` |
| `large_dots_set` | The **Large dots** checkbox is toggled | `{ value: boolean, trial }` |
| `play_pressed` | The **Play / Pause** button is pressed while stopped/paused (starts playback) | `{ trial }` |
| `pause_pressed` | The **Play / Pause** button is pressed while playing (pauses playback) | `{ trial }` |
| `step_pressed` | The **Step** button is pressed | `{ trial }` |
| `reset_pressed` | The **Reset** button is pressed | `{ trial }` |

## Notes

- The **Play / Pause** control is a single button whose event name flips with state: it emits
  `play_pressed` when starting playback and `pause_pressed` when pausing.
- Slider events (`walkers_set`, `step_size_set`) fire on the committed value, not on every drag tick.
