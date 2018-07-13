/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import { PageOptions, KeySet, SettingValueTypes, ECPresentationError, InstanceKey } from "@common/index";
import { Node } from "@common/hierarchy";
import { Descriptor, Content } from "@common/content";
import {
  createRandomECInstanceKey,
  createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement,
  createRandomDescriptor,
} from "@helpers/random";
import ECPresentationManager from "@src/ECPresentationManager";
import ECPresentationRpcImpl from "@src/ECPresentationRpcImpl";
import ECPresentation from "@src/ECPresentation";
import UserSettingsManager from "@src/UserSettingsManager";
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
    const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
    const settingsMock = moq.Mock.ofType<UserSettingsManager>();

    beforeEach(() => {
      settingsMock.reset();
      presentationManagerMock.reset();
      presentationManagerMock.setup((x) => x.settings).returns(() => settingsMock.object);
      ECPresentation.setManager(presentationManagerMock.object);
      testData = {
        imodelToken: new IModelToken(),
        imodelMock: moq.Mock.ofType<IModelDb>(),
        pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
        displayType: "sample display type",
        inputKeys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
        extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
      };
      testData.imodelMock.setup((x: IModelDb) => x.iModelToken).returns(() => testData.imodelToken);
      IModelDb.find = () => testData.imodelMock.object;
    });

    it("throws when using invalid imodel token", async () => {
      IModelDb.find = () => undefined as any;
      const request = impl.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      await expect(request).to.eventually.be.rejectedWith(ECPresentationError);
    });

    describe("setActiveLocale", () => {
      it("sets managers active locale", async () => {
        const locale = faker.locale;
        await impl.setActiveLocale(locale);
        presentationManagerMock.verify((x) => x.activeLocale = moq.It.isValue(locale), moq.Times.once());
      });
    });

    describe("addRuleSet", () => {
      it("calls manager", async () => {
        presentationManagerMock.setup((x) => x.addRuleSet(moq.It.isAny())).verifiable();
        await impl.addRuleSet({ ruleSetId: "" });
        presentationManagerMock.verifyAll();
      });
    });

    describe("removeRuleSet", () => {
      it("calls manager", async () => {
        presentationManagerMock.setup((x) => x.removeRuleSet(moq.It.isAny())).verifiable();
        await impl.removeRuleSet("");
        presentationManagerMock.verifyAll();
      });
    });

    describe("clearRuleSets", () => {
      it("calls manager", async () => {
        presentationManagerMock.setup((x) => x.clearRuleSets()).verifiable();
        await impl.clearRuleSets();
        presentationManagerMock.verifyAll();
      });
    });

    describe("getRootNodes", () => {
      it("calls manager", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        presentationManagerMock.setup((x) => x.getRootNodes(testData.imodelMock.object, testData.pageOptions, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });
    });

    describe("getRootNodesCount", () => {
      it("calls manager", async () => {
        const result = 999;
        presentationManagerMock.setup((x) => x.getRootNodesCount(testData.imodelMock.object, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.eq(result);
      });
    });

    describe("getChildren", () => {
      it("calls manager", async () => {
        const parentNodeKey = createRandomECInstanceNodeKey();
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        presentationManagerMock.setup((x) => x.getChildren(testData.imodelMock.object, parentNodeKey, testData.pageOptions, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });
    });

    describe("getChildrenCount", () => {
      it("calls manager", async () => {
        const parentNodeKey = createRandomECInstanceNodeKey();
        const result = 999;
        presentationManagerMock.setup((x) => x.getChildrenCount(testData.imodelMock.object, parentNodeKey, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.eq(result);
      });
    });

    describe("getFilteredNodePaths", () => {
      it("calls manager", async () => {
        const nodePathElementMock = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        presentationManagerMock.setup((x) => x.getFilteredNodePaths(testData.imodelMock.object, "filter", moq.It.isAny()))
          .returns(async () => nodePathElementMock)
          .verifiable();
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, "filter", { RulesetId: "id" });
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.equal(nodePathElementMock);
      });
    });

    describe("getNodePaths", () => {
      it("calls manager", async () => {
        const nodePathElementMock = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const keyArray: InstanceKey[][] = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        presentationManagerMock.setup((x) => x.getNodePaths(testData.imodelMock.object, keyArray, 1, { RulesetId: "id" }))
          .returns(async () => nodePathElementMock)
          .verifiable();
        const actualResult = await impl.getNodePaths(testData.imodelToken, keyArray, 1, { RulesetId: "id" });
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.equal(nodePathElementMock);
      });
    });

    describe("getContentDescriptor", () => {
      it("calls manager and resets descriptors parentship", async () => {
        const descriptorMock = moq.Mock.ofType<Descriptor>();
        moq.configureForPromiseResult(descriptorMock);
        descriptorMock.setup((x) => x.resetParentship).verifiable();
        const result = descriptorMock.object;
        presentationManagerMock.setup((x) => x.getContentDescriptor(testData.imodelMock.object, testData.displayType, testData.inputKeys, undefined, testData.extendedOptions))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, testData.displayType,
          testData.inputKeys, undefined, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(result);
      });
      it("handles undefined descriptor response", async () => {
        presentationManagerMock.setup((x) => x.getContentDescriptor(testData.imodelMock.object, testData.displayType, testData.inputKeys, undefined, testData.extendedOptions))
          .returns(async () => undefined)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, testData.displayType,
          testData.inputKeys, undefined, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.be.undefined;
      });
    });

    describe("getContentSetSize", () => {
      it("calls manager", async () => {
        const descriptor: Descriptor = createRandomDescriptor();
        const result = 789;
        presentationManagerMock.setup((x) => x.getContentSetSize(testData.imodelMock.object, descriptor, testData.inputKeys, testData.extendedOptions))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getContentSetSize(testData.imodelToken, descriptor,
          testData.inputKeys, testData.extendedOptions);
        presentationManagerMock.verifyAll();
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
        presentationManagerMock.setup((x) => x.getContent(testData.imodelMock.object, descriptorMock.object, testData.inputKeys, testData.pageOptions, testData.extendedOptions))
          .returns(async () => contentMock.object)
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, descriptorMock.object,
          testData.inputKeys, testData.pageOptions, testData.extendedOptions);
        presentationManagerMock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(contentMock.object);
      });
    });

    describe("getDistinctValues", () => {
      it("calls manager", async () => {
        const descriptor = createRandomDescriptor();
        const fieldName = faker.random.word();
        const maximumValueCount = faker.random.number();
        const distinctValues = [faker.random.word(), faker.random.word()];
        presentationManagerMock.setup((x) => x.getDistinctValues(testData.imodelMock.object, descriptor, testData.inputKeys, fieldName, testData.extendedOptions, maximumValueCount))
          .returns(async () => distinctValues)
          .verifiable();
        const actualResult = await impl.getDistinctValues(testData.imodelToken, descriptor,
          testData.inputKeys, fieldName, testData.extendedOptions, maximumValueCount);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(distinctValues);
      });
    });

    describe("setUserSettingValue", () => {
      it("calls settings manager", async () => {
        settingsMock.setup((x) => x.setValue("rulesetId", "settingId", { value: "", type: SettingValueTypes.String }))
          .verifiable();

        await impl.setUserSettingValue("rulesetId", "settingId", { value: "", type: SettingValueTypes.String });
        settingsMock.verifyAll();
      });
    });

    describe("getUserSettingValue", () => {
      it("calls settings manager", async () => {
        const value = faker.random.word();
        settingsMock.setup((x) => x.getValue("rulesetId", "settingId", SettingValueTypes.String))
          .returns(async () => value)
          .verifiable();

        const result = await impl.getUserSettingValue("rulesetId", "settingId", SettingValueTypes.String);
        expect(result).to.be.equal(value);
        settingsMock.verifyAll();
      });
    });

  });

});
