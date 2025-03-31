/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Id64String } from "@itwin/core-bentley";
import { IModelRpcProps, RpcOperation, RpcRegistry, RpcRequest, RpcSerializedValue } from "@itwin/core-common";
import {
  ContentDescriptorRpcRequestOptions,
  ContentRpcRequestOptions,
  ContentSourcesRpcRequestOptions,
  DisplayLabelRpcRequestOptions,
  DisplayLabelsRpcRequestOptions,
  DistinctValuesRpcRequestOptions,
  HierarchyRpcRequestOptions,
  KeySet,
  Paged,
  PresentationRpcInterface,
  PresentationStatus,
  SelectionScopeRpcRequestOptions,
} from "../presentation-common.js";
import { FieldDescriptorType } from "../presentation-common/content/Fields.js";
import {
  ComputeSelectionRpcRequestOptions,
  ContentInstanceKeysRpcRequestOptions,
  FilterByInstancePathsHierarchyRpcRequestOptions,
  FilterByTextHierarchyRpcRequestOptions,
  HierarchyLevelDescriptorRpcRequestOptions,
  PresentationRpcResponseData,
  SingleElementPropertiesRpcRequestOptions,
} from "../presentation-common/PresentationRpcInterface.js";
import { createTestContentDescriptor } from "./_helpers/Content.js";
import { createTestECInstanceKey, createTestECInstancesNodeKey } from "./_helpers/index.js";

describe("PresentationRpcInterface", () => {
  class TestRpcRequest extends RpcRequest {
    protected async send(): Promise<number> {
      throw new Error("Not implemented.");
    }
    protected async load(): Promise<RpcSerializedValue> {
      throw new Error("Not implemented.");
    }
    protected setHeader(_name: string, _value: string): void {
      throw new Error("Not implemented.");
    }
  }

  it("finds imodel tokens in RPC requests", () => {
    const token: IModelRpcProps = { key: "test", iModelId: "test", iTwinId: "test" };
    const parameters = [token, { rulesetOrId: "test-ruleset" }];
    RpcRegistry.instance.initializeRpcInterface(PresentationRpcInterface);
    const client = RpcRegistry.instance.getClientForInterface(PresentationRpcInterface);
    const operation = RpcOperation.lookup(PresentationRpcInterface, "getNodesCount");
    {
      using disposableRequest = {
        request: new TestRpcRequest(client, "getNodesCount", parameters),
        [Symbol.dispose]: () => {
          // no way to properly destroy the created request...
          (disposableRequest.request as any)[Symbol.dispose]();
        },
      };
      const result = operation.policy.token(disposableRequest.request);
      expect(result).to.eq(token);
    }
    RpcRegistry.instance.terminateRpcInterface(PresentationRpcInterface);
  });

  function toArguments(..._arguments: any[]) {
    return arguments;
  }

  /* eslint-disable @typescript-eslint/no-deprecated -- PresentationRpcInterface methods are deprecated */
  describe("calls forwarding", () => {
    let rpcInterface: PresentationRpcInterface;
    let spy: sinon.SinonStub<[IArguments], Promise<any>>;
    const token: IModelRpcProps = { key: "test", iModelId: "test", iTwinId: "test" };

    beforeEach(() => {
      rpcInterface = new PresentationRpcInterface();
      spy = sinon.stub(rpcInterface, "forward").returns(Promise.resolve({ statusCode: PresentationStatus.Success }));
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
      };
      await rpcInterface.getNodesCount(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const options: HierarchyRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
        parentKey: createTestECInstancesNodeKey(),
      };
      await rpcInterface.getNodesCount(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedNodes call", async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        rulesetOrId: "test-ruleset",
        parentKey: createTestECInstancesNodeKey(),
      };
      await rpcInterface.getPagedNodes(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getNodesDescriptor call", async () => {
      const options: HierarchyLevelDescriptorRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
        parentKey: createTestECInstancesNodeKey(),
      };
      await rpcInterface.getNodesDescriptor(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getFilteredNodePaths call", async () => {
      const options: FilterByTextHierarchyRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
        filterText: "filter",
      };
      await rpcInterface.getFilteredNodePaths(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getNodePaths call", async () => {
      const keys = [[createTestECInstanceKey(), createTestECInstanceKey()]];
      const options: FilterByInstancePathsHierarchyRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
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

    describe("getContentDescriptor", () => {
      const options: ContentDescriptorRpcRequestOptions = {
        rulesetOrId: "test_ruleset",
        displayType: "test",
        keys: new KeySet().toJSON(),
      };

      it("parses string response into DescriptorJSON", async () => {
        const descriptorJson = createTestContentDescriptor({ fields: [] }).toJSON();
        const presentationResponse: PresentationRpcResponseData<string> = {
          statusCode: PresentationStatus.Success,
          result: JSON.stringify(descriptorJson),
        };
        spy.returns(Promise.resolve(presentationResponse));

        const response = await rpcInterface.getContentDescriptor(token, options);
        expect(response.result).to.be.deep.equal(descriptorJson);
      });

      it("returns undefined result", async () => {
        const presentationResponse: PresentationRpcResponseData<string> = {
          statusCode: PresentationStatus.Success,
          result: undefined,
        };
        spy.returns(Promise.resolve(presentationResponse));

        const response = await rpcInterface.getContentDescriptor(token, options);
        expect(response.result).to.be.be.undefined;
      });
    });

    it("forwards getContentSetSize call", async () => {
      const options: ContentRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getContentSetSize(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedContent call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        rulesetOrId: "test-ruleset",
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getPagedContent(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedContentSet call", async () => {
      const options: Paged<ContentRpcRequestOptions> = {
        rulesetOrId: "test-ruleset",
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
      };
      await rpcInterface.getPagedContentSet(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedDistinctValues call", async () => {
      const options: DistinctValuesRpcRequestOptions = {
        rulesetOrId: "test-ruleset",
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
        key: createTestECInstanceKey(),
      };
      await rpcInterface.getDisplayLabelDefinition(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getPagedDisplayLabelDefinitions call", async () => {
      const options: DisplayLabelsRpcRequestOptions = {
        keys: [createTestECInstanceKey(), createTestECInstanceKey()],
      };
      await rpcInterface.getPagedDisplayLabelDefinitions(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards getSelectionScopes call", async () => {
      const options: SelectionScopeRpcRequestOptions = {};
      await rpcInterface.getSelectionScopes(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });

    it("forwards computeSelection call", async () => {
      const options: ComputeSelectionRpcRequestOptions = {
        elementIds: new Array<Id64String>(),
        scope: { id: "test-scope" },
      };
      await rpcInterface.computeSelection(token, options);
      expect(spy).to.be.calledOnceWith(toArguments(token, options));
    });
  });
  /* eslint-enable @typescript-eslint/no-deprecated */
});
