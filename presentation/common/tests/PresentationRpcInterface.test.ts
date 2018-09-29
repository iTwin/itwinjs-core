/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "./_helpers/Mocks";
import { createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey } from "./_helpers/random";
import { using } from "@bentley/bentleyjs-core";
import { IModelToken, RpcOperation, RpcRequest } from "@bentley/imodeljs-common";
import { RpcRegistry } from "@bentley/imodeljs-common/lib/rpc/core/RpcRegistry";
import {
  PresentationRpcInterface,
  KeySet, Paged,
} from "../lib";
import {
  RpcRequestOptions, HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  ClientStateSyncRequestOptions,
} from "../lib/PresentationRpcInterface";

describe("PresentationRpcInterface", () => {

  it("finds imodel tokens in RPC requests", () => {
    const token = new IModelToken();
    const parameters = [
      token,
      { rulesetId: faker.random.word() },
    ];
    RpcRegistry.instance.initializeRpcInterface(PresentationRpcInterface);
    const client = RpcRegistry.instance.getClientForInterface(PresentationRpcInterface);
    const operation = RpcOperation.lookup(PresentationRpcInterface, "getRootNodesCount");
    const disposableRequest = {
      request: new RpcRequest(client, "getRootNodesCount", parameters),
      dispose: () => {
        // no way to properly destroy the created request...
        (disposableRequest.request as any).finalize();
      },
    };
    using(disposableRequest, (dr) => {
      const result = operation.policy.token(dr.request);
      expect(result).to.eq(token);
    });
    RpcRegistry.instance.terminateRpcInterface(PresentationRpcInterface);
  });

  describe("calls forwarding", () => {

    let rpcInterface: PresentationRpcInterface;
    let mock: moq.IMock<(<T>(operation: string, ...parameters: any[]) => Promise<T>)>;
    const token = new IModelToken();
    const defaultRpcOptions: RpcRequestOptions = {};

    beforeEach(() => {
      rpcInterface = new PresentationRpcInterface();
      mock = moq.Mock.ofInstance(rpcInterface.forward);
      rpcInterface.forward = mock.object;
    });

    it("forwards getRootNodes call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodes(token, options);
      mock.verify((x) => x(token as any, options), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodesCount(token, options);
      mock.verify((x) => x(token as any, options), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(token, options, parentKey);
      mock.verify((x) => x(token as any, options, parentKey), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(token, options, parentKey);
      mock.verify((x) => x(token as any, options, parentKey), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getFilteredNodePaths(token, options, "filter");
      mock.verify((x) => x(token as any, options, "filter"), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(token, options, keys, 1);
      mock.verify((x) => x(token as any, options, keys, 1), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getContentDescriptor(token, options, "test", new KeySet(), undefined);
      mock.verify((x) => x(token as any, options, "test", moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContentSetSize(token, options, descriptor, new KeySet());
      mock.verify((x) => x(token as any, options, descriptor, moq.It.is((a) => a instanceof KeySet)), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContent(token, options, descriptor, new KeySet());
      mock.verify((x) => x(token as any, options, descriptor, moq.It.is((a) => a instanceof KeySet), undefined), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      await rpcInterface.getDistinctValues(token, options, descriptor, new KeySet(), fieldName, maximumValueCount);
      mock.verify((x) => x(token as any, options, descriptor, moq.It.is((a) => a instanceof KeySet), fieldName, maximumValueCount), moq.Times.once());
    });

    it("forwards syncClientState call", async () => {
      const options: ClientStateSyncRequestOptions = {
        ...defaultRpcOptions,
        state: {},
      };
      await rpcInterface.syncClientState(token, options);
      mock.verify((x) => x(token as any, options), moq.Times.once());
    });

  });

});
