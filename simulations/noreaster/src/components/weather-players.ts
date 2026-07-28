import type { SceneSpec, StormMode } from "./weather-scenes";

/**
 * The four Data-panel particle systems — careful ports of an approved animation prototype; the constants
 * (angles, spawn ranges, colors) are tuned to match it, so treat them as data, not knobs to casually adjust.
 * Ported from the signed-off prototype v1.16. Live source:
 * https://models-resources.concord.org/demos/branch/masssims/.
 *
 * Backdrop and particles are split: the players draw only the PARTICLES (the backdrop is CSS,
 * `weather-scene.scss`). Each draws on the fixed 400px artboard and accumulates its own clamped elapsed time
 * (so pausing/resuming stays smooth); the hook owns sizing, the DPR transform, scheduling, and start/stop.
 */

/** A player renders one frame of particles onto the 400×`h` logical artboard. `deltaMs` is 0 on frame 1. */
export interface WeatherPlayer {
  step(ctx: CanvasRenderingContext2D, w: number, h: number, deltaMs: number): void;
}

interface Point {
  x: number;
  y: number;
}

/** Fixed logical artboard width. The single source for this invariant. */
export const ARTBOARD_WIDTH = 400;

/** First-frame seed delta (the animate loops use 0.016 before there's a real previous timestamp). */
const SEED_DT = 0.016;
/** Per-frame delta in seconds, clamped at 0.05 so a long stall can't fling particles across the artboard. */
function toDt(deltaMs: number): number {
  return deltaMs > 0 ? Math.min(deltaMs / 1000, 0.05) : SEED_DT;
}

// ─── Snow — `strong` / `moderate` / `weakCoastal` ────────────────────────────────────────────────────────
// Three DISTINCT precipitation systems selected by `mode`, NOT one effect scaled by a number.
// `strong`/`moderate` spawn angled rain streaks; `weak` spawns a 50/50 rain-streak-or-wet-snow-dot mix.
// `intensity` (1 / 0.68 / 0.3) scales GUSTS ONLY (timing/count/force), not base spawn/angle/speed.

interface Flake {
  x: number;
  y: number;
  sz: number;
  op: number;
  vx: number;
  vy: number;
  type: "rain" | "wetsnow";
  thick?: number;
}

function createSnowPlayer(mode: StormMode, intensity: number): WeatherPlayer {
  let flakes: Flake[] = [];
  let elapsed = 0;
  let gustUntil = 0;
  let nextGust = Math.random() * 1.2;

  // Spawn one flake. The prototype has a white-flake fallback branch that the three storm modes never reach,
  // so it is intentionally omitted here.
  function spawn(w: number, gust: boolean): void {
    if (mode === "strong" || mode === "moderate") {
      const isMod = mode === "moderate";
      const depth = Math.random();
      let len: number;
      let thick: number;
      let op: number;
      let baseSpeed: number;
      if (isMod) {
        len =
          depth < 0.3
            ? 4 + Math.random() * 5
            : depth < 0.7
              ? 6 + Math.random() * 7
              : 8 + Math.random() * 9;
        thick =
          depth < 0.3
            ? 0.8 + Math.random() * 0.3
            : depth < 0.7
              ? 1.1 + Math.random() * 0.5
              : 1.5 + Math.random() * 0.5;
        op =
          depth < 0.3
            ? 0.15 + Math.random() * 0.12
            : depth < 0.7
              ? 0.3 + Math.random() * 0.2
              : 0.5 + Math.random() * 0.25;
        baseSpeed =
          depth < 0.3
            ? 190 + Math.random() * 70
            : depth < 0.7
              ? 270 + Math.random() * 110
              : 350 + Math.random() * 140;
      } else {
        len =
          depth < 0.3
            ? 4 + Math.random() * 5
            : depth < 0.7
              ? 6 + Math.random() * 8
              : 9 + Math.random() * 10;
        thick =
          depth < 0.3
            ? 0.8 + Math.random() * 0.4
            : depth < 0.7
              ? 1.2 + Math.random() * 0.5
              : 1.6 + Math.random() * 0.6;
        op =
          depth < 0.3
            ? 0.2 + Math.random() * 0.15
            : depth < 0.7
              ? 0.4 + Math.random() * 0.25
              : 0.6 + Math.random() * 0.3;
        baseSpeed =
          depth < 0.3
            ? 200 + Math.random() * 80
            : depth < 0.7
              ? 300 + Math.random() * 120
              : 380 + Math.random() * 200;
      }
      const speed = gust ? baseSpeed * (isMod ? 1.5 : 1.8) : baseSpeed;
      const normAng = isMod ? 250 : 238;
      const gustAng = isMod ? 243 : 230;
      const windAngle =
        ((gust ? gustAng + (Math.random() - 0.5) * 8 : normAng + (Math.random() - 0.5) * 12) *
          Math.PI) /
        180;
      flakes.push({
        x: -10 + Math.random() * (w + 200),
        y: -len,
        sz: len,
        op,
        vx: Math.cos(windAngle) * speed,
        vy: -Math.sin(windAngle) * speed,
        type: "rain",
        thick,
      });
    } else {
      // weak: each particle is a rain streak OR a small wet-snow dot, 50/50.
      const isRain = Math.random() < 0.5;
      const windAngle =
        ((gust ? 253 + (Math.random() - 0.5) * 8 : 258 + (Math.random() - 0.5) * 10) * Math.PI) /
        180;
      if (isRain) {
        const len = 4 + Math.random() * 11;
        const speed = gust ? 240 + Math.random() * 80 : 190 + Math.random() * 90;
        flakes.push({
          x: -10 + Math.random() * (w + 100),
          y: -len,
          sz: len,
          op: 0.5 + Math.random() * 0.25,
          vx: Math.cos(windAngle) * speed,
          vy: -Math.sin(windAngle) * speed,
          type: "rain",
          thick: 1 + Math.random() * 0.8,
        });
      } else {
        const sz = 0.75 + Math.random() * 1;
        const speed = gust ? 90 + Math.random() * 40 : 60 + Math.random() * 35;
        flakes.push({
          x: -sz + Math.random() * (w + 100 + sz),
          y: -sz,
          sz,
          op: 0.25 + Math.random() * 0.25,
          vx: Math.cos(windAngle) * speed,
          vy: -Math.sin(windAngle) * speed,
          type: "wetsnow",
        });
      }
    }
  }

  return {
    step(ctx, w, h, deltaMs) {
      const dt = toDt(deltaMs);
      elapsed += dt;

      const gusting = elapsed < gustUntil;
      if (!gusting && elapsed > nextGust) {
        gustUntil =
          elapsed +
          (intensity < 0.5
            ? 0.3 + Math.random() * 0.6
            : intensity < 1
              ? 0.6 + Math.random() * 1.7
              : 1 + Math.random() * 2.5);
        nextGust =
          gustUntil +
          (intensity < 0.5
            ? 3 + Math.random() * 5
            : intensity < 1
              ? Math.random() * 3.5
              : Math.random() * 2.5);
      }
      if (gusting) {
        const gustMin = intensity < 0.5 ? 2 : intensity < 1 ? 5 : 12;
        const gustMax = intensity < 0.5 ? 4 : intensity < 1 ? 10 : 24;
        const gustCount = gustMin + Math.floor(Math.random() * (gustMax - gustMin + 1));
        for (let gi = 0; gi < gustCount; gi++) spawn(w, true);
      }

      const baseCount =
        mode === "strong"
          ? 28 + Math.floor(Math.random() * 8)
          : mode === "moderate"
            ? 25 + Math.floor(Math.random() * 8)
            : 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < baseCount; i++) spawn(w, false);

      for (const f of flakes) {
        if (gusting) {
          const gustMult = intensity >= 1 ? 3.5 : 2.2;
          f.vx += -120 * intensity * gustMult * dt;
          f.vy += 30 * intensity * gustMult * dt;
        }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      // Offscreen removal (no cap) — drop flakes that have left the artboard.
      flakes = flakes.filter((f) => f.x > -10 && f.x < w + 210 && f.y > -10 && f.y < h + 10);

      ctx.clearRect(0, 0, w, h);
      for (const sf of flakes) {
        if (sf.type === "rain") {
          const a = Math.atan2(sf.vy, sf.vx);
          const hx = sf.x + Math.cos(a) * sf.sz;
          const hy = sf.y + Math.sin(a) * sf.sz;
          const grad = ctx.createLinearGradient(sf.x, sf.y, hx, hy);
          grad.addColorStop(0, "rgba(200,210,220,0)");
          grad.addColorStop(0.4, `rgba(200,210,220,${(sf.op * 0.6).toFixed(2)})`);
          grad.addColorStop(1, `rgba(200,210,220,${sf.op.toFixed(2)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = sf.thick || 1.3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sf.x, sf.y);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(210,220,230,${sf.op.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sf.x, sf.y, sf.sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  };
}

// ─── Gold sun-ray engine — shared by `fair` and `windy` ──────────────────────────────────────────────────
// The same 11-ray gold engine, from a sun just off the top-right corner. `fair` is rays only; `windy` layers
// wind-curls on top.

const RAY_COUNT = 11;

interface Ray {
  angle: number;
  width: number;
  onDur: number;
  offDur: number;
  phase: number;
  maxOp: number;
}

function initRays(): Ray[] {
  const rays: Ray[] = [];
  const arcStart = Math.PI * 0.45;
  const arcSpan = Math.PI * 1.05;
  const step = arcSpan / RAY_COUNT;
  for (let i = 0; i < RAY_COUNT; i++) {
    rays.push({
      angle: arcStart + step * (i + 0.5) + (Math.random() - 0.5) * step * 0.3,
      width: 0.1 + Math.random() * 0.08,
      onDur: 1.5 + Math.random() * 4,
      offDur: 1 + Math.random() * 4,
      phase: Math.random() * 6,
      maxOp: 0.15 + Math.random() * 0.25,
    });
  }
  return rays;
}

function drawRays(
  ctx: CanvasRenderingContext2D,
  rays: Ray[],
  w: number,
  h: number,
  elapsed: number,
): void {
  const cx = w + 30;
  const cy = -30;
  const maxR = Math.sqrt(w * w + h * h);
  for (const r of rays) {
    const cycle = r.onDur + r.offDur;
    const t = (elapsed + r.phase) % cycle;
    let op: number;
    if (t < 0.4) op = t / 0.4;
    else if (t < r.onDur - 0.4) op = 1;
    else if (t < r.onDur) op = (r.onDur - t) / 0.4;
    else op = 0;
    op *= r.maxOp;
    if (op <= 0) continue;
    const halfW = r.width;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(r.angle - halfW) * maxR, cy + Math.sin(r.angle - halfW) * maxR);
    ctx.lineTo(cx + Math.cos(r.angle + halfW) * maxR, cy + Math.sin(r.angle + halfW) * maxR);
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.8);
    grad.addColorStop(0, "rgba(255,180,0,1)");
    grad.addColorStop(0.3, "rgba(255,200,40,0.7)");
    grad.addColorStop(0.7, "rgba(255,220,80,0.3)");
    grad.addColorStop(1, "rgba(255,240,150,0)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }
}

function createSunRaysPlayer(): WeatherPlayer {
  const rays = initRays();
  let elapsed = 0;
  return {
    step(ctx, w, h, deltaMs) {
      elapsed += toDt(deltaMs);
      ctx.clearRect(0, 0, w, h);
      drawRays(ctx, rays, w, h, elapsed);
    },
  };
}

// ─── Windy / breezy — `windy` ────────────────────────────────────────────────────────────────────────────
// Same gold ray engine as `fair`, plus an intermittent white wind-curl system: gray `#949494` dots overlaid
// with smaller white `#fff` dots traced along 295px SVG-derived Bézier paths at seven artboard offsets.

const WIND_BUFFER_H = 200; // fixed reference height for the curl `oy` offsets (keeps them in the upper band)
const CURL_PATH_W = 295; // the SVG paths' width; curl base offset is `(400 - 295) / 2`

// The three curl path PAIRS (each a pair of ~295px-wide SVG `d` strings).
const WIND_SVG_PAIRS: string[][] = [
  [
    "M0,27.46308c57.82767,7.76785,85.86575-8.19098,140.26462-8.16173,29.73222.01598,61.96061,10.55801,82.98509,12.39621,36.91986,3.22797,51.41359-11.01557,61.99526-11.01557,5.15466,0,9.33333,4.17868,9.33333,9.33333,0,4.12373-3.34294,7.46667-7.46667,7.46667-3.29898,0-5.97333-2.67435-5.97333-5.97333,0-2.63918,2.13948-4.77867,4.77867-4.77867,2.11135,0,3.82293,1.71159,3.82293,3.82293",
    "M0,11.87387c31.31385,11.55019,97.70231-.9527,128.58059-1.21264,35.96744-.30279,67.24364,8.8609,86.18295,13.07701,20.78785,4.62762,40.0104,2.4683,51.78973-2.49889,8.16271-3.44211,14.2106-8.02701,14.2106-14.83935C280.76387,2.86538,277.89849,0,274.36387,0c-2.8277,0-5.12,2.2923-5.12,5.12,0,2.26216,1.83384,4.096,4.096,4.096,1.80973,0,3.2768-1.46707,3.2768-3.2768",
  ],
  [
    "M0,29.67376c5.09891-1.24784,59.80742-9.1836,113.21522-7.76684,39.04353,1.03571,75.07484,11.21798,106.50772,12.88927,31.7945,1.69052,54.03517-9.91183,63.68348-9.5662,4.17014.14939,7.55556,3.38274,7.55556,7.55556,0,3.33825-2.70619,6.04444-6.04444,6.04444-2.6706,0-4.83556-2.16495-4.83556-4.83556,0-2.13648,1.73196-3.86844,3.86844-3.86844",
    "M0,25.00029c10.67878-2.82081,62.17857-15.326,114.29856-12.77166,40.84732,2.00188,70.71762,13.82308,104.72032,15.60629,31.70296,1.6626,63.58691-6.32295,70.95574-10.17297,4.56867-2.387,9.77984-4.94613,9.98171-10.19528C300.11479,3.34599,296.61338,0,292.48966,0c-3.29898,0-5.97333,2.67435-5.97333,5.97333,0,2.63918,2.13948,4.77867,4.77867,4.77867",
  ],
  [
    "M0,13.21805c16.54896,4.76735,41.94695,11.90528,87.29231,11.80579,47.31277-.10381,84.94369-7.18901,127.93617-8.67364,31.85222-1.09993,61.73281,6.76884,73.92234,10.36389,4.49728,1.32638,8.88889,3.97969,8.88889,8.88889,0,3.92736-3.18375,7.11111-7.11111,7.11111-3.14189,0-5.68889-2.547-5.68889-5.68889,0-2.51351,2.0376-4.55111,4.55111-4.55111,2.01081,0,3.64089,1.63008,3.64089,3.64089",
    "M0,4.29278c28.00349,4.17753,58.14304,8.83354,103.51514,9.90885,47.8752,1.13463,75.01222-6.47108,118.36498-4.42195,32.10021,1.51726,49.2839,11.13195,67.07777,7.82032,5.75812-1.07165,9.77778-4.37766,9.77778-9.77778,0-4.32009-3.50213-7.82222-7.82222-7.82222-3.45608,0-6.25778,2.8017-6.25778,6.25778,0,2.76486,2.24136,5.00622,5.00622,5.00622,2.21189,0,4.00498-1.79309,4.00498-4.00498",
  ],
];

/** Sample a cubic Bézier segment `[x0,y0, c1x,c1y, c2x,c2y, x1,y1]` at `n+1` points. */
function sampleCurlBezier(seg: number[], n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * u * seg[0] + 3 * u * u * t * seg[2] + 3 * u * t * t * seg[4] + t * t * t * seg[6],
      y: u * u * u * seg[1] + 3 * u * u * t * seg[3] + 3 * u * t * t * seg[5] + t * t * t * seg[7],
    });
  }
  return pts;
}

/** Parse an SVG path `d` into a sampled polyline (20 samples per cubic). */
function parseSVGCurvePoints(d: string): Point[] {
  const tokens: (string | number)[] = [];
  const re = /([A-Za-z])|([-+]?(?:\d+\.?\d*|\.\d+))/g;
  let m: RegExpExecArray | null = re.exec(d);
  while (m !== null) {
    tokens.push(m[1] || Number.parseFloat(m[2]));
    m = re.exec(d);
  }
  const pts: Point[] = [];
  let cx = 0;
  let cy = 0;
  let i = 0;
  let cmd = "";
  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === "string") {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") break;
      continue;
    }
    if (cmd === "M") {
      cx = tokens[i++] as number;
      cy = tokens[i++] as number;
      pts.push({ x: cx, y: cy });
      cmd = "L";
    } else if (cmd === "m") {
      cx += tokens[i++] as number;
      cy += tokens[i++] as number;
      pts.push({ x: cx, y: cy });
      cmd = "l";
    } else if (cmd === "c") {
      const seg = [
        cx,
        cy,
        cx + (tokens[i] as number),
        cy + (tokens[i + 1] as number),
        cx + (tokens[i + 2] as number),
        cy + (tokens[i + 3] as number),
        cx + (tokens[i + 4] as number),
        cy + (tokens[i + 5] as number),
      ];
      const sp = sampleCurlBezier(seg, 20);
      for (let k = pts.length > 0 ? 1 : 0; k < sp.length; k++) pts.push(sp[k]);
      cx += tokens[i + 4] as number;
      cy += tokens[i + 5] as number;
      i += 6;
    } else if (cmd === "C") {
      const seg = [
        cx,
        cy,
        tokens[i] as number,
        tokens[i + 1] as number,
        tokens[i + 2] as number,
        tokens[i + 3] as number,
        tokens[i + 4] as number,
        tokens[i + 5] as number,
      ];
      const sp = sampleCurlBezier(seg, 20);
      for (let k = 1; k < sp.length; k++) pts.push(sp[k]);
      cx = tokens[i + 4] as number;
      cy = tokens[i + 5] as number;
      i += 6;
    } else if (cmd === "l") {
      cx += tokens[i++] as number;
      cy += tokens[i++] as number;
      pts.push({ x: cx, y: cy });
    } else if (cmd === "L") {
      cx = tokens[i++] as number;
      cy = tokens[i++] as number;
      pts.push({ x: cx, y: cy });
    } else if (cmd === "h") {
      cx += tokens[i++] as number;
      pts.push({ x: cx, y: cy });
    } else if (cmd === "H") {
      cx = tokens[i++] as number;
      pts.push({ x: cx, y: cy });
    } else {
      i++;
    }
  }
  return pts;
}

// `WIND_SVG_PAIRS` parsed to sampled polylines once at module load — deterministic, reused across scenes.
const WIND_PARSED_PAIRS: Point[][][] = WIND_SVG_PAIRS.map((pair) =>
  pair.map((d) => parseSVGCurvePoints(d)),
);

interface Curl {
  rawPts: Point[];
  baseOx: number;
  baseOy: number;
  pts: Point[] | null;
  jitterX: number;
  jitterY: number;
  lastCycle: number;
  delay: number;
  traceDur: number;
  segFrac: number;
  group: number;
}

interface WindSeq {
  slots: { group: number; startT: number }[];
  phase: "wait" | "play";
  waitStart: number;
  gap: number;
  lastUsed: number[];
}

function createWindyPlayer(): WeatherPlayer {
  const rays = initRays();
  let elapsed = 0;

  // The `oy` offsets are relative to the fixed `WIND_BUFFER_H` (not the header height), so curls sit in the
  // upper "sky" band.
  const base = (ARTBOARD_WIDTH - CURL_PATH_W) / 2;
  const half = (WIND_BUFFER_H - 38) / 2;
  const windPositions = [
    { ox: base + 35, oy: half + 20 },
    { ox: base - 55, oy: half + 5 },
    { ox: base - 140, oy: half + 15 },
    { ox: base + 45, oy: half - 80 },
    { ox: base - 20, oy: half - 65 },
    { ox: base - 95, oy: half - 50 },
    { ox: base - 175, oy: half - 70 },
  ];
  const parsedPairs = WIND_PARSED_PAIRS;
  const curls: Curl[] = [];
  for (let wp = 0; wp < windPositions.length; wp++) {
    const initPair = Math.floor(Math.random() * parsedPairs.length);
    for (let pi = 0; pi < 2; pi++) {
      curls.push({
        rawPts: parsedPairs[initPair][pi],
        baseOx: windPositions[wp].ox,
        baseOy: windPositions[wp].oy,
        pts: null,
        jitterX: Math.random() * 20,
        jitterY: Math.random() * 20,
        lastCycle: -1,
        delay: pi * 0.15,
        traceDur: 1.15,
        segFrac: 0.3,
        group: wp,
      });
    }
  }
  let seq: WindSeq | null = null;

  return {
    step(ctx, w, h, deltaMs) {
      elapsed += toDt(deltaMs);
      ctx.clearRect(0, 0, w, h);
      drawRays(ctx, rays, w, h, elapsed);

      const whiteParts: { x: number; y: number; r: number }[] = [];
      if (!seq) seq = { slots: [], phase: "wait", waitStart: elapsed - 10, gap: 0, lastUsed: [] };

      seq.slots = seq.slots.filter((s) => {
        const sc = curls[s.group * 2];
        const slotMaxVis = sc.traceDur * (1 + sc.segFrac) + curls[s.group * 2 + 1].delay;
        return elapsed - s.startT <= slotMaxVis;
      });
      if (seq.slots.length === 0 && seq.phase === "play") {
        seq.phase = "wait";
        seq.waitStart = elapsed;
        seq.gap = 0.5 + Math.random() * 3.75;
      }
      if (seq.phase === "wait" && elapsed - seq.waitStart > seq.gap) {
        const count = 1 + Math.floor(Math.random() * 3);
        // Pick `count` DISTINCT unused positions from a filtered pool (removing each choice). The prototype
        // uses `do/while` rejection sampling, which would spin forever if the constants drifted so picks+used
        // cover all positions; this pool has the same distribution and its `&& candidates.length` guard can't
        // hang.
        const candidates: number[] = [];
        for (let i = 0; i < windPositions.length; i++) {
          if (!seq.lastUsed.includes(i)) candidates.push(i);
        }
        const picked: number[] = [];
        for (let si = 0; si < count && candidates.length > 0; si++) {
          const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
          picked.push(pick);
          const pairIdx = Math.floor(Math.random() * parsedPairs.length);
          const ci0 = pick * 2;
          curls[ci0].rawPts = parsedPairs[pairIdx][0];
          curls[ci0 + 1].rawPts = parsedPairs[pairIdx][1];
          const speedVar = 0.75 + Math.random() * 0.75;
          curls[ci0].traceDur = 1.15 * speedVar;
          curls[ci0 + 1].traceDur = 1.15 * speedVar;
          const stagger = si * (0.3 + Math.random() * 0.4);
          seq.slots.push({ group: pick, startT: elapsed + stagger });
        }
        seq.lastUsed = picked;
        seq.phase = "play";
      }

      for (const slot of seq.slots) {
        for (let ci = slot.group * 2; ci < slot.group * 2 + 2 && ci < curls.length; ci++) {
          const wc = curls[ci];
          if (wc.lastCycle !== slot.startT) {
            wc.lastCycle = slot.startT;
            let jx = Math.random() * 20;
            let jy = Math.random() * 20;
            if (wc.delay > 0) {
              const prev = curls[ci - 1];
              jx = prev.jitterX;
              jy = prev.jitterY;
            }
            wc.jitterX = jx;
            wc.jitterY = jy;
            wc.pts = wc.rawPts.map((p) => ({
              x: p.x + wc.baseOx + wc.jitterX,
              y: p.y + wc.baseOy + wc.jitterY,
            }));
          }
          if (seq.phase !== "play") continue;
          const totalVis = wc.traceDur * (1 + wc.segFrac);
          const ct = elapsed - slot.startT - wc.delay;
          if (ct < 0 || ct > totalVis) continue;
          const headLin = Math.min(1, ct / wc.traceDur);
          const headFrac = headLin * headLin * headLin;
          const tailLin = Math.min(1, Math.max(0, (ct - wc.segFrac * wc.traceDur) / wc.traceDur));
          const tailFrac = tailLin * tailLin * tailLin;
          if (headFrac - tailFrac < 0.01) continue;
          const pts = wc.pts;
          if (!pts) continue;
          const tailIdx = Math.floor(tailFrac * (pts.length - 1));
          const headIdx = Math.min(Math.ceil(headFrac * (pts.length - 1)), pts.length - 1);
          if (headIdx - tailIdx < 2) continue;
          const totalParticles = (headIdx - tailIdx) * 3; // subSteps = 3
          for (let si = 0; si <= totalParticles; si++) {
            const fIdx = tailIdx + si / 3;
            const pi0 = Math.floor(fIdx);
            const pi1 = Math.min(pi0 + 1, pts.length - 1);
            const lerp = fIdx - pi0;
            const px = pts[pi0].x + (pts[pi1].x - pts[pi0].x) * lerp;
            const py = pts[pi0].y + (pts[pi1].y - pts[pi0].y) * lerp;
            const localFrac = si / totalParticles;
            ctx.fillStyle = "#949494";
            ctx.beginPath();
            ctx.arc(px, py, 1.2 + Math.sin(localFrac * Math.PI) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            whiteParts.push({ x: px, y: py, r: 0.5 + Math.sin(localFrac * Math.PI) * 1.0 });
          }
        }
      }
      ctx.fillStyle = "#fff";
      for (const wp of whiteParts) {
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

// ─── Haze — `humidNoStorm` ───────────────────────────────────────────────────────────────────────────────
// 6–9 warm drifting wisps + an intermittent light-rain shower driven by a gap→rampup→peak→rampdown machine.

interface Wisp {
  y: number;
  height: number;
  curve1: number;
  curve2: number;
  op: number;
  vy: number;
}

interface HazeDot {
  x: number;
  y: number;
  sz: number;
  op: number;
  vx: number;
  vy: number;
  thick: number;
}

function createHazePlayer(): WeatherPlayer {
  let wisps: Wisp[] | null = null; // lazy-init on the first frame, when the header height `h` is known
  let dots: HazeDot[] = [];
  let elapsed = 0;
  let phase: "gap" | "rampup" | "peak" | "rampdown" = "gap";
  let phaseStart = 0;
  let rampUp = 0;
  let peak = 0;
  let rampDown = 0;
  let gapEnd = 0.5 + Math.random() * 4;

  function initWisps(h: number): Wisp[] {
    const count = 6 + Math.floor(Math.random() * 4);
    const arr: Wisp[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        y: (i / count) * h + (Math.random() - 0.5) * (h / count),
        height: 15 + Math.random() * 30,
        curve1: (Math.random() - 0.5) * 40,
        curve2: (Math.random() - 0.5) * 40,
        op: 0.06 + Math.random() * 0.1,
        vy: (Math.random() - 0.5) * 2,
      });
    }
    return arr;
  }

  function spawnRain(w: number): void {
    const len = 5 + Math.random() * 20;
    const speed = 190 + Math.random() * 190;
    const windAngle = ((262 + (Math.random() - 0.5) * 10) * Math.PI) / 180;
    dots.push({
      x: Math.random() * w,
      y: -len,
      sz: len,
      op: 0.5 + Math.random() * 0.25,
      vx: Math.cos(windAngle) * speed,
      vy: -Math.sin(windAngle) * speed,
      thick: 1 + Math.random() * 1.2,
    });
  }

  function drawWisps(ctx: CanvasRenderingContext2D, w: number): void {
    if (!wisps) return;
    const third = w / 3;
    const twoThird = (2 * w) / 3;
    for (const wp of wisps) {
      const cy = wp.y;
      const hh = wp.height / 2;
      const grad = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
      grad.addColorStop(0, "rgba(140,130,115,0)");
      grad.addColorStop(0.3, `rgba(140,130,115,${wp.op.toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(140,130,115,${(wp.op * 1.2).toFixed(3)})`);
      grad.addColorStop(0.7, `rgba(140,130,115,${wp.op.toFixed(3)})`);
      grad.addColorStop(1, "rgba(140,130,115,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, cy - hh);
      ctx.bezierCurveTo(third, cy - hh + wp.curve1, twoThird, cy - hh + wp.curve2, w, cy - hh);
      ctx.lineTo(w, cy + hh);
      ctx.bezierCurveTo(twoThird, cy + hh + wp.curve2, third, cy + hh + wp.curve1, 0, cy + hh);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The prototype's non-rain dot branch is unreachable (`spawnRain` only makes rain), so it is omitted.
  return {
    step(ctx, w, h, deltaMs) {
      const dt = toDt(deltaMs);
      elapsed += dt;
      if (!wisps) wisps = initWisps(h);

      let intensity = 0;
      if (phase === "gap") {
        if (elapsed > gapEnd) {
          phase = "rampup";
          phaseStart = elapsed;
          rampUp = 2.5 + Math.random() * 4.5;
          peak = 0.1 + Math.random() * 3.9;
          rampDown = 2.5 + Math.random() * 4.5;
        }
      }
      if (phase === "rampup") {
        const rampT = (elapsed - phaseStart) / rampUp;
        if (rampT >= 1) {
          phase = "peak";
          phaseStart = elapsed;
          intensity = 1;
        } else {
          intensity = rampT * rampT;
        }
      } else if (phase === "peak") {
        intensity = 1;
        if (elapsed - phaseStart > peak) {
          phase = "rampdown";
          phaseStart = elapsed;
        }
      } else if (phase === "rampdown") {
        const downT = (elapsed - phaseStart) / rampDown;
        if (downT >= 1) {
          phase = "gap";
          gapEnd = elapsed + 1 + Math.random() * 7;
          intensity = 0;
        } else {
          intensity = (1 - downT) * (1 - downT);
        }
      }
      if (intensity > 0) {
        const maxCount = 3 + Math.floor(Math.random() * 13);
        const count = Math.round(maxCount * intensity);
        for (let i = 0; i < count; i++) spawnRain(w);
      }

      for (const d of dots) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      dots = dots.filter((d) => d.x > -10 && d.x < w + 10 && d.y > -10 && d.y < h + 10);
      for (const wp of wisps) {
        wp.y += wp.vy * dt;
        if (wp.y < -30) wp.y += h + 60;
        if (wp.y > h + 30) wp.y -= h + 60;
      }

      ctx.clearRect(0, 0, w, h);
      drawWisps(ctx, w);
      for (const hd of dots) {
        const a = Math.atan2(hd.vy, hd.vx);
        const hx = hd.x + Math.cos(a) * hd.sz;
        const hy = hd.y + Math.sin(a) * hd.sz;
        const grad = ctx.createLinearGradient(hd.x, hd.y, hx, hy);
        grad.addColorStop(0, "rgba(200,210,220,0)");
        grad.addColorStop(0.4, `rgba(200,210,220,${(hd.op * 0.6).toFixed(2)})`);
        grad.addColorStop(1, `rgba(200,210,220,${hd.op.toFixed(2)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = hd.thick || 0.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hd.x, hd.y);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    },
  };
}

/**
 * Build the player for a scene, or `null` when there are no particles (`player: "none"`, i.e. no outcome).
 * `fair` and `windy` share the gold ray engine (`windy` layers wind-curls on top).
 */
export function createWeatherPlayer(scene: SceneSpec): WeatherPlayer | null {
  switch (scene.player) {
    case "snow":
      // The union guarantees stormMode / snowIntensity are present on snow scenes.
      return createSnowPlayer(scene.stormMode, scene.snowIntensity);
    case "sunRays":
      return createSunRaysPlayer();
    case "windyBreezy":
      return createWindyPlayer();
    case "haze":
      return createHazePlayer();
    case "none":
      return null;
    default: {
      // Exhaustiveness guard: a new `SceneSpec` variant makes this a compile error until it's handled.
      const _exhaustive: never = scene;
      return _exhaustive;
    }
  }
}
