/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeDuration, using } from "@itwin/core-bentley";
import { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import { ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation, RulesetManager } from "@itwin/presentation-frontend";
import { RulesetRegistrationHelper } from "../../presentation-components/common/RulesetRegistrationHelper";
import { mockPresentationManager } from "../_helpers/UiComponents";

describe("RulesetRegistrationHelper", () => {

  let rulesetsManagerMock: moq.IMock<RulesetManager>;

  beforeEach(() => {
    const mocks = mockPresentationManager();
    rulesetsManagerMock = mocks.rulesetsManager;
    Presentation.setPresentationManager(mocks.presentationManager.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  const createRuleset = (id?: string): Ruleset => ({
    id: id ?? "Test",
    rules: [],
  });

  it("does nothing when helper is created with ruleset id", () => {
    const rulesetId = "test";
    using(new RulesetRegistrationHelper(rulesetId), (registration) => {
      expect(registration.rulesetId).to.eq(rulesetId);
      rulesetsManagerMock.verify(async (x) => x.add(moq.It.isAny()), moq.Times.never());
    });
  });

  it("registers ruleset when helper is created with ruleset object", async () => {
    const ruleset = createRuleset();
    const disposeSpy = sinon.spy();
    rulesetsManagerMock.setup(async (x) => x.add(ruleset)).returns(async () => new RegisteredRuleset(ruleset, "test-hash", disposeSpy)).verifiable();
    await using(new RulesetRegistrationHelper(ruleset), async (registration) => {
      await BeDuration.wait(0); // handle the floating promise
      expect(registration.rulesetId).to.eq(ruleset.id);
      rulesetsManagerMock.verifyAll();
    });
    expect(disposeSpy).to.be.calledOnce;
  });

  it("registers ruleset when helper is created with RegisteredRuleset object", async () => {
    const disposeSpy = sinon.spy();
    const ruleset = new RegisteredRuleset(createRuleset(), "test-hash-1", disposeSpy);
    rulesetsManagerMock.setup(async (x) => x.add(ruleset.toJSON())).returns(async () => new RegisteredRuleset(ruleset, "test-hash-2", disposeSpy)).verifiable();
    await using(new RulesetRegistrationHelper(ruleset), async (registration) => {
      await BeDuration.wait(0); // handle the floating promise
      expect(registration.rulesetId).to.eq(ruleset.id);
      rulesetsManagerMock.verifyAll();
    });
    expect(disposeSpy).to.be.calledOnce;
  });

  it("disposes ruleset immediately after registration if helper was disposed while registering", async () => {
    const ruleset = createRuleset();
    const disposeSpy = sinon.spy();
    const result = new ResolvablePromise<RegisteredRuleset>();
    rulesetsManagerMock.setup(async (x) => x.add(ruleset)).returns(async () => result).verifiable();
    using(new RulesetRegistrationHelper(ruleset), (registration) => {
      expect(registration.rulesetId).to.eq(ruleset.id);
      rulesetsManagerMock.verifyAll();
    });
    expect(disposeSpy).to.not.be.called;
    await result.resolve(new RegisteredRuleset(ruleset, "test-hash", disposeSpy));
    expect(disposeSpy).to.be.calledOnce;
  });

});
