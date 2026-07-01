import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_STATE_LABEL } from "./constants";
import { ResistanceBarChart } from "./resistance-bar-chart";

// The global test-setup ResizeObserver mock fires synchronously with width 300, so the SVG —
// which renders only once width > 0 — is mounted by the time these queries run.

const PLOT_H_NO_FUNGUS = 158 - 15 - 28; // BAR_HEIGHT − MARGIN.top − MARGIN.bottom = 115

describe("ResistanceBarChart — empty frame", () => {
  it("renders an SVG with role=img and the no-data aria-label", () => {
    const { getByRole } = render(<ResistanceBarChart series={null} trialLetter="A" />);
    expect(
      getByRole("img", { name: "Fungus resistance over crosses: no data" }),
    ).toBeInTheDocument();
  });

  it("shows the 'No data' label", () => {
    const { getByText } = render(<ResistanceBarChart series={null} trialLetter="A" />);
    expect(getByText(EMPTY_STATE_LABEL)).toBeInTheDocument();
  });

  it("renders all five y-axis percentage labels", () => {
    const { getByText } = render(<ResistanceBarChart series={null} trialLetter="A" />);
    for (const label of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(getByText(label)).toBeInTheDocument();
    }
  });

  it("renders exactly five gridlines", () => {
    const { container } = render(<ResistanceBarChart series={null} trialLetter="A" />);
    // A specific class, not a raw <line> count — the baseline/future ticks are also <line>s.
    expect(container.querySelectorAll(".bar-chart-gridline")).toHaveLength(5);
  });
});

describe("ResistanceBarChart — columns", () => {
  it("renders a healthy and an infected bar per cross", () => {
    const { container } = render(
      <ResistanceBarChart series={{ healthy: [80, 60], infected: [20, 40] }} trialLetter="A" />,
    );
    expect(container.querySelectorAll(".bar-chart-bar--healthy")).toHaveLength(2);
    expect(container.querySelectorAll(".bar-chart-bar--infected")).toHaveLength(2);
  });

  it("draws a full-height healthy bar and a min-height infected bar at 100% healthy", () => {
    const { container } = render(
      <ResistanceBarChart series={{ healthy: [100], infected: [0] }} trialLetter="A" />,
    );
    expect(container.querySelector(".bar-chart-bar--healthy")).toHaveAttribute(
      "height",
      String(PLOT_H_NO_FUNGUS),
    );
    expect(container.querySelector(".bar-chart-bar--infected")).toHaveAttribute("height", "2");
  });

  it("renders an x-axis label per cross", () => {
    const { container } = render(
      <ResistanceBarChart series={{ healthy: [80, 60], infected: [20, 40] }} trialLetter="A" />,
    );
    const labels = [...container.querySelectorAll(".bar-chart-x-label")].map((l) => l.textContent);
    expect(labels).toEqual(["A1", "A2"]);
  });

  it("prefixes x-axis labels with the trial letter", () => {
    const { container } = render(
      <ResistanceBarChart series={{ healthy: [50, 60], infected: [50, 40] }} trialLetter="B" />,
    );
    const labels = [...container.querySelectorAll(".bar-chart-x-label")].map((l) => l.textContent);
    expect(labels).toEqual(["B1", "B2"]);
  });

  it("includes the latest cross's percentages in the aria-label", () => {
    const { getByRole } = render(
      <ResistanceBarChart series={{ healthy: [80, 60], infected: [20, 40] }} trialLetter="A" />,
    );
    expect(getByRole("img", { name: /Latest: 60% healthy, 40% infected/ })).toBeInTheDocument();
  });
});

describe("ResistanceBarChart — fungus margin", () => {
  it("drops the first bar group 20px when fungus is on (the margin difference)", () => {
    const series = { healthy: [100], infected: [0] };
    const off = render(<ResistanceBarChart series={series} fungusOn={false} trialLetter="A" />);
    const yOff = Number(off.container.querySelector(".bar-chart-bar--healthy")?.getAttribute("y"));
    off.unmount();
    const on = render(<ResistanceBarChart series={series} fungusOn={true} trialLetter="A" />);
    const yOn = Number(on.container.querySelector(".bar-chart-bar--healthy")?.getAttribute("y"));
    expect(yOn - yOff).toBe(20);
  });
});

describe("ResistanceBarChart — screen-reader table", () => {
  it("renders one row per cross with the healthy/infected percentages", () => {
    const { container } = render(
      <ResistanceBarChart series={{ healthy: [80, 60], infected: [20, 40] }} trialLetter="A" />,
    );
    const rows = container.querySelectorAll("table.sr-only tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("80%");
    expect(rows[0].textContent).toContain("20%");
    expect(rows[1].textContent).toContain("60%");
    expect(rows[1].textContent).toContain("40%");
  });

  it("marks the first cross row as fungus-introduced when fungus is on", () => {
    const { container } = render(
      <ResistanceBarChart
        series={{ healthy: [80], infected: [20] }}
        fungusOn={true}
        trialLetter="A"
      />,
    );
    const firstCell = container.querySelector("table.sr-only tbody tr td");
    expect(firstCell?.textContent).toBe("A1 (fungus introduced)");
  });
});

// A no-op ResizeObserver whose .observe() never fires the callback, so width stays 0. Written as
// a `function` constructor (not a class/arrow) so the vitest mock can invoke it with `new`.
function NoopResizeObserver(this: ResizeObserver) {
  this.observe = () => {};
  this.unobserve = () => {};
  this.disconnect = () => {};
}

describe("ResistanceBarChart — cross highlight", () => {
  const series = { healthy: [80, 60, 40], infected: [20, 40, 60] };

  it("renders no highlight when nothing is selected", () => {
    const { container } = render(
      <ResistanceBarChart series={series} selectedCross={null} trialLetter="A" />,
    );
    expect(container.querySelector(".bar-chart-highlight")).not.toBeInTheDocument();
  });

  it("renders exactly one highlight as the SVG's first child", () => {
    const { container } = render(
      <ResistanceBarChart series={series} selectedCross={1} trialLetter="A" />,
    );
    const highlights = container.querySelectorAll(".bar-chart-highlight");
    expect(highlights).toHaveLength(1);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.firstElementChild).toBe(highlights[0]);
  });

  it("positions the highlight at the selected group's left edge", () => {
    const { container } = render(
      <ResistanceBarChart series={series} selectedCross={1} trialLetter="A" />,
    );
    // RO mock width 300; MARGIN.left 44, right 8 → plotWidth 248, groupW = 248/3.
    const groupW = (300 - 44 - 8) / 3;
    const expectedX = 44 + 1 * groupW;
    const x = Number(container.querySelector(".bar-chart-highlight")?.getAttribute("x"));
    expect(x).toBeCloseTo(expectedX, 1);
  });
});

describe("ResistanceBarChart — fungus flag", () => {
  it("renders no flag when fungus is off", () => {
    const { container } = render(
      <ResistanceBarChart
        series={{ healthy: [80], infected: [20] }}
        fungusOn={false}
        trialLetter="A"
      />,
    );
    expect(container.querySelector(".fungus-flag-line")).not.toBeInTheDocument();
  });

  it("renders the flag when fungus is on with data", () => {
    const { container } = render(
      <ResistanceBarChart
        series={{ healthy: [80], infected: [20] }}
        fungusOn={true}
        trialLetter="A"
      />,
    );
    expect(container.querySelector(".fungus-flag-line")).toBeInTheDocument();
  });

  it("renders the flag when fungus is on even with no data", () => {
    const { container } = render(
      <ResistanceBarChart series={null} fungusOn={true} trialLetter="A" />,
    );
    expect(container.querySelector(".fungus-flag-line")).toBeInTheDocument();
  });

  it("labels the flag 'Fungus'", () => {
    const { container } = render(
      <ResistanceBarChart series={null} fungusOn={true} trialLetter="A" />,
    );
    expect(container.querySelector(".fungus-flag-label")?.textContent).toBe("Fungus");
  });

  it("drops the gridlines to MARGIN.top=35 when fungus is on", () => {
    const { container } = render(
      <ResistanceBarChart series={null} fungusOn={true} trialLetter="A" />,
    );
    // The top (100%) gridline sits at the grown margin top, not the default 15.
    const ys = [...container.querySelectorAll(".bar-chart-gridline")].map((l) =>
      Number(l.getAttribute("y1")),
    );
    expect(Math.min(...ys)).toBe(35);
  });
});

describe("ResistanceBarChart — mount-flicker gate", () => {
  it("renders the wrap but no SVG until the width is known", () => {
    // Replace the synchronous RO mock for one construction so the gate's width stays 0.
    vi.spyOn(globalThis, "ResizeObserver").mockImplementationOnce(
      NoopResizeObserver as unknown as typeof ResizeObserver,
    );
    const { container } = render(<ResistanceBarChart series={null} trialLetter="A" />);
    expect(container.querySelector(".resistance-chart-wrap")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
