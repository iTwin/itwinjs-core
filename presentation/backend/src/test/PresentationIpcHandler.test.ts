/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as moq from "typemoq";
import { CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import { Id64sRulesetVariableJSON, StringRulesetVariable, VariableValueTypes } from "@itwin/presentation-common";
import { Presentation } from "../presentation-backend/Presentation.js";
import { PresentationIpcHandler } from "../presentation-backend/PresentationIpcHandler.js";
import { PresentationManager } from "../presentation-backend/PresentationManager.js";
import { RulesetVariablesManager } from "../presentation-backend/RulesetVariablesManager.js";

describe("PresentationIpcHandler", () => {
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();

  beforeEach(() => {
    presentationManagerMock.reset();
    sinon.stub(Presentation, "getManager").returns(presentationManagerMock.object);
  });

  describe("setRulesetVariable", () => {
    const testRulesetId = "test-ruleset-id";
    const variablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();

    beforeEach(() => {
      presentationManagerMock.setup((x) => x.vars(testRulesetId)).returns(() => variablesManagerMock.object);
    });

    it("sets ruleset variable", async () => {
      const testVariable: StringRulesetVariable = { id: "var-id", type: VariableValueTypes.String, value: "test-val" };
      variablesManagerMock.setup((x) => x.setValue(testVariable.id, testVariable.type, testVariable.value)).verifiable(moq.Times.once());

      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.setRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      });
      variablesManagerMock.verifyAll();
    });

    it("decompresses ids set before setting value variables", async () => {
      const ids = OrderedId64Iterable.sortArray(["0x123", "0x456"]);
      const testVariable: Id64sRulesetVariableJSON = {
        type: VariableValueTypes.Id64Array,
        id: "test",
        value: CompressedId64Set.compressIds(ids),
      };

      variablesManagerMock.setup((x) => x.setValue(testVariable.id, testVariable.type, ids)).verifiable(moq.Times.once());
      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.setRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      });
      variablesManagerMock.verifyAll();
    });
  });

  describe("unsetRulesetVariable", () => {
    const testRulesetId = "test-ruleset-id";
    const variablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();

    beforeEach(() => {
      presentationManagerMock.setup((x) => x.vars(testRulesetId)).returns(() => variablesManagerMock.object);
    });

    it("unsets ruleset variable", async () => {
      variablesManagerMock.setup((x) => x.unset("test-id")).verifiable(moq.Times.once());

      const ipcHandler = new PresentationIpcHandler();
      await ipcHandler.unsetRulesetVariable({
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variableId: "test-id",
      });
      variablesManagerMock.verifyAll();
    });
  });
});
