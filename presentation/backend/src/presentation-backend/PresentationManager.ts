/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as hash from "object-hash";
import * as path from "path";
import { BriefcaseDb, IModelDb, IModelJsNative, IpcHost } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { FormatProps, UnitSystemKey } from "@itwin/core-quantity";
import {
  Content, ContentDescriptorRequestOptions, ContentFlags, ContentRequestOptions, ContentSourcesRequestOptions, DefaultContentDisplayTypes, Descriptor,
  DescriptorOverrides, DiagnosticsOptionsWithHandler, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup,
  DistinctValuesRequestOptions, ElementProperties, ElementPropertiesRequestOptions, FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions, getLocalesDirectory, HierarchyCompareInfo, HierarchyCompareOptions, HierarchyRequestOptions, InstanceKey,
  isSingleElementPropertiesRequestOptions, Key, KeySet, LabelDefinition, MultiElementPropertiesRequestOptions, Node, NodeKey, NodePathElement, Paged,
  PagedResponse, PresentationError, PresentationStatus, Prioritized, Ruleset, SelectClassInfo, SelectionScope, SelectionScopeRequestOptions,
  SingleElementPropertiesRequestOptions,
} from "@itwin/presentation-common";
import { PRESENTATION_BACKEND_ASSETS_ROOT, PRESENTATION_COMMON_ASSETS_ROOT } from "./Constants";
import { buildElementsProperties, getElementIdsByClass, getElementsCount } from "./ElementPropertiesHelper";
import {
  createDefaultNativePlatform, NativePlatformDefinition, NativePlatformRequestTypes, NativePresentationDefaultUnitFormats,
  NativePresentationKeySetJSON, NativePresentationUnitSystem,
} from "./NativePlatform";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { SelectionScopesHelper } from "./SelectionScopesHelper";
import { UpdatesTracker } from "./UpdatesTracker";
import { getElementKey } from "./Utils";

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
 * Configuration for in-memory hierarchy cache.
 * @beta
 */
export interface MemoryHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Memory;
}

/**
 * Configuration for persistent disk hierarchy cache.
 * @beta
 */
export interface DiskHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Disk;

  /**
   * A directory for Presentation hierarchy cache. If set, the directory must exist.
   *
   * The default directory depends on the iModel and the way it's opened.
   */
  directory?: string;
}

/**
 * Configuration for the experimental hybrid hierarchy cache.
 *
 * Hybrid cache uses a combination of in-memory and disk caches, which should make it a better
 * alternative for cases when there are lots of simultaneous requests.
 *
 * @beta
 */
export interface HybridCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Hybrid;

  /** Configuration for disk cache used to persist hierarchies. */
  disk?: DiskHierarchyCacheConfig;
}

/**
 * Configuration for content cache.
 * @public
 */
export interface ContentCacheConfig {
  /**
   * Maximum number of content descriptors cached in memory for quicker paged content requests.
   *
   * Defaults to `100`.
   *
   * @alpha
   */
  size?: number;
}

/**
 * A data structure that associates unit systems with a format. The associations are used for
 * assigning default unit formats for specific phenomenons (see [[PresentationManagerProps.defaultFormats]]).
 *
 * @public
 */
export interface UnitSystemFormat {
  unitSystems: UnitSystemKey[];
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
   * strings. It can later be changed through [[PresentationManager.activeLocale]].
   */
  defaultLocale?: string;

  /**
   * Sets the active unit system to use for formatting property values with
   * units. Default presentation units are used if this is not specified. The active unit
   * system can later be changed through [[PresentationManager.activeUnitSystem]] or overriden for each request
   * through request options.
   */
  defaultUnitSystem?: UnitSystemKey;

  /**
   * A map of default unit formats to use for formatting properties that don't have a presentation format
   * in requested unit system.
   */
  defaultFormats?: {
    [phenomenon: string]: UnitSystemFormat;
  };

  /**
   * Should schemas preloading be enabled. If true, presentation manager listens
   * for `BriefcaseDb.onOpened` event and force pre-loads all ECSchemas.
   */
  enableSchemasPreload?: boolean;

  /**
   * A number of worker threads to use for handling presentation requests. Defaults to `2`.
   */
  workerThreadsCount?: number;

  /**
   * Presentation manager working mode. Backends that use iModels in read-write mode should
   * use `ReadWrite`, others might want to set to `ReadOnly` for better performance.
   *
   * Defaults to [[PresentationManagerMode.ReadWrite]].
   */
  mode?: PresentationManagerMode;

  /**
   * The interval (in milliseconds) used to poll for presentation data changes. Only has
   * effect in read-write mode (see [[mode]]).
   *
   * @alpha
   */
  updatesPollInterval?: number;

  /** Options for caching. */
  caching?: {
    /**
     * Hierarchies-related caching options.
     * @beta
     */
    hierarchies?: HierarchyCacheConfig;

    /** Content-related caching options. */
    content?: ContentCacheConfig;
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
  private _isDisposed: boolean;
  private _disposeIModelOpenedListener?: () => void;
  private _updatesTracker?: UpdatesTracker;

  /** Get / set active locale used for localizing presentation data */
  public activeLocale: string | undefined;

  /** Get / set active unit system used to format property values with units */
  public activeUnitSystem: UnitSystemKey | undefined;

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
        cacheConfig: createCacheConfig(this._props.caching?.hierarchies),
        contentCacheSize: this._props.caching?.content?.size,
        defaultFormats: toNativeUnitFormatsMap(this._props.defaultFormats),
        useMmap: this._props.useMmap,
      });
      this._nativePlatform = new nativePlatformImpl();
    }

    this.setupRulesetDirectories(props);
    if (props) {
      this.activeLocale = props.defaultLocale;
      this.activeUnitSystem = props.defaultUnitSystem;
    }

    this._rulesets = new RulesetManagerImpl(this.getNativePlatform);

    if (this._props.enableSchemasPreload)
      this._disposeIModelOpenedListener = BriefcaseDb.onOpened.addListener(this.onIModelOpened);

    if (IpcHost.isValid && isChangeTrackingEnabled) {
      this._updatesTracker = UpdatesTracker.create({
        nativePlatformGetter: this.getNativePlatform,
        pollInterval: props.updatesPollInterval!,
      });
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
  private onIModelOpened = (imodel: BriefcaseDb) => {
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.getNativePlatform().forceLoadSchemas(imodelAddon);
  };

  /** @internal */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new PresentationError(PresentationStatus.NotInitialized, "Attempting to use Presentation manager after disposal");
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

    const primaryRulesetDirectories = [path.join(getPresentationBackendAssetsRoot(props?.presentationAssetsRoot), "primary-presentation-rules")];
    if (props && props.rulesetDirectories) {
      props.rulesetDirectories.forEach((dir) => {
        if (-1 === primaryRulesetDirectories.indexOf(dir))
          primaryRulesetDirectories.push(dir);
      });
    }
    this.getNativePlatform().setupRulesetDirectories(primaryRulesetDirectories);
  }

  private getRulesetIdObject(rulesetOrId: Ruleset | string): { uniqueId: string, parts: { id: string, hash?: string } } {
    if (typeof rulesetOrId === "object") {
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
   * Retrieves nodes
   * @public
   */
  public async getNodes(requestOptions: Prioritized<Paged<HierarchyRequestOptions<IModelDb, NodeKey>>>): Promise<Node[]> {
    const { rulesetId, strippedOptions: { parentKey, ...strippedOptions } } = this.registerRuleset(requestOptions);
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
   * @public
   */
  public async getNodesCount(requestOptions: Prioritized<HierarchyRequestOptions<IModelDb, NodeKey>>): Promise<number> {
    const { rulesetId, strippedOptions: { parentKey, ...strippedOptions } } = this.registerRuleset(requestOptions);
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
   * TODO: Return results in pages
   * @public
   */
  public async getNodePaths(requestOptions: Prioritized<FilterByInstancePathsHierarchyRequestOptions<IModelDb>>): Promise<NodePathElement[]> {
    const { rulesetId, strippedOptions: { instancePaths, ...strippedOptions } } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetNodePaths,
      rulesetId,
      ...strippedOptions,
      paths: instancePaths.map((p) => p.map((s) => InstanceKey.toJSON(s))),
    };
    return this.request(params, NodePathElement.listReviver);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * TODO: Return results in pages
   * @public
   */
  public async getFilteredNodePaths(requestOptions: Prioritized<FilterByTextHierarchyRequestOptions<IModelDb>>): Promise<NodePathElement[]> {
    const { rulesetId, strippedOptions } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetFilteredNodePaths,
      rulesetId,
      ...strippedOptions,
    };
    return this.request(params, NodePathElement.listReviver);
  }

  /** @beta */
  public async getContentSources(requestOptions: Prioritized<ContentSourcesRequestOptions<IModelDb>>): Promise<SelectClassInfo[]> {
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSources,
      rulesetId: "ElementProperties",
      ...requestOptions,
    };
    const reviver = (key: string, value: any) => {
      return key === "" ? SelectClassInfo.listFromCompressedJSON(value.sources, value.classesMap) : value;
    };
    return this.request(params, reviver);
  }

  /**
   * Retrieves the content descriptor which can be used to get content
   * @public
   */
  public async getContentDescriptor(requestOptions: Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet>>): Promise<Descriptor | undefined> {
    const { rulesetId, strippedOptions } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContentDescriptor,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
    };
    const reviver = (key: string, value: any) => {
      return key === "" ? Descriptor.fromJSON(value) : value;
    };
    return this.request(params, reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @public
   */
  public async getContentSetSize(requestOptions: Prioritized<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>): Promise<number> {
    const { rulesetId, strippedOptions: { descriptor, ...strippedOptions } } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSetSize,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return this.request(params);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @public
   */
  public async getContent(requestOptions: Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>>): Promise<Content | undefined> {
    const { rulesetId, strippedOptions: { descriptor, ...strippedOptions } } = this.registerRuleset(requestOptions);
    const params = {
      requestId: NativePlatformRequestTypes.GetContent,
      rulesetId,
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return this.request(params, Content.reviver);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions      Options for the request
   * @return A promise object that returns either distinct values on success or an error string on error.
   * @public
   */
  public async getPagedDistinctValues(requestOptions: Prioritized<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet>>): Promise<PagedResponse<DisplayValueGroup>> {
    const { rulesetId, strippedOptions } = this.registerRuleset(requestOptions);
    const { descriptor, keys, ...strippedOptionsNoDescriptorAndKeys } = strippedOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetPagedDistinctValues,
      rulesetId,
      ...strippedOptionsNoDescriptorAndKeys,
      keys: getKeysForContentRequest(keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
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
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @beta
   */
  public async getElementProperties(requestOptions: Prioritized<SingleElementPropertiesRequestOptions<IModelDb>>): Promise<ElementProperties | undefined>;
  /**
   * Retrieves property data in simplified format for multiple elements specified by class
   * or all element.
   * @alpha
   */
  public async getElementProperties(requestOptions: Prioritized<MultiElementPropertiesRequestOptions<IModelDb>>): Promise<PagedResponse<ElementProperties>>;
  public async getElementProperties(requestOptions: Prioritized<ElementPropertiesRequestOptions<IModelDb>>): Promise<ElementProperties | undefined | PagedResponse<ElementProperties>> {
    if (isSingleElementPropertiesRequestOptions(requestOptions)) {
      const { elementId, ...optionsNoElementId } = requestOptions;
      const content = await this.getContent({
        ...optionsNoElementId,
        descriptor: {
          displayType: DefaultContentDisplayTypes.PropertyPane,
          contentFlags: ContentFlags.ShowLabels,
        },
        rulesetOrId: "ElementProperties",
        keys: new KeySet([{ className: "BisCore:Element", id: elementId }]),
      });
      const properties = buildElementsProperties(content);
      return properties[0];
    }

    return this.getMultipleElementProperties(requestOptions);
  }

  private async getMultipleElementProperties(requestOptions: Prioritized<MultiElementPropertiesRequestOptions<IModelDb>>) {
    const { elementClasses, paging, ...optionsNoElementClasses } = requestOptions;
    const elementsCount = getElementsCount(requestOptions.imodel, requestOptions.elementClasses);
    const elementIds = getElementIdsByClass(requestOptions.imodel, elementClasses, paging);

    const elementProperties: ElementProperties[] = [];
    for (const entry of elementIds) {
      const properties = await buildElementsPropertiesInPages(entry[0], entry[1], async (keys) => {
        const content = await this.getContent({
          ...optionsNoElementClasses,
          descriptor: {
            displayType: DefaultContentDisplayTypes.PropertyPane,
            contentFlags: ContentFlags.ShowLabels,
          },
          rulesetOrId: "ElementProperties",
          keys,
        });
        return buildElementsProperties(content);
      });
      elementProperties.push(...properties);
    }

    return { total: elementsCount, items: elementProperties };
  }

  /**
   * Retrieves display label definition of specific item
   * @public
   */
  public async getDisplayLabelDefinition(requestOptions: Prioritized<DisplayLabelRequestOptions<IModelDb, InstanceKey>>): Promise<LabelDefinition> {
    const params = {
      requestId: NativePlatformRequestTypes.GetDisplayLabel,
      ...requestOptions,
      key: InstanceKey.toJSON(requestOptions.key),
    };
    return this.request(params, LabelDefinition.reviver);
  }

  /**
   * Retrieves display label definitions of specific items
   * @public
   */
  public async getDisplayLabelDefinitions(requestOptions: Prioritized<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>): Promise<LabelDefinition[]> {
    const concreteKeys = requestOptions.keys.map((k) => {
      if (k.className === "BisCore:Element")
        return getElementKey(requestOptions.imodel, k.id);
      return k;
    }).filter<InstanceKey>((k): k is InstanceKey => !!k);
    const contentRequestOptions: ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet> = {
      ...requestOptions,
      rulesetOrId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
      descriptor: {
        displayType: DefaultContentDisplayTypes.List,
        contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
      },
      keys: new KeySet(concreteKeys),
    };
    const content = await this.getContent(contentRequestOptions);
    return concreteKeys.map((key) => {
      const item = content ? content.contentSet.find((it) => it.primaryKeys.length > 0 && InstanceKey.compare(it.primaryKeys[0], key) === 0) : undefined;
      if (!item)
        return { displayValue: "", rawValue: "", typeName: "" };
      return item.label;
    });
  }

  /**
   * Retrieves available selection scopes.
   * @public
   */
  public async getSelectionScopes(_requestOptions: SelectionScopeRequestOptions<IModelDb>): Promise<SelectionScope[]> {
    return SelectionScopesHelper.getSelectionScopes();
  }

  /**
   * Computes selection set based on provided selection scope.
   * @public
   */
  public async computeSelection(requestOptions: SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[], scopeId: string }): Promise<KeySet> {
    const { ids, scopeId, ...opts } = requestOptions; // eslint-disable-line @typescript-eslint/no-unused-vars
    return SelectionScopesHelper.computeSelection(opts, ids, scopeId);
  }

  private async request<TParams extends { diagnostics?: DiagnosticsOptionsWithHandler, requestId: string, imodel: IModelDb, locale?: string, unitSystem?: UnitSystemKey }, TResult>(params: TParams, reviver?: (key: string, value: any) => any): Promise<TResult> {
    const { requestId, imodel, locale, unitSystem, diagnostics, ...strippedParams } = params;
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const nativeRequestParams: any = {
      requestId,
      params: {
        locale: normalizeLocale(locale ?? this.activeLocale),
        unitSystem: toOptionalNativeUnitSystem(unitSystem ?? this.activeUnitSystem),
        ...strippedParams,
      },
    };

    let diagnosticsListener;
    if (diagnostics) {
      const { handler: tempDiagnosticsListener, ...diagnosticsOptions } = diagnostics;
      diagnosticsListener = tempDiagnosticsListener;
      nativeRequestParams.params.diagnostics = diagnosticsOptions;
    }

    const response = await this.getNativePlatform().handleRequest(imodelAddon, JSON.stringify(nativeRequestParams));
    diagnosticsListener && response.diagnostics && diagnosticsListener([response.diagnostics]);
    return JSON.parse(response.result, reviver);
  }

  /**
   * Compares two hierarchies specified in the request options
   * @public
   */
  public async compareHierarchies(requestOptions: HierarchyCompareOptions<IModelDb, NodeKey>): Promise<HierarchyCompareInfo> {
    if (!requestOptions.prev.rulesetOrId && !requestOptions.prev.rulesetVariables)
      return { changes: [] };

    const { strippedOptions: { prev, rulesetVariables, ...options } } = this.registerRuleset(requestOptions);

    const currRulesetId = this.getRulesetIdObject(requestOptions.rulesetOrId);
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

function addInstanceKey(classInstancesMap: Map<string, Set<string>>, key: InstanceKey) {
  let set = classInstancesMap.get(key.className);
  // istanbul ignore else
  if (!set) {
    set = new Set();
    classInstancesMap.set(key.className, set);
  }
  set.add(key.id);
}
function bisElementInstanceKeysProcessor(imodel: IModelDb, classInstancesMap: Map<string, Set<string>>) {
  const elementClassName = "BisCore:Element";
  const elementIds = classInstancesMap.get(elementClassName);
  if (elementIds) {
    const deleteElementIds = new Array<string>();
    elementIds.forEach((elementId) => {
      const concreteKey = getElementKey(imodel, elementId);
      if (concreteKey && concreteKey.className !== elementClassName) {
        deleteElementIds.push(elementId);
        addInstanceKey(classInstancesMap, { className: concreteKey.className, id: elementId });
      }
    });
    for (const id of deleteElementIds)
      elementIds.delete(id);
  }
}
/** @internal */
export function getKeysForContentRequest(keys: Readonly<KeySet>, classInstanceKeysProcessor?: (keys: Map<string, Set<string>>) => void): NativePresentationKeySetJSON {
  const result: NativePresentationKeySetJSON = {
    instanceKeys: [],
    nodeKeys: [],
  };
  const classInstancesMap = new Map<string, Set<string>>();
  keys.forEach((key) => {
    if (Key.isNodeKey(key))
      result.nodeKeys.push(key);
    if (Key.isInstanceKey(key))
      addInstanceKey(classInstancesMap, key);
  });

  if (classInstanceKeysProcessor)
    classInstanceKeysProcessor(classInstancesMap);

  for (const entry of classInstancesMap) {
    if (entry[1].size > 0)
      result.instanceKeys.push([entry["0"], [...entry[1]]]);
  }

  return result;
}

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
  const count = props?.workerThreadsCount ?? 2;
  return {
    [Number.MAX_SAFE_INTEGER]: count,
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

const toNativeUnitSystem = (unitSystem: UnitSystemKey) => {
  switch (unitSystem) {
    case "imperial": return NativePresentationUnitSystem.BritishImperial;
    case "metric": return NativePresentationUnitSystem.Metric;
    case "usCustomary": return NativePresentationUnitSystem.UsCustomary;
    case "usSurvey": return NativePresentationUnitSystem.UsSurvey;
  }
};

const toOptionalNativeUnitSystem = (unitSystem: UnitSystemKey | undefined) => {
  return unitSystem ? toNativeUnitSystem(unitSystem) : undefined;
};

const toNativeUnitFormatsMap = (map: { [phenomenon: string]: UnitSystemFormat } | undefined) => {
  if (!map)
    return undefined;

  const nativeFormatsMap: NativePresentationDefaultUnitFormats = {};
  Object.keys(map).forEach((phenomenon) => {
    const unitSystemsFormat = map[phenomenon];
    nativeFormatsMap[phenomenon] = {
      unitSystems: unitSystemsFormat.unitSystems.map(toNativeUnitSystem),
      format: unitSystemsFormat.format,
    };
  });
  return nativeFormatsMap;
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

const ELEMENT_PROPERTIES_CONTENT_BATCH_SIZE = 100;
async function buildElementsPropertiesInPages(className: string, ids: string[], getter: (keys: KeySet) => Promise<ElementProperties[]>) {
  const elementProperties: ElementProperties[] = [];
  const elementIds = [...ids];
  while (elementIds.length > 0) {
    const idsPage = elementIds.splice(0, ELEMENT_PROPERTIES_CONTENT_BATCH_SIZE);
    const keys = new KeySet(idsPage.map((id) => ({ id, className })));
    elementProperties.push(...(await getter(keys)));
  }
  return elementProperties;
}
