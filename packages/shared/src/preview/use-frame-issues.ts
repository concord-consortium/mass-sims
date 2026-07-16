import { type RefObject, useEffect, useState } from "react";

/**
 * Layout problems the width preview detects inside a sim's frame. All three are things an iframe
 * hides rather than advertises: a too-tall sim just gets a scrollbar, clipped text just looks like
 * shorter text, and content punching out of the standalone container is simply cut off. Each is a
 * real bug the preview should say out loud.
 */

export interface Overflow {
  x: number;
  y: number;
}

export interface FrameIssues {
  overflow: Overflow;
  clipped: string[];
  escaping: string[];
}

export const NO_ISSUES: FrameIssues = { overflow: { x: 0, y: 0 }, clipped: [], escaping: [] };

/**
 * Sub-pixel slop. Zoom transforms and fractional layout routinely leave a fraction of a pixel of
 * scrollable area (or a hair of an element) outside its box; reporting that would cry wolf.
 */
const THRESHOLD = 1;

/** The scroll-vs-client box of an element — the shape both a real element and a test stub provide. */
export interface ScrollBox {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * How far an element's content spills beyond the box it was given. A sim that renders taller than
 * its 562 px allocation is a bug; inside an iframe it would otherwise announce itself only as an
 * easy-to-miss scrollbar.
 */
export function measureOverflow(box: ScrollBox): Overflow {
  const x = box.scrollWidth - box.clientWidth;
  const y = box.scrollHeight - box.clientHeight;
  return {
    x: x > THRESHOLD ? Math.round(x) : 0,
    y: y > THRESHOLD ? Math.round(y) : 0,
  };
}

/** What `isTextClipped` needs to know about an element. */
export interface ClipProbe {
  overflowX: string;
  textOverflow: string;
  scrollWidth: number;
  clientWidth: number;
  /** Element children — only leaves are considered, so a clipped parent isn't double-reported. */
  childElementCount: number;
  text: string;
}

/**
 * Is this element's text actually cut off?
 *
 * An `ellipsis` is a deliberate, designed truncation, so it doesn't count. Hard-clipped text —
 * hidden overflow, no ellipsis, content wider than the box — is a layout bug: at a narrower width a
 * label is silently losing characters with nothing to show for it.
 */
export function isTextClipped(probe: ClipProbe): boolean {
  if (probe.overflowX !== "hidden") return false;
  if (probe.textOverflow === "ellipsis") return false;
  if (probe.childElementCount > 0) return false;
  if (!probe.text) return false;
  return probe.scrollWidth - probe.clientWidth > THRESHOLD;
}

export interface Edges {
  left: number;
  right: number;
}

/**
 * Does this element render outside the frame's horizontal bounds? The standalone container clips with
 * `overflow: hidden`, so escaping content is simply cut off rather than producing a scrollbar —
 * invisible unless something goes looking for it.
 */
export function isEscaping(el: Edges, frame: Edges): boolean {
  return el.right > frame.right + THRESHOLD || el.left < frame.left - THRESHOLD;
}

/**
 * Has an ancestor of this element already been flagged?
 *
 * When a container escapes the frame, so does every descendant inside it — reporting all of them
 * buries the one element you'd actually go fix under dozens of consequences of it. Only the outermost
 * offender is the finding.
 */
export function hasFlaggedAncestor(el: Element, flagged: Set<Element>): boolean {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (flagged.has(parent)) return true;
  }
  return false;
}

/** A short, human-recognizable name for an element, e.g. `span.tagline ("An interactive…")`. */
function describe(el: Element): string {
  const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
  const name = cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
  const text = el.textContent?.trim().slice(0, 30);
  return text ? `${name} ("${text}")` : name;
}

/** Walk a sim's document and collect what's wrong with its layout. */
export function inspectFrame(doc: Document): FrameIssues {
  const root = doc.documentElement;
  if (!root) return NO_ISSUES;

  const overflow = measureOverflow(root);
  const clipped: string[] = [];
  const escaping: string[] = [];

  const frameEl = doc.querySelector(".simulation-frame");
  const view = doc.defaultView;

  if (view && frameEl) {
    const frameRect = frameEl.getBoundingClientRect();
    // querySelectorAll is document order, so an ancestor is always visited before its descendants —
    // which is what lets `hasFlaggedAncestor` collapse a cascade to its outermost element.
    const escapingEls = new Set<Element>();

    for (const el of frameEl.querySelectorAll("*")) {
      const style = view.getComputedStyle(el);

      if (
        isTextClipped({
          overflowX: style.overflowX,
          textOverflow: style.textOverflow,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          childElementCount: el.childElementCount,
          text: el.textContent?.trim() ?? "",
        })
      ) {
        clipped.push(describe(el));
      }

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && isEscaping(rect, frameRect)) {
        escapingEls.add(el);
        // Report the container that broke out, not the dozens of children carried along with it.
        if (!hasFlaggedAncestor(el, escapingEls)) escaping.push(describe(el));
      }
    }
  }

  return { overflow, clipped, escaping };
}

/** True when two results are equivalent — so a 2 Hz poll doesn't re-render four iframes for nothing. */
function same(a: FrameIssues, b: FrameIssues): boolean {
  return (
    a.overflow.x === b.overflow.x &&
    a.overflow.y === b.overflow.y &&
    a.clipped.length === b.clipped.length &&
    a.escaping.length === b.escaping.length &&
    a.clipped.every((c, i) => c === b.clipped[i]) &&
    a.escaping.every((e, i) => e === b.escaping[i])
  );
}

/**
 * Watches an iframe's document and reports the layout problems inside it.
 *
 * Polled rather than observed: the sim's layout can change from any state update inside the frame,
 * and there's no single element whose resize reliably signals that. This is dev-only tooling and the
 * walk is small, so twice a second is free.
 *
 * Reports "no issues" if the document isn't reachable — same-origin holds for a sim served by its own
 * dev server (the only case today), but a cross-origin frame must degrade quietly rather than throw.
 */
export function useFrameIssues(ref: RefObject<HTMLIFrameElement | null>): FrameIssues {
  const [issues, setIssues] = useState<FrameIssues>(NO_ISSUES);

  useEffect(() => {
    const measure = () => {
      let next = NO_ISSUES;
      try {
        const doc = ref.current?.contentDocument;
        if (doc) next = inspectFrame(doc);
      } catch {
        // Cross-origin frame — nothing we can measure. Report "no issues" rather than a false alarm.
        next = NO_ISSUES;
      }
      setIssues((prev) => (same(prev, next) ? prev : next));
    };

    measure();
    const id = setInterval(measure, 500);
    return () => clearInterval(id);
  }, [ref]);

  return issues;
}
