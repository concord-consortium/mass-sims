import { useRef, useState } from "react";
import {
  FRAME_HEIGHT,
  outerHeightFor,
  TARGET_WIDTHS,
  type TargetWidth,
} from "../layout/target-widths";
import { useFitScale } from "./use-fit-scale";
import { type FrameIssues, useFrameIssues } from "./use-frame-issues";

import "./width-preview.scss";

export interface WidthPreviewProps {
  simName: string;
  simUrl: string;
}

const ZOOM_OPTIONS = [
  { value: "fit", label: "Fit to window" },
  { value: "1", label: "100%" },
  { value: "0.75", label: "75%" },
  { value: "0.5", label: "50%" },
] as const;

type Zoom = (typeof ZOOM_OPTIONS)[number]["value"];

const WIDEST = Math.max(...TARGET_WIDTHS.map((w) => w.px));

/**
 * Turn measured issues into messages a developer can act on. Each says *what* is wrong and *by how
 * much* or *which element* — "it doesn't fit" isn't actionable; "18 px too tall" is.
 */
export function describeIssues(issues: FrameIssues): string[] {
  const { overflow, clipped, escaping } = issues;
  const messages: string[] = [];

  const axes = [
    overflow.y > 0 ? `${overflow.y} px too tall` : null,
    overflow.x > 0 ? `${overflow.x} px too wide` : null,
  ].filter(Boolean);
  if (axes.length) messages.push(`Content doesn’t fit — ${axes.join(", ")}`);

  // Name the offenders rather than just counting them: the first one or two are usually enough to
  // find the culprit, and the count covers the rest.
  if (clipped.length) {
    messages.push(
      `Text is clipped in ${listOf(clipped, "element")}: ${clipped.slice(0, 2).join(", ")}`,
    );
  }
  if (escaping.length) {
    messages.push(
      `${capitalize(listOf(escaping, "element"))} outside the frame: ${escaping.slice(0, 2).join(", ")}`,
    );
  }

  return messages;
}

const listOf = (items: string[], noun: string) =>
  items.length === 1 ? `1 ${noun}` : `${items.length} ${noun}s`;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface PreviewCardProps {
  width: TargetWidth;
  simName: string;
  simUrl: string;
  standalone: boolean;
  onStandaloneChange: (standalone: boolean) => void;
  /** Changing this remounts the frame. */
  nonce: number;
  onReload: () => void;
  scale: number;
}

function PreviewCard({
  width,
  simName,
  simUrl,
  standalone,
  onStandaloneChange,
  nonce,
  onReload,
  scale,
}: PreviewCardProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const issues = useFrameIssues(frameRef);
  const problems = describeIssues(issues);
  const height = outerHeightFor(standalone);

  return (
    <figure className="preview-card" style={{ width: width.px * scale }}>
      <figcaption className="card-caption">
        <span className="card-width">{width.px} px</span>
        {/* The label truncates when a card is narrow, so the full text needs somewhere to live. */}
        <span className="card-label" title={width.label}>
          {width.label}
        </span>
        <label className="card-toggle">
          <input
            type="checkbox"
            checked={standalone}
            onChange={(e) => onStandaloneChange(e.target.checked)}
          />
          Standalone
        </label>
        <button
          className="preview-button"
          type="button"
          onClick={onReload}
          aria-label={`Reload ${width.px} px frame`}
        >
          Reload
        </button>
      </figcaption>

      {/* A transform doesn't affect layout, so the scaled frame needs a box sized to its scaled
          footprint — otherwise the card still reserves the frame's full unscaled height and the
          cards can't sit side by side. */}
      <div className="card-scaler" style={{ width: width.px * scale, height: height * scale }}>
        <div
          className={problems.length ? "card-viewport overflowing" : "card-viewport"}
          style={{
            width: width.px,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <iframe
            key={`${width.px}-${standalone}-${nonce}`}
            className="card-frame"
            ref={frameRef}
            title={`${simName} at ${width.px} px${standalone ? ", standalone" : ""}`}
            src={`${simUrl}?standalone=${standalone}`}
            width={width.px}
            height={height}
          />
        </div>
      </div>

      {problems.length ? (
        <ul className="card-problems" role="status">
          {problems.map((problem) => (
            <li key={problem}>⚠ {problem}</li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

/**
 * Dev-only page: renders the host sim in an `<iframe>` at each of the four target widths, so a
 * developer can see at a glance whether the layout fits every Activity Player allocation.
 *
 * Zoom scales the frames with a CSS transform. That's deliberate: the iframe still *lays out* at its
 * real pixel width, so what you see is the true layout, merely drawn smaller — the sim inside is
 * never told it has less room than it really does. Scaling down far enough lets the cards wrap and
 * sit side by side for comparison.
 */
export function WidthPreview({ simName, simUrl }: WidthPreviewProps) {
  // Each card's standalone treatment, defaulting to the mode's real value (standalone only at 1024).
  // A dev can flip any card to see the other chrome treatment at that width.
  const [standaloneByWidth, setStandaloneByWidth] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(TARGET_WIDTHS.map((w) => [w.px, w.standalone])),
  );

  // Bumping a card's nonce changes its React key, which discards the old iframe and mounts a fresh
  // one — the only reliable way to reset a frame's sim state from outside.
  const [nonceByWidth, setNonceByWidth] = useState<Record<number, number>>(() =>
    Object.fromEntries(TARGET_WIDTHS.map((w) => [w.px, 0])),
  );

  const [zoom, setZoom] = useState<Zoom>("fit");

  const cardsRef = useRef<HTMLDivElement>(null);
  const fitScale = useFitScale(cardsRef, WIDEST, zoom === "fit");
  const scale = zoom === "fit" ? fitScale : Number(zoom);

  const reload = (px: number) =>
    setNonceByWidth((prev) => ({ ...prev, [px]: (prev[px] ?? 0) + 1 }));

  const reloadAll = () =>
    setNonceByWidth((prev) =>
      Object.fromEntries(Object.entries(prev).map(([px, n]) => [px, n + 1])),
    );

  return (
    <div className="width-preview">
      <header className="preview-header">
        <div>
          <h1 className="preview-title">
            {simName} — {TARGET_WIDTHS.length} target widths × {FRAME_HEIGHT} px
          </h1>
          <p className="preview-note">
            Each frame is a separate, independent instance of the sim — interacting with one does
            not affect the others. Content that doesn't fit its allocation, text that is clipped,
            and anything rendering outside the frame are flagged beneath the frame that has the
            problem. Zoom scales the rendering only; every frame still lays out at its true width.
          </p>
        </div>
        <div className="preview-controls">
          <label className="preview-zoom">
            Zoom
            <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)}>
              {ZOOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="preview-button" type="button" onClick={reloadAll}>
            Reload all
          </button>
        </div>
      </header>

      <div className="preview-cards" ref={cardsRef}>
        {TARGET_WIDTHS.map((width) => (
          <PreviewCard
            key={width.px}
            width={width}
            simName={simName}
            simUrl={simUrl}
            standalone={standaloneByWidth[width.px] ?? width.standalone}
            onStandaloneChange={(standalone) =>
              setStandaloneByWidth((prev) => ({ ...prev, [width.px]: standalone }))
            }
            nonce={nonceByWidth[width.px] ?? 0}
            onReload={() => reload(width.px)}
            scale={scale}
          />
        ))}
      </div>
    </div>
  );
}
