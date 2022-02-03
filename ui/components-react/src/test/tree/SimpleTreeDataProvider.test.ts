/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { SimpleTreeDataProviderHierarchy } from "../../components-react/tree/SimpleTreeDataProvider";
import { SimpleTreeDataProvider } from "../../components-react/tree/SimpleTreeDataProvider";
import type { DelayLoadedTreeNodeItem } from "../../components-react/tree/TreeDataProvider";

describe("SimpleTreeDataProvider", () => {

  const createTreeNodeItem = (id: string, hasChildren: boolean, parentId?: string): DelayLoadedTreeNodeItem => {
    return {
      id,
      parentId,
      label: PropertyRecord.fromString("label", "label"),
      hasChildren,
    };
  };

  const createHierarchy = (rootNodeCount: number, childrenNodeCount: number): SimpleTreeDataProviderHierarchy => {
    const hierarchy: SimpleTreeDataProviderHierarchy = new Map();
    const rootNodes = [];
    for (let i = 0; i < rootNodeCount; i++) {
      rootNodes[i] = createTreeNodeItem(i.toString(), true);
      const nodes: DelayLoadedTreeNodeItem[] = [];

      for (let x = 0; x < childrenNodeCount; x++)
        nodes[x] = createTreeNodeItem(`${i.toString()}-${x.toString()}`, false, rootNodes[i].id);

      hierarchy.set(rootNodes[i].id, nodes);
    }
    hierarchy.set(undefined, rootNodes);
    return hierarchy;
  };

  describe("getNodesCount", () => {

    it("returns root nodes count", async () => {
      const nodeCount = 5;
      const hierarchy = createHierarchy(nodeCount, 0);

      const provider = new SimpleTreeDataProvider(hierarchy);
      const result = await provider.getNodesCount();
      expect(result).to.be.equal(nodeCount);
    });

    it("returns child nodes count", async () => {
      const nodeCount = 5;
      const hierarchy = createHierarchy(1, nodeCount);

      const provider = new SimpleTreeDataProvider(hierarchy);
      const nodes = hierarchy.get(undefined);
      const result = await provider.getNodesCount(nodes![0]);
      expect(result).to.be.equal(nodeCount);
    });

  });

  describe("getNodes", () => {
    let provider: SimpleTreeDataProvider;
    let nodes: DelayLoadedTreeNodeItem[];

    describe("root", () => {

      beforeEach(() => {
        const hierarchy = createHierarchy(3, 3);
        nodes = hierarchy.get(undefined)!;
        expect(nodes).to.not.be.undefined;
        provider = new SimpleTreeDataProvider(hierarchy);
      });

      it("returns all root nodes when pageOptions are undefined", async () => {
        const result = await provider.getNodes(undefined);
        expect(result).to.be.deep.equal(nodes);
      });

      it("returns root nodes when page size is 0 and page start is 0", async () => {
        const result = await provider.getNodes(undefined, { start: 0, size: 0 });
        expect(result).to.be.deep.equal(nodes);
      });

      it("returns root nodes when page size is 0 and page start is not 0", async () => {
        const result = await provider.getNodes(undefined, { start: 1, size: 0 });
        expect(result).to.be.deep.equal([nodes[1], nodes[2]]);
      });

      it("returns root nodes through several pages", async () => {
        let result = await provider.getNodes(undefined, { start: 0, size: 2 });
        expect(result).to.be.deep.equal([nodes[0], nodes[1]]);

        result = await provider.getNodes(undefined, { start: 2, size: 1 });
        expect(result).to.be.deep.equal([nodes[2]]);
      });

      it("returns empty array if there are no root nodes", async () => {
        const providerWithNoRootNodes = new SimpleTreeDataProvider(new Map());
        const result = await providerWithNoRootNodes.getNodes(undefined);
        expect(result).to.be.empty;
      });

    });

    describe("children", () => {

      let rootNode: DelayLoadedTreeNodeItem;

      beforeEach(() => {
        const hierarchy = createHierarchy(1, 3);
        const rootNodes = hierarchy.get(undefined);
        expect(rootNodes).to.not.be.undefined;
        rootNode = rootNodes![0];
        nodes = hierarchy.get(rootNode.id)!;
        expect(nodes).to.not.be.undefined;
        provider = new SimpleTreeDataProvider(hierarchy);
      });

      it("returns all child nodes when pageOptions are undefined", async () => {
        const result = await provider.getNodes(rootNode);
        expect(result).to.be.deep.equal(nodes);
      });

      it("returns child nodes when page size is 0 and page start is 0", async () => {
        const result = await provider.getNodes(rootNode, { size: 0, start: 0 });
        expect(result).to.be.deep.equal(nodes);
      });

      it("returns child nodes when page size is 0 and page start is not 0", async () => {
        const result = await provider.getNodes(rootNode, { size: 0, start: 1 });
        expect(result).to.be.deep.equal([nodes[1], nodes[2]]);
      });

      it("returns child nodes through several pages", async () => {
        let result = await provider.getNodes(rootNode, { start: 0, size: 2 });
        expect(result).to.be.deep.equal([nodes[0], nodes[1]]);

        result = await provider.getNodes(rootNode, { start: 2, size: 1 });
        expect(result).to.be.deep.equal([nodes[2]]);
      });

      it("returns empty array if parent node is not in hierarchy", async () => {
        const hierarchyNoChildren = createHierarchy(1, 0);
        const providerNoChildren = new SimpleTreeDataProvider(hierarchyNoChildren);
        const result = await providerNoChildren.getNodes(createTreeNodeItem("some id", false));
        expect(result).to.be.empty;
      });

    });

  });

});
