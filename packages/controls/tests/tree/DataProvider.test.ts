/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { PromiseContainer } from "@helpers/Promises";
import * as faker from "faker";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "@helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { PageOptions } from "@bentley/ui-components";
import { ECPresentationManager, ECPresentation } from "@bentley/ecpresentation-frontend";
import { TreeNodeItem } from "@bentley/ui-components";
import ECPresentationTreeDataProvider from "@src/tree/DataProvider";
import "@helpers/Snapshots";
import { pageOptionsUiToPresentation } from "@src/tree/Utils";

describe("TreeDataProvider", () => {

  let rulesetId: string;
  let provider: ECPresentationTreeDataProvider;
  const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    rulesetId = faker.random.word();
    ECPresentation.presentation = presentationManagerMock.object;
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new ECPresentationTreeDataProvider(imodelMock.object, rulesetId);
  });

  const createRequestOptions = () => ({
    RulesetId: rulesetId,
  });

  const createTreeNodeItem = (key?: NodeKey, parentId?: string): TreeNodeItem => ({
    id: faker.random.uuid(),
    parentId,
    label: faker.random.word(),
    description: faker.random.words(),
    hasChildren: faker.random.boolean(),
    extendedData: { key: key || createRandomECInstanceNodeKey() },
  });

  describe("rulesetId", () => {

    it("returns rulesetId provider is initialized with", () => {
      expect(provider.rulesetId).to.eq(rulesetId);
    });

  });

  describe("connection", () => {

    it("returns connection provider is initialized with", () => {
      expect(provider.connection).to.eq(imodelMock.object);
    });

  });

  describe("getRootNodesCount", () => {

    it("returns presentation manager result", async () => {
      const result = faker.random.number();
      presentationManagerMock
        .setup((x) => x.getRootNodesCount(imodelMock.object, createRequestOptions()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await provider.getRootNodesCount();
      expect(actualResult).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const resultContainers = [new PromiseContainer<number>(), new PromiseContainer<number>()];
      presentationManagerMock
        .setup((x) => x.getRootNodesCount(imodelMock.object, createRequestOptions()))
        .returns(() => resultContainers[0].promise);
      presentationManagerMock
        .setup((x) => x.getRootNodesCount(imodelMock.object, createRequestOptions()))
        .returns(() => resultContainers[1].promise);
      const promises = [provider.getRootNodesCount(), provider.getRootNodesCount()];
      resultContainers.forEach((c: PromiseContainer<number>, index: number) => c.resolve(index));
      const results = await Promise.all(promises);
      expect(results[1]).to.eq(results[0]).to.eq(0);
      presentationManagerMock.verify((x) => x.getRootNodesCount(moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

  });

  describe("getRootNodes", () => {

    it("returns presentation manager result", async () => {
      const pageOptions: PageOptions = { start: faker.random.number(), size: faker.random.number() };
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      presentationManagerMock
        .setup((x) => x.getRootNodes(imodelMock.object, pageOptionsUiToPresentation(pageOptions), createRequestOptions()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await provider.getRootNodes(pageOptions);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const resultContainers = [new PromiseContainer<Node[]>(), new PromiseContainer<Node[]>(), new PromiseContainer<Node[]>()];
      presentationManagerMock
        .setup((x) => x.getRootNodes(imodelMock.object, undefined, createRequestOptions()))
        .returns(() => resultContainers[0].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup((x) => x.getRootNodes(imodelMock.object, { pageStart: 0, pageSize: 0 }, createRequestOptions()))
        .verifiable(moq.Times.never());
      presentationManagerMock
        .setup((x) => x.getRootNodes(imodelMock.object, { pageStart: 1, pageSize: 0 }, createRequestOptions()))
        .returns(() => resultContainers[1].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup((x) => x.getRootNodes(imodelMock.object, { pageStart: 0, pageSize: 1 }, createRequestOptions()))
        .returns(() => resultContainers[2].promise)
        .verifiable(moq.Times.once());

      const promises = [
        provider.getRootNodes(undefined), provider.getRootNodes(undefined),
        provider.getRootNodes({ start: 0, size: 0 }), provider.getRootNodes({ start: 0, size: 0 }),
        provider.getRootNodes({ start: 1, size: 0 }), provider.getRootNodes({ start: 1, size: 0 }),
        provider.getRootNodes({ start: 0, size: 1 }), provider.getRootNodes({ start: 0, size: 1 }),
      ];
      resultContainers.forEach((c: PromiseContainer<Node[]>) => c.resolve([createRandomECInstanceNode()]));
      const results = await Promise.all(promises);

      expect(results[0]).to.eq(results[1], "results[0] should eq results[1]");
      expect(results[2])
        .to.eq(results[3], "results[2] should eq results[3]")
        .to.eq(results[0], "both results[2] and results[3] should eq results[0]");
      expect(results[4]).to.eq(results[5], "results[4] should eq results[5]");
      expect(results[6]).to.eq(results[7], "results[6] should eq results[7]");

      presentationManagerMock.verifyAll();
    });

  });

  describe("getChildNodesCount", () => {

    it("returns presentation manager result", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      const parentNode = createTreeNodeItem(parentKey);
      const result = faker.random.number();
      presentationManagerMock
        .setup((x) => x.getChildrenCount(imodelMock.object, parentKey, createRequestOptions()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await provider.getChildNodesCount(parentNode);
      expect(actualResult).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const parentKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const parentNodes = parentKeys.map((key) => createTreeNodeItem(key));
      const resultContainers = [new PromiseContainer<number>(), new PromiseContainer<number>()];

      presentationManagerMock
        .setup((x) => x.getChildrenCount(imodelMock.object, parentKeys[0], createRequestOptions()))
        .returns(() => resultContainers[0].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup((x) => x.getChildrenCount(imodelMock.object, parentKeys[1], createRequestOptions()))
        .returns(() => resultContainers[1].promise)
        .verifiable(moq.Times.once());

      const promises = [
        provider.getChildNodesCount(parentNodes[0]),
        provider.getChildNodesCount(parentNodes[1]),
        provider.getChildNodesCount(parentNodes[0]),
      ];
      resultContainers.forEach((c: PromiseContainer<number>, index: number) => c.resolve(index));
      const results = await Promise.all(promises);
      expect(results[0]).to.eq(results[2]).to.eq(0);
      expect(results[1]).to.eq(1);

      presentationManagerMock.verifyAll();
    });

  });

  describe("getChildNodes", () => {

    it("returns presentation manager result", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      const parentNode = createTreeNodeItem(parentKey);
      const pageOptions: PageOptions = { start: faker.random.number(), size: faker.random.number() };
      presentationManagerMock
        .setup((x) => x.getChildren(imodelMock.object, parentKey, pageOptionsUiToPresentation(pageOptions), createRequestOptions()))
        .returns(async () => [createRandomECInstanceNode(), createRandomECInstanceNode()])
        .verifiable();
      const actualResult = await provider.getChildNodes(parentNode, pageOptions);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const parentKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const parentNodes = parentKeys.map((key) => createTreeNodeItem(key));
      const resultContainers = [new PromiseContainer<Node[]>(), new PromiseContainer<Node[]>(), new PromiseContainer<Node[]>()];

      presentationManagerMock
        .setup((x) => x.getChildren(imodelMock.object, parentKeys[0], undefined, createRequestOptions()))
        .returns(() => resultContainers[0].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup((x) => x.getChildren(imodelMock.object, parentKeys[0], { pageStart: 0, pageSize: 0 }, createRequestOptions()))
        .verifiable(moq.Times.never());
      presentationManagerMock
        .setup((x) => x.getChildren(imodelMock.object, parentKeys[0], { pageStart: 1, pageSize: 0 }, createRequestOptions()))
        .returns(() => resultContainers[1].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup((x) => x.getChildren(imodelMock.object, parentKeys[1], undefined, createRequestOptions()))
        .returns(() => resultContainers[2].promise)
        .verifiable(moq.Times.once());

      const promises = [
        provider.getChildNodes(parentNodes[0], undefined), provider.getChildNodes(parentNodes[0], undefined),
        provider.getChildNodes(parentNodes[0], { start: 0, size: 0 }), provider.getChildNodes(parentNodes[0], { start: 0, size: 0 }),
        provider.getChildNodes(parentNodes[0], { start: 1, size: 0 }), provider.getChildNodes(parentNodes[0], { start: 1, size: 0 }),
        provider.getChildNodes(parentNodes[1], undefined), provider.getChildNodes(parentNodes[1], undefined),
      ];
      resultContainers.forEach((c: PromiseContainer<Node[]>) => c.resolve([createRandomECInstanceNode()]));
      const results = await Promise.all(promises);

      expect(results[0]).to.eq(results[1], "results[0] should eq results[1]");
      expect(results[2])
        .to.eq(results[3], "results[2] should eq results[3]")
        .to.eq(results[0], "both results[2] and results[3] should eq results[0]");
      expect(results[4]).to.eq(results[5], "results[4] should eq results[5]");
      expect(results[6]).to.eq(results[7], "results[6] should eq results[7]");

      presentationManagerMock.verifyAll();
    });

  });

  describe("getFilteredNodes", () => {

    it("returns presentation manager result", async () => {
      const filter = faker.random.word();
      presentationManagerMock
        .setup((x) => x.getFilteredNodePaths(imodelMock.object, filter, createRequestOptions()))
        .returns(async () => [createRandomNodePathElement(), createRandomNodePathElement()])
        .verifiable();
      const actualResult = await provider.getFilteredNodePaths(filter);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

  });

});
