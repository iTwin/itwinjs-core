/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import { Id64String, using } from "@itwin/core-bentley";
import { IModelRpcProps, RpcOperation, RpcRegistry, RpcRequest, RpcSerializedValue } from "@itwin/core-common";
import {
  ContentDescriptorRpcRequestOptions, ContentRpcRequestOptions, ContentSourcesRpcRequestOptions, DisplayLabelRpcRequestOptions,
  DisplayLabelsRpcRequestOptions, DistinctValuesRpcRequestOptions, HierarchyRpcRequestOptions, KeySet, Paged, PresentationRpcInterface,
  SelectionScopeRpcRequestOptions,
} from "../presentation-common";
import { FieldDescriptorType } from "../presentation-common/content/Fields";
import {
  ContentInstanceKeysRpcRequestOptions, FilterByInstancePathsHierarchyRpcRequestOptions, FilterByTextHierarchyRpcRequestOptions,
  SingleElementPropertiesRpcRequestOptions,
} from "../presentation-common/PresentationRpcInterface";
import { createTestContentDescriptor } from "./_helpers/Content";
import { createRandomECInstanceKey, createRandomECInstancesNodeKey, createRandomECInstancesNodeKeyJSON } from "./_helpers/random";

describe("PresentationRpcInterface", () => {
  class TestRpcRequest extends RpcRequest {
    protected async send(): Promise<number> { throw new Error("Not implemented."); }
    protected async load(): Promise<RpcSerializedValue> { throw new Error("Not implemented."); }
    protected setHeader(_name: string, _value: string): void { throw new Error("Not implemented."); }
  }

  it("finds imodel tokens in RPC requests", () => {
    const token: IModelRpcProps = { key: "test", iModelId: "test", iTwinId: "test" };
    const parameters = [
      token,
      { rulesetOrId: faker.random.word() },
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
    let spy: sinon.SinonSpy<[IArguments], Promise<any>>;
    const token: IModelRpcProps = { key: "test", iModelId: "test", iTwinId: "test" };

    beforeEach(() => {
      rpcInterface = new PresentationRpcInterface();
      spy = sinon.stub(rpcInterface, "forward");
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
      };
      await rpcInterface.getNodesCount(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        parentKey: createRandomECInstancesNodeKey(),
      };
      await rpcInterface.getNodesCount(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedNodes call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        rulesetOrId: faker.random.word(),
        parentKey: createRandomECInstancesNodeKeyJSON(),
      };
      await rpcInterface.getPagedNodes(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: FilterByTextHierarchyRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        filterText: "filter",
      };
      await rpcInterface.getFilteredNodePaths(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getNodePaths call", async () => {
      const keys = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      const options: FilterByInstancePathsHierarchyRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        instancePaths: keys,
        markedIndex: 1,
      };
      await rpcInterface.getNodePaths(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getContentSources call", async () => {
      const options: ContentSourcesRpcRequestOptions = {
        classes: ["test.class-one", "test.class-two"],
      };
      await rpcInterface.getContentSources(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getContentDescriptor call", async () => {
      const options: ContentDescriptorRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        displayType: "test",
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getContentDescriptor(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getContentSetSize(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        rulesetOrId: faker.random.word(),
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getPagedContent(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedContentSet call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        rulesetOrId: faker.random.word(),
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getPagedContentSet(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedDistinctValues call", async () => {
      const options: DistinctValuesRpcRequestOptions = {
        rulesetOrId: faker.random.word(),
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        fieldDescriptor: {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        },
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getPagedDistinctValues(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getElementProperties call", async () => {
      const options: SingleElementPropertiesRpcRequestOptions = {
        elementId: "0x1",
      };
      await rpcInterface.getElementProperties(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getContentInstanceKeys call", async () => {
      const options: ContentInstanceKeysRpcRequestOptions = {
        rulesetOrId: "test ruleset",
        displayType: "test display type",
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getContentInstanceKeys(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getDisplayLabelDefinition call", async () => {
      const options: DisplayLabelRpcRequestOptions = {
        key: createRandomECInstanceKey(),
      };
      await rpcInterface.getDisplayLabelDefinition(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedDisplayLabelDefinitions call", async () => {
      const options: DisplayLabelsRpcRequestOptions = {
        keys: [createRandomECInstanceKey(), createRandomECInstanceKey()],
      };
      await rpcInterface.getPagedDisplayLabelDefinitions(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getSelectionScopes call", async () => {
      const options: SelectionScopeRpcRequestOptions = {
      };
      await rpcInterface.getSelectionScopes(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards computeSelection call", async () => {
      const options: SelectionScopeRpcRequestOptions = {
      };
      const ids = new Array<Id64String>();
      const scopeId = faker.random.uuid();
      await rpcInterface.computeSelection(token, options, ids, scopeId);
      expect(spy).to.be.calledOnceWith(toArguments(token, options, ids, scopeId));
    });

  });

});
