/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IpcApp } from "@itwin/core-frontend";
import { PRESENTATION_IPC_CHANNEL_NAME, RulesetVariable, VariableValueTypes } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";
import { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler";

describe("IpcRequestsHandler", () => {
  const clientId = "test-client-id";
  let handler: IpcRequestsHandler;

  beforeEach(() => {
    handler = new IpcRequestsHandler(clientId);
  });

  describe("setRulesetVariable", () => {
    it("calls IpcApp.callIpcChannel with injected client id", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const rulesetId = "test-ruleset-id";
      const variable: RulesetVariable = { id: "var-id", type: VariableValueTypes.String, value: "test-value" };
      await handler.setRulesetVariable({ rulesetId, variable });
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "setRulesetVariable", {
        clientId,
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
        clientId,
        rulesetId,
        variableId: "test-id",
      });
    });
  });

  describe("updateHierarchyState", () => {
    it("calls IpcApp.callIpcChannel with injected client id for specific node", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const imodelKey = "imodel-key";
      const rulesetId = "ruleset-id";
      const nodeKey = createRandomECInstancesNodeKey();
      await handler.updateHierarchyState({ imodelKey, rulesetId, stateChanges: [{ nodeKey, isExpanded: true, instanceFilters: ["xxx"] }] });
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "updateHierarchyState", {
        clientId,
        imodelKey,
        rulesetId,
        stateChanges: [{
          nodeKey,
          isExpanded: true,
          instanceFilters: ["xxx"],
        }],
      });
    });

    it("calls IpcApp.callIpcChannel with injected client id for root level", async () => {
      const callChannelStub = sinon.stub(IpcApp, "callIpcChannel");
      const imodelKey = "imodel-key";
      const rulesetId = "ruleset-id";
      await handler.updateHierarchyState({ imodelKey, rulesetId, stateChanges: [{ nodeKey: undefined, instanceFilters: ["yyy"] }] });
      expect(callChannelStub).to.be.calledOnceWith(PRESENTATION_IPC_CHANNEL_NAME, "updateHierarchyState", {
        clientId,
        imodelKey,
        rulesetId,
        stateChanges: [{
          nodeKey: undefined,
          instanceFilters: ["yyy"],
        }],
      });
    });
  });
});
