/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as moq from "typemoq";
import { CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import {
  Id64sRulesetVariableJSON,
  RulesetVariableJSON,
  SetRulesetVariableParams,
  StringRulesetVariable,
  UnsetRulesetVariableParams,
  VariableValueTypes,
} from "@itwin/presentation-common";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "../presentation-backend/Presentation";
import { PresentationIpcHandler } from "../presentation-backend/PresentationIpcHandler";
import { PresentationManager } from "../presentation-backend/PresentationManager";
import { RulesetVariablesManager } from "../presentation-backend/RulesetVariablesManager";

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
      const params: SetRulesetVariableParams<RulesetVariableJSON> = {
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      };
      await ipcHandler.setRulesetVariable(params);
      variablesManagerMock.verifyAll();
    });

    it("decompresses ids set before setting value variables", async () => {
      const ids = OrderedId64Iterable.sortArray([createRandomId(), createRandomId()]);
      const testVariable: Id64sRulesetVariableJSON = {
        type: VariableValueTypes.Id64Array,
        id: "test",
        value: CompressedId64Set.compressIds(ids),
      };

      variablesManagerMock.setup((x) => x.setValue(testVariable.id, testVariable.type, ids)).verifiable(moq.Times.once());
      const ipcHandler = new PresentationIpcHandler();
      const params: SetRulesetVariableParams<RulesetVariableJSON> = {
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variable: testVariable,
      };
      await ipcHandler.setRulesetVariable(params);
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
      const params: UnsetRulesetVariableParams = {
        clientId: "test-client-id",
        rulesetId: testRulesetId,
        variableId: "test-id",
      };
      await ipcHandler.unsetRulesetVariable(params);
      variablesManagerMock.verifyAll();
    });
  });
});
