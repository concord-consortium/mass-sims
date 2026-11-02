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

---

## Compare Trials

The Compare Trials view shows all four trials' samples side by side, over the Trials and Simulation
panels. It is a hand-built **`role="dialog"`** named "Compare trials", like the About panel, not a
react-aria `Modal`.

- **Not `aria-modal`.** `aria-modal` tells assistive tech to ignore everything outside the dialog,
  and the one live region is outside it, so every announcement would go silent. The view makes the
  rest of the frame **`inert`** instead: both panels, the title bar (so About cannot open over the
  view), and an About panel that was already open, which is also hidden until the view closes and
  then comes back where it was. The live region is outside the frame, so it is never inert. A second
  live region inside the view, so that `aria-modal` could be used, was considered and not used: it
  breaks the one-`<Announcer>` rule, a region added with its text already in it is often not read
  (so "Comparing all four trials." would be lost), and `aria-modal` does not stop the mouse from
  reaching the title bar, so part of the `inert` work would stay.
- **The opener only opens.** The Compare Trials button is in the Simulation panel, which is inert
  while the view is open, so it cannot close it. It has `aria-expanded`. The view closes with its
  close button ("Close the trial comparison") or Escape.
- **Focus.** Opening moves focus to the close button. Closing returns it to the Compare Trials
  button. The order matters: `focus()` on an element inside an inert subtree does nothing, so
  `inert` is removed first and focus moves after. The view itself has `tabindex="-1"`, so a click on
  its text focuses the view, not the page, and Escape still closes it. Tab and Shift+Tab are trapped inside the view; the
  trap is needed even with the frame inert, because when the sim is embedded the page around the
  frame is not.
- **Four tables, one per trial.** Each column is a native table, as the data table is, with a
  visually hidden caption naming the trial and its conditions: "Trial A, Limestone, Dry, under 10
  rainy days a year: 3 samples" (or "no samples yet"). The badge, conditions, and note above each
  table are `aria-hidden`, since the caption says the same.
- **Sortable headings.** The visible headings are short ("Years", "Rate", "Rock"); the legend under
  the title says what each stands for. Each button's name is the full column name, the same as the
  data table's ("Erosion rate (mm/1,000 yr)"), so the visible word is in the name and a voice
  control user says the same thing in both places. The sort is shared with the data table: a press
  in any column reorders all four tables and the data table, sets `aria-sort` on that column's `th`
  in every table, and announces as the data table does.
- **Rows.** Each row's `aria-label` starts with its trial: "Trial B, 0 years before collapse,
  erosion rate 26 mm per 1,000 years, rock above cave 2,800 mm, collapsed". Each column's rows have
  one tab stop, the first row, so coming back to a column starts at the top. The thumbnail is
  `aria-hidden`.
- **Linked and pinned years.** A year is what the four trials share. Hovering a row, or focusing
  it with the keyboard, gives every row with that year the hover background in every column. While
  the pointer is on a row, its year is shown; when it leaves, the focused row's year comes back. Click, Enter, or Space
  pins the year: the pinned rows have **`aria-current="true"`**, the selected-row fill, and the
  left marker, and the announcement names where the year was sampled: "50,000 years before collapse
  pinned. Sampled in trials A, C; not in B, D." ("Sampled in all four trials." when every trial has
  it). Pressing a pinned row again clears the pin ("Pin cleared."). The view opens with the selected
  row's year pinned.
- **Keys, on top of Tab.** Tab reaches the close button, all twelve headings, and one row in
  each column that has rows.
  - ArrowUp / ArrowDown / Home / End move within a column. ArrowUp from the first row goes to the
    heading the student came down through, if it is in that column, else the column's first heading.
  - ArrowLeft / ArrowRight on a row move straight across to the same row position in the next column
    that has rows, never by year: the linked year already shows where that year is. The position is
    kept across a shorter column, so crossing it does not lose the place.
  - On a heading, ArrowLeft / ArrowRight move through all twelve headings in order, and ArrowDown
    enters that column's first row.
- **The focus ring** is the data table's: the `.kb-focus` class, set only when the last input was
  the keyboard, drawn as two rings, white outside blue.
- **The scrollers take no `tabindex`.** Every row is focusable, so the keyboard can already reach
  everything in them.
- **Motion.** Pinning a year scrolls each column's topmost row with that year into view smoothly,
  and a sort slides each column's rows to their new seats. Under `prefers-reduced-motion` the rows
  jump and the scroll is instant.
- **Possible shared code.** The focus trap (`useFocusTrap`) and the inert / focus lifecycle
  (`useDialogLifecycle`) are in `src/components/compare-trials/`. No other sim needs them yet. If a
  second sim needs a dialog like this one, move them to the shared package then, or wrap react-aria's
  `FocusScope`, rather than writing them again.
