import { describe, expect, it } from "vitest";
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";

/** Apply the one setup that yields a strong nor'easter (N/NW + Cold + Dry land, S/SE + Humid ocean). */
function configureStrong(trial: TrialModelInstance) {
  trial.setLandPathway("N/NW");
  trial.setLandHumidity("Dry");
  trial.setLandTemperature("Cold");
  trial.setOceanPathway("S/SE");
  trial.setOceanHumidity("Humid");
}

describe("TrialModel", () => {
  it("starts fully unconfigured (no selections, not run, nothing to reset)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    expect(trial.landPathway).toBeNull();
    expect(trial.oceanPathway).toBeNull();
    expect(trial.outcome).toBeNull();
    expect(trial.setupComplete).toBe(false);
    expect(trial.hasRun).toBe(false);
    expect(trial.locked).toBe(false);
    expect(trial.canReset).toBe(false);
    expect(trial.oceanTemperature).toBeNull();
    expect(trial.setup).toBeNull();
  });

  it("setters write their field", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.setLandPathway("W");
    trial.setLandHumidity("Humid");
    trial.setLandTemperature("Warm");
    trial.setOceanPathway("NE");
    trial.setOceanHumidity("Dry");
    expect(trial.landPathway).toBe("W");
    expect(trial.landHumidity).toBe("Humid");
    expect(trial.landTemperature).toBe("Warm");
    expect(trial.oceanPathway).toBe("NE");
    expect(trial.oceanHumidity).toBe("Dry");
  });

  it("canReset flips true after any single selection", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.setLandHumidity("Dry");
    expect(trial.canReset).toBe(true);
    expect(trial.setupComplete).toBe(false);
  });

  it("setupComplete requires all five selections", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.setLandPathway("N/NW");
    trial.setLandHumidity("Dry");
    trial.setLandTemperature("Cold");
    trial.setOceanPathway("S/SE");
    expect(trial.setupComplete).toBe(false); // ocean humidity still missing
    trial.setOceanHumidity("Humid");
    expect(trial.setupComplete).toBe(true);
    expect(trial.setup).toEqual({
      landPathway: "N/NW",
      landHumidity: "Dry",
      landTemperature: "Cold",
      oceanPathway: "S/SE",
      oceanHumidity: "Humid",
    });
  });

  it("derives ocean temperature from the ocean pathway (null → Warm/Cool)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    expect(trial.oceanTemperature).toBeNull();
    trial.setOceanPathway("S/SE");
    expect(trial.oceanTemperature).toBe("Warm");
    trial.setOceanPathway("NE");
    expect(trial.oceanTemperature).toBe("Cool");
  });

  it("run() records the outcome and locks the trial", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    configureStrong(trial);
    expect(trial.hasRun).toBe(false);
    trial.run();
    expect(trial.outcome).toBe("strong");
    expect(trial.hasRun).toBe(true);
    expect(trial.locked).toBe(true);
    expect(trial.canReset).toBe(true);
  });

  it("run() is a no-op until the setup is complete", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.setLandPathway("N/NW");
    trial.run();
    expect(trial.outcome).toBeNull();
    expect(trial.hasRun).toBe(false);
  });

  it("selection setters no-op once locked (post-run read-only)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    configureStrong(trial);
    trial.run();
    trial.setLandPathway("W"); // was N/NW
    trial.setOceanHumidity("Dry"); // was Humid
    expect(trial.landPathway).toBe("N/NW");
    expect(trial.oceanHumidity).toBe("Humid");
  });

  it("reset() clears every field and unlocks", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    configureStrong(trial);
    trial.run();
    trial.reset();
    expect(trial.landPathway).toBeNull();
    expect(trial.landHumidity).toBeNull();
    expect(trial.landTemperature).toBeNull();
    expect(trial.oceanPathway).toBeNull();
    expect(trial.oceanHumidity).toBeNull();
    expect(trial.outcome).toBeNull();
    expect(trial.locked).toBe(false);
    expect(trial.canReset).toBe(false);
    // Editable again after reset.
    trial.setLandPathway("W");
    expect(trial.landPathway).toBe("W");
  });
});
