import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { caveArtFor } = vi.hoisted(() => ({ caveArtFor: vi.fn<() => string | null>(() => null) }));
vi.mock("../../model/cave-art", () => ({ caveArtFor }));

import { Thumbnail } from "./thumbnail";

const conditions = { rock: "Limestone", moisture: "Wet" } as const;

describe("Thumbnail", () => {
  it("draws the hidden stand-in when there is no drawing", () => {
    const { container } = render(<Thumbnail conditions={conditions} years={0} />);
    expect(container.querySelector(".collapse-pic-standin")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toBeNull();
    expect(caveArtFor).toHaveBeenCalledWith(conditions, 0);
  });

  it("draws a hidden image when there is one", () => {
    caveArtFor.mockReturnValueOnce("/cave/limestone-wet-0.png");
    const { container } = render(<Thumbnail conditions={conditions} years={0} />);
    const img = container.querySelector("img");
    expect(img).toHaveClass("collapse-pic-img");
    expect(img).toHaveAttribute("src", "/cave/limestone-wet-0.png");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".collapse-pic-standin")).toBeNull();
  });
});
