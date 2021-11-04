/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { from as rxjsFrom } from "rxjs/internal/observable/from";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { CheckBoxState } from "@itwin/core-react";
import { SelectionMode } from "../../../components-react/common/selection/SelectionModes";
import { RangeSelection, TreeSelectionManager } from "../../../components-react/tree/controlled/internal/TreeSelectionManager";
import { from } from "../../../components-react/tree/controlled/Observable";
import { TreeEventDispatcher } from "../../../components-react/tree/controlled/TreeEventDispatcher";
import {
  TreeCheckboxStateChangeEventArgs, TreeEvents, TreeSelectionModificationEventArgs, TreeSelectionReplacementEventArgs,
} from "../../../components-react/tree/controlled/TreeEvents";
import {
  isTreeModelNode, isTreeModelRootNode, MutableTreeModelNode, TreeModel, TreeModelNodePlaceholder, VisibleTreeNodes,
} from "../../../components-react/tree/controlled/TreeModel";
import { ITreeNodeLoader } from "../../../components-react/tree/controlled/TreeNodeLoader";
import { extractSequence } from "../../common/ObservableTestHelpers";
import { createRandomMutableTreeModelNode, createRandomMutableTreeModelNodes } from "./RandomTreeNodesHelpers";

describe("TreeEventDispatcher", () => {

  let dispatcher: TreeEventDispatcher;
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeNodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const modelMock = moq.Mock.ofType<TreeModel>();

  let selectionManager: TreeSelectionManager;

  let selectedNodes: MutableTreeModelNode[];
  let deselectedNodes: MutableTreeModelNode[];
  let placeholderNode: TreeModelNodePlaceholder;
  let placeholderChildNode: TreeModelNodePlaceholder;
  let loadedNode: MutableTreeModelNode;
  let loadedChildNode: MutableTreeModelNode;
  let testNodes: MutableTreeModelNode[];

  beforeEach(() => {
    treeEventsMock.reset();
    treeNodeLoaderMock.reset();

    dispatcher = new TreeEventDispatcher(treeEventsMock.object, treeNodeLoaderMock.object, SelectionMode.Extended, () => visibleNodesMock.object);
    selectionManager = (dispatcher as any)._selectionManager;

    mockVisibleNodes();
  });

  const mockVisibleNodes = (addRootLevelPlaceholderNode = false, addChildPlaceholderNode = false) => {
    modelMock.reset();
    visibleNodesMock.reset();
    treeNodeLoaderMock.reset();

    selectedNodes = createRandomMutableTreeModelNodes(4).map((node) => ({ ...node, isSelected: true }));
    deselectedNodes = createRandomMutableTreeModelNodes(4).map((node) => ({ ...node, isSelected: false }));
    placeholderNode = { childIndex: 0, depth: 0 };
    placeholderChildNode = { childIndex: 0, depth: 1, parentId: selectedNodes[3].id };
    loadedNode = createRandomMutableTreeModelNode();
    loadedChildNode = createRandomMutableTreeModelNode(selectedNodes[3].id);
    testNodes = [...selectedNodes, ...deselectedNodes];

    const iterator = function* () {
      for (const node of selectedNodes)
        yield node;

      if (addChildPlaceholderNode)
        yield placeholderChildNode;

      if (addRootLevelPlaceholderNode)
        yield placeholderNode;

      for (const node of deselectedNodes)
        yield node;
    };

    visibleNodesMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => testNodes.length + 2);
    visibleNodesMock.setup((x) => x[Symbol.iterator]).returns(() => iterator);

    for (const node of testNodes) {
      modelMock.setup((x) => x.getNode(node.id)).returns(() => node);
    }

    modelMock.setup((x) => x.getRootNode()).returns(() => ({ depth: -1, id: undefined, numChildren: undefined }));
    modelMock.setup((x) => x.getNode(loadedNode.id)).returns(() => loadedNode);
    modelMock.setup((x) => x.getNode(loadedChildNode.id)).returns(() => loadedChildNode);
    modelMock.setup((x) => x.getNode(selectedNodes[3].id)).returns(() => selectedNodes[3]);

    treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => isTreeModelRootNode(parent)), 0)).returns(() => from([{ loadedNodes: [loadedNode.item] }]));
    treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => isTreeModelNode(parent) && parent.id === selectedNodes[3].id), 0))
      .returns(() => from([{ loadedNodes: [loadedChildNode.item] }]));
  };

  describe("constructor", () => {

    describe("onDragSelection handler", () => {

      it("selects range of nodes", async () => {
        const rangeSelection: RangeSelection = {
          from: deselectedNodes[0].id,
          to: deselectedNodes[deselectedNodes.length - 1].id,
        };
        const expectedSelectedNodeItems = deselectedNodes.map((node) => node.item);
        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq(expectedSelectedNodeItems);
        expect(selectionChange.deselectedNodeItems).to.be.empty;
      });

      it("selects range of nodes and loads unloaded nodes", async () => {
        mockVisibleNodes(false, true);
        const rangeSelection = {
          from: selectedNodes[3].id,
          to: deselectedNodes[0].id,
        };
        const expectedSelectedNodeIds = [selectedNodes[3].item, deselectedNodes[0].item, loadedChildNode.item];
        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq(expectedSelectedNodeIds);
        expect(selectionChange.deselectedNodeItems).to.be.empty;
      });

      it("selects range of nodes and loads unloaded nodes hierarchy", async () => {
        mockVisibleNodes(true);
        const rangeSelection = {
          from: selectedNodes[3].id,
          to: deselectedNodes[0].id,
        };

        treeNodeLoaderMock.reset();
        treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => isTreeModelRootNode(parent)), 0))
          .returns(() => from([{ loadedNodes: [loadedNode.item, loadedChildNode.item] }]));

        const expectedSelectedNodeItems = [selectedNodes[3].item, deselectedNodes[0].item, loadedNode.item, loadedChildNode.item];
        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq(expectedSelectedNodeItems);
        expect(selectionChange.deselectedNodeItems).to.be.empty;
      });

      it("does not select nodes if visible nodes are not set", async () => {
        dispatcher.setVisibleNodes(undefined!);
        const rangeSelection: RangeSelection = {
          from: deselectedNodes[0].id,
          to: deselectedNodes[deselectedNodes.length - 1].id,
        };

        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        expect(results[0].selectedNodeItems).to.be.empty;
        expect(results[0].deselectedNodeItems).to.be.empty;
      });

    });

    describe("onSelectionChanged handler", () => {

      it("selects and deselects nodes", async () => {
        const deselectedNodeIds = selectedNodes.map((node) => node.id);
        const selectedNodeIds = deselectedNodes.map((node) => node.id);

        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onSelectionChanged.emit({ selectedNodes: selectedNodeIds, deselectedNodes: deselectedNodeIds });
        expect(spy).to.be.called;

        const selectedNodeItems = deselectedNodes.map((node) => node.item);
        const deselectedNodeItems = selectedNodes.map((node) => node.item);
        const spyArgs = spy.args[0][0] as TreeSelectionModificationEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq(selectedNodeItems);
        expect(selectionChange.deselectedNodeItems).to.be.deep.eq(deselectedNodeItems);
      });

    });

    describe("onSelectionReplaced handler", () => {

      it("replaces selected nodes", async () => {
        const selectedNodeIds = deselectedNodes.map((node) => node.id);
        const selectedNodeItems = deselectedNodes.map((node) => node.item);

        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => spy);
        selectionManager.onSelectionReplaced.emit({ selectedNodeIds });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionReplacementEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.replacements));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq(selectedNodeItems);
      });

      it("replaces selected nodes using range selection from one node", async () => {
        const selection = {
          from: deselectedNodes[0].id,
          to: deselectedNodes[0].id,
        };

        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => spy);
        selectionManager.onSelectionReplaced.emit({ selectedNodeIds: selection });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionReplacementEventArgs;
        const results = await extractSequence(rxjsFrom(spyArgs.replacements));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeItems).to.be.deep.eq([deselectedNodes[0].item]);
      });

    });

  });

  describe("onNodeCheckboxClicked", () => {

    it("changes state for clicked node", async () => {
      const expectedAffectedNodeItems = [deselectedNodes[0].item];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(deselectedNodes[0].id, CheckBoxState.On);

      expect(spy).to.be.calledOnce;
      const changes = spy.args[0][0] as TreeCheckboxStateChangeEventArgs;
      const results = await extractSequence(rxjsFrom(changes.stateChanges));
      expect(results).to.not.be.empty;
      const affectedNodeItems = results[0].map((change) => change.nodeItem);
      expect(affectedNodeItems).to.be.deep.eq(expectedAffectedNodeItems);
    });

    it("changes state for all selected nodes", async () => {
      const expectedAffectedNodeItems = [...selectedNodes.map((node) => node.item)];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);

      const changes = spy.args[0][0] as TreeCheckboxStateChangeEventArgs;
      const results = await extractSequence(rxjsFrom(changes.stateChanges));
      expect(results).to.not.be.empty;
      const affectedItems = results[0].map((change) => change.nodeItem);
      expect(affectedItems).to.be.deep.eq(expectedAffectedNodeItems);
    });

    it("changes state for all selected nodes including pending selection", async () => {
      // simulate selection event in progress
      // if selection modified event is still in progress, dispatcher saves on going event data in _activeSelections set
      (dispatcher as any)._activeSelections.add(from([{ selectedNodeItems: [deselectedNodes[0].item], deselectedNodeItems: [] }]));

      const expectedAffectedItems = [...selectedNodes.map((node) => node.item), deselectedNodes[0].item];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);

      const checkboxChanges = spy.args[0][0] as TreeCheckboxStateChangeEventArgs;
      const results = await extractSequence(rxjsFrom(checkboxChanges.stateChanges));
      expect(results).to.not.be.empty;
      const affectedItems = results
        .reduce((acc, el) => acc.concat(el), [])
        .map((change) => change.nodeItem);
      expect(affectedItems).to.be.deep.eq(expectedAffectedItems);
    });

    it("does not dispatch event if visibleNodes are not set", async () => {
      dispatcher.setVisibleNodes(undefined!);
      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);
      expect(spy).to.not.be.called;
    });

    it("does not dispatch event if clicked node is not found", async () => {
      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);
      modelMock.setup((x) => x.getNode("NoNode")).returns(() => undefined);

      dispatcher.onNodeCheckboxClicked("NoNode", CheckBoxState.On);
      expect(spy).to.not.be.called;
    });

  });

  describe("onNodeExpanded", () => {

    it("emits tree event", () => {
      treeEventsMock.setup((x) => x.onNodeExpanded!({ nodeId: testNodes[0].id })).verifiable(moq.Times.once());
      dispatcher.onNodeExpanded(testNodes[0].id);
      treeEventsMock.verifyAll();
    });

  });

  describe("onNodeCollapsed", () => {

    it("emits tree event", () => {
      treeEventsMock.setup((x) => x.onNodeCollapsed!({ nodeId: testNodes[0].id })).verifiable(moq.Times.once());
      dispatcher.onNodeCollapsed(testNodes[0].id);
      treeEventsMock.verifyAll();
    });

  });

  describe("onNodeClicked", () => {

    it("calls selection manager onNodeClicked", () => {
      const eventMock = moq.Mock.ofType<React.MouseEvent<Element, MouseEvent>>();
      const spy = sinon.spy(selectionManager, "onNodeClicked");
      dispatcher.onNodeClicked(testNodes[0].id, eventMock.object);
      expect(spy).to.be.calledWith(testNodes[0].id, eventMock.object);
    });

    it("calls tree events onDelayedNodeClick if node is selected", () => {
      const eventMock = moq.Mock.ofType<React.MouseEvent<Element, MouseEvent>>();
      testNodes[0].isSelected = true;
      dispatcher.onNodeClicked(testNodes[0].id, eventMock.object);
      treeEventsMock.verify((x) => x.onDelayedNodeClick!({ nodeId: testNodes[0].id }), moq.Times.exactly(2));
    });

    it("does not call tree events onDelayedNodeClick if node is not selected", () => {
      const eventMock = moq.Mock.ofType<React.MouseEvent<Element, MouseEvent>>();
      testNodes[0].isSelected = false;
      dispatcher.onNodeClicked(testNodes[0].id, eventMock.object);
      treeEventsMock.verify((x) => x.onDelayedNodeClick!({ nodeId: testNodes[0].id }), moq.Times.never());
    });

    it("does not call tree events onDelayedNodeClick if node does not exist", () => {
      modelMock.reset();
      const eventMock = moq.Mock.ofType<React.MouseEvent<Element, MouseEvent>>();
      testNodes[0].isSelected = false;
      dispatcher.onNodeClicked(testNodes[0].id, eventMock.object);
      treeEventsMock.verify((x) => x.onDelayedNodeClick!({ nodeId: testNodes[0].id }), moq.Times.never());
    });

    it("does not call tree events onDelayedNodeClick if visible nodes are not set", () => {
      dispatcher.setVisibleNodes(undefined!);
      const eventMock = moq.Mock.ofType<React.MouseEvent<Element, MouseEvent>>();
      testNodes[0].isSelected = false;
      dispatcher.onNodeClicked(testNodes[0].id, eventMock.object);
      treeEventsMock.verify((x) => x.onDelayedNodeClick!({ nodeId: testNodes[0].id }), moq.Times.never());
    });

  });

  describe("onNodeMouseDown", () => {

    it("calls selection manager onNodeMouseDown", () => {
      const spy = sinon.spy(selectionManager, "onNodeMouseDown");
      dispatcher.onNodeMouseDown(testNodes[0].id);
      expect(spy).to.be.calledWith(testNodes[0].id);
    });

  });

  describe("onNodeMouseMove", () => {

    it("calls selection manager onNodeMouseMove", () => {
      const spy = sinon.spy(selectionManager, "onNodeMouseMove");
      dispatcher.onNodeMouseMove(testNodes[0].id);
      expect(spy).to.be.calledWith(testNodes[0].id);
    });

  });

  describe("Keyboard Events", () => {
    const keyEventMock = moq.Mock.ofType<React.KeyboardEvent>();

    beforeEach(() => {
      keyEventMock.reset();
    });

    it("calls selection manager onTreeKeyDown", () => {
      const spy = sinon.spy(selectionManager, "onTreeKeyDown");
      dispatcher.onTreeKeyDown(keyEventMock.object);
      expect(spy).to.be.called;
    });

    it("calls selection manager onTreeKeyUp", () => {
      const spy = sinon.spy(selectionManager, "onTreeKeyUp");
      dispatcher.onTreeKeyUp(keyEventMock.object);
      expect(spy).to.be.called;
    });

  });

  describe("onNodeEditorActivated", () => {

    it("calls tree events onNodeEditorActivated if node is selected", () => {
      testNodes[0].isSelected = true;
      dispatcher.onNodeEditorActivated(testNodes[0].id);
      treeEventsMock.verify((x) => x.onNodeEditorActivated!({ nodeId: testNodes[0].id }), moq.Times.exactly(2));
    });

    it("does not call tree events onNodeEditorActivated if node is not selected", () => {
      testNodes[0].isSelected = false;
      dispatcher.onNodeEditorActivated(testNodes[0].id);
      treeEventsMock.verify((x) => x.onNodeEditorActivated!({ nodeId: testNodes[0].id }), moq.Times.never());
    });

    it("does not call tree events onNodeEditorActivated if node id is invalid", () => {
      const nodeId = "invalid";
      dispatcher.onNodeEditorActivated(nodeId);
      treeEventsMock.verify((x) => x.onNodeEditorActivated!({ nodeId }), moq.Times.never());
    });

  });

});
