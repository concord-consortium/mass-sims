import { describe, expect, it } from "vitest";
import { TRIAL_CONDITIONS } from "../trial-conditions";
import {
  CAVE_ROOF_FAIL,
  formatWhole,
  isCollapsed,
  RATE_JITTER,
  ROCK_MODEL,
  roofAt,
  sampleAt,
} from "./erosion";

const limestoneWet = { rock: "Limestone", moisture: "Wet" } as const;
const limestoneDry = { rock: "Limestone", moisture: "Dry" } as const;
const graniteWet = { rock: "Granite", moisture: "Wet" } as const;
const graniteDry = { rock: "Granite", moisture: "Dry" } as const;

describe("erosion model", () => {
  it("has the mock's four base rates", () => {
    expect(ROCK_MODEL.Limestone.Wet.baseRate).toBe(30);
    expect(ROCK_MODEL.Limestone.Dry.baseRate).toBe(20);
    expect(ROCK_MODEL.Granite.Wet.baseRate).toBe(2);
    expect(ROCK_MODEL.Granite.Dry.baseRate).toBe(2);
  });

  it("starts every trial with 8,800 mm of roof at 200,000 years", () => {
    for (const conditions of Object.values(TRIAL_CONDITIONS)) {
      expect(roofAt(conditions, 200000)).toBe(8800);
    }
  });

  it("collapses limestone-wet at year 0 and not at year 10", () => {
    expect(roofAt(limestoneWet, 0)).toBe(CAVE_ROOF_FAIL);
    expect(isCollapsed(roofAt(limestoneWet, 0))).toBe(true);
    expect(roofAt(limestoneWet, 10)).toBeCloseTo(2800.3, 6);
    expect(isCollapsed(roofAt(limestoneWet, 10))).toBe(false);
  });

  it("leaves 4,800 mm for limestone-dry and 8,400 mm for granite at year 0", () => {
    expect(roofAt(limestoneDry, 0)).toBe(4800);
    expect(roofAt(graniteWet, 0)).toBe(8400);
    expect(roofAt(graniteDry, 0)).toBe(8400);
  });

  it("jitters the rate by up to ±15% around the base rate", () => {
    expect(RATE_JITTER).toBe(0.15);
    expect(sampleAt(limestoneWet, 0, () => 0.5).rate).toBe(30);
    expect(sampleAt(limestoneWet, 0, () => 1).rate).toBeCloseTo(30 * 1.15, 10);
    expect(sampleAt(limestoneWet, 0, () => 0).rate).toBeCloseTo(30 * 0.85, 10);
  });

  it("never jitters the roof", () => {
    for (const r of [0, 0.5, 1]) {
      const sample = sampleAt(limestoneDry, 50000, () => r);
      expect(sample.years).toBe(50000);
      expect(sample.roof).toBe(roofAt(limestoneDry, 50000));
    }
  });

  it("formats cells as rounded whole numbers with thousands separators", () => {
    expect(formatWhole(8800)).toBe("8,800");
    expect(formatWhole(2800.3)).toBe("2,800");
    expect(formatWhole(29.6)).toBe("30");
  });
});
