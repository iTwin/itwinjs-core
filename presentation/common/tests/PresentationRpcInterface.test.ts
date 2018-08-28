/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import {
  PresentationRpcInterface,
  KeySet, Paged,
} from "@src/index";
import { VariableValueTypes } from "@src/IRulesetVariablesManager";
import { createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey } from "@helpers/random";
import { RpcRequestOptions, HierarchyRpcRequestOptions, ContentRpcRequestOptions, RulesetRpcRequestOptions, RulesetVariableRpcRequestOptions } from "@src/PresentationRpcInterface";

describe("PresentationRpcInterface", () => {

  describe("calls forwarding", () => {

    let rpcInterface: PresentationRpcInterface;
    let mock: moq.IMock<(<T>(operation: string, ...parameters: any[]) => Promise<T>)>;
    const testData = {
      imodelToken: new IModelToken(),
    };
    const defaultRpcOptions: RpcRequestOptions = { knownBackendIds: [] };

    beforeEach(() => {
      rpcInterface = new PresentationRpcInterface();
      mock = moq.Mock.ofInstance(rpcInterface.forward);
      rpcInterface.forward = mock.object;
    });

    it("forwards getRootNodes call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodes(options);
      mock.verify((x) => x(options as any), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodesCount(options);
      mock.verify((x) => x(options as any), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(options, parentKey);
      mock.verify((x) => x(options as any, parentKey), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(options, parentKey);
      mock.verify((x) => x(options as any, parentKey), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getFilteredNodePaths(options, "filter");
      mock.verify((x) => x(options as any, "filter"), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(options, keys, 1);
      mock.verify((x) => x(options as any, keys, 1), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getContentDescriptor(options, "test", new KeySet(), undefined);
      mock.verify((x) => x(options as any, "test", moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContentSetSize(options, descriptor, new KeySet());
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet)), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContent(options, descriptor, new KeySet());
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        imodel: testData.imodelToken,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      await rpcInterface.getDistinctValues(options, descriptor, new KeySet(), fieldName, maximumValueCount);
      mock.verify((x) => x(options as any, descriptor, moq.It.is((a) => a instanceof KeySet), fieldName, maximumValueCount), moq.Times.once());
    });

    it("forwards getRuleset call", async () => {
      const options: RulesetRpcRequestOptions = { ...defaultRpcOptions, clientId: faker.random.uuid() };
      const ruleset = { id: "", rules: [] };
      const hash = faker.random.uuid();
      mock.setup((x) => x(options as any, ruleset.id)).returns(async () => [ruleset, hash]).verifiable(moq.Times.once());
      const resultTuple = await rpcInterface.getRuleset(options, ruleset.id);
      mock.verifyAll();
      expect(resultTuple![0]).to.deep.eq(ruleset);
      expect(resultTuple![1]).to.deep.eq(hash);
    });

    it("forwards addRuleset call", async () => {
      const options: RulesetRpcRequestOptions = { ...defaultRpcOptions, clientId: faker.random.uuid() };
      const ruleset = { id: "", rules: [] };
      const hash = faker.random.uuid();
      mock.setup((x) => x(options as any, ruleset)).returns(async () => hash).verifiable(moq.Times.once());
      const resultHash = await rpcInterface.addRuleset(options, ruleset);
      mock.verifyAll();
      expect(resultHash).to.eq(hash);
    });

    it("forwards addRulesets call", async () => {
      const options: RulesetRpcRequestOptions = { ...defaultRpcOptions, clientId: faker.random.uuid() };
      const ruleset = { id: "", rules: [] };
      const hash = faker.random.uuid();
      mock.setup((x) => x(options as any, [ruleset])).returns(async () => [hash]).verifiable(moq.Times.once());
      const resultHashes = await rpcInterface.addRulesets(options, [ruleset]);
      mock.verifyAll();
      expect(resultHashes).to.deep.eq([hash]);
    });

    it("forwards removeRuleset call", async () => {
      const options: RulesetRpcRequestOptions = { ...defaultRpcOptions, clientId: faker.random.uuid() };
      mock.setup((x) => x(options as any, "test id", "hash")).returns(async () => true).verifiable(moq.Times.once());
      const result = await rpcInterface.removeRuleset(options, "test id", "hash");
      mock.verifyAll();
      expect(result).to.be.true;
    });

    it("forwards clearRulesets call", async () => {
      const options: RulesetRpcRequestOptions = { ...defaultRpcOptions, clientId: faker.random.uuid() };
      await rpcInterface.clearRulesets(options);
      mock.verify((x) => x(options as any), moq.Times.once());
    });

    it("forwards getRulesetVariableValue call", async () => {
      const rulesetId = faker.random.uuid();
      const variableId = faker.random.uuid();
      const params: RulesetVariableRpcRequestOptions = { ...defaultRpcOptions, clientId: "client id", rulesetId };
      const value = faker.random.words();
      mock.setup((x) => x(params as any, variableId, VariableValueTypes.String)).returns(async () => value).verifiable(moq.Times.once());
      const actualValue = await rpcInterface.getRulesetVariableValue(params, variableId, VariableValueTypes.String);
      mock.verifyAll();
      expect(actualValue).to.eq(value);
    });

    it("forwards setRulesetVariableValue call", async () => {
      const rulesetId = faker.random.uuid();
      const variableId = faker.random.uuid();
      const params: RulesetVariableRpcRequestOptions = { ...defaultRpcOptions, clientId: "client id", rulesetId };
      const value = faker.random.words();
      await rpcInterface.setRulesetVariableValue(params, variableId, VariableValueTypes.String, value);
      mock.verify((x) => x(params as any, variableId, VariableValueTypes.String, value), moq.Times.once());
    });

    it("forwards setRulesetVariableValues call", async () => {
      const rulesetId = faker.random.uuid();
      const variableId = faker.random.uuid();
      const params: RulesetVariableRpcRequestOptions = { ...defaultRpcOptions, clientId: "client id", rulesetId };
      const value = faker.random.words();
      await rpcInterface.setRulesetVariableValues(params, [[variableId, VariableValueTypes.String, value]]);
      mock.verify((x) => x(params as any, [[variableId, VariableValueTypes.String, value]]), moq.Times.once());
    });

  });

});
