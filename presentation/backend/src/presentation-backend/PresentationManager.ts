/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as hash from "object-hash";
import * as path from "path";
import { ClientRequestContext, Id64String, Logger } from "@bentley/bentleyjs-core";
import { BriefcaseDb, IModelDb, IModelJsNative, IpcHost } from "@bentley/imodeljs-backend";
import { FormatProps } from "@bentley/imodeljs-quantity";
import {
  Content, ContentDescriptorRequestOptions, ContentFlags, ContentRequestOptions, DefaultContentDisplayTypes, Descriptor, DescriptorOverrides,
  DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup, DistinctValuesRequestOptions, ExtendedContentRequestOptions,
  ExtendedHierarchyRequestOptions, getLocalesDirectory, HierarchyCompareInfo, HierarchyRequestOptions, InstanceKey, KeySet, LabelDefinition,
  LabelRequestOptions, Node, NodeKey, NodePathElement, Paged, PagedResponse, PartialHierarchyModification, PresentationDataCompareOptions,
  PresentationError, PresentationStatus, PresentationUnitSystem, RequestPriority, Ruleset, SelectionInfo, SelectionScope,
  SelectionScopeRequestOptions,
} from "@bentley/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { PRESENTATION_BACKEND_ASSETS_ROOT, PRESENTATION_COMMON_ASSETS_ROOT } from "./Constants";
import { createDefaultNativePlatform, NativePlatformDefinition, NativePlatformRequestTypes } from "./NativePlatform";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { SelectionScopesHelper } from "./SelectionScopesHelper";
import { UpdatesTracker } from "./UpdatesTracker";
import { BackendDiagnosticsOptions, getElementKey, WithClientRequestContext } from "./Utils";
import { PresentationIpcHandler } from "./PresentationIpcHandler";

/**
 * Presentation manager working mode.
 * @public
 */
export enum PresentationManagerMode {
  /**
   * Presentation manager assumes iModels are opened in read-only mode and avoids doing some work
   * related to reacting to changes in iModels.
   */
  ReadOnly,

  /**
   * Presentation manager assumes iModels are opened in read-write mode and it may need to
   * react to changes. This involves some additional work and gives slightly worse performance.
   */
  ReadWrite,
}

/**
 * Presentation hierarchy cache mode.
 * @beta
 */
export enum HierarchyCacheMode {
  /**
   * Hierarchy cache is created in memory.
   */
  Memory = "memory",
  /**
   * Hierarchy cache is created on disk. In this mode hierarchy cache is persisted between iModel
   * openings.
   */
  Disk = "disk",
  /**
   * Hierarchy cache is created on disk. In this mode everything is cached in memory while creating hierarchy level
   * and persisted in disk cache when whole hierarchy level is created.
   */
  Hybrid = "hybrid",
}

/**
 * Configuration for hierarchy cache.
 * @beta
 */
export type HierarchyCacheConfig = MemoryHierarchyCacheConfig | DiskHierarchyCacheConfig | HybridCacheConfig;

/**
 * Base interface for all [[HierarchyCacheConfig]] implementations.
 * @beta
 */
export interface HierarchyCacheConfigBase {
  mode: HierarchyCacheMode;
}

/**
 * Configuration for memory hierarchy cache.
 * @beta
 */
export interface MemoryHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Memory;
}

/**
 * Configuration for disk hierarchy cache.
 * @beta
 */
export interface DiskHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Disk;
  /**
   * A directory for Presentation hierarchy cache. If not set hierarchy cache is created
   * along side iModel.
   */
  directory?: string;
}

/**
 * Configuration for hybrid hierarchy cache.
 * @beta
 */
export interface HybridCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Hybrid;
  /**
   * Configuration for disk cache used to persist hierarchy.
   */
  disk?: DiskHierarchyCacheConfig;
}

/**
 * A data structure that associates some unit systems with a format. The associations are used for
 * assigning default unit formats for specific phenomenons (see [[PresentationManagerProps.defaultFormats]])
 * @alpha
 */
export interface UnitSystemFormat {
  unitSystems: PresentationUnitSystem[];
  format: FormatProps;
}

/**
 * Properties that can be used to configure [[PresentationManager]]
 * @public
 */
export interface PresentationManagerProps {
  /**
   * Path overrides for presentation assets. Need to be overriden by application if it puts these assets someplace else than the default.
   *
   * By default paths to asset directories are determined during the call of [[Presentation.initialize]] using this algorithm:
   *
   * - for `presentation-backend` assets:
   *
   *   - if path of `.js` file that contains [[PresentationManager]] definition contains "presentation-backend", assume the package is in `node_modules` and the directory structure is:
   *     - `assets/*\*\/*`
   *     - `presentation-backend/{presentation-backend source files}`
   *
   *     which means the assets can be found through a relative path `../assets/` from the JS file being executed.
   *
   * - for `presentation-common` assets:
   *
   *   - if path of `.js` files of `presentation-common` package contain "presentation-common", assume the package is in `node_modules` and the directory structure is:
   *     - `assets/*\*\/*`
   *     - `presentation-common/{presentation-common source files}`
   *
   *     which means the assets can be found through a relative path `../assets/` from the package's source files.
   *
   * - in both cases, if we determine that source files are not in `node_modules`, assume the backend is webpacked into a single file with assets next to it:
   *   - `assets/*\*\/*`
   *   - `{source file being executed}.js`
   *
   *   which means the assets can be found through a relative path `./assets/` from the `{source file being executed}`.
   *
   * The overrides can be specified as a single path (when assets of both `presentation-backend` and `presentation-common` packages are merged into a single directory) or as an object with two separate paths for each package.
   */
  presentationAssetsRoot?: string | {
    /** Path to `presentation-backend` assets */
    backend: string;
    /** Path to `presentation-common` assets */
    common: string;
  };

  /**
   * A list of directories containing application's presentation rulesets.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing application's supplemental presentation rulesets.
   */
  supplementalRulesetDirectories?: string[];

  /**
   * A list of directories containing application's locale-specific localized
   * string files (in simplified i18next v3 format)
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;

  /**
   * Sets the active unit system to use for formatting property values with
   * units. Default presentation units are used if this is not specified. The active unit
   * system can later be changed through [[PresentationManager]] or overriden for each request
   *
   * @alpha
   */
  activeUnitSystem?: PresentationUnitSystem;

  /**
   * Should schemas preloading be enabled. If true, presentation manager listens
   * for `BriefcaseDb.onOpened` event and force pre-loads all ECSchemas.
   */
  enableSchemasPreload?: boolean;

  /**
   * A map of 'priority' to 'number of slots allocated for simultaneously running tasks'
   * where 'priority' is the highest task priority that can allocate a slot. Example:
   * ```ts
   * {
   *   100: 1,
   *   500: 2,
   * }
   * ```
   * The above means there's one slot for tasks that are at most of 100 priority and there are
   * 2 slots for tasks that have at most of 500 priority. Higher priority tasks may allocate lower
   * priority slots, so a task of 400 priority could take all 3 slots.
   *
   * Configuring this map provides ability to choose how many tasks of what priority can run simultaneously.
   * E.g. in the above example only 1 task can run simultaneously if it's priority is less than 100 even though
   * we have lots of them queued. This leaves 2 slots for higher priority tasks which can be handled without
   * having to wait for the lower priority slot to free up.
   *
   * Defaults to
   * ```ts
   * {
   *   [RequestPriority.Preload]: 1,
   *   [RequestPriority.Max]: 1,
   * }
   * ```
   *
   * **Warning:** Tasks with priority higher than maximum priority in the slots allocation map will never
   * be handled.
   */
  taskAllocationsMap?: { [priority: number]: number };

  /**
   * Presentation manager working mode. Backends that use iModels in read-write mode should
   * use `ReadWrite`, others might want to set to `ReadOnly` for better performance.
   *
   * Defaults to `ReadWrite`.
   */
  mode?: PresentationManagerMode;

  /**
   * The interval (in milliseconds) used to poll for presentation data changes. Only has
   * effect in read-write mode (see [[mode]]).
   *
   * @alpha
   */
  updatesPollInterval?: number;

  /**
   * A configuration for Presentation hierarchy cache.
   * @beta
   */
  cacheConfig?: HierarchyCacheConfig;

  /** @alpha */
  contentCacheSize?: number;

  /**
   * A map of default unit formats to use for formatting properties that don't have a presentation format
   * in requested unit system.
   *  @alpha */
  defaultFormats?: {
    [phenomenon: string]: UnitSystemFormat;
  };

  /**
   * Use [SQLite's Memory-Mapped I/O](https://sqlite.org/mmap.html) for worker connections. This mode improves performance of handling
   * requests with high I/O intensity, e.g. filtering large tables on non-indexed columns. No downsides have been noticed.
   *
   * Set to a falsy value to turn off. `true` for memory-mapping the whole iModel. Number value for memory-mapping the specified amount of bytes.
   *
   * @alpha
   */
  useMmap?: boolean | number;

  /**
   * An identifier which helps separate multiple presentation managers. It's
   * mostly useful in tests where multiple presentation managers can co-exist
   * and try to share the same resources, which we don't want. With this identifier
   * set, managers put their resources into id-named subdirectories.
   *
   * @internal
   */
  id?: string;

  /** @internal */
  addon?: NativePlatformDefinition;
}

/**
 * Backend Presentation manager which pulls the presentation data from
 * an iModel using native platform.
 *
 * @public
 */
export class PresentationManager {

  private _props: PresentationManagerProps;
  private _nativePlatform?: NativePlatformDefinition;
  private _rulesets: RulesetManager;
  private _isOneFrontendPerBackend: boolean;
  private _isDisposed: boolean;
  private _disposeIModelOpenedListener?: () => void;
  private _disposeIpcHandler?: () => void;
  private _updatesTracker?: UpdatesTracker;

  /** Get / set active locale used for localizing presentation data */
  public activeLocale: string | undefined;

  /** Get / set active unit system used to format property values with units */
  public activeUnitSystem: PresentationUnitSystem | undefined;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: PresentationManagerProps) {
    this._props = props ?? {};
    this._isDisposed = false;

    const mode = props?.mode ?? PresentationManagerMode.ReadWrite;
    const isChangeTrackingEnabled = (mode === PresentationManagerMode.ReadWrite && !!props?.updatesPollInterval);

    if (props && props.addon) {
      this._nativePlatform = props.addon;
    } else {
      const nativePlatformImpl = createDefaultNativePlatform({
        id: this._props.id ?? "",
        localeDirectories: createLocaleDirectoryList(props),
        taskAllocationsMap: createTaskAllocationsMap(props),
        mode,
        isChangeTrackingEnabled,
        cacheConfig: createCacheConfig(this._props.cacheConfig),
        contentCacheSize: this._props.contentCacheSize,
        defaultFormats: this._props.defaultFormats,
        useMmap: this._props.useMmap,
      });
      this._nativePlatform = new nativePlatformImpl();
    }

    this.setupRulesetDirectories(props);
    if (props) {
      this.activeLocale = props.activeLocale;
      this.activeUnitSystem = props.activeUnitSystem;
    }

    this._rulesets = new RulesetManagerImpl(this.getNativePlatform);

    if (this._props.enableSchemasPreload)
      this._disposeIModelOpenedListener = BriefcaseDb.onOpened.addListener(this.onIModelOpened);

    this._isOneFrontendPerBackend = IpcHost.isValid;

    // TODO: updates tracker should only be created for native app backends, but that's a breaking
    // change - make it when moving to 3.0
    if (isChangeTrackingEnabled) {
      this._updatesTracker = UpdatesTracker.create({
        nativePlatformGetter: this.getNativePlatform,
        pollInterval: props!.updatesPollInterval!, // set if `isChangeTrackingEnabled == true`
      });
    }

    if (IpcHost.isValid) {
      this._disposeIpcHandler = PresentationIpcHandler.register();
    }
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    if (this._nativePlatform) {
      this.getNativePlatform().dispose();
      this._nativePlatform = undefined;
    }

    if (this._disposeIModelOpenedListener)
      this._disposeIModelOpenedListener();

    if (this._updatesTracker) {
      this._updatesTracker.dispose();
      this._updatesTracker = undefined;
    }

    if (this._disposeIpcHandler)
      this._disposeIpcHandler();

    this._isDisposed = true;
  }

  /** Properties used to initialize the manager */
  public get props() { return this._props; }

  /**
   * Get rulesets manager
   */
  public rulesets(): RulesetManager { return this._rulesets; }

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get variables manager for
   */
  public vars(rulesetId: string): RulesetVariablesManager {
    return new RulesetVariablesManagerImpl(this.getNativePlatform, rulesetId);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onIModelOpened = (requestContext: ClientRequestContext, imodel: BriefcaseDb) => {
    requestContext.enter();
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.getNativePlatform().forceLoadSchemas(imodelAddon);
  };

  /** @internal */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new PresentationError(PresentationStatus.UseAfterDisposal, "Attempting to use Presentation manager after disposal");
    return this._nativePlatform!;
  };

  private setupRulesetDirectories(props?: PresentationManagerProps) {
    const supplementalRulesetDirectories = [path.join(getPresentationBackendAssetsRoot(props?.presentationAssetsRoot), "supplemental-presentation-rules")];
    if (props && props.supplementalRulesetDirectories) {
      props.supplementalRulesetDirectories.forEach((dir) => {
        if (-1 === supplementalRulesetDirectories.indexOf(dir))
          supplementalRulesetDirectories.push(dir);
      });
    }
    this.getNativePlatform().setupSupplementalRulesetDirectories(supplementalRulesetDirectories);
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
  }

  private getRulesetIdObject(rulesetOrId: Ruleset | string): { uniqueId: string, parts: { id: string, hash?: string } } {
    if (typeof rulesetOrId === "object") {
      if (this._isOneFrontendPerBackend) {
        // in case of native apps we don't have to enforce ruleset id uniqueness, since there's ony one
        // frontend and it's up to the frontend to make sure rulesets are unique
        return {
          uniqueId: rulesetOrId.id,
          parts: { id: rulesetOrId.id },
        };
      }
      const hashedId = hash.MD5(rulesetOrId);
      return {
        uniqueId: `${rulesetOrId.id}-${hashedId}`,
        parts: {
          id: rulesetOrId.id,
          hash: hashedId,
        },
      };
    }
    return { uniqueId: rulesetOrId, parts: { id: rulesetOrId } };
  }

  /** @internal */
  public getRulesetId(rulesetOrId: Ruleset | string) {
    return this.getRulesetIdObject(rulesetOrId).uniqueId;
  }

  private ensureRulesetRegistered(rulesetOrId: Ruleset | string): string {
    if (typeof rulesetOrId === "object") {
      const rulesetWithNativeId = { ...rulesetOrId, id: this.getRulesetId(rulesetOrId) };
      return this.rulesets().add(rulesetWithNativeId).id;
    }
    return rulesetOrId;
  }

  /** Registers given ruleset and replaces the ruleset with its ID in the resulting object */
  private registerRuleset<TOptions extends { rulesetOrId: Ruleset | string }>(options: TOptions) {
    const { rulesetOrId, ...strippedOptions } = options;
    const registeredRulesetId = this.ensureRulesetRegistered(rulesetOrId);
    return { rulesetId: registeredRulesetId, strippedOptions };
  }

  /**
   * Retrieves nodes and node count
   * @param requestContext Client request context
   * @param requestOptions Options for the request
   * @param parentKey Key of the parentNode
   * @return A promise object that returns either a node response containing nodes and node count on success or an error string on error
   * @deprecated Use `getNodes` and `getNodesCount` separately
   */
  public async getNodesAndCount(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: NodeKey) {
    const options = { ...requestOptions, requestContext, parentKey };
    const [count, nodes] = await Promise.all([
      this.getNodesCount(options),
      this.getNodes(options),
    ]);
    return { nodes, count };
  }

  /**
   * Retrieves nodes
   * @deprecated Use an overload with [[ExtendedHierarchyRequestOptions]]
   */
  public async getNodes(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: NodeKey): Promise<Node[]>;
  /**
   * Retrieves nodes
   * @beta
   */
  public async getNodes(requestOptions: WithClientRequestContext<Paged<ExtendedHierarchyRequestOptions<IModelDb, NodeKey>>>): Promise<Node[]>;
  public async getNodes(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<Paged<ExtendedHierarchyRequestOptions<IModelDb, NodeKey>>>, deprecatedRequestOptions?: Paged<HierarchyRequestOptions<IModelDb>>, deprecatedParentKey?: NodeKey): Promise<Node[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getNodes({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, parentKey: deprecatedParentKey });
    }
    const { rulesetId, strippedOptions: { parentKey, ...strippedOptions } } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildren : NativePlatformRequestTypes.GetRootNodes,
      rulesetId,
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return this.request(params, Node.listReviver);
  }

  /**
   * Retrieves nodes count
   * @deprecated Use an overload with [[ExtendedHierarchyRequestOptions]]
   */
  public async getNodesCount(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, parentKey?: NodeKey): Promise<number>;
  /**
   * Retrieves nodes count
   * @beta
   */
  public async getNodesCount(requestOptions: WithClientRequestContext<ExtendedHierarchyRequestOptions<IModelDb, NodeKey>>): Promise<number>;
  public async getNodesCount(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<ExtendedHierarchyRequestOptions<IModelDb, NodeKey>>, deprecatedRequestOptions?: HierarchyRequestOptions<IModelDb>, deprecatedParentKey?: NodeKey): Promise<number> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getNodesCount({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, parentKey: deprecatedParentKey });
    }
    const { rulesetId, strippedOptions: { parentKey, ...strippedOptions } } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildrenCount : NativePlatformRequestTypes.GetRootNodesCount,
      rulesetId,
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return this.request(params);
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified instance key paths. Intersecting paths will be merged.
   * @deprecated Use an overload with one argument
   */
  public async getNodePaths(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]>;
  /**
   * Retrieves paths from root nodes to children nodes according to specified instance key paths. Intersecting paths will be merged.
   * TODO: Return results in pages
   * @beta
   */
  public async getNodePaths(requestOptions: WithClientRequestContext<HierarchyRequestOptions<IModelDb> & { paths: InstanceKey[][], markedIndex: number }>): Promise<NodePathElement[]>;
  public async getNodePaths(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<HierarchyRequestOptions<IModelDb> & { paths: InstanceKey[][], markedIndex: number }>, deprecatedRequestOptions?: HierarchyRequestOptions<IModelDb>, deprecatedPaths?: InstanceKey[][], deprecatedMarkedIndex?: number): Promise<NodePathElement[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getNodePaths({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, paths: deprecatedPaths!, markedIndex: deprecatedMarkedIndex! });
    }
    const { rulesetId, strippedOptions } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetNodePaths,
      rulesetId,
      ...strippedOptions,
      paths: strippedOptions.paths.map((p) => p.map((s) => InstanceKey.toJSON(s))),
    };
    return this.request(params, NodePathElement.listReviver);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @deprecated Use an overload with one argument
   */
  public async getFilteredNodePaths(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, filterText: string): Promise<NodePathElement[]>;
  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * TODO: Return results in pages
   * @beta
   */
  public async getFilteredNodePaths(requestOptions: WithClientRequestContext<HierarchyRequestOptions<IModelDb> & { filterText: string }>): Promise<NodePathElement[]>;
  public async getFilteredNodePaths(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<HierarchyRequestOptions<IModelDb> & { filterText: string }>, deprecatedRequestOptions?: HierarchyRequestOptions<IModelDb>, deprecatedFilterText?: string): Promise<NodePathElement[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getFilteredNodePaths({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, filterText: deprecatedFilterText! });
    }
    const { rulesetId, strippedOptions } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetFilteredNodePaths,
      rulesetId,
      ...strippedOptions,
    };
    return this.request(params, NodePathElement.listReviver);
  }

  /**
   * Loads the whole hierarchy with the specified parameters
   * @return A promise object that resolves when the hierarchy is fully loaded
   * @alpha Hierarchy loading performance needs to be improved before this becomes publicly available.
   * @deprecated Use an overload with one argument
   */
  public async loadHierarchy(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>): Promise<void>;
  /**
   * Loads the whole hierarchy with the specified parameters
   * @return A promise object that resolves when the hierarchy is fully loaded
   * @alpha Hierarchy loading performance needs to be improved before this becomes publicly available.
   */
  public async loadHierarchy(requestOptions: WithClientRequestContext<HierarchyRequestOptions<IModelDb>>): Promise<void>;
  public async loadHierarchy(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<HierarchyRequestOptions<IModelDb>>, deprecatedRequestOptions?: HierarchyRequestOptions<IModelDb>): Promise<void> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.loadHierarchy({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions });
    }
    const { rulesetId, strippedOptions } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.LoadHierarchy,
      rulesetId,
      ...strippedOptions,
    };
    const start = new Date();
    await this.request(params);
    Logger.logInfo(PresentationBackendLoggerCategory.PresentationManager, `Loading full hierarchy for `
      + `iModel "${requestContextOrOptions.imodel.iModelId}" and ruleset "${rulesetId}" `
      + `completed in ${((new Date()).getTime() - start.getTime()) / 1000} s.`);
  }

  /**
   * Retrieves the content descriptor which can be used to get content.
   * @deprecated Use an overload with [[ContentDescriptorRequestOptions]]
   */
  public async getContentDescriptor(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: KeySet, selection: SelectionInfo | undefined): Promise<Descriptor | undefined>;
  /**
   * Retrieves the content descriptor which can be used to get content
   * @beta
   */
  public async getContentDescriptor(requestOptions: WithClientRequestContext<ContentDescriptorRequestOptions<IModelDb, KeySet>>): Promise<Descriptor | undefined>;
  public async getContentDescriptor(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<ContentDescriptorRequestOptions<IModelDb, KeySet>>, deprecatedRequestOptions?: ContentRequestOptions<IModelDb>, deprecatedDisplayType?: string, deprecatedKeys?: KeySet, deprecatedSelection?: SelectionInfo): Promise<Descriptor | undefined> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getContentDescriptor({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, displayType: deprecatedDisplayType!, keys: deprecatedKeys!, selection: deprecatedSelection });
    }
    const { rulesetId, strippedOptions } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContentDescriptor,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestContextOrOptions.imodel, requestContextOrOptions.keys).toJSON(),
    };
    return this.request(params, Descriptor.reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @deprecated Use an overload with [[ExtendedContentRequestOptions]]
   */
  public async getContentSetSize(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<number>;
  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @beta
   */
  public async getContentSetSize(requestOptions: WithClientRequestContext<ExtendedContentRequestOptions<IModelDb, Descriptor, KeySet>>): Promise<number>;
  public async getContentSetSize(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<ExtendedContentRequestOptions<IModelDb, Descriptor, KeySet>>, deprecatedRequestOptions?: ContentRequestOptions<IModelDb>, deprecatedDescriptorOrOverrides?: Descriptor | DescriptorOverrides, deprecatedKeys?: KeySet): Promise<number> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getContentSetSize({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, descriptor: deprecatedDescriptorOrOverrides!, keys: deprecatedKeys! });
    }
    const { rulesetId, strippedOptions: { descriptor, ...strippedOptions } } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSetSize,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestContextOrOptions.imodel, requestContextOrOptions.keys).toJSON(),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return this.request(params);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @deprecated Use an overload with [[ExtendedContentRequestOptions]]
   */
  public async getContent(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<Content | undefined>;
  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @beta
   */
  public async getContent(requestOptions: WithClientRequestContext<Paged<ExtendedContentRequestOptions<IModelDb, Descriptor, KeySet>>>): Promise<Content | undefined>;
  public async getContent(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<Paged<ExtendedContentRequestOptions<IModelDb, Descriptor, KeySet>>>, deprecatedRequestOptions?: Paged<ContentRequestOptions<IModelDb>>, deprecatedDescriptorOrOverrides?: Descriptor | DescriptorOverrides, deprecatedKeys?: KeySet): Promise<Content | undefined> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getContent({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, descriptor: deprecatedDescriptorOrOverrides!, keys: deprecatedKeys! });
    }
    const { rulesetId, strippedOptions: { descriptor, ...strippedOptions } } = this.registerRuleset(requestContextOrOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContent,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestContextOrOptions.imodel, requestContextOrOptions.keys).toJSON(),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return this.request(params, Content.reviver);
  }

  /**
   * Retrieves the content and content size based on supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          Options for thr request.
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for
   * @return A promise object that returns either content and content set size on success or an error string on error.
   * @deprecated Use `getContent` and `getContentSetSize` separately
   */
  public async getContentAndSize(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet) {
    const [size, content] = await Promise.all<number, Content | undefined>([
      this.getContentSetSize(requestContext, requestOptions, descriptorOrOverrides, keys), // eslint-disable-line deprecation/deprecation
      this.getContent(requestContext, requestOptions, descriptorOrOverrides, keys), // eslint-disable-line deprecation/deprecation
    ]);
    return { content, size };
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @param fieldName            Name of the field from which to take values.
   * @param maximumValueCount    Maximum numbers of values that can be returned. Unlimited if 0.
   * @return A promise object that returns either distinct values on success or an error string on error.
   */
  public async getDistinctValues(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptor: Descriptor | DescriptorOverrides, keys: KeySet, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    const { rulesetId, strippedOptions } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetDistinctValues,
      requestContext,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
      fieldName,
      maximumValueCount,
    };
    return this.request(params);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestContext      The client request context
   * @param requestOptions      Options for the request
   * @return A promise object that returns either distinct values on success or an error string on error.
   * @alpha
   */
  public async getPagedDistinctValues(requestOptions: WithClientRequestContext<DistinctValuesRequestOptions<IModelDb, Descriptor, KeySet>>): Promise<PagedResponse<DisplayValueGroup>> {
    const { rulesetId, strippedOptions } = this.registerRuleset(requestOptions);
    const { descriptor, keys, ...strippedOptionsNoDescriptorAndKeys } = strippedOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetPagedDistinctValues,
      rulesetId,
      ...strippedOptionsNoDescriptorAndKeys,
      keys: getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    const reviver = (key: string, value: any) => {
      return key === "" ? {
        total: value.total,
        items: value.items.map(DisplayValueGroup.fromJSON),
      } : value;
    };
    return this.request(params, reviver);
  }

  /**
   * Retrieves display label definition of specific item
   * @deprecated Use an overload with [[DisplayLabelRequestOptions]]
   */
  public async getDisplayLabelDefinition(requestContext: ClientRequestContext, requestOptions: LabelRequestOptions<IModelDb>, key: InstanceKey): Promise<LabelDefinition>;
  /**
   * Retrieves display label definition of specific item
   * @beta
   */
  public async getDisplayLabelDefinition(requestOptions: WithClientRequestContext<DisplayLabelRequestOptions<IModelDb, InstanceKey>>): Promise<LabelDefinition>;
  public async getDisplayLabelDefinition(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<DisplayLabelRequestOptions<IModelDb, InstanceKey>>, deprecatedRequestOptions?: LabelRequestOptions<IModelDb>, deprecatedKey?: InstanceKey): Promise<LabelDefinition> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getDisplayLabelDefinition({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, key: deprecatedKey! });
    }
    const params = {
      requestId: NativePlatformRequestTypes.GetDisplayLabel,
      ...requestContextOrOptions,
      key: InstanceKey.toJSON(requestContextOrOptions.key),
    };
    return this.request(params, LabelDefinition.reviver);
  }

  /**
   * Retrieves display labels definitions of specific items
   * @deprecated Use an overload with [[DisplayLabelsRequestOptions]]
   */
  public async getDisplayLabelDefinitions(requestContext: ClientRequestContext, requestOptions: LabelRequestOptions<IModelDb>, instanceKeys: InstanceKey[]): Promise<LabelDefinition[]>;
  /**
   * Retrieves display label definitions of specific items
   * @beta
   */
  public async getDisplayLabelDefinitions(requestOptions: WithClientRequestContext<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>): Promise<LabelDefinition[]>;
  public async getDisplayLabelDefinitions(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>, deprecatedRequestOptions?: LabelRequestOptions<IModelDb>, deprecatedInstanceKeys?: InstanceKey[]): Promise<LabelDefinition[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getDisplayLabelDefinitions({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, keys: deprecatedInstanceKeys! });
    }
    const concreteKeys = requestContextOrOptions.keys.map((k) => {
      if (k.className === "BisCore:Element")
        return getElementKey(requestContextOrOptions.imodel, k.id);
      return k;
    }).filter<InstanceKey>((k): k is InstanceKey => !!k);
    const contentRequestOptions: WithClientRequestContext<ExtendedContentRequestOptions<IModelDb, Descriptor, KeySet>> = {
      ...requestContextOrOptions,
      rulesetOrId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
      descriptor: {
        displayType: DefaultContentDisplayTypes.List,
        contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
        hiddenFieldNames: [],
      },
      keys: new KeySet(concreteKeys),
    };
    const content = await this.getContent(contentRequestOptions);
    requestContextOrOptions.requestContext.enter();
    return concreteKeys.map((key) => {
      const item = content ? content.contentSet.find((it) => it.primaryKeys.length > 0 && InstanceKey.compare(it.primaryKeys[0], key) === 0) : undefined;
      if (!item)
        return { displayValue: "", rawValue: "", typeName: "" };
      return item.label;
    });
  }

  /**
   * Retrieves available selection scopes.
   * @deprecated Use an overload with one argument
   */
  public async getSelectionScopes(requestContext: ClientRequestContext, requestOptions: SelectionScopeRequestOptions<IModelDb>): Promise<SelectionScope[]>;
  /**
   * Retrieves available selection scopes.
   * @beta
   */
  public async getSelectionScopes(requestOptions: WithClientRequestContext<SelectionScopeRequestOptions<IModelDb>>): Promise<SelectionScope[]>;
  public async getSelectionScopes(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<SelectionScopeRequestOptions<IModelDb>>, deprecatedRequestOptions?: SelectionScopeRequestOptions<IModelDb>): Promise<SelectionScope[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.getSelectionScopes({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions });
    }
    return SelectionScopesHelper.getSelectionScopes();
  }

  /**
   * Computes selection set based on provided selection scope.
   * @deprecated Use an overload with one argument
   */
  public async computeSelection(requestContext: ClientRequestContext, requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string): Promise<KeySet>;
  /**
   * Computes selection set based on provided selection scope.
   * @beta
   */
  public async computeSelection(requestOptions: WithClientRequestContext<SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[], scopeId: string }>): Promise<KeySet>;
  public async computeSelection(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[], scopeId: string }>, deprecatedRequestOptions?: SelectionScopeRequestOptions<IModelDb>, deprecatedIds?: Id64String[], deprecatedScopeId?: string): Promise<KeySet> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return this.computeSelection({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions, ids: deprecatedIds!, scopeId: deprecatedScopeId! });
    }
    const { requestContext, ids, scopeId, ...requestOptions } = requestContextOrOptions; // eslint-disable-line @typescript-eslint/no-unused-vars
    return SelectionScopesHelper.computeSelection(requestOptions, ids, scopeId);
  }

  private async request<TParams extends { requestContext: ClientRequestContext, diagnostics?: BackendDiagnosticsOptions, requestId: string, imodel: IModelDb, locale?: string, unitSystem?: PresentationUnitSystem }, TResult>(params: TParams, reviver?: (key: string, value: any) => any): Promise<TResult> {
    const { requestContext, requestId, imodel, locale, unitSystem, diagnostics, ...strippedParams } = params;
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const nativeRequestParams: any = {
      requestId,
      params: {
        locale: normalizeLocale(locale ?? this.activeLocale),
        unitSystem: unitSystem ?? this.activeUnitSystem,
        ...strippedParams,
      },
    };

    let diagnosticsListener;
    if (diagnostics) {
      const { listener: tempDiagnosticsListener, ...tempDiagnosticsOptions } = diagnostics;
      diagnosticsListener = tempDiagnosticsListener;
      nativeRequestParams.params.diagnostics = tempDiagnosticsOptions;
    }

    const response = await this.getNativePlatform().handleRequest(imodelAddon, JSON.stringify(nativeRequestParams));
    requestContext.enter();
    diagnosticsListener && response.diagnostics && diagnosticsListener(response.diagnostics);
    return JSON.parse(response.result, reviver);
  }

  /** @deprecated Use an overload with one argument */
  public async compareHierarchies(requestContext: ClientRequestContext, requestOptions: PresentationDataCompareOptions<IModelDb, NodeKey>): Promise<PartialHierarchyModification[]>;
  /**
   * Compares two hierarchies specified in the request options
   * TODO: Return results in pages
   * @beta
   */
  public async compareHierarchies(requestOptions: WithClientRequestContext<PresentationDataCompareOptions<IModelDb, NodeKey>>): Promise<HierarchyCompareInfo>;
  public async compareHierarchies(requestContextOrOptions: ClientRequestContext | WithClientRequestContext<PresentationDataCompareOptions<IModelDb, NodeKey>>, deprecatedRequestOptions?: PresentationDataCompareOptions<IModelDb, NodeKey>): Promise<HierarchyCompareInfo | PartialHierarchyModification[]> {
    if (requestContextOrOptions instanceof ClientRequestContext) {
      return (await this.compareHierarchies({ ...deprecatedRequestOptions!, requestContext: requestContextOrOptions })).changes;
    }

    if (!requestContextOrOptions.prev.rulesetOrId && !requestContextOrOptions.prev.rulesetVariables)
      return { changes: [] };

    const { strippedOptions: { prev, rulesetVariables, ...options } } = this.registerRuleset(requestContextOrOptions);

    const currRulesetId = this.getRulesetIdObject(requestContextOrOptions.rulesetOrId);
    const prevRulesetId = prev.rulesetOrId ? this.getRulesetIdObject(prev.rulesetOrId) : currRulesetId;
    if (prevRulesetId.parts.id !== currRulesetId.parts.id)
      throw new PresentationError(PresentationStatus.InvalidArgument, "Can't compare rulesets with different IDs");

    const currRulesetVariables = rulesetVariables ?? [];
    const prevRulesetVariables = prev.rulesetVariables ?? currRulesetVariables;

    const params = {
      requestId: NativePlatformRequestTypes.CompareHierarchies,
      ...options,
      prevRulesetId: prevRulesetId.uniqueId,
      currRulesetId: currRulesetId.uniqueId,
      prevRulesetVariables: JSON.stringify(prevRulesetVariables),
      currRulesetVariables: JSON.stringify(currRulesetVariables),
      expandedNodeKeys: JSON.stringify(options.expandedNodeKeys ?? []),
    };
    return this.request(params, (key: string, value: any) => ((key === "") ? HierarchyCompareInfo.fromJSON(value) : value));
  }
}

const getKeysForContentRequest = (imodel: IModelDb, keys: KeySet): KeySet => {
  const elementClassName = "BisCore:Element";
  const instanceKeys = keys.instanceKeys;
  if (!instanceKeys.has(elementClassName))
    return keys;

  const elementIds = instanceKeys.get(elementClassName)!;
  const keyset = new KeySet();
  keyset.add(keys);
  elementIds.forEach((elementId) => {
    const concreteKey = getElementKey(imodel, elementId);
    if (concreteKey) {
      keyset.delete({ className: elementClassName, id: elementId });
      keyset.add(concreteKey);
    }
  });
  return keyset;
};

const createContentDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor)
    return descriptorOrOverrides.createDescriptorOverrides();
  return descriptorOrOverrides;
};

const createLocaleDirectoryList = (props?: PresentationManagerProps) => {
  const localeDirectories = [getLocalesDirectory(getPresentationCommonAssetsRoot(props?.presentationAssetsRoot))];
  if (props && props.localeDirectories) {
    props.localeDirectories.forEach((dir) => {
      if (-1 === localeDirectories.indexOf(dir))
        localeDirectories.push(dir);
    });
  }
  return localeDirectories;
};

const createTaskAllocationsMap = (props?: PresentationManagerProps) => {
  if (props && props.taskAllocationsMap)
    return props.taskAllocationsMap;

  // by default we allocate one slot for preloading tasks and one for all other requests
  return {
    [RequestPriority.Preload]: 1,
    [RequestPriority.Max]: 1,
  };
};

const normalizeLocale = (locale?: string) => {
  if (!locale)
    return undefined;
  return locale.toLocaleLowerCase();
};

const normalizeDirectory = (directory?: string) => {
  return directory ? path.resolve(directory) : "";
};

const createCacheConfig = (config?: HierarchyCacheConfig): IModelJsNative.ECPresentationHierarchyCacheConfig => {
  if (config?.mode === HierarchyCacheMode.Disk)
    return { ...config, directory: normalizeDirectory(config.directory) };
  if (config?.mode === HierarchyCacheMode.Hybrid)
    return { ...config, disk: config.disk ? { ...config.disk, directory: normalizeDirectory(config.disk.directory) } : undefined };
  if (config?.mode === HierarchyCacheMode.Memory)
    return config;
  return { mode: HierarchyCacheMode.Disk, directory: "" };
};

const getPresentationBackendAssetsRoot = (ovr?: string | { backend: string }) => {
  if (typeof ovr === "string")
    return ovr;
  if (typeof ovr === "object")
    return ovr.backend;
  return PRESENTATION_BACKEND_ASSETS_ROOT;
};

const getPresentationCommonAssetsRoot = (ovr?: string | { common: string }) => {
  if (typeof ovr === "string")
    return ovr;
  if (typeof ovr === "object")
    return ovr.common;
  return PRESENTATION_COMMON_ASSETS_ROOT;
};
