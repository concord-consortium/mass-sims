import { Button, useModelState, useSimulationRunner } from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { finalizeTrial, initialTransient, stepWalkers } from "../model/random-walk";
import type { RecordedTrial, SimInput, SimOutput, SimTransient } from "../model/types";
import "./simulation-view.scss";

// 240px leaves room for the controls + buttons + readout inside the fixed-height, non-scrolling
// Simulation slot (562px frame). Width fills the column responsively (see canvasWidth below).
const CANVAS_HEIGHT = 240;
const WALKER_DOT_RADIUS = 2;
const INITIAL_OUTPUT: SimOutput = { avgDistance: 0, stdDevDistance: 0, avgDistanceSeries: [] };

export interface SimulationViewProps {
  /**
   * The selected trial — the single source of truth for this run's parameters and (once run)
   * its result. The parent re-keys this component per trial + completion state, so the live
   * model state below re-initializes from `trial` on every select / reset / completion.
   */
  trial: RecordedTrial;
  /** The selected trial's letter (A, B, …). */
  trialLabel: string;
  /** Persist a parameter edit up to the trial (so it survives selecting away and back). */
  onInputChange: (input: SimInput) => void;
  /** Record the finished run into the selected trial (output + final-frame snapshot). */
  onComplete: (output: SimOutput, finalTransient: SimTransient) => void;
  /** Clear the selected trial back to empty so it can be re-run (same seed → reproducible). */
  onReset: () => void;
  /**
   * Fires whenever a new avg-distance sample lands during a run — i.e. every `SAMPLE_EVERY`
   * frames (10 by default). Lets the App lift the in-progress series out of this component
   * (which encapsulates per-frame transient state) so the Data panel can render a live chart.
   * No-ops outside of a run; not fired on the per-frame walker updates.
   */
  onProgress?: (series: readonly number[]) => void;
}

export function SimulationView({
  trial,
  trialLabel,
  onInputChange,
  onComplete,
  onReset,
  onProgress,
}: SimulationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Backing-store width tracks the canvas's laid-out width so the drawing fills the column
  // without stretching. Measured via ResizeObserver (guarded — jsdom lacks it in tests).
  const [canvasWidth, setCanvasWidth] = useState(0);
  // Live model state for the active run, seeded from the selected trial. A completed trial
  // restores its final-frame snapshot (so its dots show); an empty trial starts at frame 0.
  const { input, output, transient, setInput, setOutput, setTransient } = useModelState<
    SimInput,
    SimOutput,
    SimTransient
  >({
    initialInput: trial.input,
    initialOutput: trial.output ?? INITIAL_OUTPUT,
    initialTransient: trial.finalTransient ?? initialTransient(trial.input),
  });

  // A trial is complete once it has run its full frame count. Derived (not stored) so a
  // restored trial — whose snapshot is at the final frame — reads as complete too.
  const isComplete = input.framesPerTrial > 0 && transient.frame >= input.framesPerTrial;
  // Lock the parameter controls once a run has started or finished.
  const inputsLocked = transient.frame > 0;

  const onStep = useCallback(
    (_deltaMs: number) => {
      if (transient.frame >= input.framesPerTrial) return;

      const next = stepWalkers(transient, input);
      setTransient(next);
      // A new series sample lands every SAMPLE_EVERY (10) frames; only fire onProgress on
      // those frames so the Data panel re-renders at ~6 Hz (at 60 fps), not on every frame.
      if (next.avgDistanceSeries.length > transient.avgDistanceSeries.length) {
        onProgress?.(next.avgDistanceSeries);
      }
      if (next.frame >= input.framesPerTrial) {
        const finalOutput = finalizeTrial(next);
        setOutput(finalOutput);
        onComplete(finalOutput, next);
      }
    },
    [transient, input, setTransient, setOutput, onComplete, onProgress],
  );

  const { isPlaying, play, pause, step } = useSimulationRunner({ onStep });

  // Pause the runner the moment the trial completes so it doesn't loop into the next frame.
  useEffect(() => {
    if (isComplete && isPlaying) pause();
  }, [isComplete, isPlaying, pause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Draw the walkers onto the canvas.
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

  const updateInput = (patch: Partial<SimInput>) => {
    const next = { ...input, ...patch };
    setInput(next);
    onInputChange(next);
  };

  return (
    <div className="simulation-view">
      <span className="trial-badge" aria-hidden="true">
        {trialLabel}
      </span>
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
            disabled={inputsLocked}
            onChange={(e) => updateInput({ walkerCount: Number(e.target.value) })}
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
            disabled={inputsLocked}
            onChange={(e) => updateInput({ stepSize: Number(e.target.value) })}
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
            disabled={inputsLocked}
            onChange={(e) => updateInput({ framesPerTrial: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="buttons">
        <Button
          action={isPlaying ? "pause_pressed" : "play_pressed"}
          actionParams={{ trial: trialLabel }}
          onPress={() => (isPlaying ? pause() : play())}
          isDisabled={isComplete}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          action="step_pressed"
          actionParams={{ trial: trialLabel }}
          onPress={() => step()}
          isDisabled={isComplete}
        >
          Step
        </Button>
        <Button
          action="reset_pressed"
          actionParams={{ trial: trialLabel }}
          onPress={onReset}
          isDisabled={transient.frame === 0}
        >
          Reset
        </Button>
      </div>
      <div className="readout">
        Frame {transient.frame} / {input.framesPerTrial} · avg distance{" "}
        {output.avgDistance.toFixed(2)}
      </div>
    </div>
  );
}
