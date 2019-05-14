/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "./_helpers/Mocks";
import { createRandomDescriptor, createRandomECInstanceNodeKey, createRandomECInstanceKey } from "./_helpers/random";
import { using, Id64String } from "@bentley/bentleyjs-core";
import { IModelToken, RpcRegistry, RpcOperation, RpcRequest, RpcSerializedValue } from "@bentley/imodeljs-common";
import {
  PresentationRpcInterface,
  KeySet, Paged,
} from "../presentation-common";
import {
  PresentationRpcRequestOptions, LabelRpcRequestOptions,
  HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  ClientStateSyncRequestOptions, SelectionScopeRpcRequestOptions,
} from "../PresentationRpcInterface";

describe("PresentationRpcInterface", () => {
  class TestRpcRequest extends RpcRequest {
    protected async send(): Promise<number> { throw new Error("Not implemented."); }
    protected async load(): Promise<RpcSerializedValue> { throw new Error("Not implemented."); }
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
    const operation = RpcOperation.lookup(PresentationRpcInterface, "getNodesCount");
    const disposableRequest = {
      request: new TestRpcRequest(client, "getNodesCount", parameters),
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
    const defaultRpcOptions: PresentationRpcRequestOptions = {};

    beforeEach(() => {
      rpcInterface = new PresentationRpcInterface();
      mock = moq.Mock.ofInstance(rpcInterface.forward);
      rpcInterface.forward = mock.object;
    });

    it("forwards getNodesAndCount call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getNodesAndCount(token, options);
      mock.verify(async (x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards getNodes call for root nodes", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getNodes(token, options);
      mock.verify(async (x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards getNodes call for child nodes", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getNodes(token, options, parentKey);
      mock.verify(async (x) => x(toArguments(token, options, parentKey)), moq.Times.once());
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getNodesCount(token, options);
      mock.verify(async (x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getNodesCount(token, options, parentKey);
      mock.verify(async (x) => x(toArguments(token, options, parentKey)), moq.Times.once());
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      await rpcInterface.getFilteredNodePaths(token, options, "filter");
      mock.verify(async (x) => x(toArguments(token, options, "filter")), moq.Times.once());
    });

    it("forwards getNodePaths call", async () => {
      const options: HierarchyRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      await rpcInterface.getNodePaths(token, options, keys, 1);
      mock.verify(async (x) => x(toArguments(token, options, keys, 1)), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const keys = new KeySet().toJSON();
      await rpcInterface.getContentDescriptor(token, options, "test", keys, undefined);
      mock.verify(async (x) => x(toArguments(token, options, "test", keys, undefined)), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet().toJSON();
      await rpcInterface.getContentSetSize(token, options, descriptor, keys);
      mock.verify(async (x) => x(toArguments(token, options, descriptor, keys)), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet().toJSON();
      await rpcInterface.getContent(token, options, descriptor, keys);
      mock.verify(async (x) => x(toArguments(token, options, descriptor, keys)), moq.Times.once());
    });

    it("forwards getContentAndSize call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const keys = new KeySet().toJSON();
      await rpcInterface.getContentAndSize(token, options, descriptor, keys);
      mock.verify(async (x) => x(toArguments(token, options, descriptor, keys)), moq.Times.once());
    });

    it("forwards getDistinctValues call", async () => {
      const options: ContentRpcRequestOptions = {
        ...defaultRpcOptions,
        rulesetId: faker.random.word(),
      };
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const keys = new KeySet().toJSON();
      await rpcInterface.getDistinctValues(token, options, descriptor, keys, fieldName, maximumValueCount);
      mock.verify(async (x) => x(toArguments(token, options, descriptor, keys, fieldName, maximumValueCount)), moq.Times.once());
    });

    it("forwards getDisplayLabel call", async () => {
      const key = createRandomECInstanceKey();
      const options: LabelRpcRequestOptions = {
        ...defaultRpcOptions,
      };
      await rpcInterface.getDisplayLabel(token, options, key);
      mock.verify(async (x) => x(toArguments(token, options, key)), moq.Times.once());
    });

    it("forwards getDisplayLabels call", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const options: LabelRpcRequestOptions = {
        ...defaultRpcOptions,
      };
      await rpcInterface.getDisplayLabels(token, options, keys);
      mock.verify(async (x) => x(toArguments(token, options, keys)), moq.Times.once());
    });

    it("forwards getSelectionScopes call", async () => {
      const options: SelectionScopeRpcRequestOptions = {
        ...defaultRpcOptions,
      };
      await rpcInterface.getSelectionScopes(token, options);
      mock.verify(async (x) => x(toArguments(token, options)), moq.Times.once());
    });

    it("forwards computeSelection call", async () => {
      const options: SelectionScopeRpcRequestOptions = {
        ...defaultRpcOptions,
      };
      const ids = new Array<Id64String>();
      const scopeId = faker.random.uuid();
      await rpcInterface.computeSelection(token, options, ids, scopeId);
      mock.verify(async (x) => x(toArguments(token, options, ids, scopeId)), moq.Times.once());
    });

    it("forwards syncClientState call", async () => {
      const options: ClientStateSyncRequestOptions = {
        ...defaultRpcOptions,
        state: {},
      };
      await rpcInterface.syncClientState(token, options);
      mock.verify(async (x) => x(toArguments(token, options)), moq.Times.once());
    });

  });

});
