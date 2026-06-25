# Logged Events — Bananas

This document lists every analytics event the Bananas simulation logs, for researchers
analyzing portal-report data and for tools/LLMs that need a single reference.

Events are emitted through the shared `useLogEvent` hook, which dual-transports each event to
[`@concord-consortium/lara-interactive-api`](https://github.com/concord-consortium/lara-interactive-api)'s
`log(action, data)` (→ portal-report when embedded) and to GA4 via `gtag` (when configured).
Both transports silently no-op when unavailable. Event names are snake_case; payloads are flat
objects.

## Common parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `trial` | `"A"`–`"J"` | The trial letter the action acted on. Present on every per-trial event. |

## Events

| Event | Trigger | Parameters |
| --- | --- | --- |
| `parent_1_set` | The **Parent 1** dropdown selection changes | `{ value: ParentId, trial }` |
| `parent_2_set` | The **Parent 2** dropdown selection changes | `{ value: ParentId, trial }` |
| `fungus_set` | The **Fungus** switch is toggled | `{ value: boolean, trial }` |
| `plants_crossed` | **Cross Plants** is pressed and a cross is actually made | `{ trial, generation: number, offspring: number, healthy: number, infected: number }` |
| `trial_reset` | A trial is reset — via the control-bar **Reset Trial** button **or** a trial card's reset overhang | `{ trial }` |
| `trial_added` | A new trial is created via the **+ New** card | `{ trial }` |
| `trial_selected` | The active trial changes — card click, keyboard navigation, or the auto-select after adding a trial | `{ trial, previous }` |
| `info_modal_opened` | The **About** modal is opened | _(none)_ |
| `info_modal_closed` | The **About** modal is closed (close button, Escape, or toggling the About button) | _(none)_ |

## Notes

- **`ParentId`** is one of `"wild-w1"`, `"wild-w2"`, `"wild-w3"`, `"cavendish-c1"`, `"cavendish-c2"`.
- **`plants_crossed`** is emitted from the consumer's press handler *after* the cross runs, so the
  result counts are real:
  - `generation` — the cross number, 1-based (the first cross is `generation: 1`).
  - `offspring` — number of plants in the new cross (5–20).
  - `healthy` / `infected` — split of `offspring` by phenotype (`healthy` = not infected). They always
    sum to `offspring`.
- **`trial_reset`** uses one canonical name for both reset paths, so portal-report sees a single
  "trial was reset" event regardless of which affordance triggered it. The control-bar button uses the
  active trial's letter; the per-card overhang uses that card's letter.
- **`trial_selected`** is skipped when the target equals the current trial (re-selecting the active
  trial logs nothing). Adding a trial emits `trial_added` **then** `trial_selected` — two distinct
  actions (a trial was created, and the user is now viewing it).
- **`info_modal_*`** carry no payload (the modal is global, not trial-scoped) and never fire on initial
  page load — only on real open↔close transitions.

## Not logged (intentional)

Cross-row selection (clicking an offspring row to filter the Data panel), info-modal drag/reposition,
pill-chip click-to-scroll, and hydration / saved-state restore (`applySnapshot`) are deliberately not
logged — they are high-frequency UI navigation or non-student actions, not meaningful for
portal-report.
