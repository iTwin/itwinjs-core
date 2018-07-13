/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
const deepEqual = require("deep-equal"); // tslint:disable-line:no-var-requires
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, Content, Descriptor, ECPresentationRpcInterface } from "@common/index";
import { ECPresentationManager } from "@src/index";
import UserSettingsManager from "@src/UserSettingsManager";
import {
  createRandomDescriptor,
  createRandomECInstanceNode, createRandomECInstanceNodeKey, createRandomNodePathElement,
  createRandomECInstanceKey,
} from "@helpers/random";
import { initializeRpcInterface } from "@helpers/RpcHelper";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend";

describe("ECPresentationManager", () => {

  let interfaceMock: moq.IMock<ECPresentationRpcInterface>;
  let manager: ECPresentationManager;
  const testData = {
    imodelToken: new IModelToken(),
    imodelMock: moq.Mock.ofType<IModelConnection>(),
    pageOptions: { pageStart: 1, pageSize: 2 },
    extendedData: { some: "test object" },
    presentationRuleSet: { ruleSetId: "testRuleset" },
  };

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);
    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
    testData.imodelMock.setup((x) => x.iModelToken).returns(() => testData.imodelToken);
    manager = ECPresentationManager.create();
  });

  describe("constructor", () => {

    it("sets active locale if supplied with props", async () => {
      const props = { activeLocale: faker.locale };
      const mgr = ECPresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

  });

  describe("activeLocale", () => {

    it("calls gateway when locale changes", async () => {
      const locale = faker.locale;
      manager.activeLocale = locale;
      expect(manager.activeLocale).to.eq(locale);
      interfaceMock.verify((x) => x.setActiveLocale(locale), moq.Times.once());
    });

    it("doesn't call gateway when locale doesn't change", async () => {
      manager.activeLocale = manager.activeLocale;
      interfaceMock.verify((x) => x.setActiveLocale(moq.It.isAny()), moq.Times.never());
    });

  });

  describe("getRootNodes", () => {

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      interfaceMock
        .setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.pageOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getRootNodes(testData.imodelMock.object, testData.pageOptions, testData.pageOptions);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getRootNodesCount", () => {

    it("requests root nodes count from proxy", async () => {
      const result = faker.random.number();
      interfaceMock
        .setup((x) => x.getRootNodesCount(testData.imodelToken, testData.pageOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getRootNodesCount(testData.imodelMock.object, testData.pageOptions);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getChildren", () => {

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      interfaceMock
        .setup((x) => x.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.pageOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getChildren(testData.imodelMock.object, parentNodeKey, testData.pageOptions, testData.pageOptions);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getChildrenCount", () => {

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = faker.random.number();
      interfaceMock
        .setup((x) => x.getChildrenCount(testData.imodelToken, parentNodeKey, testData.pageOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getChildrenCount(testData.imodelMock.object, parentNodeKey, testData.pageOptions);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      interfaceMock.setup((x) => x.getFilteredNodePaths(testData.imodelToken, "filter", testData.extendedData))
        .returns(async () => value)
        .verifiable();
      const result = await manager.getFilteredNodePaths(testData.imodelMock.object, "filter", testData.extendedData);
      expect(value).to.be.deep.equal(result);
      interfaceMock.verifyAll();
    });

  });

  describe("getNodePaths", () => {

    it("calls getNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const keyArray = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      interfaceMock.setup((x) => x.getNodePaths(testData.imodelToken, keyArray, 1, testData.extendedData))
        .returns(async () => value)
        .verifiable();
      const result = await manager.getNodePaths(testData.imodelMock.object, keyArray, 1, testData.extendedData);
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
      interfaceMock
        .setup((x) => x.getContentDescriptor(testData.imodelToken, "test", keyset, undefined, testData.extendedData))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(testData.imodelMock.object, "test", keyset, undefined, testData.extendedData);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
      descriptorMock.verify((x) => x.rebuildParentship, moq.Times.once());
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      interfaceMock
        .setup((x) => x.getContentDescriptor(testData.imodelToken, "test", keyset, undefined, testData.extendedData))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(testData.imodelMock.object, "test", keyset, undefined, testData.extendedData);
      expect(actualResult).to.be.undefined;
      interfaceMock.verifyAll();
    });

  });

  describe("getContentSetSize", () => {

    it("requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = faker.random.number();
      interfaceMock
        .setup((x) => x.getContentSetSize(testData.imodelToken, moq.It.is((d) => deepEqual(d, descriptor.createStrippedDescriptor())), keyset, testData.extendedData))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getContentSetSize(testData.imodelMock.object, descriptor, keyset, testData.extendedData);
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
      interfaceMock
        .setup((x) => x.getContent(testData.imodelToken, moq.It.is((d) => deepEqual(d, descriptorMock.object.createStrippedDescriptor())), keyset, testData.pageOptions, testData.extendedData))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getContent(testData.imodelMock.object, descriptorMock.object, keyset, testData.pageOptions, testData.extendedData);
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
      interfaceMock
        .setup((x) => x.getDistinctValues(testData.imodelToken, moq.It.is((d) => deepEqual(d, descriptorMock.object.createStrippedDescriptor())), keyset, fieldName, testData.extendedData, maximumValueCount))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDistinctValues(testData.imodelMock.object, descriptorMock.object, keyset, fieldName, testData.extendedData, maximumValueCount);
      expect(actualResult).to.deep.eq(result);
      interfaceMock.verifyAll();
    });

    it("passes 0 for maximumValueCount by default", async () => {
      interfaceMock
        .setup((x) => x.getDistinctValues(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAnyString(), moq.It.isAny(), 0))
        .verifiable();
      await manager.getDistinctValues(testData.imodelMock.object, createRandomDescriptor(), new KeySet(), "", {});
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
