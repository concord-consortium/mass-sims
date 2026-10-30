import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@concord-consortium/lara-interactive-api", () => ({
  useInitMessage: () => null,
  setInteractiveState: vi.fn(),
}));

import { App } from "../../app";

function openCompare(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "Compare Trials" }));
  return view.getByRole("dialog", { name: "Compare trials" });
}

/** The live region, the title bar, the two panels, and the frame's `main`. */
function parts(view: ReturnType<typeof render>) {
  const { container } = view;
  return {
    liveRegion: container.querySelector("[aria-live]") as HTMLElement,
    titleBar: container.querySelector(".title-bar") as HTMLElement,
    trials: view.getByRole("region", { name: "Trials" }),
    simulation: view.getByRole("region", { name: "Simulation" }),
  };
}

describe("CompareTrials", () => {
  it("is not rendered until the Compare Trials button is pressed", () => {
    const view = render(<App />);
    expect(view.queryByRole("dialog")).toBeNull();
  });

  it("opens over the panels with its title, legend, and close button focused", () => {
    const view = render(<App />);
    const dialog = openCompare(view);
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog.parentElement).toHaveClass("sim-main");
    expect(view.getByRole("heading", { level: 2, name: "Compare Trials" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Years = Years before collapse (yr) | Rate = Erosion rate (mm/1,000 yr) | " +
        "Rock = Rock above cave (mm)",
    );
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Close the trial comparison" }),
    );
  });

  it("makes everything in the frame but the dialog inert, and not the live region", () => {
    const view = render(<App />);
    const dialog = openCompare(view);
    const { liveRegion, titleBar, trials, simulation } = parts(view);
    expect(titleBar).toHaveAttribute("inert");
    expect(trials).toHaveAttribute("inert");
    expect(simulation).toHaveAttribute("inert");
    expect(dialog).not.toHaveAttribute("inert");
    expect(liveRegion).not.toHaveAttribute("inert");
    expect(liveRegion.closest("[inert]")).toBeNull();
  });

  it.each([
    [
      "the close button",
      (view: ReturnType<typeof render>) =>
        fireEvent.click(view.getByRole("button", { name: "Close the trial comparison" })),
    ],
    [
      "Escape",
      (view: ReturnType<typeof render>) =>
        fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" }),
    ],
  ])("closes from %s, restores the frame, and returns focus to the opener", (_, close) => {
    const view = render(<App />);
    openCompare(view);
    act(() => close(view));
    expect(view.queryByRole("dialog")).toBeNull();
    const { titleBar, trials, simulation } = parts(view);
    for (const el of [titleBar, trials, simulation]) expect(el).not.toHaveAttribute("inert");
    const opener = view.getByRole("button", { name: "Compare Trials" });
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(opener);
  });

  it("makes an open About panel inert, and restores it on close", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", { name: "About" }));
    const about = view.getByRole("complementary");
    openCompare(view);
    expect(about).toHaveAttribute("inert");
    fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
    expect(view.getByRole("complementary")).toBe(about);
    expect(about).not.toHaveAttribute("inert");
  });
});
