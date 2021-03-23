/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { SelectionHandler } from "../../../../ui-components/common/selection/SelectionHandler.js";
import { SelectionMode } from "../../../../ui-components/common/selection/SelectionModes.js";
import {
  IndividualSelection, isRangeSelection, RangeSelection, TreeSelectionManager,
} from "../../../../ui-components/tree/controlled/internal/TreeSelectionManager.js";
import { MutableTreeModelNode, TreeModel, VisibleTreeNodes } from "../../../../ui-components/tree/controlled/TreeModel.js";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers.js";
import { SpecialKey } from "@bentley/ui-abstract";
import { TreeActions } from "../../../../ui-components/tree/controlled/TreeActions.js";

type Selection = string | RangeSelection;

describe("TreeSelectionManager", () => {

  let multipleSelectionManager: TreeSelectionManager;
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const eventMock = moq.Mock.ofType<React.MouseEvent>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const keyEventMock = moq.Mock.ofType<React.KeyboardEvent>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  let selectionHandler: SelectionHandler<Selection>;
  let node: MutableTreeModelNode;
  let node2: MutableTreeModelNode;

  beforeEach(() => {
    visibleNodesMock.reset();
    eventMock.reset();
    treeModelMock.reset();
    keyEventMock.reset();
    multipleSelectionManager = new TreeSelectionManager(SelectionMode.Multiple, () => visibleNodesMock.object);
    selectionHandler = (multipleSelectionManager as any)._selectionHandler;

    node = { ...createRandomMutableTreeModelNode(), isSelected: false, numChildren: 0 };
    node2 = { ...createRandomMutableTreeModelNode(), isSelected: false, numChildren: undefined };

    visibleNodesMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 2);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);
    visibleNodesMock.setup((x) => x.getAtIndex(1)).returns(() => node2);
    visibleNodesMock.setup((x) => x.getIndexOfNode(node.id)).returns(() => 0);
    visibleNodesMock.setup((x) => x.getIndexOfNode(node2.id)).returns(() => 1);
    treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);
    treeModelMock.setup((x) => x.getNode(node2.id)).returns(() => node2);
  });

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
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      expect(spy).to.be.called;
    });

    it("ctrl deselects node", () => {
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      node = { ...node, isSelected: true };
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      expect(spy).to.be.called;
    });

    it("ctrl selects nodes", () => {
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => false);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      expect(spy).to.be.calledTwice;
    });

    it("shift selects nodes", () => {
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => true);
      eventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      expect(spy).to.be.calledTwice;
    });

    it("shift + ctrl selects nodes", () => {
      const spy = sinon.spy(extendedSelectionManager.onSelectionChanged, "emit");
      eventMock.setup((x) => x.shiftKey).returns(() => true);
      eventMock.setup((x) => x.ctrlKey).returns(() => true);
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      expect(spy).to.be.calledTwice;
    });

  });

  describe("onNodeMouseDown", () => {

    it("selects nodes by dragging", () => {
      const spy = sinon.spy(selectionHandler, "completeDragAction");
      const changeSpy = sinon.spy(multipleSelectionManager.onSelectionChanged, "emit");
      multipleSelectionManager.onNodeMouseDown(node.id);
      multipleSelectionManager.onNodeMouseMove(node2.id);
      window.dispatchEvent(new Event("mouseup"));
      expect(spy).to.be.called;
      expect(changeSpy).to.be.called;
    });

    it("does not select nodes if visible nodes are not set", () => {
      multipleSelectionManager.setVisibleNodes(undefined!);
      const spy = sinon.spy(selectionHandler, "completeDragAction");
      const changeSpy = sinon.spy(multipleSelectionManager.onSelectionChanged, "emit");
      multipleSelectionManager.onNodeMouseDown(node.id);
      multipleSelectionManager.onNodeMouseMove(node2.id);
      window.dispatchEvent(new Event("mouseup"));
      expect(spy).to.be.called;
      expect(changeSpy).to.not.be.called;
    });

  });

  describe("onNodeMouseMove", () => {

    it("updates drag action", () => {
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
      node2.isLoading = false;
    });

    it("does nothing on non-navigation key", () => {
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
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowDown);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("shift selects nodes", () => {
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowDown);
      keyEventMock.setup((x) => x.shiftKey).returns(() => true);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Home should select top node", () => {
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Home);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("End should select bottom node", () => {
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      const spy = sinon.spy(extendedSelectionManager.onSelectionReplaced, "emit");
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.End);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Right should expand node", () => {
      node2.isExpanded = false;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowRight);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Right should not expand node if already expanded", () => {
      node2.isExpanded = true;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
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
      node2.isExpanded = true;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowLeft);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Left should not collapse node if already collapsed", () => {
      node2.isExpanded = false;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
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
      node2.isExpanded = false;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeExpanded).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Space should collapse node if expanded", () => {
      node2.isExpanded = true;
      extendedSelectionManager.onNodeClicked(node2.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spy = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeCollapsed).returns(() => spy);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spy).to.be.called;
    });

    it("Right should not do anything on a leaf node", () => {
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
      extendedSelectionManager.onNodeClicked(node.id, eventMock.object);
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.Space);
      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
      const spyEditorActivated = sinon.spy();
      treeActionsMock.setup((x) => x.onNodeEditorActivated).returns(() => spyEditorActivated);
      extendedSelectionManager.onTreeKeyDown(keyEventMock.object, treeActionsMock.object);
      extendedSelectionManager.onTreeKeyUp(keyEventMock.object, treeActionsMock.object);
      expect(spyEditorActivated).to.be.called;
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
