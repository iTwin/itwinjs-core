/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import * as faker from "faker";
import { TreeSelectionManager, RangeSelection, isRangeSelection, IndividualSelection } from "../../../../ui-components/tree/controlled/internal/TreeSelectionManager";
import { SelectionMode } from "../../../../ui-components/common/selection/SelectionModes";
import { VisibleTreeNodes, MutableTreeModelNode, TreeModel } from "../../../../ui-components/tree/controlled/TreeModel";
import { SelectionHandler } from "../../../../ui-components/common/selection/SelectionHandler";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

type Selection = string | RangeSelection;

describe("TreeSelectionManager", () => {

  let multipleSelectionManager: TreeSelectionManager;
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const eventMock = moq.Mock.ofType<React.MouseEvent>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  let selectionHandler: SelectionHandler<Selection>;
  let node: MutableTreeModelNode;
  let node2: MutableTreeModelNode;

  beforeEach(() => {
    eventMock.reset();
    multipleSelectionManager = new TreeSelectionManager(SelectionMode.Multiple, () => visibleNodesMock.object);
    selectionHandler = (multipleSelectionManager as any)._selectionHandler;

    node = { ...createRandomMutableTreeModelNode(), isSelected: false };
    node2 = { ...createRandomMutableTreeModelNode(), isSelected: false };

    visibleNodesMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 2);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);
    visibleNodesMock.setup((x) => x.getAtIndex(1)).returns(() => node2);
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
