import { Announcer } from "@concord-consortium/mass-sims-shared";
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The shared <Select> logs through lara-interactive-api's `log`; mock the transport so mounting and
// selecting don't reach the real API in jsdom, and so we can assert the auto-emitted events.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import type { RootStoreInstance } from "../stores/root-store";
import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { configureStrong } from "../stores/test-helpers";
import { AirMassSelectors } from "./air-mass-selectors";

function renderWith(store: RootStoreInstance = createRootStore()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>
      <Announcer>{children}</Announcer>
    </RootStoreProvider>
  );
  const utils = render(<AirMassSelectors />, { wrapper });
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { store, region, ...utils };
}

describe("AirMassSelectors — structure (default state)", () => {
  it("renders the column headers", () => {
    const { getByText } = renderWith();
    expect(getByText("Pathway")).toBeInTheDocument();
    expect(getByText("Humidity")).toBeInTheDocument();
    expect(getByText("Temperature")).toBeInTheDocument();
  });

  it("renders the Land and Ocean air-mass row labels", () => {
    const { container } = renderWith();
    const labels = [...container.querySelectorAll(".nor-air-mass-label")];
    expect(labels).toHaveLength(2);
    expect(labels[0]).toHaveTextContent("Land");
    expect(labels[1]).toHaveTextContent("Ocean");
  });

  it("renders five dropdowns with the correct field names, all at the placeholder", () => {
    const { getByRole, container } = renderWith();
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

  it("exposes pathway options with their numbered accessible name", () => {
    const { getByRole } = renderWith();
    fireEvent.click(getByRole("button", { name: /Pathway for Land Air Mass/ }));
    expect(getByRole("option", { name: "1 N/NW" })).toBeInTheDocument();
    expect(getByRole("option", { name: "4 W" })).toBeInTheDocument();
  });

  it("numbers the Ocean pathway options with their own (non-sequential) values", () => {
    const { getByRole } = renderWith();
    fireEvent.click(getByRole("button", { name: /Pathway for Ocean Air Mass/ }));
    expect(getByRole("option", { name: "2 S/SE" })).toBeInTheDocument();
    expect(getByRole("option", { name: "3 NE" })).toBeInTheDocument();
  });
});

describe("AirMassSelectors — selections drive the store", () => {
  it("writes the chosen value to the trial and logs air_mass_selected", () => {
    const { store, getByRole } = renderWith();
    log.mockClear();
    fireEvent.click(getByRole("button", { name: /Humidity for Land Air Mass/ }));
    fireEvent.click(getByRole("option", { name: "Humid" }));
    expect(store.activeTrial.landHumidity).toBe("Humid");
    expect(log).toHaveBeenCalledWith("air_mass_selected", {
      value: "Humid",
      trial: "A",
      airMass: "land",
      attribute: "humidity",
    });
  });

  it("reflects a store value in the trigger (controlled)", () => {
    const store = createRootStore();
    store.activeTrial.setLandPathway("W");
    const { getByRole } = renderWith(store);
    expect(getByRole("button", { name: /Pathway for Land Air Mass/ })).toHaveTextContent("W");
  });
});

describe("AirMassSelectors — derived Ocean Temperature", () => {
  it("shows the en-dash placeholder until an ocean pathway is chosen", () => {
    const { container } = renderWith();
    const pill = container.querySelector(".nor-value-pill");
    expect(pill).toHaveTextContent("–");
    expect(pill?.querySelector(".sr-only")).toHaveTextContent("Temperature for Ocean Air Mass");
    expect(pill).not.toHaveAttribute("role", "status");
  });

  it("derives Warm from S/SE and Cool from NE", () => {
    const store = createRootStore();
    const { container } = renderWith(store);
    act(() => store.activeTrial.setOceanPathway("S/SE"));
    expect(container.querySelector(".nor-value-pill")?.querySelector(".sr-only")).toHaveTextContent(
      "Temperature for Ocean Air Mass: Warm",
    );
    act(() => store.activeTrial.setOceanPathway("NE"));
    expect(container.querySelector(".nor-value-pill")?.querySelector(".sr-only")).toHaveTextContent(
      "Temperature for Ocean Air Mass: Cool",
    );
  });

  it("announces the derived ocean temperature when the ocean pathway is chosen", () => {
    const { getByRole, region } = renderWith();
    fireEvent.click(getByRole("button", { name: /Pathway for Ocean Air Mass/ }));
    fireEvent.click(getByRole("option", { name: "3 NE" }));
    expect(region).toHaveTextContent("Temperature for Ocean Air Mass: Cool");
  });
});

describe("AirMassSelectors — setup-complete announcement", () => {
  it("announces that the setup is ready to run when the final selection completes it", () => {
    const store = createRootStore();
    // Pre-fill four fields directly (no component onChange, so no narration yet)...
    const t = store.activeTrial;
    t.setLandHumidity("Dry");
    t.setLandTemperature("Cold");
    t.setOceanPathway("S/SE");
    t.setOceanHumidity("Humid");
    const { getByRole, region } = renderWith(store);
    // ...then make the fifth selection through the UI, which fires the completion announcement.
    fireEvent.click(getByRole("button", { name: /Pathway for Land Air Mass/ }));
    fireEvent.click(getByRole("option", { name: "1 N/NW" }));
    expect(region).toHaveTextContent(/Air masses set up/);
  });

  it("does not announce completion while the setup is still incomplete", () => {
    const { getByRole, region } = renderWith();
    fireEvent.click(getByRole("button", { name: /Pathway for Land Air Mass/ }));
    fireEvent.click(getByRole("option", { name: "1 N/NW" }));
    expect(region).not.toHaveTextContent(/Air masses set up/);
  });
});

describe("AirMassSelectors — locked (post-run) state", () => {
  it("replaces the dropdowns with read-only pills that keep the field name in their accessible label", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    store.activeTrial.run();
    const { queryByRole, getByText } = renderWith(store);
    // No comboboxes remain once locked.
    expect(queryByRole("button", { name: /Humidity for Ocean Air Mass/ })).toBeNull();
    // Each locked pill carries "<field>: <value>" as its (sr-only) accessible label.
    expect(getByText("Humidity for Ocean Air Mass: Humid")).toBeInTheDocument();
    expect(getByText("Pathway for Land Air Mass: N/NW")).toBeInTheDocument();
    expect(getByText("Temperature for Land Air Mass: Cold")).toBeInTheDocument();
  });
});

describe("AirMassSelectors — row-icon tint", () => {
  it("tints the Land icon by land temperature and the Ocean icon by derived ocean temperature", () => {
    const store = createRootStore();
    const { container } = renderWith(store);
    const [landIcon, oceanIcon] = [...container.querySelectorAll(".nor-air-mass-icon")];
    expect(landIcon).toHaveAttribute("data-tint", "neutral");
    expect(oceanIcon).toHaveAttribute("data-tint", "neutral");

    act(() => {
      store.activeTrial.setLandTemperature("Warm");
      store.activeTrial.setOceanPathway("NE"); // derived ocean temp Cool
    });
    expect(landIcon).toHaveAttribute("data-tint", "warm");
    expect(oceanIcon).toHaveAttribute("data-tint", "cool");
  });
});
