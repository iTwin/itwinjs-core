/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import sinon from "sinon";
import { BeDuration, BeEvent, CompressedId64Set, TransientIdSequence } from "@itwin/core-bentley";
import { IModelRpcProps, IpcListener, RemoveFunction } from "@itwin/core-common";
import { IModelApp, IModelConnection, IpcApp, QuantityFormatter } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import {
  Content,
  ContentDescriptorRequestOptions,
  ContentFlags,
  ContentInstanceKeysRequestOptions,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  ContentSourcesRpcResult,
  DefaultContentDisplayTypes,
  Descriptor,
  DescriptorOverrides,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DistinctValuesRequestOptions,
  ECInstancesNodeKey,
  ElementProperties,
  FieldDescriptor,
  FieldDescriptorType,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  HierarchyRequestOptions,
  InstanceKey,
  Item,
  KeySet,
  NodeKey,
  Paged,
  PropertyValueFormat,
  RegisteredRuleset,
  Ruleset,
  RulesetVariable,
  SelectClassInfo,
  UpdateInfo,
  VariableValueTypes,
} from "@itwin/presentation-common";
import { PresentationIpcEvents, RpcRequestsHandler } from "@itwin/presentation-common/internal";
import {
  createTestCategoryDescription,
  createTestContentDescriptor,
  createTestContentItem,
  createTestECClassInfo,
  createTestECInstanceKey,
  createTestECInstancesNode,
  createTestECInstancesNodeKey,
  createTestLabelDefinition,
  createTestNodePathElement,
  createTestPropertiesContentField,
  createTestSimpleContentField,
} from "@itwin/presentation-common/test-utils";
import { TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { imodelInitializationHandlers } from "../presentation-frontend/IModelConnectionInitialization.js";
import { _presentation_manager_ipcRequestsHandler, _presentation_manager_rpcRequestsHandler } from "../presentation-frontend/InternalSymbols.js";
import { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler.js";
import { Presentation } from "../presentation-frontend/Presentation.js";
import {
  IModelContentChangeEventArgs,
  IModelHierarchyChangeEventArgs,
  PresentationManager,
  PresentationManagerProps,
} from "../presentation-frontend/PresentationManager.js";
import { RulesetManagerImpl } from "../presentation-frontend/RulesetManager.js";
import { RulesetVariablesManagerImpl } from "../presentation-frontend/RulesetVariablesManager.js";

describe("PresentationManager", () => {
  let rulesetsManagerMock: ReturnType<typeof stubRulesetsManager>;
  let rulesetsManager: RulesetManagerImpl;

  let rpcRequestsHandlerMock: ReturnType<typeof stubRpcRequestsHandler>;
  let rpcRequestsHandler: RpcRequestsHandler;

  let manager: PresentationManager;

  let i18nMock: ReturnType<typeof stubITwinLocalization>;
  let i18n: ITwinLocalization;

  let quantityFormatter: QuantityFormatter;
  let quantityFormatterUnitSystem: UnitSystemKey = "metric";
  const testData = {
    imodelToken: {} as IModelRpcProps,
    imodel: {} as IModelConnection,
    pageOptions: { start: 0, size: 0 },
    rulesetId: "",
  };
  let rulesetManagerCreateStub: sinon.SinonSpy<[], RulesetManagerImpl>;

  beforeEach(() => {
    i18nMock = stubITwinLocalization();
    i18n = i18nMock as unknown as ITwinLocalization;
    sinon.replaceGetter(Presentation, "localization", () => i18n);

    quantityFormatter = {
      get activeUnitSystem() {
        return quantityFormatterUnitSystem;
      },
    } as unknown as QuantityFormatter;
    sinon.stub(IModelApp, "quantityFormatter").get(() => quantityFormatter);

    testData.imodel = {
      getRpcProps: sinon.stub().returns(testData.imodelToken),
      onClose: new BeEvent(),
    } as unknown as IModelConnection;

    testData.pageOptions = { start: 111, size: 0 };
    testData.rulesetId = "test ruleset id";

    rulesetsManagerMock = stubRulesetsManager();
    rulesetsManager = rulesetsManagerMock as unknown as RulesetManagerImpl;
    rulesetManagerCreateStub = sinon.stub(RulesetManagerImpl, "create").returns(rulesetsManager);

    rpcRequestsHandlerMock = stubRpcRequestsHandler();
    rpcRequestsHandler = rpcRequestsHandlerMock as unknown as RpcRequestsHandler;

    recreateManager();
  });

  afterEach(() => {
    manager[Symbol.dispose]();
    Presentation.terminate();
  });

  function stubRulesetsManager() {
    return {
      get: sinon.stub(),
    };
  }

  function stubRpcRequestsHandler() {
    return {
      getNodesDescriptor: sinon.stub(),
      getNodesCount: sinon.stub(),
      getPagedNodes: sinon.stub(),
      getNodePaths: sinon.stub(),
      getFilteredNodePaths: sinon.stub(),
      getContentDescriptor: sinon.stub(),
      getContentSources: sinon.stub(),
      getContentSetSize: sinon.stub(),
      getContentInstanceKeys: sinon.stub(),
      getPagedContentSet: sinon.stub(),
      getPagedContent: sinon.stub(),
      getPagedDistinctValues: sinon.stub(),
      getDisplayLabelDefinition: sinon.stub(),
      getPagedDisplayLabelDefinitions: sinon.stub(),
    };
  }

  function stubITwinLocalization() {
    return {
      registerNamespace: sinon.stub().resolves(),
      getLocalizedString: sinon.stub().callsFake((stringId) => stringId),
    };
  }

  function recreateManager(props?: Partial<PresentationManagerProps>) {
    manager && manager[Symbol.dispose]();
    manager = PresentationManager.create({
      // @ts-expect-error internal prop
      rpcRequestsHandler,
      ...props,
    });
  }

  // use this when sending requests without ruleset-related attributes
  const toIModelTokenOptions = <TOptions extends { imodel: IModelConnection; unitSystem?: UnitSystemKey }>(requestOptions: TOptions) => {
    return {
      unitSystem: quantityFormatterUnitSystem,
      ...requestOptions,
      imodel: requestOptions.imodel.getRpcProps(),
    };
  };

  // use this when sending ruleset-related requests
  function toRulesetRpcOptions<
    TOptions extends {
      imodel?: IModelConnection;
      rulesetOrId?: Ruleset | string;
      locale?: string;
      unitSystem?: UnitSystemKey;
      rulesetVariables?: RulesetVariable[];
    },
  >(options: TOptions) {
    return toIModelTokenOptions({
      rulesetOrId: testData.rulesetId,
      imodel: testData.imodel,
      unitSystem: quantityFormatterUnitSystem,
      ...options,
      rulesetVariables: options.rulesetVariables?.map(RulesetVariable.toJSON) ?? [],
    });
  }

  describe("constructor", () => {
    it("sets active locale if supplied with props", async () => {
      const props = { activeLocale: "en" };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

    it("[deprecated] sets active unit system override if supplied with props", async () => {
      const props = { activeUnitSystem: "usSurvey" as UnitSystemKey };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeUnitSystem).to.eq(props.activeUnitSystem);
    });

    it("sets custom RpcRequestsHandler if supplied with props", async () => {
      const handler = {} as RpcRequestsHandler;
      const mgr = PresentationManager.create({
        // @ts-expect-error internal prop
        rpcRequestsHandler: handler,
      });
      expect(mgr[_presentation_manager_rpcRequestsHandler]).to.eq(handler);
    });

    it("sets RpcRequestsHandler clientId if supplied with props", async () => {
      const props = { clientId: "some client id" };
      const mgr = PresentationManager.create(props);
      expect(mgr[_presentation_manager_rpcRequestsHandler].clientId).to.eq(props.clientId);
    });

    it("sets RpcRequestsHandler timeout if supplied with props", async () => {
      const props = { requestTimeout: 123 };
      const mgr = PresentationManager.create(props);
      expect(mgr[_presentation_manager_rpcRequestsHandler].timeout).to.eq(props.requestTimeout);
    });

    it("sets custom IpcRequestsHandler if supplied with props", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      sinon.stub(IpcApp, "addListener");
      const handler = {} as IpcRequestsHandler;
      const mgr = PresentationManager.create({
        // @ts-expect-error internal prop
        ipcRequestsHandler: handler,
      });
      expect(mgr[_presentation_manager_ipcRequestsHandler]).to.eq(handler);
    });

    it("creates RpcRequestsHandler and IpcRequestsHandler with same client id", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      sinon.stub(IpcApp, "addListener");
      const mgr = PresentationManager.create();
      expect(mgr[_presentation_manager_rpcRequestsHandler].clientId).to.eq(mgr[_presentation_manager_ipcRequestsHandler]?.clientId);
    });

    it("starts listening to update events", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      const addListenerSpy = sinon.stub(IpcApp, "addListener").returns(() => {});
      {
        using _ = PresentationManager.create();
      }
      expect(addListenerSpy).to.be.calledOnceWith(
        PresentationIpcEvents.Update,
        sinon.match((arg) => typeof arg === "function"),
      );
    });
  });

  describe("onConnection", () => {
    it("calls `startIModelInitialization`", async () => {
      const spy = sinon.spy();
      imodelInitializationHandlers.add({ startInitialization: spy, ensureInitialized: async () => {} });
      const onCloseEvent = new BeEvent();
      const imodel = {
        onClose: onCloseEvent,
        getRpcProps: () => testData.imodelToken,
      } as unknown as IModelConnection;
      rpcRequestsHandlerMock.getNodesCount.resolves(0);

      // expect the spy to be called on first imodel use
      await manager.getNodesCount({
        imodel,
        rulesetOrId: testData.rulesetId,
      });
      expect(spy).to.be.calledOnceWith(imodel);
      spy.resetHistory();

      // simulate imodel close
      onCloseEvent.raiseEvent();

      // expect the spy to be called again
      await manager.getNodesCount({
        imodel,
        rulesetOrId: testData.rulesetId,
      });
      expect(spy).to.be.calledOnceWith(imodel);
    });
  });

  describe("activeLocale", () => {
    it("requests with manager's locale if not set in request options", async () => {
      const locale = "lt-LT";
      manager.activeLocale = locale;
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
      });
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(
        toRulesetRpcOptions({
          locale,
        }),
      );
    });

    it("requests with request's locale if set", async () => {
      const locale = "en-US";
      manager.activeLocale = "en-GB";
      expect(manager.activeLocale).to.not.eq(locale);
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        locale,
      });
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(
        toRulesetRpcOptions({
          locale,
        }),
      );
    });
  });

  describe("activeUnitSystem", () => {
    it("requests with quantity formatter unit system if not set in request options or overriden in manager", async () => {
      const keys = new KeySet();
      quantityFormatterUnitSystem = "usSurvey";
      rpcRequestsHandlerMock.getContentDescriptor.resolves(undefined);
      await manager.getContentDescriptor({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        displayType: "",
        keys,
      });
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(
        toRulesetRpcOptions({
          unitSystem: quantityFormatterUnitSystem,
          displayType: "",
          keys: keys.toJSON(),
        }),
      );
    });

    it("[deprecated] requests with manager's unit system if not set in request options", async () => {
      const keys = new KeySet();
      const unitSystem = "usSurvey" as const;
      manager.activeUnitSystem = unitSystem;
      rpcRequestsHandlerMock.getContentDescriptor.resolves(undefined);
      await manager.getContentDescriptor({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        displayType: "",
        keys,
      });
      const expectedOptions = {
        unitSystem,
        displayType: "",
        keys: keys.toJSON(),
      };
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions(expectedOptions));
    });

    it("requests with request's unit system if set", async () => {
      const keys = new KeySet();
      const unitSystem = "usSurvey" as const;
      manager.activeUnitSystem = "metric";
      rpcRequestsHandlerMock.getContentDescriptor.resolves(undefined);
      await manager.getContentDescriptor({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        unitSystem,
        displayType: "",
        keys,
      });
      const expectedOptions = {
        unitSystem,
        displayType: "",
        keys: keys.toJSON(),
      };
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions(expectedOptions));
    });
  });

  describe("ruleset variables", () => {
    const variableId = "var id";
    const variableValue = "test value";

    beforeEach(async () => {
      await manager.vars(testData.rulesetId).setString(variableId, variableValue);
    });

    it("injects ruleset variables into request options", async () => {
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
      });
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(
        toRulesetRpcOptions({
          rulesetVariables: [{ id: variableId, value: variableValue, type: VariableValueTypes.String }],
        }),
      );
    });

    it("orders Id64[] ruleset variables before injecting into request options", async () => {
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        rulesetVariables: [
          {
            type: VariableValueTypes.Id64Array,
            id: "order-id64[]",
            value: ["0x2", "0x1"],
          },
        ],
      });
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        rulesetVariables: [
          { id: "order-id64[]", value: CompressedId64Set.compressArray(["0x1", "0x2"]), type: VariableValueTypes.Id64Array },
          { id: variableId, value: variableValue, type: VariableValueTypes.String },
        ],
        unitSystem: quantityFormatterUnitSystem,
      });
    });

    it("does not inject ruleset variables into request options in IpcApp", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      sinon.stub(IpcApp, "addListener");
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      manager[Symbol.dispose]();
      manager = PresentationManager.create({
        // @ts-expect-error internal prop
        rpcRequestsHandler,
      });
      await manager.getNodesCount({
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
      });
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(toRulesetRpcOptions({}));
    });
  });

  describe("rulesets", () => {
    it("returns rulesets manager provided through props", () => {
      const rulesets = manager.rulesets();
      expect(rulesets).to.eq(rulesetsManager);
    });

    it("returns an instance of `RulesetManagerImpl` if not provided through props", () => {
      rulesetManagerCreateStub.restore();
      manager = PresentationManager.create();
      const rulesets = manager.rulesets();
      expect(rulesets).to.be.instanceOf(RulesetManagerImpl);
    });
  });

  describe("vars", () => {
    it("returns ruleset variables manager", () => {
      const vars = manager.vars(testData.rulesetId);
      expect(vars).to.be.instanceOf(RulesetVariablesManagerImpl);

      const vars2 = manager.vars(testData.rulesetId);
      expect(vars2).to.equal(vars);
    });
  });

  describe("getNodesAndCount", () => {
    it("requests root nodes from proxy", async () => {
      const nodes = [createTestECInstancesNode(), createTestECInstancesNode()];
      const count = nodes.length;
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock.getPagedNodes.resolves({ total: count, items: nodes });
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count, nodes });
      expect(rpcRequestsHandlerMock.getPagedNodes).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const nodes = [createTestECInstancesNode(), createTestECInstancesNode()];
      const count = nodes.length;
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock.getPagedNodes.resolves({ total: count, items: nodes });
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count, nodes });
      expect(rpcRequestsHandlerMock.getPagedNodes).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, parentKey: parentNodeKey }));
    });

    it("requests child nodes through multiple requests when getting partial responses", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const node1 = createTestECInstancesNode();
      const node2 = createTestECInstancesNode();
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock.getPagedNodes.onFirstCall().resolves({ total: 2, items: [node1] });
      rpcRequestsHandlerMock.getPagedNodes.onSecondCall().resolves({ total: 2, items: [node2] });
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count: 2, nodes: [node1, node2] });
      expect(rpcRequestsHandlerMock.getPagedNodes.firstCall).to.have.been.calledWith(
        toRulesetRpcOptions({ ...options, parentKey: parentNodeKey, paging: { start: 0, size: 0 } }),
      );
      expect(rpcRequestsHandlerMock.getPagedNodes.secondCall).to.have.been.calledWith(
        toRulesetRpcOptions({ ...options, parentKey: parentNodeKey, paging: { start: 1, size: 1 } }),
      );
    });
  });

  describe("getNodes", () => {
    it("requests root nodes from proxy", async () => {
      const result = [createTestECInstancesNode(), createTestECInstancesNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock.getPagedNodes.resolves({ total: result.length, items: result });
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq(result);
      expect(rpcRequestsHandlerMock.getPagedNodes).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });

    it("requests localized root nodes from proxy", async () => {
      i18nMock.getLocalizedString.withArgs("EN:LocalizableString", sinon.match.any).returns("LocalizedString");
      const prelocalizedNode = createTestECInstancesNode({
        label: { rawValue: "@EN:LocalizableString@", displayValue: "@EN:LocalizableString@", typeName: "string" },
      });
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock.getPagedNodes.resolves({ total: 1, items: [prelocalizedNode] });

      const actualResult = await manager.getNodes(options);
      const expectedResult = {
        ...prelocalizedNode,
        label: {
          ...prelocalizedNode.label,
          rawValue: "LocalizedString",
          displayValue: "LocalizedString",
        },
      };
      expect(actualResult).to.deep.eq([expectedResult]);
      expect(rpcRequestsHandlerMock.getPagedNodes).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const result = [createTestECInstancesNode(), createTestECInstancesNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock.getPagedNodes.resolves({ total: result.length, items: result });
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq(result);
      expect(rpcRequestsHandlerMock.getPagedNodes).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, parentKey: parentNodeKey }));
    });

    it("requests child nodes through multiple requests when getting partial responses", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const node1 = createTestECInstancesNode();
      const node2 = createTestECInstancesNode();
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock.getPagedNodes.onFirstCall().resolves({ total: 2, items: [node1] });
      rpcRequestsHandlerMock.getPagedNodes.onSecondCall().resolves({ total: 2, items: [node2] });
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq([node1, node2]);
      expect(rpcRequestsHandlerMock.getPagedNodes.firstCall).to.have.been.calledWith(
        toRulesetRpcOptions({ ...options, parentKey: parentNodeKey, paging: { start: 0, size: 0 } }),
      );
      expect(rpcRequestsHandlerMock.getPagedNodes.secondCall).to.have.been.calledWith(
        toRulesetRpcOptions({ ...options, parentKey: parentNodeKey, paging: { start: 1, size: 1 } }),
      );
    });
  });

  describe("getNodesCount", () => {
    it("requests root nodes count from proxy", async () => {
      const result = 123;
      const options: HierarchyRequestOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock.getNodesCount.resolves(result);
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const result = 456;
      const options: HierarchyRequestOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock.getNodesCount.resolves(result);
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, parentKey: parentNodeKey }));
    });
  });

  describe("getNodesDescriptor", () => {
    const createTestOptions = (parentKey: ECInstancesNodeKey = createTestECInstancesNodeKey()) => ({
      imodel: testData.imodel,
      rulesetOrId: testData.rulesetId,
      parentKey,
    });

    it("calls `ensureIModelInitialized`", async () => {
      const ensureInitialized = sinon.fake.returns(Promise.resolve());
      imodelInitializationHandlers.add({ startInitialization: () => {}, ensureInitialized });

      const result = createTestContentDescriptor({ fields: [] });
      const options = createTestOptions();
      rpcRequestsHandlerMock.getNodesDescriptor.resolves(result.toJSON());
      await manager.getNodesDescriptor(options);
      expect(ensureInitialized).to.be.calledOnce;
    });

    it("requests child nodes descriptor from proxy", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const result = createTestContentDescriptor({ fields: [] });
      const options = createTestOptions(parentNodeKey);
      rpcRequestsHandlerMock.getNodesDescriptor.resolves(result.toJSON());
      const actualResult = await manager.getNodesDescriptor(options);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      expect(rpcRequestsHandlerMock.getNodesDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, parentKey: parentNodeKey }));
    });

    it("handles undefined descriptor", async () => {
      const parentNodeKey = createTestECInstancesNodeKey();
      const options = createTestOptions(parentNodeKey);
      rpcRequestsHandlerMock.getNodesDescriptor.resolves(undefined);
      const actualResult = await manager.getNodesDescriptor(options);
      expect(rpcRequestsHandlerMock.getNodesDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, parentKey: parentNodeKey }));
      expect(actualResult).to.be.undefined;
    });
  });

  describe("getFilteredNodePaths", () => {
    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createTestNodePathElement(), createTestNodePathElement()];
      const options: FilterByTextHierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        filterText: "test",
      };
      rpcRequestsHandlerMock.getFilteredNodePaths.resolves(value);
      const result = await manager.getFilteredNodePaths(options);
      expect(result).to.be.deep.equal(value);
      expect(rpcRequestsHandlerMock.getFilteredNodePaths).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });
  });

  describe("getNodePaths", () => {
    it("calls getNodePaths through proxy", async () => {
      const value = [createTestNodePathElement(), createTestNodePathElement()];
      const keyArray = [[createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })]];
      const options: FilterByInstancePathsHierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        instancePaths: keyArray,
        markedIndex: 1,
      };
      rpcRequestsHandlerMock.getNodePaths.resolves(value);
      const result = await manager.getNodePaths(options);
      expect(result).to.be.deep.equal(value);
      expect(rpcRequestsHandlerMock.getNodePaths).to.have.been.calledOnceWith(toRulesetRpcOptions(options));
    });
  });

  describe("getContentSources", () => {
    it("requests content sources from proxy", async () => {
      const classes = ["test.class1"];
      const options: ContentSourcesRequestOptions<IModelConnection> = {
        imodel: testData.imodel,
        classes,
      };
      const rpcRequestsHandlerResponse: ContentSourcesRpcResult = {
        sources: [
          {
            selectClassInfo: "0x123",
            isSelectPolymorphic: true,
          },
        ],
        classesMap: {
          "0x123": { name: "class_name", label: "Class Label" },
        },
      };
      const expectedResult: SelectClassInfo[] = [
        {
          selectClassInfo: { id: "0x123", name: "class_name", label: "Class Label" },
          isSelectPolymorphic: true,
        },
      ];
      rpcRequestsHandlerMock.getContentSources.resolves(rpcRequestsHandlerResponse);
      const actualResult = await manager.getContentSources(options);
      expect(actualResult).to.deep.eq(expectedResult);
      expect(rpcRequestsHandlerMock.getContentSources).to.have.been.calledOnceWith(toIModelTokenOptions(options));
    });
  });

  describe("getContentDescriptor", () => {
    const createTestOptions = (keys: KeySet = new KeySet()): ContentDescriptorRequestOptions<IModelConnection, KeySet> => ({
      imodel: testData.imodel,
      rulesetOrId: testData.rulesetId,
      displayType: "test",
      keys,
    });

    it("calls `ensureIModelInitialized`", async () => {
      const ensureInitialized = sinon.fake.returns(Promise.resolve());
      imodelInitializationHandlers.add({ startInitialization: () => {}, ensureInitialized });
      const testOptions = createTestOptions();
      rpcRequestsHandlerMock.getContentDescriptor.resolves(undefined);
      await manager.getContentDescriptor(testOptions);
      expect(ensureInitialized).to.be.calledOnce;
    });

    it("requests descriptor from proxy", async () => {
      const keyset = new KeySet();
      const result = createTestContentDescriptor({ fields: [] });
      const options = createTestOptions(keyset);
      rpcRequestsHandlerMock.getContentDescriptor.resolves(result.toJSON());
      const actualResult = await manager.getContentDescriptor(options);
      expect(actualResult).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, keys: keyset.toJSON() }));
    });

    it("skips transient element keys", async () => {
      const persistentKey = createTestECInstanceKey();
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: new TransientIdSequence().getNext() };
      const keyset = new KeySet([persistentKey, transientKey]);
      const options = createTestOptions(keyset);
      rpcRequestsHandlerMock.getContentDescriptor.resolves(createTestContentDescriptor({ fields: [] }).toJSON());
      await manager.getContentDescriptor(options);
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(
        toRulesetRpcOptions({ ...options, keys: new KeySet([persistentKey]).toJSON() }),
      );
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      const options = createTestOptions(keyset);
      rpcRequestsHandlerMock.getContentDescriptor.resolves(undefined);
      const actualResult = await manager.getContentDescriptor(options);
      expect(rpcRequestsHandlerMock.getContentDescriptor).to.have.been.calledOnceWith(toRulesetRpcOptions({ ...options, keys: keyset.toJSON() }));
      expect(actualResult).to.be.undefined;
    });
  });

  describe("getContentSetSize", () => {
    it("requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = 456;
      const options: ContentRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getContentSetSize.resolves(result);
      const actualResult = await manager.getContentSetSize(options);
      expect(actualResult).to.eq(result);
      expect(rpcRequestsHandlerMock.getContentSetSize).to.have.been.calledOnceWith(
        toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON() }),
      );
    });

    it("requests content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const overrides = descriptor.createDescriptorOverrides();
      const result = 789;
      const options: ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        descriptor: overrides,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getContentSetSize.resolves(result);
      const actualResult = await manager.getContentSetSize(options);
      expect(actualResult).to.eq(result);
      expect(rpcRequestsHandlerMock.getContentSetSize).to.have.been.calledOnceWith(
        toRulesetRpcOptions({ ...options, descriptor: overrides, keys: keyset.toJSON() }),
      );
    });
  });

  describe("getContent", () => {
    it("calls `ensureIModelInitialized`", async () => {
      const ensureInitialized = sinon.fake.returns(Promise.resolve());
      imodelInitializationHandlers.add({ startInitialization: () => {}, ensureInitialized });
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = {
        total: 1,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ ...result, items: result.items.map((i) => i.toJSON()) });
      await manager.getContent(options);
      expect(ensureInitialized).to.be.calledOnce;
    });

    it("requests content from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = {
        total: 1,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ ...result, items: result.items.map((i) => i.toJSON()) });
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.deep.eq(descriptor);
      expect(actualResult!.contentSet).to.deep.eq(result.items);
      expect(rpcRequestsHandlerMock.getPagedContentSet).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("requests content from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const overrides = descriptor.createDescriptorOverrides();
      const items = [new Item([], "", "", undefined, {}, {}, [])];
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: overrides,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContent.resolves({ descriptor: descriptor.toJSON(), contentSet: { total: 1, items: items.map((i) => i.toJSON()) } });
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.deep.eq(descriptor);
      expect(actualResult!.contentSet).to.deep.eq(items);
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: overrides, keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContent.resolves(undefined);
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.undefined;
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("requests content without formatting from proxy", async () => {
      // setup manager to support values formatting
      recreateManager({ schemaContextProvider: () => new SchemaContext() });

      const keyset = new KeySet();
      const fieldName = "testField";
      const descriptor = createTestContentDescriptor({
        fields: [
          createTestPropertiesContentField({
            name: fieldName,
            properties: [],
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
          }),
        ],
      });
      const item = createTestContentItem({
        displayValues: {},
        values: {
          [fieldName]: 1.234,
        },
      });
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
        omitFormattedValues: true,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ total: 1, items: [item.toJSON()] });
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.deep.eq(descriptor);
      expect(actualResult!.contentSet).to.have.lengthOf(1);
      expect(actualResult!.contentSet[0].displayValues[fieldName]).to.be.undefined;
      expect(actualResult!.contentSet[0].values[fieldName]).to.be.eq(1.234);
      expect(rpcRequestsHandlerMock.getPagedContentSet).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("requests content without formatting from proxy and formats", async () => {
      // setup manager to support values formatting
      recreateManager({ schemaContextProvider: () => new SchemaContext() });

      const keyset = new KeySet();
      const fieldName = "testField";
      const descriptor = createTestContentDescriptor({
        fields: [
          createTestPropertiesContentField({
            name: fieldName,
            properties: [],
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
          }),
        ],
      });
      const item = createTestContentItem({
        displayValues: {},
        values: {
          [fieldName]: 1.234,
        },
      });
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ total: 1, items: [item.toJSON()] });
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.deep.eq(descriptor);
      expect(actualResult!.contentSet).to.have.lengthOf(1);
      expect(actualResult!.contentSet[0].displayValues[fieldName]).to.be.eq("1.23");
      expect(actualResult!.contentSet[0].values[fieldName]).to.be.eq(1.234);
      expect(rpcRequestsHandlerMock.getPagedContentSet).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });
  });

  describe("getContentAndContentSize", () => {
    it("calls `ensureIModelInitialized`", async () => {
      const ensureInitialized = sinon.fake.returns(Promise.resolve());
      imodelInitializationHandlers.add({ startInitialization: () => {}, ensureInitialized });
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = {
        total: 1,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ ...result, items: result.items.map((i) => i.toJSON()) });

      await manager.getContentAndSize(options);

      expect(ensureInitialized).to.be.calledOnce;
    });

    it("requests content and contentSize from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = {
        total: 1,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContentSet.resolves({ ...result, items: result.items.map((i) => i.toJSON()) });
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: result.total,
        content: {
          descriptor,
          contentSet: result.items,
        },
      });
      expect(rpcRequestsHandlerMock.getPagedContentSet).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("requests content and content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result = {
        total: 1,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContent.resolves({
        descriptor: descriptor.toJSON(),
        contentSet: { ...result, items: result.items.map((i) => i.toJSON()) },
      });
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: result.total,
        content: {
          descriptor,
          contentSet: result.items,
        },
      });
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });

    it("requests full content only for the first partial request when using descriptor overrides and multiple partial requests are needed", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const item1 = new Item([], "", "", undefined, {}, {}, []);
      const item2 = new Item([], "", "", undefined, {}, {}, []);
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: { start: 0, size: 2 },
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      const getPagedContentStub = rpcRequestsHandlerMock.getPagedContent;
      getPagedContentStub
        .withArgs(
          sinon.match(
            toRulesetRpcOptions({
              ...options,
              descriptor: descriptor.createDescriptorOverrides(),
              keys: keyset.toJSON(),
              paging: { start: 0, size: 2 },
              omitFormattedValues: true,
            }),
          ),
        )
        .resolves({ descriptor: descriptor.toJSON(), contentSet: { total: 2, items: [item1.toJSON()] } });

      const getPagedContentSetStub = rpcRequestsHandlerMock.getPagedContentSet;
      getPagedContentSetStub
        .withArgs(
          sinon.match(
            toRulesetRpcOptions({
              ...options,
              descriptor: descriptor.createDescriptorOverrides(),
              keys: keyset.toJSON(),
              paging: { start: 1, size: 1 },
              omitFormattedValues: true,
            }),
          ),
        )
        .resolves({ total: 2, items: [item2.toJSON()] });

      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: 2,
        content: {
          descriptor,
          contentSet: [item1, item2],
        },
      });
      expect(getPagedContentStub).to.have.been.calledOnce;
      expect(getPagedContentSetStub).to.have.been.calledOnce;
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const options: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet>> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock.getPagedContent.resolves(undefined);
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.be.undefined;
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnceWith(
        sinon.match(toRulesetRpcOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), omitFormattedValues: true })),
      );
    });
  });

  describe("getPagedDistinctValues", () => {
    it("requests distinct values", async () => {
      const keys = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const fieldDescriptor: FieldDescriptor = {
        type: FieldDescriptorType.Name,
        fieldName: "test field",
      };
      const result = {
        total: 1,
        items: [
          {
            displayValue: "test value",
            groupedRawValues: ["value 1", "value 2"],
          },
        ],
      };
      const managerOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys,
        fieldDescriptor,
      };
      const rpcHandlerOptions = {
        ...toRulesetRpcOptions(managerOptions),
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keys.toJSON(),
        paging: { start: 0, size: 0 },
      };
      rpcRequestsHandlerMock.getPagedDistinctValues.resolves(result);
      const actualResult = await manager.getPagedDistinctValues(managerOptions);
      expect(actualResult).to.deep.eq(result);
      expect(rpcRequestsHandlerMock.getPagedDistinctValues).to.have.been.calledOnceWith(sinon.match(rpcHandlerOptions));
    });

    it("requests distinct values through multiple requests when getting partial responses", async () => {
      const keys = new KeySet();
      const descriptor = createTestContentDescriptor({ fields: [] });
      const fieldDescriptor: FieldDescriptor = {
        type: FieldDescriptorType.Name,
        fieldName: "test field",
      };
      const item1 = {
        displayValue: "test value 1",
        groupedRawValues: ["value 11", "value 12"],
      };
      const item2 = {
        displayValue: "test value 2",
        groupedRawValues: ["value 21", "value 22"],
      };
      const managerOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys,
        fieldDescriptor,
        paging: undefined,
      };
      const rpcHandlerOptions = {
        ...toRulesetRpcOptions(managerOptions),
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keys.toJSON(),
      };
      rpcRequestsHandlerMock.getPagedDistinctValues
        .withArgs(sinon.match({ ...rpcHandlerOptions, paging: { start: 0, size: 0 } }))
        .resolves({ total: 2, items: [item1] });
      rpcRequestsHandlerMock.getPagedDistinctValues
        .withArgs(sinon.match({ ...rpcHandlerOptions, paging: { start: 1, size: 1 } }))
        .resolves({ total: 2, items: [item2] });
      const actualResult = await manager.getPagedDistinctValues(managerOptions);
      expect(actualResult).to.deep.eq({ total: 2, items: [item1, item2] });
      expect(rpcRequestsHandlerMock.getPagedDistinctValues).to.have.been.calledTwice;
    });
  });

  describe("getElementProperties", () => {
    it("requests single element properties", async () => {
      const elementId = "0x123";
      rpcRequestsHandlerMock.getPagedContent.resolves(undefined);
      const actualResult = await manager.getElementProperties({
        imodel: testData.imodel,
        elementId,
      });
      expect(actualResult).to.be.undefined;
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnceWith(
        sinon.match(
          toRulesetRpcOptions({
            descriptor: {
              displayType: DefaultContentDisplayTypes.PropertyPane,
              contentFlags: ContentFlags.ShowLabels,
            },
            rulesetOrId: "ElementProperties",
            keys: new KeySet([{ className: "BisCore:Element", id: elementId }]).toJSON(),
            omitFormattedValues: true,
          }),
        ),
      );
    });

    it("parses element properties from content", async () => {
      const elementId = "0x123";
      const expectedElementProperties: ElementProperties = {
        class: "Test Class",
        id: "0x123",
        label: "test label",
        items: {
          ["Test Category"]: {
            type: "category",
            items: {
              ["Test Field"]: {
                type: "primitive",
                value: "test value",
              },
            },
          },
        },
      };
      const testCategory = createTestCategoryDescription({ name: "TestCategory", label: "Test Category" });
      const testField = createTestSimpleContentField({
        name: "TestField",
        category: testCategory,
        label: "Test Field",
        type: {
          valueFormat: PropertyValueFormat.Primitive,
          typeName: "string",
        },
      });
      const descriptor = createTestContentDescriptor({
        categories: [testCategory],
        fields: [testField],
      });
      const contentItem = new Item(
        [{ className: "TestSchema:TestElement", id: elementId }],
        "test label",
        "",
        createTestECClassInfo({ label: "Test Class" }),
        {
          [testField.name]: "test value",
        },
        {},
        [],
        undefined,
      );
      rpcRequestsHandlerMock.getPagedContent
        .withArgs(
          sinon.match(
            toRulesetRpcOptions({
              descriptor: {
                displayType: DefaultContentDisplayTypes.PropertyPane,
                contentFlags: ContentFlags.ShowLabels,
              },
              rulesetOrId: "ElementProperties",
              keys: new KeySet([{ className: "BisCore:Element", id: elementId }]).toJSON(),
              omitFormattedValues: true,
            }),
          ),
        )
        .resolves({
          descriptor: descriptor.toJSON(),
          contentSet: { total: 1, items: [contentItem.toJSON()] },
        });
      const actualResult = await manager.getElementProperties({
        imodel: testData.imodel,
        elementId,
      });
      expect(actualResult).to.deep.eq(expectedElementProperties);
      expect(rpcRequestsHandlerMock.getPagedContent).to.have.been.calledOnce;
    });
  });

  describe("getContentInstanceKeys", () => {
    it("requests content instance keys", async () => {
      const inputKeys = new KeySet();
      const displayType = "test display type";
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" })];
      const rpcHandlerResult = {
        total: 1,
        items: new KeySet(instanceKeys).toJSON(),
      };
      const managerOptions: ContentInstanceKeysRequestOptions<IModelConnection, KeySet, RulesetVariable> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        displayType,
        keys: inputKeys,
      };
      const rpcHandlerOptions = {
        ...toRulesetRpcOptions(managerOptions),
        keys: inputKeys.toJSON(),
        paging: { start: 0, size: 0 },
      };
      rpcRequestsHandlerMock.getContentInstanceKeys.resolves(rpcHandlerResult);
      const actualResult = await manager.getContentInstanceKeys(managerOptions);
      expect(actualResult.total).to.eq(1);
      expect(await generatedValues(actualResult.items())).to.deep.eq(instanceKeys);
      expect(rpcRequestsHandlerMock.getContentInstanceKeys).to.have.been.calledOnceWith(sinon.match(rpcHandlerOptions));
    });

    it("requests instance keys through multiple requests when getting partial responses", async () => {
      const inputKeys = new KeySet();
      const displayType = "test display type";
      const instanceKeys1 = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
      const instanceKeys2 = [createTestECInstanceKey({ id: "0x3" }), createTestECInstanceKey({ id: "0x4" })];
      const managerOptions: ContentInstanceKeysRequestOptions<IModelConnection, KeySet, RulesetVariable> = {
        imodel: testData.imodel,
        rulesetOrId: testData.rulesetId,
        displayType,
        keys: inputKeys,
        paging: undefined,
      };
      const rpcHandlerOptions = {
        ...toRulesetRpcOptions(managerOptions),
        keys: inputKeys.toJSON(),
      };
      rpcRequestsHandlerMock.getContentInstanceKeys
        .withArgs(sinon.match({ ...rpcHandlerOptions, paging: { start: 0, size: 0 } }))
        .resolves({ total: 4, items: new KeySet(instanceKeys1).toJSON() });
      rpcRequestsHandlerMock.getContentInstanceKeys
        .withArgs(sinon.match({ ...rpcHandlerOptions, paging: { start: 2, size: 2 } }))
        .resolves({ total: 4, items: new KeySet(instanceKeys2).toJSON() });
      const actualResult = await manager.getContentInstanceKeys(managerOptions);
      expect(actualResult.total).to.eq(4);
      expect(await generatedValues(actualResult.items())).to.deep.eq([...instanceKeys1, ...instanceKeys2]);
      expect(rpcRequestsHandlerMock.getContentInstanceKeys).to.have.been.calledTwice;
    });
  });

  describe("getDisplayLabelDefinition", () => {
    it("requests display label definition", async () => {
      const result = createTestLabelDefinition();
      const options: DisplayLabelRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodel,
        key: createTestECInstanceKey(),
      };
      rpcRequestsHandlerMock.getDisplayLabelDefinition.resolves(result);
      const actualResult = await manager.getDisplayLabelDefinition(options);
      expect(actualResult).to.deep.eq(result);
      expect(rpcRequestsHandlerMock.getDisplayLabelDefinition).to.have.been.calledOnceWith(sinon.match(toIModelTokenOptions({ ...options })));
    });
  });

  describe("getDisplayLabelDefinitions", () => {
    it("requests display labels definitions", async () => {
      const result = [createTestLabelDefinition(), createTestLabelDefinition()];
      const options: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodel,
        keys: [createTestECInstanceKey(), createTestECInstanceKey()],
      };
      rpcRequestsHandlerMock.getPagedDisplayLabelDefinitions.resolves({ total: 2, items: result });
      const actualResult = await manager.getDisplayLabelDefinitions(options);
      expect(actualResult).to.deep.eq(result);
      expect(rpcRequestsHandlerMock.getPagedDisplayLabelDefinitions).to.have.been.calledOnceWith(sinon.match(toIModelTokenOptions({ ...options })));
    });

    it("requests display labels definitions through multiple requests when getting partial responses", async () => {
      const key1 = createTestECInstanceKey();
      const key2 = createTestECInstanceKey();
      const def1 = createTestLabelDefinition();
      const def2 = createTestLabelDefinition();
      const options: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodel,
        keys: [key1, key2],
      };
      rpcRequestsHandlerMock.getPagedDisplayLabelDefinitions
        .withArgs(sinon.match(toIModelTokenOptions({ ...options, keys: [key1, key2] })))
        .resolves({ total: 2, items: [def1] });
      rpcRequestsHandlerMock.getPagedDisplayLabelDefinitions
        .withArgs(sinon.match(toIModelTokenOptions({ ...options, keys: [key2] })))
        .resolves({ total: 2, items: [def2] });
      const actualResult = await manager.getDisplayLabelDefinitions(options);
      expect(actualResult).to.deep.eq([def1, def2]);
      expect(rpcRequestsHandlerMock.getPagedDisplayLabelDefinitions).to.have.been.calledTwice;
    });
  });

  describe("options handling", () => {
    let testRuleset: Ruleset;
    let testRulesetVariable: RulesetVariable;

    beforeEach(async () => {
      testRuleset = { id: "test-ruleset", rules: [] };
      rulesetsManagerMock.get.withArgs(testRuleset.id).resolves(new RegisteredRuleset(testRuleset, "", () => {}));
      testRulesetVariable = { id: "var id", type: VariableValueTypes.String, value: "test value" };
      await manager.vars(testRuleset.id).setString(testRulesetVariable.id, testRulesetVariable.value);
    });

    it("adds ruleset to the options", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset.id,
        parentKey: undefined,
      };
      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount(options);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(sinon.match(toRulesetRpcOptions(expectedOptions)));
    });

    it("leaves ruleset in the options if already provided", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        rulesetOrId: testRuleset,
        paging: testData.pageOptions,
        parentKey: undefined,
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };

      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount(options);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(sinon.match(toRulesetRpcOptions(expectedOptions)));
    });

    it("adds empty values if ruleset and rulesetId is not provided", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodel,
        paging: testData.pageOptions,
        rulesetOrId: "",
        parentKey: undefined,
      };
      const expectedOptions = { ...options, rulesetVariables: [] };
      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount(options);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(sinon.match(toIModelTokenOptions(expectedOptions)));
    });

    it("appends ruleset variables from ruleset variables manager", async () => {
      const rulesetVariable: RulesetVariable = { id: "var id", type: VariableValueTypes.String, value: "test value" };
      const options: Paged<HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>> = {
        imodel: testData.imodel,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset,
        rulesetVariables: [rulesetVariable],
        parentKey: undefined,
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [rulesetVariable, testRulesetVariable] };

      rpcRequestsHandlerMock.getNodesCount.resolves(0);
      await manager.getNodesCount(options);
      expect(rpcRequestsHandlerMock.getNodesCount).to.have.been.calledOnceWith(sinon.match(toRulesetRpcOptions(expectedOptions)));
    });
  });

  describe("listening to updates", () => {
    let ipcAppAddListenerStub: sinon.SinonStub<[string, IpcListener], RemoveFunction>;
    let hierarchyUpdatesSpy: sinon.SinonSpy<[IModelHierarchyChangeEventArgs], void>;
    let contentUpdatesSpy: sinon.SinonSpy<[IModelContentChangeEventArgs], void>;

    beforeEach(() => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      ipcAppAddListenerStub = sinon.stub(IpcApp, "addListener");

      manager = PresentationManager.create();

      expect(ipcAppAddListenerStub).to.be.calledOnce;

      hierarchyUpdatesSpy = sinon.spy() as any;
      manager.onIModelHierarchyChanged.addListener(hierarchyUpdatesSpy);

      contentUpdatesSpy = sinon.spy() as any;
      manager.onIModelContentChanged.addListener(contentUpdatesSpy);
    });

    it("triggers appropriate hierarchy and content events on update event", async () => {
      const imodelKey = "test-imodel-key";
      const ruleset1: Ruleset = { id: "1", rules: [] };
      const ruleset2: Ruleset = { id: "2", rules: [] };
      const ruleset3: Ruleset = { id: "3", rules: [] };
      rulesetsManagerMock.get.withArgs(ruleset1.id).resolves(new RegisteredRuleset(ruleset1, "", () => {}));
      rulesetsManagerMock.get.withArgs(ruleset2.id).resolves(new RegisteredRuleset(ruleset2, "", () => {}));
      rulesetsManagerMock.get.withArgs(ruleset3.id).resolves(undefined);

      const report: UpdateInfo = {
        [imodelKey]: {
          [ruleset1.id]: {
            hierarchy: "FULL",
            content: "FULL",
          },
          [ruleset2.id]: {
            content: "FULL",
          },
          [ruleset3.id]: {},
        },
      };
      ipcAppAddListenerStub.firstCall.args[1](new Event(PresentationIpcEvents.Update), report);

      // workaround for a floating promise...
      await BeDuration.wait(1);

      expect(hierarchyUpdatesSpy).to.be.calledOnce;
      expect(hierarchyUpdatesSpy.firstCall).to.be.calledWith({
        rulesetId: ruleset1.id,
        updateInfo: "FULL",
        imodelKey,
      });

      expect(contentUpdatesSpy).to.be.calledTwice;
      expect(contentUpdatesSpy.firstCall).to.be.calledWith({
        rulesetId: ruleset1.id,
        updateInfo: "FULL",
        imodelKey,
      });
      expect(contentUpdatesSpy.secondCall).to.be.calledWith({
        rulesetId: ruleset2.id,
        updateInfo: "FULL",
        imodelKey,
      });
    });
  });
});

async function generatedValues<T>(gen: AsyncGenerator<T>) {
  const arr = new Array<T>();
  for await (const v of gen) {
    arr.push(v);
  }
  return arr;
}
