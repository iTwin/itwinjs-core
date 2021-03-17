/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodeKey } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstancesNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler";
import { NodeIdentifier, StateTracker } from "../presentation-frontend/StateTracker";

describe("StateTracker", () => {
  let tracker: StateTracker;
  const ipcHandlerMock = moq.Mock.ofType<IpcRequestsHandler>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const testRulesetId = "ruleset-id";
  const testSourceId = "source-id";

  function createNodeIdentifier(id: string, key: NodeKey) {
    return { id, key };
  }

  async function expandNodes(nodes: NodeIdentifier[], sourceId?: string) {
    await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, sourceId ?? testSourceId, nodes);
    ipcHandlerMock.reset();
  }

  beforeEach(() => {
    ipcHandlerMock.reset();
    imodelMock.reset();
    imodelMock.setup((x) => x.key).returns(() => "imodel-key");
    tracker = new StateTracker(ipcHandlerMock.object);
  });

  describe("onNodeonExpandedNodesChangedsChanged", () => {
    it("does not call 'updateHierarchyState' if there are no expanded nodes", async () => {
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, testSourceId, []);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchyState' with expanded nodes", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey()), createNodeIdentifier("node-2", createRandomECInstancesNodeKey())];
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isObjectWith({
        imodelKey: "imodel-key",
        changeType: "nodesExpanded",
        nodeKeys: nodes.map((n) => NodeKey.toJSON(n.key)),
        rulesetId: testRulesetId,
      }))).verifiable(moq.Times.once());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, testSourceId, nodes);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchyState' if same node expanded in different source", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey())];
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.once());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, testSourceId, nodes);
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, "other-source-id", nodes);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchiesState' with collapsed nodes", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey())];
      await expandNodes(nodes);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isObjectWith({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        changeType: "nodesCollapsed",
        nodeKeys: nodes.map((n) => NodeKey.toJSON(n.key)),
      }))).verifiable(moq.Times.once());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, testSourceId, []);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchiesState' with collapsed node if it is expanded in other source", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey())];
      await expandNodes(nodes);
      await expandNodes(nodes, "other-source-id");
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, "other-source-id", []);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchiesState' if expanded nodes does not change", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey()), createNodeIdentifier("node-2", createRandomECInstancesNodeKey())];
      await expandNodes(nodes);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onExpandedNodesChanged(imodelMock.object, testRulesetId, testSourceId, nodes);
      ipcHandlerMock.verifyAll();
    });
  });

  describe("onHierarchyClosed", () => {
    it("does not call 'updateHierarchyState' if no nodes were expanded", async () => {
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, testSourceId);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchyState' with nodes from closed hierarchy", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey()), createNodeIdentifier("node-2", createRandomECInstancesNodeKey())];
      await expandNodes(nodes);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isObjectWith({
        imodelKey: "imodel-key",
        changeType: "nodesCollapsed",
        nodeKeys: nodes.map((n) => NodeKey.toJSON(n.key)),
        rulesetId: testRulesetId,
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, testSourceId);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchyState' if nodes expanded in other sources", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey()), createNodeIdentifier("node-2", createRandomECInstancesNodeKey())];
      await expandNodes(nodes);
      await expandNodes(nodes, "other-source-id");
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, testSourceId);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchyState' only with a nodes that were not expanded in other sources", async () => {
      const nodes = [createNodeIdentifier("node-1", createRandomECInstancesNodeKey()), createNodeIdentifier("node-2", createRandomECInstancesNodeKey())];
      await expandNodes([nodes[0]]);
      await expandNodes(nodes, "other-source-id");
      // nodes[0] expanded in both sources nodes[1] expanded just in 'other-source-id'
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isObjectWith({
        imodelKey: "imodel-key",
        changeType: "nodesCollapsed",
        nodeKeys: [NodeKey.toJSON(nodes[1].key)],
        rulesetId: testRulesetId,
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, "other-source-id");
      ipcHandlerMock.verifyAll();
    });
  });
});
