/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { IModelDb, RpcTrace } from "@itwin/core-backend";
import { BeEvent, Guid } from "@itwin/core-bentley";
import { IModelRpcProps } from "@itwin/core-common";
import {
  ComputeSelectionRequestOptions,
  ComputeSelectionRpcRequestOptions,
  Content,
  ContentDescriptorRequestOptions,
  ContentDescriptorRpcRequestOptions,
  ContentFlags,
  ContentInstanceKeysRpcRequestOptions,
  ContentRequestOptions,
  ContentRpcRequestOptions,
  ContentSourcesRequestOptions,
  ContentSourcesRpcRequestOptions,
  ContentSourcesRpcResult,
  Descriptor,
  DescriptorOverrides,
  Diagnostics,
  DiagnosticsOptions,
  DisplayLabelRequestOptions,
  DisplayLabelRpcRequestOptions,
  DisplayLabelsRequestOptions,
  DisplayLabelsRpcRequestOptions,
  DistinctValuesRequestOptions,
  DistinctValuesRpcRequestOptions,
  ElementProperties,
  FieldDescriptor,
  FieldDescriptorType,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  HierarchyLevel,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyLevelDescriptorRpcRequestOptions,
  HierarchyRequestOptions,
  HierarchyRpcRequestOptions,
  InstanceKey,
  Item,
  KeySet,
  NodeKey,
  Paged,
  PageOptions,
  PresentationError,
  PresentationRpcRequestOptions,
  PresentationStatus,
  RequestOptions,
  RulesetVariable,
  RulesetVariableJSON,
  SelectClassInfo,
  SelectionScope,
  SelectionScopeRequestOptions,
  VariableValueTypes,
  WithCancelEvent,
} from "@itwin/presentation-common";
import {
  createTestContentDescriptor,
  createTestECInstanceKey,
  createTestECInstancesNodeKey,
  createTestLabelDefinition,
  createTestNode,
  createTestNodePathElement,
  createTestSelectClassInfo,
  ResolvablePromise,
} from "@itwin/presentation-common/test-utils";
import { BackendDiagnosticsAttribute } from "../presentation-backend.js";
import { _presentation_manager_detail } from "../presentation-backend/InternalSymbols.js";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform.js";
import { Presentation } from "../presentation-backend/Presentation.js";
import { PresentationManager } from "../presentation-backend/PresentationManager.js";
import { DESCRIPTOR_ONLY_CONTENT_FLAG } from "../presentation-backend/PresentationManagerDetail.js";
import { MAX_ALLOWED_KEYS_PAGE_SIZE, MAX_ALLOWED_PAGE_SIZE, PresentationRpcImpl } from "../presentation-backend/PresentationRpcImpl.js";

/* eslint-disable @typescript-eslint/no-deprecated -- PresentationRpcInterface methods are deprecated */

describe("PresentationRpcImpl", () => {
  beforeEach(() => {
    sinon.stub(RpcTrace, "expectCurrentActivity").get(() => {
      return { accessToken: "" };
    });
  });

  afterEach(() => {
    sinon.restore();
    Presentation.terminate();
  });

  it("uses default PresentationManager implementation if not overridden", () => {
    Presentation.initialize({
      // @ts-expect-error internal prop
      addon: {
        [Symbol.dispose]: sinon.stub(),
        addRuleset: sinon.stub(),
        registerSupplementalRuleset: sinon.stub(),
        setupRulesetDirectories: sinon.stub(),
        setupSupplementalRulesetDirectories: sinon.stub(),
      } as NativePlatformDefinition,
    });
    using impl = new PresentationRpcImpl();
    expect(impl.getManager()).is.instanceof(PresentationManager);
  });

  it("uses custom requestTimeout", () => {
    const randomRequestTimeout = 4455;
    using impl = new PresentationRpcImpl({ requestTimeout: randomRequestTimeout });
    expect(impl.requestTimeout).to.not.throw;
    expect(impl.requestTimeout).to.equal(randomRequestTimeout);
  });

  it("doesn't cancel requests if request timeout is 0", () => {
    using impl = new PresentationRpcImpl({ requestTimeout: 0 });
    expect(impl.pendingRequests.props.unusedValueLifetime).to.be.undefined;
  });

  it("returns all diagnostics when `PresentationManager` calls diagnostics handler multiple times", async () => {
    const presentationManagerMock = stubPresentationManager();
    Presentation.initialize({
      // @ts-expect-error internal prop
      clientManagerFactory: () => presentationManagerMock,
    });

    const imodelTokenMock = createIModelRpcProps();
    const imodelMock = stubIModelDb();
    sinon.stub(IModelDb, "findByKey").returns(imodelMock as unknown as IModelDb);

    using impl = new PresentationRpcImpl({ requestTimeout: 10 });
    using _ = { [Symbol.dispose]: () => Presentation.terminate() };
    presentationManagerMock.getNodesCount.callsFake(
      async (props: HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable> & BackendDiagnosticsAttribute) => {
        props.diagnostics!.handler({});
        props.diagnostics!.handler({ logs: [{ scope: "1" }] });
        props.diagnostics!.handler({ logs: [{ scope: "2" }] });
        return 0;
      },
    );
    const response = await impl.getNodesCount(imodelTokenMock, { rulesetOrId: "", diagnostics: { dev: true } });
    expect(response.diagnostics).to.deep.eq({
      logs: [
        {
          scope: "1",
        },
        {
          scope: "2",
        },
      ],
    });
    expect(presentationManagerMock.getNodesCount).to.be.calledOnce;
  });

  it("returns diagnostics from initial call when same request is repeated multiple times", async () => {
    const presentationManagerMock = stubPresentationManager();
    Presentation.initialize({
      // @ts-expect-error internal prop
      clientManagerFactory: () => presentationManagerMock,
    });

    const imodelTokenMock = createIModelRpcProps();
    sinon.stub(IModelDb, "findByKey").returns(stubIModelDb() as unknown as IModelDb);

    using impl = new PresentationRpcImpl({ requestTimeout: 10 });
    using _ = { [Symbol.dispose]: () => Presentation.terminate() };
    let callsCount = 0;
    using result = new ResolvablePromise<number>();
    presentationManagerMock.getNodesCount.callsFake(
      async (props: HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable> & BackendDiagnosticsAttribute) => {
        props.diagnostics!.handler({ logs: [{ scope: `${callsCount++}` }] });
        return result;
      },
    );
    const response1 = impl.getNodesCount(imodelTokenMock, { rulesetOrId: "", diagnostics: { dev: true } });
    await expect(response1).to.eventually.be.rejectedWith("Timeout");
    await result.resolve(123);
    const response2 = await impl.getNodesCount(imodelTokenMock, { rulesetOrId: "", diagnostics: { dev: true } });
    expect(response2.statusCode).to.eq(PresentationStatus.Success);
    expect(response2.diagnostics).to.deep.eq({ logs: [{ scope: "0" }] });
  });

  it("adds backend version to diagnostics response", async () => {
    const presentationManagerMock = stubPresentationManager();
    Presentation.initialize({
      // @ts-expect-error internal prop
      clientManagerFactory: () => presentationManagerMock,
    });

    const imodelTokenMock = createIModelRpcProps();
    sinon.stub(IModelDb, "findByKey").returns(stubIModelDb() as unknown as IModelDb);

    using impl = new PresentationRpcImpl({ requestTimeout: 10 });
    using _ = { [Symbol.dispose]: () => Presentation.terminate() };
    presentationManagerMock.getNodesCount.resolves(123);
    const response = await impl.getNodesCount(imodelTokenMock, { rulesetOrId: "", diagnostics: { backendVersion: true } });
    expect(response.statusCode).to.eq(PresentationStatus.Success);
    expect(response.diagnostics?.backendVersion).to.match(/\d+\.\d+\.\d+/i);
  });

  it("returns error response when `PresentationError` is thrown", async () => {
    const imodelToken = createIModelRpcProps();
    sinon.stub(Presentation, "getManager").throws(new PresentationError(PresentationStatus.Error, "test error"));
    sinon
      .stub(IModelDb, "findByKey")
      .withArgs(imodelToken.key)
      .returns({
        refreshContainerForRpc: sinon.stub(),
      } as unknown as IModelDb);
    using impl = new PresentationRpcImpl();
    await expect(impl.getSelectionScopes(imodelToken, {})).to.eventually.be.rejectedWith(PresentationError, "test error");
  });

  it("re-throws generic errors", async () => {
    const imodelToken = createIModelRpcProps();
    sinon.stub(Presentation, "getManager").throws(new Error("test error"));
    sinon
      .stub(IModelDb, "findByKey")
      .withArgs(imodelToken.key)
      .returns({
        refreshContainerForRpc: sinon.stub(),
      } as unknown as IModelDb);
    using impl = new PresentationRpcImpl();
    await expect(impl.getSelectionScopes(imodelToken, {})).to.eventually.be.rejectedWith("test error");
  });

  describe("calls forwarding", () => {
    let testData: {
      imodelToken: ReturnType<typeof createIModelRpcProps>;
      imodelMock: ReturnType<typeof stubIModelDb>;
      rulesetOrId: string;
      pageOptions: PageOptions;
      displayType: string;
    };
    let defaultRpcParams: { clientId: string };
    let impl: PresentationRpcImpl;
    let stub_IModelDb_findByKey: sinon.SinonStub<[string], IModelDb>; // eslint-disable-line @typescript-eslint/naming-convention
    let presentationManagerMock: ReturnType<typeof stubPresentationManager>;

    beforeEach(() => {
      presentationManagerMock = stubPresentationManager();

      Presentation.initialize({
        // @ts-expect-error internal prop
        clientManagerFactory: () => presentationManagerMock,
      });
      testData = {
        imodelToken: createIModelRpcProps(),
        imodelMock: stubIModelDb(),
        rulesetOrId: "test-ruleset-id",
        pageOptions: { start: 123, size: 45 } as PageOptions,
        displayType: "sample display type",
      };
      defaultRpcParams = { clientId: "test-client-id" };
      stub_IModelDb_findByKey = sinon
        .stub(IModelDb, "findByKey")
        .withArgs(testData.imodelToken.key)
        .returns(testData.imodelMock as unknown as IModelDb);
      impl = new PresentationRpcImpl({ requestTimeout: 10 });
    });

    afterEach(() => {
      impl[Symbol.dispose]();
    });

    describe("makeRequest", () => {
      // note: all RPC methods go through `makeRequest` that takes care of timeouts and throws - test that here
      // using `getNodesCount` request

      it("should throw timeout response without any result if manager request takes more than requestTimeout", async () => {
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        using result = new ResolvablePromise<number>();
        presentationManagerMock.getNodesCount.returns(result);
        const actualResult = impl.getNodesCount(testData.imodelToken, rpcOptions);
        await expect(actualResult).to.eventually.be.rejectedWith("Timeout");
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("should return result if `requestTimeout` is set to 0", async () => {
        impl[Symbol.dispose]();
        impl = new PresentationRpcImpl({ requestTimeout: 0 });
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        const result = new ResolvablePromise<number>();
        presentationManagerMock.getNodesCount.returns(result);
        const actualResultPromise = impl.getNodesCount(testData.imodelToken, rpcOptions);

        await result.resolve(999);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);

        const actualResult = await actualResultPromise;
        expect(actualResult.result).to.eq(999);
      });

      it("should handle different iModel requests", async () => {
        impl[Symbol.dispose]();
        impl = new PresentationRpcImpl({ requestTimeout: 0 });
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };

        const managerOptions1: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        const result1 = new ResolvablePromise<number>();
        presentationManagerMock.getNodesCount.callsFake(async (options: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>>) => {
          return options.imodel === (testData.imodelMock as any) ? result1 : result2;
        });

        const iModelRpcProps2 = createIModelRpcProps();
        const iModelMock2 = stubIModelDb();
        stub_IModelDb_findByKey.withArgs(iModelRpcProps2.key).returns(iModelMock2 as unknown as IModelDb);
        const managerOptions2: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: iModelMock2 as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        const result2 = new ResolvablePromise<number>();

        const actualResultPromise1 = impl.getNodesCount(testData.imodelToken, rpcOptions);
        const actualResultPromise2 = impl.getNodesCount(iModelRpcProps2, rpcOptions);

        await result1.resolve(111);
        await result2.resolve(222);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledTwice;
        expect(presentationManagerMock.getNodesCount.getCall(0)).to.have.been.calledWith(managerOptions1);
        expect(presentationManagerMock.getNodesCount.getCall(1)).to.have.been.calledWith(managerOptions2);

        expect((await actualResultPromise1).result).to.eq(111);
        expect((await actualResultPromise2).result).to.eq(222);
      });

      it("should reuse request promise when request is repeated multiple times and iModel takes long to find", async () => {
        const refreshIModelContainerPromise = new ResolvablePromise<void>();
        testData.imodelMock.refreshContainerForRpc.returns(refreshIModelContainerPromise);

        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.resolves(0);
        const pResult1 = impl.getNodesCount(testData.imodelToken, rpcOptions);
        const pResult2 = impl.getNodesCount(testData.imodelToken, rpcOptions);

        await refreshIModelContainerPromise.resolve();

        const [result1, result2] = await Promise.all([pResult1, pResult2]);
        expect(result2).to.eq(result1);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("should forward ruleset variables to manager", async () => {
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          rulesetVariables: [{ id: "test", type: VariableValueTypes.Int, value: 123 }],
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          rulesetVariables: rpcOptions.rulesetVariables as RulesetVariable[],
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.resolves(999);
        await impl.getNodesCount(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("should forward diagnostics options to manager and return diagnostics with results", async () => {
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          diagnostics: {
            perf: true,
          },
        };

        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>> & { diagnostics?: DiagnosticsOptions } = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          diagnostics: {
            perf: true,
          },
          cancelEvent: new BeEvent<() => void>(),
        };
        const diagnosticsResult: Diagnostics = {
          logs: [{ scope: "test" }],
        };
        presentationManagerMock.getNodesCount.callsFake(async (options: RequestOptions<IModelDb> & BackendDiagnosticsAttribute) => {
          options.diagnostics!.handler(diagnosticsResult);
          return 999;
        });
        const actualResult = await impl.getNodesCount(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(sinon.match(managerOptions));
        expect(actualResult).to.deep.eq({
          statusCode: PresentationStatus.Success,
          result: 999,
          diagnostics: diagnosticsResult,
        });
      });

      it("should return error result if manager throws", async () => {
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.callsFake(async () => {
          throw new PresentationError(PresentationStatus.Error, "test error");
        });
        const actualResult = impl.getNodesCount(testData.imodelToken, rpcOptions);
        await expect(actualResult).to.eventually.be.rejectedWith(PresentationError, "test error");
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("should return error result if manager throws and `requestTimeout` is set to 0", async () => {
        impl[Symbol.dispose]();
        impl = new PresentationRpcImpl({ requestTimeout: 0 });
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.callsFake(async () => {
          throw new PresentationError(PresentationStatus.Error, "test error");
        });
        const actualResult = impl.getNodesCount(testData.imodelToken, rpcOptions);
        await expect(actualResult).to.eventually.be.rejectedWith(PresentationError, "test error");
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });
    });

    describe("getNodesCount", () => {
      it("calls manager for root nodes count", async () => {
        const result = 999;
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.resolves(result);
        const actualResult = await impl.getNodesCount(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.eq(result);
      });

      it("calls manager for child nodes count", async () => {
        const result = 999;
        const parentNodeKey = createTestECInstancesNodeKey();
        const rpcOptions: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
        };
        const managerOptions: WithCancelEvent<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getNodesCount.resolves(result);
        const actualResult = await impl.getNodesCount(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.eq(result);
      });
    });

    describe("getPagedNodes", () => {
      it("calls manager for root nodes", async () => {
        const getRootNodesResult: HierarchyLevel = {
          nodes: [createTestNode(), createTestNode(), createTestNode()],
          supportsFiltering: true,
        };
        const getRootNodesCountResult = 999;
        const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
        };
        const managerOptions: WithCancelEvent<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getNodes.resolves(JSON.stringify(getRootNodesResult));
        presentationManagerMock.getNodesCount.resolves(getRootNodesCountResult);
        const actualResult = await impl.getPagedNodes(testData.imodelToken, rpcOptions);

        expect(presentationManagerMock[_presentation_manager_detail].getNodes).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result!.items).to.deep.eq(getRootNodesResult.nodes);
        expect(actualResult.result!.total).to.eq(getRootNodesCountResult);
      });

      it("calls manager for child nodes", async () => {
        const getChildNodesResult: HierarchyLevel = {
          nodes: [createTestNode(), createTestNode(), createTestNode()],
          supportsFiltering: true,
        };
        const getChildNodesCountResult = 999;
        const parentNodeKey = createTestECInstancesNodeKey();
        const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          parentKey: parentNodeKey,
        };
        const managerOptions: WithCancelEvent<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          parentKey: parentNodeKey,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getNodes.resolves(JSON.stringify(getChildNodesResult));
        presentationManagerMock.getNodesCount.resolves(getChildNodesCountResult);
        const actualResult = await impl.getPagedNodes(testData.imodelToken, rpcOptions);

        expect(presentationManagerMock[_presentation_manager_detail].getNodes).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result!.items).to.deep.eq(getChildNodesResult.nodes);
        expect(actualResult.result!.total).to.eq(getChildNodesCountResult);
      });

      it("enforces maximum page size when requesting with larger size than allowed", async () => {
        const getRootNodesResult: HierarchyLevel = {
          nodes: [],
        };
        const getRootNodesCountResult = 9999;
        const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: 9999 },
        };
        const managerOptions: WithCancelEvent<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getNodes.resolves(JSON.stringify(getRootNodesResult));
        presentationManagerMock.getNodesCount.resolves(getRootNodesCountResult);
        await impl.getPagedNodes(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getNodes).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("enforces maximum page size when requesting with undefined size", async () => {
        const getRootNodesResult: HierarchyLevel = {
          nodes: [],
        };
        const getRootNodesCountResult = 9999;
        const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0 },
        };
        const managerOptions: WithCancelEvent<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getNodes.resolves(JSON.stringify(getRootNodesResult));
        presentationManagerMock.getNodesCount.resolves(getRootNodesCountResult);
        await impl.getPagedNodes(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getNodes).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });

      it("enforces maximum page size when requesting with undefined page options", async () => {
        const getRootNodesResult: HierarchyLevel = {
          nodes: [],
        };
        const getRootNodesCountResult = 9999;
        const rpcOptions: Paged<HierarchyRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
        };
        const managerOptions: WithCancelEvent<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getNodes.resolves(JSON.stringify(getRootNodesResult));
        presentationManagerMock.getNodesCount.resolves(getRootNodesCountResult);
        await impl.getPagedNodes(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getNodes).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getNodesCount).to.have.been.calledOnceWith(managerOptions);
      });
    });

    describe("getNodesDescriptor", () => {
      it("calls manager for child nodes descriptor", async () => {
        const result = createTestContentDescriptor({ fields: [] });
        const parentNodeKey = createTestECInstancesNodeKey();
        const rpcOptions: HierarchyLevelDescriptorRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
        };
        const managerOptions: WithCancelEvent<HierarchyLevelDescriptorRequestOptions<IModelDb, NodeKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getNodesDescriptor.resolves(JSON.stringify(result.toJSON()));
        const actualResult = await impl.getNodesDescriptor(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getNodesDescriptor).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.eq(JSON.stringify(result.toJSON()));
      });
    });

    describe("getFilteredNodePaths", () => {
      it("calls manager", async () => {
        const result = [createTestNodePathElement(), createTestNodePathElement()];
        const managerOptions: WithCancelEvent<FilterByTextHierarchyRequestOptions<IModelDb>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          filterText: "filter",
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: PresentationRpcRequestOptions<FilterByTextHierarchyRequestOptions<never, RulesetVariableJSON>> = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          filterText: managerOptions.filterText,
        };
        presentationManagerMock[_presentation_manager_detail].getFilteredNodePaths.resolves(result);
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, rpcOptions);

        expect(presentationManagerMock[_presentation_manager_detail].getFilteredNodePaths).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.equal(result);
      });
    });

    describe("getNodePaths", () => {
      it("calls manager", async () => {
        const result = [createTestNodePathElement(), createTestNodePathElement()];
        const keyArray: InstanceKey[][] = [[createTestECInstanceKey(), createTestECInstanceKey()]];
        const managerOptions: WithCancelEvent<FilterByInstancePathsHierarchyRequestOptions<IModelDb>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          instancePaths: keyArray,
          markedIndex: 1,
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: PresentationRpcRequestOptions<FilterByInstancePathsHierarchyRequestOptions<never, RulesetVariableJSON>> = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          instancePaths: managerOptions.instancePaths,
          markedIndex: managerOptions.markedIndex,
        };
        presentationManagerMock[_presentation_manager_detail].getNodePaths.resolves(result);
        const actualResult = await impl.getNodePaths(testData.imodelToken, rpcOptions);

        expect(presentationManagerMock[_presentation_manager_detail].getNodePaths).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.equal(result);
      });
    });

    describe("getContentSources", () => {
      it("calls manager", async () => {
        const classes = ["test.class1"];
        const rpcOptions: ContentSourcesRpcRequestOptions = {
          ...defaultRpcParams,
          classes,
        };
        const managerOptions: WithCancelEvent<ContentSourcesRequestOptions<IModelDb>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          classes,
          cancelEvent: new BeEvent<() => void>(),
        };
        const managerResponse = [createTestSelectClassInfo()];
        const classesMap = {};
        const expectedResult: ContentSourcesRpcResult = {
          sources: managerResponse.map((sci) => SelectClassInfo.toCompressedJSON(sci, classesMap)),
          classesMap,
        };
        presentationManagerMock.getContentSources.resolves(managerResponse);
        const actualResult = await impl.getContentSources(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getContentSources).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(expectedResult);
      });
    });

    describe("getContentDescriptor", () => {
      it("calls manager", async () => {
        const keys = new KeySet();
        const descriptor = createTestContentDescriptor({ fields: [] });
        const rpcOptions: ContentDescriptorRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          displayType: testData.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<ContentDescriptorRequestOptions<IModelDb, KeySet>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          displayType: testData.displayType,
          contentFlags: DESCRIPTOR_ONLY_CONTENT_FLAG,
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getContentDescriptor.resolves(JSON.stringify(descriptor.toJSON()));
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContentDescriptor).to.have.been.calledOnceWithExactly(managerOptions);
        expect(actualResult.result).to.be.equal(JSON.stringify(descriptor.toJSON()));
      });

      it("handles undefined descriptor response", async () => {
        const keys = new KeySet();
        const rpcOptions: ContentDescriptorRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          displayType: testData.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<ContentDescriptorRequestOptions<IModelDb, KeySet>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          displayType: testData.displayType,
          contentFlags: DESCRIPTOR_ONLY_CONTENT_FLAG,
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getContentDescriptor.resolves(undefined);
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContentDescriptor).to.have.been.calledOnceWithExactly(managerOptions);
        expect(actualResult.result).to.be.undefined;
      });
    });

    describe("getContentSetSize", () => {
      it("calls manager", async () => {
        const keys = new KeySet();
        const result = 789;
        const descriptor = createTestContentDescriptor({ fields: [] });
        const rpcOptions: ContentRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock.getContentSetSize.resolves(result);
        const actualResult = await impl.getContentSetSize(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(result);
      });
    });

    describe("getPagedContent", () => {
      it("calls manager", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(999);
        const actualResult = await impl.getPagedContent(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          descriptor: content.descriptor.toJSON(),
          contentSet: {
            total: 999,
            items: content.contentSet.map((i) => i.toJSON()),
          },
        });
      });

      it("handles case when manager returns no content", async () => {
        const keys = new KeySet();
        const descriptorOverrides: DescriptorOverrides = {
          displayType: "",
          contentFlags: 0,
        };
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptorOverrides,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptorOverrides,
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(undefined);
        presentationManagerMock.getContentSetSize.resolves(0);
        const actualResult = await impl.getPagedContent(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.be.undefined;
      });

      it("enforces maximum page size when requesting with larger size than allowed", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE + 1 },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContent(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          descriptor: content.descriptor.toJSON(),
          contentSet: {
            total: 9999,
            items: content.contentSet.map((i) => i.toJSON()),
          },
        });
      });

      it("enforces maximum page size when requesting with undefined size", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 5 },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 5, size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContent(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          descriptor: content.descriptor.toJSON(),
          contentSet: {
            total: 9999,
            items: content.contentSet.map((i) => i.toJSON()),
          },
        });
      });

      it("enforces maximum page size when requesting with undefined page options", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: undefined,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContent(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          descriptor: content.descriptor.toJSON(),
          contentSet: {
            total: 9999,
            items: content.contentSet.map((i) => i.toJSON()),
          },
        });
      });
    });

    describe("getPagedContentSet", () => {
      it("calls manager", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(999);
        const actualResult = await impl.getPagedContentSet(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 999,
          items: content.contentSet.map((i) => i.toJSON()),
        });
      });

      it("handles case when manager returns no content", async () => {
        const keys = new KeySet();
        const descriptorOverrides: DescriptorOverrides = {
          displayType: "",
          contentFlags: 0,
        };
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptorOverrides,
          keys: keys.toJSON(),
        };
        sinon.stub(impl, "getPagedContent").resolves({
          statusCode: PresentationStatus.Success,
          result: undefined,
        });
        const response = await impl.getPagedContentSet(testData.imodelToken, rpcOptions);
        expect(response.statusCode).to.eq(PresentationStatus.Error);
        expect(response.errorMessage).to.contain("empty result");
      });

      it("handles case when `getPagedContent` call returns an error status", async () => {
        const keys = new KeySet();
        const descriptorOverrides: DescriptorOverrides = {
          displayType: "",
          contentFlags: 0,
        };
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          descriptor: descriptorOverrides,
          keys: keys.toJSON(),
        };
        sinon.stub(impl, "getPagedContent").resolves({
          statusCode: PresentationStatus.Error,
          errorMessage: "test error message",
        });
        expect(await impl.getPagedContentSet(testData.imodelToken, rpcOptions)).to.deep.eq({
          statusCode: PresentationStatus.Error,
          errorMessage: "test error message",
          result: undefined,
          diagnostics: undefined,
        });
      });

      it("enforces maximum page size when requesting with larger size than allowed", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE + 1 },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContentSet(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 9999,
          items: content.contentSet.map((i) => i.toJSON()),
        });
      });

      it("enforces maximum page size when requesting with undefined size", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 5 },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 5, size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContentSet(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 9999,
          items: content.contentSet.map((i) => i.toJSON()),
        });
      });

      it("enforces maximum page size when requesting with undefined page options", async () => {
        const keys = new KeySet();
        const contentItem = new Item([], "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: undefined,
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { size: MAX_ALLOWED_PAGE_SIZE },
          descriptor: content.descriptor.createDescriptorOverrides(),
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(9999);
        const actualResult = await impl.getPagedContentSet(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 9999,
          items: content.contentSet.map((i) => i.toJSON()),
        });
      });
    });

    describe("getPagedDistinctValues", () => {
      it("calls manager", async () => {
        const distinctValues = {
          total: 1,
          items: [
            {
              displayValue: "test",
              groupedRawValues: ["test"],
            },
          ],
        };
        const keys = new KeySet();
        const descriptor = createTestContentDescriptor({ fields: [] });
        const fieldDescriptor: FieldDescriptor = {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        };
        const managerOptions: WithCancelEvent<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          rulesetOrId: testData.rulesetOrId,
          imodel: testData.imodelMock as unknown as IModelDb,
          descriptor: descriptor.createDescriptorOverrides(),
          fieldDescriptor,
          keys,
          paging: testData.pageOptions,
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: DistinctValuesRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
          fieldDescriptor: managerOptions.fieldDescriptor,
          paging: testData.pageOptions,
        };
        presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues.resolves(distinctValues);
        const actualResult = await impl.getPagedDistinctValues(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(distinctValues);
      });

      it("enforces maximum page size when requesting with larger size than allowed", async () => {
        const distinctValues = {
          total: 1,
          items: [
            {
              displayValue: "test",
              groupedRawValues: ["test"],
            },
          ],
        };
        const keys = new KeySet();
        const descriptor = createTestContentDescriptor({ fields: [] });
        const fieldDescriptor: FieldDescriptor = {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        };
        const managerOptions: WithCancelEvent<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          rulesetOrId: testData.rulesetOrId,
          imodel: testData.imodelMock as unknown as IModelDb,
          descriptor: descriptor.createDescriptorOverrides(),
          fieldDescriptor,
          keys,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: DistinctValuesRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
          fieldDescriptor: managerOptions.fieldDescriptor,
          paging: { start: 0, size: MAX_ALLOWED_PAGE_SIZE + 1 },
        };
        presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues.resolves(distinctValues);
        const actualResult = await impl.getPagedDistinctValues(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(distinctValues);
      });

      it("enforces maximum page size when requesting with undefined size", async () => {
        const distinctValues = {
          total: 1,
          items: [
            {
              displayValue: "test",
              groupedRawValues: ["test"],
            },
          ],
        };
        const keys = new KeySet();
        const descriptor = createTestContentDescriptor({ fields: [] });
        const fieldDescriptor: FieldDescriptor = {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        };
        const managerOptions: WithCancelEvent<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          rulesetOrId: testData.rulesetOrId,
          imodel: testData.imodelMock as unknown as IModelDb,
          descriptor: descriptor.createDescriptorOverrides(),
          fieldDescriptor,
          keys,
          paging: { start: 5, size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: WithCancelEvent<DistinctValuesRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
          fieldDescriptor: managerOptions.fieldDescriptor,
          paging: { start: 5 },
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues.resolves(distinctValues);
        const actualResult = await impl.getPagedDistinctValues(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(distinctValues);
      });

      it("enforces maximum page size when requesting with undefined page options", async () => {
        const distinctValues = {
          total: 1,
          items: [
            {
              displayValue: "test",
              groupedRawValues: ["test"],
            },
          ],
        };
        const keys = new KeySet();
        const descriptor = createTestContentDescriptor({ fields: [] });
        const fieldDescriptor: FieldDescriptor = {
          type: FieldDescriptorType.Name,
          fieldName: "test",
        };
        const managerOptions: WithCancelEvent<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          rulesetOrId: testData.rulesetOrId,
          imodel: testData.imodelMock as unknown as IModelDb,
          descriptor: descriptor.createDescriptorOverrides(),
          fieldDescriptor,
          keys,
          paging: { size: MAX_ALLOWED_PAGE_SIZE },
          cancelEvent: new BeEvent<() => void>(),
        };
        const rpcOptions: DistinctValuesRpcRequestOptions = {
          ...defaultRpcParams,
          rulesetOrId: managerOptions.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys: keys.toJSON(),
          fieldDescriptor: managerOptions.fieldDescriptor,
          paging: undefined,
        };
        presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues.resolves(distinctValues);
        const actualResult = await impl.getPagedDistinctValues(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getPagedDistinctValues).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(distinctValues);
      });
    });

    describe("getElementProperties", () => {
      it("creates element properties from manager's content", async () => {
        const elementId = "0x123";
        const elementProperties: ElementProperties = {
          class: "Test Class",
          id: elementId,
          label: "test label",
          items: {
            ["Test Category"]: {
              type: "category",
              items: {
                ["Test Field"]: {
                  type: "primitive",
                  value: "test display value",
                },
              },
            },
          },
        };
        presentationManagerMock.getElementProperties.resolves(elementProperties);
        const actualResult = await impl.getElementProperties(testData.imodelToken, {
          ...defaultRpcParams,
          elementId,
        });
        expect(presentationManagerMock.getElementProperties).to.have.been.calledOnce;
        expect(actualResult.result).to.deep.eq(elementProperties);
      });
    });

    describe("getContentInstanceKeys", () => {
      it("calls manager", async () => {
        const keys = new KeySet();
        const contentItemKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
        const contentItem = new Item(contentItemKeys, "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentInstanceKeysRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          displayType: content.descriptor.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, DescriptorOverrides, KeySet, RulesetVariable>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: {
            displayType: content.descriptor.displayType,
            contentFlags: ContentFlags.KeysOnly,
          },
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };
        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(999);
        const actualResult = await impl.getContentInstanceKeys(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 999,
          items: new KeySet(contentItemKeys).toJSON(),
        });
      });

      it("handles case when manager returns no content", async () => {
        const keys = new KeySet();
        const rpcOptions: Paged<ContentInstanceKeysRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, DescriptorOverrides, KeySet, RulesetVariable>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: {
            displayType: undefined,
            contentFlags: ContentFlags.KeysOnly,
          },
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(undefined);
        presentationManagerMock.getContentSetSize.resolves(0);
        const actualResult = await impl.getContentInstanceKeys(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 0,
          items: new KeySet().toJSON(),
        });
      });

      it("enforces maximum page size when requesting with larger size than allowed", async () => {
        const keys = new KeySet();
        const contentItemKeys = [createTestECInstanceKey()];
        const contentItem = new Item(contentItemKeys, "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentInstanceKeysRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_KEYS_PAGE_SIZE + 1 },
          displayType: content.descriptor.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, DescriptorOverrides, KeySet, RulesetVariable>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 0, size: MAX_ALLOWED_KEYS_PAGE_SIZE },
          descriptor: {
            displayType: content.descriptor.displayType,
            contentFlags: ContentFlags.KeysOnly,
          },
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.withArgs(sinon.match.any).resolves(999);
        const actualResult = await impl.getContentInstanceKeys(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 999,
          items: new KeySet(contentItemKeys).toJSON(),
        });
      });

      it("enforces maximum page size when requesting with undefined size", async () => {
        const keys = new KeySet();
        const contentItemKeys = [createTestECInstanceKey()];
        const contentItem = new Item(contentItemKeys, "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentInstanceKeysRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 123 },
          displayType: content.descriptor.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, DescriptorOverrides, KeySet, RulesetVariable>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { start: 123, size: MAX_ALLOWED_KEYS_PAGE_SIZE },
          descriptor: {
            displayType: content.descriptor.displayType,
            contentFlags: ContentFlags.KeysOnly,
          },
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(999);
        const actualResult = await impl.getContentInstanceKeys(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 999,
          items: new KeySet(contentItemKeys).toJSON(),
        });
      });

      it("enforces maximum page size when requesting with undefined page options", async () => {
        const keys = new KeySet();
        const contentItemKeys = [createTestECInstanceKey()];
        const contentItem = new Item(contentItemKeys, "", "", undefined, {}, {}, [], undefined);
        const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
        const rpcOptions: Paged<ContentInstanceKeysRpcRequestOptions> = {
          ...defaultRpcParams,
          rulesetOrId: testData.rulesetOrId,
          displayType: content.descriptor.displayType,
          keys: keys.toJSON(),
        };
        const managerOptions: WithCancelEvent<Paged<ContentRequestOptions<IModelDb, DescriptorOverrides, KeySet, RulesetVariable>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          rulesetOrId: testData.rulesetOrId,
          paging: { size: MAX_ALLOWED_KEYS_PAGE_SIZE },
          descriptor: {
            displayType: content.descriptor.displayType,
            contentFlags: ContentFlags.KeysOnly,
          },
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getContent.resolves(content);
        presentationManagerMock.getContentSetSize.resolves(999);
        const actualResult = await impl.getContentInstanceKeys(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getContent).to.have.been.calledOnceWith(managerOptions);
        expect(presentationManagerMock.getContentSetSize).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({
          total: 999,
          items: new KeySet(contentItemKeys).toJSON(),
        });
      });
    });

    describe("getDisplayLabelDefinition", () => {
      it("calls manager", async () => {
        const result = createTestLabelDefinition();
        const key = createTestECInstanceKey();
        const rpcOptions: Paged<DisplayLabelRpcRequestOptions> = {
          ...defaultRpcParams,
          paging: testData.pageOptions,
          key,
        };
        const managerOptions: WithCancelEvent<Paged<DisplayLabelRequestOptions<IModelDb, InstanceKey>>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          paging: testData.pageOptions,
          key,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinition.resolves(result);
        const actualResult = await impl.getDisplayLabelDefinition(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinition).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(result);
      });
    });

    describe("getPagedDisplayLabelDefinitions", () => {
      it("calls manager", async () => {
        const result = [createTestLabelDefinition(), createTestLabelDefinition()];
        const keys = [createTestECInstanceKey(), createTestECInstanceKey()];
        const rpcOptions: DisplayLabelsRpcRequestOptions = {
          ...defaultRpcParams,
          keys,
        };
        const managerOptions: WithCancelEvent<DisplayLabelsRequestOptions<IModelDb, InstanceKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          keys,
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinitions.resolves(result);
        const actualResult = await impl.getPagedDisplayLabelDefinitions(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinitions).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({ total: 2, items: result });
      });

      it("enforces maximum page size when requesting more labels than allowed", async () => {
        const result = new Array(MAX_ALLOWED_PAGE_SIZE).fill(createTestLabelDefinition());
        const keys = new Array(MAX_ALLOWED_PAGE_SIZE + 1).fill(createTestECInstanceKey());
        const rpcOptions: DisplayLabelsRpcRequestOptions = {
          ...defaultRpcParams,
          keys,
        };
        const managerOptions: WithCancelEvent<DisplayLabelsRequestOptions<IModelDb, InstanceKey>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          keys: keys.slice(0, MAX_ALLOWED_PAGE_SIZE),
          cancelEvent: new BeEvent<() => void>(),
        };

        presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinitions.resolves(result);
        const actualResult = await impl.getPagedDisplayLabelDefinitions(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock[_presentation_manager_detail].getDisplayLabelDefinitions).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq({ total: MAX_ALLOWED_PAGE_SIZE, items: result });
      });
    });

    describe("getSelectionScopes", () => {
      it("calls manager", async () => {
        const rpcOptions: PresentationRpcRequestOptions<SelectionScopeRequestOptions<never>> = {
          ...defaultRpcParams,
        };
        const managerOptions: WithCancelEvent<SelectionScopeRequestOptions<IModelDb>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          cancelEvent: new BeEvent<() => void>(),
        };
        const result: SelectionScope[] = [{ id: "element", label: "Element" }];
        presentationManagerMock.getSelectionScopes.resolves(result);
        const actualResult = await impl.getSelectionScopes(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.getSelectionScopes).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(result);
      });
    });

    describe("computeSelection", () => {
      it("calls manager", async () => {
        const scopeId = "element";
        const ancestorLevel = 123;
        const elementIds = ["0x123"];
        const rpcOptions: ComputeSelectionRpcRequestOptions = {
          ...defaultRpcParams,
          elementIds,
          scope: {
            id: scopeId,
            ancestorLevel,
          },
        };
        const managerOptions: WithCancelEvent<ComputeSelectionRequestOptions<IModelDb>> = {
          imodel: testData.imodelMock as unknown as IModelDb,
          elementIds,
          scope: {
            id: scopeId,
            ancestorLevel,
          },
          cancelEvent: new BeEvent<() => void>(),
        };
        const result = new KeySet();
        presentationManagerMock.computeSelection.resolves(result);
        const actualResult = await impl.computeSelection(testData.imodelToken, rpcOptions);
        expect(presentationManagerMock.computeSelection).to.have.been.calledOnceWith(managerOptions);
        expect(actualResult.result).to.deep.eq(result.toJSON());
      });
    });
  });
});

function createIModelRpcProps(): IModelRpcProps {
  return {
    key: Guid.createValue(),
  };
}

function stubPresentationManager() {
  const onManagerUsed = new BeEvent();
  const rulesetsMock = {};
  const variablesMock = {};
  return {
    [Symbol.dispose]: sinon.stub(),
    vars: sinon.stub().returns(variablesMock),
    rulesets: sinon.stub().returns(rulesetsMock),
    onUsed: onManagerUsed,
    getNodesCount: sinon.stub(),
    getContentSources: sinon.stub(),
    getContentSetSize: sinon.stub(),
    getElementProperties: sinon.stub(),
    getSelectionScopes: sinon.stub(),
    computeSelection: sinon.stub(),
    [_presentation_manager_detail]: {
      getNodes: sinon.stub(),
      getNodesDescriptor: sinon.stub(),
      getFilteredNodePaths: sinon.stub(),
      getNodePaths: sinon.stub(),
      getContent: sinon.stub(),
      getContentDescriptor: sinon.stub(),
      getPagedDistinctValues: sinon.stub(),
      getDisplayLabelDefinition: sinon.stub(),
      getDisplayLabelDefinitions: sinon.stub(),
    },
  };
}

function stubIModelDb() {
  return {
    refreshContainerForRpc: sinon.stub(),
  };
}
