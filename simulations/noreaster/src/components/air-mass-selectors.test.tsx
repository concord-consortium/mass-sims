import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Select> imports useLogEvent (→ lara's log transport); mock the transport so mounting
// the inert dropdowns doesn't reach the real lara-interactive-api in jsdom.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { AirMassSelectors } from "./air-mass-selectors";

// AirMassSelectors is a pure presentational component (no store) — render it directly.
describe("AirMassSelectors (default state)", () => {
  it("renders the three column headers", () => {
    const { getByText } = render(<AirMassSelectors />);
    expect(getByText("Pathway")).toBeInTheDocument();
    expect(getByText("Humidity")).toBeInTheDocument();
    // Temperature renders both forms (full + short); the short one is hidden by CSS.
    expect(getByText("Temperature")).toBeInTheDocument();
  });

  it("renders the Land and Ocean air-mass row labels", () => {
    const { container } = render(<AirMassSelectors />);
    // Query the visible row labels by class — "Land Air Mass" is also a substring of the hidden
    // field labels ("… for Land Air Mass"), so a text match would be ambiguous.
    const labels = [...container.querySelectorAll(".nor-air-mass-label")];
    expect(labels).toHaveLength(2);
    expect(labels[0]).toHaveTextContent("Land");
    expect(labels[0]).toHaveTextContent("Air Mass");
    expect(labels[1]).toHaveTextContent("Ocean");
    expect(labels[1]).toHaveTextContent("Air Mass");
  });

  it("renders five inert dropdowns with the correct field names, all at the placeholder", () => {
    const { getByRole, container } = render(<AirMassSelectors />);
    // react-aria names the trigger by its SelectValue (the placeholder) then the field label, so the
    // accessible name contains the field label — match it as a substring.
    for (const label of [
      "Pathway for Land Air Mass",
      "Humidity for Land Air Mass",
      "Temperature for Land Air Mass",
      "Pathway for Ocean Air Mass",
      "Humidity for Ocean Air Mass",
    ]) {
      expect(getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    const placeholders = [
      ...container.querySelectorAll(".react-aria-SelectValue[data-placeholder='true']"),
    ];
    expect(placeholders).toHaveLength(5);
    for (const p of placeholders) expect(p).toHaveTextContent("Select…");
  });

  it("exposes pathway options with their numbered accessible name (via the shared Select textValue)", () => {
    const { getByRole } = render(<AirMassSelectors />);
    fireEvent.click(getByRole("button", { name: /Pathway for Land Air Mass/ }));
    // The circled-number icon is aria-hidden; the number reaches AT through textValue → the option
    // is named "1 N/NW" / "4 W" (not just "N/NW" / "W").
    expect(getByRole("option", { name: "1 N/NW" })).toBeInTheDocument();
    expect(getByRole("option", { name: "4 W" })).toBeInTheDocument();
  });

  it("numbers the Ocean pathway options with their own (non-sequential) values", () => {
    const { getByRole } = render(<AirMassSelectors />);
    fireEvent.click(getByRole("button", { name: /Pathway for Ocean Air Mass/ }));
    expect(getByRole("option", { name: "2 S/SE" })).toBeInTheDocument();
    expect(getByRole("option", { name: "3 NE" })).toBeInTheDocument();
  });

  it("renders the static Ocean Temperature pill as an en-dash (plain text, no live region)", () => {
    const { container } = render(<AirMassSelectors />);
    const tempDisplay = container.querySelector(".nor-temp-display");
    expect(tempDisplay).toHaveTextContent("–");
    // Convention: sims carry no scattered live regions — this ambient display is not a status region.
    expect(tempDisplay).not.toHaveAttribute("role", "status");
    // An sr-only field label gives it AT parity with the sibling dropdowns.
    expect(tempDisplay?.querySelector(".sr-only")).toHaveTextContent(
      "Temperature for Ocean Air Mass",
    );
  });
});
