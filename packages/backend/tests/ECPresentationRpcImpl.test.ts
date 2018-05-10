/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { PageOptions, KeySet } from "@common/index";
import { Node } from "@common/hierarchy";
import { Descriptor, Content } from "@common/content";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode } from "@helpers/random/Hierarchy";
import { createRandomDescriptor } from "@helpers/random/Content";
import ECPresentationManager from "@src/ECPresentationManager";
import ECPresentationRpcImpl from "@src/ECPresentationRpcImpl";
import ECPresentation from "@src/ECPresentation";
import "./IModeHostSetup";

describe("ECPresentationRpcImpl", () => {

  afterEach(() => {
    ECPresentation.terminate();
  });

  it("uses default ECPresentationManager implementation if not overridden", () => {
    ECPresentation.initialize();
    const impl = new ECPresentationRpcImpl();
    expect(impl.getManager()).is.instanceof(ECPresentationManager);
  });

  describe("calls forwarding", () => {

    let testData: any;
    const impl = new ECPresentationRpcImpl();
    const mock = moq.Mock.ofType<ECPresentationManager>();
    beforeEach(() => {
      mock.reset();
      ECPresentation.setManager(mock.object);
      testData = {
        imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.ReadWrite, "user id"),
        pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
        displayType: "sample display type",
        inputKeys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
        extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
      };
    });

    describe("setActiveLocale", () => {
      it("sets managers active locale", async () => {
        const locale = faker.locale;
        await impl.setActiveLocale(locale);
        mock.verify((x) => x.activeLocale = moq.It.isValue(locale), moq.Times.once());
      });
    });

    describe("getRootNodes", () => {
      it("calls manager", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        mock.setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
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
        const actualResult = await impl.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
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
        const actualResult = await impl.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions);
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
        const actualResult = await impl.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions);
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
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, testData.displayType,
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
        const actualResult = await impl.getContentSetSize(testData.imodelToken, descriptor,
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
        const actualResult = await impl.getContent(testData.imodelToken, descriptorMock.object,
          testData.inputKeys, testData.pageOptions, testData.extendedOptions);
        mock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(contentMock.object);
      });
    });

  });

});
