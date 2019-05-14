/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { PromiseContainer } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { Node } from "@bentley/presentation-common";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "@bentley/presentation-common/lib/test/_helpers/random";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation, PresentationManager } from "@bentley/presentation-frontend";
import { PageOptions } from "@bentley/ui-components";
import { PresentationTreeDataProvider } from "../../tree/DataProvider";
import { pageOptionsUiToPresentation } from "../../tree/Utils";

describe("TreeDataProvider", () => {

  let rulesetId: string;
  let provider: PresentationTreeDataProvider;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    rulesetId = faker.random.word();
    Presentation.presentation = presentationManagerMock.object;
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new PresentationTreeDataProvider(imodelMock.object, rulesetId);
  });

  describe("rulesetId", () => {

    it("returns rulesetId provider is initialized with", () => {
      expect(provider.rulesetId).to.eq(rulesetId);
    });

  });

  describe("imodel", () => {

    it("returns imodel provider is initialized with", () => {
      expect(provider.imodel).to.eq(imodelMock.object);
    });

  });

  describe("getNodesCount", () => {

    describe("root", () => {

      it("returns presentation manager result", async () => {
        const resultNodes = [createRandomECInstanceNode(), createRandomECInstanceNode()];
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, undefined))
          .returns(async () => resultNodes)
          .verifiable();
        const actualResult = await provider.getNodesCount();
        expect(actualResult).to.eq(resultNodes.length);
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const resultNodes = [createRandomECInstanceNode(), createRandomECInstanceNode()];
        const resultContainers = [new PromiseContainer<{ nodes: Node[], count: number }>(), new PromiseContainer<{ nodes: Node[], count: number }>()];
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, undefined))
          .returns(async () => resultContainers[0].promise);
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, undefined))
          .returns(async () => resultContainers[1].promise);
        provider.pagingSize = 10;
        const promises = [provider.getNodesCount(), provider.getNodesCount()];
        resultContainers.forEach((c: PromiseContainer<{ nodes: Node[], count: number }>, index: number) => c.resolve({ nodes: resultNodes, count: index }));
        const results = await Promise.all(promises);
        expect(results[1]).to.eq(results[0]).to.eq(0);
        presentationManagerMock.verify((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, undefined), moq.Times.once());
      });

      it("requests count and first page when paging size is set", async () => {
        const result = { nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 + faker.random.number() };
        const pageSize = 20;
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: pageOptionsUiToPresentation({ start: 0, size: pageSize }) }, undefined))
          .returns(async () => result)
          .verifiable();
        provider.pagingSize = pageSize;
        const actualResult = await provider.getNodesCount();
        expect(actualResult).to.eq(result.count);
        presentationManagerMock.verifyAll();
      });

      it("returns nodes count equal to requested nodes list count when page options are undefined", async () => {
        const nodes = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        presentationManagerMock.setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, undefined))
          .returns(async () => nodes)
          .verifiable(moq.Times.once());
        presentationManagerMock.setup((x) => x.getNodesCount(moq.It.isAny(), moq.It.isAny()))
          .verifiable(moq.Times.never());
        const count = await provider.getNodesCount();
        presentationManagerMock.verifyAll();
        expect(count).to.equal(nodes.length);
      });
    });

    describe("children", () => {

      it("returns presentation manager result", async () => {
        const resultNodes = [createRandomECInstanceNode(), createRandomECInstanceNode()];
        const parentKey = createRandomECInstanceNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, parentKey))
          .returns(async () => resultNodes)
          .verifiable();
        const actualResult = await provider.getNodesCount(parentNode);
        expect(actualResult).to.eq(resultNodes.length);
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const parentKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
        const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
        const resultContainers = [new PromiseContainer<{ nodes: Node[], count: number }>(), new PromiseContainer<{ nodes: Node[], count: number }>()];

        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, parentKeys[0]))
          .returns(async () => resultContainers[0].promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, parentKeys[1]))
          .returns(async () => resultContainers[1].promise)
          .verifiable(moq.Times.once());

        provider.pagingSize = 10;
        const promises = [
          provider.getNodesCount(parentNodes[0]),
          provider.getNodesCount(parentNodes[1]),
          provider.getNodesCount(parentNodes[0]),
        ];
        resultContainers.forEach((c: PromiseContainer<{ nodes: Node[], count: number }>, index: number) => c.resolve({ nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: index }));
        const results = await Promise.all(promises);
        expect(results[0]).to.eq(results[2]).to.eq(0);
        expect(results[1]).to.eq(1);

        presentationManagerMock.verifyAll();
      });

      it("uses default page options", async () => {
        const parentKey = createRandomECInstanceNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const result = { nodes: [], count: faker.random.number() };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: pageOptionsUiToPresentation({ start: 0, size: 20 }) }, parentKey))
          .returns(async () => result)
          .verifiable();
        provider.pagingSize = 20;
        const actualResult = await provider.getNodesCount(parentNode);
        expect(actualResult).to.eq(result.count);
        presentationManagerMock.verifyAll();
      });

      it("returns nodes count equal to requested nodes list count when page options are undefined", async () => {
        const parentKey = createRandomECInstanceNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const nodes = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        presentationManagerMock.setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, parentKey))
          .returns(async () => nodes)
          .verifiable(moq.Times.once());
        presentationManagerMock.setup((x) => x.getNodesCount(moq.It.isAny(), moq.It.isAny()))
          .verifiable(moq.Times.never());
        const count = await provider.getNodesCount(parentNode);
        presentationManagerMock.verifyAll();
        expect(count).to.equal(nodes.length);
      });

    });

  });

  describe("getNodes", () => {

    describe("root", () => {

      it("returns presentation manager result", async () => {
        const pageOptions: PageOptions = { start: 0, size: faker.random.number() };
        const result = { nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: pageOptionsUiToPresentation(pageOptions) }, undefined))
          .returns(async () => result)
          .verifiable();
        const actualResult = await provider.getNodes(undefined, pageOptions);
        expect(actualResult).to.matchSnapshot();
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const resultNodesFirstPageContainer0 = new PromiseContainer<Node[]>();
        const resultNodesFirstPageContainer1 = new PromiseContainer<{ nodes: Node[], count: number }>();
        const resultNodesNonFirstPageContainer = new PromiseContainer<Node[]>();
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, undefined))
          .returns(async () => resultNodesFirstPageContainer0.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 0 } }, undefined))
          .verifiable(moq.Times.never());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: { start: 1, size: 0 } }, undefined))
          .returns(async () => resultNodesNonFirstPageContainer.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 1 } }, undefined))
          .returns(async () => resultNodesFirstPageContainer1.promise)
          .verifiable(moq.Times.once());

        const promises = [
          provider.getNodes(), provider.getNodes(),
          provider.getNodes(undefined, { start: 0, size: 0 }), provider.getNodes(undefined, { start: 0, size: 0 }),
          provider.getNodes(undefined, { start: 1, size: 0 }), provider.getNodes(undefined, { start: 1, size: 0 }),
          provider.getNodes(undefined, { start: 0, size: 1 }), provider.getNodes(undefined, { start: 0, size: 1 }),
        ];
        resultNodesFirstPageContainer0.resolve([createRandomECInstanceNode()]);
        resultNodesFirstPageContainer1.resolve({ nodes: [createRandomECInstanceNode()], count: 1 });
        resultNodesNonFirstPageContainer.resolve([createRandomECInstanceNode()]);
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

    describe("children", () => {

      it("returns presentation manager result", async () => {
        const parentKey = createRandomECInstanceNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const pageOptions: PageOptions = { start: 0, size: faker.random.number() };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: pageOptionsUiToPresentation(pageOptions) }, parentKey))
          .returns(async () => ({ nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 }))
          .verifiable();
        const actualResult = await provider.getNodes(parentNode, pageOptions);
        expect(actualResult).to.matchSnapshot();
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const parentKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
        const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
        const resultNodesFirstPageContainer0 = new PromiseContainer<Node[]>();
        const resultNodesFirstPageContainer1 = new PromiseContainer<{ nodes: Node[], count: number }>();
        const resultNodesNonFirstPageContainer = new PromiseContainer<Node[]>();

        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: undefined }, parentKeys[0]))
          .returns(async () => resultNodesFirstPageContainer0.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 0 } }, parentKeys[0]))
          .verifiable(moq.Times.never());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetId, paging: { start: 1, size: 0 } }, parentKeys[0]))
          .returns(async () => resultNodesNonFirstPageContainer.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 1 } }, parentKeys[1]))
          .returns(async () => resultNodesFirstPageContainer1.promise)
          .verifiable(moq.Times.once());

        const promises = [
          provider.getNodes(parentNodes[0], undefined), provider.getNodes(parentNodes[0], undefined),
          provider.getNodes(parentNodes[0], { start: 0, size: 0 }), provider.getNodes(parentNodes[0], { start: 0, size: 0 }),
          provider.getNodes(parentNodes[0], { start: 1, size: 0 }), provider.getNodes(parentNodes[0], { start: 1, size: 0 }),
          provider.getNodes(parentNodes[1], { start: 0, size: 1 }), provider.getNodes(parentNodes[1], { start: 0, size: 1 }),
        ];
        resultNodesFirstPageContainer0.resolve([createRandomECInstanceNode()]);
        resultNodesFirstPageContainer1.resolve({ nodes: [createRandomECInstanceNode()], count: 1 });
        resultNodesNonFirstPageContainer.resolve([createRandomECInstanceNode()]);
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

    it("Logs warning when requesting nodes and pagingSize is not the same as passed pageOptions", async () => {
      const pageOptions: PageOptions = { start: 0, size: 10 };
      const loggerSpy = sinon.spy(Logger, "logWarning");
      const result = { nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 };
      presentationManagerMock.setup((x) => x.getNodesAndCount(moq.It.isAny(), moq.It.isAny())).returns(async () => result);
      presentationManagerMock.setup((x) => x.getNodes(moq.It.isAny(), moq.It.isAny())).returns(async () => result.nodes);

      // Paging size is not set and no pageOptions are passed
      await provider.getNodes();
      expect(loggerSpy.calledOnce).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is not set and pageOptions are passed
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.calledOnce).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and no pageOptions are passed
      provider.pagingSize = 10;
      await provider.getNodes();
      expect(loggerSpy.notCalled).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and pageOptions are passed but not equal to paging size
      provider.pagingSize = 20;
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.calledOnce).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and pageOptions are passed and equal to paging size
      provider.pagingSize = 10;
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.notCalled).to.be.true;
    });

  });

  describe("getFilteredNodes", () => {

    it("returns presentation manager result", async () => {
      const filter = faker.random.word();
      presentationManagerMock
        .setup((x) => x.getFilteredNodePaths({ imodel: imodelMock.object, rulesetId }, filter))
        .returns(async () => [createRandomNodePathElement(), createRandomNodePathElement()])
        .verifiable();
      const actualResult = await provider.getFilteredNodePaths(filter);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

  });

});
