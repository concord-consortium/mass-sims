import { Button } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { CONSUMING_TESTS, TESTS, type TestId } from "../model/tests";

import "./test-picker.scss";

export interface TestPickerProps {
  test: TestId;
  running: boolean;
  onTestChange: (test: TestId) => void;
}

/**
 * The four destructive tests, down the right side of the Test Lab. Choosing one swaps the
 * apparatus on the bench; nothing is spent until Run. Look, feel, smell is deliberately not
 * here — it is free, and sits with the lump instead.
 */
export function TestPicker({ test, running, onTestChange }: TestPickerProps) {
  return (
    <fieldset className="test-picker">
      <legend className="picker-label">Choose a Test</legend>
      {CONSUMING_TESTS.map((id) => (
        <Button
          key={id}
          className={clsx("test-button", { chosen: id === test })}
          aria-pressed={id === test}
          onPress={() => onTestChange(id)}
          isDisabled={running}
        >
          {TESTS[id].label}
        </Button>
      ))}
    </fieldset>
  );
}
