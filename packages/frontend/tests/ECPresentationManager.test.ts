/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
const deepEqual = require("deep-equal"); // tslint:disable-line:no-var-requires
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, Content, Descriptor, ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { ECPresentationManager } from "@src/index";
import { createRandomDescriptor } from "@helpers/random/Content";
import { createRandomECInstanceNode, createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("ECPresentationManager", () => {

  let interfaceMock: moq.IMock<ECPresentationRpcInterface>;
  let manager: ECPresentationManager;
  const testData = {
    imodelToken: new IModelToken(),
    pageOptions: { pageStart: 1, pageSize: 2 },
    extendedData: { some: "test object" },
  };

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);
    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
    manager = new ECPresentationManager();
  });

  describe("getRootNodes", () => {

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstanceNode(), createRandomECInstanceNode()];
      interfaceMock
        .setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.pageOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getRootNodes(testData.imodelToken, testData.pageOptions, testData.pageOptions);
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
      const actualResult = await manager.getRootNodesCount(testData.imodelToken, testData.pageOptions);
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
      const actualResult = await manager.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.pageOptions);
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
      const actualResult = await manager.getChildrenCount(testData.imodelToken, parentNodeKey, testData.pageOptions);
      expect(actualResult).to.eq(result);
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
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await manager.getContentDescriptor(testData.imodelToken, "test", keyset, undefined, testData.extendedData);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
      descriptorMock.verify((x) => x.rebuildParentship, moq.Times.once());
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
      const actualResult = await manager.getContentSetSize(testData.imodelToken, descriptor, keyset, testData.extendedData);
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
      const actualResult = await manager.getContent(testData.imodelToken, descriptorMock.object, keyset, testData.pageOptions, testData.extendedData);
      expect(actualResult).to.eq(result);
      interfaceMock.verifyAll();
      descriptorMock.verify((x) => x.rebuildParentship(), moq.Times.once());
    });

  });

});
