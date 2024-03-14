/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { Id64, Logger } from "@itwin/core-bentley";
import { IModelRpcProps, RpcInterface, RpcInterfaceDefinition, RpcManager } from "@itwin/core-common";
import {
  DescriptorOverrides,
  DistinctValuesRpcRequestOptions,
  KeySet,
  KeySetJSON,
  Paged,
  PresentationError,
  PresentationRpcInterface,
  PresentationRpcRequestOptions,
  PresentationRpcResponse,
  PresentationStatus,
  RpcRequestsHandler,
  SelectionInfo,
  SelectionScopeRequestOptions,
} from "../presentation-common";
import { FieldDescriptorType } from "../presentation-common/content/Fields";
import { ItemJSON } from "../presentation-common/content/Item";
import { ClientDiagnostics } from "../presentation-common/Diagnostics";
import { InstanceKey } from "../presentation-common/EC";
import { ElementProperties } from "../presentation-common/ElementProperties";
import { NodeKey } from "../presentation-common/hierarchy/Key";
import {
  ComputeSelectionRequestOptions,
  ContentDescriptorRequestOptions,
  ContentInstanceKeysRequestOptions,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DistinctValuesRequestOptions,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyRequestOptions,
  SingleElementPropertiesRequestOptions,
} from "../presentation-common/PresentationManagerOptions";
import {
  ContentDescriptorRpcRequestOptions,
  ContentInstanceKeysRpcRequestOptions,
  ContentRpcRequestOptions,
  ContentSourcesRpcRequestOptions,
  ContentSourcesRpcResult,
  DisplayLabelRpcRequestOptions,
  DisplayLabelsRpcRequestOptions,
  FilterByInstancePathsHierarchyRpcRequestOptions,
  FilterByTextHierarchyRpcRequestOptions,
  HierarchyLevelDescriptorRpcRequestOptions,
  HierarchyRpcRequestOptions,
  SingleElementPropertiesRpcRequestOptions,
} from "../presentation-common/PresentationRpcInterface";
import { RulesetVariableJSON } from "../presentation-common/RulesetVariables";
import { createTestContentDescriptor } from "./_helpers/Content";
import {
  createRandomECInstanceKey,
  createRandomECInstancesNodeJSON,
  createRandomECInstancesNodeKey,
  createRandomLabelDefinition,
  createRandomNodePathElementJSON,
  createRandomSelectionScope,
} from "./_helpers/random";

describe("RpcRequestsHandler", () => {
  let clientId: string;
  let defaultRpcHandlerOptions: { imodel: IModelRpcProps };
  const token: IModelRpcProps = { key: "test", iModelId: "test", iTwinId: "test" };
  const successResponse = async <TResult>(result: TResult, diagnostics?: ClientDiagnostics): PresentationRpcResponse<TResult> => ({
    statusCode: PresentationStatus.Success,
    result,
    diagnostics,
  });
  const errorResponse = async (statusCode: PresentationStatus, errorMessage?: string, diagnostics?: ClientDiagnostics): PresentationRpcResponse => ({
    statusCode,
    errorMessage,
    result: undefined,
    diagnostics,
  });

  beforeEach(() => {
    clientId = faker.random.uuid();
    defaultRpcHandlerOptions = { imodel: token };
  });

  describe("construction", () => {
    let handler: RpcRequestsHandler;

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

    describe("when request succeeds", () => {
      it("returns result of the request", async () => {
        const result = faker.random.number();
        const actualResult = await handler.request(async () => successResponse(result), defaultRpcHandlerOptions);
        expect(actualResult).to.eq(result);
      });

      it("calls diagnostics handler if provided", async () => {
        const result = faker.random.number();
        const diagnosticsOptions = {
          handler: sinon.spy(),
        };
        const diagnosticsResult: ClientDiagnostics = {};
        await handler.request(async () => successResponse(result, diagnosticsResult), { ...defaultRpcHandlerOptions, diagnostics: diagnosticsOptions });
        expect(diagnosticsOptions.handler).to.be.calledOnceWith(diagnosticsResult);
      });

      it("removes redundant ruleset properties", async () => {
        const func = sinon.stub(Logger, "logWarning");

        const options = {
          rulesetOrId: {
            property: "abc",
            $schema: "schema",
            id: "id",
            rules: [],
          },
          imodel: token,
        };

        const actualResult = await handler.request(async (_: IModelRpcProps, hierarchyOptions: HierarchyRpcRequestOptions) => {
          return successResponse(hierarchyOptions.rulesetOrId);
        }, options);

        expect(actualResult.hasOwnProperty("property")).to.be.true;
        expect(actualResult.hasOwnProperty("$schema")).to.be.false;
        expect(actualResult.hasOwnProperty("id")).to.be.true;
        expect(actualResult.hasOwnProperty("rules")).to.be.true;
        expect(func.callCount).to.eq(1);
      });
    });

    describe("when request throws unknown exception", () => {
      it("re-throws exception when request throws unknown exception", async () => {
        const func = sinon.stub().rejects(new Error("test"));
        await expect(handler.request(func, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(Error);
        expect(func.callCount).to.eq(1);
      });
    });

    describe("when request returns an unexpected status", () => {
      it("throws an exception", async () => {
        const func = sinon.stub().resolves(errorResponse(PresentationStatus.Error));
        await expect(handler.request(func, defaultRpcHandlerOptions)).to.eventually.be.rejectedWith(PresentationError);
        expect(func.callCount).to.eq(1);
      });

      it("calls diagnostics handler if provided", async () => {
        const diagnosticsOptions = {
          handler: sinon.spy(),
        };
        const diagnosticsResult: ClientDiagnostics = {};
        const func = sinon.fake(async () => errorResponse(PresentationStatus.Error, undefined, diagnosticsResult));
        await expect(handler.request(func, { ...defaultRpcHandlerOptions, diagnostics: diagnosticsOptions })).to.eventually.be.rejectedWith(PresentationError);
        expect(diagnosticsOptions.handler).to.be.calledOnceWith(diagnosticsResult);
      });
    });

    describe("when request returns a status of BackendTimeout", () => {
      it("returns PresentationError with BackendTimeout status", async () => {
        let callCount = 0;
        const nowStub = sinon.stub(Date, "now").returns(0);
        const func = sinon.fake(async () => {
          nowStub.reset();
          nowStub.returns(++callCount);
          return errorResponse(PresentationStatus.BackendTimeout);
        });

        // create a handler with a known timeout
        handler = new RpcRequestsHandler({ timeout: 10 });

        await expect(handler.request(func, defaultRpcHandlerOptions))
          .to.eventually.be.rejectedWith(PresentationError)
          .and.have.property("errorNumber", PresentationStatus.BackendTimeout);

        /**
         * The `func` will be repeatedly called until `Date.now()` at the `request` call `+ timeout`
         * exceeds `Date.now()`. We're setting up 0 for the starting time and increase it by 1 on each
         * call of `func`, so the total call count should match `handler.timeout`.
         */
        expect(func.callCount).to.eq(handler.timeout);
      });

      it("calls diagnostics handler if provided", async () => {
        let callCount = 0;
        const nowStub = sinon.stub(Date, "now").returns(0);
        const func = sinon.fake(async () => {
          nowStub.reset();
          nowStub.returns(++callCount);
          return errorResponse(PresentationStatus.BackendTimeout, undefined, { logs: [{ scope: `${callCount}` }] });
        });

        // create a handler with a known timeout
        handler = new RpcRequestsHandler({ timeout: 3 });

        const diagnosticsOptions = {
          handler: sinon.spy(),
        };
        await expect(handler.request(func, { ...defaultRpcHandlerOptions, diagnostics: diagnosticsOptions }))
          .to.eventually.be.rejectedWith(PresentationError)
          .and.have.property("errorNumber", PresentationStatus.BackendTimeout);

        expect(diagnosticsOptions.handler.callCount).to.eq(3);
        diagnosticsOptions.handler.getCalls().forEach((call, callIndex) => {
          expect(call).to.be.calledWith({ logs: [{ scope: `${callIndex + 1}` }] });
        });
      });
    });
  });

  describe("requests forwarding to PresentationRpcInterface", () => {
    let handler: RpcRequestsHandler;
    let rpcInterfaceMock: moq.IMock<PresentationRpcInterface>;
    let defaultGetClientForInterfaceImpl: <T extends RpcInterface>(def: RpcInterfaceDefinition<T>) => T; // eslint-disable-line deprecation/deprecation

    before(() => {
      rpcInterfaceMock = moq.Mock.ofType<PresentationRpcInterface>();
      defaultGetClientForInterfaceImpl = (definition) => RpcManager.getClientForInterface(definition);
      RpcManager.getClientForInterface = (() => rpcInterfaceMock.object) as any;
    });

    after(() => {
      RpcManager.getClientForInterface = defaultGetClientForInterfaceImpl;
    });

    beforeEach(() => {
      handler = new RpcRequestsHandler({ clientId });
      rpcInterfaceMock.reset();
    });

    it("forwards getNodesCount call for root nodes", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
      };
      const rpcOptions: HierarchyRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
      };
      const result = faker.random.number();
      rpcInterfaceMock
        .setup(async (x) => x.getNodesCount(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getNodesCount(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodesCount call for child nodes", async () => {
      const handlerOptions: HierarchyRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        parentKey: createRandomECInstancesNodeKey(),
      };
      const rpcOptions: HierarchyRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        parentKey: handlerOptions.parentKey,
      };
      const result = faker.random.number();
      rpcInterfaceMock
        .setup(async (x) => x.getNodesCount(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getNodesCount(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getPagedNodes call", async () => {
      const handlerOptions: Paged<HierarchyRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        paging: { start: 1, size: 2 },
        parentKey: createRandomECInstancesNodeKey(),
      };
      const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        paging: { start: 1, size: 2 },
        // eslint-disable-next-line deprecation/deprecation
        parentKey: NodeKey.fromJSON(handlerOptions.parentKey!),
      };
      const result = { items: [createRandomECInstancesNodeJSON()], total: 1 };
      rpcInterfaceMock
        .setup(async (x) => x.getPagedNodes(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getPagedNodes(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    describe("forwards getNodesDescriptor call", async () => {
      function createTestData() {
        const handlerOptions: HierarchyLevelDescriptorRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON> = {
          imodel: token,
          rulesetOrId: "test-ruleset",
          parentKey: createRandomECInstancesNodeKey(),
        };
        const rpcOptions: HierarchyLevelDescriptorRpcRequestOptions = {
          clientId,
          rulesetOrId: handlerOptions.rulesetOrId,
          // eslint-disable-next-line deprecation/deprecation
          parentKey: NodeKey.fromJSON(handlerOptions.parentKey!),
        };
        const result = createTestContentDescriptor({ fields: [] }).toJSON();
        return { handlerOptions, rpcOptions, result };
      }

      it("when descriptor is sent as serialized JSON string", async () => {
        const { handlerOptions, rpcOptions, result } = createTestData();
        rpcInterfaceMock
          .setup(async (x) => x.getNodesDescriptor(token, rpcOptions))
          .returns(async () => successResponse(JSON.stringify(result)))
          .verifiable();
        expect(await handler.getNodesDescriptor(handlerOptions)).to.deep.eq(result);
        rpcInterfaceMock.verifyAll();
      });

      it("when descriptor is sent as JSON", async () => {
        const { handlerOptions, rpcOptions, result } = createTestData();
        rpcInterfaceMock
          .setup(async (x) => x.getNodesDescriptor(token, rpcOptions))
          .returns(async () => successResponse(result))
          .verifiable();
        expect(await handler.getNodesDescriptor(handlerOptions)).to.deep.eq(result);
        rpcInterfaceMock.verifyAll();
      });
    });

    it("forwards getFilteredNodePaths call", async () => {
      const filterText = faker.random.word();
      const handlerOptions: FilterByTextHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        filterText,
      };
      const rpcOptions: FilterByTextHierarchyRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        filterText,
      };
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock
        .setup(async (x) => x.getFilteredNodePaths(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getFilteredNodePaths(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getNodePaths call", async () => {
      const paths = [[createRandomECInstanceKey()]];
      const markedIndex = faker.random.number();
      const handlerOptions: FilterByInstancePathsHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        instancePaths: paths,
        markedIndex,
      };
      const rpcOptions: FilterByInstancePathsHierarchyRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        instancePaths: paths,
        markedIndex,
      };
      const result = [createRandomNodePathElementJSON()];
      rpcInterfaceMock
        .setup(async (x) => x.getNodePaths(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getNodePaths(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentSources call", async () => {
      const classes = ["test1", "test2"];
      const handlerOptions: ContentSourcesRequestOptions<IModelRpcProps> = {
        imodel: token,
        classes,
      };
      const rpcOptions: ContentSourcesRpcRequestOptions = {
        clientId,
        classes,
      };
      const result: ContentSourcesRpcResult = {
        sources: [
          {
            selectClassInfo: "0x123",
            isSelectPolymorphic: true,
            navigationPropertyClasses: [],
            pathFromInputToSelectClass: [],
            relatedInstancePaths: [],
            relatedPropertyPaths: [],
          },
        ],
        classesMap: {
          "0x123": { name: "class_name", label: "Class Label" },
        },
      };
      rpcInterfaceMock
        .setup(async (x) => x.getContentSources(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getContentSources(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentDescriptor call", async () => {
      const displayType = faker.random.word();
      const keys = new KeySet().toJSON();
      const selectionInfo: SelectionInfo = { providerName: faker.random.word() };
      const handlerOptions: ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        displayType,
        keys,
        selection: selectionInfo,
      };
      const rpcOptions: ContentDescriptorRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        displayType,
        keys,
        selection: selectionInfo,
      };
      const result = createTestContentDescriptor({ fields: [] }).toJSON();
      rpcInterfaceMock
        .setup(async (x) => x.getContentDescriptor(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getContentDescriptor(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentSetSize call", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] }).toJSON();
      const keys = new KeySet().toJSON();
      const result = faker.random.number();
      const handlerOptions: ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        descriptor,
        keys,
      };
      const rpcOptions: ContentRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        descriptor,
        keys,
      };
      rpcInterfaceMock
        .setup(async (x) => x.getContentSetSize(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getContentSetSize(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getPagedContent call", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] }).toJSON();
      const keys = new KeySet().toJSON();
      const result = {
        descriptor,
        contentSet: {
          total: 123,
          items: new Array<ItemJSON>(),
        },
      };
      const handlerOptions: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        descriptor,
        keys,
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: Paged<ContentRpcRequestOptions> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        descriptor,
        keys,
        paging: { start: 1, size: 2 },
      };
      rpcInterfaceMock
        .setup(async (x) => x.getPagedContent(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getPagedContent(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getPagedContentSet call", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] }).toJSON();
      const keys = new KeySet().toJSON();
      const result = {
        total: 123,
        items: new Array<ItemJSON>(),
      };
      const handlerOptions: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        descriptor,
        keys,
        paging: { start: 1, size: 2 },
      };
      const rpcOptions: Paged<ContentRpcRequestOptions> = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        descriptor,
        keys,
        paging: { start: 1, size: 2 },
      };
      rpcInterfaceMock
        .setup(async (x) => x.getPagedContentSet(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getPagedContentSet(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getPagedDistinctValues call", async () => {
      const handlerOptions: DistinctValuesRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
        keys: new KeySet().toJSON(),
        fieldDescriptor: {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        },
      };
      const rpcOptions: DistinctValuesRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        descriptor: handlerOptions.descriptor,
        keys: new KeySet().toJSON(),
        fieldDescriptor: {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        },
      };
      const result = {
        total: 2,
        items: [
          {
            displayValue: "1",
            groupedRawValues: [1.1, 1.2],
          },
          {
            displayValue: "2",
            groupedRawValues: [2],
          },
        ],
      };
      rpcInterfaceMock
        .setup(async (x) => x.getPagedDistinctValues(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getPagedDistinctValues(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getElementProperties call", async () => {
      const elementId = "0x123";
      const handlerOptions: SingleElementPropertiesRequestOptions<IModelRpcProps> = {
        imodel: token,
        elementId,
      };
      const rpcOptions: SingleElementPropertiesRpcRequestOptions = {
        clientId,
        elementId,
      };
      const result: ElementProperties = {
        class: "test class",
        id: elementId,
        label: "test label",
        items: {},
      };
      rpcInterfaceMock
        .setup(async (x) => x.getElementProperties(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getElementProperties(handlerOptions)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getContentInstanceKeys call", async () => {
      const handlerOptions: ContentInstanceKeysRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON> = {
        imodel: token,
        rulesetOrId: faker.random.word(),
        displayType: "test display type",
        keys: new KeySet().toJSON(),
      };
      const rpcOptions: ContentInstanceKeysRpcRequestOptions = {
        clientId,
        rulesetOrId: handlerOptions.rulesetOrId,
        displayType: handlerOptions.displayType,
        keys: handlerOptions.keys,
      };
      const result = {
        total: 2,
        items: new KeySet([
          {
            className: "test class 1",
            id: "0x1",
          },
          {
            className: "test class 2",
            id: "0x2",
          },
        ]).toJSON(),
      };
      rpcInterfaceMock
        .setup(async (x) => x.getContentInstanceKeys(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getContentInstanceKeys(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getDisplayLabelDefinition call", async () => {
      const key = createRandomECInstanceKey();
      const handlerOptions: DisplayLabelRequestOptions<IModelRpcProps, InstanceKey> = {
        imodel: token,
        key,
      };
      const rpcOptions: DisplayLabelRpcRequestOptions = {
        clientId,
        key,
      };
      const result = createRandomLabelDefinition();
      rpcInterfaceMock
        .setup(async (x) => x.getDisplayLabelDefinition(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getDisplayLabelDefinition(handlerOptions)).to.deep.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards getPagedDisplayLabelDefinitions call", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const handlerOptions: DisplayLabelsRequestOptions<IModelRpcProps, InstanceKey> = {
        imodel: token,
        keys,
      };
      const rpcOptions: DisplayLabelsRpcRequestOptions = {
        clientId,
        keys,
      };
      const result = {
        total: 2,
        items: [createRandomLabelDefinition(), createRandomLabelDefinition()],
      };
      rpcInterfaceMock
        .setup(async (x) => x.getPagedDisplayLabelDefinitions(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getPagedDisplayLabelDefinitions(handlerOptions)).to.deep.eq(result);
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
      rpcInterfaceMock
        .setup(async (x) => x.getSelectionScopes(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.getSelectionScopes(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });

    it("forwards computeSelection call", async () => {
      const handlerOptions: ComputeSelectionRequestOptions<IModelRpcProps> = {
        imodel: token,
        elementIds: [Id64.invalid],
        scope: { id: "test scope" },
      };
      const rpcOptions: PresentationRpcRequestOptions<ComputeSelectionRequestOptions<any>> = {
        clientId,
        elementIds: [Id64.invalid],
        scope: { id: "test scope" },
      };
      const result = new KeySet().toJSON();
      rpcInterfaceMock
        .setup(async (x) => x.computeSelection(token, rpcOptions))
        .returns(async () => successResponse(result))
        .verifiable();
      expect(await handler.computeSelection(handlerOptions)).to.eq(result);
      rpcInterfaceMock.verifyAll();
    });
  });
});
