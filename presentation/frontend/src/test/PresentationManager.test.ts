/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  createRandomDescriptor,
  createRandomECInstanceNode, createRandomECInstanceNodeKey, createRandomNodePathElement,
  createRandomECInstanceKey,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  KeySet, Content, HierarchyRequestOptions, Node,
  Paged, ContentRequestOptions, RpcRequestsHandler, LabelRequestOptions, NodeKey, NodePathElement, InstanceKey, Descriptor,
} from "@bentley/presentation-common";
import { PresentationManager } from "../PresentationManager";
import { RulesetVariablesManagerImpl } from "../RulesetVariablesManager";
import { RulesetManagerImpl } from "../RulesetManager";

describe("PresentationManager", () => {

  let rpcRequestsHandlerMock: moq.IMock<RpcRequestsHandler>;
  let manager: PresentationManager;
  const testData = {
    imodelToken: new IModelToken(),
    imodelMock: moq.Mock.ofType<IModelConnection>(),
    pageOptions: { start: 0, size: 0 },
    rulesetId: "",
  };

  beforeEach(() => {
    testData.imodelMock.setup((x) => x.iModelToken).returns(() => testData.imodelToken);
    testData.pageOptions = { start: faker.random.number(), size: faker.random.number() };
    testData.rulesetId = faker.random.uuid();
    rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
    manager = PresentationManager.create({ rpcRequestsHandler: rpcRequestsHandlerMock.object });
  });

  afterEach(() => {
    manager.dispose();
  });

  const toIModelTokenOptions = <TOptions extends { imodel: IModelConnection, locale?: string }>(options: TOptions) => {
    // 1. put default `locale`
    // 2. put all `options` members (if `locale` is set, it'll override the default put at #1)
    // 3. put `imodel` of type `IModelToken` which overwrites the `imodel` from `options`
    return Object.assign({}, { locale: undefined }, options, {
      imodel: testData.imodelToken,
    });
  };

  describe("constructor", () => {

    it("sets active locale if supplied with props", async () => {
      const props = { activeLocale: faker.locale };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

    it("sets custom RpcRequestsHandler if supplied with props", async () => {
      const handler = moq.Mock.ofType<RpcRequestsHandler>();
      const props = { rpcRequestsHandler: handler.object };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler).to.eq(handler.object);
    });

    it("sets RpcRequestsHandler clientId if supplied with props", async () => {
      const props = { clientId: faker.random.uuid() };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler.clientId).to.eq(props.clientId);
    });

  });

  describe("dispose", () => {

    it("disposes RPC requests handler", () => {
      manager.dispose();
      rpcRequestsHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

  });

  describe("activeLocale", () => {

    it("requests with manager's locale if not set in request options", async () => {
      const locale = faker.random.locale();
      manager.activeLocale = locale;
      await manager.getNodesCount({
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetId: testData.rulesetId,
        locale,
      }, undefined), moq.Times.once());
    });

    it("requests with request's locale if set", async () => {
      const locale = faker.random.locale();
      await manager.getNodesCount({
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        locale,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetId: testData.rulesetId,
        locale,
      }, undefined), moq.Times.once());
    });

  });

  describe("rulesets", () => {

    it("returns rulesets manager", () => {
      const rulesets = manager.rulesets();
      expect(rulesets).to.be.instanceOf(RulesetManagerImpl);
    });

  });

  describe("vars", () => {

    it("returns ruleset variables manager", () => {
      const vars = manager.vars(testData.rulesetId);
      expect(vars).to.be.instanceOf(RulesetVariablesManagerImpl);

      const vars2 = manager.vars(testData.rulesetId);
      expect(vars2).to.equal(vars);
    });

  });

  describe("getNodesAndCount", () => {

    it("requests root nodes from proxy", async () => {
      const result = { nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 };
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesAndCount(toIModelTokenOptions(options), undefined))
        .returns(async () => ({ ...result, nodes: result.nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = { nodes: [createRandomECInstanceNode(), createRandomECInstanceNode()], count: 2 };
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesAndCount(toIModelTokenOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => ({ ...result, nodes: result.nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options, parentNodeKey);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodes", () => {

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodes(toIModelTokenOptions(options), undefined))
        .returns(async () => result.map(Node.toJSON))
        .verifiable();
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodes(toIModelTokenOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => result.map(Node.toJSON))
        .verifiable();
      const actualResult = await manager.getNodes(options, parentNodeKey);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodesCount", () => {

    it("requests root nodes count from proxy", async () => {
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(options), undefined))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options, parentNodeKey);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getFilteredNodePaths(toIModelTokenOptions(options), "filter"))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getFilteredNodePaths(options, "filter");
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodePaths", () => {

    it("calls getNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const keyArray = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getNodePaths(toIModelTokenOptions(options), keyArray.map((k) => k.map(InstanceKey.toJSON)), 1))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getNodePaths(options, keyArray, 1);
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentDescriptor", () => {

    it("requests descriptor from proxy and rebuilds parentship", async () => {
      const keyset = new KeySet();
      const result = createRandomDescriptor();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(toIModelTokenOptions(options), "test", keyset.toJSON(), undefined))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      expect(actualResult).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(toIModelTokenOptions(options), "test", keyset.toJSON(), undefined))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.be.undefined;
    });

  });

  describe("getContentSetSize", () => {

    it("requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = faker.random.number();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentSetSize(toIModelTokenOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, descriptor, keyset);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = faker.random.number();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentSetSize(toIModelTokenOptions(options), overrides, keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, overrides, keyset);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContent", () => {

    it("requests content from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = new Content(descriptor, []);
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(toIModelTokenOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContent(options, descriptor, keyset);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = new Content(descriptor, []);
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(toIModelTokenOptions(options), overrides, keyset.toJSON()))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContent(options, overrides, keyset);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(toIModelTokenOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContent(options, descriptor, keyset);
      expect(actualResult).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentAndContentSize", () => {

    it("requests content and contentSize from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        content: new Content(descriptor, []),
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(toIModelTokenOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => ({ ...result, content: result.content.toJSON() }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, descriptor, keyset);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content and content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = {
        content: new Content(descriptor, []),
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(toIModelTokenOptions(options), overrides, keyset.toJSON()))
        .returns(async () => ({ ...result, content: result.content.toJSON() }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, overrides, keyset);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        content: undefined,
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(toIModelTokenOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, descriptor, keyset);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getDistinctValues", () => {

    it("requests distinct values", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const result = [faker.random.word(), faker.random.word()];
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(toIModelTokenOptions(options),
          moq.deepEquals(descriptor.createStrippedDescriptor().toJSON()),
          moq.deepEquals(keyset.toJSON()), fieldName, maximumValueCount))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDistinctValues(options, descriptor, keyset, fieldName, maximumValueCount);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("passes 0 for maximumValueCount by default", async () => {
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAnyString(), 0))
        .verifiable();
      await manager.getDistinctValues(options, createRandomDescriptor(), new KeySet(), "");
      rpcRequestsHandlerMock.verifyAll();
    });
  });

  describe("getDisplayLabel", () => {

    it("requests display label", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabel(toIModelTokenOptions(options), key))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabel(options, key);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getDisplayLabels", () => {

    it("requests display labels", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabels(toIModelTokenOptions(options), keys))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabels(options, keys);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

});
