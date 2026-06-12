import CloseSvg from "../../assets/close-icon.svg?react";
import InfoSvg from "../../assets/info-icon.svg?react";

/**
 * Decorative title-bar / About-panel icons. The `?react` suffix runs each SVG
 * through vite-plugin-svgr (see `svgrPlugin` in vite-config), turning the asset
 * into a React component. The assets paint with `fill="currentColor"`, so an
 * icon takes its color from the CSS `color` of its container — that's how the
 * About panel themes its info/close glyphs per-sim. The icons are purely
 * decorative (callers pair them with accessible labels), so each is
 * `aria-hidden`.
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
