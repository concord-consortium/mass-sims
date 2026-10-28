import { Button } from "@concord-consortium/mass-sims-shared";
import SampleIcon from "../../assets/sample-icon.svg?react";
import { useSampleActions } from "../../hooks/use-sample-actions";
import "./sample-button.scss";

/**
 * Takes a sample of the selected trial at the timeline's year. Never disabled: there is always a
 * selected trial and a timeline value. The hook logs and announces, so the button has no `action`.
 */
export function SampleButton() {
  const { takeSample } = useSampleActions();
  return (
    <Button className="collapse-sample-button" onPress={takeSample}>
      <SampleIcon className="collapse-sample-icon" aria-hidden="true" />
      Sample
    </Button>
  );
}
