/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { renderHook } from "@testing-library/react-hooks";
import * as moq from "typemoq";
import { PresentationManager, Presentation, RulesetManager } from "@bentley/presentation-frontend";
import { Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises"; // tslint:disable-line: no-direct-imports
import { useRulesetRegistration } from "../../presentation-components/hooks/UseRulesetRegistration";

describe("useRulesetRegistration", () => {
  interface HookProps {
    ruleset: Ruleset;
  }
  const initialProps: HookProps = {
    ruleset: { id: "test-ruleset", rules: [] },
  };

  let presentationManagerMock: moq.IMock<PresentationManager>;
  let rulesetManagerMock: moq.IMock<RulesetManager>;

  beforeEach(() => {
    presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    Presentation.presentation = presentationManagerMock.object;
    rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  it("registers and un-registers ruleset", async () => {
    const registeredRulesetPromise = new ResolvablePromise<RegisteredRuleset>();
    rulesetManagerMock.setup((x) => x.add(initialProps.ruleset)).returns(async () => registeredRulesetPromise);
    const { unmount } = renderHook(
      (props: HookProps) => useRulesetRegistration(props.ruleset),
      { initialProps },
    );

    const registered = new RegisteredRuleset(initialProps.ruleset, "testId", (r) => Presentation.presentation.rulesets().remove(r));
    await registeredRulesetPromise.resolve(registered);

    rulesetManagerMock.verify((x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify((x) => x.remove(moq.It.isAny()), moq.Times.never());

    unmount();
    rulesetManagerMock.verify((x) => x.remove(registered), moq.Times.once());
  });

  it("unregisters ruleset if registration happens after unmount", async () => {
    const registeredRulesetPromise = new ResolvablePromise<RegisteredRuleset>();
    rulesetManagerMock.setup((x) => x.add(initialProps.ruleset)).returns(async () => registeredRulesetPromise);
    const { unmount } = renderHook(
      (props: HookProps) => useRulesetRegistration(props.ruleset),
      { initialProps },
    );

    const registered = new RegisteredRuleset(initialProps.ruleset, "testId", (r) => Presentation.presentation.rulesets().remove(r));
    unmount();

    rulesetManagerMock.verify((x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify((x) => x.remove(moq.It.isAny()), moq.Times.never());

    await registeredRulesetPromise.resolve(registered);

    rulesetManagerMock.verify((x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify((x) => x.remove(registered), moq.Times.once());
  });

});
