import { expect, test } from "@playwright/test";
import { BananasPage } from "../../pages/bananas-page";
import { BASELINE_CROSS, MAX_CROSSES, MAX_TRIALS } from "../../testdata/bananas-testdata";

// Keyboard focus / scroll-region e2e coverage for Bananas. These behaviors (react-aria
// keyboard-modality focus rings, real overflow driving tabindex) can't be observed in jsdom, so
// they're exercised here in a real browser. The spec uses BananasPage methods only (no raw
// locators) and starts each test from a fresh page. Runs once per viewport project — the height is
// a constant 562 across all four widths, so overflow states are deterministic.

let bananas: BananasPage;

test.beforeEach(async ({ page }) => {
  bananas = new BananasPage(page);
  await bananas.goto();
});

test.describe("Disabled Cross Plants stays keyboard-focusable", () => {
  // The shared Button now marks the disabled state with aria-disabled and keeps the element
  // focusable. Drive Cross Plants to the cap (MAX_CROSSES) so it disables, then prove it is
  // both aria-disabled AND still focusable.
  test("Cross Plants at MAX_CROSSES is aria-disabled but remains focusable", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < MAX_CROSSES; i++) await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(MAX_CROSSES);
    await expect(bananas.maxCrossesNotice).toBeVisible();

    // Disabled via aria-disabled, not a native disabled attribute.
    await expect(bananas.crossPlantsButton).toHaveAttribute("aria-disabled", "true");

    // Still in the tab order: focusing it makes it the active element (a native-disabled button
    // cannot receive focus, so this is the assertion that locks in the fix).
    await bananas.crossPlantsButton.focus();
    await expect(bananas.crossPlantsButton).toBeFocused();
  });
});

test.describe("Fungus switch keyboard activation", () => {
  // The switch is locked until both parents are picked (isFungusLocked). Pick parents but do NOT
  // cross — a cross re-locks the switch.
  test.beforeEach(async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    await expect(bananas.fungusSwitch).toBeEnabled();
  });

  // Enter toggles exactly once per press. A double-toggle would net to a no-op, so the first press
  // leaving it CHECKED (not unchecked) is what proves it fired exactly once.
  test("Enter toggles the switch once in each direction", async () => {
    await expect(bananas.fungusSwitch).not.toBeChecked();

    await bananas.fungusSwitch.focus();
    await bananas.press("Enter");
    await expect(bananas.fungusSwitch).toBeChecked();

    await bananas.press("Enter");
    await expect(bananas.fungusSwitch).not.toBeChecked();
  });

  // Space is react-aria's native activation; assert it also toggles exactly once (no double-toggle).
  test("Space toggles the switch once", async () => {
    await expect(bananas.fungusSwitch).not.toBeChecked();

    await bananas.fungusSwitch.focus();
    await bananas.press(" ");
    await expect(bananas.fungusSwitch).toBeChecked();
  });
});

test.describe("Locked fungus switch stays keyboard-focusable", () => {
  // Crossing locks the fungus switch (isFungusLocked). Mirror the Cross Plants case: the locked
  // switch is marked aria-disabled but stays in the tab order (aria-disabled, not native disabled).
  test("after a cross the fungus switch is aria-disabled but remains focusable", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(1);

    // Locked via aria-disabled, not a native disabled attribute.
    await expect(bananas.fungusSwitch).toHaveAttribute("aria-disabled", "true");

    // Still in the tab order: a native-disabled input can't take focus, so this locks in the fix.
    await bananas.fungusSwitch.focus();
    await expect(bananas.fungusSwitch).toBeFocused();
  });
});

test.describe("Fungus switch keyboard focus ring", () => {
  test("keyboard focus draws the outline on the container, not the inner button", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    await expect(bananas.fungusSwitch).toBeEnabled();

    await bananas.focusFungusSwitchViaKeyboard();

    // react-aria marks the inner control under keyboard modality…
    await expect(bananas.fungusSwitchButton).toHaveAttribute("data-focus-visible", "true");

    // …and the CSS `:has(...)` rule draws the ring on the CONTAINER (`.fungus-switch`).
    await expect(bananas.fungusSwitchContainer).toHaveCSS("outline-style", "solid");
    await expect(bananas.fungusSwitchContainer).toHaveCSS("outline-color", "rgb(0, 95, 204)"); // $focus-blue (#005FCC)
  });
});

test.describe("Scroll-region tabindex on overflow", () => {
  // Offspring grid: no tabindex on a fresh (0-cross) trial; gains tabindex="0" once MAX_CROSSES
  // crosses overflow the fixed-height grid (same overflow reliability as the pill-chip scenario).
  test("offspring grid becomes focusable only when it overflows", async () => {
    await expect(bananas.offspringGrid).not.toHaveAttribute("tabindex");

    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < MAX_CROSSES; i++) await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(MAX_CROSSES);

    await expect(bananas.offspringGrid).toHaveAttribute("tabindex", "0");
  });

  // Trials list: with only trial A the list fits (no tabindex); at MAX_TRIALS it overflows and the
  // shared Section scroll container gains tabindex="0".
  test("trials list becomes focusable only when it overflows", async () => {
    await expect(bananas.trialsScrollRegion).not.toHaveAttribute("tabindex");

    for (let i = 0; i < MAX_TRIALS - 1; i++) await bananas.addTrial();
    await expect(bananas.maxTrialsNotice).toBeVisible();

    await expect(bananas.trialsScrollRegion).toHaveAttribute("tabindex", "0");
  });

  // About modal body: the About content is long enough to overflow at height 562, so the body is a
  // focusable scroll region. Unlike the grid/trials tests above — which DRIVE the overflow by adding
  // crosses/trials, so tabindex="0" transitively proves overflow — nothing here controls the body's
  // overflow, so we assert the precondition (`overflows`) explicitly before checking tabindex.
  test("About modal body is focusable while its content overflows", async () => {
    await bananas.openAbout();
    expect(await bananas.overflows(bananas.modalBody)).toBe(true);
    await expect(bananas.modalBody).toHaveAttribute("tabindex", "0");
  });
});

test.describe("Offspring rows roving tabindex + arrow navigation", () => {
  // Make three crosses so wrap-around has a distinct middle row.
  test.beforeEach(async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < 3; i++) await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(3);
  });

  test("ArrowDown moves focus between rows and wraps at the end", async () => {
    await bananas.tabbableCrossRowButton.focus();
    await expect(bananas.crossRowButton(0)).toBeFocused();

    await bananas.press("ArrowDown");
    await expect(bananas.crossRowButton(1)).toBeFocused();
    await expect(bananas.crossRowButton(1)).toHaveAttribute("tabindex", "0");

    await bananas.press("ArrowDown"); // → row 2
    await bananas.press("ArrowDown"); // wraps → row 0
    await expect(bananas.crossRowButton(0)).toBeFocused();
  });

  test("the offspring rows are a single tab stop", async () => {
    await bananas.crossRowButton(1).focus();

    // Tab out of the group lands on the next control — the ControlBar's Fungus switch, which
    // follows the offspring grid in the DOM.
    await bananas.press("Tab");
    await expect(bananas.fungusSwitch).toBeFocused();

    // Shift+Tab back into the group lands on the tabbable (roving) row, not an arbitrary one.
    await bananas.press("Shift+Tab");
    await expect(bananas.crossRowButton(1)).toBeFocused();
  });

  test("Enter toggles the focused row's selection", async () => {
    await bananas.crossRowButton(0).focus();
    await bananas.press("Enter");
    expect(await bananas.isCrossSelected(0)).toBe(true);
  });
});

test.describe("Pill close returns focus to the deselected row", () => {
  // Selecting a cross surfaces the Data-panel filter chip with a close (deselect) button. Closing
  // it clears the selection AND returns keyboard focus to the row that was selected, so the user
  // isn't stranded on the removed pill.
  test.beforeEach(async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < 2; i++) await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(2);
  });

  test("closing the pill via keyboard moves focus back to the selected row", async () => {
    // Select the second cross → the pill chip + close button appear.
    await bananas.selectCross(1);
    await expect(bananas.pillChip).toBeVisible();

    // Activate the close button with the keyboard (Enter) to exercise the real keyboard flow.
    await bananas.closePillViaKeyboard();

    // The chip is gone (selection cleared)...
    await expect(bananas.pillChip).toHaveCount(0);
    // ...and focus is on the offspring row that was selected (index 1).
    await expect(bananas.crossRowButton(1)).toBeFocused();
  });
});

test.describe("Scroll-region focus ring visibility", () => {
  // Optional coverage: keyboard focus on the overflowing offspring grid shows its sibling ring
  // (native CSS :focus-visible on a plain scroll region). Deterministic here because the grid
  // reliably overflows at MAX_CROSSES.
  test("keyboard focus on the overflowing offspring grid reveals its ring", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < MAX_CROSSES; i++) await bananas.crossPlants();
    await expect(bananas.offspringGrid).toHaveAttribute("tabindex", "0");

    // The ring is hidden until the region has keyboard focus.
    await expect(bananas.offspringGridFocusRing).toHaveCSS("display", "none");

    await bananas.offspringGrid.focus();
    await bananas.press("Shift+Tab");
    await bananas.press("Tab");

    await expect(bananas.offspringGridFocusRing).toHaveCSS("display", "block");
  });
});
