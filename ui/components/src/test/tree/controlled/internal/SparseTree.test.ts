/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import { SparseTree, SparseArray, Node } from "../../../../ui-components/tree/controlled/internal/SparseTree";
import { createRandomMutableTreeModelNodes } from "../RandomTreeNodesHelpers";

describe("SparseTree", () => {

  let sparseTree: SparseTree<Node>;
  let rootNode: Node;

  beforeEach(() => {
    sparseTree = new SparseTree<Node>();
    rootNode = { id: faker.random.uuid() };
  });

  const verifyNodes = (actual: SparseArray<string>, expected: Node[]) => {
    const actualIds: string[] = [];
    for (const [item] of actual.iterateValues())
      actualIds.push(item);

    const expectedIds = expected.map((node) => node.id);
    expect(actualIds).to.deep.eq(expectedIds);
  };

  describe("getNode", () => {

    it("gets node", () => {
      const nodes = createRandomMutableTreeModelNodes();
      sparseTree.setChildren(undefined, nodes, 0);
      const result = sparseTree.getNode(nodes[0].id);
      expect(result).to.deep.eq(nodes[0]);
    });

  });

  describe("setChildren", () => {

    describe("setting root nodes", () => {
      const rootNodes = createRandomMutableTreeModelNodes();

      it("sets root nodes", () => {
        sparseTree.setChildren(undefined, rootNodes, 0);
        const result = sparseTree.getChildren(undefined)!;
        expect(result.getLength()).to.be.eq(rootNodes.length);
        verifyNodes(result, rootNodes);
      });

    });

    describe("setting child nodes", () => {

      let firstChildrenPage: Node[];
      let secondChildrenPage: Node[];

      beforeEach(() => {
        firstChildrenPage = createRandomMutableTreeModelNodes();
        secondChildrenPage = createRandomMutableTreeModelNodes();

        sparseTree.setChildren(undefined, [rootNode], 0);
      });

      it("sets child nodes", () => {
        sparseTree.setNumChildren(rootNode.id, firstChildrenPage.length);
        sparseTree.setChildren(rootNode.id, firstChildrenPage, 0);
        const result = sparseTree.getChildren(rootNode.id)!;
        expect(result.getLength()).to.be.eq(firstChildrenPage.length);
        verifyNodes(result, firstChildrenPage);
      });

      it("sets second array of child nodes", () => {
        sparseTree.setNumChildren(rootNode.id, firstChildrenPage.length);
        sparseTree.setChildren(rootNode.id, firstChildrenPage, 0);
        sparseTree.setChildren(rootNode.id, secondChildrenPage, firstChildrenPage.length);
        const result = sparseTree.getChildren(rootNode.id)!;
        expect(result.getLength()).to.be.eq(firstChildrenPage.length + secondChildrenPage.length);
        verifyNodes(result, [...firstChildrenPage, ...secondChildrenPage]);
      });

      it("overrides existing children", () => {
        sparseTree.setNumChildren(rootNode.id, firstChildrenPage.length);
        sparseTree.setChildren(rootNode.id, firstChildrenPage, 0);
        sparseTree.setChildren(rootNode.id, secondChildrenPage, 1);
        const result = sparseTree.getChildren(rootNode.id)!;
        const expectedChildren = [firstChildrenPage[0], ...secondChildrenPage];
        expect(result.getLength()).to.be.eq(expectedChildren.length);
        verifyNodes(result, expectedChildren);
      });

    });

  });

  describe("setNumChildren", () => {

    let count: number;

    beforeEach(() => {
      count = faker.random.number();
    });

    it("sets num for root nodes", () => {
      sparseTree.setNumChildren(undefined, count);
      const rootNodes = sparseTree.getChildren(undefined)!;
      expect(rootNodes.getLength()).to.be.eq(count);
    });

    it("sets count for children nodes", () => {
      sparseTree.setChildren(undefined, [rootNode], 0);
      sparseTree.setNumChildren(rootNode.id, count);
      const childNodes = sparseTree.getChildren(rootNode.id)!;
      expect(childNodes.getLength()).to.be.eq(count);
    });

    it("clears subtree when setting root node children count", () => {
      sparseTree.setChildren(undefined, [rootNode], 0);
      const childNodes = createRandomMutableTreeModelNodes();
      sparseTree.setChildren(rootNode.id, childNodes, 0);
      sparseTree.setNumChildren(undefined, count);
      const children = sparseTree.getChildren(rootNode.id);
      expect(children).to.be.undefined;
    });

  });

  describe("deleteSubtree", () => {

    beforeEach(() => {
      sparseTree.setChildren(undefined, [rootNode], 0);
    });

    it("deletes root nodes", () => {
      sparseTree.deleteSubtree(undefined);
      const rootNodes = sparseTree.getChildren(undefined)!;
      expect(rootNodes.getLength()).to.be.eq(0);
      verifyNodes(rootNodes, []);
    });

    it("deletes child nodes", () => {
      const childNodes = createRandomMutableTreeModelNodes();
      sparseTree.setChildren(rootNode.id, childNodes, 0);
      sparseTree.deleteSubtree(rootNode.id);
      const children = sparseTree.getChildren(rootNode.id);
      expect(children).to.be.undefined;
    });

    it("does not attempt to remove child subtrees if parent subtree is deleted", () => {
      sparseTree.deleteSubtree(rootNode.id);
      const spy = sinon.spy(sparseTree, "deleteSubtree");
      sparseTree.deleteSubtree(rootNode.id);
      const children = sparseTree.getChildren(rootNode.id);
      expect(children).to.be.undefined;
      expect(spy).to.be.calledOnce;
    });

  });

});

describe("SparseArray", () => {

  let sparseArray: SparseArray<number>;
  let testItems: Array<{ index: number, value: number }> = [];

  beforeEach(() => {
    sparseArray = new SparseArray<number>();
    testItems = [{ index: faker.random.number(5), value: faker.random.number() }, { index: faker.random.number({ min: 5, max: 10 }), value: faker.random.number() }];
  });

  describe("getLength", () => {

    it("gets length of empty array", () => {
      expect(sparseArray.getLength()).to.be.eq(0);
    });

    it("gets length of array with items", () => {
      sparseArray.set(0, 1);
      sparseArray.set(1, 2);
      expect(sparseArray.getLength()).to.be.eq(2);
    });

  });

  describe("setLength", () => {

    it("sets length", () => {
      const length = faker.random.number({ min: 1, max: 5 });
      sparseArray.setLength(length);
      expect(sparseArray.getLength()).to.be.eq(length);
    });

  });

  describe("get", () => {

    it("gets undefined if value is not set", () => {
      expect(sparseArray.get(faker.random.number())).to.be.undefined;
    });

    it("gets values for specific index", () => {
      sparseArray.set(testItems[0].index, testItems[0].value);

      const item = sparseArray.get(testItems[0].index);
      expect(item).to.not.be.undefined;
    });

  });

  describe("set", () => {

    it("sets value at specific index", () => {
      sparseArray.set(testItems[0].index, testItems[0].value);
      const item = sparseArray.get(testItems[0].index);
      expect(item).to.be.eq(testItems[0].value);
    });

    it("sets new value for same index", () => {
      sparseArray.set(testItems[0].index, testItems[0].value);
      const newValue = faker.random.number();
      sparseArray.set(testItems[0].index, newValue);
      const item = sparseArray.get(testItems[0].index);
      expect(item).to.be.eq(newValue);
    });

  });

  describe("iterateValues", () => {

    it("iterates through existing values", () => {
      testItems.forEach((item) => sparseArray.set(item.index, item.value));
      for (const [value, index] of sparseArray.iterateValues()) {
        const expectedItem = testItems.find((item) => item.index === index);
        expect(expectedItem).to.not.be.undefined;
        expect(value).to.be.eq(expectedItem!.value);
      }
    });

  });

  describe("indexer", () => {

    it("iterates over all values", () => {
      const firstItem = testItems[0];
      sparseArray.set(firstItem.index, firstItem.value);

      const secondItem = testItems[1];
      sparseArray.set(secondItem.index, secondItem.value);

      sparseArray.setLength(secondItem.index + faker.random.number(5));

      let current = 0;
      for (const item of sparseArray) {
        if (current === firstItem.index)
          expect(item).to.be.eq(firstItem.value);
        else if (current === secondItem.index)
          expect(item).to.be.eq(secondItem.value);
        else
          expect(item).to.be.undefined;

        current++;
      }
    });

  });

});
