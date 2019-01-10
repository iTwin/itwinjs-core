/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "./_helpers/Mocks";
import { createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey } from "./_helpers/random";
import { using } from "@bentley/bentleyjs-core";
import { IModelToken, RpcOperation, RpcRequest, RpcSerializedValue } from "@bentley/imodeljs-common";
import { RpcRegistry } from "@bentley/imodeljs-common";
import {
  PresentationRpcInterface,
  KeySet, Paged,
} from "../presentation-common";
import {
  RpcRequestOptions, HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  ClientStateSyncRequestOptions,
} from "../PresentationRpcInterface";

describe("PresentationRpcInterface", () => {
  class TestRpcRequest extends RpcRequest {
    protected send(): Promise<number> { throw new Error("Not implemented."); }
    protected load(): Promise<RpcSerializedValue> { throw new Error("Not implemented."); }
    protected setHeader(_name: string, _value: string): void { throw new Error("Not implemented."); }
  }

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
      request: new TestRpcRequest(client, "getRootNodesCount", parameters),
      dispose: () => {
        // no way to properly destroy the created request...
        (disposableRequest.request as any).dispose();
      },
    };
    using(disposableRequest, (dr) => {
      const result = operation.policy.token(dr.request);
      expect(result).to.eq(token);
    });
    RpcRegistry.instance.terminateRpcInterface(PresentationRpcInterface);
  });

  function toArguments(..._arguments: any[]) { return arguments; }

  describe("calls forwarding", () => {

    let rpcInterface: PresentationRpcInterface;
    let mock: moq.IMock<(<T>(parameters: IArguments) => Promise<T>)>;
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
      mock.verify((x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getRootNodesCount(token, options);
      mock.verify((x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(token, options, parentKey);
      mock.verify((x) => x(toArguments(token, options, parentKey)), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(token, options, parentKey);
      mock.verify((x) => x(toArguments(token, options, parentKey)), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getFilteredNodePaths(token, options, "filter");
      mock.verify((x) => x(toArguments(token, options, "filter")), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(token, options, keys, 1);
      mock.verify((x) => x(toArguments(token, options, keys, 1)), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const keys = new KeySet();
      await rpcInterface.getContentDescriptor(token, options, "test", keys, undefined);
      mock.verify((x) => x(toArguments(token, options, "test", keys, undefined)), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      await rpcInterface.getContentSetSize(token, options, descriptor, keys);
      mock.verify((x) => x(toArguments(token, options, descriptor, keys)), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet();
      await rpcInterface.getContent(token, options, descriptor, keys);
      mock.verify((x) => x(toArguments(token, options, descriptor, keys)), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const keys = new KeySet();
      await rpcInterface.getDistinctValues(token, options, descriptor, keys, fieldName, maximumValueCount);
      mock.verify((x) => x(toArguments(token, options, descriptor, keys, fieldName, maximumValueCount)), moq.Times.once());
    });

    it("forwards syncClientState call", async () => {
      const options: ClientStateSyncRequestOptions = {
        ...defaultRpcOptions,
        state: {},
      };
      await rpcInterface.syncClientState(token, options);
      mock.verify((x) => x(toArguments(token, options)), moq.Times.once());
    });

  });

});
