/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { of } from "rxjs/internal/observable/of";
import { NodeEventManager } from "../../ui-components/tree/NodeEventManager";
import { NodeLoadingOrchestrator } from "../../ui-components/tree/NodeLoadingOrchestrator";
import sinon from "sinon";
import * as moq from "typemoq";
import { initializeTree } from "./TestDataFactories";
import { TreeNodeItem } from "../../ui-components";
import { BeInspireTree, BeInspireTreeNode } from "../../ui-components/tree/component/BeInspireTree";
import { CheckBoxState } from "@bentley/ui-core";

describe("NodeEventManager", () => {
  function matchNodes(...expectedNodes: number[]): sinon.SinonMatcher {
    return sinon.match((nodes) => {
      if (expectedNodes.length !== nodes.length) {
        return false;
      }

      const unmatchedNodes = expectedNodes.map((id) => id!.toString());
      for (const node of nodes) {
        const matchedNode = unmatchedNodes.findIndex((id) => id === node.id);
        if (matchedNode === -1) {
          return false;
        }

        unmatchedNodes.splice(matchedNode, 1);
      }

      return unmatchedNodes.length === 0;
    });
  }

  const mockOrchestrator = moq.Mock.ofType<NodeLoadingOrchestrator>();
  const onSelectionModified = sinon.spy();
  const onSelectionReplaced = sinon.spy();
  const onCheckboxStateChanged = sinon.spy();

  let manager: NodeEventManager;
  let tree: BeInspireTree<TreeNodeItem>;
  let node0: BeInspireTreeNode<TreeNodeItem>;
  let node1: BeInspireTreeNode<TreeNodeItem>;
  let node2: BeInspireTreeNode<TreeNodeItem>;
  let node3: BeInspireTreeNode<TreeNodeItem>;

  beforeEach(async () => {
    mockOrchestrator.reset();
    onSelectionModified.resetHistory();
    onSelectionReplaced.resetHistory();
    onCheckboxStateChanged.resetHistory();
    manager = new NodeEventManager(mockOrchestrator.object, { onSelectionModified, onSelectionReplaced, onCheckboxStateChanged });

    tree = await initializeTree([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]);
    await Promise.all(tree.nodes().map((_node, index) => tree.requestNodeLoad(undefined, index)));
    node0 = tree.nodes()[0];
    node1 = tree.nodes()[1];
    node2 = tree.nodes()[2];
    node3 = tree.nodes()[3];
  });

  describe("modifySelection", () => {
    it("selects and deselects given nodes when `replace` is `false`", () => {
      mockOrchestrator
        .setup((x) => x.prepareNodes(moq.It.is((nodes) => matchNodes(0, 1, 2, 3).test(nodes))))
        .returns((nodesToPrepare) => of(nodesToPrepare))
        .verifiable();

      manager.modifySelection([node0, node2], [node1, node3]);
      mockOrchestrator.verifyAll();
      expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(0, 2), matchNodes(1, 3));
      expect(onSelectionReplaced).to.not.have.been.called;
    });

    it("does nothing when orchestrator emits empty preloaded node list", () => {
      mockOrchestrator
        .setup((x) => x.prepareNodes(moq.It.is((nodes) => matchNodes(1).test(nodes))))
        // Emit empty preloaded node list, then the requested nodes
        .returns((nodesToPrepare) => of([], nodesToPrepare))
        .verifiable();

      manager.modifySelection([node1], []);
      mockOrchestrator.verifyAll();
      expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(1), []);
      expect(onSelectionReplaced).to.not.have.been.called;
    });
  });

  describe("replaceSelection", () => {
    it("replaces selection with given nodes", () => {
      mockOrchestrator
        .setup((x) => x.prepareNodes(moq.It.is((nodes) => matchNodes(0, 1, 2, 3).test(nodes))))
        .returns(() => of([node0, node1], [node2, node3]))
        .verifiable();

      manager.replaceSelection(tree.nodes());
      mockOrchestrator.verifyAll();
      expect(onSelectionReplaced).to.have.been.calledBefore(onSelectionModified);
      expect(onSelectionReplaced).to.have.been.calledOnceWithExactly(matchNodes(0, 1));
      expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(2, 3), []);
    });

    it("replaces selection with empty list when all input nodes need to load and then selects nodes once they are loaded", () => {
      mockOrchestrator
        .setup((x) => x.prepareNodes(moq.It.is((nodes) => matchNodes(0, 1).test(nodes))))
        .returns((nodesToPrepare) => of([], nodesToPrepare))
        .verifiable();

      manager.replaceSelection([node0, node1]);
      mockOrchestrator.verifyAll();
      expect(onSelectionReplaced).to.have.been.calledBefore(onSelectionModified);
      expect(onSelectionReplaced).to.have.been.calledOnceWithExactly([]);
      expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(0, 1), []);
    });
  });

  describe("selectNodesBetween", () => {
    describe("when selection is not being replaced", () => {
      it("selects nodes that are between", () => {
        const firstNode = node0;
        const lastNode = node3;
        mockOrchestrator
          .setup((x) => x.prepareNodesBetween(firstNode, lastNode))
          .returns(() => of([node0, node3], [node1, node2]))
          .verifiable();

        manager.selectNodesBetween(false, firstNode, lastNode);
        mockOrchestrator.verifyAll();
        expect(onSelectionModified).to.have.been.calledTwice;
        expect(onSelectionModified.firstCall).to.have.been.calledWithExactly(matchNodes(0, 3), []);
        expect(onSelectionModified.secondCall).to.have.been.calledWithExactly(matchNodes(1, 2), []);
      });
    });

    describe("when selection is being replaced", () => {
      it("replaces selection with nodes that are between", () => {
        const firstNode = node0;
        const lastNode = node3;
        mockOrchestrator
          .setup((x) => x.prepareNodesBetween(firstNode, lastNode))
          .returns(() => of([node0, node3], [node1, node2]))
          .verifiable();

        manager.selectNodesBetween(true, firstNode, lastNode);
        mockOrchestrator.verifyAll();
        expect(onSelectionReplaced).to.have.been.calledBefore(onSelectionModified);
        expect(onSelectionReplaced).to.have.been.calledOnceWithExactly(matchNodes(0, 3));
        expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(1, 2), []);
      });

      it("replaces selection when all given nodes need to load and then selects nodes once they are loaded", () => {
        mockOrchestrator
          .setup((x) => x.prepareNodesBetween(node0, node3))
          .returns(() => of([], [node0, node1, node2, node3]))
          .verifiable();

        manager.selectNodesBetween(true, node0, node3);
        mockOrchestrator.verifyAll();
        expect(onSelectionReplaced).to.have.been.calledBefore(onSelectionModified);
        expect(onSelectionReplaced).to.have.been.calledOnceWithExactly([]);
        expect(onSelectionModified).to.have.been.calledOnceWithExactly(matchNodes(0, 1, 2, 3), []);
      });
    });
  });

  describe("setCheckboxState", () => {
    describe("when input node is not selected", () => {
      it("reports that input node's checkbox state has changed", () => {
        const inputNode = tree.nodes()[0];
        manager.setCheckboxState(inputNode, CheckBoxState.On);
        expect(onCheckboxStateChanged).to.have.been.calledOnceWithExactly(sinon.match([{ node: inputNode, newState: CheckBoxState.On }]));
      });
    });

    describe("when input node is selected", () => {
      it("reports that all selected nodes' checkbox states have changed", () => {
        node0.select();
        node2.select();
        node3.select();
        mockOrchestrator
          .setup((x) => x.prepareLoadedNodes())
          .returns(() => of([node0]))
          .verifiable();
        mockOrchestrator
          .setup((x) => x.preparePendingNodes())
          .returns(() => of([node1, node2, node3]))
          .verifiable();

        manager.setCheckboxState(tree.nodes()[0], CheckBoxState.On);
        expect(onCheckboxStateChanged.getCalls()).length(2);
        expect(onCheckboxStateChanged.firstCall).to.have.been.calledWithExactly(sinon.match([
          {
            node: node0,
            newState: CheckBoxState.On,
          }]));
        expect(onCheckboxStateChanged.secondCall).to.have.been.calledWithExactly(sinon.match([
          {
            node: node2,
            newState: CheckBoxState.On,
          },
          {
            node: node3,
            newState: CheckBoxState.On,
          }]));
      });

      it("does not check nodes with disabled checkboxes", async () => {
        node0.select();
        node1.select();
        node1.payload!.isCheckboxDisabled = true;
        node2.select();
        mockOrchestrator
          .setup((x) => x.prepareLoadedNodes())
          .returns(() => of([node0]))
          .verifiable();
        mockOrchestrator
          .setup((x) => x.preparePendingNodes())
          .returns(() => of([node1, node2]))
          .verifiable();

        manager.setCheckboxState(tree.nodes()[0], CheckBoxState.On);
        expect(onCheckboxStateChanged.getCalls()).length(2);
        expect(onCheckboxStateChanged.firstCall).to.have.been.calledWithExactly(sinon.match([
          {
            node: node0,
            newState: CheckBoxState.On,
          }]));
        expect(onCheckboxStateChanged.secondCall).to.have.been.calledWithExactly(sinon.match([
          {
            node: node2,
            newState: CheckBoxState.On,
          }]));
      });
    });
  });
});
