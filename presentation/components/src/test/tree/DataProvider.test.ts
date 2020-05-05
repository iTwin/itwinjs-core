/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Node, RegisteredRuleset } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { PromiseContainer, ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import {
  createRandomECInstancesNode, createRandomECInstancesNodeKey, createRandomNodePathElement, createRandomRuleset,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Presentation, PresentationManager, RulesetManager } from "@bentley/presentation-frontend";
import { PageOptions } from "@bentley/ui-components";
import { PresentationTreeDataProvider } from "../../presentation-components/tree/DataProvider";
import { pageOptionsUiToPresentation } from "../../presentation-components/tree/Utils";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";

describe("TreeDataProvider", () => {

  let rulesetId: string;
  let provider: PresentationTreeDataProvider;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    rulesetId = faker.random.word();
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  after(() => {
    Presentation.terminate();
  });

  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset: rulesetId });
  });

  describe("dispose", () => {

    it("disposes registered ruleset", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

      const ruleset = await createRandomRuleset();
      const p = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset });
      const rulesetDisposeSpy = sinon.spy();
      await registerPromise.resolve(new RegisteredRuleset(ruleset, "test", rulesetDisposeSpy));

      expect(rulesetDisposeSpy).to.not.be.called;
      p.dispose();
      expect(rulesetDisposeSpy).to.be.calledOnce;
    });

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
        const resultNodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, undefined))
          .returns(async () => resultNodes)
          .verifiable();
        const actualResult = await provider.getNodesCount();
        expect(actualResult).to.eq(resultNodes.length);
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const resultNodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
        const resultContainers = [new PromiseContainer<{ nodes: Node[], count: number }>(), new PromiseContainer<{ nodes: Node[], count: number }>()];
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 } }, undefined))
          .returns(async () => resultContainers[0].promise);
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 } }, undefined))
          .returns(async () => resultContainers[1].promise);
        provider.pagingSize = 10;
        const promises = [provider.getNodesCount(), provider.getNodesCount()];
        resultContainers.forEach((c: PromiseContainer<{ nodes: Node[], count: number }>, index: number) => c.resolve({ nodes: resultNodes, count: index }));
        const results = await Promise.all(promises);
        expect(results[1]).to.eq(results[0]).to.eq(0);
        presentationManagerMock.verify((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 } }, undefined), moq.Times.once());
      });

      it("requests count and first page when paging size is set", async () => {
        const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 + faker.random.number() };
        const pageSize = 20;
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: pageOptionsUiToPresentation({ start: 0, size: pageSize }) }, undefined))
          .returns(async () => result)
          .verifiable();
        provider.pagingSize = pageSize;
        const actualResult = await provider.getNodesCount();
        expect(actualResult).to.eq(result.count);
        presentationManagerMock.verifyAll();
      });

      it("returns nodes count equal to requested nodes list count when page options are undefined", async () => {
        const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode(), createRandomECInstancesNode(), createRandomECInstancesNode()];
        presentationManagerMock.setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, undefined))
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
        const resultNodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
        const parentKey = createRandomECInstancesNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, parentKey))
          .returns(async () => resultNodes)
          .verifiable();
        const actualResult = await provider.getNodesCount(parentNode);
        expect(actualResult).to.eq(resultNodes.length);
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const parentKeys = [createRandomECInstancesNodeKey(), createRandomECInstancesNodeKey()];
        const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
        const resultContainers = [new PromiseContainer<{ nodes: Node[], count: number }>(), new PromiseContainer<{ nodes: Node[], count: number }>()];

        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 } }, parentKeys[0]))
          .returns(async () => resultContainers[0].promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 } }, parentKeys[1]))
          .returns(async () => resultContainers[1].promise)
          .verifiable(moq.Times.once());

        provider.pagingSize = 10;
        const promises = [
          provider.getNodesCount(parentNodes[0]),
          provider.getNodesCount(parentNodes[0]),
          provider.getNodesCount(parentNodes[1]),
        ];
        resultContainers.forEach((c: PromiseContainer<{ nodes: Node[], count: number }>, index: number) => c.resolve({ nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: index }));
        const results = await Promise.all(promises);
        expect(results[0]).to.eq(results[1]).to.eq(0);
        expect(results[2]).to.eq(1);

        presentationManagerMock.verifyAll();
      });

      it("uses default page options", async () => {
        const parentKey = createRandomECInstancesNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const result = { nodes: [], count: faker.random.number() };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: pageOptionsUiToPresentation({ start: 0, size: 20 }) }, parentKey))
          .returns(async () => result)
          .verifiable();
        provider.pagingSize = 20;
        const actualResult = await provider.getNodesCount(parentNode);
        expect(actualResult).to.eq(result.count);
        presentationManagerMock.verifyAll();
      });

      it("returns nodes count equal to requested nodes list count when page options are undefined", async () => {
        const parentKey = createRandomECInstancesNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode(), createRandomECInstancesNode(), createRandomECInstancesNode()];
        presentationManagerMock.setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, parentKey))
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
        const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: pageOptionsUiToPresentation(pageOptions) }, undefined))
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
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, undefined))
          .returns(async () => resultNodesFirstPageContainer0.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 0 } }, undefined))
          .verifiable(moq.Times.never());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 1, size: 0 } }, undefined))
          .returns(async () => resultNodesNonFirstPageContainer.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 1 } }, undefined))
          .returns(async () => resultNodesFirstPageContainer1.promise)
          .verifiable(moq.Times.once());

        const promises = [
          provider.getNodes(), provider.getNodes(),
          provider.getNodes(undefined, { start: 0, size: 0 }), provider.getNodes(undefined, { start: 0, size: 0 }),
          provider.getNodes(undefined, { start: 1, size: 0 }), provider.getNodes(undefined, { start: 1, size: 0 }),
          provider.getNodes(undefined, { start: 0, size: 1 }), provider.getNodes(undefined, { start: 0, size: 1 }),
        ];
        resultNodesFirstPageContainer0.resolve([createRandomECInstancesNode()]);
        resultNodesFirstPageContainer1.resolve({ nodes: [createRandomECInstancesNode()], count: 1 });
        resultNodesNonFirstPageContainer.resolve([createRandomECInstancesNode()]);
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
        const parentKey = createRandomECInstancesNodeKey();
        const parentNode = createRandomTreeNodeItem(parentKey);
        const pageOptions: PageOptions = { start: 0, size: faker.random.number() };
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: pageOptionsUiToPresentation(pageOptions) }, parentKey))
          .returns(async () => ({ nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 }))
          .verifiable();
        const actualResult = await provider.getNodes(parentNode, pageOptions);
        expect(actualResult).to.matchSnapshot();
        presentationManagerMock.verifyAll();
      });

      it("memoizes result", async () => {
        const parentKeys = [createRandomECInstancesNodeKey(), createRandomECInstancesNodeKey()];
        const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
        const resultNodesFirstPageContainer0 = new PromiseContainer<Node[]>();
        const resultNodesFirstPageContainer1 = new PromiseContainer<{ nodes: Node[], count: number }>();
        const resultNodesNonFirstPageContainer = new PromiseContainer<Node[]>();

        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }, parentKeys[0]))
          .returns(async () => resultNodesFirstPageContainer0.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 0 } }, parentKeys[0]))
          .verifiable(moq.Times.never());
        presentationManagerMock
          .setup((x) => x.getNodes({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 1, size: 0 } }, parentKeys[0]))
          .returns(async () => resultNodesNonFirstPageContainer.promise)
          .verifiable(moq.Times.once());
        presentationManagerMock
          .setup((x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 1 } }, parentKeys[1]))
          .returns(async () => resultNodesFirstPageContainer1.promise)
          .verifiable(moq.Times.once());

        const promises = [
          provider.getNodes(parentNodes[0], undefined), provider.getNodes(parentNodes[0], undefined),
          provider.getNodes(parentNodes[0], { start: 0, size: 0 }), provider.getNodes(parentNodes[0], { start: 0, size: 0 }),
          provider.getNodes(parentNodes[0], { start: 1, size: 0 }), provider.getNodes(parentNodes[0], { start: 1, size: 0 }),
          provider.getNodes(parentNodes[1], { start: 0, size: 1 }), provider.getNodes(parentNodes[1], { start: 0, size: 1 }),
        ];
        resultNodesFirstPageContainer0.resolve([createRandomECInstancesNode()]);
        resultNodesFirstPageContainer1.resolve({ nodes: [createRandomECInstancesNode()], count: 1 });
        resultNodesNonFirstPageContainer.resolve([createRandomECInstancesNode()]);
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
      const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 };
      presentationManagerMock.setup((x) => x.getNodesAndCount(moq.It.isAny(), moq.It.isAny())).returns(async () => result);
      presentationManagerMock.setup((x) => x.getNodes(moq.It.isAny(), moq.It.isAny())).returns(async () => result.nodes);

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
        .setup((x) => x.getFilteredNodePaths({ imodel: imodelMock.object, rulesetOrId: rulesetId }, filter))
        .returns(async () => [createRandomNodePathElement(), createRandomNodePathElement()])
        .verifiable();
      const actualResult = await provider.getFilteredNodePaths(filter);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

  });

  describe("loadHierarchy", () => {

    it("calls presentation manager", async () => {
      presentationManagerMock
        .setup((x) => x.loadHierarchy({ imodel: imodelMock.object, rulesetOrId: rulesetId }))
        .returns(async () => { })
        .verifiable();
      await provider.loadHierarchy();
      presentationManagerMock.verifyAll();
    });

  });

});
