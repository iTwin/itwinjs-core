/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey, deepEquals } from "@itwin/presentation-common/lib/cjs/test";
import { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler";
import { StateTracker } from "../presentation-frontend/StateTracker";

describe("StateTracker", () => {
  let tracker: StateTracker;
  const ipcHandlerMock = moq.Mock.ofType<IpcRequestsHandler>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const testRulesetId = "ruleset-id";
  const testSourceId = "source-id";

  function createNodeIdentifier(id: string, key: NodeKey) {
    return { id, key };
  }

  beforeEach(() => {
    ipcHandlerMock.reset();
    imodelMock.reset();
    imodelMock.setup((x) => x.key).returns(() => "imodel-key");
    tracker = new StateTracker(ipcHandlerMock.object);
  });

  describe("onHierarchyStateChanged", () => {
    it("does not call 'updateHierarchyState' if there are no state changes", async () => {
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, []);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchyState' with state changes", async () => {
      const nodes = [
        createNodeIdentifier("node-1", createRandomECInstancesNodeKey()),
        createNodeIdentifier("node-2", createRandomECInstancesNodeKey()),
      ];
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: [{
          nodeKey: nodes[0].key,
          isExpanded: true,
          instanceFilters: ["xxx"],
        }, {
          nodeKey: undefined,
          instanceFilters: ["yyy"],
        }, {
          nodeKey: nodes[1].key,
          isExpanded: true,
        }],
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, [{
        node: nodes[0],
        state: { isExpanded: true, instanceFilter: "xxx" },
      }, {
        node: undefined,
        state: { instanceFilter: "yyy" },
      }, {
        node: nodes[1],
        state: { isExpanded: true },
      }]);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchyState' if merged state of the node doesn't change", async () => {
      const node = createNodeIdentifier("node", createRandomECInstancesNodeKey());
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 1", [{
        node,
        state: { isExpanded: true, instanceFilter: "xxx" },
      }]);
      // the second source reports the same state - that doesn't change the merged state
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 2", [{
        node,
        state: { isExpanded: true, instanceFilter: "xxx" },
      }]);
      // now we report node collapse and filter removal, but that doesn't change the merged state
      // either - the merged state is still `{ isExpanded: true, instanceFilters: ["xxx"] }`
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 2", [{
        node,
        state: { isExpanded: false },
      }]);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchiesState' with collapsed nodes", async () => {
      const node = createNodeIdentifier("node", createRandomECInstancesNodeKey());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, [{
        node,
        state: { isExpanded: true },
      }]);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: [{
          nodeKey: node.key,
        }],
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, [{
        node,
        state: { isExpanded: false },
      }]);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchiesState' when clearing state", async () => {
      const node = createNodeIdentifier("node", createRandomECInstancesNodeKey());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, [{
        node,
        state: { isExpanded: true },
      }]);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: [{
          nodeKey: node.key,
        }],
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, []);
      ipcHandlerMock.verifyAll();
    });

    it("doesn't call 'updateHierarchiesState' when clearing state for different sources", async () => {
      const node = createNodeIdentifier("node", createRandomECInstancesNodeKey());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 1", [{
        node,
        state: { isExpanded: true },
      }]);
      ipcHandlerMock.reset();
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 2", []);
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchiesState' with merged instance filters from multiple sources for the same node", async () => {
      const node = createNodeIdentifier("node", createRandomECInstancesNodeKey());
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: [{
          nodeKey: node.key,
          instanceFilters: ["xxx"],
        }],
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 1", [{
        node,
        state: { instanceFilter: "xxx" },
      }]);
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: [{
          nodeKey: node.key,
          instanceFilters: ["xxx", "yyy"],
        }],
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "source 2", [{
        node,
        state: { instanceFilter: "yyy" },
      }]);
      ipcHandlerMock.verifyAll();
    });
  });

  describe("onHierarchyClosed", () => {
    it("does not call 'updateHierarchyState' if there was no state at all", async () => {
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, testSourceId);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchyState' if there was no state for the source", async () => {
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "some source", [{
        node: createNodeIdentifier("x", createRandomECInstancesNodeKey()),
        state: { isExpanded: true, instanceFilter: "xxx" },
      }]);
      ipcHandlerMock.reset();
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, "different source");
      ipcHandlerMock.verifyAll();
    });

    it("calls 'updateHierarchyState' with nodes from closed hierarchy", async () => {
      const nodes = [
        createNodeIdentifier("node-1", createRandomECInstancesNodeKey()),
        createNodeIdentifier("node-2", createRandomECInstancesNodeKey()),
        createNodeIdentifier("node-3", createRandomECInstancesNodeKey()),
      ];
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, testSourceId, [{
        node: nodes[0],
        state: { isExpanded: true, instanceFilter: "xxx" },
      }, {
        node: nodes[1],
        state: { isExpanded: true },
      }, {
        node: nodes[2],
        state: { instanceFilter: "yyy" },
      }]);
      ipcHandlerMock.reset();
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(deepEquals({
        imodelKey: "imodel-key",
        rulesetId: testRulesetId,
        stateChanges: nodes.map((n) => ({ nodeKey: n.key })),
      }))).verifiable(moq.Times.once());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, testSourceId);
      ipcHandlerMock.verifyAll();
    });

    it("does not call 'updateHierarchyState' if nodes have similar state in other sources", async () => {
      const nodes = [
        createNodeIdentifier("node-1", createRandomECInstancesNodeKey()),
        createNodeIdentifier("node-2", createRandomECInstancesNodeKey()),
        createNodeIdentifier("node-3", createRandomECInstancesNodeKey()),
      ];
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "some source", [{
        node: nodes[0],
        state: { isExpanded: true, instanceFilter: "xxx" },
      }, {
        node: nodes[1],
        state: { isExpanded: true },
      }, {
        node: nodes[2],
        state: { instanceFilter: "yyy" },
      }]);
      await tracker.onHierarchyStateChanged(imodelMock.object, testRulesetId, "other source", [{
        node: nodes[0],
        state: { isExpanded: true, instanceFilter: "xxx" },
      }, {
        node: nodes[1],
        state: { isExpanded: true },
      }, {
        node: nodes[2],
        state: { instanceFilter: "yyy" },
      }]);
      ipcHandlerMock.reset();
      ipcHandlerMock.setup(async (x) => x.updateHierarchyState(moq.It.isAny())).verifiable(moq.Times.never());
      await tracker.onHierarchyClosed(imodelMock.object, testRulesetId, "other source");
      ipcHandlerMock.verifyAll();
    });
  });
});
