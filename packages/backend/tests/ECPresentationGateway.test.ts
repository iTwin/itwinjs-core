/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { OpenMode } from "@bentley/bentleyjs-core";
import { Gateway, IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition, PageOptions, KeySet } from "@common/index";
import { Node } from "@common/hierarchy";
import { Descriptor, Content } from "@common/content";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode } from "@helpers/random/Hierarchy";
import { createRandomDescriptor } from "@helpers/random/Content";
import { initializeGateway } from "@helpers/GatewayHelper";
import ECPresentationManager from "@src/ECPresentationManager";
import ECPresentationGateway from "@src/ECPresentationGateway";
import ECPresentation from "@src/ECPresentation";

describe("ECPresentationGateway", () => {

  beforeEach(() => {
    ECPresentation.terminate();
  });

  it("is registered after calling ECPresentation.initialize", () => {
    ECPresentation.initialize();
    initializeGateway(ECPresentationGateway);
    const impl = Gateway.getProxyForGateway(ECPresentationGatewayDefinition);
    expect(impl).is.not.null;
    expect(impl).is.instanceof(ECPresentationGateway);
  });

  it("uses default ECPresentationManager implementation if not overridden", () => {
    ECPresentation.initialize();
    const gateway = new ECPresentationGateway();
    expect(gateway.getManager()).is.instanceof(ECPresentationManager);
  });

  describe("calls forwarding", () => {

    let testData: any;
    const gateway = new ECPresentationGateway();
    const mock = moq.Mock.ofType<ECPresentationManager>();
    beforeEach(() => {
      mock.reset();
      ECPresentation.manager = mock.object;
      testData = {
        imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.ReadWrite, "user id"),
        pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
        displayType: "sample display type",
        inputKeys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
        extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
      };
    });

    describe("getRootNodes", () => {
      it("calls manager", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        mock.setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await gateway.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
        mock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });
    });

    describe("getRootNodesCount", () => {
      it("calls manager", async () => {
        const result = 999;
        mock.setup((x) => x.getRootNodesCount(testData.imodelToken, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await gateway.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
        mock.verifyAll();
        expect(actualResult).to.eq(result);
      });
    });

    describe("getChildren", () => {
      it("calls manager", async () => {
        const parentNodeKey = createRandomECInstanceNodeKey();
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        mock.setup((x) => x.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await gateway.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions);
        mock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });
    });

    describe("getChildrenCount", () => {
      it("calls manager", async () => {
        const parentNodeKey = createRandomECInstanceNodeKey();
        const result = 999;
        mock.setup((x) => x.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await gateway.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions);
        mock.verifyAll();
        expect(actualResult).to.eq(result);
      });
    });

    describe("getContentDescriptor", () => {
      it("calls manager and resets descriptors parentship", async () => {
        const descriptorMock = moq.Mock.ofType<Descriptor>();
        moq.configureForPromiseResult(descriptorMock);
        descriptorMock.setup((x) => x.resetParentship).verifiable();
        const result = descriptorMock.object;
        mock.setup((x) => x.getContentDescriptor(testData.imodelToken, testData.displayType, testData.inputKeys, undefined, testData.extendedOptions))
          .returns(async () => result)
          .verifiable();
        const actualResult = await gateway.getContentDescriptor(testData.imodelToken, testData.displayType,
          testData.inputKeys, undefined, testData.extendedOptions);
        mock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(result);
      });
    });

    describe("getContentSetSize", () => {
      it("calls manager", async () => {
        const descriptor: Descriptor = createRandomDescriptor();
        const result = 789;
        mock.setup((x) => x.getContentSetSize(testData.imodelToken, descriptor, testData.inputKeys, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await gateway.getContentSetSize(testData.imodelToken, descriptor,
          testData.inputKeys, testData.extendedOptions);
        mock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });
    });

    describe("getContent", () => {
      it("calls manager", async () => {
        const descriptorMock = moq.Mock.ofType<Descriptor>();
        descriptorMock.setup((x) => x.resetParentship).verifiable();
        const contentMock = moq.Mock.ofType<Content>();
        moq.configureForPromiseResult(contentMock);
        contentMock.setup((x) => x.descriptor).returns(() => descriptorMock.object);
        contentMock.setup((x) => x.contentSet).returns(() => []);
        mock.setup((x) => x.getContent(testData.imodelToken, descriptorMock.object, testData.inputKeys, testData.pageOptions, testData.extendedOptions))
          .returns(async () => contentMock.object)
          .verifiable();
        const actualResult = await gateway.getContent(testData.imodelToken, descriptorMock.object,
          testData.inputKeys, testData.pageOptions, testData.extendedOptions);
        mock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(contentMock.object);
      });
    });

  });

});
