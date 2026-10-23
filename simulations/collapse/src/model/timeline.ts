import type { FunctionComponent, SVGProps } from "react";
import CollapseArt from "../assets/timeline/collapse-icon.svg?react";
import CorvetteMuseumArt from "../assets/timeline/corvette-museum-icon.svg?react";
import HumansAfricaArt from "../assets/timeline/humans-africa-icon.svg?react";
import IceAgeArt from "../assets/timeline/ice-age-icon.svg?react";
import MammothArt from "../assets/timeline/mammoth-icon.svg?react";
import PyramidsArt from "../assets/timeline/pyramids-icon.svg?react";

export type ArtComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

/** A dated landmark on the timeline. The student reads these; the handle lands on `TIMELINE_VALUES`. */
export interface TimelineStop {
  /** Years before collapse, or `null` for the current-year end marker. */
  years: number | null;
  /** The dot's design position, as a fraction of the track at full width. */
  at: number;
  /** The year label. Absent on the end marker, which shows `currentYear()` at render time. */
  yearLabel?: string;
  eventLines: string[];
  /** Full-color artwork, bottom-aligned in the icon slot so it hangs upward. */
  art?: ArtComponent;
  /** The 0 stop and the year marker: drawn hollow. */
  end: boolean;
}

/**
 * The dots are spaced so each gap fits the labels on either side, not by log scale: a log scale
 * leaves a wide empty stretch between 4,600 and 20 and crowds the left pair. Where the values fall
 * between the dots is what carries meaning; see `segmentsFor`.
 *
 * 11,700 and 4,600 are reference marks, not landable values: the handle never stops on them.
 */
export const TIMELINE_STOPS: readonly TimelineStop[] = [
  // Homo sapiens appear in the African fossil record ~200,000–300,000 years ago.
  {
    years: 200000,
    at: 0,
    yearLabel: "200,000 yr",
    eventLines: ["Modern humans", "appear in Africa"],
    art: HumansAfricaArt,
    end: false,
  },
  // Woolly mammoths began crossing Beringia into North America about then.
  {
    years: 100000,
    at: 0.2195,
    yearLabel: "100,000 yr",
    eventLines: ["Woolly mammoths", "reach N. America"],
    art: MammothArt,
    end: false,
  },
  // The ratified base of the Holocene (NGRIP ice core). Reference mark only.
  {
    years: 11700,
    at: 0.4208,
    yearLabel: "11,700 yr",
    eventLines: ["Last Ice", "Age ends"],
    art: IceAgeArt,
    end: false,
  },
  // The middle of the Old Kingdom pyramid age. Reference mark only.
  {
    years: 4600,
    at: 0.6222,
    yearLabel: "4,600 yr",
    eventLines: ["Pyramids", "are built"],
    art: PyramidsArt,
    end: false,
  },
  // The museum opened in 1994, 20 years before the 2014 collapse. Its `at` is set by the 20 → 0 gap,
  // which never compresses; change a label on either stop and that gap has to be recomputed.
  {
    years: 20,
    at: 0.8454,
    yearLabel: "20 yr",
    eventLines: ["Corvette", "Museum"],
    art: CorvetteMuseumArt,
    end: false,
  },
  {
    years: 0,
    at: 0.9466,
    yearLabel: "0 yr",
    eventLines: ["Cave roof", "collapses"],
    art: CollapseArt,
    end: true,
  },
  { years: null, at: 1, eventLines: [], end: true },
];

/** The values the handle can land on, in years before collapse, descending. */
export const TIMELINE_VALUES: readonly number[] = [
  200000, 150000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 0,
];

/** Where a value sits: a fraction `t` of the way from stop `hi` to stop `hi + 1`. */
export interface TimelineSegment {
  hi: number;
  t: number;
}

/**
 * Pins each value between the two stops that bracket it, by elapsed time, so distance on the rail
 * means time (5,000 sits almost on the 4,600 dot; 150,000 halfway between 200,000 and 100,000).
 * Where a stretch spans more than 20× (4,600 → 20) or ends at 0, equal time stops being readable,
 * so the values inside it share the gap evenly instead. The result is a `t`, not a track fraction,
 * because the layout moves the dots when the window is narrow and the values have to follow them.
 */
export function segmentsFor(
  values: readonly number[],
  stops: readonly TimelineStop[],
): TimelineSegment[] {
  const anchors = stops.filter((s): s is TimelineStop & { years: number } => s.years !== null);
  return values.map((v) => {
    for (let i = 0; i < anchors.length - 1; i++) {
      const hi = anchors[i].years;
      const lo = anchors[i + 1].years;
      if (v <= hi && v >= lo) {
        if (v === hi) return { hi: i, t: 0 };
        if (v === lo) return { hi: i, t: 1 };
        if (lo === 0 || hi / lo > 20) {
          const inner = values.filter((x) => x < hi && x > lo);
          return { hi: i, t: (inner.indexOf(v) + 1) / (inner.length + 1) };
        }
        return { hi: i, t: (hi - v) / (hi - lo) };
      }
    }
    return { hi: anchors.length - 2, t: 1 };
  });
}

export const TIMELINE_SEGMENTS: readonly TimelineSegment[] = segmentsFor(
  TIMELINE_VALUES,
  TIMELINE_STOPS,
);

/** The one place the calendar year is read. */
export function currentYear(now = new Date()): number {
  return now.getFullYear();
}

export function formatYears(v: number): string {
  return v.toLocaleString("en-US");
}
