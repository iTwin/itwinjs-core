/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as faker from "faker";
import { CheckBoxState } from "@bentley/ui-core";
import {
  MutableTreeModel, MutableTreeModelNode, isTreeModelNodePlaceholder,
  TreeModelNodeInput, TreeModelRootNode, TreeModelNode, isTreeModelNode, TreeModelNodePlaceholder, isTreeModelRootNode,
} from "../../../ui-components/tree/controlled/TreeModel";
import { SparseTree, SparseArray } from "../../../ui-components/tree/controlled/internal/SparseTree";
import { createRandomMutableTreeModelNode } from "./RandomTreeNodesHelpers";

const createTreeModelNode = (parentNode: TreeModelNode | TreeModelRootNode, input: TreeModelNodeInput): MutableTreeModelNode => {
  return {
    id: input.id,
    parentId: parentNode.id,
    depth: parentNode.depth + 1,

    isLoading: input.isLoading,
    numChildren: input.numChildren,

    description: input.description || "",
    isExpanded: input.isExpanded,
    label: input.label,
    isSelected: input.isSelected,

    checkbox: {
      state: input.item.checkBoxState || CheckBoxState.Off,
      isDisabled: !!input.item.isCheckboxDisabled,
      isVisible: !!input.item.isCheckboxVisible,
    },

    item: input.item,
  };
};

describe("MutableTreeModel", () => {

  let treeModel: MutableTreeModel;
  const treeMock = moq.Mock.ofType<SparseTree<MutableTreeModelNode>>();
  const sparseArrayMock = moq.Mock.ofType<SparseArray<string>>();

  let rootNode: MutableTreeModelNode;
  let childNode: MutableTreeModelNode;
  let rootNodesArray: SparseArray<string>;
  let childNodesArray: SparseArray<string>;

  beforeEach(() => {
    treeMock.reset();
    sparseArrayMock.reset();
    treeModel = new MutableTreeModel();
    (treeModel as any)._tree = treeMock.object;

    rootNode = createRandomMutableTreeModelNode();
    childNode = createRandomMutableTreeModelNode(rootNode.id);
    rootNodesArray = new SparseArray<string>();
    rootNodesArray.set(0, rootNode.id);
    childNodesArray = new SparseArray<string>();
    childNodesArray.set(0, childNode.id);
  });

  describe("getRootNode", () => {

    it("returns empty root node", () => {
      const node = treeModel.getRootNode();
      expect(node).to.not.be.undefined;
      expect(node.depth).to.be.eq(-1);
      expect(node.numChildren).to.be.undefined;
      expect(node.id).to.be.undefined;
    });

  });

  describe("getNode", () => {

    it("returns root node", () => {
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      const node = treeModel.getNode(rootNode.id);
      treeMock.verifyAll();
      expect(node).to.deep.eq(rootNode);
    });

    it("returns child node", () => {
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => childNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(childNode.id)).returns(() => childNode).verifiable(moq.Times.once());
      const node = treeModel.getNode(rootNode.id, 0);
      treeMock.verifyAll();
      expect(node).to.deep.eq(childNode);
    });

    it("returns placeholder child node", () => {
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      const node = treeModel.getNode(rootNode.id, 1);
      treeMock.verifyAll();
      expect(isTreeModelNodePlaceholder(node)).to.be.true;
    });

    it("returns placeholder root node", () => {
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => new SparseArray<string>()).verifiable(moq.Times.once());
      const node = treeModel.getNode(undefined, 0);
      treeMock.verifyAll();
      expect(isTreeModelNodePlaceholder(node)).to.be.true;
    });

    it("returns undefined if node cannot be found", () => {
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => new SparseArray<string>()).verifiable(moq.Times.once());
      const node = treeModel.getNode(rootNode.id, 0);
      treeMock.verifyAll();
      expect(node).to.be.undefined;
    });

  });

  describe("getChildren", () => {

    it("call tree for children", () => {
      const parentId = faker.random.uuid();
      treeMock.setup((x) => x.getChildren(parentId)).verifiable(moq.Times.once());
      treeModel.getChildren(parentId);
      treeMock.verifyAll();
    });

  });

  describe("setChildren", () => {

    it("sets root nodes", () => {
      treeMock.setup((x) => x.setChildren(undefined, [createTreeModelNode(treeModel.getRootNode(), rootNode)], 0)).verifiable(moq.Times.once());
      treeModel.setChildren(undefined, [rootNode], 0);
      treeMock.verifyAll();
    });

    it("sets children for root node", () => {
      const children = [childNode];
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setChildren(rootNode.id, [createTreeModelNode(rootNode, childNode)], 0)).verifiable(moq.Times.once());
      treeModel.setChildren(rootNode.id, children, 0);
      treeMock.verifyAll();
    });

    it("sets children from TreeModelNodeInput", () => {
      const input: TreeModelNodeInput = {
        id: faker.random.uuid(),
        isExpanded: faker.random.boolean(),
        label: faker.random.word(),
        isLoading: faker.random.boolean(),
        isSelected: faker.random.boolean(),
        item: { id: faker.random.uuid(), label: faker.random.word() },
      };

      treeMock.setup((x) => x.setChildren(undefined, [createTreeModelNode(treeModel.getRootNode(), input)], 0)).verifiable(moq.Times.once());
      treeModel.setChildren(undefined, [input], 0);
      treeMock.verifyAll();
    });

    it("does not set children if parent does not exist", () => {
      const children = [childNode];
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setChildren(rootNode.id, [createTreeModelNode(rootNode, childNode)], 0)).verifiable(moq.Times.never());
      treeModel.setChildren(rootNode.id, children, 0);
      treeMock.verifyAll();
    });

  });

  describe("setNumChildren", () => {

    const count = faker.random.number();

    it("sets root nodes count", () => {
      treeMock.setup((x) => x.setNumChildren(undefined, count)).verifiable(moq.Times.once());
      treeModel.setNumChildren(undefined, count);
      treeMock.verifyAll();
    });

    it("sets root node children count", () => {
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setNumChildren(rootNode.id, count)).verifiable(moq.Times.once());
      treeModel.setNumChildren(rootNode.id, count);
      treeMock.verifyAll();
    });

    it("sets children count for removed root node", () => {
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setNumChildren(rootNode.id, count)).verifiable(moq.Times.once());
      treeModel.setNumChildren(rootNode.id, count);
      treeMock.verifyAll();
    });

  });

  describe("clearChildren", () => {

    it("clears root nodes", () => {
      treeMock.setup((x) => x.setNumChildren(undefined, 0)).verifiable(moq.Times.once());
      treeModel.clearChildren(undefined);
      treeMock.verifyAll();
    });

    it("clears root node children", () => {
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setNumChildren(rootNode.id, 0)).verifiable(moq.Times.once());
      treeModel.clearChildren(rootNode.id);
      treeMock.verifyAll();
    });

    it("clears children for removed root node", () => {
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => undefined).verifiable(moq.Times.once());
      treeMock.setup((x) => x.setNumChildren(rootNode.id, 0)).verifiable(moq.Times.once());
      treeModel.clearChildren(rootNode.id);
      treeMock.verifyAll();
    });

  });

  describe("computeVisibleNodes", () => {

    describe("visible nodes callbacks", () => {

      beforeEach(() => {
        treeMock.reset();
        treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode);
        treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray);
        rootNode = { ...rootNode, isExpanded: false };
      });

      it("getNumNodes", () => {
        const visibleNodes = treeModel.computeVisibleNodes();
        expect(visibleNodes.getNumNodes()).to.be.eq(1);
      });

      it("getAtIndex with number index", () => {
        const visibleNodes = treeModel.computeVisibleNodes();
        expect(visibleNodes.getAtIndex(0)).to.deep.eq(rootNode);
      });

      it("getAtIndex with string index", () => {
        const visibleNodes = treeModel.computeVisibleNodes();
        // @ts-ignore
        expect(visibleNodes.getAtIndex(rootNode.id)).to.deep.eq(rootNode);
      });

      it("getModel", () => {
        const visibleNodes = treeModel.computeVisibleNodes();
        expect(visibleNodes.getModel()).to.deep.eq(treeModel);
      });

      it("getNumRootNodes", () => {
        treeModel.setNumChildren(undefined, 5);
        const visibleNodes = treeModel.computeVisibleNodes();
        expect(visibleNodes.getNumRootNodes()).to.eq(5);
      });

      it("iterator", () => {
        const visibleNodes = treeModel.computeVisibleNodes();
        for (const node of visibleNodes)
          expect(node).to.deep.eq(rootNode);
      });

    });

    it("returns visible collapsed root node", () => {
      rootNode = { ...rootNode, isExpanded: false };
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();

      expect(result.getNumNodes()).to.be.eq(1);
      const visibleNode = result.getAtIndex(0);
      expect((visibleNode as TreeModelNode).id).to.be.eq(rootNode.id);
      expect(result.getModel()).to.be.eq(treeModel);
    });

    it("returns visible expanded root node without children", () => {
      rootNode = { ...rootNode, isExpanded: true };
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => new SparseArray<string>()).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();
      expect(result.getNumNodes()).to.be.eq(1);
    });

    it("returns visible expanded root node and child node", () => {
      rootNode = { ...rootNode, isExpanded: true, numChildren: 1 };
      childNode = { ...childNode, isExpanded: false };
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => childNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(childNode.id)).returns(() => childNode).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();
      expect(result.getNumNodes()).to.be.eq(2);
    });

    it("returns visible expanded root node and placeholder child node if child node was disposed", () => {
      rootNode = { ...rootNode, isExpanded: true, numChildren: 1 };
      childNode = { ...childNode, isExpanded: false };
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => childNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(childNode.id)).returns(() => undefined).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();
      expect(result.getNumNodes()).to.be.eq(2);
      expect(isTreeModelNode(result.getAtIndex(0))).to.be.true;
      expect(isTreeModelNodePlaceholder(result.getAtIndex(1))).to.be.true;
    });

    it("returns visible placeholder node", () => {
      const placeholderNodesArray = new SparseArray<string>();
      placeholderNodesArray.setLength(1);
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => placeholderNodesArray).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();
      expect(result.getNumNodes()).to.be.eq(1);
      expect(isTreeModelNodePlaceholder(result.getAtIndex(0))).to.be.true;
    });

    it("returns only root node if children does not exist", () => {
      rootNode = { ...rootNode, isExpanded: true, numChildren: 1 };
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => undefined!).verifiable(moq.Times.once());

      const result = treeModel.computeVisibleNodes();
      treeMock.verifyAll();
      expect(result.getNumNodes()).to.be.eq(1);
      expect(result.getAtIndex(0)).to.be.deep.eq(rootNode);
    });

  });

  describe("iterateTreeModelNodes", () => {

    it("iterates nodes", () => {
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => rootNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(rootNode.id)).returns(() => childNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(childNode.id)).returns(() => childNode).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getChildren(childNode.id)).returns(() => undefined).verifiable(moq.Times.once());

      let index = 0;
      const expectedNodes = [rootNode, childNode];
      for (const node of treeModel.iterateTreeModelNodes()) {
        expect(node).to.deep.eq(expectedNodes[index]);
        index++;
      }
      treeMock.verifyAll();
    });

    it("tries to iterate over removed node", () => {
      treeMock.setup((x) => x.getChildren(undefined)).returns(() => rootNodesArray).verifiable(moq.Times.once());
      treeMock.setup((x) => x.getNode(rootNode.id)).returns(() => undefined).verifiable(moq.Times.once());
      let index = 0;
      for (const _ of treeModel.iterateTreeModelNodes()) {
        index++;
      }
      expect(index).to.be.eq(0);
    });

  });

});

describe("isTreeModelNode", () => {

  it("returns true for TreeModelNode", () => {
    const node: TreeModelNode = createRandomMutableTreeModelNode();
    expect(isTreeModelNode(node)).to.be.true;
  });

  it("returns false for TreeModelNodePlaceholder", () => {
    const node: TreeModelNodePlaceholder = { depth: 0, childIndex: 0 };
    expect(isTreeModelNode(node)).to.be.false;
  });

  it("returns false for TreeModelRootNode", () => {
    const node: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };
    expect(isTreeModelNode(node)).to.be.false;
  });

});

describe("isTreeModelRootNode", () => {

  it("returns true for TreeModelRootNode", () => {
    const node: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };
    expect(isTreeModelRootNode(node)).to.be.true;
  });

  it("returns false for TreeModelNode", () => {
    const node: TreeModelNode = createRandomMutableTreeModelNode();
    expect(isTreeModelRootNode(node)).to.be.false;
  });

  it("returns false for TreeModelNodePlaceholder", () => {
    const node: TreeModelNodePlaceholder = { depth: 0, childIndex: 0 };
    expect(isTreeModelRootNode(node)).to.be.false;
  });

});
