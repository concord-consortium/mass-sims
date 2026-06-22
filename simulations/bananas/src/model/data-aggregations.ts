import type { OffspringPlant } from "./genetics";

export interface PhenotypeTotals {
  healthy: number;
  infected: number;
}

export interface ResistanceSeries {
  healthy: number[];
  infected: number[];
}

/**
 * Sum healthy / infected plants across the given crosses. Pass `trial.crosses` for the
 * "All Crosses" aggregate, or a one-element array `[trial.crosses[i]]` for a single cross.
 * Returns `{ healthy: 0, infected: 0 }` for an empty array; chart code uses that to render
 * the empty state.
 */
export function aggregateTotals(crosses: readonly OffspringPlant[][]): PhenotypeTotals {
  let healthy = 0;
  let infected = 0;
  for (const cross of crosses) {
    for (const plant of cross) {
      if (plant.infected) {
        infected++;
      } else {
        healthy++;
      }
    }
  }
  return { healthy, infected };
}

/**
 * Compute the per-cross resistance series. `healthy[i]` and `infected[i]` are the percentages
 * (0–100, rounded to the nearest integer) for `trial.crosses[i]`. A cross with zero plants
 * (defensive — `makeCross` never produces this) is treated as 100% healthy / 0% infected.
 */
export function computeResistanceSeries(crosses: readonly OffspringPlant[][]): ResistanceSeries {
  const healthy: number[] = [];
  const infected: number[] = [];
  for (const cross of crosses) {
    const total = cross.length;
    // Defensive NaN-guard: makeCross always returns at least OFFSPRING_MIN plants, so a
    // zero-plant cross shouldn't reach here. If a future bug produces one, a safe default of
    // 100% healthy / 0% infected beats `NaN%` showing up in the chart/legend. Semantically
    // odd (no plants ≠ "all healthy"), but this branch should never visibly trigger.
    const healthyCount = total === 0 ? 0 : cross.reduce((n, p) => n + (p.infected ? 0 : 1), 0);
    const healthyPct = total === 0 ? 100 : Math.round((healthyCount / total) * 100);
    healthy.push(healthyPct);
    infected.push(100 - healthyPct);
  }
  return { healthy, infected };
}
