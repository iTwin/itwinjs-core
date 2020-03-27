/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import * as sinon from "sinon";
import {
  createRandomECInstancesNodeKeyJSON, createRandomECInstanceKeyJSON,
  createRandomECInstancesNodeJSON, createRandomNodePathElementJSON,
  createRandomContentJSON, createRandomDescriptorJSON,
  createRandomSelectionScope, createRandomLabelDefinitionJSON,
} from "./_helpers/random";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelTokenProps, RpcManager, RpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import {
  RpcRequestsHandler, PresentationRpcInterface,
  KeySet, Paged, SelectionInfo, PresentationStatus,
  HierarchyRequestOptions, ContentRequestOptions, SelectionScopeRequestOptions, PresentationError, LabelRequestOptions,
  PresentationRpcRequestOptions, PresentationRpcResponse,
} from "../presentation-common";

describe("RpcRequestsHandler", () => {

  let clientId: string;
  let defaultRpcOptions: PresentationRpcRequestOptions & { imodel: IModelTokenProps };
  const token: IModelTokenProps = { key: "test", iModelId: "test", contextId: "test" };
  const successResponse = async <TResult>(result: TResult): PresentationRpcResponse<TResult> => ({ statusCode: PresentationStatus.Success, result });
  const errorResponse = async (statusCode: PresentationStatus, errorMessage?: string): PresentationRpcResponse => ({ statusCode, errorMessage, result: undefined });

  beforeEach(() => {
    clientId = faker.random.uuid();
    defaultRpcOptions = { clientId, imodel: token };
  });

  describe("construction", () => {

    let handler: RpcRequestsHandler;

    afterEach(() => {
      if (handler)
        handler.dispose();
    });

    it("uses client id specified through props", () => {
      handler = new RpcRequestsHandler({ clientId });
      expect(handler.clientId).to.eq(clientId);
    });

    it("creates a client if not specified through props", () => {
      handler = new RpcRequestsHandler();
      expect(handler.clientId).to.not.be.empty;
    });

  });

  describe("request", () => {

    let handler: RpcRequestsHandler;

    beforeEach(() => {
      handler = new RpcRequestsHandler();
    });

    afterEach(() => {
      handler.dispose();
    });

    describe("when request succeeds", () => {

      it("returns result of the request", async () => {
        const result = faker.random.number();
        const actualResult = await handler.request(undefined, async () => successResponse(result), defaultRpcOptions);
        expect(actualResult).to.eq(result);
      });

    });

    describe("when request throws unknown exception", () => {

      it("re-throws exception when request throws unknown exception", async () => {
        const func = async () => { throw new Error("test"); };
        await expect(handler.request(undefined, func, defaultRpcOptions)).to.eventually.be.rejectedWith(Error);
      });

    });

    describe("when request returns an unexpected status", () => {

      it("throws an exception", async () => {
        const func = async () => Promise.resolve(errorResponse(PresentationStatus.Error));
        await expect(handler.request(undefined, func, defaultRpcOptions)).to.eventually.be.rejectedWith(PresentationError);
      });

    });

    describe("when request returns a status of BackendTimeout", () => {

      it("returns PresentationError", async () => {
        const func = async () => Promise.resolve(errorResponse(PresentationStatus.BackendTimeout));
        await expect(handler.request(undefined, func, defaultRpcOptions)).to.eventually.be.rejectedWith(PresentationError).and.has.property("errorNumber", 65543);
      });

      it("calls request handler 10 times", async () => {
        const requestHandlerStub = sinon.stub();
        requestHandlerStub.returns(Promise.resolve(errorResponse(PresentationStatus.BackendTimeout)));
        const requestHandlerSpy = sinon.spy(() => requestHandlerStub());

        await expect(handler.request(undefined, requestHandlerSpy, defaultRpcOptions)).to.eventually.be.rejectedWith(PresentationError);
        expect(requestHandlerSpy.callCount).to.be.equal(10);
      });

    });

  });

  describe("requests forwarding to PresentationRpcInterface", () => {

    let handler: RpcRequestsHandler;
    let rpcInterfaceMock: moq.IMock<PresentationRpcInterface>;
    let defaultGetClientForInterfaceImpl: <T extends RpcInterface>(def: RpcInterfaceDefinition<T>) => T;

    before(() => {
      rpcInterfaceMock = moq.Mock.ofType<PresentationRpcInterface>();
      defaultGetClientForInterfaceImpl = RpcManager.getClientForInterface;
      RpcManager.getClientForInterface = (() => rpcInterfaceMock.object) as any;
    });

    after(() => {
      RpcManager.getClientForInterface = defaultGetClientForInterfaceImpl;
    });

    beforeEach(() => {
      handler = new RpcRequestsHandler({ clientId });
      handler.request = async <TResult, TOptions extends PresentationRpcRequestOptions>(context: any, func: (token: IModelTokenProps, options: TOptions, ...args: any[]) => PresentationRpcResponse<TResult>, options: TOptions, ...args: any[]): Promise<TResult> => {
        expect(context).to.eq(rpcInterfaceMock.object);
        const result = await func.apply(context, [token, options, ...args]);
        return result.result!;
      };
      rpcInterfaceMock.reset();
    });

    afterEach(() => {
      handler.dispose();
    });

    it("forwards getNodesAndCount call", async () => {
      const options: Paged<HierarchyRequestOptions<IModelTokenProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = { nodes: [createRandomECInstancesNodeJSON()], count: 1 };
      rpcInterfaceMock.setup(async (x) => x.getNodesAndCount(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesAndCount(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodes call for root nodes", async () => {
      const options: Paged<HierarchyRequestOptions<IModelTokenProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomECInstancesNodeJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodes(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodes(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodes call for child nodes", async () => {
      const parentKey = createRandomECInstancesNodeKeyJSON();
      const options: Paged<HierarchyRequestOptions<IModelTokenProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomECInstancesNodeJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodes(token, rpcOptions, parentKey)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodes(options, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const options: HierarchyRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getNodesCount(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesCount(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const parentKey = createRandomECInstancesNodeKeyJSON();
      const options: HierarchyRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getNodesCount(token, rpcOptions, parentKey)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesCount(options, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const filter = faker.random.word();
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock.setup(async (x) => x.getFilteredNodePaths(token, rpcOptions, filter)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getFilteredNodePaths(options, filter)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const paths = [[createRandomECInstanceKeyJSON()]];
      const markedIndex = faker.random.number();
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodePaths(token, rpcOptions, paths, markedIndex)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodePaths(options, paths, markedIndex)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards loadHierarchy call", async () => {
      const options: HierarchyRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      rpcInterfaceMock.setup(async (x) => x.loadHierarchy(token, rpcOptions)).returns(async () => successResponse(undefined)).verifiable();
      await handler.loadHierarchy(options);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const displayType = faker.random.word();
      const keys = new KeySet().toJSON();
      const selectionInfo: SelectionInfo = { providerName: faker.random.word() };
      const result = createRandomDescriptorJSON();
      rpcInterfaceMock.setup(async (x) => x.getContentDescriptor(token, rpcOptions, displayType, keys, selectionInfo)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentDescriptor(options, displayType, keys, selectionInfo)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getContentSetSize(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentSetSize(options, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRequestOptions<IModelTokenProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = createRandomContentJSON();
      rpcInterfaceMock.setup(async (x) => x.getContent(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContent(options, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentAndSize call", async () => {
      const options: Paged<ContentRequestOptions<IModelTokenProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = { content: createRandomContentJSON(), size: 1 };
      rpcInterfaceMock.setup(async (x) => x.getContentAndSize(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentAndSize(options, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRequestOptions<IModelTokenProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const fieldName = faker.random.word();
      const maxItems = faker.random.number();
      const result = [faker.random.word()];
      rpcInterfaceMock.setup(async (x) => x.getDistinctValues(token, rpcOptions, descriptor, keys, fieldName, maxItems)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDistinctValues(options, descriptor, keys, fieldName, maxItems)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDisplayLabelDefinition call", async () => {
      const key = createRandomECInstanceKeyJSON();
      const options: LabelRequestOptions<IModelTokenProps> = {
        imodel: token,
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = createRandomLabelDefinitionJSON();
      rpcInterfaceMock.setup(async (x) => x.getDisplayLabelDefinition(token, rpcOptions, key)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDisplayLabelDefinition(options, key)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDisplayLabelDefinitions call", async () => {
      const keys = [createRandomECInstanceKeyJSON(), createRandomECInstanceKeyJSON()];
      const options: LabelRequestOptions<IModelTokenProps> = {
        imodel: token,
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomLabelDefinitionJSON(), createRandomLabelDefinitionJSON()];
      rpcInterfaceMock.setup(async (x) => x.getDisplayLabelDefinitions(token, rpcOptions, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDisplayLabelDefinitions(options, keys)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getSelectionScopes call", async () => {
      const options: SelectionScopeRequestOptions<IModelTokenProps> = {
        imodel: token,
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomSelectionScope()];
      rpcInterfaceMock.setup(async (x) => x.getSelectionScopes(token, rpcOptions)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getSelectionScopes(options)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards computeSelection call", async () => {
      const options: SelectionScopeRequestOptions<IModelTokenProps> = {
        imodel: token,
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const ids = new Array<Id64String>();
      const scopeId = faker.random.uuid();
      const result = new KeySet().toJSON();
      rpcInterfaceMock.setup(async (x) => x.computeSelection(token, rpcOptions, ids, scopeId)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.computeSelection(options, ids, scopeId)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

  });

});
