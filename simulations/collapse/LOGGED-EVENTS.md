# Logged Events — Collapse!

This document lists every analytics event the Collapse! simulation logs, for researchers analyzing
portal-report data and for tools/LLMs that need a single reference.

Events are emitted through the shared `useLogEvent` hook, which dual-transports each event to
[`@concord-consortium/lara-interactive-api`](https://github.com/concord-consortium/lara-interactive-api)'s
`log(action, data)` (→ portal-report when embedded) and to GA4 via `gtag` (when configured). Both
transports silently no-op when unavailable. Event names are snake_case; payloads are flat objects.

## Common parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `trial` | string | The trial's letter (`"A"`–`"D"`). Present on every event. |

## Events

### Trials column (shared)

| Event | Trigger | Parameters |
| --- | --- | --- |
| `trial_selected` | A trial is selected (card click or keyboard nav) | `{ trial, previous }` |
| `trial_reset` | The selected trial's **Reset** affordance in the Trials column is pressed | `{ trial }` |

### Simulation panel

| Event | Trigger | Parameters |
| --- | --- | --- |
| `sample_years_set` | The timeline value changes, from the timeline slider or the year stepper's arrows | `{ trial, value, previous, source }` |

### Data table

| Event | Trigger | Parameters |
| --- | --- | --- |
| `sample_taken` | The **Sample** button is pressed | `{ trial, id, years, rate, roof, collapsed, sampleCount }` |
| `sample_selected` | A table row is selected or deselected (click, Enter, or Space) | `{ trial, id, years, selected }` |
| `sample_deleted` | A row's delete button is pressed | `{ trial, id, years, remaining }` |
| `table_sorted` | A column heading is pressed | `{ trial, key, direction }` |

## Notes

- `trial_selected` carries `previous`, the letter that was selected before the change. It is skipped
  when the target is already the active trial — re-clicking or keyboard-navigating back onto the
  selected card logs nothing.
- Collapse has four fixed trials (A–D), so there is no `trial_added` event.
- `sample_years_set`: `value` and `previous` are in years before collapse (one of the sixteen timeline
  values, 200000 down to 0). `source` is `"slider"` (keyboard or pointer on the timeline) or
  `"stepper"` (the Earlier / Later arrows). Each key press or arrow press is one event. A pointer
  press and drag on the timeline is also one event, sent when the pointer is released, with
  `previous` the value before the press. It fires only when the value changes, so a press at
  either end, or a drag that ends on its starting value, logs nothing. The value is shared by all
  trials; `trial` is the one selected when it changed.
- `id` identifies the sample within its trial: `trial` + `id` is unique, and the same pair appears
  on the sample's `sample_taken`, `sample_selected`, and `sample_deleted` events. Ids count up from
  1 in each trial and are never reused, even after a delete or a reset, so they can have gaps. The
  same year can be sampled more than once; `id` tells those samples apart, `years` does not.
- `sample_taken`: `rate` is the reported erosion rate in mm per 1,000 years, and `roof` is the rock
  left above the cave in mm. Both are logged unrounded; the table shows them rounded. `collapsed`
  is `true` when `roof` is at or below the 2,800 mm collapse level. `sampleCount` is the trial's
  number of samples after this one.
- `sample_selected`: `selected` is `true` when the row became selected and `false` when the
  selected row was pressed again to deselect it. `years` is that row's year either way. Taking a
  sample also selects the new row, but logs only `sample_taken`.
- `sample_deleted`: `remaining` is the trial's number of samples after the delete.
- `table_sorted`: `key` is the pressed column: `"years"`, `"rate"`, or `"roof"`. `direction` is the
  state after the press: `"ascending"`, `"descending"`, or `"none"` (back to the order the samples
  were taken in). Each heading cycles through the three. The sort is shared by all trials; `trial`
  is the one selected when it was pressed.
- These are the only events Collapse logs; new interactions add their events to this file.
