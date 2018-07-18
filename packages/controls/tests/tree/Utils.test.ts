/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { createRandomECInstanceNode } from "@helpers/random";
import "@helpers/Snapshots";
import { createTreeNodeItem, createTreeNodeItems, pageOptionsUiToPresentation } from "@src/tree/Utils";
import { PageOptions } from "@bentley/ui-components";

describe("Utils", () => {

  describe("createTreeNodeItem", () => {

    it("creates tree node", () => {
      const node = createRandomECInstanceNode();
      const treeNode = createTreeNodeItem(node);
      expect(treeNode).to.matchSnapshot();
    });

    it("creates tree node with parent id", () => {
      const node = createRandomECInstanceNode();
      const parentId = faker.random.word();
      const treeNode = createTreeNodeItem(node, parentId);
      expect(treeNode).to.matchSnapshot();
    });

  });

  describe("createTreeNodeItems", () => {
    it("creates tree nodes", () => {
      const nodes = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const treeNode = createTreeNodeItems(nodes);
      expect(treeNode).to.matchSnapshot();
    });

    it("creates tree nodes with parentId", () => {
      const nodes = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const parentId = faker.random.word();
      const treeNode = createTreeNodeItems(nodes, parentId);
      expect(treeNode).to.matchSnapshot();
    });

  });

  describe("pageOptionsUiToPresentation", () => {
    it("returns undefined if passed undefined parameter", () => {
      const result = pageOptionsUiToPresentation(undefined);
      expect(result).to.be.equal(undefined);
    });

    it("converts ui page options to presentation page options", () => {
      const size = faker.random.number();
      const start = faker.random.number();
      const pageOptions: PageOptions = { size, start };
      const result = pageOptionsUiToPresentation(pageOptions);

      expect(result).to.not.be.undefined;
      expect(result!.size).to.be.equal(size);
      expect(result!.start).to.be.equal(start);
    });

  });

});
