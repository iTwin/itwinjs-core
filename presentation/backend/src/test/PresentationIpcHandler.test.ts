/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import { Id64sRulesetVariableJSON, StringRulesetVariable, VariableValueTypes } from "@itwin/presentation-common";
import { Presentation } from "../presentation-backend/Presentation.js";
import { PresentationIpcHandler } from "../presentation-backend/PresentationIpcHandler.js";
import { PresentationManager } from "../presentation-backend/PresentationManager.js";

describe("PresentationIpcHandler", () => {
  let presentationManagerMock: ReturnType<typeof stubPresentationManager>;

  beforeEach(() => {
    presentationManagerMock = stubPresentationManager();
    sinon.stub(Presentation, "getManager").returns(presentationManagerMock as unknown as PresentationManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("setRulesetVariable", () => {
    const testRulesetId = "test-ruleset-id";
    let variablesManagerMock: ReturnType<typeof stubRulesetVariablesManager>;

    beforeEach(() => {
      variablesManagerMock = stubRulesetVariablesManager();
      presentationManagerMock.vars.withArgs(testRulesetId).returns(variablesManagerMock);
    });

    it("sets ruleset variable", async () => {
      const testVariable: StringRulesetVariable = { id: "var-id", type: VariableValueTypes.String, value: "test-val" };

      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.setRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      });
      expect(variablesManagerMock.setValue).to.be.calledOnceWithExactly(testVariable.id, testVariable.type, testVariable.value);
    });

    it("decompresses ids set before setting value variables", async () => {
      const ids = OrderedId64Iterable.sortArray(["0x123", "0x456"]);
      const testVariable: Id64sRulesetVariableJSON = {
        type: VariableValueTypes.Id64Array,
        id: "test",
        value: CompressedId64Set.compressIds(ids),
      };

      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.setRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      });
      expect(variablesManagerMock.setValue).to.be.calledOnceWithExactly(testVariable.id, testVariable.type, ids);
    });
  });

  describe("unsetRulesetVariable", () => {
    const testRulesetId = "test-ruleset-id";
    let variablesManagerMock: ReturnType<typeof stubRulesetVariablesManager>;

    beforeEach(() => {
      variablesManagerMock = stubRulesetVariablesManager();
      presentationManagerMock.vars.withArgs(testRulesetId).returns(variablesManagerMock);
    });

    it("unsets ruleset variable", async () => {
      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.unsetRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variableId: "test-id",
      });
      expect(variablesManagerMock.unset).to.be.calledOnceWithExactly("test-id");
    });
  });
});

function stubPresentationManager() {
  return {
    vars: sinon.stub(),
  };
}

function stubRulesetVariablesManager() {
  return {
    setValue: sinon.stub(),
    unset: sinon.stub(),
  };
}
