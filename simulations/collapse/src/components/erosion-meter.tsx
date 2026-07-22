import "./erosion-meter.scss";

export interface ErosionMeterProps {
  label: string;
  /** Current value, in `unit`. */
  value: number;
  /** Value at which the bar is full. */
  max: number;
  /** Unit shown next to the value (e.g. "in", "mg/L"). */
  unit?: string;
  /** Accent color for the filled portion (sim content, not a shared token). */
  color?: string;
}

/**
 * A vertical, accessible bar meter with a numeric readout. Used in the Data panel for cave-roof and
 * hillside erosion (inches) and carbonate in groundwater (mg/L). The bar fills from the bottom to
 * `value / max`; the visible number shows the value + unit. `role="meter"` exposes it to assistive tech.
 */
export function ErosionMeter({
  label,
  value,
  max,
  unit = "in",
  color = "#7a5c3a",
}: ErosionMeterProps) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  // One decimal for small values, whole numbers once we're in the tens/hundreds.
  const display = value >= 20 ? Math.round(value) : Math.round(value * 10) / 10;
  return (
    <div className="erosion-meter">
      <span className="erosion-meter-value">
        {display} {unit}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: custom-styled bar; native <meter> isn't themable cross-browser */}
      <div
        className="erosion-meter-track"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuetext={`${display} ${unit}`}
      >
        <div
          className="erosion-meter-fill"
          style={{ height: `${frac * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="erosion-meter-label">{label}</span>
    </div>
  );
}
