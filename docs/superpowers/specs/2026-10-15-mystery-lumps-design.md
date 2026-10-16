# Mystery Lumps — design

**Story:** [MAS-57](https://concord-consortium.atlassian.net/browse/MAS-57)
**Date:** 2026-10-15
**Status:** approved design, not yet planned

## What it is

Five white lumps washed up on a beach. A student runs tests on them to work out what each
one is, and writes the argument up on paper. **The sim never asks for an identification and
never grades one** — its whole job is to produce observations a student can cite as evidence.

The lumps are seashell, sea salt crust, white sea glass, palm oil and paraffin wax. Handling
a lump names the salt and sorts the rest into a hard pair and a waxy pair; past that, every
claim has to rest on a reaction.

## The science model

Fixed assignment, the same for every student, so a class can talk about "lump C" and mean
the same thing:

| Lump | A | B | C | D | E |
|---|---|---|---|---|---|
| | paraffin wax | sea salt crust | white sea glass | palm oil | seashell |

Two actions are **free, repeatable and non-destructive**: *handle* and *waft*. Four are
**destructive — each lump has material for exactly one**: water, vinegar, warm bath, UV lamp.

### Observations

Nothing is interpreted for the student. Captions describe what happens; they never name a
substance or a class of substance ("a steady stream of small bubbles", never "a carbonate").

| | Handle | Water | Vinegar | Warm bath | UV lamp |
|---|---|---|---|---|---|
| **Sea salt** | a crust of small cube-shaped crystals | dissolves away, water stays clear | dissolves away, no bubbles | dissolves — faster the warmer it is | nothing |
| **Seashell** | hard and smooth, cool to the touch | nothing | **a steady stream of small bubbles** | nothing, at any temperature | nothing |
| **Sea glass** | hard and smooth, cool to the touch | nothing | nothing | nothing, at any temperature | **glows, immediately** |
| **Palm oil** | waxy and pale, gives under a fingernail | nothing | nothing | **slumps and runs from ~40 °C** | **glows**; long exposure also turns it rancid |
| **Paraffin** | waxy and pale, gives under a fingernail | nothing | nothing | **softens from ~60 °C but holds its shape** | long exposure yellows it, chalks the surface, makes it brittle |

Refined paraffin, seashell and salt **do not fluoresce**. Only sea glass and palm oil glow,
which is what gives the lamp a job nothing else can do.

### Settings

The two tests with a dial use dropdowns, matching Nor'easter:

- **Warm bath** — 20 °C, 40 °C, 60 °C, 80 °C. Salt dissolves at all four and visibly faster
  at the top. Palm oil runs from 40. Paraffin softens from 60. Shell and glass never change.
- **UV lamp** — a few seconds, an hour, a day, two weeks. Fluorescence is immediate at every
  exposure. Degradation needs the long end: palm oil goes rancid from *a day*, paraffin
  yellows and chalks only at *two weeks*.

### Smell

**Waft yields nothing until the lamp has done its work.** Fresh, all five lumps are small and
odorless; only UV-degraded palm oil smells. This is deliberate: waft is free, so if it
discriminated on its own it would solve the puzzle for nothing. It stays available afterwards,
on any lump, so a student can go back and find the smell late.

### What the puzzle costs

Handling names the salt and leaves two look-alike pairs. One test on *one member* of a pair
cracks that pair by elimination, so a sharp student finishes on **two tests** — vinegar or
lamp for the hard pair, bath or lamp for the waxy pair. A student who wants a reaction behind
every claim spends four or five. That gap between "solved" and "evidenced" is the thing the
paper assignment can ask about; the sim takes no position on it.

## What a student does

The stage always shows all five lumps in a row. A test animates the chosen lump into its
apparatus **in place**, and a spent lump keeps its end state afterwards — an empty tube where
the salt dissolved, a puddle where the palm oil ran. The row is therefore a picture of the
trial as well as a tray.

The two free actions are clicks on a lump in that row: **handle** it (a short animation of the
surface being pressed and turned) or **waft** it. Both work on any lump at any time, including
one whose test is already spent — which is how a student goes back and finds the rancid smell
after the lamp.

Destructive tests go through the settings grid, one at a time:

1. Choose **Lump**, choose **Test**, and choose the test's **Setting** if it has one (the
   Setting dropdown is disabled otherwise). Only lumps with material left are offered.
2. **Run.** The chosen lump animates in its apparatus for about four seconds, captioned with
   the time it stands for — "30 seconds", "two weeks under the lamp".
3. The result lands in the trial's card and in the Data panel, and that lump leaves the Lump
   dropdown.
4. Repeat until the lumps are used up or the student has what they need.

**New** starts a fresh trial: five new lumps of the same five substances, every budget
restored, and the previous trial's card stays on screen. **Reset Trial** clears the current
trial's results in place — cheaper than a new trial but it erases the record of what was tried,
which is why New is the better habit.

Animations run about four seconds regardless of the time they represent. The compression is
stated in the caption rather than hidden, and that caption doubles as the accessible
description.

## Layout

Shared three-region frame, built to Nor'easter's shipped look — pale blue surface, white
panels, blue borders, navy text, pill chips. (`docs/ui-design-plan.md` describes grey panels
with notched chips; it is stale, and this sim does not follow it.)

- **Trials** — one tall card per trial, accumulating a row per lump: lump letter, the test it
  was given, its setting, and a short result. `New` at the foot; reset on the selected card.
- **Simulation** — settings grid across the top (Lump / Test / Setting), the five-lump stage
  below it, `Run` and `Reset Trial` at the bottom. Handling and wafting are on the lumps
  themselves, not in the controls, so a free action can never be mistaken for spending one.
- **Data** — the selected trial's evidence in full: each lump's handling note and its test
  result as complete prose, with a "copy for my write-up" affordance. Since the sim asks for
  no identification, this panel is the deliverable.

## Under the hood

Scaffolded with `yarn new-sim mystery-lumps`; shared frame, controls and charts throughout, per
`docs/adding-a-new-sim.md`.

```
src/model/
  substances.ts   the five substances and the fixed lump assignment
  tests.ts        the six actions, which consume material, their settings
  observe.ts      observe(substance, test, setting) -> { caption, visual }
src/components/
  lump-row.tsx        the five lumps; click to handle or waft; holds end states
  test-stage.tsx      the apparatus a lump animates into, in place
  test-settings.tsx   the Lump / Test / Setting grid and Run
  trial-card-body.tsx what fills a shared <TrialCard>
  evidence-panel.tsx  the Data region
```

`observe()` is a pure function with no randomness — every fact in the table above lives there
and nowhere else, which is what the unit tests point at. State is the trial list plus the
selection; animation progress is never persisted.

### Saved state

```ts
interface LumpRecord {
  handled: boolean;
  wafted: boolean;
  result: { test: TestId; setting: SettingId | null } | null;
}
interface Trial { id: string; lumps: Record<LumpId, LumpRecord> }
interface SavedState { trials: Trial[]; selectedTrialId: string }
```

Captions are derived from `observe()` on render rather than stored, so a wording fix reaches
work a student saved earlier.

### Logging

`lump_handled`, `lump_wafted`, `test_run` (params: lump, test, setting), `trial_started`,
`trial_reset`. All snake_case, within GA4's limits.

## Testing

- **`observe()`** — every substance against every test and every setting, asserted against the
  table above. The bath and lamp thresholds get their own cases on both sides of each boundary
  (palm oil at 20 and 40, paraffin at 40 and 60, palm oil rancid at an hour and a day).
- **The one-shot rule** — a lump with a result is absent from the Lump dropdown; `New` restores
  every budget; `Reset Trial` restores the current trial's.
- **Free actions** — handling and wafting never consume a lump, and waft returns nothing until
  the lamp has degraded the palm oil.
- **Saved state** — a round trip through `SavedState` reproduces the trials and the selection.

## Deliberately out of scope

Identification UI and any notion of a right answer. Scoring. Varying the lump assignment per
student — rejected for fairness. A sixth substance. Sea glass color variants, and the
fluorescence of anything but sea glass and palm oil, both of which MAS-57 may revisit later.
