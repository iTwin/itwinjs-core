/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, SettingValueTypes } from "@src/index";
import { ECPresentationRpcInterface } from "@src/index";
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

    it("forwards setActiveLocale call", async () => {
      const locale = faker.locale;
      await rpcInterface.setActiveLocale(locale);
      mock.verify((x) => x(locale), moq.Times.once());
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
      await rpcInterface.getRootNodes(testData.imodelToken, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), undefined, {}), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      await rpcInterface.getRootNodesCount(testData.imodelToken, {});
      mock.verify((x) => x(moq.It.isAny(), {}), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(testData.imodelToken, parentKey, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, undefined, {}), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(testData.imodelToken, parentKey, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, {}), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      await rpcInterface.getFilteredNodePaths(testData.imodelToken, "filter", { RulesetId: "id" });
      mock.verify((x) => x(moq.It.isAny(), "filter", { RulesetId: "id" }), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(testData.imodelToken, keys, 1, { RulesetId: "id" });
      mock.verify((x) => x(moq.It.isAny(), keys, 1, { RulesetId: "id" }), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      await rpcInterface.getContentDescriptor(testData.imodelToken, "test", new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), "test", moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContentSetSize(testData.imodelToken, descriptor, new KeySet(), {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), {}), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContent(testData.imodelToken, descriptor, new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      await rpcInterface.getDistinctValues(testData.imodelToken, descriptor, new KeySet(), fieldName, {}, maximumValueCount);
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), fieldName, {}, maximumValueCount), moq.Times.once());
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
