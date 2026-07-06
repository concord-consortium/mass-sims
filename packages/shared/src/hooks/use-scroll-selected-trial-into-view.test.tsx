import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TrialCard } from "../components/trial-card/trial-card";
import { useScrollSelectedTrialIntoView } from "./use-scroll-selected-trial-into-view";

function Harness({ selected }: { selected: string }) {
  const ref = useScrollSelectedTrialIntoView(selected);
  return (
    <div ref={ref}>
      {["A", "B"].map((letter, i) => (
        <TrialCard key={letter} index={i} selected={letter === selected} onSelect={() => {}} />
      ))}
    </div>
  );
}

it("scrolls the selected trial card into view when selection changes", () => {
  // jsdom doesn't implement scrollIntoView, so define it before spying — capture the original
  // and restore it afterward so the stub doesn't leak into later tests.
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = () => {};
  const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  const { rerender } = render(<Harness selected="A" />);
  scrollSpy.mockClear(); // ignore the initial mount call
  rerender(<Harness selected="B" />);
  expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  scrollSpy.mockRestore();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});
