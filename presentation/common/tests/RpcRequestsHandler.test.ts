/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import {
  createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey,
  createRandomECInstanceNode, createRandomNodePathElement,
  createRandomContent, createRandomRuleset, createRandomId,
} from "@helpers/random";
import { IModelToken, RpcManager, RpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import {
  PresentationRpcInterface, RpcRequestsHandler,
  KeySet, Paged, SelectionInfo,
  PresentationError, PresentationStatus,
  HierarchyRequestOptions, ContentRequestOptions, Ruleset,
} from "@src/index";
import { VariableValueTypes, VariableValue } from "@src/IRulesetVariablesManager";
import { RpcRequestOptions } from "@src/PresentationRpcInterface";

describe("RpcRequestsHandler", () => {

  describe("construction", () => {

    it("uses client id specified through props", () => {
      const clientId = faker.random.uuid();
      const handler = new RpcRequestsHandler({ clientId });
      expect(handler.clientId).to.eq(clientId);
    });

    it("creates a client if not specified through props", () => {
      const handler = new RpcRequestsHandler();
      expect(handler.clientId).to.not.be.empty;
    });

  });

  describe("doRequest", () => {

    let handler: RpcRequestsHandler;

    beforeEach(() => {
      handler = new RpcRequestsHandler();
    });

    describe("when request succeeds", () => {

      it("returns result of the request", async () => {
        const result = faker.random.number();
        const actualResult = await handler.doRequest(async () => result);
        expect(actualResult).to.eq(result);
      });

    });

    describe("when request throws unkown exception", () => {

      it("re-throws exception when request throws unknown exception", async () => {
        const request = async () => { throw new Error("test"); };
        expect(handler.doRequest(request)).to.eventually.be.rejectedWith(Error);
      });

    });

    describe("when request throws UnknownBackend exception", () => {

      let requestsCount: number;
      let request: () => Promise<number>;
      let backendId: string;

      beforeEach(() => {
        requestsCount = 0;
        backendId = faker.random.uuid();
        request = async () => {
          switch (requestsCount++) {
            case 0: throw new PresentationError(PresentationStatus.UnknownBackend, backendId);
            default: return faker.random.number();
          }
        };
      });

      it("sets backend as known", async () => {
        await handler.doRequest(request);
        expect(handler.knownBackendIds.has(backendId)).to.be.true;
      });

      it("sets backend as known", async () => {
        const syncHandlerMocks = [1, 2].map(() => moq.Mock.ofInstance(() => Promise.resolve()));
        syncHandlerMocks.forEach((mock) => handler.syncHandlers.push(mock.object));
        await handler.doRequest(request);
        syncHandlerMocks.forEach((mock) => mock.verify((x) => x(), moq.Times.once()));
      });

      it("repeats request", async () => {
        await handler.doRequest(request);
        expect(requestsCount).to.eq(2);
      });

      it("re-syncs when sync handler throws UnknownBackend exception", async () => {
        const syncHandlerMock = moq.Mock.ofType<() => Promise<void>>();
        syncHandlerMock.setup((x) => x()).returns(async () => { throw new PresentationError(PresentationStatus.UnknownBackend, backendId); });
        syncHandlerMock.setup((x) => x()).returns(() => Promise.resolve());
        handler.syncHandlers.push(syncHandlerMock.object);
        await handler.doRequest(request);
        syncHandlerMock.verify((x) => x(), moq.Times.exactly(2));
      });

    });

  });

  describe("requests forwarding to PresentationRpcInterface", () => {

    let clientId: string;
    let handler: RpcRequestsHandler;
    let rpcInterfaceMock: moq.IMock<PresentationRpcInterface>;
    let defaultGetClientForInterfaceImpl: <T extends RpcInterface>(def: RpcInterfaceDefinition<T>) => T;
    let defaultRpcOptions: RpcRequestOptions;
    const token = new IModelToken();

    before(() => {
      rpcInterfaceMock = moq.Mock.ofType<PresentationRpcInterface>();
      defaultGetClientForInterfaceImpl = RpcManager.getClientForInterface;
      RpcManager.getClientForInterface = (() => rpcInterfaceMock.object) as any;
    });

    after(() => {
      RpcManager.getClientForInterface = defaultGetClientForInterfaceImpl;
    });

    beforeEach(() => {
      clientId = faker.random.uuid();
      defaultRpcOptions = { knownBackendIds: [], clientId };
      handler = new RpcRequestsHandler({ clientId });
      handler.doRequest = (r) => r();
      rpcInterfaceMock.reset();
    });

    it("forwards getRootNodes call", async () => {
      const options: Paged<HierarchyRequestOptions<IModelToken>> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomECInstanceNode()];
      rpcInterfaceMock.setup((x) => x.getRootNodes(rpcOptions)).returns(async () => result).verifiable();
      expect(await handler.getRootNodes(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getRootNodesCount call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = faker.random.number();
      rpcInterfaceMock.setup((x) => x.getRootNodesCount(rpcOptions)).returns(async () => result).verifiable();
      expect(await handler.getRootNodesCount(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getChildren call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      const options: Paged<HierarchyRequestOptions<IModelToken>> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomECInstanceNode()];
      rpcInterfaceMock.setup((x) => x.getChildren(rpcOptions, parentKey)).returns(async () => result).verifiable();
      expect(await handler.getChildren(options, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getChildrenCount call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = faker.random.number();
      rpcInterfaceMock.setup((x) => x.getChildrenCount(rpcOptions, parentKey)).returns(async () => result).verifiable();
      expect(await handler.getChildrenCount(options, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const filter = faker.random.word();
      const result = [createRandomNodePathElement()];
      rpcInterfaceMock.setup((x) => x.getFilteredNodePaths(rpcOptions, filter)).returns(async () => result).verifiable();
      expect(await handler.getFilteredNodePaths(options, filter)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const paths = [[createRandomECInstanceKey()]];
      const markedIndex = faker.random.number();
      const result = [createRandomNodePathElement()];
      rpcInterfaceMock.setup((x) => x.getNodePaths(rpcOptions, paths, markedIndex)).returns(async () => result).verifiable();
      expect(await handler.getNodePaths(options, paths, markedIndex)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const displayType = faker.random.word();
      const keys = new KeySet();
      const selectionInfo: SelectionInfo = { providerName: faker.random.word() };
      const result = createRandomDescriptor();
      rpcInterfaceMock.setup((x) => x.getContentDescriptor(rpcOptions, displayType, keys, selectionInfo)).returns(async () => result).verifiable();
      expect(await handler.getContentDescriptor(options, displayType, keys, selectionInfo)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      const result = faker.random.number();
      rpcInterfaceMock.setup((x) => x.getContentSetSize(rpcOptions, descriptor, keys)).returns(async () => result).verifiable();
      expect(await handler.getContentSetSize(options, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRequestOptions<IModelToken>> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      const result = createRandomContent();
      rpcInterfaceMock.setup((x) => x.getContent(rpcOptions, descriptor, keys)).returns(async () => result).verifiable();
      expect(await handler.getContent(options, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRequestOptions<IModelToken> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      const fieldName = faker.random.word();
      const maxItems = faker.random.number();
      const result = [faker.random.word()];
      rpcInterfaceMock.setup((x) => x.getDistinctValues(rpcOptions, descriptor, keys, fieldName, maxItems)).returns(async () => result).verifiable();
      expect(await handler.getDistinctValues(options, descriptor, keys, fieldName, maxItems)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getRuleset call", async () => {
      const rpcOptions = { ...defaultRpcOptions };
      const ruleset = await createRandomRuleset();
      const result: [Ruleset, string] = [ruleset, faker.random.uuid()];
      rpcInterfaceMock.setup((x) => x.getRuleset(rpcOptions, ruleset.id)).returns(async () => result).verifiable();
      expect(await handler.getRuleset(ruleset.id)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards addRuleset call", async () => {
      const rpcOptions = { ...defaultRpcOptions };
      const ruleset = await createRandomRuleset();
      const result = faker.random.uuid();
      rpcInterfaceMock.setup((x) => x.addRuleset(rpcOptions, ruleset)).returns(async () => result).verifiable();
      expect(await handler.addRuleset(ruleset)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards addRulesets call", async () => {
      const rpcOptions = { ...defaultRpcOptions };
      const ruleset = await createRandomRuleset();
      const result = [faker.random.uuid()];
      rpcInterfaceMock.setup((x) => x.addRulesets(rpcOptions, [ruleset])).returns(async () => result).verifiable();
      expect(await handler.addRulesets([ruleset])).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards removeRuleset call", async () => {
      const rpcOptions = { ...defaultRpcOptions };
      const rulesetId = faker.random.word();
      const rulesetHash = faker.random.uuid();
      const result = faker.random.boolean();
      rpcInterfaceMock.setup((x) => x.removeRuleset(rpcOptions, rulesetId, rulesetHash)).returns(async () => result).verifiable();
      expect(await handler.removeRuleset(rulesetId, rulesetHash)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards clearRulesets call", async () => {
      const rpcOptions = { ...defaultRpcOptions };
      rpcInterfaceMock.setup((x) => x.clearRulesets(rpcOptions)).verifiable();
      await handler.clearRulesets();
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getRulesetVariableValue call", async () => {
      const rulesetId = faker.random.uuid();
      const rpcOptions = { ...defaultRpcOptions, rulesetId };
      const varId = faker.random.word();
      const varType = VariableValueTypes.Int;
      const result = faker.random.number();
      rpcInterfaceMock.setup((x) => x.getRulesetVariableValue(rpcOptions, varId, varType)).returns(async () => result).verifiable();
      expect(await handler.getRulesetVariableValue(rulesetId, varId, varType)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards setRulesetVariableValue call", async () => {
      const rulesetId = faker.random.uuid();
      const rpcOptions = { ...defaultRpcOptions, rulesetId };
      const varId = faker.random.word();
      const varType = VariableValueTypes.Int;
      const varValue = faker.random.number();
      rpcInterfaceMock.setup((x) => x.setRulesetVariableValue(rpcOptions, varId, varType, varValue)).verifiable();
      await handler.setRulesetVariableValue(rulesetId, varId, varType, varValue);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards setRulesetVariableValues call", async () => {
      const rulesetId = faker.random.uuid();
      const rpcOptions = { ...defaultRpcOptions, rulesetId };
      const values: Array<[string, VariableValueTypes, VariableValue]> = [[faker.random.word(), VariableValueTypes.Id64, createRandomId().value]];
      rpcInterfaceMock.setup((x) => x.setRulesetVariableValues(rpcOptions, values)).verifiable();
      await handler.setRulesetVariableValues(rulesetId, values);
      rpcInterfaceMock.verifyAll();
    });

  });

});
