/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IModelDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { FormatProps, UnitSystemKey } from "@itwin/core-quantity";
import {
  ComputeSelectionRequestOptions, Content, ContentDescriptorRequestOptions, ContentFlags, ContentRequestOptions, ContentSourcesRequestOptions,
  DefaultContentDisplayTypes, Descriptor, DescriptorOverrides, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup,
  DistinctValuesRequestOptions, ElementProperties, ElementPropertiesRequestOptions, FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions, HierarchyCompareInfo, HierarchyCompareOptions, HierarchyRequestOptions, InstanceKey,
  isComputeSelectionRequestOptions, isSingleElementPropertiesRequestOptions, KeySet, LabelDefinition, MultiElementPropertiesRequestOptions, Node,
  NodeKey, NodePathElement, Paged, PagedResponse, PresentationError, PresentationStatus, Prioritized, Ruleset, RulesetVariable, SelectClassInfo,
  SelectionScope, SelectionScopeRequestOptions, SingleElementPropertiesRequestOptions,
} from "@itwin/presentation-common";
import { buildElementsProperties, getElementsCount, iterateElementIds } from "./ElementPropertiesHelper";
import { NativePlatformDefinition, NativePlatformRequestTypes } from "./NativePlatform";
import {
  bisElementInstanceKeysProcessor, getKeysForContentRequest, getRulesetIdObject, PresentationManagerDetail,
} from "./PresentationManagerDetail";
import { RulesetManager } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { SelectionScopesHelper } from "./SelectionScopesHelper";
import { BackendDiagnosticsAttribute, getElementKey } from "./Utils";

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
 * Data structure for multiple element properties request response.
 * @alpha
 */
export interface MultiElementPropertiesResponse {
  total: number;
  iterator: () => AsyncGenerator<ElementProperties[]>;
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
   *
   * @deprecated Use [[PresentationPropsBase.enableSchemasPreload]] instead.
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
  private _detail: PresentationManagerDetail;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: PresentationManagerProps) {
    this._props = props ?? {};
    this._detail = new PresentationManagerDetail(this._props);
  }

  /** Get / set active locale used for localizing presentation data */
  public get activeLocale(): string | undefined { return this._detail.activeLocale; }
  public set activeLocale(value: string | undefined) { this._detail.activeLocale = value; }

  /** Get / set active unit system used to format property values with units */
  public get activeUnitSystem(): UnitSystemKey | undefined { return this._detail.activeUnitSystem; }
  // istanbul ignore next
  public set activeUnitSystem(value: UnitSystemKey | undefined) { this._detail.activeUnitSystem = value; }

  /** Dispose the presentation manager. Must be called to clean up native resources. */
  public dispose() {
    this._detail.dispose();
  }

  /** @internal */
  public setOnManagerUsedHandler(handler: () => void) {
    this._detail.setOnManagerUsedHandler(handler);
  }

  /** Properties used to initialize the manager */
  public get props() { return this._props; }

  /** Get rulesets manager */
  public rulesets(): RulesetManager { return this._detail.rulesets; }

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get variables manager for
   */
  public vars(rulesetId: string): RulesetVariablesManager {
    return new RulesetVariablesManagerImpl(this.getNativePlatform, rulesetId);
  }

  /** @internal */
  public getNativePlatform = (): NativePlatformDefinition => {
    return this._detail.getNativePlatform();
  };

  /** @internal */
  // istanbul ignore next
  public getDetail(): PresentationManagerDetail {
    return this._detail;
  }

  /** @internal */
  public getRulesetId(rulesetOrId: Ruleset | string) {
    return this._detail.getRulesetId(rulesetOrId);
  }

  /**
   * Retrieves nodes
   * @public
   */
  public async getNodes(requestOptions: Prioritized<Paged<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<Node[]> {
    const { rulesetOrId, parentKey, ...strippedOptions } = requestOptions;
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildren : NativePlatformRequestTypes.GetRootNodes,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return JSON.parse(await this._detail.request(params), Node.listReviver);
  }

  /**
   * Retrieves nodes count
   * @public
   */
  public async getNodesCount(requestOptions: Prioritized<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<number> {
    const { rulesetOrId, parentKey, ...strippedOptions } = requestOptions;
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildrenCount : NativePlatformRequestTypes.GetRootNodesCount,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return JSON.parse(await this._detail.request(params));
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified instance key paths. Intersecting paths will be merged.
   * TODO: Return results in pages
   * @public
   */
  public async getNodePaths(requestOptions: Prioritized<FilterByInstancePathsHierarchyRequestOptions<IModelDb, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<NodePathElement[]> {
    const { rulesetOrId, instancePaths, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetNodePaths,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
      paths: instancePaths.map((p) => p.map((s) => InstanceKey.toJSON(s))),
    };
    return JSON.parse(await this._detail.request(params), NodePathElement.listReviver);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * TODO: Return results in pages
   * @public
   */
  public async getFilteredNodePaths(requestOptions: Prioritized<FilterByTextHierarchyRequestOptions<IModelDb, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<NodePathElement[]> {
    const { rulesetOrId, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetFilteredNodePaths,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
    };
    return JSON.parse(await this._detail.request(params), NodePathElement.listReviver);
  }

  /** @beta */
  public async getContentSources(requestOptions: Prioritized<ContentSourcesRequestOptions<IModelDb>> & BackendDiagnosticsAttribute): Promise<SelectClassInfo[]> {
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSources,
      rulesetId: "ElementProperties",
      ...requestOptions,
    };
    const reviver = (key: string, value: any) => {
      return key === "" ? SelectClassInfo.listFromCompressedJSON(value.sources, value.classesMap) : value;
    };
    return JSON.parse(await this._detail.request(params), reviver);
  }

  /**
   * Retrieves the content descriptor which can be used to get content
   * @public
   */
  public async getContentDescriptor(requestOptions: Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<Descriptor | undefined> {
    const response = await this._detail.getContentDescriptor(requestOptions);
    const reviver = (key: string, value: any) => key === "" ? Descriptor.fromJSON(value) : value;
    return JSON.parse(response, reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @public
   */
  public async getContentSetSize(requestOptions: Prioritized<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<number> {
    const { rulesetOrId, descriptor, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSetSize,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return JSON.parse(await this._detail.request(params));
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @public
   */
  public async getContent(requestOptions: Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<Content | undefined> {
    const { rulesetOrId, descriptor, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContent,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return JSON.parse(await this._detail.request(params), Content.reviver);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions      Options for the request
   * @return A promise object that returns either distinct values on success or an error string on error.
   * @public
   */
  public async getPagedDistinctValues(requestOptions: Prioritized<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>> & BackendDiagnosticsAttribute): Promise<PagedResponse<DisplayValueGroup>> {
    const { rulesetOrId, ...strippedOptions } = requestOptions;
    const { descriptor, keys, ...strippedOptionsNoDescriptorAndKeys } = strippedOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetPagedDistinctValues,
      rulesetId: this._detail.registerRuleset(rulesetOrId),
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
    return JSON.parse(await this._detail.request(params), reviver);
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @beta
   */
  public async getElementProperties(requestOptions: Prioritized<SingleElementPropertiesRequestOptions<IModelDb>> & BackendDiagnosticsAttribute): Promise<ElementProperties | undefined>;
  /**
   * Retrieves property data in simplified format for multiple elements specified by class or all element.
   * @return An object that contains element count and AsyncGenerator to iterate over properties of those elements in batches of undefined size.
   * @alpha
   */
  public async getElementProperties(requestOptions: Prioritized<MultiElementPropertiesRequestOptions<IModelDb>> & BackendDiagnosticsAttribute): Promise<MultiElementPropertiesResponse>;
  public async getElementProperties(requestOptions: Prioritized<ElementPropertiesRequestOptions<IModelDb>> & BackendDiagnosticsAttribute): Promise<ElementProperties | undefined | MultiElementPropertiesResponse> {
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

  private async getMultipleElementProperties(requestOptions: Prioritized<MultiElementPropertiesRequestOptions<IModelDb>> & BackendDiagnosticsAttribute): Promise<MultiElementPropertiesResponse> {
    const { elementClasses, ...optionsNoElementClasses } = requestOptions;
    const elementsCount = getElementsCount(requestOptions.imodel, requestOptions.elementClasses);

    const propertiesGetter = async (className: string, ids: string[]) => buildElementsPropertiesInPages(className, ids, async (keys) => {
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

    const ELEMENT_IDS_BATCH_SIZE = 1000;
    return {
      total: elementsCount,
      async *iterator() {
        for (const idsByClass of iterateElementIds(requestOptions.imodel, elementClasses, ELEMENT_IDS_BATCH_SIZE)) {
          const propertiesPage: ElementProperties[] = [];
          for (const entry of idsByClass) {
            propertiesPage.push(...(await propertiesGetter(entry[0], entry[1])));
          }
          yield propertiesPage;
        }
      },
    };
  }

  /**
   * Retrieves display label definition of specific item
   * @public
   */
  public async getDisplayLabelDefinition(requestOptions: Prioritized<DisplayLabelRequestOptions<IModelDb, InstanceKey>> & BackendDiagnosticsAttribute): Promise<LabelDefinition> {
    const params = {
      requestId: NativePlatformRequestTypes.GetDisplayLabel,
      ...requestOptions,
      key: InstanceKey.toJSON(requestOptions.key),
    };
    return JSON.parse(await this._detail.request(params), LabelDefinition.reviver);
  }

  /**
   * Retrieves display label definitions of specific items
   * @public
   */
  public async getDisplayLabelDefinitions(requestOptions: Prioritized<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>> & BackendDiagnosticsAttribute): Promise<LabelDefinition[]> {
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
  public async getSelectionScopes(_requestOptions: SelectionScopeRequestOptions<IModelDb> & BackendDiagnosticsAttribute): Promise<SelectionScope[]> {
    return SelectionScopesHelper.getSelectionScopes();
  }

  /**
   * Computes selection set based on provided selection scope.
   * @public
   */
  public async computeSelection(requestOptions: SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[], scopeId: string } & BackendDiagnosticsAttribute): Promise<KeySet>;
  /** @alpha */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public async computeSelection(requestOptions: ComputeSelectionRequestOptions<IModelDb> & BackendDiagnosticsAttribute): Promise<KeySet>;
  public async computeSelection(requestOptions: ((SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[], scopeId: string }) | ComputeSelectionRequestOptions<IModelDb>) & BackendDiagnosticsAttribute): Promise<KeySet> {
    return SelectionScopesHelper.computeSelection(isComputeSelectionRequestOptions(requestOptions)
      ? requestOptions
      : (function () {
        const { ids, scopeId, ...rest } = requestOptions;
        return { ...rest, elementIds: ids, scope: { id: scopeId } };
      })());
  }

  /**
   * Compares two hierarchies specified in the request options
   * @public
   */
  public async compareHierarchies(requestOptions: HierarchyCompareOptions<IModelDb, NodeKey>): Promise<HierarchyCompareInfo> {
    if (!requestOptions.prev.rulesetOrId && !requestOptions.prev.rulesetVariables) {
      return { changes: [] };
    }

    const { rulesetOrId, prev, rulesetVariables, ...options } = requestOptions;
    this._detail.registerRuleset(rulesetOrId);

    const currRulesetId = getRulesetIdObject(requestOptions.rulesetOrId);
    const prevRulesetId = prev.rulesetOrId ? getRulesetIdObject(prev.rulesetOrId) : currRulesetId;
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

    const reviver = (key: string, value: any) => (key === "") ? HierarchyCompareInfo.fromJSON(value) : value;
    return JSON.parse(await this._detail.request(params), reviver);
  }
}

const createContentDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor)
    return descriptorOrOverrides.createDescriptorOverrides();
  return descriptorOrOverrides;
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
