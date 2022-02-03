/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import type { SelectionHandler } from "../../../../components-react/common/selection/SelectionHandler";
import { SelectionMode } from "../../../../components-react/common/selection/SelectionModes";
import type {
  IndividualSelection, RangeSelection} from "../../../../components-react/tree/controlled/internal/TreeSelectionManager";
import { isRangeSelection, TreeSelectionManager,
} from "../../../../components-react/tree/controlled/internal/TreeSelectionManager";
import type { TreeModel, TreeModelNode, TreeModelNodePlaceholder, VisibleTreeNodes } from "../../../../components-react/tree/controlled/TreeModel";
import { isTreeModelNode } from "../../../../components-react/tree/controlled/TreeModel";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";
import { SpecialKey } from "@itwin/appui-abstract";
import type { TreeActions } from "../../../../components-react/tree/controlled/TreeActions";

type Selection = string | RangeSelection;

describe("TreeSelectionManager", () => {

  let multipleSelectionManager: TreeSelectionManager;
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const eventMock = moq.Mock.ofType<React.MouseEvent>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const keyEventMock = moq.Mock.ofType<React.KeyboardEvent>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  let selectionHandler: SelectionHandler<Selection>;

  beforeEach(() => {
    visibleNodesMock.reset();
    eventMock.reset();
    treeModelMock.reset();
    keyEventMock.reset();
    multipleSelectionManager = new TreeSelectionManager(SelectionMode.Multiple, () => visibleNodesMock.object);
    selectionHandler = (multipleSelectionManager as any)._selectionHandler;
  });

  function createTreeModelNode(props?: Partial<TreeModelNode>) {
    return {
      ...createRandomMutableTreeModelNode(),
      isLoading: false,
      isSelected: false,
      ...props,
    };
  }

  function setupModelWithNodes(nodes: Array<TreeModelNode | TreeModelNodePlaceholder>) {
    visibleNodesMock.reset();
    treeModelMock.reset();

    visibleNodesMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => nodes.length);
    nodes.forEach((node, index) => {
      visibleNodesMock.setup((x) => x.getAtIndex(index)).returns(() => node);
      if (isTreeModelNode(node)) {
        visibleNodesMock.setup((x) => x.getIndexOfNode(node.id)).returns(() => index);
        treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);
      }
    });
  }

  describe("constructor", () => {

    it("creates new TreeSelectionManager without visible nodes", () => {
      const selectionManager = new TreeSelectionManager(SelectionMode.Multiple);
      expect(selectionManager).to.not.be.undefined;
    });

  });

  describe("onNodeClicked", () => {

    let extendedSelectionManager: TreeSelectionManager;

    beforeEach(() => {
      extendedSelectionManager = new TreeSelectionManager(SelectionMode.Extended, () => visibleNodesMock.object);
    });

    it("selects node", () => {
      const node = createTreeModelNode();
      setupModelWithNodes([node]);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      expect(spy).to.be.calledOnce;
      expect(spy).to.be.calledWithExactly({
        selectedNodeIds: [node.id],
      });
    });

    it("ctrl deselects node", () => {
      const node = createTreeModelNode({ isSelected: true });
      setupModelWithNodes([node]);
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      expect(spy).to.be.calledOnce;
      expect(spy).to.be.calledWithExactly({
        selectedNodes: [],
        deselectedNodes: [node.id],
      });
    });

    it("ctrl selects nodes", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      extendedSelectionManager.onNodeClicked(nodes[1].id, eventMock.object);
      expect(spy).to.be.calledTwice;
      expect(spy.firstCall).to.be.calledWithExactly({
        selectedNodes: [nodes[0].id],
        deselectedNodes: [],
      });
      expect(spy.secondCall).to.be.calledWithExactly({
        selectedNodes: [nodes[1].id],
        deselectedNodes: [],
      });
    });

    it("shift selects nodes", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => true);
      eventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      extendedSelectionManager.onNodeClicked(nodes[1].id, eventMock.object);
      expect(spy).to.be.calledTwice;
      expect(spy.firstCall).to.be.calledWithExactly({
        selectedNodeIds: [nodes[0].id],
      });
      expect(spy.secondCall).to.be.calledWithExactly({
        selectedNodeIds: { from: nodes[0].id, to: nodes[1].id },
      });
    });

    it("shift + ctrl selects nodes", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => true);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      extendedSelectionManager.onNodeClicked(nodes[1].id, eventMock.object);
      expect(spy).to.be.calledTwice;
      expect(spy.firstCall).to.be.calledWithExactly({
        selectedNodes: [nodes[0].id],
        deselectedNodes: [],
      });
      expect(spy.secondCall).to.be.calledWithExactly({
        selectedNodes: { from: nodes[0].id, to: nodes[1].id },
        deselectedNodes: [],
      });
    });

  });

  describe("onNodeMouseDown", () => {

    it("selects nodes by dragging", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      const spy = sinon.spy(selectionHandler, "completeDragAction");
      const changeSpy = sinon.spy(multipleSelectionManager.onSelectionChanged, "emit");
      multipleSelectionManager.onNodeMouseDown(nodes[0].id);
      multipleSelectionManager.onNodeMouseMove(nodes[1].id);
      window.dispatchEvent(new Event("mouseup"));
      expect(spy).to.be.called;
      expect(changeSpy).to.be.calledWithExactly({
        selectedNodes: [nodes[0].id, nodes[1].id],
        deselectedNodes: [],
      });
    });

    it("does not select nodes if visible nodes are not set", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      multipleSelectionManager.setVisibleNodes(undefined);
      const spy = sinon.spy(selectionHandler, "completeDragAction");
      const changeSpy = sinon.spy(multipleSelectionManager.onSelectionChanged, "emit");
      multipleSelectionManager.onNodeMouseDown(nodes[0].id);
      multipleSelectionManager.onNodeMouseMove(nodes[1].id);
      window.dispatchEvent(new Event("mouseup"));
      expect(spy).to.be.called;
      expect(changeSpy).to.not.be.called;
    });

    it("selects nodes when there are placeholder visible nodes", () => {
      const placeholder = { childIndex: 0, depth: 0 };
      const node = createTreeModelNode();
      setupModelWithNodes([placeholder, node]);
      const spy = sinon.spy(selectionHandler, "completeDragAction");
      const changeSpy = sinon.spy(multipleSelectionManager.onSelectionChanged, "emit");
      multipleSelectionManager.onNodeMouseDown(node.id);
      window.dispatchEvent(new Event("mouseup"));
      multipleSelectionManager.onNodeClicked(node.id, eventMock.object);
      expect(spy).to.be.called;
      expect(changeSpy).to.be.calledWithExactly({
        selectedNodes: [node.id],
        deselectedNodes: [],
      });
    });

  });

  describe("onNodeMouseMove", () => {

    it("updates drag action", () => {
      const node = createTreeModelNode();
      setupModelWithNodes([node]);
      const spy = sinon.spy(selectionHandler, "updateDragAction");
      multipleSelectionManager.onNodeMouseMove(node.id);
      expect(spy).to.be.called;
    });

  });

  describe("Keyboard Events", () => {

    let extendedSelectionManager: TreeSelectionManager;

    beforeEach(() => {
      extendedSelectionManager = new TreeSelectionManager(SelectionMode.Extended, () => visibleNodesMock.object);
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => false);
      treeActionsMock.reset();
    });

    it("does nothing on non-navigation key", () => {
      const node = createTreeModelNode();
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Divide);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.not.be.called;
    });

    it("selects node", () => {
      const nodes = [createTreeModelNode({ isSelected: false }), createTreeModelNode({ isSelected: false })];
      setupModelWithNodes(nodes);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowDown);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly({ selectedNodeIds: [nodes[1].id] });
    });

    it("shift selects nodes", () => {
      const nodes = [createTreeModelNode({ isSelected: false }), createTreeModelNode({ isSelected: false })];
      setupModelWithNodes(nodes);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowDown);
      keyEventMock.setup((x) => x.shiftKey).returns(() => true);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly({ selectedNodeIds: { from: nodes[0].id, to: nodes[1].id } });
    });

    it("Home should select top node", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      extendedSelectionManager.onNodeClicked(nodes[1].id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Home);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly({ selectedNodeIds: [nodes[0].id] });
    });

    it("End should select bottom node", () => {
      const nodes = [createTreeModelNode(), createTreeModelNode()];
      setupModelWithNodes(nodes);
      extendedSelectionManager.onNodeClicked(nodes[0].id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.End);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly({ selectedNodeIds: [nodes[1].id] });
    });

    it("Right should expand node", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: false });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowRight);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly(node.id);
    });

    it("Right should not expand node if already expanded", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: true });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowRight);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.not.be.called;
    });

    it("Left should collapse node", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: true });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowLeft);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly(node.id);
    });

    it("Left should not collapse node if already collapsed", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: false });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowLeft);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.not.be.called;
    });

    it("Space should expand node if collapsed", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: false });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly(node.id);
    });

    it("Space should collapse node if expanded", () => {
      const node = createTreeModelNode({ numChildren: 1, isExpanded: true });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.calledWithExactly(node.id);
    });

    it("Right should not do anything on a leaf node", () => {
      const node = createTreeModelNode({ numChildren: 0, isExpanded: false });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowRight);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spyExpanded = sinon.spy();
      const spyCollapsed = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spyExpanded);
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spyCollapsed);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spyExpanded).to.not.be.called;
      expect(spyCollapsed).to.not.be.called;
    });

    it("Space should start editing on a leaf node", () => {
      const node = createTreeModelNode({ numChildren: 0, isExpanded: false });
      setupModelWithNodes([node]);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spyEditorActivated = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeEditorActivated).returns(() => spyEditorActivated);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spyEditorActivated).to.be.calledWithExactly(node.id);
    });

  });

});

describe("isRangeSelection", () => {

  it("returns true for RangeSelection", () => {
    const rangeSelection: RangeSelection = {
      from: faker.random.uuid(),
      to: faker.random.uuid(),
    };
    expect(isRangeSelection(rangeSelection)).to.be.true;
  });

  it("returns false for IndividualSelection", () => {
    const individualSelection: IndividualSelection = [faker.random.uuid()];
    expect(isRangeSelection(individualSelection)).to.be.false;
  });

});
