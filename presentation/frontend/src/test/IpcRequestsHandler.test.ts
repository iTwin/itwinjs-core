/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IpcApp } from "@bentley/imodeljs-frontend";
import { presentationIpcChannel, RulesetVariable, VariableValueTypes } from "@bentley/presentation-common";
import { expect } from "chai";
import sinon from "sinon";
import { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler";

describe("IpcRequestsHandler", () => {
  let handler: IpcRequestsHandler;

  beforeEach(() => {
    handler = new IpcRequestsHandler("test-client-id");
  });

  describe("setRulesetVariable", () => {

    it("calls IpcApp.callIpcChannel with injected client id", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const rulesetId = "test-ruleset-id";
      const variable: RulesetVariable = { id: "var-id", type: VariableValueTypes.String, value: "test-value" };
      await handler.setRulesetVariable({ rulesetId, variable });
      expect(callChannelStub).to.be.calledOnceWith(presentationIpcChannel, "setRulesetVariable", {
        clientId: "test-client-id",
        rulesetId,
        variable,
      });
    });

  });

});
