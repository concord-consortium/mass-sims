import { Button } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import CompareIcon from "../../assets/compare-icon.svg?react";
import { useCompareActions } from "../../hooks/use-compare-actions";

/**
 * Opens the Compare Trials view. It only opens: while the view is open, this button is inside the
 * inert Simulation panel, so the view's close button and Escape are the ways to close it. The hook
 * logs and announces, so the button has no `action`.
 */
export const CompareButton = observer(function CompareButton() {
  const { openCompare } = useCompareActions();
  return (
    <Button className="collapse-control-button collapse-compare-button" onPress={openCompare}>
      <CompareIcon className="collapse-control-icon" aria-hidden="true" />
      Compare Trials
    </Button>
  );
});
