/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-common/lib/cjs/test/_helpers/Promises";
import { expect } from "chai";
import * as faker from "faker";
import * as path from "path";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { ECSqlStatement, ECSqlValue, IModelDb, IModelHost, IModelJsNative, IModelNative, IpcHost } from "@itwin/core-backend";
import { DbResult, Id64String, using } from "@itwin/core-bentley";
import { SchemaContext } from "@itwin/ecschema-metadata";
import {
  ArrayTypeDescription,
  CategoryDescription,
  Content,
  ContentDescriptorRequestOptions,
  ContentFlags,
  ContentJSON,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  DefaultContentDisplayTypes,
  Descriptor,
  DescriptorJSON,
  DescriptorOverrides,
  DiagnosticsLoggerSeverity,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DistinctValuesRequestOptions,
  ElementProperties,
  FieldDescriptor,
  FieldDescriptorType,
  FieldJSON,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  HierarchyCompareInfo,
  HierarchyCompareInfoJSON,
  HierarchyCompareOptions,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyLevelJSON,
  HierarchyRequestOptions,
  InstanceKey,
  IntRulesetVariable,
  ItemJSON,
  KeySet,
  KindOfQuantityInfo,
  LabelDefinition,
  MultiElementPropertiesRequestOptions,
  NestedContentFieldJSON,
  NodeKey,
  Paged,
  PageOptions,
  PresentationError,
  PresentationIpcEvents,
  PrimitiveTypeDescription,
  PropertiesFieldJSON,
  PropertyInfoJSON,
  PropertyJSON,
  PropertyValueFormat,
  RegisteredRuleset,
  RelatedClassInfo,
  Ruleset,
  SelectClassInfo,
  SelectClassInfoJSON,
  SelectionInfo,
  SelectionScope,
  SingleElementPropertiesRequestOptions,
  StandardNodeTypes,
  StructTypeDescription,
  UpdateInfo,
  VariableValueTypes,
} from "@itwin/presentation-common";
import {
  createRandomECClassInfo,
  createRandomECInstanceKey,
  createRandomECInstancesNodeJSON,
  createRandomECInstancesNodeKey,
  createRandomId,
  createRandomLabelDefinition,
  createRandomNodePathElementJSON,
  createRandomRelationshipPath,
  createRandomRuleset,
  createTestCategoryDescription,
  createTestContentDescriptor,
  createTestContentItem,
  createTestECClassInfo,
  createTestPropertiesContentField,
  createTestPropertyInfo,
  createTestRelatedClassInfo,
  createTestRelationshipPath,
  createTestSelectClassInfo,
  createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import {
  NativePlatformDefinition,
  NativePlatformRequestTypes,
  NativePresentationUnitSystem,
  PresentationNativePlatformResponseError,
} from "../presentation-backend/NativePlatform";
import { HierarchyCacheMode, HybridCacheConfig, PresentationManager, PresentationManagerProps } from "../presentation-backend/PresentationManager";
import { getKeysForContentRequest, ipcUpdatesHandler, noopUpdatesHandler } from "../presentation-backend/PresentationManagerDetail";
import { RulesetManagerImpl } from "../presentation-backend/RulesetManager";
import { RulesetVariablesManagerImpl } from "../presentation-backend/RulesetVariablesManager";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper";
import { stubECSqlReader } from "./Helpers";

const deepEqual = require("deep-equal"); // eslint-disable-line @typescript-eslint/no-require-imports

describe("PresentationManager", () => {
  before(async () => {
    try {
      await IModelHost.startup({ cacheDir: path.join(__dirname, ".cache") });
    } catch (e) {
      let isLoaded = false;
      try {
        IModelNative.platform;
        isLoaded = true;
      } catch { }
      if (!isLoaded) {
        throw e; // re-throw if startup() failed to set up NativePlatform
      }
    }
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  const setupIModelForElementKey = (imodelMock: moq.IMock<IModelDb>, key: InstanceKey) => {
    imodelMock
      .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .callback((_q, cb) => {
        const valueMock = moq.Mock.ofType<ECSqlValue>();
        valueMock.setup((x) => x.getClassNameForClassId()).returns(() => key.className);
        const stmtMock = moq.Mock.ofType<ECSqlStatement>();
        stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
        stmtMock.setup((x) => x.getValue(0)).returns(() => valueMock.object);
        cb(stmtMock.object);
      });
  };

  const setupIModelForNoResultStatement = (imodelMock: moq.IMock<IModelDb>) => {
    imodelMock
      .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .callback((_q, cb) => {
        const stmtMock = moq.Mock.ofType<ECSqlStatement>();
        stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
        cb(stmtMock.object);
      });
  };

  describe("constructor", () => {
    describe("uses default native library implementation if not overridden", () => {
      it("creates without props", () => {
        const constructorSpy = sinon.spy(IModelNative.platform, "ECPresentationManager");
        using(new PresentationManager(), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: { mode: HierarchyCacheMode.Disk, directory: "" },
            contentCacheSize: undefined,
            workerConnectionCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
      });

      it("creates with props", () => {
        const constructorSpy = sinon.spy(IModelNative.platform, "ECPresentationManager");
        const testThreadsCount = 999;
        const hierarchyCacheConfig = {
          mode: HierarchyCacheMode.Memory,
        };
        const formatProps = {
          composite: {
            includeZero: true,
            spacer: " ",
            units: [{ label: "'", name: "IN" }],
          },
          formatTraits: "KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
          precision: 4,
          type: "Decimal",
          uomSeparator: "",
        };
        const props: PresentationManagerProps = {
          id: faker.random.uuid(),
          presentationAssetsRoot: "/test",
          workerThreadsCount: testThreadsCount,
          caching: {
            hierarchies: hierarchyCacheConfig,
            content: {
              size: 999,
            },
            workerConnectionCacheSize: 123,
          },
          useMmap: 666,
          defaultFormats: {
            length: { unitSystems: ["imperial"], format: formatProps },
            area: [{ unitSystems: ["usCustomary"], format: formatProps }],
          },
        };
        const expectedCacheConfig = {
          mode: HierarchyCacheMode.Memory,
        };
        using(new PresentationManager(props), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: props.id,
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 999 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: expectedCacheConfig,
            contentCacheSize: 999,
            workerConnectionCacheSize: 123,
            defaultFormats: {
              length: [{ unitSystems: [NativePresentationUnitSystem.BritishImperial], serializedFormat: JSON.stringify(formatProps) }],
              area: [{ unitSystems: [NativePresentationUnitSystem.UsCustomary], serializedFormat: JSON.stringify(formatProps) }],
            },
            useMmap: 666,
          });
        });
      });

      it("creates with disk cache config", () => {
        const constructorSpy = sinon.spy(IModelNative.platform, "ECPresentationManager");
        using(new PresentationManager({ caching: { hierarchies: { mode: HierarchyCacheMode.Disk } } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: { mode: HierarchyCacheMode.Disk, directory: "" },
            contentCacheSize: undefined,
            workerConnectionCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
        constructorSpy.resetHistory();
        const cacheConfig = {
          mode: HierarchyCacheMode.Disk,
          directory: faker.random.word(),
          memoryCacheSize: 123,
        };
        const expectedConfig = { ...cacheConfig, directory: path.resolve(cacheConfig.directory) };
        using(new PresentationManager({ caching: { hierarchies: cacheConfig } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: expectedConfig,
            contentCacheSize: undefined,
            workerConnectionCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
      });

      it("creates with hybrid cache config", () => {
        const constructorSpy = sinon.spy(IModelNative.platform, "ECPresentationManager");
        using(new PresentationManager({ caching: { hierarchies: { mode: HierarchyCacheMode.Hybrid } } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: { mode: HierarchyCacheMode.Hybrid, disk: undefined },
            contentCacheSize: undefined,
            workerConnectionCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
        constructorSpy.resetHistory();
        const cacheConfig: HybridCacheConfig = {
          mode: HierarchyCacheMode.Hybrid,
          disk: {
            mode: HierarchyCacheMode.Disk,
            directory: faker.random.word(),
            memoryCacheSize: 456,
          },
        };
        const expectedConfig = {
          ...cacheConfig,
          disk: { ...cacheConfig.disk, directory: path.resolve(cacheConfig.disk!.directory!) },
        };
        using(new PresentationManager({ caching: { hierarchies: cacheConfig } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelNative.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            updateCallback: noopUpdatesHandler,
            cacheConfig: expectedConfig,
            contentCacheSize: undefined,
            workerConnectionCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
      });

      it("creates with ipc updates handler for IPC hosts", () => {
        sinon.stub(IpcHost, "isValid").get(() => true);
        const constructorSpy = sinon.spy(IModelNative.platform, "ECPresentationManager");
        using(new PresentationManager(), (_) => {
          expect(constructorSpy.firstCall.firstArg.updateCallback).to.eq(ipcUpdatesHandler);
        });
      });
    });

    it("uses addon implementation supplied through props", () => {
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      using(new PresentationManager({ addon: nativePlatformMock.object }), (manager) => {
        expect(manager.getNativePlatform()).eq(nativePlatformMock.object);
      });
    });

    describe("addon setup based on props", () => {
      const addon = moq.Mock.ofType<NativePlatformDefinition>();
      beforeEach(() => {
        addon.reset();
      });

      it("sets up primary ruleset directories if supplied", () => {
        const dirs = ["test1", "test2", "test2"];
        const addonDirs = ["test1", "test2"];
        addon.setup((x) => x.setupRulesetDirectories(addonDirs)).verifiable();
        using(new PresentationManager({ addon: addon.object, rulesetDirectories: dirs }), (pm: PresentationManager) => {
          pm;
        });
        addon.verifyAll();
      });

      it("sets up supplemental ruleset directories if supplied", () => {
        const dirs = ["test1", "test2", "test2"];
        const addonDirs = ["test1", "test2"];
        addon.setup((x) => x.setupSupplementalRulesetDirectories(addonDirs)).verifiable();
        using(new PresentationManager({ addon: addon.object, supplementalRulesetDirectories: dirs }), (_pm: PresentationManager) => {});
        addon.verifyAll();
      });

      it("sets up active locale if supplied [deprecated]", () => {
        const locale = faker.random.locale();
        using(new PresentationManager({ addon: addon.object, defaultLocale: locale }), (manager) => {
          expect(manager.activeLocale).to.eq(locale); // eslint-disable-line @typescript-eslint/no-deprecated
        });
      });
    });
  });

  describe("props", () => {
    it("returns empty object if initialized without props", () => {
      using(new PresentationManager(undefined), (newManager) => {
        expect(newManager.props).to.deep.eq({});
      });
    });

    it("returns initialization props", () => {
      const props = {};
      using(new PresentationManager(props), (newManager) => {
        expect(newManager.props).to.equal(props);
      });
    });
  });

  describe("defaultUnitSystem", () => {
    const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
    beforeEach(() => {
      addonMock.reset();
    });

    it("uses unit system specified in request options", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const rulesetId = faker.random.word();
      const unitSystem = "metric";
      await using(new PresentationManager({ addon: addonMock.object }), async (manager) => {
        addonMock
          .setup(async (x) =>
            x.handleRequest(
              moq.It.isAny(),
              moq.It.is((serializedRequest: string): boolean => {
                const request = JSON.parse(serializedRequest);
                return request.params.unitSystem === NativePresentationUnitSystem.Metric;
              }),
              undefined,
            ),
          )
          .returns(async () => ({ result: "null" }))
          .verifiable(moq.Times.once());
        await manager.getContentDescriptor({ imodel: imodelMock.object, rulesetOrId: rulesetId, displayType: "", keys: new KeySet(), unitSystem });
        addonMock.verifyAll();
      });
    });

    it("uses manager's defaultUnitSystem when not specified in request options", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const rulesetId = faker.random.word();
      const unitSystem = "usSurvey";
      await using(new PresentationManager({ addon: addonMock.object, defaultUnitSystem: unitSystem }), async (manager) => {
        addonMock
          .setup(async (x) =>
            x.handleRequest(
              moq.It.isAny(),
              moq.It.is((serializedRequest: string): boolean => {
                const request = JSON.parse(serializedRequest);
                return request.params.unitSystem === NativePresentationUnitSystem.UsSurvey;
              }),
              undefined,
            ),
          )
          .returns(async () => ({ result: "null" }))
          .verifiable(moq.Times.once());
        await manager.getContentDescriptor({ imodel: imodelMock.object, rulesetOrId: rulesetId, displayType: "", keys: new KeySet() });
        addonMock.verifyAll();
      });
    });

    it("ignores manager's defaultUnitSystem when unit system is specified in request options", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const rulesetId = faker.random.word();
      const unitSystem = "usCustomary";
      await using(new PresentationManager({ addon: addonMock.object, defaultUnitSystem: "metric" }), async (manager) => {
        expect(manager.activeUnitSystem).to.not.eq(unitSystem);
        addonMock
          .setup(async (x) =>
            x.handleRequest(
              moq.It.isAny(),
              moq.It.is((serializedRequest: string): boolean => {
                const request = JSON.parse(serializedRequest);
                return request.params.unitSystem === NativePresentationUnitSystem.UsCustomary;
              }),
              undefined,
            ),
          )
          .returns(async () => ({ result: "null" }))
          .verifiable(moq.Times.once());
        await manager.getContentDescriptor({ imodel: imodelMock.object, rulesetOrId: rulesetId, unitSystem, displayType: "", keys: new KeySet() });
        addonMock.verifyAll();
      });
    });
  });

  describe("setOnManagerUsedHandler", () => {
    it("invokes when making presentation requests", async () => {
      const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const manager = new PresentationManager({ addon: addonMock.object });
      const managerUsedSpy = sinon.spy();

      addonMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString(), undefined)).returns(async () => ({ result: `{"nodes":[]}` }));

      addonMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString(), undefined)).returns(async () => ({ result: "{}" }));

      manager.setOnManagerUsedHandler(managerUsedSpy);
      await manager.getNodes({ imodel: imodelMock.object, rulesetOrId: "RulesetId" });
      expect(managerUsedSpy).to.be.calledOnce;
      await manager.getContent({ imodel: imodelMock.object, rulesetOrId: "RulesetId", keys: new KeySet([]), descriptor: {} });
      expect(managerUsedSpy).to.be.calledTwice;
    });
  });

  describe("vars", () => {
    const addon = moq.Mock.ofType<NativePlatformDefinition>();

    it("returns variables manager", () => {
      const manager = new PresentationManager({ addon: addon.object });
      const vars = manager.vars(faker.random.word());
      expect(vars).to.be.instanceOf(RulesetVariablesManagerImpl);
    });
  });

  describe("rulesets", () => {
    const addon = moq.Mock.ofType<NativePlatformDefinition>();

    it("returns rulesets manager", () => {
      const manager = new PresentationManager({ addon: addon.object });
      expect(manager.rulesets()).to.be.instanceOf(RulesetManagerImpl);
    });
  });

  describe("dispose", () => {
    it("calls native platform dispose when manager is disposed", () => {
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      const manager = new PresentationManager({ addon: nativePlatformMock.object });
      manager.dispose();
      manager.dispose();
      // note: verify native platform's `dispose` called only once
      nativePlatformMock.verify((x) => x.dispose(), moq.Times.once());
    });

    it("throws when attempting to use native platform after disposal", () => {
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      const manager = new PresentationManager({ addon: nativePlatformMock.object });
      manager.dispose();
      expect(() => manager.getNativePlatform()).to.throw(PresentationError);
    });
  });

  describe("getRulesetId", () => {
    let manager: PresentationManager;

    beforeEach(() => {
      const addon = moq.Mock.ofType<NativePlatformDefinition>();
      manager = new PresentationManager({ addon: addon.object });
    });

    afterEach(() => {
      manager.dispose();
    });

    it("returns correct id when input is a string", () => {
      const rulesetId = faker.random.word();
      expect(manager.getRulesetId(rulesetId)).to.eq(rulesetId);
    });

    it("returns correct id when input is a ruleset", async () => {
      const ruleset = await createRandomRuleset();
      expect(manager.getRulesetId(ruleset)).to.contain(ruleset.id);
    });

    it("returns correct id when input is a ruleset and in one-backend-one-frontend mode", async () => {
      sinon.stub(IpcHost, "isValid").get(() => true);
      sinon.stub(IpcHost, "handle");
      manager = new PresentationManager({ addon: moq.Mock.ofType<NativePlatformDefinition>().object });
      const ruleset = await createRandomRuleset();
      expect(manager.getRulesetId(ruleset)).to.eq(ruleset.id);
    });
  });

  describe("handling options", () => {
    const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
    const imodelMock = moq.Mock.ofType<IModelDb>();
    let manager: PresentationManager;

    beforeEach(() => {
      manager = new PresentationManager({ addon: addonMock.object });
      addonMock.reset();
    });

    it("registers ruleset if `rulesetOrId` is a ruleset", async () => {
      const ruleset = await createRandomRuleset();
      addonMock
        .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny(), undefined))
        .returns(async () => ({ result: "{}" }))
        .verifiable(moq.Times.once());
      addonMock
        .setup((x) => x.addRuleset(moq.It.isAnyString()))
        .returns(() => ({ result: "hash" }))
        .verifiable(moq.Times.once());
      await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: ruleset });
      addonMock.verifyAll();
    });

    it("doesn't register ruleset if `rulesetOrId` is a string", async () => {
      const rulesetId = faker.random.word();
      addonMock
        .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny(), undefined))
        .returns(async () => ({ result: "{}" }))
        .verifiable(moq.Times.once());
      addonMock
        .setup((x) => x.addRuleset(moq.It.isAnyString()))
        .returns(() => ({ result: "hash" }))
        .verifiable(moq.Times.never());
      await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId });
      addonMock.verifyAll();
    });

    it("invokes request's diagnostics handler with diagnostic results", async () => {
      const diagnosticsResult = {
        logs: [
          {
            scope: "test",
            duration: 123,
          },
        ],
      };
      const diagnosticsContext = {};
      const diagnosticsListener = sinon.spy();
      addonMock
        .setup(async (x) =>
          x.handleRequest(
            moq.It.isAny(),
            moq.It.is((reqStr) => sinon.match(JSON.parse(reqStr).params.diagnostics).test({ perf: true })),
            undefined,
          ),
        )
        .returns(async () => ({ result: "{}", diagnostics: diagnosticsResult.logs[0] }))
        .verifiable(moq.Times.once());
      await manager.getNodesCount({
        imodel: imodelMock.object,
        rulesetOrId: "ruleset",
        diagnostics: {
          perf: true,
          handler: diagnosticsListener,
          requestContextSupplier: () => diagnosticsContext,
        },
      });
      addonMock.verifyAll();
      expect(diagnosticsListener).to.be.calledOnceWithExactly(diagnosticsResult, diagnosticsContext);
    });

    it("invokes manager's diagnostics callback with diagnostic results when request succeeds", async () => {
      addonMock.reset();

      const diagnosticsCallback = sinon.spy();
      const diagnosticsContext = {};
      manager = new PresentationManager({
        addon: addonMock.object,
        diagnostics: {
          perf: true,
          handler: diagnosticsCallback,
          requestContextSupplier: () => diagnosticsContext,
        },
      });
      const diagnosticsResult = {
        logs: [
          {
            scope: "test",
            scopeCreateTimestamp: 1000,
            duration: 123,
          },
        ],
      };
      addonMock
        .setup(async (x) =>
          x.handleRequest(
            moq.It.isAny(),
            moq.It.is((reqStr) => sinon.match(JSON.parse(reqStr).params.diagnostics).test({ perf: true })),
            undefined,
          ),
        )
        .returns(async () => ({ result: "{}", diagnostics: diagnosticsResult.logs[0] }))
        .verifiable(moq.Times.once());
      await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: "ruleset" });
      addonMock.verifyAll();
      expect(diagnosticsCallback).to.be.calledOnceWithExactly(diagnosticsResult, diagnosticsContext);
    });

    it("invokes manager's diagnostics callback with diagnostic results when request fails", async () => {
      addonMock.reset();

      const diagnosticsCallback = sinon.spy();
      const diagnosticsContext = {};
      manager = new PresentationManager({
        addon: addonMock.object,
        diagnostics: {
          perf: true,
          handler: diagnosticsCallback,
          requestContextSupplier: () => diagnosticsContext,
        },
      });
      const diagnosticsResult = {
        logs: [
          {
            scope: "test",
            scopeCreateTimestamp: 1000,
            duration: 123,
          },
        ],
      };
      addonMock
        .setup(async (x) =>
          x.handleRequest(
            moq.It.isAny(),
            moq.It.is((reqStr) => sinon.match(JSON.parse(reqStr).params.diagnostics).test({ perf: true })),
            undefined,
          ),
        )
        .returns(async () => {
          throw new PresentationNativePlatformResponseError({
            error: { status: IModelJsNative.ECPresentationStatus.Error, message: "" },
            diagnostics: diagnosticsResult.logs[0],
          });
        })
        .verifiable(moq.Times.once());
      await expect(manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: "ruleset" })).to.eventually.be.rejectedWith(
        PresentationNativePlatformResponseError,
      );
      addonMock.verifyAll();
      expect(diagnosticsCallback).to.be.calledOnceWithExactly(diagnosticsResult, diagnosticsContext);
    });

    it("invokes manager and request diagnostics callbacks", async () => {
      addonMock.reset();

      const requestDiagnosticsCallback = sinon.spy();
      const requestDiagnosticsContext = {};

      const managerDiagnosticsCallback = sinon.spy();
      const managerDiagnosticsContext = {};
      manager = new PresentationManager({
        addon: addonMock.object,
        diagnostics: {
          perf: true,
          handler: managerDiagnosticsCallback,
          requestContextSupplier: () => managerDiagnosticsContext,
        },
      });
      const diagnosticsResult = {
        scope: "req",
        logs: [
          {
            scope: "perf scope",
            scopeCreateTimestamp: 1000,
            duration: 123,
          },
          {
            scope: "log scope",
            logs: [
              {
                message: "msg",
                category: "cat",
                severity: { dev: "debug" as DiagnosticsLoggerSeverity },
                timestamp: 123,
              },
            ],
          },
        ],
      };
      addonMock
        .setup(async (x) =>
          x.handleRequest(
            moq.It.isAny(),
            moq.It.is((reqStr) => sinon.match(JSON.parse(reqStr).params.diagnostics).test({ perf: true, dev: "debug" })),
            undefined,
          ),
        )
        .returns(async () => ({ result: "{}", diagnostics: diagnosticsResult }))
        .verifiable(moq.Times.once());
      await manager.getNodesCount({
        imodel: imodelMock.object,
        rulesetOrId: "ruleset",
        diagnostics: {
          dev: "debug",
          handler: requestDiagnosticsCallback,
          requestContextSupplier: () => requestDiagnosticsContext,
        },
      });
      addonMock.verifyAll();
      expect(managerDiagnosticsCallback).to.be.calledOnceWithExactly(
        { logs: [{ scope: "req", logs: [diagnosticsResult.logs[0]] }] },
        managerDiagnosticsContext,
      );
      expect(requestDiagnosticsCallback).to.be.calledOnceWithExactly(
        { logs: [{ scope: "req", logs: [diagnosticsResult.logs[1]] }] },
        requestDiagnosticsContext,
      );
    });
  });

  describe("addon results conversion to Presentation objects", () => {
    let testData: any;
    const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
    const imodelMock = moq.Mock.ofType<IModelDb>();
    let manager: PresentationManager;
    beforeEach(async () => {
      testData = {
        rulesetOrId: await createRandomRuleset(),
        pageOptions: { start: faker.random.number(), size: faker.random.number() } as PageOptions,
        displayType: faker.random.word(),
        selectionInfo: {
          providerName: faker.random.word(),
          level: faker.random.number(),
        } as SelectionInfo,
      };
      imodelMock.reset();
      nativePlatformMock.reset();
      nativePlatformMock.setup((x) => x.getImodelAddon(imodelMock.object)).verifiable(moq.Times.atLeastOnce());
      recreateManager();
    });
    afterEach(() => {
      manager.dispose();
      nativePlatformMock.verifyAll();
    });

    const setup = (addonResponse: any) => {
      if (addonResponse === undefined) {
        nativePlatformMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString(), undefined)).returns(async () => ({ result: "null" }));
        return undefined;
      }
      const serialized = JSON.stringify(addonResponse);
      nativePlatformMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString(), undefined)).returns(async () => ({ result: serialized }));
      return JSON.parse(serialized);
    };
    const verifyMockRequest = (expectedParams: any) => {
      // verify the addon was called with correct params
      nativePlatformMock.verify(
        async (x) =>
          x.handleRequest(
            moq.It.isAny(),
            moq.It.is((serializedParam: string): boolean => {
              const param = JSON.parse(serializedParam);
              expectedParams = JSON.parse(JSON.stringify(expectedParams));
              return deepEqual(param, expectedParams);
            }),
            undefined,
          ),
        moq.Times.once(),
      );
    };
    const verifyWithSnapshot = (result: any, expectedParams: any, recreateSnapshot: boolean = false) => {
      // verify the addon was called with correct params
      verifyMockRequest(expectedParams);
      // verify the manager correctly used addonResponse to create its result
      expect(result).to.matchSnapshot(recreateSnapshot);
    };
    const verifyWithExpectedResult = (actualResult: any, expectedResult: any, expectedParams: any) => {
      // verify the addon was called with correct params
      verifyMockRequest(expectedParams);
      // verify the manager correctly used addonResponse to create its result
      expect(actualResult).to.deep.eq(expectedResult);
    };

    function recreateManager(props?: Partial<PresentationManagerProps>) {
      manager && manager.dispose();
      manager = new PresentationManager({
        addon: nativePlatformMock.object,
        ...props,
      });
      sinon.stub(manager.getDetail(), "rulesets").value(
        sinon.createStubInstance(RulesetManagerImpl, {
          add: sinon.stub<[Ruleset], RegisteredRuleset>().callsFake((ruleset) => new RegisteredRuleset(ruleset, "", () => {})),
        }),
      );
    }

    describe("getNodes", () => {
      it("returns root nodes", async () => {
        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetRootNodes,
          params: {
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyLevelJSON = {
          nodes: [
            {
              key: {
                type: "type1",
                pathFromRoot: ["p1", "p2", "p3"],
              },
              labelDefinition: LabelDefinition.fromLabelString("test1"),
              description: "description1",
              imageId: "img_1",
              foreColor: "foreColor1",
              backColor: "backColor1",
              fontStyle: "fontStyle1",
              hasChildren: true,
              isSelectionDisabled: true,
              isEditable: true,
              isChecked: true,
              isCheckboxVisible: true,
              isCheckboxEnabled: true,
              isExpanded: true,
            },
            {
              key: {
                type: StandardNodeTypes.ECInstancesNode,
                pathFromRoot: ["p1"],
                instanceKeys: [createRandomECInstanceKey()],
              },
              labelDefinition: LabelDefinition.fromLabelString("test2"),
              description: "description2",
              imageId: "",
              foreColor: "",
              backColor: "",
              fontStyle: "",
              hasChildren: false,
              isSelectionDisabled: false,
              isEditable: false,
              isChecked: false,
              isCheckboxVisible: false,
              isCheckboxEnabled: false,
              isExpanded: false,
            },
            {
              key: {
                type: "some node",
                pathFromRoot: ["p1", "p3"],
              },
              labelDefinition: LabelDefinition.fromLabelString("test2"),
            },
          ],
          supportsFiltering: true,
        };
        setup(addonResponse);

        // test
        const options: Paged<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
        };
        const result = await manager.getNodes(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns child nodes", async () => {
        // what the addon receives
        const parentNodeKeyJSON = createRandomECInstancesNodeKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetChildren,
          params: {
            nodeKey: parentNodeKeyJSON,
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyLevelJSON = {
          nodes: [
            {
              key: {
                type: StandardNodeTypes.ECInstancesNode,
                pathFromRoot: ["p1"],
                instanceKeys: [createRandomECInstanceKey()],
              },
              labelDefinition: LabelDefinition.fromLabelString("test2"),
            },
            {
              key: {
                type: "type 2",
                pathFromRoot: ["p1", "p3"],
              },
              labelDefinition: LabelDefinition.fromLabelString("test3"),
            },
          ],
          supportsFiltering: true,
        };
        setup(addonResponse);

        // test
        const options: Paged<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parentKey: NodeKey.fromJSON(parentNodeKeyJSON),
        };
        const result = await manager.getNodes(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns localized nodes", async () => {
        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetRootNodes,
          params: {
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyLevelJSON = {
          nodes: [
            {
              key: {
                type: "type1",
                pathFromRoot: ["p1", "p2", "p3"],
              },
              labelDefinition: LabelDefinition.fromLabelString("@Presentation:label.notSpecified@"),
              description: "description1",
              imageId: "img_1",
              foreColor: "foreColor1",
              backColor: "backColor1",
              fontStyle: "fontStyle1",
              hasChildren: true,
              isSelectionDisabled: true,
              isEditable: true,
              isChecked: true,
              isCheckboxVisible: true,
              isCheckboxEnabled: true,
              isExpanded: true,
            },
          ],
          supportsFiltering: true,
        };
        setup(addonResponse);

        // test
        const options: Paged<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
        };
        const result = await manager.getNodes(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getNodesCount", () => {
      it("returns root nodes count", async () => {
        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetRootNodesCount,
          params: {
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = 456;
        setup(addonResponse);

        // test
        const options: HierarchyRequestOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
        };
        const result = await manager.getNodesCount(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });

      it("returns child nodes count", async () => {
        // what the addon receives
        const parentNodeKeyJSON = createRandomECInstancesNodeKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetChildrenCount,
          params: {
            nodeKey: parentNodeKeyJSON,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = 789;
        setup(addonResponse);

        // test
        const options: HierarchyRequestOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          parentKey: NodeKey.fromJSON(parentNodeKeyJSON),
        };
        const result = await manager.getNodesCount(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });
    });

    describe("getNodesDescriptor", () => {
      it("returns hierarchy level descriptor", async () => {
        // what the addon receives
        const parentNodeKey = createRandomECInstancesNodeKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetNodesDescriptor,
          params: {
            nodeKey: parentNodeKey,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = createTestContentDescriptor({ fields: [] });
        setup(addonResponse);

        // test
        const options: HierarchyLevelDescriptorRequestOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
        };
        const result = await manager.getNodesDescriptor(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("handles undefined descriptor", async () => {
        // what the addon receives
        const parentNodeKey = createRandomECInstancesNodeKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetNodesDescriptor,
          params: {
            nodeKey: parentNodeKey,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        setup(undefined);

        // test
        const options: HierarchyLevelDescriptorRequestOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          parentKey: parentNodeKey,
        };
        const result = await manager.getNodesDescriptor(options);
        verifyWithExpectedResult(result, undefined, expectedParams);
      });
    });

    describe("getFilteredNodePaths", () => {
      it("returns filtered node paths", async () => {
        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetFilteredNodePaths,
          params: {
            filterText: "filter",
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what addon returns
        const addonResponse = [createRandomNodePathElementJSON(0)];
        setup(addonResponse);

        // test
        const options: FilterByTextHierarchyRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          filterText: "filter",
        };
        const result = await manager.getFilteredNodePaths(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getNodePaths", () => {
      it("returns node paths", async () => {
        // what the addon receives
        const keyJsonArray = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        const keyArray = [[...keyJsonArray[0]]];
        const markedIndex = faker.random.number();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetNodePaths,
          params: {
            paths: keyJsonArray,
            markedIndex,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what addon returns
        const addonResponse = [createRandomNodePathElementJSON(0)];
        setup(addonResponse);

        // test
        const options: FilterByInstancePathsHierarchyRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          instancePaths: keyArray,
          markedIndex,
        };
        const result = await manager.getNodePaths(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("compareHierarchies", () => {
      it("requests addon to compare hierarchies based on ruleset and variables' changes", async () => {
        const var1: IntRulesetVariable = { id: "var", type: VariableValueTypes.Int, value: 123 };
        const var2: IntRulesetVariable = { id: "var", type: VariableValueTypes.Int, value: 465 };
        const nodeKey = createRandomECInstancesNodeKey();

        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.CompareHierarchies,
          params: {
            prevRulesetId: "test",
            prevRulesetVariables: JSON.stringify([var1]),
            currRulesetId: "test",
            currRulesetVariables: JSON.stringify([var2]),
            expandedNodeKeys: JSON.stringify([nodeKey]),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const unprocessedResponse: HierarchyCompareInfoJSON = {
          changes: [
            {
              type: "Insert",
              position: 1,
              node: createRandomECInstancesNodeJSON(),
            },
          ],
        };
        const addonResponse = setup(unprocessedResponse);

        // test
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: "test",
            rulesetVariables: [var1],
          },
          rulesetOrId: "test",
          rulesetVariables: [var2],
          expandedNodeKeys: [nodeKey],
        };
        const result = await manager.compareHierarchies(options);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
      });

      it("requests addon to compare hierarchies based on ruleset changes", async () => {
        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.CompareHierarchies,
          params: {
            prevRulesetId: "test",
            prevRulesetVariables: JSON.stringify([]),
            currRulesetId: "test",
            currRulesetVariables: JSON.stringify([]),
            expandedNodeKeys: JSON.stringify([]),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [
            {
              type: "Delete",
              parent: createRandomECInstancesNodeJSON().key,
              position: 123,
            },
          ],
        };
        setup(addonResponse);

        // test
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: "test",
          },
          rulesetOrId: "test",
        };
        const result = await manager.compareHierarchies(options);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
      });

      it("requests addon to compare hierarchies based on ruleset variables' changes", async () => {
        const var1: IntRulesetVariable = { id: "var", type: VariableValueTypes.Int, value: 123 };
        const var2: IntRulesetVariable = { id: "var", type: VariableValueTypes.Int, value: 465 };

        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.CompareHierarchies,
          params: {
            prevRulesetId: "test",
            prevRulesetVariables: JSON.stringify([var1]),
            currRulesetId: "test",
            currRulesetVariables: JSON.stringify([var2]),
            expandedNodeKeys: JSON.stringify([]),
          },
        };

        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [
            {
              type: "Update",
              target: createRandomECInstancesNodeJSON().key,
              changes: {},
            },
          ],
        };
        setup(addonResponse);

        // test
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetVariables: [var1],
          },
          rulesetOrId: "test",
          rulesetVariables: [var2],
        };
        const result = await manager.compareHierarchies(options);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
      });

      it("returns empty result if neither ruleset nor ruleset variables changed", async () => {
        nativePlatformMock.reset();
        const result = await manager.compareHierarchies({
          imodel: imodelMock.object,
          prev: {},
          rulesetOrId: "test",
        });
        nativePlatformMock.verify(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        expect(result).to.deep.eq({ changes: [] });
      });

      it("throws when trying to compare hierarchies with different ruleset ids", async () => {
        nativePlatformMock.reset();
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: "1",
          },
          rulesetOrId: "2",
          expandedNodeKeys: [],
        };
        await expect(manager.compareHierarchies(options)).to.eventually.be.rejected;
        nativePlatformMock.verify(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      });
    });

    describe("getContentSources", () => {
      it("returns content sources", async () => {
        // what the addon receives
        const classes = ["test.class1", "test.class2"];
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSources,
          params: {
            rulesetId: "ElementProperties",
            classes,
          },
        };

        // what the addon returns
        const addonResponse = {
          sources: [
            {
              selectClassInfo: "0x123",
              isSelectPolymorphic: true,
              pathToPrimaryClass: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
              pathFromInputToSelectClass: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
              relatedPropertyPaths: [[{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }]],
              navigationPropertyClasses: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
              relatedInstanceClasses: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
              relatedInstancePaths: [[{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }]],
            } as SelectClassInfoJSON<Id64String>,
          ],
          classesMap: {
            "0x123": { name: "class1", label: "Class One" },
            "0x456": { name: "class2", label: "Class Two" },
            "0x789": { name: "class3", label: "Class Three" },
          },
        };
        setup(addonResponse);

        // test
        const options: ContentSourcesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          classes,
        };
        const result = await manager.getContentSources(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getContentDescriptor", () => {
      it("returns content descriptor", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentDescriptor,
          params: {
            displayType: testData.displayType,
            keys: getKeysForContentRequest(keys),
            selection: testData.selectionInfo,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            contentFlags: ContentFlags.DescriptorOnly,
          },
        };

        // what the addon returns
        const testClassInfo = createTestECClassInfo();
        const classesMap = {
          [testClassInfo.id]: {
            label: testClassInfo.label,
            name: testClassInfo.name,
          },
        };
        const addonResponse: DescriptorJSON = {
          connectionId: faker.random.uuid(),
          inputKeysHash: faker.random.uuid(),
          contentOptions: faker.random.objectElement(),
          displayType: testData.displayType,
          classesMap,
          selectClasses: [
            SelectClassInfo.toCompressedJSON(
              createTestSelectClassInfo({
                pathFromInputToSelectClass: createTestRelationshipPath(1),
                relatedPropertyPaths: [createTestRelationshipPath(1)],
                navigationPropertyClasses: [createTestRelatedClassInfo()],
                relatedInstancePaths: [createTestRelationshipPath(1)],
              }),
              classesMap,
            ),
          ],
          categories: [CategoryDescription.toJSON(createTestCategoryDescription({ name: "test-category" }))],
          fields: [
            {
              name: "Primitive property field with editor",
              category: "test-category",
              label: faker.random.words(),
              type: {
                typeName: "string",
                valueFormat: "Primitive",
              } as PrimitiveTypeDescription,
              isReadonly: faker.random.boolean(),
              priority: faker.random.number(),
              editor: {
                name: faker.random.word(),
                params: {
                  ["some_param"]: faker.random.number(),
                },
              },
              properties: [
                {
                  property: {
                    classInfo: testClassInfo.id,
                    name: faker.random.word(),
                    type: "string",
                    enumerationInfo: {
                      choices: [
                        {
                          label: faker.random.words(),
                          value: faker.random.uuid(),
                        },
                        {
                          label: faker.random.words(),
                          value: faker.random.uuid(),
                        },
                      ],
                      isStrict: faker.random.boolean(),
                    },
                  } as PropertyInfoJSON<Id64String>,
                  relatedClassPath: [],
                } as PropertyJSON<Id64String>,
              ],
            } as PropertiesFieldJSON<Id64String>,
            {
              name: "Complex array of structs property field",
              category: "test-category",
              label: faker.random.words(),
              type: {
                typeName: "string[]",
                valueFormat: "Array",
                memberType: {
                  typeName: "SomeClass",
                  valueFormat: "Struct",
                  members: [
                    {
                      name: faker.random.word(),
                      label: faker.random.words(),
                      type: {
                        typeName: "string",
                        valueFormat: "Primitive",
                      },
                    },
                    {
                      name: faker.random.word(),
                      label: faker.random.words(),
                      type: {
                        typeName: "string[]",
                        valueFormat: "Array",
                        memberType: {
                          typeName: "string",
                          valueFormat: "Primitive",
                        },
                      } as ArrayTypeDescription,
                    },
                  ],
                } as StructTypeDescription,
              } as ArrayTypeDescription,
              isReadonly: faker.random.boolean(),
              priority: faker.random.number(),
              properties: [
                {
                  property: {
                    classInfo: testClassInfo.id,
                    name: faker.random.word(),
                    type: "double",
                    kindOfQuantity: {
                      name: faker.random.word(),
                      label: faker.random.words(),
                      persistenceUnit: faker.random.word(),
                    } as KindOfQuantityInfo,
                  } as PropertyInfoJSON<Id64String>,
                  relatedClassPath: [],
                } as PropertyJSON<Id64String>,
              ],
            } as PropertiesFieldJSON<Id64String>,
            {
              name: "Nested content field",
              category: "test-category",
              label: faker.random.words(),
              type: {
                typeName: faker.random.word(),
                valueFormat: "Struct",
                members: [
                  {
                    name: faker.random.word(),
                    label: faker.random.words(),
                    type: {
                      typeName: "string",
                      valueFormat: "Primitive",
                    },
                  },
                ],
              } as StructTypeDescription,
              contentClassInfo: testClassInfo.id,
              pathToPrimaryClass: createRandomRelationshipPath(1).map((step) => RelatedClassInfo.toCompressedJSON(step, classesMap)),
              nestedFields: [
                {
                  name: "Simple property field",
                  category: "test-category",
                  label: faker.random.words(),
                  type: {
                    typeName: "string",
                    valueFormat: "Primitive",
                  },
                  isReadonly: faker.random.boolean(),
                  priority: faker.random.number(),
                } as FieldJSON,
              ],
              isReadonly: faker.random.boolean(),
              priority: faker.random.number(),
              autoExpand: faker.random.boolean(),
            } as NestedContentFieldJSON<Id64String>,
          ],
          contentFlags: 0,
        };
        setup(addonResponse);

        // test
        const options: ContentDescriptorRequestOptions<IModelDb, KeySet> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          displayType: testData.displayType,
          keys,
          selection: testData.selectionInfo,
        };
        const result = await manager.getContentDescriptor(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getContentSetSize", () => {
      it("returns content set size", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const descriptor = createTestContentDescriptor({ fields: [] });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSetSize,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = faker.random.number();
        setup(addonResponse);

        // test
        const options: ContentRequestOptions<IModelDb, Descriptor, KeySet> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          keys,
          descriptor,
        };
        const result = await manager.getContentSetSize(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });

      it("returns content set size when descriptor overrides are passed instead of descriptor", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const descriptor = createTestContentDescriptor({ fields: [], displayType: "test" });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSetSize,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = faker.random.number();
        setup(addonResponse);

        // test
        const options: ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          descriptor: descriptor.createDescriptorOverrides(),
          keys,
        };
        const result = await manager.getContentSetSize(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });
    });

    describe("getContentSet", () => {
      it("returns content set", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const fieldName = "test field";
        const category = createTestCategoryDescription();
        const descriptor = createTestContentDescriptor({
          categories: [category],
          fields: [
            createTestSimpleContentField({
              category,
              name: fieldName,
            }),
          ],
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: createRandomLabelDefinition(),
            imageId: "image id",
            values: {
              [fieldName]: "test value",
            },
            displayValues: {
              [fieldName]: "test display value",
            },
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns localized content set", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const fieldName = "test field";
        const category = createTestCategoryDescription({ label: "@Presentation:label.notSpecified@" });
        const descriptor = createTestContentDescriptor({
          categories: [category],
          fields: [
            createTestSimpleContentField({
              label: "@Presentation:label.notSpecified@",
              category,
              name: fieldName,
            }),
          ],
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: {
              typeName: "string",
              rawValue: "@Presentation:label.notSpecified@",
              displayValue: "@Presentation:label.notSpecified@",
            },
            imageId: "image id",
            values: {
              [fieldName]: "@Presentation:label.notSpecified@",
            },
            displayValues: {
              [fieldName]: "@Presentation:label.notSpecified@",
            },
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content set for BisCore:Element instances when concrete key is found", async () => {
        // what the addon receives
        const baseClassKey = { className: "BisCore:Element", id: "0x123" };
        const concreteClassKey = { className: "concrete:class", id: baseClassKey.id };
        setupIModelForElementKey(imodelMock, concreteClassKey);
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(new KeySet([concreteClassKey])),
            descriptorOverrides: {},
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const fieldName = "test field";
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: createRandomLabelDefinition(),
            imageId: "test image id",
            values: {
              [fieldName]: "test value",
            },
            displayValues: {
              [fieldName]: "test display value",
            },
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: createTestContentDescriptor({ fields: [createTestSimpleContentField({ name: fieldName })] }),
          keys: new KeySet([baseClassKey]),
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content set for BisCore:Element instances when concrete key is not found", async () => {
        // what the addon receives
        const baseClassKey = { className: "BisCore:Element", id: "0x123" };
        setupIModelForNoResultStatement(imodelMock);
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(new KeySet([baseClassKey])),
            descriptorOverrides: {},
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const fieldName = "test field";
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: createRandomLabelDefinition(),
            imageId: "test image id",
            values: {
              [fieldName]: "test value",
            },
            displayValues: {
              [fieldName]: "test display value",
            },
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: createTestContentDescriptor({ fields: [createTestSimpleContentField({ name: fieldName })] }),
          keys: new KeySet([baseClassKey]),
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns formatted content set", async () => {
        // setup manager to support formatting
        recreateManager({ schemaContextProvider: () => new SchemaContext() });

        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey()]);
        const fieldName = "test field";
        const descriptor = createTestContentDescriptor({
          fields: [
            createTestPropertiesContentField({
              name: fieldName,
              properties: [{ property: createTestPropertyInfo() }],
              type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
            }),
          ],
          displayType: "test",
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            omitFormattedValues: true,
          },
        };

        // what the addon returns
        const fieldValue = 1.234;
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: createRandomLabelDefinition(),
            imageId: "test image id",
            values: {
              [fieldName]: fieldValue,
            },
            displayValues: {},
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content without formatting", async () => {
        // setup manager to support formatting
        recreateManager({ schemaContextProvider: () => new SchemaContext() });

        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey()]);
        const fieldName = "test field";
        const descriptor = createTestContentDescriptor({
          fields: [
            createTestPropertiesContentField({
              name: fieldName,
              properties: [{ property: createTestPropertyInfo() }],
              type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
            }),
          ],
          displayType: "test",
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            omitFormattedValues: true,
          },
        };

        // what the addon returns
        const fieldValue = 1.234;
        const addonResponse: ItemJSON[] = [
          {
            primaryKeys: [createRandomECInstanceKey()],
            classInfo: createRandomECClassInfo(),
            labelDefinition: createRandomLabelDefinition(),
            imageId: "test image id",
            values: {
              [fieldName]: fieldValue,
            },
            displayValues: {},
            mergedFieldNames: [],
          },
        ];
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
          omitFormattedValues: true,
        };
        const result = await manager.getContentSet(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getContent", () => {
      it("returns content", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const fieldName = faker.random.word();
        const category = createTestCategoryDescription();
        const descriptor = createTestContentDescriptor({
          categories: [category],
          fields: [
            createTestSimpleContentField({
              category,
              name: fieldName,
            }),
          ],
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = {
          descriptor: descriptor.toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: faker.random.words(),
              },
              displayValues: {
                [fieldName]: faker.random.words(),
              },
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns localized content", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const fieldName = faker.random.word();
        const category = createTestCategoryDescription({ label: "@Presentation:label.notSpecified@" });
        const descriptor = createTestContentDescriptor({
          categories: [category],
          fields: [
            createTestSimpleContentField({
              label: "@Presentation:label.notSpecified@",
              category,
              name: fieldName,
            }),
          ],
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse = {
          descriptor: descriptor.toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: {
                typeName: "string",
                rawValue: "@Presentation:label.notSpecified@",
                displayValue: "@Presentation:label.notSpecified@",
              },
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: "@Presentation:label.notSpecified@",
              },
              displayValues: {
                [fieldName]: "@Presentation:label.notSpecified@",
              },
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor,
          keys,
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content for BisCore:Element instances when concrete key is found", async () => {
        // what the addon receives
        const baseClassKey = { className: "BisCore:Element", id: createRandomId() };
        const concreteClassKey = { className: faker.random.word(), id: baseClassKey.id };
        setupIModelForElementKey(imodelMock, concreteClassKey);
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([concreteClassKey])),
            descriptorOverrides: {},
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const fieldName = faker.random.word();
        const category = createTestCategoryDescription();
        const addonResponse = {
          descriptor: createTestContentDescriptor({
            categories: [category],
            fields: [
              createTestSimpleContentField({
                category,
                name: fieldName,
              }),
            ],
          }).toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: faker.random.words(),
              },
              displayValues: {
                [fieldName]: faker.random.words(),
              },
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: {},
          keys: new KeySet([baseClassKey]),
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content for BisCore:Element instances when concrete key is not found", async () => {
        // what the addon receives
        const baseClassKey = { className: "BisCore:Element", id: createRandomId() };
        setupIModelForNoResultStatement(imodelMock);
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([baseClassKey])),
            descriptorOverrides: {},
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const fieldName = faker.random.word();
        const category = createTestCategoryDescription();
        const addonResponse = {
          descriptor: createTestContentDescriptor({
            categories: [category],
            fields: [
              createTestSimpleContentField({
                category,
                name: fieldName,
              }),
            ],
          }).toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: faker.random.words(),
              },
              displayValues: {
                [fieldName]: faker.random.words(),
              },
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: {},
          keys: new KeySet([baseClassKey]),
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content when descriptor overrides are passed instead of descriptor", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const descriptor = createTestContentDescriptor({ fields: [], displayType: "test" });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const fieldName = faker.random.word();
        const addonResponse = {
          descriptor: descriptor.toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: faker.random.words(),
              },
              displayValues: {
                [fieldName]: faker.random.words(),
              },
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptor.createDescriptorOverrides(),
          keys,
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns formatted content", async () => {
        // setup manager to support formatting
        recreateManager({ schemaContextProvider: () => new SchemaContext() });

        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey()]);
        const fieldName = faker.random.word();
        const descriptor = createTestContentDescriptor({
          fields: [
            createTestPropertiesContentField({
              name: fieldName,
              properties: [{ property: createTestPropertyInfo() }],
              type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
            }),
          ],
          displayType: "test",
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            omitFormattedValues: true,
          },
        };

        // what the addon returns
        const fieldValue = 1.234;
        const addonResponse = {
          descriptor: descriptor.toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: fieldValue,
              },
              displayValues: {},
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptor.createDescriptorOverrides(),
          keys,
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });

      it("returns content without formatting", async () => {
        // setup manager to support formatting
        recreateManager({ schemaContextProvider: () => new SchemaContext() });

        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey()]);
        const fieldName = faker.random.word();
        const descriptor = createTestContentDescriptor({
          fields: [
            createTestPropertiesContentField({
              name: fieldName,
              properties: [{ property: createTestPropertyInfo() }],
              type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
            }),
          ],
          displayType: "test",
        });
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(keys),
            descriptorOverrides: {
              displayType: descriptor.displayType,
            },
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            omitFormattedValues: true,
          },
        };

        // what the addon returns
        const fieldValue = 1.234;
        const addonResponse = {
          descriptor: descriptor.toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()],
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {
                [fieldName]: fieldValue,
              },
              displayValues: {},
              mergedFieldNames: [],
            } as ItemJSON,
          ],
        } as ContentJSON;
        setup(addonResponse);

        // test
        const options: Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          descriptor: descriptor.createDescriptorOverrides(),
          keys,
          omitFormattedValues: true,
        };
        const result = await manager.getContent(options);
        verifyWithSnapshot(result, expectedParams);
      });
    });

    describe("getPagedDistinctValues", () => {
      it("returns distinct values", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const descriptor = createTestContentDescriptor({ fields: [] });
        const fieldDescriptor: FieldDescriptor = {
          type: FieldDescriptorType.Name,
          fieldName: faker.random.word(),
        };
        const pageOpts: PageOptions = {
          start: 1,
          size: 2,
        };
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetPagedDistinctValues,
          params: {
            descriptorOverrides: descriptor.createDescriptorOverrides(),
            keys: getKeysForContentRequest(keys),
            fieldDescriptor,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
            paging: pageOpts,
          },
        };

        // what the addon returns
        const addonResponse = {
          total: 1,
          items: [
            {
              displayValue: "test",
              groupedRawValues: ["test"],
            },
          ],
        };
        setup(addonResponse);

        // test
        const options: DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          descriptor,
          keys,
          fieldDescriptor,
          paging: pageOpts,
        };
        const result = await manager.getPagedDistinctValues(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });
    });

    describe("getElementProperties", () => {
      it("returns no properties for invalid element id", async () => {
        // what the addon receives
        const elementKey = { className: "BisCore:Element", id: "0x123" };

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([elementKey])),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.PropertyPane,
              contentFlags: ContentFlags.ShowLabels,
            },
            rulesetId: "ElementProperties",
          },
        };

        // what the addon returns
        setup({});

        // test
        const options: SingleElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementId: elementKey.id,
        };
        const result = await manager.getElementProperties(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.be.undefined;
      });

      it("returns single element properties", async () => {
        // what the addon receives
        const elementKey = { className: "BisCore:Element", id: "0x123" };
        setupIModelForElementKey(imodelMock, elementKey);

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([elementKey])),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.PropertyPane,
              contentFlags: ContentFlags.ShowLabels,
            },
            rulesetId: "ElementProperties",
          },
        };

        // what the addon returns
        const addonContentResponse = new Content(
          createTestContentDescriptor({
            fields: [
              createTestSimpleContentField({
                name: "test",
                label: "Test Field",
                category: createTestCategoryDescription({ label: "Test Category" }),
              }),
            ],
          }),
          [
            createTestContentItem({
              label: "test label",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x123" }],
              values: {
                test: "test value",
              },
              displayValues: {
                test: "test display value",
              },
            }),
          ],
        ).toJSON();
        setup(addonContentResponse);

        // test
        const options: SingleElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementId: elementKey.id,
        };
        const expectedResponse: ElementProperties = {
          class: "Test Class",
          id: "0x123",
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
        const result = await manager.getElementProperties(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq(expectedResponse);
      });

      it("returns localized single element properties", async () => {
        // what the addon receives
        const elementKey = { className: "BisCore:Element", id: "0x123" };
        setupIModelForElementKey(imodelMock, elementKey);

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([elementKey])),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.PropertyPane,
              contentFlags: ContentFlags.ShowLabels,
            },
            rulesetId: "ElementProperties",
          },
        };

        // what the addon returns
        const addonContentResponse = new Content(
          createTestContentDescriptor({
            fields: [
              createTestSimpleContentField({
                name: "test",
                label: "Test Field",
                category: createTestCategoryDescription({ label: "Test Category" }),
              }),
            ],
          }),
          [
            createTestContentItem({
              label: "@Presentation:label.notSpecified@",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x123" }],
              values: {
                test: "test value",
              },
              displayValues: {
                test: "test display value",
              },
            }),
          ],
        ).toJSON();
        setup(addonContentResponse);

        // test
        const options: SingleElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementId: elementKey.id,
        };
        const expectedResponse: ElementProperties = {
          class: "Test Class",
          id: "0x123",
          label: "Not specified",
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
        const result = await manager.getElementProperties(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq(expectedResponse);
      });

      function setupIModelForElementIds(imodel: moq.IMock<IModelDb>, ids: string[]) {
        imodel.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns(() => ids.length);
        imodel
          .setup((x) => x.createQueryReader(moq.It.is((query) => query.startsWith("SELECT ECInstanceId"))))
          .returns(() => stubECSqlReader(ids.map((id) => ({ id }))));
      }

      it("returns multiple elements properties", async () => {
        // what the addon receives
        imodelMock
          .setup((x) => x.createQueryReader(moq.It.is((query) => query.includes(`FROM [TestSchema].[TestClass]`))))
          .returns(() => stubECSqlReader([["TestSchema", "TestClass"]]));
        setupIModelForElementIds(imodelMock, ["0x123", "0x124"]);

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            rulesetId: manager.getRulesetId({
              id: `content/TestSchema.TestClass`,
              rules: [
                {
                  ruleType: "Content",
                  specifications: [
                    {
                      specType: "ContentInstancesOfSpecificClasses",
                      classes: {
                        schemaName: "TestSchema",
                        classNames: ["TestClass"],
                        arePolymorphic: false,
                      },
                      handlePropertiesPolymorphically: true,
                    },
                  ],
                },
              ],
            }),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.Grid,
              contentFlags: ContentFlags.ShowLabels,
              instanceFilter: {
                selectClassName: `TestSchema.TestClass`,
                expression: `this.ECInstanceId >= ${Number.parseInt("0x123", 16).toString(10)} AND this.ECInstanceId <= ${Number.parseInt("0x124", 16).toString(10)}`,
              },
            },
            keys: new KeySet(),
          },
        };

        // what the addon returns
        setup(
          createTestContentDescriptor({
            displayType: DefaultContentDisplayTypes.Grid,
            contentFlags: ContentFlags.ShowLabels,
            fields: [
              createTestSimpleContentField({
                name: "test",
                label: "Test Field",
                category: createTestCategoryDescription({ label: "Test Category" }),
              }),
            ],
          }).toJSON(),
        );
        setup(
          [
            createTestContentItem({
              label: "test label 1",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x123" }],
              values: {
                test: "test value 1",
              },
              displayValues: {
                test: "test display value 1",
              },
            }),
            createTestContentItem({
              label: "test label 2",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x124" }],
              values: {
                test: "test value 2",
              },
              displayValues: {
                test: "test display value 2",
              },
            }),
          ].map((item) => item.toJSON()),
        );

        // test
        const options: MultiElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementClasses: ["TestSchema:TestClass"],
        };
        const expectedResponse = [
          {
            class: "Test Class",
            id: "0x123",
            label: "test label 1",
            items: {
              ["Test Category"]: {
                type: "category",
                items: {
                  ["Test Field"]: {
                    type: "primitive",
                    value: "test display value 1",
                  },
                },
              },
            },
          },
          {
            class: "Test Class",
            id: "0x124",
            label: "test label 2",
            items: {
              ["Test Category"]: {
                type: "category",
                items: {
                  ["Test Field"]: {
                    type: "primitive",
                    value: "test display value 2",
                  },
                },
              },
            },
          },
        ];
        const { total, iterator } = await manager.getElementProperties(options);

        expect(total).to.be.eq(2);
        for await (const items of iterator()) {
          verifyMockRequest(expectedContentParams);
          expect(items).to.deep.eq(expectedResponse);
        }
      });

      it("returns localized multiple elements properties", async () => {
        // what the addon receives
        imodelMock
          .setup((x) => x.createQueryReader(moq.It.is((query) => query.includes(`FROM [TestSchema].[TestClass]`))))
          .returns(() => stubECSqlReader([["TestSchema", "TestClass"]]));
        setupIModelForElementIds(imodelMock, ["0x123", "0x124"]);

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            rulesetId: manager.getRulesetId({
              id: `content/TestSchema.TestClass`,
              rules: [
                {
                  ruleType: "Content",
                  specifications: [
                    {
                      specType: "ContentInstancesOfSpecificClasses",
                      classes: {
                        schemaName: "TestSchema",
                        classNames: ["TestClass"],
                        arePolymorphic: false,
                      },
                      handlePropertiesPolymorphically: true,
                    },
                  ],
                },
              ],
            }),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.Grid,
              contentFlags: ContentFlags.ShowLabels,
              instanceFilter: {
                selectClassName: `TestSchema.TestClass`,
                expression: `this.ECInstanceId >= ${Number.parseInt("0x123", 16).toString(10)} AND this.ECInstanceId <= ${Number.parseInt("0x124", 16).toString(10)}`,
              },
            },
            keys: new KeySet(),
          },
        };

        // what the addon returns
        setup(
          createTestContentDescriptor({
            displayType: DefaultContentDisplayTypes.Grid,
            contentFlags: ContentFlags.ShowLabels,
            fields: [
              createTestSimpleContentField({
                name: "test",
                label: "Test Field",
                category: createTestCategoryDescription({ label: "Test Category" }),
              }),
            ],
          }).toJSON(),
        );
        setup(
          [
            createTestContentItem({
              label: "@Presentation:label.notSpecified@",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x123" }],
              values: {
                test: "test value 1",
              },
              displayValues: {
                test: "test display value 1",
              },
            }),
            createTestContentItem({
              label: "@Presentation:label.notSpecified@",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x124" }],
              values: {
                test: "test value 2",
              },
              displayValues: {
                test: "test display value 2",
              },
            }),
          ].map((item) => item.toJSON()),
        );

        // test
        const options: MultiElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementClasses: ["TestSchema:TestClass"],
        };
        const expectedResponse = [
          {
            class: "Test Class",
            id: "0x123",
            label: "Not specified",
            items: {
              ["Test Category"]: {
                type: "category",
                items: {
                  ["Test Field"]: {
                    type: "primitive",
                    value: "test display value 1",
                  },
                },
              },
            },
          },
          {
            class: "Test Class",
            id: "0x124",
            label: "Not specified",
            items: {
              ["Test Category"]: {
                type: "category",
                items: {
                  ["Test Field"]: {
                    type: "primitive",
                    value: "test display value 2",
                  },
                },
              },
            },
          },
        ];
        const { total, iterator } = await manager.getElementProperties(options);

        expect(total).to.be.eq(2);
        for await (const items of iterator()) {
          verifyMockRequest(expectedContentParams);
          expect(items).to.deep.eq(expectedResponse);
        }
      });

      it("returns element properties with custom parser", async () => {
        // what the addon receives
        imodelMock
          .setup((x) => x.createQueryReader(moq.It.is((query) => query.includes(`FROM [TestSchema].[TestClass]`))))
          .returns(() => stubECSqlReader([["TestSchema", "TestClass"]]));
        setupIModelForElementIds(imodelMock, ["0x123", "0x124"]);

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContentSet,
          params: {
            rulesetId: manager.getRulesetId({
              id: `content/TestSchema.TestClass`,
              rules: [
                {
                  ruleType: "Content",
                  specifications: [
                    {
                      specType: "ContentInstancesOfSpecificClasses",
                      classes: {
                        schemaName: "TestSchema",
                        classNames: ["TestClass"],
                        arePolymorphic: false,
                      },
                      handlePropertiesPolymorphically: true,
                    },
                  ],
                },
              ],
            }),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.Grid,
              contentFlags: ContentFlags.ShowLabels,
              instanceFilter: {
                selectClassName: `TestSchema.TestClass`,
                expression: `this.ECInstanceId >= ${Number.parseInt("0x123", 16).toString(10)} AND this.ECInstanceId <= ${Number.parseInt("0x124", 16).toString(10)}`,
              },
            },
            keys: new KeySet(),
          },
        };

        // what the addon returns
        setup(
          createTestContentDescriptor({
            displayType: DefaultContentDisplayTypes.Grid,
            contentFlags: ContentFlags.ShowLabels,
            fields: [
              createTestSimpleContentField({
                name: "test",
                label: "Test Field",
                category: createTestCategoryDescription({ label: "Test Category" }),
              }),
            ],
          }).toJSON(),
        );
        setup(
          [
            createTestContentItem({
              label: "test one",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x123" }],
              values: {},
              displayValues: {},
            }),
            createTestContentItem({
              label: "test two",
              classInfo: createTestECClassInfo({ label: "Test Class" }),
              primaryKeys: [{ className: "TestSchema:TestClass", id: "0x124" }],
              values: {},
              displayValues: {},
            }),
          ].map((item) => item.toJSON()),
        );

        // test
        const options: MultiElementPropertiesRequestOptions<IModelDb, string> = {
          imodel: imodelMock.object,
          elementClasses: ["TestSchema:TestClass"],
          contentParser: (_, item) => item.label.displayValue,
        };
        const expectedResponse = ["test one", "test two"];
        const { total, iterator } = await manager.getElementProperties(options);

        expect(total).to.be.eq(2);
        for await (const items of iterator()) {
          verifyMockRequest(expectedContentParams);
          expect(items).to.deep.eq(expectedResponse);
        }
      });
    });

    describe("getDisplayLabelDefinition", () => {
      it("returns label from native addon", async () => {
        // what the addon receives
        const key = createRandomECInstanceKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetDisplayLabel,
          params: {
            key,
          },
        };

        // what the addon returns
        const addonResponse = createRandomLabelDefinition();
        setup(addonResponse);

        // test
        const options: DisplayLabelRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          key,
        };
        const result = await manager.getDisplayLabelDefinition(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });

      it("returns label from native addon and localizes it", async () => {
        // what the addon receives
        const key = createRandomECInstanceKey();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetDisplayLabel,
          params: {
            key,
          },
        };

        // what the addon returns
        const addonResponse = (): LabelDefinition => {
          return {
            displayValue: "@Presentation:label.notSpecified@",
            rawValue: "@Presentation:label.notSpecified@",
            typeName: "string",
          };
        };
        setup(addonResponse());

        // what the presentation manager returns
        const localizedAddonResponse = (): LabelDefinition => {
          return {
            displayValue: "Not specified",
            rawValue: "Not specified",
            typeName: "string",
          };
        };
        // test
        const options: DisplayLabelRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          key,
        };
        const result = await manager.getDisplayLabelDefinition(options);
        verifyWithExpectedResult(result, localizedAddonResponse(), expectedParams);
      });
    });

    describe("getDisplayLabelDefinitions", () => {
      it("returns labels from list content and localizes them", async () => {
        // what the addon returns
        const addonResponse = (): LabelDefinition => {
          return {
            displayValue: "@Presentation:label.notSpecified@",
            rawValue: "@Presentation:label.notSpecified@",
            typeName: "string",
          };
        };

        // what the presentation manager returns
        const localizedAddonResponse = (): LabelDefinition => {
          return {
            displayValue: "Not specified",
            rawValue: "Not specified",
            typeName: "string",
          };
        };
        // what the addon receives
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        const labels = [addonResponse(), addonResponse()];
        const labelsLocalized = [localizedAddonResponse(), localizedAddonResponse()];
        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet(keys)),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.List,
              contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
            },
            rulesetId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
          },
        };

        // what the addon returns
        const addonContentResponse = {
          descriptor: {
            connectionId: faker.random.uuid(),
            inputKeysHash: faker.random.uuid(),
            contentOptions: {},
            displayType: DefaultContentDisplayTypes.List,
            selectClasses: [],
            categories: [],
            fields: [],
            contentFlags: 0,
            classesMap: {},
          } as DescriptorJSON,
          // note: return in wrong order to verify the resulting labels are still in the right order
          contentSet: [1, 0].map(
            (index): ItemJSON => ({
              primaryKeys: [keys[index]],
              classInfo: createRandomECClassInfo(),
              labelDefinition: labels[index],
              imageId: faker.random.uuid(),
              values: {},
              displayValues: {},
              mergedFieldNames: [],
            }),
          ),
        } as ContentJSON;
        setup(addonContentResponse);

        // test
        const options: DisplayLabelsRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          keys,
        };
        const result = await manager.getDisplayLabelDefinitions(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq(labelsLocalized);
      });

      it("returns labels from list content", async () => {
        // what the addon receives
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        const labels = [createRandomLabelDefinition(), createRandomLabelDefinition()];
        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet(keys)),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.List,
              contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
            },
            rulesetId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
          },
        };

        // what the addon returns
        const addonContentResponse = {
          descriptor: {
            connectionId: faker.random.uuid(),
            inputKeysHash: faker.random.uuid(),
            contentOptions: {},
            displayType: DefaultContentDisplayTypes.List,
            selectClasses: [],
            categories: [],
            fields: [],
            contentFlags: 0,
            classesMap: {},
          } as DescriptorJSON,
          // note: return in wrong order to verify the resulting labels are still in the right order
          contentSet: [1, 0].map(
            (index): ItemJSON => ({
              primaryKeys: [keys[index]],
              classInfo: createRandomECClassInfo(),
              labelDefinition: labels[index],
              imageId: faker.random.uuid(),
              values: {},
              displayValues: {},
              mergedFieldNames: [],
            }),
          ),
        } as ContentJSON;
        setup(addonContentResponse);

        // test
        const options: DisplayLabelsRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          keys,
        };
        const result = await manager.getDisplayLabelDefinitions(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq(labels);
      });

      it("returns labels for BisCore:Element instances", async () => {
        // what the addon receives
        const baseClassKey = { className: "BisCore:Element", id: createRandomId() };
        const concreteClassKey = { className: faker.random.word(), id: baseClassKey.id };
        setupIModelForElementKey(imodelMock, concreteClassKey);
        const label = createRandomLabelDefinition();
        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet([concreteClassKey])),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.List,
              contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
            },
            rulesetId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
          },
        };

        // what the addon returns
        const addonContentResponse = {
          descriptor: {
            connectionId: faker.random.uuid(),
            inputKeysHash: faker.random.uuid(),
            contentOptions: {},
            displayType: DefaultContentDisplayTypes.List,
            selectClasses: [],
            categories: [],
            fields: [],
            contentFlags: 0,
            classesMap: {},
          } as DescriptorJSON,
          // note: return in wrong order to verify the resulting labels are still in the right order
          contentSet: [
            {
              primaryKeys: [concreteClassKey],
              classInfo: createRandomECClassInfo(),
              labelDefinition: label,
              imageId: faker.random.uuid(),
              values: {},
              displayValues: {},
              mergedFieldNames: [],
            },
          ],
        } as ContentJSON;
        setup(addonContentResponse);

        // test
        const options: DisplayLabelsRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          keys: [baseClassKey],
        };
        const result = await manager.getDisplayLabelDefinitions(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq([label]);
      });

      it("returns empty labels if content doesn't contain item with request key", async () => {
        const keys = [createRandomECInstanceKey()];
        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet(keys)),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.List,
              contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
            },
            rulesetId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
          },
        };

        // what the addon returns
        const addonContentResponse = {
          descriptor: createTestContentDescriptor({ fields: [] }).toJSON(),
          contentSet: [
            {
              primaryKeys: [createRandomECInstanceKey()], // different than input key
              classInfo: createRandomECClassInfo(),
              labelDefinition: createRandomLabelDefinition(),
              imageId: faker.random.uuid(),
              values: {},
              displayValues: {},
              mergedFieldNames: [],
            },
          ],
        } as ContentJSON;
        setup(addonContentResponse);

        // test
        const options: DisplayLabelsRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          keys,
        };
        const result = await manager.getDisplayLabelDefinitions(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq([{ displayValue: "", rawValue: "", typeName: "" }]);
      });

      it("returns empty labels if content is undefined", async () => {
        const keys = [createRandomECInstanceKey()];
        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet(keys)),
            descriptorOverrides: {
              displayType: DefaultContentDisplayTypes.List,
              contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
            },
            rulesetId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
          },
        };

        // what the addon returns
        setup(null);

        // test
        const options: DisplayLabelsRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          keys,
        };
        const result = await manager.getDisplayLabelDefinitions(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq([{ displayValue: "", rawValue: "", typeName: "" }]);
      });
    });

    it("throws on invalid addon response", async () => {
      nativePlatformMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString(), undefined)).returns(() => undefined as any);
      const options: HierarchyRequestOptions<IModelDb, NodeKey> = {
        imodel: imodelMock.object,
        rulesetOrId: testData.rulesetOrId,
      };
      return expect(manager.getNodesCount(options)).to.eventually.be.rejectedWith(Error);
    });

    describe("getLocalizedString", () => {
      it("Passes getLocalizedString to manager and uses it", async () => {
        const getLocalizedStringSpy = sinon.spy();
        manager = new PresentationManager({ addon: nativePlatformMock.object, getLocalizedString: getLocalizedStringSpy });
        sinon.stub(manager.getDetail(), "rulesets").value(
          sinon.createStubInstance(RulesetManagerImpl, {
            add: sinon.stub<[Ruleset], RegisteredRuleset>().callsFake((ruleset) => new RegisteredRuleset(ruleset, "", () => {})),
          }),
        );
        // what the addon returns
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addonResponse: HierarchyLevelJSON = {
          nodes: [
            {
              key: {
                type: "type1",
                pathFromRoot: ["p1", "p2", "p3"],
              },
              labelDefinition: LabelDefinition.fromLabelString("@Presentation:label.notSpecified@"),
            },
          ],
          supportsFiltering: true,
        };
        setup(addonResponse);

        // test
        const options: Paged<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
        };

        await manager.getNodes(options);
        sinon.assert.calledTwice(getLocalizedStringSpy);
      });
    });
  });

  describe("getSelectionScopes", () => {
    const addon = moq.Mock.ofType<NativePlatformDefinition>();
    const imodel = moq.Mock.ofType<IModelDb>();
    let manager: PresentationManager;

    beforeEach(() => {
      addon.reset();
      imodel.reset();
      manager = new PresentationManager({ addon: addon.object });
    });

    afterEach(() => {
      manager.dispose();
    });

    it("requests scopes from `SelectionScopesHelper`", async () => {
      const scopes = new Array<SelectionScope>();
      const stub = sinon.stub(SelectionScopesHelper, "getSelectionScopes").returns(scopes);
      const result = await manager.getSelectionScopes({ imodel: imodel.object });
      expect(stub).to.be.calledOnce;
      expect(result).to.deep.eq(scopes);
    });
  });

  describe("computeSelection", () => {
    const addon = moq.Mock.ofType<NativePlatformDefinition>();
    const imodel = moq.Mock.ofType<IModelDb>();
    let manager: PresentationManager;

    beforeEach(() => {
      addon.reset();
      imodel.reset();
      manager = new PresentationManager({ addon: addon.object });
    });

    afterEach(() => {
      manager.dispose();
    });

    it("[deprecated] computes selection using `SelectionScopesHelper`", async () => {
      const ids = [createRandomId()];
      const resultKeys = new KeySet();
      const stub = sinon.stub(SelectionScopesHelper, "computeSelection").resolves(resultKeys);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const result = await manager.computeSelection({ imodel: imodel.object, ids, scopeId: "test scope" });
      expect(stub).to.be.calledOnceWith({ imodel: imodel.object, elementIds: ids, scope: { id: "test scope" } });
      expect(result).to.eq(resultKeys);
    });

    it("computes element selection using `SelectionScopesHelper`", async () => {
      const elementIds = [createRandomId()];
      const resultKeys = new KeySet();
      const stub = sinon.stub(SelectionScopesHelper, "computeSelection").resolves(resultKeys);
      const result = await manager.computeSelection({ imodel: imodel.object, elementIds, scope: { id: "element", ancestorLevel: 123 } });
      expect(stub).to.be.calledOnceWith({ imodel: imodel.object, elementIds, scope: { id: "element", ancestorLevel: 123 } });
      expect(result).to.eq(resultKeys);
    });
  });

  describe("updates handling", () => {
    describe("ipc", () => {
      let spy: sinon.SinonSpy<[string, ...any[]], void>;
      beforeEach(() => {
        spy = sinon.stub(IpcHost, "send");
      });

      it("doesn't emit events if there are no updates", () => {
        ipcUpdatesHandler(undefined);
        expect(spy).to.not.be.called;

        ipcUpdatesHandler({});
        expect(spy).to.not.be.called;
      });

      it("emits events if there are updates", () => {
        const imodelStub = {
          getRpcProps: () => ({ key: "imodel-key" }),
        };
        sinon.stub(IModelDb, "findByFilename").returns(imodelStub as IModelDb);

        const updates: UpdateInfo = {
          ["imodel-file-path"]: {
            "a-ruleset": { hierarchy: "FULL" },
            "b-ruleset": { content: "FULL" },
          },
        };
        ipcUpdatesHandler(updates);

        const expectedUpdateInfo: UpdateInfo = {
          ["imodel-key"]: updates["imodel-file-path"],
        };
        expect(spy).to.be.calledOnceWithExactly(PresentationIpcEvents.Update, expectedUpdateInfo);
      });

      it("does not emit events if imodel is not found", () => {
        sinon.stub(IModelDb, "findByFilename").returns(undefined);

        const updates: UpdateInfo = {
          ["imodel-File-Path"]: {
            "a-ruleset": { hierarchy: "FULL" },
          },
        };
        ipcUpdatesHandler(updates);

        expect(spy).to.not.be.called;
      });
    });
  });
});
