/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { EMPTY } from "rxjs/internal/observable/empty";
import { CheckBoxState } from "@bentley/ui-core";
import { TreeModelMutator } from "../../../../ui-components/tree/controlled/internal/TreeModelMutator";
import { TreeModelSource } from "../../../../ui-components/tree/controlled/TreeModelSource";
import { MutableTreeModelNode, MutableTreeModel } from "../../../../ui-components/tree/controlled/TreeModel";
import { CheckboxStateChange } from "../../../../ui-components/tree/controlled/TreeEvents";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

describe("TreeModelMutator", () => {

  let modelMutator: TreeModelMutator;
  const treeModelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeModelMock = moq.Mock.ofType<MutableTreeModel>();
  let node: MutableTreeModelNode;

  beforeEach(() => {
    treeModelSourceMock.reset();
    treeModelMock.reset();
    modelMutator = new TreeModelMutator(treeModelSourceMock.object, false);
    node = createRandomMutableTreeModelNode();

    treeModelSourceMock
      .setup((x) => x.modifyModel(moq.It.isAny()))
      .callback((func: (model: MutableTreeModel) => void) => func(treeModelMock.object))
      .verifiable(moq.Times.once());
  });

  describe("expandNode", () => {

    beforeEach(() => {
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
    });

    it("expands node without children", () => {
      node = { ...node, isExpanded: false, numChildren: 0 };
      modelMutator.expandNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.true;
    });

    it("expands node and loads children", () => {
      treeModelSourceMock.setup((x) => x.loadNode(node.id, 0)).returns(() => EMPTY).verifiable(moq.Times.once());
      node = { ...node, isExpanded: false, numChildren: undefined };
      modelMutator.expandNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.true;
    });

    it("does nothing if node is expanded", () => {
      node = { ...node, isExpanded: true, numChildren: 0 };
      modelMutator.expandNode(node.id);

      expect(node.isExpanded).to.be.true;
    });

  });

  describe("collapseNode", () => {

    beforeEach(() => {
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
    });

    it("collapses node without children", () => {
      node = { ...node, isExpanded: true, numChildren: 0 };
      modelMutator.collapseNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.false;
    });

    it("does nothing if node is not expanded", () => {
      node = { ...node, isExpanded: false };
      modelMutator.collapseNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.false;
    });

    it("collapses node and disposes children when disposing is enabled", () => {
      const disposingMutator = new TreeModelMutator(treeModelSourceMock.object, true);
      treeModelMock.setup((x) => x.clearChildren(node.id)).verifiable(moq.Times.once());
      node = { ...node, isExpanded: true, numChildren: 0 };
      disposingMutator.collapseNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.false;
    });

  });

  describe("modifySelection", () => {

    const nodeToSelect: MutableTreeModelNode = { ...createRandomMutableTreeModelNode(), isSelected: false };
    const nodeToDeselect: MutableTreeModelNode = { ...createRandomMutableTreeModelNode(), isSelected: true };

    it("selects and deselects nodes", () => {
      treeModelMock.setup((x) => x.getNode(nodeToSelect.id)).returns(() => nodeToSelect).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToDeselect.id)).returns(() => nodeToDeselect).verifiable(moq.Times.once());

      modelMutator.modifySelection([nodeToSelect.id], [nodeToDeselect.id]);
      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();

      expect(nodeToSelect.isSelected).to.be.true;
      expect(nodeToDeselect.isSelected).to.be.false;
    });

    it("tries to select and deselect nodes even if they were removed", () => {
      treeModelMock.setup((x) => x.getNode(nodeToSelect.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToDeselect.id)).returns(() => undefined).verifiable(moq.Times.once());

      modelMutator.modifySelection([nodeToSelect.id], [nodeToDeselect.id]);
      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
    });

  });

  describe("replaceSelection", () => {

    const selectedNode: MutableTreeModelNode = { ...createRandomMutableTreeModelNode(), isSelected: true };
    const nodeToSelect: MutableTreeModelNode = { ...createRandomMutableTreeModelNode(), isSelected: false };

    it("replaces selection", () => {
      const nodes: MutableTreeModelNode[] = [selectedNode, nodeToSelect];
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]()).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToSelect.id)).returns(() => nodeToSelect).verifiable(moq.Times.once());

      modelMutator.replaceSelection([nodeToSelect.id]);
      treeModelMock.verifyAll();
      expect(selectedNode.isSelected).to.be.false;
      expect(nodeToSelect.isSelected).to.be.true;
    });

    it("tries to replace selection even if nodes were removed", () => {
      const nodes: MutableTreeModelNode[] = [];
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]()).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToSelect.id)).returns(() => undefined).verifiable(moq.Times.once());

      modelMutator.replaceSelection([nodeToSelect.id]);
      treeModelMock.verifyAll();
    });

  });

  describe("clearSelection", () => {

    it("clears selection", () => {
      const selectedNodes: MutableTreeModelNode[] = [{ ...createRandomMutableTreeModelNode(), isSelected: true }];
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => selectedNodes[Symbol.iterator]()).verifiable(moq.Times.once());

      modelMutator.clearNodeSelection();
      treeModelMock.verifyAll();
      expect(selectedNodes[0].isSelected).to.be.false;
    });

  });

  describe("setCheckboxState", () => {

    it("sets checkbox state", () => {
      const checkboxStateChange: CheckboxStateChange = {
        nodeId: node.id,
        newState: CheckBoxState.On,
      };

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
      modelMutator.setCheckboxStates([checkboxStateChange]);
      treeModelMock.verifyAll();
      expect(node.checkbox.state).to.be.eq(checkboxStateChange.newState);
    });

    it("tries to set checkbox state even if node was removed", () => {
      const checkboxStateChange: CheckboxStateChange = {
        nodeId: node.id,
        newState: CheckBoxState.On,
      };

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => undefined).verifiable(moq.Times.once());
      modelMutator.setCheckboxStates([checkboxStateChange]);
      treeModelMock.verifyAll();
    });

  });

});
