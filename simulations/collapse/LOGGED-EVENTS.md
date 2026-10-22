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

## Notes

- `trial_selected` carries `previous`, the letter that was selected before the change. It is skipped
  when the target is already the active trial — re-clicking or keyboard-navigating back onto the
  selected card logs nothing.
- Collapse has four fixed trials (A–D), so there is no `trial_added` event.
- These are the only events Collapse logs; new interactions add their events to this file.
