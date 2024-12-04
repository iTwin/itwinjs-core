/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { forkJoin, from, map, mergeMap, of } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { IModelDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import {
  buildElementProperties,
  UnitSystemFormat as CommonUnitSystemFormat,
  ComputeSelectionRequestOptions,
  Content,
  ContentDescriptorRequestOptions,
  ContentFlags,
  ContentFormatter,
  ContentPropertyValueFormatter,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  DefaultContentDisplayTypes,
  Descriptor,
  DescriptorOverrides,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DisplayValueGroup,
  DistinctValuesRequestOptions,
  ElementProperties,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  FormatsMap,
  HierarchyCompareInfo,
  HierarchyCompareOptions,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyLevelJSON,
  HierarchyRequestOptions,
  InstanceKey,
  isComputeSelectionRequestOptions,
  isSingleElementPropertiesRequestOptions,
  Item,
  KeySet,
  KoqPropertyValueFormatter,
  LabelDefinition,
  LocalizationHelper,
  MultiElementPropertiesRequestOptions,
  Node,
  NodeKey,
  NodePathElement,
  Paged,
  PagedResponse,
  PresentationError,
  PresentationStatus,
  Prioritized,
  Ruleset,
  RulesetVariable,
  SelectClassInfo,
  SelectionScope,
  SelectionScopeRequestOptions,
  SingleElementPropertiesRequestOptions,
  WithCancelEvent,
} from "@itwin/presentation-common";
import { getBatchedClassElementIds, getClassesWithInstances, getElementsCount, parseFullClassName } from "./ElementPropertiesHelper";
import { NativePlatformDefinition, NativePlatformRequestTypes } from "./NativePlatform";
import { getRulesetIdObject, PresentationManagerDetail } from "./PresentationManagerDetail";
import { RulesetManager } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { SelectionScopesHelper } from "./SelectionScopesHelper";
import { BackendDiagnosticsAttribute, BackendDiagnosticsOptions, getLocalizedStringEN } from "./Utils";

/**
 * Presentation manager working mode.
 * @public
 * @deprecated in 3.x. The attribute is not used by [[PresentationManager]] anymore
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
 * @public
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
   *
   * **Note:** This mode is still experimental.
   */
  Hybrid = "hybrid",
}

/**
 * Configuration for hierarchy cache.
 * @public
 */
export type HierarchyCacheConfig = MemoryHierarchyCacheConfig | DiskHierarchyCacheConfig | HybridCacheConfig;

/**
 * Base interface for all [[HierarchyCacheConfig]] implementations.
 * @public
 */
export interface HierarchyCacheConfigBase {
  mode: HierarchyCacheMode;
}

/**
 * Configuration for in-memory hierarchy cache.
 *
 * @see [Memory cache documentation page]($docs/presentation/advanced/Caching.md#memory-cache)
 * @public
 */
export interface MemoryHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Memory;
}

/**
 * Configuration for persistent disk hierarchy cache.
 *
 * @see [Disk cache documentation page]($docs/presentation/advanced/Caching.md#disk-cache)
 * @public
 */
export interface DiskHierarchyCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Disk;

  /**
   * A directory for hierarchy caches. If set, the directory must exist. Relative paths start from `process.cwd()`.
   *
   * The default directory depends on the iModel and the way it's opened.
   */
  directory?: string;

  /**
   * While the cache itself is stored on a disk, there's still a required small in-memory cache.
   * The parameter allows controlling size of that cache. Defaults to `32768000` bytes (32 MB).
   */
  memoryCacheSize?: number;
}

/**
 * Configuration for the experimental hybrid hierarchy cache.
 *
 * Hybrid cache uses a combination of in-memory and disk caches, which should make it a better
 * alternative for cases when there are lots of simultaneous requests.
 *
 * @see [Hybrid cache documentation page]($docs/presentation/advanced/Caching.md#hybrid-cache)
 * @public
 */
export interface HybridCacheConfig extends HierarchyCacheConfigBase {
  mode: HierarchyCacheMode.Hybrid;

  /** Configuration for disk cache used to persist hierarchies. */
  disk?: DiskHierarchyCacheConfig;
}

/**
 * Configuration for content cache.
 *
 * @see [Content cache documentation page]($docs/presentation/advanced/Caching.md#content-cache)
 * @public
 */
export interface ContentCacheConfig {
  /**
   * Maximum number of content descriptors cached in memory for quicker paged content requests.
   *
   * Defaults to `100`.
   */
  size?: number;
}

/**
 * Caching configuration options for [[PresentationManager]].
 * @public
 */
export interface PresentationManagerCachingConfig {
  /**
   * Hierarchies-related caching options.
   *
   * @see [Hierarchies cache documentation page]($docs/presentation/advanced/Caching.md#hierarchies-cache)
   */
  hierarchies?: HierarchyCacheConfig;

  /**
   * Content-related caching options.
   *
   * @see [Content cache documentation page]($docs/presentation/advanced/Caching.md#content-cache)
   */
  content?: ContentCacheConfig;

  /**
   * Each worker thread (see [[workerThreadsCount]]) opens a connection to an iModel used for a request. This
   * means there could be  `{workerThreadsCount} * {iModels count}` number of connections. Each connection
   * uses a memory cache to increase iModel read performance. This parameter allows controlling the size of that
   * cache. Defaults to `32768000` bytes (32 MB).
   *
   * @see [Worker connections cache documentation page]($docs/presentation/advanced/Caching.md#worker-connections-cache)
   */
  workerConnectionCacheSize?: number;
}

/**
 * A data structure that associates unit systems with a format. The associations are used for
 * assigning default unit formats for specific phenomenons (see [[PresentationManagerProps.defaultFormats]]).
 *
 * @public
 * @deprecated in 4.3. The type has been moved to `@itwin/presentation-common` package.
 */
export type UnitSystemFormat = CommonUnitSystemFormat;

/**
 * Data structure for multiple element properties request response.
 * @public
 */
export interface MultiElementPropertiesResponse<TParsedContent = ElementProperties> {
  total: number;
  iterator: () => AsyncGenerator<TParsedContent[]>;
}

/**
 * Configuration options for supplying asset paths to [[PresentationManager]].
 * @public
 */
export interface PresentationAssetsRootConfig {
  /**
   * Path to `presentation-backend` assets. Relative paths start from `process.cwd()`.
   */
  backend: string;

  /**
   * Path to `presentation-common` assets.
   *
   * @deprecated in 3.x. This path is not used anymore
   */
  common: string;
}

/**
 * Properties that can be used to configure [[PresentationManager]]
 * @public
 */
export interface PresentationManagerProps {
  /**
   * Path overrides for presentation backend assets. Need to be overriden by application if it puts these assets someplace else than the default.
   *
   * By default the path to assets directory is determined during the call of [[Presentation.initialize]] using this algorithm:
   *
   * - if path of `.js` file that contains [[PresentationManager]] definition contains "presentation-backend", assume the package is in `node_modules` and the directory structure is:
   *   - `assets/*\*\/*`
   *   - `presentation-backend/{presentation-backend source files}`
   *
   *   which means the assets can be found through a relative path `../assets/` from the JS file being executed.
   *
   * - else, assume the backend is webpacked into a single file with assets next to it:
   *   - `assets/*\*\/*`
   *   - `{source file being executed}.js`
   *
   *   which means the assets can be found through a relative path `./assets/` from the `{source file being executed}`.
   *
   * @deprecated in 4.2. This attribute is not used anymore - the package is not using private assets anymore.
   */
  presentationAssetsRoot?: string | PresentationAssetsRootConfig;

  /**
   * A list of directories containing application's presentation rulesets. Relative
   * paths start from `process.cwd()`. The directories are traversed recursively.
   *
   * @note Only files with `.PresentationRuleSet.json` are read.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing application's supplemental presentation rulesets. Relative
   * paths start from `process.cwd()`. The directories are traversed recursively.
   *
   * @note Only files with `.PresentationRuleSet.json` are read.
   */
  supplementalRulesetDirectories?: string[];

  /**
   * A list of directories containing application's locale-specific localized
   * string files (in simplified i18next v3 format)
   *
   * @deprecated in 3.x. Use [[getLocalizedString]] to localize data returned by [[PresentationManager]].
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager.activeLocale]].
   *
   * @deprecated in 3.x. Use [[getLocalizedString]] to localize data returned by [[PresentationManager]].
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
  defaultFormats?: FormatsMap;

  /**
   * Should schemas preloading be enabled. If true, presentation manager listens
   * for `BriefcaseDb.onOpened` event and force pre-loads all ECSchemas.
   *
   * @deprecated in 3.x. Use [[PresentationProps.enableSchemasPreload]] instead.
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
   *
   * @deprecated in 3.x. The attribute is not used by [[PresentationManager]] anymore
   */
  mode?: PresentationManagerMode; // eslint-disable-line @typescript-eslint/no-deprecated

  /**
   * The interval (in milliseconds) used to poll for presentation data changes. If not set, presentation
   * data changes are not tracked at all.
   *
   * @beta
   * @deprecated in 4.4. The manager now always tracks for iModel data changes without polling.
   */
  updatesPollInterval?: number;

  /** Options for caching. */
  caching?: PresentationManagerCachingConfig;

  /**
   * Use [SQLite's Memory-Mapped I/O](https://sqlite.org/mmap.html) for worker connections. This mode improves performance of handling
   * requests with high I/O intensity, e.g. filtering large tables on non-indexed columns. No downsides have been noticed.
   *
   * Set to a falsy value to turn off. `true` for memory-mapping the whole iModel. Number value for memory-mapping the specified amount of bytes.
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
   * Localization function to localize data returned by presentation manager when it's used directly on the backend (as opposed to when used through RPC, where
   * data is localized on the frontend). Defaults to English localization.
   *
   * @see [Localization]($docs/presentation/advanced/Localization)
   */
  getLocalizedString?: (key: string) => string;

  /**
   * Callback that provides [SchemaContext]($ecschema-metadata) for supplied [IModelDb]($core-backend).
   * [SchemaContext]($ecschema-metadata) is used for getting metadata required for values formatting.
   */
  schemaContextProvider?: (imodel: IModelDb) => SchemaContext;

  /**
   * Parameters for gathering diagnostics at the manager level. When supplied, they're used with every request
   * made through the manager.
   *
   * @see [Diagnostics documentation page]($docs/presentation/advanced/Diagnostics.md)
   */
  diagnostics?: BackendDiagnosticsOptions;
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
   * @deprecated in 3.x. Use [[PresentationManagerProps.getLocalizedString]] to localize data returned by [[PresentationManager]].
   */
  public activeLocale: string | undefined;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: PresentationManagerProps) {
    this._props = props ?? {};
    this._detail = new PresentationManagerDetail(this._props);
    this.activeLocale = this._props.defaultLocale; // eslint-disable-line @typescript-eslint/no-deprecated

    this._localizationHelper = new LocalizationHelper({ getLocalizedString: props?.getLocalizedString ?? getLocalizedStringEN });
  }

  /** Get / set active unit system used to format property values with units */
  public get activeUnitSystem(): UnitSystemKey | undefined {
    return this._detail.activeUnitSystem;
  }
  // istanbul ignore next
  public set activeUnitSystem(value: UnitSystemKey | undefined) {
    this._detail.activeUnitSystem = value;
  }

  /** Dispose the presentation manager. Must be called to clean up native resources. */
  public dispose() {
    this._detail.dispose();
  }

  /** @internal */
  public setOnManagerUsedHandler(handler: () => void) {
    this._detail.setOnManagerUsedHandler(handler);
  }

  /** Properties used to initialize the manager */
  public get props() {
    return this._props;
  }

  /** Get rulesets manager */
  public rulesets(): RulesetManager {
    return this._detail.rulesets;
  }

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
  public async getNodes(
    requestOptions: WithCancelEvent<Prioritized<Paged<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>>> & BackendDiagnosticsAttribute,
  ): Promise<Node[]> {
    const serializedNodesJson = await this._detail.getNodes(requestOptions);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const nodesJson = JSON.parse(serializedNodesJson) as HierarchyLevelJSON;
    const nodes = Node.listFromJSON(nodesJson.nodes);
    return this._localizationHelper.getLocalizedNodes(nodes);
  }

  /**
   * Retrieves nodes count
   * @public
   */
  public async getNodesCount(
    requestOptions: WithCancelEvent<Prioritized<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<number> {
    return this._detail.getNodesCount(requestOptions);
  }

  /**
   * Retrieves hierarchy level descriptor
   * @public
   */
  public async getNodesDescriptor(
    requestOptions: WithCancelEvent<Prioritized<HierarchyLevelDescriptorRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<Descriptor | undefined> {
    const response = await this._detail.getNodesDescriptor(requestOptions);
    const descriptor = Descriptor.fromJSON(JSON.parse(response));
    return descriptor ? this._localizationHelper.getLocalizedContentDescriptor(descriptor) : undefined;
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified instance key paths. Intersecting paths will be merged.
   * TODO: Return results in pages
   * @public
   */
  public async getNodePaths(
    requestOptions: WithCancelEvent<Prioritized<FilterByInstancePathsHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    const result = await this._detail.getNodePaths(requestOptions);
    return result.map((npe) => this._localizationHelper.getLocalizedNodePathElement(npe));
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * TODO: Return results in pages
   * @public
   */
  public async getFilteredNodePaths(
    requestOptions: WithCancelEvent<Prioritized<FilterByTextHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    const result = await this._detail.getFilteredNodePaths(requestOptions);
    return result.map((npe) => this._localizationHelper.getLocalizedNodePathElement(npe));
  }

  /**
   * Get information about the sources of content when building it for specific ECClasses. Sources involve classes of the primary select instance,
   * its related instances for loading related and navigation properties.
   * @public
   */
  public async getContentSources(
    requestOptions: WithCancelEvent<Prioritized<ContentSourcesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute,
  ): Promise<SelectClassInfo[]> {
    return this._detail.getContentSources(requestOptions);
  }

  /**
   * Retrieves the content descriptor which can be used to get content
   * @public
   */
  public async getContentDescriptor(
    requestOptions: WithCancelEvent<Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<Descriptor | undefined> {
    const response = await this._detail.getContentDescriptor(requestOptions);
    const descriptor = Descriptor.fromJSON(JSON.parse(response));
    return descriptor ? this._localizationHelper.getLocalizedContentDescriptor(descriptor) : undefined;
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override
   * @public
   */
  public async getContentSetSize(
    requestOptions: WithCancelEvent<Prioritized<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> &
      BackendDiagnosticsAttribute,
  ): Promise<number> {
    return this._detail.getContentSetSize(requestOptions);
  }

  /**
   * Retrieves the content set based on the supplied content descriptor.
   * @public
   */
  public async getContentSet(
    requestOptions: WithCancelEvent<Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor, KeySet, RulesetVariable>>>> & BackendDiagnosticsAttribute,
  ): Promise<Item[]> {
    let items = await this._detail.getContentSet({
      ...requestOptions,
      ...(!requestOptions.omitFormattedValues && this.props.schemaContextProvider !== undefined ? { omitFormattedValues: true } : undefined),
    });

    if (!requestOptions.omitFormattedValues && this.props.schemaContextProvider !== undefined) {
      const koqPropertyFormatter = new KoqPropertyValueFormatter(this.props.schemaContextProvider(requestOptions.imodel), this.props.defaultFormats);
      const formatter = new ContentFormatter(
        new ContentPropertyValueFormatter(koqPropertyFormatter),
        requestOptions.unitSystem ?? this.props.defaultUnitSystem,
      );
      items = await formatter.formatContentItems(items, requestOptions.descriptor);
    }

    return this._localizationHelper.getLocalizedContentItems(items);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @public
   */
  public async getContent(
    requestOptions: WithCancelEvent<Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>>> &
      BackendDiagnosticsAttribute,
  ): Promise<Content | undefined> {
    const content = await this._detail.getContent({
      ...requestOptions,
      ...(!requestOptions.omitFormattedValues && this.props.schemaContextProvider !== undefined ? { omitFormattedValues: true } : undefined),
    });

    if (!content) {
      return undefined;
    }

    if (!requestOptions.omitFormattedValues && this.props.schemaContextProvider !== undefined) {
      const koqPropertyFormatter = new KoqPropertyValueFormatter(this.props.schemaContextProvider(requestOptions.imodel), this.props.defaultFormats);
      const formatter = new ContentFormatter(
        new ContentPropertyValueFormatter(koqPropertyFormatter),
        requestOptions.unitSystem ?? this.props.defaultUnitSystem,
      );
      await formatter.formatContent(content);
    }

    return this._localizationHelper.getLocalizedContent(content);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions      Options for the request
   * @return A promise object that returns either distinct values on success or an error string on error.
   * @public
   */
  public async getPagedDistinctValues(
    requestOptions: WithCancelEvent<Prioritized<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> &
      BackendDiagnosticsAttribute,
  ): Promise<PagedResponse<DisplayValueGroup>> {
    const result = await this._detail.getPagedDistinctValues(requestOptions);
    return {
      ...result,
      items: result.items.map((g) => this._localizationHelper.getLocalizedDisplayValueGroup(g)),
    };
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @public
   */
  public async getElementProperties<TParsedContent = ElementProperties>(
    requestOptions: WithCancelEvent<Prioritized<SingleElementPropertiesRequestOptions<IModelDb, TParsedContent>>> & BackendDiagnosticsAttribute,
  ): Promise<TParsedContent | undefined>;
  /**
   * Retrieves property data in simplified format for multiple elements specified by class or all element.
   * @return An object that contains element count and AsyncGenerator to iterate over properties of those elements in batches of undefined size.
   * @public
   */
  public async getElementProperties<TParsedContent = ElementProperties>(
    requestOptions: WithCancelEvent<Prioritized<MultiElementPropertiesRequestOptions<IModelDb, TParsedContent>>> & BackendDiagnosticsAttribute,
  ): Promise<MultiElementPropertiesResponse<TParsedContent>>;
  public async getElementProperties<TParsedContent = ElementProperties>(
    requestOptions: WithCancelEvent<
      Prioritized<SingleElementPropertiesRequestOptions<IModelDb, TParsedContent> | MultiElementPropertiesRequestOptions<IModelDb, TParsedContent>>
    > &
      BackendDiagnosticsAttribute,
  ): Promise<TParsedContent | undefined | MultiElementPropertiesResponse<TParsedContent>> {
    if (isSingleElementPropertiesRequestOptions(requestOptions)) {
      return this.getSingleElementProperties<TParsedContent>(requestOptions);
    }
    return this.getMultipleElementProperties<TParsedContent>(requestOptions);
  }

  private async getSingleElementProperties<TParsedContent>(
    requestOptions: WithCancelEvent<Prioritized<SingleElementPropertiesRequestOptions<IModelDb, TParsedContent>>> & BackendDiagnosticsAttribute,
  ): Promise<TParsedContent | undefined> {
    type TParser = Required<typeof requestOptions>["contentParser"];
    const { elementId, contentParser, ...optionsNoElementId } = requestOptions;
    const parser: TParser = contentParser ?? (buildElementProperties as TParser);
    const content = await this.getContent({
      ...optionsNoElementId,
      descriptor: {
        displayType: DefaultContentDisplayTypes.PropertyPane,
        contentFlags: ContentFlags.ShowLabels,
      },
      rulesetOrId: "ElementProperties",
      keys: new KeySet([{ className: "BisCore:Element", id: elementId }]),
    });
    if (!content || content.contentSet.length === 0) {
      return undefined;
    }
    return parser(content.descriptor, content.contentSet[0]);
  }

  private async getMultipleElementProperties<TParsedContent>(
    requestOptions: WithCancelEvent<Prioritized<MultiElementPropertiesRequestOptions<IModelDb, TParsedContent>>> & BackendDiagnosticsAttribute,
  ): Promise<MultiElementPropertiesResponse<TParsedContent>> {
    type TParser = Required<typeof requestOptions>["contentParser"];
    const { elementClasses, contentParser, batchSize, ...contentOptions } = requestOptions;
    const parser: TParser = contentParser ?? (buildElementProperties as TParser);
    const workerThreadsCount = this._props.workerThreadsCount ?? 2;

    // We don't want to request content for all classes at once - each class results in a huge content descriptor object that's cached in memory
    // and can be shared across all batch requests for that class. Handling multiple classes at the same time not only increases memory footprint,
    // but also may push descriptors out of cache, requiring us to recreate them, thus making performance worse. For those reasons we handle at
    // most `workerThreadsCount / 2` classes in parallel.
    // istanbul ignore next
    const classParallelism = workerThreadsCount > 1 ? workerThreadsCount / 2 : 1;

    // We want all worker threads to be constantly busy. However, there's some fairly expensive work being done after the worker thread is done,
    // but before we receive the response. That means the worker thread would be starving if we sent only `workerThreadsCount` requests in parallel.
    // To avoid that, we keep twice as much requests active.
    // istanbul ignore next
    const batchesParallelism = workerThreadsCount > 0 ? workerThreadsCount * 2 : 2;

    const createClassContentRuleset = (fullClassName: string): Ruleset => {
      const [schemaName, className] = parseFullClassName(fullClassName);
      return {
        id: `content/${fullClassName}`,
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: {
                  schemaName,
                  classNames: [className],
                  arePolymorphic: false,
                },
                handlePropertiesPolymorphically: true,
              },
            ],
          },
        ],
      };
    };
    const getContentDescriptor = async (ruleset: Ruleset): Promise<Descriptor> => {
      return (await this.getContentDescriptor({
        ...contentOptions,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.Grid,
        contentFlags: ContentFlags.ShowLabels,
        keys: new KeySet(),
      }))!;
    };

    const obs = getClassesWithInstances(requestOptions.imodel, elementClasses ?? /* istanbul ignore next */ ["BisCore.Element"]).pipe(
      map((classFullName) => ({
        classFullName,
        ruleset: createClassContentRuleset(classFullName),
      })),
      mergeMap(
        ({ classFullName, ruleset }) =>
          // use forkJoin to query descriptor and element ids in parallel
          forkJoin({
            classFullName: of(classFullName),
            ruleset: of(ruleset),
            descriptor: from(getContentDescriptor(ruleset)),
            batches: from(getBatchedClassElementIds(requestOptions.imodel, classFullName, batchSize ?? /* istanbul ignore next */ 1000)),
          }).pipe(
            // split incoming stream into individual batch requests
            mergeMap(({ descriptor, batches }) => from(batches.map((batch) => ({ classFullName, descriptor, batch })))),
            // request content for each batch, filter by IDs for performance
            mergeMap(({ descriptor, batch }) => {
              const filteringDescriptor = new Descriptor(descriptor);
              filteringDescriptor.instanceFilter = {
                selectClassName: classFullName,
                expression: `this.ECInstanceId >= ${Number.parseInt(batch.from, 16)} AND this.ECInstanceId <= ${Number.parseInt(batch.to, 16)}`,
              };
              return from(
                this.getContentSet({
                  ...contentOptions,
                  keys: new KeySet(),
                  descriptor: filteringDescriptor,
                  rulesetOrId: ruleset,
                }),
              ).pipe(map((items) => ({ classFullName, descriptor, items })));
            }, batchesParallelism),
          ),
        classParallelism,
      ),
      map(({ descriptor, items }) => items.map((item) => parser(descriptor, item))),
    );

    return {
      total: getElementsCount(requestOptions.imodel, elementClasses),
      async *iterator() {
        for await (const batch of eachValueFrom(obs)) {
          yield batch;
        }
      },
    };
  }

  /**
   * Retrieves display label definition of specific item
   * @public
   */
  public async getDisplayLabelDefinition(
    requestOptions: WithCancelEvent<Prioritized<DisplayLabelRequestOptions<IModelDb, InstanceKey>>> & BackendDiagnosticsAttribute,
  ): Promise<LabelDefinition> {
    const labelDefinition = await this._detail.getDisplayLabelDefinition(requestOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(labelDefinition);
  }

  /**
   * Retrieves display label definitions of specific items
   * @public
   */
  public async getDisplayLabelDefinitions(
    requestOptions: WithCancelEvent<Prioritized<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>> & BackendDiagnosticsAttribute,
  ): Promise<LabelDefinition[]> {
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
   * @deprecated in 3.x. Use overload with `ComputeSelectionRequestOptions` parameter.
   */
  public async computeSelection(
    requestOptions: SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[]; scopeId: string } & BackendDiagnosticsAttribute,
  ): Promise<KeySet>;
  /**
   * Computes selection based on provided element IDs and selection scope.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public async computeSelection(requestOptions: ComputeSelectionRequestOptions<IModelDb> & BackendDiagnosticsAttribute): Promise<KeySet>;
  public async computeSelection(
    requestOptions: ((SelectionScopeRequestOptions<IModelDb> & { ids: Id64String[]; scopeId: string }) | ComputeSelectionRequestOptions<IModelDb>) &
      BackendDiagnosticsAttribute,
  ): Promise<KeySet> {
    return SelectionScopesHelper.computeSelection(
      isComputeSelectionRequestOptions(requestOptions)
        ? requestOptions
        : (function () {
            const { ids, scopeId, ...rest } = requestOptions;
            return { ...rest, elementIds: ids, scope: { id: scopeId } };
          })(),
    );
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
    if (prevRulesetId.parts.id !== currRulesetId.parts.id) {
      throw new PresentationError(PresentationStatus.InvalidArgument, "Can't compare rulesets with different IDs");
    }

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

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const reviver = (key: string, value: any) => (key === "" ? HierarchyCompareInfo.fromJSON(value) : value);
    return JSON.parse(await this._detail.request(params), reviver);
  }
}
