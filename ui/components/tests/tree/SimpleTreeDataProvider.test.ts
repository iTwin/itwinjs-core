/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import SimpleTreeDataProvider, { SimpleTreeDataProviderHierarchy } from "@src/tree/SimpleTreeDataProvider";
import { TreeNodeItem } from "@src/tree/TreeDataProvider";

describe.only("SimpleTreeDataProvider", () => {

  const createTreeNodeItem = (id: string, parentId?: string): TreeNodeItem => {
    return {
      id,
      parentId,
      label: "label",
      description: "description",
      hasChildren: false,
    };
  };

  const createHierarchy = (rootNodeCount: number, childrenNodeCount: number): SimpleTreeDataProviderHierarchy => {
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map();
    const rootNodes = [];
    for (let i = 0; i < rootNodeCount; i++) {
      rootNodes[i] = createTreeNodeItem(i.toString());
      const childrenNodes: TreeNodeItem[] = [];

      for (let x = 0; x < childrenNodeCount; x++)
        childrenNodes[x] = createTreeNodeItem(i.toString() + "-" + x.toString(), rootNodes[i].id);

      hierarchy.set(rootNodes[i].id, childrenNodes);
    }
    hierarchy.set(undefined, rootNodes);
    return hierarchy;
  };

  describe("getRootNodes", () => {
    let provider: SimpleTreeDataProvider;
    let allRootNodes: TreeNodeItem[];

    beforeEach(() => {
      const hierarchy = createHierarchy(3, 3);
      allRootNodes = hierarchy.get(undefined)!;
      expect(allRootNodes).to.not.be.undefined;

      provider = new SimpleTreeDataProvider(hierarchy);
    });

    it("returns all root nodes when pageOptions are undefined", async () => {
      const result = await provider.getRootNodes();
      expect(result).to.be.deep.equal(allRootNodes);
    });

    it("returns root nodes when page size is 0 and page start is 0", async () => {
      const result = await provider.getRootNodes({ start: 0, size: 0 });
      expect(result).to.be.deep.equal(allRootNodes);
    });

    it("returns root nodes when page size is 0 and page start is not 0", async () => {
      const result = await provider.getRootNodes({ start: 1, size: 0 });
      expect(result).to.be.deep.equal([allRootNodes[1], allRootNodes[2]]);
    });

    it("returns root nodes through several pages", async () => {
      let result = await provider.getRootNodes({ start: 0, size: 2 });
      expect(result).to.be.deep.equal([allRootNodes[0], allRootNodes[1]]);

      result = await provider.getRootNodes({ start: 2, size: 1 });
      expect(result).to.be.deep.equal([allRootNodes[2]]);
    });

    it("returns empty array if there are no root nodes", async () => {
      const providerWithNoRootNodes = new SimpleTreeDataProvider(new Map());
      const result = await providerWithNoRootNodes.getRootNodes();
      expect(result).to.be.empty;
    });

  });

  describe("getRootNodesCount", () => {

    it("returns root nodes count", async () => {
      const nodeCount = 5;
      const hierarchy = createHierarchy(nodeCount, 0);

      const provider = new SimpleTreeDataProvider(hierarchy);
      const result = await provider.getRootNodesCount();
      expect(result).to.be.equal(nodeCount);
    });

  });

  describe("getChildNodes", () => {
    let rootNode: TreeNodeItem;
    let childrenNodes: TreeNodeItem[];
    let provider: SimpleTreeDataProvider;
    beforeEach(() => {
      const hierarchy = createHierarchy(1, 3);
      const allRootNodes = hierarchy.get(undefined);
      expect(allRootNodes).to.not.be.undefined;
      rootNode = allRootNodes![0];
      childrenNodes = hierarchy.get(rootNode.id)!;
      expect(childrenNodes).to.not.be.undefined;

      provider = new SimpleTreeDataProvider(hierarchy);
    });

    it("returns all child nodes when pageOptions are undefined", async () => {
      const result = await provider.getChildNodes(rootNode);
      expect(result).to.be.deep.equal(childrenNodes);
    });

    it("returns child nodes when page size is 0 and page start is 0", async () => {
      const result = await provider.getChildNodes(rootNode, { size: 0, start: 0 });
      expect(result).to.be.deep.equal(childrenNodes);
    });

    it("returns child nodes when page size is 0 and page start is not 0", async () => {
      const result = await provider.getChildNodes(rootNode, { size: 0, start: 1 });
      expect(result).to.be.deep.equal([childrenNodes[1], childrenNodes[2]]);
    });

    it("returns child nodes through several pages", async () => {
      let result = await provider.getChildNodes(rootNode, { start: 0, size: 2 });
      expect(result).to.be.deep.equal([childrenNodes[0], childrenNodes[1]]);

      result = await provider.getChildNodes(rootNode, { start: 2, size: 1 });
      expect(result).to.be.deep.equal([childrenNodes[2]]);
    });

    it("returns empty array if parent node is not in hierarchy", async () => {
      const hierarchyNoChildren = createHierarchy(1, 0);
      const providerNoChildren = new SimpleTreeDataProvider(hierarchyNoChildren);
      const result = await providerNoChildren.getChildNodes(createTreeNodeItem("some id"));
      expect(result).to.be.empty;
    });

  });

  describe("getChildNodesCount", () => {

    it("returns child nodes count", async () => {
      const nodeCount = 5;
      const hierarchy = createHierarchy(1, nodeCount);

      const provider = new SimpleTreeDataProvider(hierarchy);
      const allRootNodes = hierarchy.get(undefined);
      const result = await provider.getChildNodesCount(allRootNodes![0]);
      expect(result).to.be.equal(nodeCount);
    });

  });

});
