/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IpcApp } from "@itwin/core-frontend";
import { NodeKey, PRESENTATION_IPC_CHANNEL_NAME, RulesetVariable, VariableValueTypes } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";
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
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "setRulesetVariable", {
        clientId: "test-client-id",
        rulesetId,
        variable,
      });
    });
  });

  describe("unsetRulesetVariable", () => {
    it("calls IpcApp.callIpcChannel with injected client id", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const rulesetId = "test-ruleset-id";
      await handler.unsetRulesetVariable({ rulesetId, variableId: "test-id" });
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "unsetRulesetVariable", {
        clientId: "test-client-id",
        rulesetId,
        variableId: "test-id",
      });
    });
  });

  describe("updateHierarchyState", () => {
    it("calls IpcApp.callIpcChannel with injected client id", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const rulesetId = "ruleset-id";
      const nodeKeys = [createRandomECInstancesNodeKey()];
      await handler.updateHierarchyState({ imodelKey: "imodel-key", rulesetId, changeType: "nodesExpanded", nodeKeys });
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "updateHierarchyState", {
        clientId: "test-client-id",
        imodelKey: "imodel-key",
        rulesetId,
        changeType: "nodesExpanded",
        nodeKeys: nodeKeys.map(NodeKey.toJSON),
      });
    });
  });
});
