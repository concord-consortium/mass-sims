import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaxTrialsNotice } from "./max-trials-notice";

describe("MaxTrialsNotice", () => {
  it("renders the cap message as plain visible text", () => {
    const { container } = render(<MaxTrialsNotice />);
    expect(container.querySelector(".max-trials-notice")).toHaveTextContent(
      "Max number of trials reached",
    );
  });

  it("is NOT a live region — the cap is narrated once via the sim's single <Announcer>", () => {
    // A role="status"/aria-live here would double-announce the cap alongside the Announcer message
    // TrialsPanel already emits when the last trial is added. See docs/accessibility.md.
    const { container, queryByRole } = render(<MaxTrialsNotice />);
    expect(queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });
});
