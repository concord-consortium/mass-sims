import CloseSvg from "../../assets/close-icon.svg?react";
import InfoSvg from "../../assets/info-icon.svg?react";

/**
 * Decorative title-bar / About-panel icons. The `?react` suffix imports each SVG
 * as a React component (via vite-plugin-svgr); the assets paint with
 * `fill="currentColor"`, so an icon takes its color from its container's CSS
 * `color` — how sims theme the About-panel glyphs. Decorative, so `aria-hidden`.
 */

interface IconProps {
  className?: string;
}

export function InfoIcon({ className }: IconProps) {
  return <InfoSvg className={className} aria-hidden="true" />;
}

export function CloseIcon({ className }: IconProps) {
  return <CloseSvg className={className} aria-hidden="true" />;
}
