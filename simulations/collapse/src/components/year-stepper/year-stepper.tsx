import { Button, useAnnounce } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import ArrowLeftIcon from "../../assets/arrow-left-icon.svg?react";
import { useSetSampleYears } from "../../hooks/use-set-sample-years";
import { formatYears } from "../../model/timeline";
import { useStores } from "../../stores/root-store";
import "./year-stepper.scss";

/**
 * The digital display of the timeline value, with arrows that step through the same values.
 *
 * The number is `aria-hidden`: assistive tech already gets the value from the slider's
 * `aria-valuetext` and from the announcement after each arrow press. The arrows announce because
 * their names say what they do, not where they landed. The slider does not announce.
 */
export const YearStepper = observer(function YearStepper() {
  const { ui } = useStores();
  const { step } = useSetSampleYears();
  const announce = useAnnounce();

  const press = (dir: -1 | 1) => {
    step(dir, "stepper");
    announce(`${formatYears(ui.sampleYears)} years before collapse.`);
  };

  return (
    <div className="collapse-stepper-wrap">
      <div className="collapse-step-caption">
        Years before
        <br />
        collapse
      </div>
      <div className="collapse-stepper">
        <Button
          className="collapse-step-arrow"
          aria-label="Earlier, more years before collapse"
          isDisabled={!ui.canStepEarlier}
          onPress={() => press(-1)}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <div className="collapse-step-value" aria-hidden="true">
          {formatYears(ui.sampleYears)}
        </div>
        <Button
          className="collapse-step-arrow later"
          aria-label="Later, fewer years before collapse"
          isDisabled={!ui.canStepLater}
          onPress={() => press(1)}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
