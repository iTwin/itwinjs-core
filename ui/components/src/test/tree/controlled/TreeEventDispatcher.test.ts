/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { from as rxjsFrom } from "rxjs/internal/observable/from";
import { CheckBoxState } from "@bentley/ui-core";
import { TreeEventDispatcher } from "../../../ui-components/tree/controlled/TreeEventDispatcher";
import { TreeEvents, TreeSelectionModificationEvent, TreeSelectionReplacementEvent, TreeCheckboxStateChangeEvent } from "../../../ui-components/tree/controlled/TreeEvents";
import { ITreeNodeLoader } from "../../../ui-components/tree/controlled/TreeNodeLoader";
import { SelectionMode } from "../../../ui-components/common/selection/SelectionModes";
import { VisibleTreeNodes, MutableTreeModelNode, TreeModel, TreeModelNodePlaceholder, TreeModelNode, isTreeModelRootNode, isTreeModelNode } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeSelectionManager, RangeSelection } from "../../../ui-components/tree/controlled/internal/TreeSelectionManager";
import { from } from "../../../ui-components/tree/controlled/Observable";
import { extractSequence } from "../ObservableTestHelpers";
import { createRandomMutableTreeModelNodes, createRandomMutableTreeModelNode } from "./RandomTreeNodesHelpers";

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
  let testNodes: TreeModelNode[];

  beforeEach(() => {
    treeEventsMock.reset();
    treeNodeLoaderMock.reset();

    dispatcher = new TreeEventDispatcher(treeEventsMock.object, treeNodeLoaderMock.object, SelectionMode.Extended, () => visibleNodesMock.object);
    selectionManager = (dispatcher as any)._selectionManager;

    mockVisibleNodes();
  });

  const mockVisibleNodes = () => {
    modelMock.reset();
    visibleNodesMock.reset();

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

      yield placeholderChildNode;
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

    treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => isTreeModelRootNode(parent)), 0)).returns(() => from([[loadedNode.id]]));
    treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => isTreeModelNode(parent) && parent.id === selectedNodes[3].id), 0))
      .returns(() => from([[loadedChildNode.id]]));
  };

  describe("constructor", () => {

    describe("onDragSelection handler", () => {

      it("selects range of nodes", async () => {
        const rangeSelection: RangeSelection = {
          from: deselectedNodes[0].id,
          to: deselectedNodes[deselectedNodes.length - 1].id,
        };
        const expectedSelectedNodeIds = deselectedNodes.map((node) => node.id);
        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeIds).to.be.deep.eq(expectedSelectedNodeIds);
        expect(selectionChange.deselectedNodeIds).to.be.empty;
      });

      it("selects range of nodes and loads unloaded nodes", async () => {
        const rangeSelection = {
          from: selectedNodes[3].id,
          to: deselectedNodes[0].id,
        };
        const expectedSelectedNodeIds = [selectedNodes[3].id, deselectedNodes[0].id, loadedChildNode.id, loadedNode.id];
        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionModified).returns(() => spy);
        selectionManager.onDragSelection.emit({ selectionChanges: from([{ selectedNodes: rangeSelection, deselectedNodes: [] }]) });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeIds).to.be.deep.eq(expectedSelectedNodeIds);
        expect(selectionChange.deselectedNodeIds).to.be.empty;
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

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        expect(results[0].selectedNodeIds).to.be.empty;
        expect(results[0].deselectedNodeIds).to.be.empty;
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

        const spyArgs = spy.args[0][0] as TreeSelectionModificationEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.modifications));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeIds).to.be.deep.eq(selectedNodeIds);
        expect(selectionChange.deselectedNodeIds).to.be.deep.eq(deselectedNodeIds);
      });

    });

    describe("onSelectionReplaced handler", () => {

      it("replaces selected nodes", async () => {
        const selectedNodeIds = deselectedNodes.map((node) => node.id);

        const spy = sinon.spy();
        treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => spy);
        selectionManager.onSelectionReplaced.emit({ selectedNodeIds });
        expect(spy).to.be.called;

        const spyArgs = spy.args[0][0] as TreeSelectionReplacementEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.replacements));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeIds).to.be.deep.eq(selectedNodeIds);
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

        const spyArgs = spy.args[0][0] as TreeSelectionReplacementEvent;
        const results = await extractSequence(rxjsFrom(spyArgs.replacements));
        expect(results).to.not.be.empty;
        const selectionChange = results[0];
        expect(selectionChange.selectedNodeIds).to.be.deep.eq([deselectedNodes[0].id]);
      });

    });

  });

  describe("onNodeCheckboxClicked", () => {

    it("changes state for clicked node", async () => {
      const expectedAffectedNodeIds = [deselectedNodes[0].id];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(deselectedNodes[0].id, CheckBoxState.On);

      expect(spy).to.be.calledOnce;
      const changes = spy.args[0][0] as TreeCheckboxStateChangeEvent;
      const results = await extractSequence(rxjsFrom(changes.stateChanges));
      expect(results).to.not.be.empty;
      const affectedNodeIds = results[0].map((change) => change.nodeId);
      expect(affectedNodeIds).to.be.deep.eq(expectedAffectedNodeIds);
    });

    it("changes state for all selected nodes", async () => {
      const expectedAffectedNodeIds = [selectedNodes[0].id, ...selectedNodes.map((node) => node.id)];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);

      const changes = spy.args[0][0] as TreeCheckboxStateChangeEvent;
      const results = await extractSequence(rxjsFrom(changes.stateChanges));
      expect(results).to.not.be.empty;
      const affectedIds = results[0].map((change) => change.nodeId);
      expect(affectedIds).to.be.deep.eq(expectedAffectedNodeIds);
    });

    it("changes state for all selected nodes including pending selection", async () => {
      // simulate selection event in progress
      // if selection modified event is still in progress, dispatcher saves on going event data in _activeSelections set
      (dispatcher as any)._activeSelections.add(from([{ selectedNodeIds: [deselectedNodes[0].id], deselectedNodeIds: [] }]));

      const expectedAffectedIds = [selectedNodes[0].id, ...selectedNodes.map((node) => node.id), deselectedNodes[0].id];

      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);

      const checkboxChanges = spy.args[0][0] as TreeCheckboxStateChangeEvent;
      const results = await extractSequence(rxjsFrom(checkboxChanges.stateChanges));
      expect(results).to.not.be.empty;
      const affectedIds = results
        .reduce((acc, el) => acc.concat(el), [])
        .map((change) => change.nodeId);
      expect(affectedIds).to.be.deep.eq(expectedAffectedIds);
    });

    it("changes state just for clicked node if visible nodes are not set", async () => {
      dispatcher.setVisibleNodes(undefined!);
      const spy = sinon.spy();
      treeEventsMock.setup((x) => x.onCheckboxStateChanged).returns(() => spy);

      dispatcher.onNodeCheckboxClicked(selectedNodes[0].id, CheckBoxState.On);

      const changes = spy.args[0][0] as TreeCheckboxStateChangeEvent;
      const results = await extractSequence(rxjsFrom(changes.stateChanges));
      expect(results).to.not.be.empty;
      const affectedIds = results[0].map((change) => change.nodeId);
      expect(affectedIds).to.be.deep.eq([selectedNodes[0].id]);
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

});
