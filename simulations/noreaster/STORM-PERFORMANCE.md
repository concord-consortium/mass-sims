# Storm cloud performance

This file records how fast the map-area storm cloud draws, a decision made in MAS-50, and the options
to try if the cloud turns out to be too slow on real devices.

Code: [storm-players.ts](src/animation/storm-players.ts) (the particle systems),
[use-storm-animation.ts](src/hooks/use-storm-animation.ts) (canvas and cache),
[use-storm-run.ts](src/hooks/use-storm-run.ts) (the run clock).
Measurement tool: [storm-perf-probe.ts](../../playwright/diagnostics/storm-perf-probe.ts).

## The MAS-50 decision

Before MAS-50, the live animation ran one physics step per browser frame, and each step spawns new
particles. So the cloud depended on the frame rate. A slow device drew a thinner cloud, a 120 Hz
screen drew a denser one, and the restored cloud did not match the one the run ended on.

MAS-50 made the physics run fixed steps: 60 per second of cloud time (`STEPS_PER_S`), on every device.
A frame runs all the steps that are due by the run clock. Every run of an outcome now ends on the same
cloud, at the density the design approved.

The cost: a slow device now does more work per frame than before. Before, it ran one step per frame and
drew a thinner cloud. Now it runs every step (up to about 6 per frame, because the runner limits one
frame's clock advance to 100 ms) and draws the full cloud. **We accepted this cost**, because the
same cloud on every device is the goal of MAS-50. A screen at 60 Hz does the same work as before. A
120 Hz screen does less.

This needs a check on real devices (Chromebook, iPad). CPU throttling in Chrome is only an estimate.
If the cloud is too slow there, use the options below.

## Measurements (MAS-50)

Production build, DPR 2, Chrome CPU throttle. "Late p95" is the p95 frame time over the last 2 s of
the cloud by the run clock, as a median of 5 runs. The numbers are the time between frames, in ms.

| Width | Outcome | Throttle | Late p95 before | Late p95 after |
|---|---|---|---|---|
| 1044 | strong | 4× | 66.6 | 101.4 |
| 1044 | moderate | 4× | 51.4 | 74.7 |
| 1044 | weakCoastal | 4× | 43.3 | 58.0 |
| 1044 | humidNoStorm | 4× | 50.0 | 51.9 |
| 1044 | strong | 6× | 83.2 | 158.9 |
| 1044 | moderate | 6× | 70.7 | 101.5 |
| 1044 | weakCoastal | 6× | 59.1 | 90.6 |
| 1044 | humidNoStorm | 6× | 67.3 | 83.4 |
| 767 | strong | 4× | 59.8 | 100.7 |
| 767 | moderate | 4× | 50.4 | 73.7 |
| 767 | weakCoastal | 4× | 43.4 | 58.2 |
| 767 | humidNoStorm | 4× | 48.5 | 58.0 |
| 767 | strong | 6× | 76.3 | 165.3 |
| 767 | moderate | 6× | 67.9 | 101.6 |
| 767 | weakCoastal | 6× | 60.0 | 85.3 |
| 767 | humidNoStorm | 6× | 67.0 | 83.6 |

"Before" ran fewer physics steps on a throttled machine, so it drew fewer particles than the approved
design. For example, a `strong` run at 4× got about 36 frames (36 steps) in its last 2 s. After the
change, it runs all 120 steps. So "before" is not a fair target: part of its speed came from drawing
the wrong cloud.

`renderFinal` (the full re-run used for a cold load of a saved run and for reduced motion) did not
change: `strong` has a max of about 61 ms unthrottled. The probe fails if it goes over 76 ms. After a
live run, switching back to a trial no longer calls `renderFinal`; it copies the cached last frame.

## If the cloud is too slow: options

Measure first. Use a performance profile on the slow device to find which part costs the most: the
physics steps, building the particles on the offscreen canvas, or the two blur passes in
`composite()`. Then pick from the options for that part.

### A. Same cloud, less work

These keep the look the same. The unit test "ends on exactly the renderFinal state at any frame rate"
in `storm-players.test.ts` must still pass, and the e2e test `noreaster-storm.test.ts` checks the
pixels in a browser.

- **Do not draw invisible particles.** In the spiral's `draw()`, a particle's alpha is
  `c.op * fade * edgeFade * centerFade`. New particles spawn at the edge of the circle, where
  `edgeFade` is near 0, and particles near the center have `centerFade` near 0. If the alpha rounds to
  `0.000` (the `toFixed(3)` the code already uses), skip the `arc` and `fill`. The pixels do not change.
  Do the same check in the band and haze `draw()`.
- **Build fewer color strings.** Each particle builds an `rgba(...)` string on every frame. A cache keyed
  by tone and rounded alpha gives the same strings with less work.
- **Make the physics step cheaper.** `omega()` calls `Math.pow` for each spiral particle on each step.
  Any change here must give exactly the same numbers, or the formations change (see B). Look for work
  that can be moved out of the loop without changing the result.
- **Move `renderFinal` off the critical path.** Run it in `requestIdleCallback`, or warm the cache while
  a run is in progress. This helps cold loads and reduced motion only, not the live animation.

### B. A small change to the look (needs design approval)

These change the formations a little. Every device still shows the same cloud, because the live
animation and `renderFinal` share the same steps. Compare the result with the approved prototype, and
get design approval.

- **Fewer, larger steps.** Lower `STEPS_PER_S` (for example to 30) and spawn twice as many particles per
  step, so the density stays about the same. This halves the physics work. The particle count, and so
  the drawing cost, stays the same.
- **Approximate `omega()`.** For example, use a lookup table instead of `Math.pow`. The rotation changes
  very slightly.
- **Retire spiral particles sooner.** Spiral particles almost never retire during a run (`NOR_LIFE` is
  30 s, and the longest run is 10 s), so the array only grows (an estimated 22,000 particles at the end
  of `strong`). Removing particles that can no longer be seen would cut both physics and drawing.

### C. A clear change to the look on slow devices (a design decision)

These were the MAS-40 options. Each one makes a slow device show a different cloud from a fast device.
That goes against the MAS-50 goal, so choose them only with design.

- **Lower the density** (spawn count, or a particle cap) per outcome. `strong` costs the most because it
  has the most particles.
- **Make the shadow blur smaller.** `weakCoastal` and `humidNoStorm` cost more in the blur than in
  their particles.
- **A lower resolution on slow devices.** Choose `NOR_SCALE` 1 instead of 2 when a device is slow. Pick
  it once, before the run starts, and keep it for the whole session, so a device always shows the
  same cloud.

### D. Spread the catch-up over more frames

Limit the physics steps per frame (for example, 2). On a slow device, the cloud then falls behind the
clock, and the frame where the cloud ends must run all the remaining steps at once. The final cloud is
still the same, but the cost moves to one large frame at the end instead of going away. Use this only
together with other options.
