/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { LabelDefinition, NodePathElement } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey, createRandomNodePathElement } from "@itwin/presentation-common/lib/cjs/test";
import { PageOptions } from "@itwin/components-react";
import { FilteredPresentationTreeDataProvider } from "../../presentation-components/tree/FilteredDataProvider";
import { IPresentationTreeDataProvider } from "../../presentation-components/tree/IPresentationTreeDataProvider";
import { createTreeNodeItem } from "../../presentation-components/tree/Utils";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";

describe("FilteredTreeDataProvider", () => {

  function createPaths() {
    /*
    A-1
      A-1-1
    A-2
      A-2-1
      A-2-2
        A-2-2-1
    */
    const nodePaths: NodePathElement[] = [];

    nodePaths[0] = createRandomNodePathElement();
    nodePaths[0].node.label = LabelDefinition.fromLabelString("A-1");

    nodePaths[1] = createRandomNodePathElement();
    nodePaths[1].node.label = LabelDefinition.fromLabelString("A-2");

    nodePaths[0].children = [];
    nodePaths[0].children[0] = createRandomNodePathElement();
    nodePaths[0].children[0].node.label = LabelDefinition.fromLabelString("A-1-1");

    nodePaths[1].children = [];
    nodePaths[1].children[0] = createRandomNodePathElement();
    nodePaths[1].children[0].node.label = LabelDefinition.fromLabelString("A-2-1");

    nodePaths[1].children[1] = createRandomNodePathElement();
    nodePaths[1].children[1].node.label = LabelDefinition.fromLabelString("A-2-2");

    nodePaths[1].children[1].children = [];
    nodePaths[1].children[1].children[0] = createRandomNodePathElement();
    nodePaths[1].children[1].children[0].node.label = LabelDefinition.fromLabelString("A-2-2-1");
    return nodePaths;
  }

  let provider: FilteredPresentationTreeDataProvider;
  let filter: string;
  let paths: NodePathElement[];
  const parentProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const pageOptions: PageOptions = { size: 0, start: 0 };

  beforeEach(() => {
    parentProviderMock.reset();
    filter = faker.random.word();
    paths = createPaths();
    provider = new FilteredPresentationTreeDataProvider({
      parentDataProvider: parentProviderMock.object,
      filter,
      paths,
    });
  });

  describe("filter", () => {

    it("returns filter with which it was initialized", () => {
      expect(provider.filter).to.be.equal(filter);
    });

  });

  describe("rulesetId", () => {

    it("returns rulesetId of the parent data provider", () => {
      const expectedRulesetId = faker.random.word();
      parentProviderMock.setup((x) => x.rulesetId)
        .returns(() => expectedRulesetId)
        .verifiable();
      expect(provider.rulesetId).to.eq(expectedRulesetId);
      parentProviderMock.verifyAll();
    });

  });

  describe("imodel", () => {

    it("returns imodel of the parent data provider", () => {
      parentProviderMock.setup((x) => x.imodel)
        .returns(() => imodelMock.object)
        .verifiable();
      expect(provider.imodel).to.eq(imodelMock.object);
      parentProviderMock.verifyAll();
    });

  });

  describe("parentDataProvider", () => {

    it("returns parent data provider", () => {
      expect(provider.parentDataProvider).to.eq(parentProviderMock.object);
    });

  });

  describe("getNodes", () => {

    it("returns root nodes", async () => {
      const result = await provider.getNodes(undefined, pageOptions);
      expect(result).to.matchSnapshot();
    });

    it("returns child nodes", async () => {
      const parentNode = createTreeNodeItem(paths[1].node);

      const result = await provider.getNodes(parentNode, pageOptions);
      expect(result).to.matchSnapshot();
    });

  });

  describe("getNodesCount", () => {

    it("returns root nodes count", async () => {
      const result = await provider.getNodesCount();
      expect(result).to.equal(paths.length);
    });

    it("returns child nodes count", async () => {
      const parentNode = createTreeNodeItem(paths[1].node);

      const result = await provider.getNodesCount(parentNode);
      expect(result).to.equal(paths[1].children.length);
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls parent data provider", async () => {
      parentProviderMock.setup(async (x) => x.getFilteredNodePaths(filter))
        .returns(async () => paths)
        .verifiable();

      const result = await provider.getFilteredNodePaths(filter);
      expect(result).to.equal(paths);
      parentProviderMock.verifyAll();
    });

  });

  describe("getNodeKey", () => {

    it("returns node key", () => {
      const key = createRandomECInstancesNodeKey();
      const treeNode = createRandomTreeNodeItem(key);

      parentProviderMock.setup((x) => x.getNodeKey(treeNode)).returns(() => key);
      const result = provider.getNodeKey(treeNode);
      expect(result).to.deep.equal(key);
    });

  });

  const constantFilter = "test";
  const filteredNodePaths: NodePathElement[] = [];

  filteredNodePaths[0] = createRandomNodePathElement();
  filteredNodePaths[0].node.label = LabelDefinition.fromLabelString("A-1");
  filteredNodePaths[0].filteringData = { matchesCount: 0, childMatchesCount: 1 };

  filteredNodePaths[0].children = [];
  filteredNodePaths[0].children[0] = createRandomNodePathElement();
  filteredNodePaths[0].children[0].node.label = LabelDefinition.fromLabelString("A-1-1 test");
  filteredNodePaths[0].children[0].filteringData = { matchesCount: 1, childMatchesCount: 0 };

  filteredNodePaths[1] = createRandomNodePathElement();
  filteredNodePaths[1].node.label = LabelDefinition.fromLabelString("A-2 test");
  filteredNodePaths[1].filteringData = { matchesCount: 1, childMatchesCount: 0 };

  filteredNodePaths[1].children = [];
  filteredNodePaths[1].children[0] = createRandomNodePathElement();
  filteredNodePaths[1].children[0].node.label = LabelDefinition.fromLabelString("A-2-1");
  filteredNodePaths[1].children[0].filteringData = { matchesCount: 0, childMatchesCount: 0 };

  filteredNodePaths[1].children[1] = createRandomNodePathElement();
  filteredNodePaths[1].children[1].node.label = LabelDefinition.fromLabelString("A-2-2");
  filteredNodePaths[1].children[1].filteringData = { matchesCount: 0, childMatchesCount: 0 };

  describe("countFilteringResults", () => {
    it("all matches get counted", () => {
      expect(provider.countFilteringResults(filteredNodePaths)).to.be.eq(2);
    });

    it("doesn't count if node paths don't have filtering data", () => {
      paths = [];
      paths[0] = createRandomNodePathElement();
      paths[0].node.label = LabelDefinition.fromLabelString("A-1");
      paths[0].filteringData = undefined;
      expect(provider.countFilteringResults(paths)).to.eq(0);
    });
  });

  describe("getActiveMatch", () => {
    it("returns correct match", () => {
      provider = new FilteredPresentationTreeDataProvider({
        parentDataProvider: parentProviderMock.object,
        filter: constantFilter,
        paths: filteredNodePaths,
      });
      const result = provider.getActiveMatch(2);

      expect(result).to.not.be.undefined;
      expect(result!.nodeId).to.be.eq(createTreeNodeItem(filteredNodePaths[1].node).id);
      expect(result!.matchIndex).to.be.eq(0);
    });

    it("returns undefined when index is 0 or lower", () => {
      provider = new FilteredPresentationTreeDataProvider({
        parentDataProvider: parentProviderMock.object,
        filter: constantFilter,
        paths: filteredNodePaths,
      });
      const result = provider.getActiveMatch(0);
      expect(result).to.be.undefined;
    });
  });

  describe("nodeMatchesFilter", () => {
    it("returns true when node matches filter", () => {
      provider = new FilteredPresentationTreeDataProvider({
        parentDataProvider: parentProviderMock.object,
        filter: constantFilter,
        paths: filteredNodePaths,
      });
      const node = createTreeNodeItem(filteredNodePaths[1].node);
      expect(provider.nodeMatchesFilter(node)).to.be.true;
    });

    it("returns false when node matches filter", () => {
      provider = new FilteredPresentationTreeDataProvider({
        parentDataProvider: parentProviderMock.object,
        filter: constantFilter,
        paths: filteredNodePaths,
      });
      const node = createTreeNodeItem(filteredNodePaths[0].node);
      expect(provider.nodeMatchesFilter(node)).to.be.false;
    });
  });
});
