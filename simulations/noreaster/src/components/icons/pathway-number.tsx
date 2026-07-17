import type { FunctionComponent, SVGProps } from "react";

interface PathwayNumberProps extends SVGProps<SVGSVGElement> {
  num: number;
}

/**
 * Ringed circle enclosing a pathway number — used both as a dropdown option's leading icon and inside
 * the map pathway pills. A parameterized digit is why this is a component rather than a static `.svg`.
 * Renders with `currentColor`; the consumer sets the color (`theme.$icon-color`). Decorative by
 * default (`aria-hidden`, overridable via props) — the number reaches assistive tech through the
 * surrounding text (the Select option's `textValue`, the pill's own label), not this icon.
 */
export const PathwayNumber: FunctionComponent<PathwayNumberProps> = ({ num, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.25" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <text
      x="12"
      y="17.65"
      textAnchor="middle"
      fontFamily="Lato, sans-serif"
      fontSize="16"
      fontWeight="bold"
      fill="currentColor"
    >
      {num}
    </text>
  </svg>
);
