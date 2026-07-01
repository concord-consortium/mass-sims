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
          <strong>Cross plants:</strong> Each cross produces 5–20 offspring. A maximum of 6 crosses
          are allowed per trial. Offspring are organized by cross (A1, A2, A3…) in the grid, making
          it easy to compare with the data charts.
        </li>
        <li>
          <strong>Introduce fungus:</strong> Toggle the Fungus switch on before crossing. Once the
          first cross is made, the fungus setting is locked for the rest of the trial. Plants that
          are not resistant will wilt and turn brown.
        </li>
        <li>
          <strong>Continue crossing:</strong> Keep crossing to observe how resistance appears across
          crosses.
        </li>
        <li>
          <strong>Analyze data:</strong> Use the Data panel to compare healthy and infected plants
          across crosses.
        </li>
      </ol>
    </>
  );
}
