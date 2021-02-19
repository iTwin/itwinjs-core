/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import * as sinon from "sinon";
import { RulesetVariableJSON, SetRulesetVariableParams, VariableValueTypes } from "@bentley/presentation-common";
import { PresentationIpcHandler } from "../presentation-backend/PresentationIpcHandler";
import { PresentationManager } from "../presentation-backend/PresentationManager";
import { RulesetVariablesManager } from "../presentation-backend/RulesetVariablesManager";
import { Presentation } from "../presentation-backend/Presentation";

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
      const testVariable = { id: "var-id", type: VariableValueTypes.String, value: "test-val" };
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

  });

});
