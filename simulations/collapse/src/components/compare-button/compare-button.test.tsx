import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createRootStore, RootStoreProvider } from "../../stores/root-store";
import { CompareButton } from "./compare-button";

describe("CompareButton", () => {
  it("renders a button named Compare Trials, and pressing it opens the view", () => {
    const store = createRootStore();
    const { getByRole } = render(
      <RootStoreProvider store={store}>
        <CompareButton />
      </RootStoreProvider>,
    );
    const button = getByRole("button", { name: "Compare Trials" });
    fireEvent.click(button);
    expect(store.ui.compareOpen).toBe(true);
  });
});
