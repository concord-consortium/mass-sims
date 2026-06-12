import { SimulationFrame } from "@concord-consortium/mass-sims-shared";
import { AboutContent } from "./components/about";
import "./app.scss";

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
