/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { renderHook } from "@testing-library/react-hooks";
import * as moq from "typemoq";
import { PresentationManager, Presentation, RulesetManager } from "@bentley/presentation-frontend";
import { Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises"; // tslint:disable-line: no-direct-imports
import { useRulesetRegistration } from "../../hooks/UseRulesetRegistration";

describe("useRulesetRegistration", () => {
  interface HookProps {
    ruleset: Ruleset;
  }
  const initialProps: HookProps = {
    ruleset: { id: "test-ruleset", rules: [] },
  };

  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();

  it("registers and un-registers ruleset", async () => {
    Presentation.presentation = presentationManagerMock.object;
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);

    const registeredRulesetPromise = new ResolvablePromise<RegisteredRuleset>();
    rulesetManagerMock.setup((x) => x.add(initialProps.ruleset)).returns(async () => registeredRulesetPromise);
    const { unmount } = renderHook(
      (props: HookProps) => useRulesetRegistration(props.ruleset),
      { initialProps },
    );

    const registered = new RegisteredRuleset(initialProps.ruleset, "testId", () => { });
    await registeredRulesetPromise.resolve(registered);

    rulesetManagerMock.verify((x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify((x) => x.remove(moq.It.isAny()), moq.Times.exactly(0));

    unmount();
    rulesetManagerMock.verify((x) => x.remove(registered), moq.Times.once());
  });

});
