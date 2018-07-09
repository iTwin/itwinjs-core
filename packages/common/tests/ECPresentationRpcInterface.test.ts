/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import {
  ECPresentationRpcInterface,
  KeySet, SettingValueTypes,
  Paged, HierarchyRequestOptions, ContentRequestOptions,
} from "@src/index";
import { createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey } from "@helpers/random";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("ECPresentationRpcInterface", () => {

  describe("getClient", () => {

    it("throws when not registered", () => {
      expect(() => ECPresentationRpcInterface.getClient()).to.throw();
    });

    it("returns interface when registered", () => {
      initializeRpcInterface(ECPresentationRpcInterface);
      const proxy = ECPresentationRpcInterface.getClient();
      expect(proxy).is.instanceof(ECPresentationRpcInterface);
    });

  });

  describe("calls forwarding", () => {

    let rpcInterface: ECPresentationRpcInterface;
    let mock: moq.IMock<(<T>(operation: string, ...parameters: any[]) => Promise<T>)>;
    const testData = {
      imodelToken: new IModelToken(),
    };

    beforeEach(() => {
      rpcInterface = new ECPresentationRpcInterface();
      mock = moq.Mock.ofInstance(rpcInterface.forward);
      rpcInterface.forward = mock.object;
    });

    it("forwards addRuleSet call", async () => {
      const ruleset = { ruleSetId: "" };
      await rpcInterface.addRuleSet(ruleset);
      mock.verify((x) => x((ruleset as any)), moq.Times.once());
    });

    it("forwards removeRuleSet call", async () => {
      await rpcInterface.removeRuleSet("test id");
      mock.verify((x) => x("test id"), moq.Times.once());
    });

    it("forwards clearRuleSets call", async () => {
      await rpcInterface.clearRuleSets();
      mock.verify((x) => x((undefined as any)), moq.Times.once());
    });

    it("forwards getRootNodes call", async () => {
      const options: Paged<HierarchyRequestOptions<IModelToken>> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodes(options);
      mock.verify((x) => x(options as any), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodesCount(options);
      mock.verify((x) => x(options as any), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const options: Paged<HierarchyRequestOptions<IModelToken>> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(options, parentKey);
      mock.verify((x) => x(options as any, parentKey), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(options, parentKey);
      mock.verify((x) => x(options as any, parentKey), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getFilteredNodePaths(options, "filter");
      mock.verify((x) => x(options as any, "filter"), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(options, keys, 1);
      mock.verify((x) => x(options as any, keys, 1), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getContentDescriptor(options, "test", new KeySet(), undefined);
      mock.verify((x) => x(options as any, "test", moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContentSetSize(options, descriptor, new KeySet());
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet)), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRequestOptions<IModelToken>> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContent(options, descriptor, new KeySet());
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      await rpcInterface.getDistinctValues(options, descriptor, new KeySet(), fieldName, maximumValueCount);
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet), fieldName, maximumValueCount), moq.Times.once());
    });

    it("forwards setUserSettingValue call", async () => {
      await rpcInterface.setUserSettingValue("rulesetId", "settingId", { value: "", type: SettingValueTypes.String });
      mock.verify((x) => x("rulesetId", "settingId", { value: "", type: SettingValueTypes.String }), moq.Times.once());
    });

    it("forwards getUserSettingValue call", async () => {
      await rpcInterface.getUserSettingValue("rulesetId", "settingId", SettingValueTypes.String);
      mock.verify((x) => x("rulesetId", "settingId", SettingValueTypes.String), moq.Times.once());
    });

  });

});
