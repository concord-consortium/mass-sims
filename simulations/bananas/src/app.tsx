import { SimulationFrame } from "@concord-consortium/mass-sims-shared";
import { AboutContent } from "./components/about";
import "./app.scss";

/**
 * Bananas — an interactive genetics simulation.
 *
 * This file currently renders just the shared three-panel shell. The genetics model,
 * parent-selection UI, cross button, offspring grid, healthy/infected bar chart, and
 * AP saved-state wiring all land in follow-up stories. See `docs/plans/MAS-8-plan.md`
 * for the first-step scope (shell + title + tagline + About panel + theme).
 */
export function App() {
  return (
    <SimulationFrame
      simTitle="Bananas"
      tagline="An interactive genetics simulation"
      infoModalContent={<AboutContent />}
    >
      <SimulationFrame.Trials />
      <SimulationFrame.Simulation instruction="Select two parents to begin" />
      <SimulationFrame.Data />
    </SimulationFrame>
  );
}
