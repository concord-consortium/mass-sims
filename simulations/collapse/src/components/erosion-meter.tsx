import "./erosion-meter.scss";

export interface ErosionMeterProps {
  label: string;
  /** 0–100. */
  value: number;
  /** Accent color for the filled portion (sim content, not a shared token). */
  color?: string;
}

/**
 * A vertical, accessible bar meter with a numeric percentage. Used in the Data panel to show
 * cave-roof and hillside erosion. The bar fills from the bottom and stretches to fill the panel
 * height. `role="meter"` + `aria-valuenow/min/max` expose the value to assistive tech; the
 * visible number is for sighted readability.
 */
export function ErosionMeter({ label, value, color = "#7a5c3a" }: ErosionMeterProps) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className="erosion-meter">
      <span className="erosion-meter-value">{pct}%</span>
      {/* biome-ignore lint/a11y/useSemanticElements: custom-styled bar; native <meter> isn't themable cross-browser */}
      <div
        className="erosion-meter-track"
        role="meter"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct}%`}
      >
        <div className="erosion-meter-fill" style={{ height: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="erosion-meter-label">{label}</span>
    </div>
  );
}
