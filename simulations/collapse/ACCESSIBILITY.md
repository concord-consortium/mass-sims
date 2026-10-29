# Accessibility — Collapse!

The accessibility behavior of the controls only Collapse has. The cross-cutting rules every sim
follows (the Trials listbox, the one `<Announcer>`, the disabled-control split, motion) are in the
[shared conventions](../../docs/accessibility.md); this file covers what Collapse adds on top.

---

## Timeline — custom slider

The Collapse timeline's flag is a hand-rolled **`role="slider"`**, not the shared `<Slider>`: its
values sit at non-linear positions measured from the label widths, which react-aria's linear thumb
can't express.

- **Keys (the APG slider keys):** ArrowRight / ArrowDown step one value later, ArrowLeft / ArrowUp one
  earlier, Home jumps to 200,000 and End to 0. There are only sixteen values, so there is no PageUp /
  PageDown. The name is the fixed `"Years before collapse"`; `aria-valuetext` reads
  `"<n> years before collapse"`.
- **Left / Right and Home / End run opposite to APG.** `aria-valuenow` is the number of years before
  collapse, so ArrowRight and End make it smaller, and Home goes to `aria-valuemax`. APG expects
  Right to increase the value and Home to go to the minimum. (Up / Down match APG: Up makes the
  number larger.) This keeps Left / Right matching the screen, where Right moves the flag toward the
  collapse, but anything that judges direction from `aria-valuenow` and its min and max reads Right as
  a decrease.
- **The landmarks are a readable list, separate from the value.** The dated stops are an `<ol>` named
  `"Timeline landmarks"`, one `<li>` per stop in order, with the icons and dots `aria-hidden`. Two
  items get visually-hidden context: the 0 stop adds "(the collapse)" and the end marker reads
  "current year <year>". The list is not focusable; the slider is the one tab stop.
- **Pressing the flag never changes the value.** A press on the flag keeps the pointer's offset from
  the handle, so the value moves only once the handle is dragged to another value. A press anywhere
  else on the timeline (a landmark's icon, dot, or label, or the rail between them) snaps to the
  nearest value. Either press focuses the flag, so the arrow keys work at once.
- **No focus ring after a pointer press.** Chrome shows `:focus-visible` when a press focuses the
  flag, so a `no-ring` class hides the outline after a press. Any other focus, a blur, or a key
  brings it back.
- **Narration:** the slider does not announce; `aria-valuetext` is how a slider reports its value. The
  stepper's Earlier / Later arrows do announce the new value through the shared `<Announcer>`, since
  their names say what they do, not where they landed. The stepper's number is `aria-hidden`, so the
  value is not read a third time.
- The arrows are shared `<Button>`s, so at either end they are `aria-disabled` and stay focusable (see
  the disabled-control split in the [shared conventions](../../docs/accessibility.md)).

---

## Data table

The Collapse data table is a **native `<table>`, not a `role="grid"`**. The grid pattern pays off
when a student moves cell to cell, or when tabbing every row would be too slow. Neither is true
here: the three measurement cells are not interactive, and a trial has a handful of rows. So the
table keeps plain table semantics, which is what most design systems ship for a data table with row
actions.

- **One table.** A `caption` (visually hidden) names the trial and its row count: "Samples for
  trial A: 3 rows." The header row and the average row are sticky cells in the same table as the
  rows. The design mockup split these into three tables, so that its scrollbar would run beside the
  rows only. That was not copied: it put the sort buttons in a `role="presentation"` table, away
  from the column headers they sort, and needed `aria-hidden` patches against double announcements.
- **Sortable headings (the APG sortable-table pattern).** Each measurement heading is a `<button>`
  inside its `<th scope="col">`, and `aria-sort` (`ascending` / `descending` / `none`) is on that
  `th`. The button's name is its visible text, unit included ("Erosion rate (mm/1,000 yr)"), so
  voice control users can say what they see. A press cycles ascending → descending → not sorted,
  and announces the new state ("Sorted by Erosion rate, lowest first."). The picture and delete columns
  have visually hidden headings ("Cave", "Delete row").
- **Rows are tab stops.** Each row has `tabindex="0"` and an `aria-label` with its three values
  ("Sample at 150,000 years before collapse, erosion rate 26 mm per 1,000 years, rock above cave
  7,300 mm", plus ", collapsed" on the sample where the roof failed). Click, Enter, or Space selects
  a row; doing it again deselects it. The selected row has **`aria-current="true"`**, not
  `aria-selected`, which only means something in a grid, listbox, or tree. Each row's delete button
  is its own tab stop, named "Delete the sample at 150,000 years before collapse". The thumbnail is
  `aria-hidden`.
- **Arrow keys are a fast path on top of Tab.** Tab still walks row, delete button, row, delete
  button. In addition: ArrowUp / ArrowDown / Home / End move between rows (staying in the delete
  column when on a delete button); ArrowRight goes from a row to its delete button and ArrowLeft
  comes back; ArrowUp from the top row goes to the heading the student came down through (or the
  first heading). On a heading, ArrowLeft / ArrowRight move between headings and ArrowDown enters
  the rows at the top.
- **The focus ring is a class, `.kb-focus`.** It is set only when the last input was the keyboard.
  `:focus-visible` is not enough: it does not match the programmatic focus the arrow keys use, so
  arrowing would move an invisible focus. `:focus` is wrong the other way, because a row also takes
  focus on a click. The ring is two rings, white outside blue, because it runs beside the
  near-black thumbnail.
- **Focus after a delete** goes back to the same row position (or its delete button), clamped to
  the last row. When the last row is deleted, it goes to the first sort heading, never to the page.
- **The scroller takes no `tabindex`.** Its rows are focusable, so the keyboard can already reach
  everything in it and scroll it. It is not a `useScrollFocusRing` region.
- **Motion.** Rows slide to their new seats after a sort, a delete, or a new sample, and a new
  sample scrolls into view smoothly. Under `prefers-reduced-motion` the rows jump and the scroll is
  instant.
