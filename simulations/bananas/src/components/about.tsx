/**
 * Bananas sim About-panel content. Rendered as the `infoModalContent` prop of the
 * shared `<SimulationFrame>` — appears in the draggable About side panel when the
 * user clicks the About button in the title bar.
 *
 * Copy ported verbatim from ~/Documents/webdev/demos (Bananas demo, the
 * aboutContent.bananas block). All four sections from the demo are included:
 * Overview, About the Genetics, How It Works, Keep in Mind. The Keep-in-Mind
 * section references features (offspring grid markers, dual markers,
 * irreversible fungus) that don't yet exist in this scaffolded shell — that's
 * an intentional forward-reference to the final design; the underlying features
 * land in follow-up stories.
 */
export function AboutContent() {
  return (
    <>
      <p>
        Cross wild banana plants with Cavendish banana plants, then observe what happens when a
        fungus is introduced.
      </p>

      <h3>Overview</h3>
      <p>
        Cavendish bananas are vulnerable to a fungus called Fusarium Tropical Race 4. In this
        simulation, you select parent banana plants, cross them to produce offspring, and then
        introduce the fungus to find out which offspring are resistant and which are not.
      </p>

      <h3>About the Genetics</h3>
      <p>
        The simulation uses one gene with two alleles: R (resistant to the fungus, dominant) and r
        (not resistant to the fungus, recessive). Offspring inherit one allele from each parent,
        producing expected Mendelian ratios with natural variation.
      </p>

      <h3>How It Works</h3>
      <p>Follow the guided investigation across up to ten independent trials (A–J):</p>
      <ol>
        <li>
          <strong>Select parents:</strong> Choose two parent banana plants from the dropdown menus.
          Parent selections are locked once the first cross is made. Reset the trial to choose
          different parents.
        </li>
        <li>
          <strong>Cross plants:</strong> Each cross produces 5–20 offspring. A maximum of 10 crosses
          are allowed per trial.
        </li>
        <li>
          <strong>Introduce fungus:</strong> Fungus can be introduced at any time, even before the
          first cross. Plants that are not resistant will wilt and turn brown.
        </li>
        <li>
          <strong>Continue crossing:</strong> Keep crossing after the fungus is introduced to
          observe how resistance changes across crosses.
        </li>
        <li>
          <strong>Analyze data:</strong> Use the Data panel to compare healthy and infected plants
          across crosses.
        </li>
      </ol>

      <h3>Keep in Mind</h3>
      <ul>
        <li>
          <strong>Irreversible fungus:</strong> Once introduced, the fungus cannot be removed within
          a trial — just like in real life.
        </li>
        <li>
          <strong>Cross rows:</strong> Offspring are organized by cross (C1, C2, C3…) in the grid,
          making it easy to compare with the data charts.
        </li>
        <li>
          <strong>Dual markers:</strong> Notice that a blue dashed line appears in both the
          offspring grid and the bar chart at the cross when fungus is introduced.
        </li>
      </ul>
    </>
  );
}
