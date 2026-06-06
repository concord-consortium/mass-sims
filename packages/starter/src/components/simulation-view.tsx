import { useModelState, useSimulationRunner } from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { finalizeTrial, initialTransient, stepWalkers } from "../model/random-walk";
import type { SimInput, SimOutput, SimTransient } from "../model/types";
import "./simulation-view.scss";

// Canvas height is fixed; width tracks the Simulation column (full width). 250px keeps the
// controls + buttons + readout within the shared frame's fixed-height Simulation slot (562px
// frame → ~440px usable; the slot does not scroll).
const CANVAS_HEIGHT = 250;
const WALKER_DOT_RADIUS = 2;
const DEFAULT_INPUT: SimInput = {
  walkerCount: 50,
  stepSize: 1,
  framesPerTrial: 200,
  seed: "trial-A",
};
const INITIAL_OUTPUT: SimOutput = { avgDistance: 0, stdDevDistance: 0, avgDistanceSeries: [] };

// Option-C determinism support: the random-walk model is deterministic per seed (a given
// seed + frame always reproduces the same draws), so to keep trials varying we hand each new
// trial a fresh seed. The first trial uses DEFAULT_INPUT.seed; Reset (the new-trial boundary)
// swaps in a new one. Plain Math.random is fine — seeds are not security-sensitive.
function makeSeed(): string {
  return `trial-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SimulationViewProps {
  /** Called each time a trial completes (frame count reaches framesPerTrial). */
  onTrialComplete: (trial: { input: SimInput; output: SimOutput }) => void;
}

export function SimulationView({ onTrialComplete }: SimulationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Backing-store width tracks the canvas's laid-out width so the drawing fills the column
  // without stretching. Measured via ResizeObserver (guarded — jsdom lacks it in tests).
  const [canvasWidth, setCanvasWidth] = useState(0);
  const {
    input,
    output,
    transient,
    setInput,
    setOutput,
    setTransient,
    resetTransient,
    resetOutput,
  } = useModelState<SimInput, SimOutput, SimTransient>({
    initialInput: DEFAULT_INPUT,
    initialOutput: INITIAL_OUTPUT,
    initialTransient: initialTransient(DEFAULT_INPUT),
  });

  // Lock the controls once a trial is in progress (frame > 0 and not yet finalized).
  const trialInProgress = transient.frame > 0 && transient.frame < input.framesPerTrial;

  const onStep = useCallback(
    (_deltaMs: number) => {
      const next = stepWalkers(transient, input);
      setTransient(next);
      if (next.frame >= input.framesPerTrial) {
        const finalOutput = finalizeTrial(next);
        setOutput(finalOutput);
        onTrialComplete({ input, output: finalOutput });
        // Pause the runner — sim authors customize this in their own sims.
      }
    },
    [transient, input, setTransient, setOutput, onTrialComplete],
  );

  const { isPlaying, play, pause, step } = useSimulationRunner({ onStep });

  // Pause the runner on trial completion so it doesn't loop into the next frame.
  useEffect(() => {
    if (transient.frame >= input.framesPerTrial && isPlaying) {
      pause();
    }
  }, [transient.frame, input.framesPerTrial, isPlaying, pause]);

  // Track the canvas's laid-out width so its backing store matches (full column width).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Canvas drawing — runs whenever the walkers move or the canvas is resized.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.fillStyle = "#333";
    const centerX = canvasWidth / 2;
    const centerY = CANVAS_HEIGHT / 2;
    for (const walker of transient.walkers) {
      ctx.beginPath();
      ctx.arc(centerX + walker.x, centerY + walker.y, WALKER_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [transient.walkers, canvasWidth]);

  const resetTrial = () => {
    pause();
    resetTransient();
    resetOutput();
    // Hand the next trial a fresh seed so it varies from the one just run (Option C).
    setInput((p) => ({ ...p, seed: makeSeed() }));
    setTransient(initialTransient(input));
  };

  return (
    <div className="simulation-view">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={CANVAS_HEIGHT}
        aria-label="Random walk visualization"
      />
      <div className="controls">
        <label>
          Walker count
          <input
            type="range"
            min={1}
            max={500}
            value={input.walkerCount}
            disabled={trialInProgress}
            onChange={(e) => setInput((p) => ({ ...p, walkerCount: Number(e.target.value) }))}
          />
          <span>{input.walkerCount}</span>
        </label>
        <label>
          Step size
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={input.stepSize}
            disabled={trialInProgress}
            onChange={(e) => setInput((p) => ({ ...p, stepSize: Number(e.target.value) }))}
          />
          <span>{input.stepSize.toFixed(1)}</span>
        </label>
        <label>
          Frames per trial
          <input
            type="number"
            min={1}
            max={500}
            value={input.framesPerTrial}
            disabled={trialInProgress}
            onChange={(e) => setInput((p) => ({ ...p, framesPerTrial: Number(e.target.value) }))}
          />
        </label>
      </div>
      <div className="buttons">
        <button type="button" onClick={() => (isPlaying ? pause() : play())}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={step}>
          Step
        </button>
        <button type="button" onClick={resetTrial}>
          Reset
        </button>
      </div>
      <div className="readout">
        Frame {transient.frame} / {input.framesPerTrial} · avg distance{" "}
        {output.avgDistance.toFixed(2)}
      </div>
    </div>
  );
}
