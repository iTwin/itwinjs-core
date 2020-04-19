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
import { IModelRpcProps, RpcManager, RpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import {
  RpcRequestsHandler, PresentationRpcInterface,
  KeySet, Paged, SelectionInfo, PresentationStatus,
  HierarchyRequestOptions, ContentRequestOptions, SelectionScopeRequestOptions, PresentationError, LabelRequestOptions,
  PresentationRpcRequestOptions, PresentationRpcResponse,
} from "../presentation-common";

describe("RpcRequestsHandler", () => {

  let clientId: string;
  let defaultRpcHandlerOptions: { imodel: IModelRpcProps };
  const token: IModelRpcProps = { key: "test", iModelId: "test", contextId: "test" };
  const successResponse = async <TResult>(result: TResult): PresentationRpcResponse<TResult> => ({ statusCode: PresentationStatus.Success, result });
  const errorResponse = async (statusCode: PresentationStatus, errorMessage?: string): PresentationRpcResponse => ({ statusCode, errorMessage, result: undefined });

  beforeEach(() => {
    clientId = faker.random.uuid();
    defaultRpcHandlerOptions = { imodel: token };
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
        const actualResult = await handler.request(undefined, async () => successResponse(result), defaultRpcHandlerOptions);
        expect(actualResult).to.eq(result);
      });

    });

    describe("when request throws unknown exception", () => {

      it("re-throws exception when request throws unknown exception", async () => {
        const func = async () => { throw new Error("test"); };
        await expect(handler.request(undefined, func, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(Error);
      });

    });

    describe("when request returns an unexpected status", () => {

      it("throws an exception", async () => {
        const func = async () => Promise.resolve(errorResponse(PresentationStatus.Error));
        await expect(handler.request(undefined, func, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(PresentationError);
      });

    });

    describe("when request returns a status of BackendTimeout", () => {

      it("returns PresentationError", async () => {
        const func = async () => Promise.resolve(errorResponse(PresentationStatus.BackendTimeout));
        await expect(handler.request(undefined, func, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(PresentationError).and.has.property("errorNumber", 65543);
      });

      it("calls request handler 10 times", async () => {
        const requestHandlerStub = sinon.stub();
        requestHandlerStub.returns(Promise.resolve(errorResponse(PresentationStatus.BackendTimeout)));
        const requestHandlerSpy = sinon.spy(() => requestHandlerStub());

        await expect(handler.request(undefined, requestHandlerSpy, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(PresentationError);
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
      rpcInterfaceMock.reset();
    });

    afterEach(() => {
      handler.dispose();
    });

    it("forwards getNodesAndCount call", async () => {
      const handlerOptions: Paged<HierarchyRequestOptions<IModelRpcProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: PresentationRpcRequestOptions<Paged<HierarchyRequestOptions<any>>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
      };
      const result = { nodes: [createRandomECInstancesNodeJSON()], count: 1 };
      rpcInterfaceMock.setup(async (x) => x.getNodesAndCount(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesAndCount(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodes call for root nodes", async () => {
      const handlerOptions: Paged<HierarchyRequestOptions<IModelRpcProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: PresentationRpcRequestOptions<Paged<HierarchyRequestOptions<any>>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
      };
      const result = [createRandomECInstancesNodeJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodes(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodes(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodes call for child nodes", async () => {
      const parentKey = createRandomECInstancesNodeKeyJSON();
      const handlerOptions: Paged<HierarchyRequestOptions<IModelRpcProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: PresentationRpcRequestOptions<Paged<HierarchyRequestOptions<any>>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
      };
      const result = [createRandomECInstancesNodeJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodes(token, rpcOptions, parentKey)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodes(handlerOptions, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<HierarchyRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getNodesCount(token, rpcOptions, undefined)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesCount(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const parentKey = createRandomECInstancesNodeKeyJSON();
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<HierarchyRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getNodesCount(token, rpcOptions, parentKey)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodesCount(handlerOptions, parentKey)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getFilteredNodePaths call", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<HierarchyRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const filter = faker.random.word();
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock.setup(async (x) => x.getFilteredNodePaths(token, rpcOptions, filter)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getFilteredNodePaths(handlerOptions, filter)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodePaths call", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<HierarchyRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const paths = [[createRandomECInstanceKeyJSON()]];
      const markedIndex = faker.random.number();
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock.setup(async (x) => x.getNodePaths(token, rpcOptions, paths, markedIndex)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getNodePaths(handlerOptions, paths, markedIndex)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards loadHierarchy call", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<HierarchyRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      rpcInterfaceMock.setup(async (x) => x.loadHierarchy(token, rpcOptions)).returns(async () => successResponse(undefined)).verifiable();
      await handler.loadHierarchy(handlerOptions);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentDescriptor call", async () => {
      const handlerOptions: ContentRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<ContentRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const displayType = faker.random.word();
      const keys = new KeySet().toJSON();
      const selectionInfo: SelectionInfo = { providerName: faker.random.word() };
      const result = createRandomDescriptorJSON();
      rpcInterfaceMock.setup(async (x) => x.getContentDescriptor(token, rpcOptions, displayType, keys, selectionInfo)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentDescriptor(handlerOptions, displayType, keys, selectionInfo)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentSetSize call", async () => {
      const handlerOptions: ContentRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<ContentRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = faker.random.number();
      rpcInterfaceMock.setup(async (x) => x.getContentSetSize(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentSetSize(handlerOptions, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContent call", async () => {
      const handlerOptions: Paged<ContentRequestOptions<IModelRpcProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: PresentationRpcRequestOptions<Paged<ContentRequestOptions<any>>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
      };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = createRandomContentJSON();
      rpcInterfaceMock.setup(async (x) => x.getContent(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContent(handlerOptions, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentAndSize call", async () => {
      const handlerOptions: Paged<ContentRequestOptions<IModelRpcProps>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: PresentationRpcRequestOptions<Paged<ContentRequestOptions<any>>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
      };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const result = { content: createRandomContentJSON(), size: 1 };
      rpcInterfaceMock.setup(async (x) => x.getContentAndSize(token, rpcOptions, descriptor, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getContentAndSize(handlerOptions, descriptor, keys)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDistinctValues call", async () => {
      const handlerOptions: ContentRequestOptions<IModelRpcProps> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: PresentationRpcRequestOptions<ContentRequestOptions<any>> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const descriptor = createRandomDescriptorJSON();
      const keys = new KeySet().toJSON();
      const fieldName = faker.random.word();
      const maxItems = faker.random.number();
      const result = [faker.random.word()];
      rpcInterfaceMock.setup(async (x) => x.getDistinctValues(token, rpcOptions, descriptor, keys, fieldName, maxItems)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDistinctValues(handlerOptions, descriptor, keys, fieldName, maxItems)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDisplayLabelDefinition call", async () => {
      const key = createRandomECInstanceKeyJSON();
      const handlerOptions: LabelRequestOptions<IModelRpcProps> = {
        imodel: token,
      };
      const rpcOptions: PresentationRpcRequestOptions<LabelRequestOptions<any>> = {
        clientId,
      };
      const result = createRandomLabelDefinitionJSON();
      rpcInterfaceMock.setup(async (x) => x.getDisplayLabelDefinition(token, rpcOptions, key)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDisplayLabelDefinition(handlerOptions, key)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDisplayLabelDefinitions call", async () => {
      const keys = [createRandomECInstanceKeyJSON(), createRandomECInstanceKeyJSON()];
      const handlerOptions: LabelRequestOptions<IModelRpcProps> = {
        imodel: token,
      };
      const rpcOptions: PresentationRpcRequestOptions<LabelRequestOptions<any>> = {
        clientId,
      };
      const result = [createRandomLabelDefinitionJSON(), createRandomLabelDefinitionJSON()];
      rpcInterfaceMock.setup(async (x) => x.getDisplayLabelDefinitions(token, rpcOptions, keys)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getDisplayLabelDefinitions(handlerOptions, keys)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getSelectionScopes call", async () => {
      const handlerOptions: SelectionScopeRequestOptions<IModelRpcProps> = {
        imodel: token,
      };
      const rpcOptions: PresentationRpcRequestOptions<SelectionScopeRequestOptions<any>> = {
        clientId,
      };
      const result = [createRandomSelectionScope()];
      rpcInterfaceMock.setup(async (x) => x.getSelectionScopes(token, rpcOptions)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.getSelectionScopes(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards computeSelection call", async () => {
      const handlerOptions: SelectionScopeRequestOptions<IModelRpcProps> = {
        imodel: token,
      };
      const rpcOptions: PresentationRpcRequestOptions<SelectionScopeRequestOptions<any>> = {
        clientId,
      };
      const ids = new Array<Id64String>();
      const scopeId = faker.random.uuid();
      const result = new KeySet().toJSON();
      rpcInterfaceMock.setup(async (x) => x.computeSelection(token, rpcOptions, ids, scopeId)).returns(async () => successResponse(result)).verifiable();
      expect(await handler.computeSelection(handlerOptions, ids, scopeId)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

  });

});
