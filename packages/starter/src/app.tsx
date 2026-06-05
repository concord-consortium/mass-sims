import { SimulationFrame } from "@concord-consortium/mass-sims-shared";
import "./app.scss";

/**
 * Starter simulation — a random-walk model used as the template for new sims. The shell
 * composes <SimulationFrame> with placeholder slot content; later tasks fill in the real
 * trial list (Task 6), simulation view (Task 5), and data panel (Task 7).
 *
 * See docs/phase-2b-starter-sim-plan.md for the full structure.
 */
export function App() {
  return (
    <SimulationFrame
      simTitle="Random Walk"
      tagline="An interactive starter simulation"
      infoModalContent={
        <p>
          This is the Mass Sims starter simulation — a small random-walk model that serves as the
          template for new sims. Adjust the parameters, run trials, and observe how the population
          disperses over time.
        </p>
      }
    >
      <SimulationFrame.Trials>{/* Task 6 wires real TrialCards here. */}</SimulationFrame.Trials>
      <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
        {/* Task 5 wires the canvas-based view here. */}
        <div className="placeholder">Simulation view (Task 5)</div>
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>{/* Task 7 wires the DataSubsections here. */}</SimulationFrame.Data>
    </SimulationFrame>
  );
}
