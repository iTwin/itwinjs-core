/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
const deepEqual = require("deep-equal"); // tslint:disable-line:no-var-requires
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, Content, Descriptor, ECPresentationRpcInterface, HierarchyRequestOptions, Paged, ContentRequestOptions, RequestOptions } from "@common/index";
import { ECPresentationManager } from "@src/index";
import UserSettingsManager from "@src/UserSettingsManager";
import {
  createRandomDescriptor,
  createRandomECInstanceNode, createRandomECInstanceNodeKey, createRandomNodePathElement,
  createRandomECInstanceKey,
} from "@helpers/random";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("ECPresentationManager", () => {

  let interfaceMock: moq.IMock<ECPresentationRpcInterface>;
  let manager: ECPresentationManager;
  const testData = {
    imodelToken: new IModelToken(),
    imodelMock: moq.Mock.ofType<IModelConnection>(),
    pageOptions: { start: 1, size: 2 },
    rulesetId: "testRuleset",
    presentationRuleSet: { ruleSetId: "testRuleset" },
  };

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);
    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
    testData.imodelMock.setup((x) => x.iModelToken).returns(() => testData.imodelToken);
    manager = ECPresentationManager.create();
  });

  const toIModelTokenOptions = <TOptions extends RequestOptions<IModelConnection>>(options: TOptions) => {
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
      const mgr = ECPresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

  });

  describe("activeLocale", () => {

    it("requests with manager's locale if not set in request options", async () => {
      const locale = faker.random.locale();
      manager.activeLocale = locale;
      await manager.getRootNodesCount({
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      });
      interfaceMock.verify((x) => x.getRootNodesCount({
        imodel: testData.imodelToken,
        rulesetId: testData.rulesetId,
        locale,
      }), moq.Times.once());
    });

    it("requests with request's locale if set", async () => {
      const locale = faker.random.locale();
      await manager.getRootNodesCount({
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        locale,
      });
      interfaceMock.verify((x) => x.getRootNodesCount({
        imodel: testData.imodelToken,
        rulesetId: testData.rulesetId,
        locale,
      }), moq.Times.once());
    });

  });

  describe("getRootNodes", () => {

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      interfaceMock
        .setup((x) => x.getRootNodes(toIModelTokenOptions(options)))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getRootNodes(options);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getRootNodesCount", () => {

    it("requests root nodes count from proxy", async () => {
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getRootNodesCount(toIModelTokenOptions(options)))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getRootNodesCount(options);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getChildren", () => {

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      interfaceMock
        .setup((x) => x.getChildren(toIModelTokenOptions(options), parentNodeKey))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getChildren(options, parentNodeKey);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getChildrenCount", () => {

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getChildrenCount(toIModelTokenOptions(options), parentNodeKey))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getChildrenCount(options, parentNodeKey);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock.setup((x) => x.getFilteredNodePaths(toIModelTokenOptions(options), "filter"))
        .returns(async () => value)
        .verifiable();
      const result = await manager.getFilteredNodePaths(options, "filter");
      expect(value).to.be.deep.equal(result);
      interfaceMock.verifyAll();
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
      interfaceMock.setup((x) => x.getNodePaths(toIModelTokenOptions(options), keyArray, 1))
        .returns(async () => value)
        .verifiable();
      const result = await manager.getNodePaths(options, keyArray, 1);
      expect(value).to.be.deep.equal(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getContentDescriptor", () => {

    it("requests descriptor from proxy and rebuilds parentship", async () => {
      const keyset = new KeySet();
      const descriptorMock = moq.Mock.ofType<Descriptor>();
      moq.configureForPromiseResult(descriptorMock);
      const result = descriptorMock.object;
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getContentDescriptor(toIModelTokenOptions(options), "test", keyset, undefined))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
      descriptorMock.verify((x) => x.rebuildParentship, moq.Times.once());
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getContentDescriptor(toIModelTokenOptions(options), "test", keyset, undefined))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      expect(actualResult).to.be.undefined;
      interfaceMock.verifyAll();
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
      interfaceMock
        .setup((x) => x.getContentSetSize(toIModelTokenOptions(options), moq.It.is((d) => deepEqual(d, descriptor.createStrippedDescriptor())), keyset))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, descriptor, keyset);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getContent", () => {

    it("requests content from proxy and rebuilds descriptor parentship", async () => {
      const keyset = new KeySet();
      const descriptorMock = moq.Mock.ofInstance(createRandomDescriptor());
      descriptorMock.callBase = true;
      const result: Content = {
        descriptor: descriptorMock.object,
        contentSet: [],
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      interfaceMock
        .setup((x) => x.getContent(toIModelTokenOptions(options), moq.It.is((d) => deepEqual(d, descriptorMock.object.createStrippedDescriptor())), keyset))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContent(options, descriptorMock.object, keyset);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
      descriptorMock.verify((x) => x.rebuildParentship(), moq.Times.once());
    });

  });

  describe("getDistinctValues", () => {

    it("requests distinct values", async () => {
      const keyset = new KeySet();
      const descriptorMock = moq.Mock.ofInstance(createRandomDescriptor());
      descriptorMock.callBase = true;
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const result = [faker.random.word(), faker.random.word()];
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getDistinctValues(toIModelTokenOptions(options), moq.It.is((d) => deepEqual(d, descriptorMock.object.createStrippedDescriptor())), keyset, fieldName, maximumValueCount))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDistinctValues(options, descriptorMock.object, keyset, fieldName, maximumValueCount);
      expect(actualResult).to.deep.eq(result);
      interfaceMock.verifyAll();
    });

    it("passes 0 for maximumValueCount by default", async () => {
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetId: testData.rulesetId,
      };
      interfaceMock
        .setup((x) => x.getDistinctValues(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAnyString(), 0))
        .verifiable();
      await manager.getDistinctValues(options, createRandomDescriptor(), new KeySet(), "");
      interfaceMock.verifyAll();
    });
  });

  describe("addRuleSet", () => {

    it("calls addRuleSet through proxy", async () => {
      interfaceMock.setup((x) => x.addRuleSet(testData.presentationRuleSet))
        .verifiable();
      await manager.addRuleSet(testData.presentationRuleSet);
      interfaceMock.verifyAll();
    });

  });

  describe("removeRuleSets", () => {

    it("calls removeRuleSets through proxy", async () => {
      interfaceMock.setup((x) => x.removeRuleSet(testData.presentationRuleSet.ruleSetId))
        .verifiable();
      await manager.removeRuleSet(testData.presentationRuleSet.ruleSetId);
      interfaceMock.verifyAll();
    });

  });

  describe("clearRuleSets", () => {

    it("calls clearRuleSets through proxy", async () => {
      interfaceMock.setup((x) => x.clearRuleSets())
        .verifiable();
      await manager.clearRuleSets();
      interfaceMock.verifyAll();
    });

  });

  describe("settings", () => {

    it("returns settings manager", () => {
      expect(manager.settings).to.be.instanceOf(UserSettingsManager);
    });

  });

});
