/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { RegisteredRuleset, Ruleset } from "@bentley/presentation-common";
import { ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { Presentation, PresentationManager, RulesetManager } from "@bentley/presentation-frontend";
import { renderHook } from "@testing-library/react-hooks";
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
    Presentation.setPresentationManager(presentationManagerMock.object);
    rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  it("registers and un-registers ruleset", async () => {
    const registeredRulesetPromise = new ResolvablePromise<RegisteredRuleset>();
    rulesetManagerMock.setup(async (x) => x.add(initialProps.ruleset)).returns(async () => registeredRulesetPromise);
    const { unmount } = renderHook(
      (props: HookProps) => useRulesetRegistration(props.ruleset),
      { initialProps },
    );

    const registered = new RegisteredRuleset(initialProps.ruleset, "testId", async (r) => Presentation.presentation.rulesets().remove(r));
    await registeredRulesetPromise.resolve(registered);

    rulesetManagerMock.verify(async (x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify(async (x) => x.remove(moq.It.isAny()), moq.Times.never());

    unmount();
    rulesetManagerMock.verify(async (x) => x.remove(registered), moq.Times.once());
  });

  it("unregisters ruleset if registration happens after unmount", async () => {
    const registeredRulesetPromise = new ResolvablePromise<RegisteredRuleset>();
    rulesetManagerMock.setup(async (x) => x.add(initialProps.ruleset)).returns(async () => registeredRulesetPromise);
    const { unmount } = renderHook(
      (props: HookProps) => useRulesetRegistration(props.ruleset),
      { initialProps },
    );

    const registered = new RegisteredRuleset(initialProps.ruleset, "testId", async (r) => Presentation.presentation.rulesets().remove(r));
    unmount();

    rulesetManagerMock.verify(async (x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify(async (x) => x.remove(moq.It.isAny()), moq.Times.never());

    await registeredRulesetPromise.resolve(registered);

    rulesetManagerMock.verify(async (x) => x.add(initialProps.ruleset), moq.Times.once());
    rulesetManagerMock.verify(async (x) => x.remove(registered), moq.Times.once());
  });

});
