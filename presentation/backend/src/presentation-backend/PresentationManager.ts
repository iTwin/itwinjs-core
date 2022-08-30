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
  DefaultContentDisplayTypes,
  Descriptor, DescriptorOverrides, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup,
  DistinctValuesRequestOptions, ElementProperties, ElementPropertiesRequestOptions, FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions, HierarchyCompareInfo, HierarchyCompareOptions, HierarchyRequestOptions, InstanceKey,
  isComputeSelectionRequestOptions, isSingleElementPropertiesRequestOptions, KeySet, LabelDefinition, LocalizationHelper, MultiElementPropertiesRequestOptions,
  Node,
  NodeKey, NodePathElement, Paged, PagedResponse, PresentationError, PresentationStatus, Prioritized, Ruleset, RulesetVariable, SelectClassInfo,
  SelectionScope, SelectionScopeRequestOptions, SingleElementPropertiesRequestOptions, WithCancelEvent,
} from "@itwin/presentation-common";
import { buildElementsProperties, getElementsCount, iterateElementIds } from "./ElementPropertiesHelper";
import { NativePlatformDefinition, NativePlatformRequestTypes } from "./NativePlatform";
import { getRulesetIdObject, PresentationManagerDetail } from "./PresentationManagerDetail";
import { RulesetManager } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { SelectionScopesHelper } from "./SelectionScopesHelper";
import { BackendDiagnosticsAttribute, getLocalizedStringEN } from "./Utils";

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
   *
   * @deprecated Use [[getLocalizedString]] to localize data returned by [[PresentationManager]].
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager.activeLocale]].
   *
   * @deprecated Use [[getLocalizedString]] to localize data returned by [[PresentationManager]].
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

  /**
   * Localization function when only backend is used.
   *
   * @beta
  */
  getLocalizedString?: (key: string) => string;
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
  private _localizationHelper: LocalizationHelper;

  /**
   * Get / set active locale used for localizing presentation data
   * @deprecated Use [[getLocalizedString]] to localize data returned by [[PresentationManager]].
   */
  public activeLocale: string | undefined;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: PresentationManagerProps) {
    this._props = props ?? {};
    this._detail = new PresentationManagerDetail(this._props);
    this.activeLocale = this._props.defaultLocale; // eslint-disable-line deprecation/deprecation

    this._localizationHelper = new LocalizationHelper({ getLocalizedString: props?.getLocalizedString ?? getLocalizedStringEN });
  }

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
  public async getNodes(requestOptions: WithCancelEvent<Prioritized<Paged<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>>> & BackendDiagnosticsAttribute): Promise<Node[]> {
    const nodes = await this._detail.getNodes(requestOptions);
    return this._localizationHelper.getLocalizedNodes(nodes);
  }

  /**
   * Retrieves nodes count
   * @public
   */
  public async getNodesCount(requestOptions: WithCancelEvent<Prioritized<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<number> {
    return this._detail.getNodesCount(requestOptions);
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified instance key paths. Intersecting paths will be merged.
   * TODO: Return results in pages
   * @public
   */
  public async getNodePaths(requestOptions: WithCancelEvent<Prioritized<FilterByInstancePathsHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<NodePathElement[]> {
    return this._detail.getNodePaths(requestOptions);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * TODO: Return results in pages
   * @public
   */
  public async getFilteredNodePaths(requestOptions: WithCancelEvent<Prioritized<FilterByTextHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<NodePathElement[]> {
    return this._detail.getFilteredNodePaths(requestOptions);
  }

  /** @beta */
  public async getContentSources(requestOptions: WithCancelEvent<Prioritized<ContentSourcesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute): Promise<SelectClassInfo[]> {
    return this._detail.getContentSources(requestOptions);
  }

  /**
   * Retrieves the content descriptor which can be used to get content
   * @public
   */
  public async getContentDescriptor(requestOptions: WithCancelEvent<Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<Descriptor | undefined> {
    const response = await this._detail.getContentDescriptor(requestOptions);
    const reviver = (key: string, value: any) => key === "" ? Descriptor.fromJSON(value) : value;
    return JSON.parse(response, reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @public
   */
  public async getContentSetSize(requestOptions: WithCancelEvent<Prioritized<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<number> {
    return this._detail.getContentSetSize(requestOptions);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @public
   */
  public async getContent(requestOptions: WithCancelEvent<Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>>> & BackendDiagnosticsAttribute): Promise<Content | undefined> {
    const content = await this._detail.getContent(requestOptions);
    if (!content)
      return undefined;
    return this._localizationHelper.getLocalizedContent(content);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions      Options for the request
   * @return A promise object that returns either distinct values on success or an error string on error.
   * @public
   */
  public async getPagedDistinctValues(requestOptions: WithCancelEvent<Prioritized<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> & BackendDiagnosticsAttribute): Promise<PagedResponse<DisplayValueGroup>> {
    return this._detail.getPagedDistinctValues(requestOptions);
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @beta
   */
  public async getElementProperties(requestOptions: WithCancelEvent<Prioritized<SingleElementPropertiesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute): Promise<ElementProperties | undefined>;
  /**
   * Retrieves property data in simplified format for multiple elements specified by class or all element.
   * @return An object that contains element count and AsyncGenerator to iterate over properties of those elements in batches of undefined size.
   * @alpha
   */
  public async getElementProperties(requestOptions: WithCancelEvent<Prioritized<MultiElementPropertiesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute): Promise<MultiElementPropertiesResponse>;
  public async getElementProperties(requestOptions: WithCancelEvent<Prioritized<ElementPropertiesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute): Promise<ElementProperties | undefined | MultiElementPropertiesResponse> {
    if (isSingleElementPropertiesRequestOptions(requestOptions)) {
      const elementProperties = await this._detail.getElementProperties(requestOptions);
      // istanbul ignore if
      if (!elementProperties)
        return undefined;
      return this._localizationHelper.getLocalizedElementProperties(elementProperties);
    }

    return this.getMultipleElementProperties(requestOptions);
  }

  private async getMultipleElementProperties(requestOptions: WithCancelEvent<Prioritized<MultiElementPropertiesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute): Promise<MultiElementPropertiesResponse> {
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
  public async getDisplayLabelDefinition(requestOptions: WithCancelEvent<Prioritized<DisplayLabelRequestOptions<IModelDb, InstanceKey>>> & BackendDiagnosticsAttribute): Promise<LabelDefinition> {
    const labelDefinition = await this._detail.getDisplayLabelDefinition(requestOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(labelDefinition);
  }

  /**
   * Retrieves display label definitions of specific items
   * @public
   */
  public async getDisplayLabelDefinitions(requestOptions: WithCancelEvent<Prioritized<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>> & BackendDiagnosticsAttribute): Promise<LabelDefinition[]> {
    const labelDefinitions = await this._detail.getDisplayLabelDefinitions(requestOptions);
    return this._localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
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
