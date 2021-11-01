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
import { BriefcaseDb, ECSqlStatement, ECSqlValue, IModelDb, IModelHost, IpcHost } from "@itwin/core-backend";
import { DbResult, Id64String, using } from "@itwin/core-bentley";
import {
  ArrayTypeDescription, CategoryDescription, Content, ContentDescriptorRequestOptions, ContentFlags, ContentJSON, ContentRequestOptions,
  ContentSourcesRequestOptions, DefaultContentDisplayTypes, Descriptor, DescriptorJSON, DescriptorOverrides, DiagnosticsOptions, DiagnosticsScopeLogs,
  DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DistinctValuesRequestOptions, ElementProperties, FieldDescriptor, FieldDescriptorType,
  FieldJSON, FilterByInstancePathsHierarchyRequestOptions, FilterByTextHierarchyRequestOptions, getLocalesDirectory, HierarchyCompareInfo,
  HierarchyCompareInfoJSON, HierarchyCompareOptions, HierarchyRequestOptions, InstanceKey, IntRulesetVariable, ItemJSON, KeySet, KindOfQuantityInfo,
  LabelDefinition, MultiElementPropertiesRequestOptions, NestedContentFieldJSON, NodeJSON, NodeKey, Paged, PageOptions, PresentationError,
  PrimitiveTypeDescription, PropertiesFieldJSON, PropertyInfoJSON, PropertyJSON, RegisteredRuleset, RelatedClassInfo, Ruleset, SelectClassInfo,
  SelectClassInfoJSON, SelectionInfo, SelectionScope, SingleElementPropertiesRequestOptions, StandardNodeTypes, StructTypeDescription,
  VariableValueTypes,
} from "@itwin/presentation-common";
import {
  createRandomECClassInfoJSON, createRandomECInstanceKey, createRandomECInstanceKeyJSON, createRandomECInstancesNodeJSON,
  createRandomECInstancesNodeKey, createRandomECInstancesNodeKeyJSON, createRandomId, createRandomLabelDefinitionJSON,
  createRandomNodePathElementJSON, createRandomRelationshipPath, createRandomRuleset, createTestCategoryDescription, createTestContentDescriptor,
  createTestContentItem, createTestECClassInfo, createTestRelatedClassInfo, createTestRelationshipPath, createTestSelectClassInfo,
  createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { PRESENTATION_BACKEND_ASSETS_ROOT, PRESENTATION_COMMON_ASSETS_ROOT } from "../presentation-backend/Constants";
import { NativePlatformDefinition, NativePlatformRequestTypes, NativePresentationUnitSystem } from "../presentation-backend/NativePlatform";
import {
  getKeysForContentRequest, HierarchyCacheMode, HybridCacheConfig, PresentationManager, PresentationManagerMode, PresentationManagerProps,
} from "../presentation-backend/PresentationManager";
import { RulesetManagerImpl } from "../presentation-backend/RulesetManager";
import { RulesetVariablesManagerImpl } from "../presentation-backend/RulesetVariablesManager";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper";
import { UpdatesTracker } from "../presentation-backend/UpdatesTracker";

const deepEqual = require("deep-equal"); // eslint-disable-line @typescript-eslint/no-var-requires

describe("PresentationManager", () => {

  before(async () => {
    try {
      await IModelHost.startup();
    } catch (e) {
      let isLoaded = false;
      try {
        IModelHost.platform;
        isLoaded = true;
      } catch (_e) { }
      if (!isLoaded)
        throw e; // re-throw if startup() failed to set up NativePlatform
    }
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  const setupIModelForElementKey = (imodelMock: moq.IMock<IModelDb>, key: InstanceKey) => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).callback((_q, cb) => {
      const valueMock = moq.Mock.ofType<ECSqlValue>();
      valueMock.setup((x) => x.getClassNameForClassId()).returns(() => key.className);
      const stmtMock = moq.Mock.ofType<ECSqlStatement>();
      stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
      stmtMock.setup((x) => x.getValue(0)).returns(() => valueMock.object);
      cb(stmtMock.object);
    });
  };

  const setupIModelForNoResultStatement = (imodelMock: moq.IMock<IModelDb>) => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).callback((_q, cb) => {
      const stmtMock = moq.Mock.ofType<ECSqlStatement>();
      stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
      cb(stmtMock.object);
    });
  };

  describe("constructor", () => {

    describe("uses default native library implementation if not overridden", () => {

      it("creates without props", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager(), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: false,
            cacheConfig: { mode: HierarchyCacheMode.Disk, directory: "" },
            contentCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
      });

      it("creates with props", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        const testLocale = faker.random.locale();
        const testThreadsCount = 999;
        const hierarchyCacheConfig = {
          mode: HierarchyCacheMode.Memory,
        };
        const formatProps = {
          composite: {
            includeZero: true,
            spacer: " ",
            units: [
              { label: "'", name: "IN" },
            ],
          },
          formatTraits: "KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
          precision: 4,
          type: "Decimal",
          uomSeparator: "",
        };
        const props: PresentationManagerProps = {
          id: faker.random.uuid(),
          presentationAssetsRoot: "/test",
          localeDirectories: [testLocale, testLocale],
          workerThreadsCount: testThreadsCount,
          mode: PresentationManagerMode.ReadWrite,
          updatesPollInterval: 1,
          caching: {
            hierarchies: hierarchyCacheConfig,
            content: {
              size: 999,
            },
          },
          useMmap: 666,
          defaultFormats: {
            length: { unitSystems: ["imperial"], format: formatProps },
          },
        };
        const expectedCacheConfig = {
          mode: HierarchyCacheMode.Memory,
        };
        using(new PresentationManager(props), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: props.id,
            localeDirectories: [getLocalesDirectory("/test"), testLocale],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 999 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: true,
            cacheConfig: expectedCacheConfig,
            contentCacheSize: 999,
            defaultFormats: {
              length: { unitSystems: [NativePresentationUnitSystem.BritishImperial], serializedFormat: JSON.stringify(formatProps) },
            },
            useMmap: 666,
          });
        });
      });

      it("creates with disk cache config", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager({ caching: { hierarchies: { mode: HierarchyCacheMode.Disk } } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: false,
            cacheConfig: { mode: HierarchyCacheMode.Disk, directory: "" },
            contentCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
        constructorSpy.resetHistory();
        const cacheConfig = {
          mode: HierarchyCacheMode.Disk,
          directory: faker.random.word(),
        };
        const expectedConfig = { ...cacheConfig, directory: path.resolve(cacheConfig.directory) };
        using(new PresentationManager({ caching: { hierarchies: cacheConfig } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: false,
            cacheConfig: expectedConfig,
            contentCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
        });
      });

      it("creates with hybrid cache config", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager({ caching: { hierarchies: { mode: HierarchyCacheMode.Hybrid } } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: false,
            cacheConfig: { mode: HierarchyCacheMode.Hybrid, disk: undefined },
            contentCacheSize: undefined,
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
          },
        };
        const expectedConfig = {
          ...cacheConfig, disk: { ...cacheConfig.disk, directory: path.resolve(cacheConfig.disk!.directory!) },
        };
        using(new PresentationManager({ caching: { hierarchies: cacheConfig } }), (manager) => {
          expect((manager.getNativePlatform() as any)._nativeAddon).instanceOf(IModelHost.platform.ECPresentationManager);
          expect(constructorSpy).to.be.calledOnceWithExactly({
            id: "",
            localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
            taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: 2 },
            mode: IModelHost.platform.ECPresentationManagerMode.ReadWrite,
            isChangeTrackingEnabled: false,
            cacheConfig: expectedConfig,
            contentCacheSize: undefined,
            useMmap: undefined,
            defaultFormats: {},
          });
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
        const addonDirs = [path.join(PRESENTATION_BACKEND_ASSETS_ROOT, "primary-presentation-rules"), "test1", "test2"];
        addon.setup((x) => x.setupRulesetDirectories(addonDirs)).verifiable();
        using(new PresentationManager({ addon: addon.object, rulesetDirectories: dirs }), (pm: PresentationManager) => { pm; });
        addon.verifyAll();
      });

      it("sets up presentation backend's primary ruleset directories using `presentationAssetsRoot` as string if supplied", () => {
        const addonDirs = [path.join("/test", "primary-presentation-rules")];
        addon.setup((x) => x.setupRulesetDirectories(addonDirs)).verifiable();
        using(new PresentationManager({ addon: addon.object, presentationAssetsRoot: "/test" }), (pm: PresentationManager) => { pm; });
        addon.verifyAll();
      });

      it("sets up presentation backend's primary ruleset directories using `presentationAssetsRoot.backend` if supplied", () => {
        const addonDirs = [path.join("/backend-test", "primary-presentation-rules")];
        addon.setup((x) => x.setupRulesetDirectories(addonDirs)).verifiable();
        using(new PresentationManager({ addon: addon.object, presentationAssetsRoot: { backend: "/backend-test", common: "/common-test" } }), (_pm: PresentationManager) => { });
        addon.verifyAll();
      });

      it("sets up supplemental ruleset directories if supplied", () => {
        const dirs = ["test1", "test2", "test2"];
        const addonDirs = [path.join(PRESENTATION_BACKEND_ASSETS_ROOT, "supplemental-presentation-rules"), "test1", "test2"];
        addon
          .setup((x) => x.setupSupplementalRulesetDirectories(addonDirs))
          .verifiable();
        using(new PresentationManager({ addon: addon.object, supplementalRulesetDirectories: dirs }), (_pm: PresentationManager) => { });
        addon.verifyAll();
      });

      it("sets up presentation backend's supplemental ruleset directories using `presentationAssetsRoot` as string if supplied", () => {
        const addonDirs = [path.join("/test", "supplemental-presentation-rules")];
        addon
          .setup((x) => x.setupSupplementalRulesetDirectories(addonDirs))
          .verifiable();
        using(new PresentationManager({ addon: addon.object, presentationAssetsRoot: "/test" }), (_pm: PresentationManager) => { });
        addon.verifyAll();
      });

      it("sets up presentation backend's supplemental ruleset directories using `presentationAssetsRoot.backend` if supplied", () => {
        const addonDirs = [path.join("/backend-test", "supplemental-presentation-rules")];
        addon
          .setup((x) => x.setupSupplementalRulesetDirectories(addonDirs))
          .verifiable();
        using(new PresentationManager({ addon: addon.object, presentationAssetsRoot: { backend: "/backend-test", common: "/common-test" } }), (_pm: PresentationManager) => { });
        addon.verifyAll();
      });

      it("sets up default locale directories", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager({}), (_manager) => { });
        expect(constructorSpy).to.be.calledOnce;
        expect(constructorSpy.firstCall.firstArg).to.containSubset({
          localeDirectories: [getLocalesDirectory(PRESENTATION_COMMON_ASSETS_ROOT)],
        });
      });

      it("sets up default locale directories using `presentationAssetsRoot` as string if supplied", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager({ presentationAssetsRoot: "/test" }), (_manager) => { });
        expect(constructorSpy).to.be.calledOnce;
        expect(constructorSpy.firstCall.firstArg).to.containSubset({
          localeDirectories: [getLocalesDirectory("/test")],
        });
      });

      it("sets up default locale directories using `presentationAssetsRoot.common` if supplied", () => {
        const constructorSpy = sinon.spy(IModelHost.platform, "ECPresentationManager");
        using(new PresentationManager({ presentationAssetsRoot: { backend: "/backend-test", common: "/common-test" } }), (_manager) => { });
        expect(constructorSpy).to.be.calledOnce;
        expect(constructorSpy.firstCall.firstArg).to.containSubset({
          localeDirectories: [getLocalesDirectory("/common-test")],
        });
      });

      it("sets up active locale if supplied", () => {
        const locale = faker.random.locale();
        using(new PresentationManager({ addon: addon.object, defaultLocale: locale }), (manager) => {
          expect(manager.activeLocale).to.eq(locale);
        });
      });

      it("subscribes for `BriefcaseDb.onOpened` event if `enableSchemasPreload` is set", () => {
        using(new PresentationManager({ addon: addon.object, enableSchemasPreload: false }), (_) => {
          expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(0);
        });
        using(new PresentationManager({ addon: addon.object, enableSchemasPreload: true }), (_) => {
          expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(1);
        });
      });

      it("creates an `UpdateTracker` when in read-write mode, `updatesPollInterval` is specified and IPC host is available", () => {
        sinon.stub(IpcHost, "isValid").get(() => true);
        const tracker = sinon.createStubInstance(UpdatesTracker) as unknown as UpdatesTracker;
        const stub = sinon.stub(UpdatesTracker, "create").returns(tracker);
        using(new PresentationManager({ addon: addon.object, mode: PresentationManagerMode.ReadWrite, updatesPollInterval: 123 }), (_) => {
          expect(stub).to.be.calledOnceWith(sinon.match({ pollInterval: 123 }));
          expect(tracker.dispose).to.not.be.called; // eslint-disable-line @typescript-eslint/unbound-method
        });
        expect(tracker.dispose).to.be.calledOnce; // eslint-disable-line @typescript-eslint/unbound-method
      });

      it("doesn't create an `UpdateTracker` when IPC host is unavailable", () => {
        sinon.stub(IpcHost, "isValid").get(() => false);
        const stub = sinon.stub(UpdatesTracker, "create");
        using(new PresentationManager({ addon: addon.object, mode: PresentationManagerMode.ReadWrite, updatesPollInterval: 123 }), (_) => {
          expect(stub).to.not.be.called;
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
      const props = { defaultLocale: faker.random.locale() };
      using(new PresentationManager(props), (newManager) => {
        expect(newManager.props).to.equal(props);
      });
    });

  });

  describe("defaultLocale", () => {

    const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
    beforeEach(() => {
      addonMock.reset();
    });

    it("uses manager's defaultLocale when not specified in request options", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const rulesetId = faker.random.word();
      const locale = faker.random.locale().toLowerCase();
      await using(new PresentationManager({ addon: addonMock.object, defaultLocale: locale }), async (manager) => {
        addonMock
          .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedRequest: string): boolean => {
            const request = JSON.parse(serializedRequest);
            return request.params.locale === locale;
          })))
          .returns(async () => ({ result: "{}" }))
          .verifiable(moq.Times.once());
        await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId });
        addonMock.verifyAll();
      });
    });

    it("ignores manager's defaultLocale when locale is specified in request options", async () => {
      const imodelMock = moq.Mock.ofType<IModelDb>();
      const rulesetId = faker.random.word();
      const locale = faker.random.locale().toLowerCase();
      await using(new PresentationManager({ addon: addonMock.object, defaultLocale: faker.random.locale().toLowerCase() }), async (manager) => {
        expect(manager.activeLocale).to.not.eq(locale);
        addonMock
          .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedRequest: string): boolean => {
            const request = JSON.parse(serializedRequest);
            return request.params.locale === locale;
          })))
          .returns(async () => ({ result: "{}" }))
          .verifiable(moq.Times.once());
        await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, locale });
        addonMock.verifyAll();
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
          .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedRequest: string): boolean => {
            const request = JSON.parse(serializedRequest);
            return request.params.unitSystem === NativePresentationUnitSystem.Metric;
          })))
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
          .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedRequest: string): boolean => {
            const request = JSON.parse(serializedRequest);
            return request.params.unitSystem === NativePresentationUnitSystem.UsSurvey;
          })))
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
          .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedRequest: string): boolean => {
            const request = JSON.parse(serializedRequest);
            return request.params.unitSystem === NativePresentationUnitSystem.UsCustomary;
          })))
          .returns(async () => ({ result: "null" }))
          .verifiable(moq.Times.once());
        await manager.getContentDescriptor({ imodel: imodelMock.object, rulesetOrId: rulesetId, unitSystem, displayType: "", keys: new KeySet() });
        addonMock.verifyAll();
      });
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

    it("unsubscribes from `IModelDb.onOpened` event if `enableSchemasPreload` is set", () => {
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      const manager = new PresentationManager({ addon: nativePlatformMock.object, enableSchemasPreload: true });
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(1);
      manager.dispose();
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(0);
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

  });

  describe("handling options", () => {

    const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
    const imodelMock = moq.Mock.ofType<IModelDb>();
    let manager: PresentationManager;

    beforeEach(() => {
      addonMock.reset();
      manager = new PresentationManager({ addon: addonMock.object });
    });

    it("registers ruleset if `rulesetOrId` is a ruleset", async () => {
      const ruleset = await createRandomRuleset();
      addonMock
        .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny()))
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
        .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny()))
        .returns(async () => ({ result: "{}" }))
        .verifiable(moq.Times.once());
      addonMock
        .setup((x) => x.addRuleset(moq.It.isAnyString()))
        .returns(() => ({ result: "hash" }))
        .verifiable(moq.Times.never());
      await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId });
      addonMock.verifyAll();
    });

    it("sends diagnostic options to native platform and invokes handler with diagnostic results", async () => {
      const diagnosticOptions: DiagnosticsOptions = {
        perf: true,
        editor: "info",
        dev: "warning",
      };
      const diagnosticsResult: DiagnosticsScopeLogs = {
        scope: "test",
        duration: 123,
      };
      const diagnosticsListener = sinon.spy();
      addonMock
        .setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((reqStr) => sinon.match(diagnosticOptions).test(JSON.parse(reqStr).params.diagnostics))))
        .returns(async () => ({ result: "{}", diagnostics: diagnosticsResult }))
        .verifiable(moq.Times.once());
      await manager.getNodesCount({ imodel: imodelMock.object, rulesetOrId: "ruleset", diagnostics: { ...diagnosticOptions, handler: diagnosticsListener } });
      addonMock.verifyAll();
      expect(diagnosticsListener).to.be.calledOnceWith([diagnosticsResult]);
    });

  });

  describe("preloading schemas", () => {

    it("calls addon's `forceLoadSchemas` on `IModelDb.onOpened` events", () => {
      const imodelMock = moq.Mock.ofType<BriefcaseDb>();
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      nativePlatformMock.setup((x) => x.getImodelAddon(imodelMock.object)).verifiable(moq.Times.atLeastOnce());
      using(new PresentationManager({ addon: nativePlatformMock.object, enableSchemasPreload: true }), (_) => {
        BriefcaseDb.onOpened.raiseEvent(imodelMock.object, {} as any);
        nativePlatformMock.verify(async (x) => x.forceLoadSchemas(moq.It.isAny()), moq.Times.once());
      });
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
      manager = new PresentationManager({ addon: nativePlatformMock.object });
      sinon.stub(manager, "rulesets").returns(sinon.createStubInstance(RulesetManagerImpl, {
        add: sinon.stub<[Ruleset], RegisteredRuleset>().callsFake((ruleset) => new RegisteredRuleset(ruleset, "", () => { })),
      }));
    });
    afterEach(() => {
      manager.dispose();
      nativePlatformMock.verifyAll();
    });

    const setup = (addonResponse: any) => {
      const serialized = JSON.stringify(addonResponse);
      nativePlatformMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString()))
        .returns(async () => ({ result: JSON.stringify(addonResponse) }));
      return JSON.parse(serialized);
    };
    const verifyMockRequest = (expectedParams: any) => {
      // verify the addon was called with correct params
      nativePlatformMock.verify(async (x) => x.handleRequest(moq.It.isAny(), moq.It.is((serializedParam: string): boolean => {
        const param = JSON.parse(serializedParam);
        expectedParams = JSON.parse(JSON.stringify(expectedParams));
        return deepEqual(param, expectedParams);
      })), moq.Times.once());
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
        const addonResponse: NodeJSON[] = [{
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
        }, {
          key: {
            type: StandardNodeTypes.ECInstancesNode,
            pathFromRoot: ["p1"],
            instanceKeys: [createRandomECInstanceKeyJSON()],
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
        }, {
          key: {
            type: "some node",
            pathFromRoot: ["p1", "p3"],
          },
          labelDefinition: LabelDefinition.fromLabelString("test2"),
        }];
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
        const parentNodeKeyJSON = createRandomECInstancesNodeKeyJSON();
        const expectedParams = {
          requestId: NativePlatformRequestTypes.GetChildren,
          params: {
            nodeKey: parentNodeKeyJSON,
            paging: testData.pageOptions,
            rulesetId: manager.getRulesetId(testData.rulesetOrId),
          },
        };

        // what the addon returns
        const addonResponse: NodeJSON[] = [{
          key: {
            type: StandardNodeTypes.ECInstancesNode,
            pathFromRoot: ["p1"],
            instanceKeys: [createRandomECInstanceKeyJSON()],
          },
          labelDefinition: LabelDefinition.fromLabelString("test2"),
        }, {
          key: {
            type: "type 2",
            pathFromRoot: ["p1", "p3"],
          },
          labelDefinition: LabelDefinition.fromLabelString("test3"),
        }];
        setup(addonResponse);

        // test
        const options: Paged<HierarchyRequestOptions<IModelDb, NodeKey>> = {
          imodel: imodelMock.object,
          rulesetOrId: testData.rulesetOrId,
          paging: testData.pageOptions,
          parentKey: NodeKey.fromJSON(parentNodeKeyJSON),
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
        const parentNodeKeyJSON = createRandomECInstancesNodeKeyJSON();
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
          parentKey: NodeKey.fromJSON(parentNodeKeyJSON),
        };
        const result = await manager.getNodesCount(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
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
        const keyJsonArray = [[createRandomECInstanceKeyJSON(), createRandomECInstanceKeyJSON()]];
        const keyArray = [keyJsonArray[0].map((json) => InstanceKey.fromJSON(json))];
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
            expandedNodeKeys: JSON.stringify([NodeKey.toJSON(nodeKey)]),
          },
        };

        // what the addon returns
        const unprocessedResponse: HierarchyCompareInfoJSON = {
          changes: [{
            type: "Insert",
            position: 1,
            node: createRandomECInstancesNodeJSON(),
          }],
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
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [{
            type: "Delete",
            parent: createRandomECInstancesNodeJSON().key,
            position: 123,
          }],
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
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [{
            type: "Update",
            target: createRandomECInstancesNodeJSON().key,
            changes: {},
          }],
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
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
      });

      it("returns empty result if neither ruleset nor ruleset variables changed", async () => {
        nativePlatformMock.reset();
        const result = await manager.compareHierarchies({
          imodel: imodelMock.object,
          prev: {},
          rulesetOrId: "test",
        });
        nativePlatformMock.verify(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
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
        nativePlatformMock.verify(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      });

      it("uses manager's `activeLocale` for comparison", async () => {
        manager.activeLocale = "test";

        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.CompareHierarchies,
          params: {
            prevRulesetId: "test",
            prevRulesetVariables: "[]",
            currRulesetId: "test",
            currRulesetVariables: "[]",
            locale: "test",
            expandedNodeKeys: "[]",
          },
        };

        // what the addon returns
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [],
        };
        setup(addonResponse);

        // test
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: "test",
          },
          rulesetOrId: "test",
          expandedNodeKeys: [],
        };
        const result = await manager.compareHierarchies(options);
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
      });

      it("uses `locale` from options for comparison", async () => {
        manager.activeLocale = "manager's locale";

        // what the addon receives
        const expectedParams = {
          requestId: NativePlatformRequestTypes.CompareHierarchies,
          params: {
            prevRulesetId: "test",
            prevRulesetVariables: "[]",
            currRulesetId: "test",
            currRulesetVariables: "[]",
            locale: "options locale",
            expandedNodeKeys: "[]",
          },
        };

        // what the addon returns
        const addonResponse: HierarchyCompareInfoJSON = {
          changes: [],
        };
        setup(addonResponse);

        // test
        const options: HierarchyCompareOptions<IModelDb, NodeKey> = {
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: "test",
          },
          rulesetOrId: "test",
          locale: "options locale",
          expandedNodeKeys: [],
        };
        const result = await manager.compareHierarchies(options);
        verifyWithExpectedResult(result, HierarchyCompareInfo.fromJSON(addonResponse), expectedParams);
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
          sources: [{
            selectClassInfo: "0x123",
            isSelectPolymorphic: true,
            pathToPrimaryClass: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
            pathFromInputToSelectClass: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
            relatedPropertyPaths: [[{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }]],
            navigationPropertyClasses: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
            relatedInstanceClasses: [{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }],
            relatedInstancePaths: [[{ sourceClassInfo: "0x123", relationshipInfo: "0x456", isForwardRelationship: true, targetClassInfo: "0x789" }]],
          } as SelectClassInfoJSON<Id64String>],
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
            SelectClassInfo.toCompressedJSON(createTestSelectClassInfo({
              pathFromInputToSelectClass: createTestRelationshipPath(1),
              relatedPropertyPaths: [createTestRelationshipPath(1)],
              navigationPropertyClasses: [createTestRelatedClassInfo()],
              relatedInstancePaths: [createTestRelationshipPath(1)],
            }), classesMap),
          ],
          categories: [CategoryDescription.toJSON(createTestCategoryDescription({ name: "test-category" }))],
          fields: [{
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
            properties: [{
              property: {
                classInfo: testClassInfo.id,
                name: faker.random.word(),
                type: "string",
                enumerationInfo: {
                  choices: [{
                    label: faker.random.words(),
                    value: faker.random.uuid(),
                  }, {
                    label: faker.random.words(),
                    value: faker.random.uuid(),
                  }],
                  isStrict: faker.random.boolean(),
                },
              } as PropertyInfoJSON<Id64String>,
              relatedClassPath: [],
            } as PropertyJSON<Id64String>],
          } as PropertiesFieldJSON<Id64String>, {
            name: "Complex array of structs property field",
            category: "test-category",
            label: faker.random.words(),
            type: {
              typeName: "string[]",
              valueFormat: "Array",
              memberType: {
                typeName: "SomeClass",
                valueFormat: "Struct",
                members: [{
                  name: faker.random.word(),
                  label: faker.random.words(),
                  type: {
                    typeName: "string",
                    valueFormat: "Primitive",
                  },
                }, {
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
                }],
              } as StructTypeDescription,
            } as ArrayTypeDescription,
            isReadonly: faker.random.boolean(),
            priority: faker.random.number(),
            properties: [{
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
            } as PropertyJSON<Id64String>],
          } as PropertiesFieldJSON<Id64String>, {
            name: "Nested content field",
            category: "test-category",
            label: faker.random.words(),
            type: {
              typeName: faker.random.word(),
              valueFormat: "Struct",
              members: [{
                name: faker.random.word(),
                label: faker.random.words(),
                type: {
                  typeName: "string",
                  valueFormat: "Primitive",
                },
              }],
            } as StructTypeDescription,
            contentClassInfo: testClassInfo.id,
            pathToPrimaryClass: createRandomRelationshipPath(1).map((step) => RelatedClassInfo.toCompressedJSON(step, classesMap)),
            nestedFields: [{
              name: "Simple property field",
              category: "test-category",
              label: faker.random.words(),
              type: {
                typeName: "string",
                valueFormat: "Primitive",
              },
              isReadonly: faker.random.boolean(),
              priority: faker.random.number(),
            } as FieldJSON],
            isReadonly: faker.random.boolean(),
            priority: faker.random.number(),
            autoExpand: faker.random.boolean(),
          } as NestedContentFieldJSON<Id64String>],
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

    describe("getContent", () => {

      it("returns content", async () => {
        // what the addon receives
        const keys = new KeySet([createRandomECInstancesNodeKey(), createRandomECInstanceKey()]);
        const fieldName = faker.random.word();
        const category = createTestCategoryDescription();
        const descriptor = createTestContentDescriptor({
          categories: [category],
          fields: [createTestSimpleContentField({
            category,
            name: fieldName,
          })],
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
          contentSet: [{
            primaryKeys: [createRandomECInstanceKeyJSON()],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: createRandomLabelDefinitionJSON(),
            imageId: faker.random.uuid(),
            values: {
              [fieldName]: faker.random.words(),
            },
            displayValues: {
              [fieldName]: faker.random.words(),
            },
            mergedFieldNames: [],
          } as ItemJSON],
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
            fields: [createTestSimpleContentField({
              category,
              name: fieldName,
            })],
          }).toJSON(),
          contentSet: [{
            primaryKeys: [createRandomECInstanceKeyJSON()],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: createRandomLabelDefinitionJSON(),
            imageId: faker.random.uuid(),
            values: {
              [fieldName]: faker.random.words(),
            },
            displayValues: {
              [fieldName]: faker.random.words(),
            },
            mergedFieldNames: [],
          } as ItemJSON],
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
            fields: [createTestSimpleContentField({
              category,
              name: fieldName,
            })],
          }).toJSON(),
          contentSet: [{
            primaryKeys: [createRandomECInstanceKeyJSON()],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: createRandomLabelDefinitionJSON(),
            imageId: faker.random.uuid(),
            values: {
              [fieldName]: faker.random.words(),
            },
            displayValues: {
              [fieldName]: faker.random.words(),
            },
            mergedFieldNames: [],
          } as ItemJSON],
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
          contentSet: [{
            primaryKeys: [createRandomECInstanceKeyJSON()],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: createRandomLabelDefinitionJSON(),
            imageId: faker.random.uuid(),
            values: {
              [fieldName]: faker.random.words(),
            },
            displayValues: {
              [fieldName]: faker.random.words(),
            },
            mergedFieldNames: [],
          } as ItemJSON],
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
          items: [{
            displayValue: "test",
            groupedRawValues: ["test"],
          }],
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

      function setupIModelForElementIds(imodel: moq.IMock<IModelDb>, idsByClass: Map<string, string[]>, idsCount: number) {
        imodel.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns(() => idsCount);
        imodel.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns(() => idsByClass);
      }

      it("returns multiple elements properties", async () => {
        // what the addon receives
        const elementKeys = [{ className: "TestSchema:TestClass", id: "0x123" }, { className: "TestSchema:TestClass", id: "0x124" }];
        setupIModelForElementIds(imodelMock, new Map<string, string[]>([["TestSchema:TestClass", ["0x123", "0x124"]]]), 2);
        elementKeys.forEach((key) => setupIModelForElementKey(imodelMock, key));

        const expectedContentParams = {
          requestId: NativePlatformRequestTypes.GetContent,
          params: {
            keys: getKeysForContentRequest(new KeySet(elementKeys)),
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
          ],
        ).toJSON();
        setup(addonContentResponse);

        // test
        const options: MultiElementPropertiesRequestOptions<IModelDb> = {
          imodel: imodelMock.object,
          elementClasses: ["TestSchema:TestClass"],
        };
        const expectedResponse = {
          total: 2,
          items: [
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
          ],
        };
        const result = await manager.getElementProperties(options);
        verifyMockRequest(expectedContentParams);
        expect(result).to.deep.eq(expectedResponse);
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
        const addonResponse = createRandomLabelDefinitionJSON();
        setup(addonResponse);

        // test
        const options: DisplayLabelRequestOptions<IModelDb, InstanceKey> = {
          imodel: imodelMock.object,
          key,
        };
        const result = await manager.getDisplayLabelDefinition(options);
        verifyWithExpectedResult(result, addonResponse, expectedParams);
      });

    });

    describe("getDisplayLabelDefinitions", () => {

      it("returns labels from list content", async () => {
        // what the addon receives
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        const labels = [createRandomLabelDefinitionJSON(), createRandomLabelDefinitionJSON()];
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
          contentSet: [1, 0].map((index): ItemJSON => ({
            primaryKeys: [keys[index]],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: labels[index],
            imageId: faker.random.uuid(),
            values: {},
            displayValues: {},
            mergedFieldNames: [],
          })),
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
        const label = createRandomLabelDefinitionJSON();
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
          contentSet: [{
            primaryKeys: [concreteClassKey],
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: label,
            imageId: faker.random.uuid(),
            values: {},
            displayValues: {},
            mergedFieldNames: [],
          }],
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
          contentSet: [{
            primaryKeys: [createRandomECInstanceKeyJSON()], // different than input key
            classInfo: createRandomECClassInfoJSON(),
            labelDefinition: createRandomLabelDefinitionJSON(),
            imageId: faker.random.uuid(),
            values: {},
            displayValues: {},
            mergedFieldNames: [],
          }],
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
      nativePlatformMock.setup(async (x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString())).returns(() => (undefined as any));
      const options: HierarchyRequestOptions<IModelDb, NodeKey> = {
        imodel: imodelMock.object,
        rulesetOrId: testData.rulesetOrId,
      };
      return expect(manager.getNodesCount(options)).to.eventually.be.rejectedWith(Error);
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

    it("computes selection using `SelectionScopesHelper`", async () => {
      const ids = [createRandomId()];
      const resultKeys = new KeySet();
      const stub = sinon.stub(SelectionScopesHelper, "computeSelection").resolves(resultKeys);
      const result = await manager.computeSelection({ imodel: imodel.object, ids, scopeId: "test scope" });
      expect(stub).to.be.calledOnceWith({ imodel: imodel.object }, ids, "test scope");
      expect(result).to.eq(resultKeys);
    });

  });

});
