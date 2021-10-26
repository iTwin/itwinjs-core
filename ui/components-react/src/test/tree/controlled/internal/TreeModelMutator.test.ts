/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EMPTY } from "rxjs/internal/observable/empty";
import sinon from "sinon";
import * as moq from "typemoq";
import { CheckBoxState } from "@itwin/core-react";
import { TreeModelMutator } from "../../../../components-react/tree/controlled/internal/TreeModelMutator";
import { CheckboxStateChange } from "../../../../components-react/tree/controlled/TreeEvents";
import { MutableTreeModel, MutableTreeModelNode } from "../../../../components-react/tree/controlled/TreeModel";
import { TreeModelSource } from "../../../../components-react/tree/controlled/TreeModelSource";
import { ITreeNodeLoader } from "../../../../components-react/tree/controlled/TreeNodeLoader";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

describe("TreeModelMutator", () => {

  let modelMutator: TreeModelMutator;
  const treeModelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeNodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const treeModelMock = moq.Mock.ofType<MutableTreeModel>();
  let node: MutableTreeModelNode;

  beforeEach(() => {
    treeModelSourceMock.reset();
    treeModelMock.reset();
    treeNodeLoaderMock.reset();
    modelMutator = new TreeModelMutator(treeModelSourceMock.object, treeNodeLoaderMock.object, false);
    node = createRandomMutableTreeModelNode();

    treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    treeModelSourceMock
      .setup((x) => x.modifyModel(moq.It.isAny()))
      .callback((func: (model: MutableTreeModel) => void) => func(treeModelMock.object))
      .verifiable(moq.Times.once());
  });

  describe("modelSource", () => {

    it("returns modelSource", () => {
      expect(modelMutator.modelSource).to.be.deep.eq(treeModelSourceMock.object);
    });

  });

  describe("expandNode", () => {

    beforeEach(() => {
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.exactly(2));
    });

    it("expands node without children", () => {
      node = { ...node, isExpanded: false, numChildren: 0 };
      modelMutator.expandNode(node.id);

      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();
      expect(node.isExpanded).to.be.true;
    });

    it("expands node and loads children", () => {
      treeNodeLoaderMock.setup((x) => x.loadNode(moq.It.is((parent) => parent.id === node.id), 0)).returns(() => EMPTY).verifiable(moq.Times.once());
      node = { ...node, isExpanded: false, numChildren: undefined };
      modelMutator.expandNode(node.id);

      treeModelMock.verifyAll();
      treeNodeLoaderMock.verifyAll();
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
      const disposingMutator = new TreeModelMutator(treeModelSourceMock.object, treeNodeLoaderMock.object, true);
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
      treeModelMock.setup((x) => x.getNode(nodeToSelect.item.id)).returns(() => nodeToSelect).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToDeselect.item.id)).returns(() => nodeToDeselect).verifiable(moq.Times.once());

      modelMutator.modifySelection([nodeToSelect.item], [nodeToDeselect.item]);
      treeModelMock.verifyAll();
      treeModelSourceMock.verifyAll();

      expect(nodeToSelect.isSelected).to.be.true;
      expect(nodeToDeselect.isSelected).to.be.false;
    });

    it("tries to select and deselect nodes even if they were removed", () => {
      treeModelMock.setup((x) => x.getNode(nodeToSelect.item.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToDeselect.item.id)).returns(() => undefined).verifiable(moq.Times.once());

      modelMutator.modifySelection([nodeToSelect.item], [nodeToDeselect.item]);
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
      treeModelMock.setup((x) => x.getNode(nodeToSelect.item.id)).returns(() => nodeToSelect).verifiable(moq.Times.once());

      modelMutator.replaceSelection([nodeToSelect.item]);
      treeModelMock.verifyAll();
      expect(selectedNode.isSelected).to.be.false;
      expect(nodeToSelect.isSelected).to.be.true;
    });

    it("tries to replace selection even if nodes were removed", () => {
      const nodes: MutableTreeModelNode[] = [];
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]()).verifiable(moq.Times.once());
      treeModelMock.setup((x) => x.getNode(nodeToSelect.item.id)).returns(() => undefined).verifiable(moq.Times.once());

      modelMutator.replaceSelection([nodeToSelect.item]);
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
        nodeItem: node.item,
        newState: CheckBoxState.On,
      };

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
      modelMutator.setCheckboxStates([checkboxStateChange]);
      treeModelMock.verifyAll();
      expect(node.checkbox.state).to.be.eq(checkboxStateChange.newState);
    });

    it("tries to set checkbox state even if node was removed", () => {
      const checkboxStateChange: CheckboxStateChange = {
        nodeItem: node.item,
        newState: CheckBoxState.On,
      };

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => undefined).verifiable(moq.Times.once());
      modelMutator.setCheckboxStates([checkboxStateChange]);
      treeModelMock.verifyAll();
    });

  });

  describe("activateEditor", () => {

    beforeEach(() => {
      node.isSelected = true;
      node.item.isEditable = true;
    });

    it("sets editing info for selected node", () => {
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
      modelMutator.activateEditing(node.id, () => { });
      treeModelMock.verifyAll();
      expect(node.editingInfo).to.not.be.undefined;
    });

    it("does not set editing info if node is not editable", () => {
      node.item.isEditable = false;
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node).verifiable(moq.Times.once());
      modelMutator.activateEditing(node.id, () => { });
      treeModelMock.verifyAll();
      expect(node.editingInfo).to.be.undefined;
    });

    it("tries to set editing info even if node was removed", () => {
      node.isSelected = false;

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => undefined).verifiable(moq.Times.once());
      modelMutator.activateEditing(node.id, () => { });
      treeModelMock.verifyAll();
    });

    describe("nodeEditingInfo callbacks", () => {
      let onNodeUpdatedSpy: sinon.SinonSpy;

      beforeEach(() => {
        onNodeUpdatedSpy = sinon.spy();
        treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);
        modelMutator.activateEditing(node.id, onNodeUpdatedSpy);
      });

      it("closes node editing", () => {
        node.editingInfo!.onCancel();
        expect(node.editingInfo).to.be.undefined;
      });

      it("closes editing and calls onNodeUpdated when changes are committed", () => {
        node.editingInfo!.onCommit(node, "newValue");
        expect(onNodeUpdatedSpy).to.be.calledOnceWith(node, "newValue");
        expect(node.editingInfo).to.be.undefined;
      });

    });

  });

});
