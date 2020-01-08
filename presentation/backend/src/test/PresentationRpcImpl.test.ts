/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstanceKey, createRandomDescriptor } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelToken } from "@bentley/imodeljs-common";
import { PresentationRpcRequestOptions, KeySet } from "@bentley/presentation-common";
import { PresentationRpcImpl } from "../PresentationRpcImpl";
import { PresentationRpcImplStateless } from "../PresentationRpcImplStateless";
import { PresentationRpcImplStateful } from "../PresentationRpcImplStateful";
import "./IModelHostSetup";

describe("PresentationRpcImpl", () => {

  describe("calls forwarding", () => {

    let testData: any;
    let defaultRpcParams: PresentationRpcRequestOptions;
    let statefulRpcParams: PresentationRpcRequestOptions;
    let impl: PresentationRpcImpl;
    const statelessImpl = moq.Mock.ofType<PresentationRpcImplStateless>();
    const statefulImpl = moq.Mock.ofType<PresentationRpcImplStateful>();

    beforeEach(() => {
      statelessImpl.reset();
      statefulImpl.reset();
      testData = {
        imodelToken: new IModelToken(),
        clientStateId: faker.random.uuid(),
        keys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
        descriptor: createRandomDescriptor(),
      };
      defaultRpcParams = { clientId: faker.random.uuid() };
      statefulRpcParams = { ...defaultRpcParams, clientStateId: faker.random.uuid() };
      impl = new PresentationRpcImpl();
      (impl as any)._statelessImpl = statelessImpl.object;
      (impl as any)._statefulImpl = statefulImpl.object;
    });

    describe("getNodesAndCount", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getNodesAndCount(testData.imodelToken, defaultRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodesAndCount(testData.imodelToken, defaultRpcParams, undefined);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getNodesAndCount(testData.imodelToken, statefulRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodesAndCount(testData.imodelToken, statefulRpcParams, undefined);
        statefulImpl.verifyAll();
      });
    });

    describe("getNodes", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getNodes(testData.imodelToken, defaultRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodes(testData.imodelToken, defaultRpcParams, undefined);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getNodes(testData.imodelToken, statefulRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodes(testData.imodelToken, statefulRpcParams, undefined);
        statefulImpl.verifyAll();
      });

    });

    describe("getNodesCount", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getNodesCount(testData.imodelToken, defaultRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodesCount(testData.imodelToken, defaultRpcParams, undefined);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getNodesCount(testData.imodelToken, statefulRpcParams, undefined))
          .verifiable(moq.Times.once());
        await impl.getNodesCount(testData.imodelToken, statefulRpcParams, undefined);
        statefulImpl.verifyAll();
      });

    });

    describe("getFilteredNodePaths", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getFilteredNodePaths(testData.imodelToken, defaultRpcParams, ""))
          .verifiable(moq.Times.once());
        await impl.getFilteredNodePaths(testData.imodelToken, defaultRpcParams, "");
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getFilteredNodePaths(testData.imodelToken, statefulRpcParams, ""))
          .verifiable(moq.Times.once());
        await impl.getFilteredNodePaths(testData.imodelToken, statefulRpcParams, "");
        statefulImpl.verifyAll();
      });

    });

    describe("getNodePaths", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getNodePaths(testData.imodelToken, defaultRpcParams, [[]], 0))
          .verifiable(moq.Times.once());
        await impl.getNodePaths(testData.imodelToken, defaultRpcParams, [[]], 0);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getNodePaths(testData.imodelToken, statefulRpcParams, [[]], 0))
          .verifiable(moq.Times.once());
        await impl.getNodePaths(testData.imodelToken, statefulRpcParams, [[]], 0);
        statefulImpl.verifyAll();
      });

    });

    describe("loadHierarchy", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.loadHierarchy(testData.imodelToken, defaultRpcParams))
          .verifiable(moq.Times.once());
        await impl.loadHierarchy(testData.imodelToken, defaultRpcParams);
        statelessImpl.verifyAll();
      });

    });

    describe("getContentDescriptor", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getContentDescriptor(testData.imodelToken, defaultRpcParams, "", testData.keys.toJSON(), undefined))
          .verifiable(moq.Times.once());
        await impl.getContentDescriptor(testData.imodelToken, defaultRpcParams, "", testData.keys.toJSON(), undefined);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getContentDescriptor(testData.imodelToken, statefulRpcParams, "", testData.keys.toJSON(), undefined))
          .verifiable(moq.Times.once());
        await impl.getContentDescriptor(testData.imodelToken, statefulRpcParams, "", testData.keys.toJSON(), undefined);
        statefulImpl.verifyAll();
      });

    });

    describe("getContentAndSize", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getContentAndSize(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContentAndSize(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON());
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getContentAndSize(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContentAndSize(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON());
        statefulImpl.verifyAll();
      });

    });

    describe("getContentSetSize", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getContentSetSize(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContentSetSize(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON());
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getContentSetSize(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContentSetSize(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON());
        statefulImpl.verifyAll();
      });

    });

    describe("getContent", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getContent(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContent(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON());
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getContent(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON()))
          .verifiable(moq.Times.once());
        await impl.getContent(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON());
        statefulImpl.verifyAll();
      });

    });

    describe("getDistinctValues", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getDistinctValues(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON(), "", 0))
          .verifiable(moq.Times.once());
        await impl.getDistinctValues(testData.imodelToken, defaultRpcParams, testData.descriptor, testData.keys.toJSON(), "", 0);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getDistinctValues(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON(), "", 0))
          .verifiable(moq.Times.once());
        await impl.getDistinctValues(testData.imodelToken, statefulRpcParams, testData.descriptor, testData.keys.toJSON(), "", 0);
        statefulImpl.verifyAll();
      });

    });

    describe("getDisplayLabel", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getDisplayLabel(testData.imodelToken, defaultRpcParams, testData.keys[0]))
          .verifiable(moq.Times.once());
        await impl.getDisplayLabel(testData.imodelToken, defaultRpcParams, testData.keys[0]);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getDisplayLabel(testData.imodelToken, statefulRpcParams, testData.keys[0]))
          .verifiable(moq.Times.once());
        await impl.getDisplayLabel(testData.imodelToken, statefulRpcParams, testData.keys[0]);
        statefulImpl.verifyAll();
      });

    });

    describe("getDisplayLabels", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getDisplayLabels(testData.imodelToken, defaultRpcParams, []))
          .verifiable(moq.Times.once());
        await impl.getDisplayLabels(testData.imodelToken, defaultRpcParams, []);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getDisplayLabels(testData.imodelToken, statefulRpcParams, []))
          .verifiable(moq.Times.once());
        await impl.getDisplayLabels(testData.imodelToken, statefulRpcParams, []);
        statefulImpl.verifyAll();
      });

    });

    describe("getSelectionScopes", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.getSelectionScopes(testData.imodelToken, defaultRpcParams))
          .verifiable(moq.Times.once());
        await impl.getSelectionScopes(testData.imodelToken, defaultRpcParams);
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.getSelectionScopes(testData.imodelToken, statefulRpcParams))
          .verifiable(moq.Times.once());
        await impl.getSelectionScopes(testData.imodelToken, statefulRpcParams);
        statefulImpl.verifyAll();
      });

    });

    describe("computeSelection", () => {

      it("calls stateless implementation", async () => {
        statelessImpl.setup((x) => x.computeSelection(testData.imodelToken, defaultRpcParams, [], ""))
          .verifiable(moq.Times.once());
        await impl.computeSelection(testData.imodelToken, defaultRpcParams, [], "");
        statelessImpl.verifyAll();
      });

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.computeSelection(testData.imodelToken, statefulRpcParams, [], ""))
          .verifiable(moq.Times.once());
        await impl.computeSelection(testData.imodelToken, statefulRpcParams, [], "");
        statefulImpl.verifyAll();
      });

    });

    describe("syncClientState", () => {

      it("calls stateful implementation", async () => {
        statefulImpl.setup((x) => x.syncClientState(testData.imodelToken, { ...statefulRpcParams, state: {} }))
          .verifiable();
        await impl.syncClientState(testData.imodelToken, { ...statefulRpcParams, state: {} });
        statefulImpl.verifyAll();
      });

    });

  });

});
