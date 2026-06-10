/**
 * Round `raw` up to a "nice" step size — one of 1 / 2 / 5 / 10 / 20 / 50 / 100 / … at the
 * appropriate order of magnitude. Used to choose round-number histogram bin widths AND
 * round-number y-axis maximums so the gridlines land on clean integers.
 */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const mantissa = raw / base;
  if (mantissa <= 1) return base;
  if (mantissa <= 2) return 2 * base;
  if (mantissa <= 5) return 5 * base;
  return 10 * base;
}

export interface HistogramBins {
  counts: number[];
  binWidth: number;
}

/**
 * Bin `values` into bins of round `binWidth` from 0 up. `binWidth` is the `niceStep` of
 * `max / targetBinCount`, so bin boundaries are round numbers a learner can read off the axis.
 * The bin count fits the data — the largest value lands in the last bin, so there is no empty
 * trailing bin. Empty `values` returns a single empty bin so the consumer's render path stays
 * simple; all-zero values collapse into the first bin.
 */
export function histogramBins(values: readonly number[], targetBinCount: number): HistogramBins {
  if (values.length === 0) return { counts: [0], binWidth: 1 };
  const maxValue = Math.max(...values);
  const binWidth = niceStep(maxValue / targetBinCount);
  const binCount = Math.max(1, Math.ceil(maxValue / binWidth));
  const counts = new Array<number>(binCount).fill(0);
  for (const v of values) {
    // The last bin includes the upper edge so the max value isn't lost.
    const idx = Math.min(binCount - 1, Math.floor(v / binWidth));
    counts[idx] += 1;
  }
  return { counts, binWidth };
}
