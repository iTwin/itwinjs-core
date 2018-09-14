/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import {
  createRandomECInstanceNodeKey, createRandomECInstanceKey,
  createRandomECInstanceNode, createRandomNodePathElement,
  createRandomContent, createRandomDescriptor,
} from "./_helpers/random";
import { BeEvent, using } from "@bentley/bentleyjs-core";
import { IModelToken, RpcManager, RpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import {
  RpcRequestsHandler, PresentationRpcInterface,
  KeySet, Paged, SelectionInfo,
  PresentationError, PresentationStatus,
  HierarchyRequestOptions, ContentRequestOptions,
} from "../lib";
import { RpcRequestOptions, ClientStateSyncRequestOptions } from "../lib/PresentationRpcInterface";
import { IClientStateHolder } from "../lib/RpcRequestsHandler";

describe("RpcRequestsHandler", () => {

  let clientId: string;
  let defaultRpcOptions: RpcRequestOptions & { imodel: IModelToken };
  const token = new IModelToken();

  beforeEach(() => {
    clientId = faker.random.uuid();
    defaultRpcOptions = { clientId, clientStateId: undefined, imodel: token };
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

  describe("dispose", () => {

    it("unregisters itself from listening for client state changes", () => {
      const holder: IClientStateHolder<number> = {
        key: faker.random.word(),
        state: undefined,
        onStateChanged: new BeEvent<() => void>(),
      };
      const handler = new RpcRequestsHandler();
      handler.registerClientStateHolder(holder);
      expect(holder.onStateChanged.numberOfListeners).to.eq(1);
      handler.dispose();
      expect(holder.onStateChanged.numberOfListeners).to.eq(0);
    });

  });

  describe("registerClientStateHolder", () => {

    it("registers itself for listening for client state changes", () => {
      const holder: IClientStateHolder<number> = {
        key: faker.random.word(),
        state: undefined,
        onStateChanged: new BeEvent<() => void>(),
      };
      using(new RpcRequestsHandler(), (handler) => {
        handler.registerClientStateHolder(holder);
        expect(holder.onStateChanged.numberOfListeners).to.eq(1);
      });
    });

  });

  describe("unregisterClientStateHolder", () => {

    it("unregisters itself from listening for client state changes", () => {
      const holders = [1, 2].map((): IClientStateHolder<number> => ({
        key: faker.random.word(),
        state: faker.random.number(),
        onStateChanged: new BeEvent<() => void>(),
      }));
      using(new RpcRequestsHandler(), (handler) => {
        holders.forEach((h) => handler.registerClientStateHolder(h));
        holders.forEach((h) => expect(h.onStateChanged.numberOfListeners).to.eq(1));
        handler.unregisterClientStateHolder(holders[1]);
        expect(holders[0].onStateChanged.numberOfListeners).to.eq(1);
        expect(holders[1].onStateChanged.numberOfListeners).to.eq(0);
      });
    });

    it("handles the case when trying to unregister not registered holder", () => {
      const holder: IClientStateHolder<number> = {
        key: faker.random.word(),
        state: faker.random.number(),
        onStateChanged: new BeEvent<() => void>(),
      };
      using(new RpcRequestsHandler(), (handler) => {
        expect(holder.onStateChanged.numberOfListeners).to.eq(0);
        handler.unregisterClientStateHolder(holder);
        expect(holder.onStateChanged.numberOfListeners).to.eq(0);
      });
    });

  });

  describe("sync", () => {

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

    it("calls RPC client with state of all client state holders", async () => {
      const holder1: IClientStateHolder<number> = {
        key: faker.random.word(),
        state: faker.random.number(),
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder1);

      const holder2: IClientStateHolder<boolean> = {
        key: faker.random.word(),
        state: undefined,
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder2);

      const holder3: IClientStateHolder<string[]> = {
        key: faker.random.word(),
        state: [faker.random.word(), faker.random.word()],
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder3);

      const expectedSyncOptions: ClientStateSyncRequestOptions = {
        clientId,
        clientStateId: undefined,
        state: {
          [holder1.key]: holder1.state,
          [holder2.key]: holder2.state,
          [holder3.key]: holder3.state,
        },
      };

      rpcInterfaceMock.setup((x) => x.syncClientState(token, expectedSyncOptions)).returns(() => Promise.resolve()).verifiable();
      await handler.sync(token);
      rpcInterfaceMock.verifyAll();
    });

    it("calls RPC client with clientStateId", async () => {
      const holder: IClientStateHolder<number> = {
        key: faker.random.word(),
        state: faker.random.number(),
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder);
      holder.onStateChanged.raiseEvent();

      const expectedSyncOptions: ClientStateSyncRequestOptions = {
        clientId,
        clientStateId: handler.clientStateId,
        state: {
          [holder.key]: holder.state,
        },
      };

      rpcInterfaceMock.setup((x) => x.syncClientState(token, expectedSyncOptions)).returns(() => Promise.resolve()).verifiable();
      await handler.sync(token);
      rpcInterfaceMock.verifyAll();
    });

    it("merges client state", async () => {
      const key = faker.random.word();

      const holder1: IClientStateHolder<{ [id: string]: number }> = {
        key,
        state: { a: faker.random.number() },
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder1);

      const holder2: IClientStateHolder<{ [id: string]: number }> = {
        key,
        state: { b: faker.random.number() },
        onStateChanged: new BeEvent<() => void>(),
      };
      handler.registerClientStateHolder(holder2);

      const expectedSyncOptions: ClientStateSyncRequestOptions = {
        clientId,
        clientStateId: undefined,
        state: {
          [key]: {
            a: holder1.state!.a,
            b: holder2.state!.b,
          },
        },
      };

      rpcInterfaceMock.setup((x) => x.syncClientState(token, expectedSyncOptions)).returns(() => Promise.resolve()).verifiable();
      await handler.sync(token);
      rpcInterfaceMock.verifyAll();
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
        const actualResult = await handler.request(undefined, async () => result, defaultRpcOptions);
        expect(actualResult).to.eq(result);
      });

    });

    describe("when request throws unknown exception", () => {

      it("re-throws exception when request throws unknown exception", async () => {
        const func = async () => { throw new Error("test"); };
        expect(handler.request(undefined, func, defaultRpcOptions)).to.eventually.be.rejectedWith(Error);
      });

    });

    describe("when request throws BackendOutOfSync exception", () => {

      let callsCount: number;
      let func: () => Promise<number>;

      beforeEach(() => {
        callsCount = 0;
        func = async () => {
          switch (callsCount++) {
            case 0: throw new PresentationError(PresentationStatus.BackendOutOfSync);
            default: return faker.random.number();
          }
        };
      });

      it("syncs and repeats request", async () => {
        const syncMock = moq.Mock.ofInstance((_token: IModelToken) => Promise.resolve());
        handler.sync = syncMock.object;

        const result = await handler.request(undefined, func, defaultRpcOptions);
        expect(result).to.not.be.undefined;
        syncMock.verify((x) => x(defaultRpcOptions.imodel), moq.Times.once());
        expect(callsCount).to.eq(2);
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
      handler.request = <TResult, TOptions extends RpcRequestOptions, TArg extends any[]>(context: any, func: (token: IModelToken, options: TOptions, ...args: TArg) => Promise<TResult>, options: TOptions, ...args: TArg): Promise<TResult> => {
        expect(context).to.eq(rpcInterfaceMock.object);
        return func.apply(context, [token, options, ...args]);
      };
      rpcInterfaceMock.reset();
    });

    afterEach(() => {
      handler.dispose();
    });

    it("forwards getRootNodes call", async () => {
      const options: Paged<HierarchyRequestOptions<IModelToken>> = {
        imodel: token,
        rulesetId: faker.random.word(),
      };
      const rpcOptions = { ...defaultRpcOptions, ...options };
      const result = [createRandomECInstanceNode()];
      rpcInterfaceMock.setup((x) => x.getRootNodes(token, rpcOptions)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getRootNodesCount(token, rpcOptions)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getChildren(token, rpcOptions, parentKey)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getChildrenCount(token, rpcOptions, parentKey)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getFilteredNodePaths(token, rpcOptions, filter)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getNodePaths(token, rpcOptions, paths, markedIndex)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getContentDescriptor(token, rpcOptions, displayType, keys, selectionInfo)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getContentSetSize(token, rpcOptions, descriptor, keys)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getContent(token, rpcOptions, descriptor, keys)).returns(async () => result).verifiable();
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
      rpcInterfaceMock.setup((x) => x.getDistinctValues(token, rpcOptions, descriptor, keys, fieldName, maxItems)).returns(async () => result).verifiable();
      expect(await handler.getDistinctValues(options, descriptor, keys, fieldName, maxItems)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

  });

});
