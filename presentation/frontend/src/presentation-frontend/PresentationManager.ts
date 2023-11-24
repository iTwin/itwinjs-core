/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, CompressedId64Set, IDisposable, OrderedId64Iterable } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, IpcApp } from "@itwin/core-frontend";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import {
  ClientDiagnosticsAttribute, Content, ContentDescriptorRequestOptions, ContentFormatter, ContentInstanceKeysRequestOptions,
  ContentPropertyValueFormatter, ContentRequestOptions, ContentSourcesRequestOptions, ContentUpdateInfo, Descriptor, DescriptorOverrides,
  DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup, DistinctValuesRequestOptions, ElementProperties,
  FilterByInstancePathsHierarchyRequestOptions, FilterByTextHierarchyRequestOptions, FormatsMap, HierarchyLevelDescriptorRequestOptions,
  HierarchyRequestOptions, HierarchyUpdateInfo, InstanceKey, Item, Key, KeySet, KoqPropertyValueFormatter, LabelDefinition, Node, NodeKey,
  NodePathElement, Paged, PagedResponse, PageOptions, PresentationIpcEvents, RpcRequestsHandler, Ruleset, RulesetVariable, SelectClassInfo,
  SingleElementPropertiesRequestOptions, UpdateInfo, VariableValueTypes,
} from "@itwin/presentation-common";
import { IpcRequestsHandler } from "./IpcRequestsHandler";
import { FrontendLocalizationHelper } from "./LocalizationHelper";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./selection/SelectionManager";

/**
 * Data structure that describes IModel hierarchy change event arguments.
 * @alpha
 */
export interface IModelHierarchyChangeEventArgs {
  /** Id of ruleset that was used to create hierarchy. */
  rulesetId: string;
  /** Hierarchy changes info. */
  updateInfo: HierarchyUpdateInfo;
  /** Key of iModel that was used to create hierarchy. It matches [[IModelConnection.key]] property. */
  imodelKey: string;
}

/**
 * Data structure that describes iModel content change event arguments.
 * @alpha
 */
export interface IModelContentChangeEventArgs {
  /** Id of ruleset that was used to create content. */
  rulesetId: string;
  /** Content changes info. */
  updateInfo: ContentUpdateInfo;
  /** Key of iModel that was used to create content. It matches [[IModelConnection.key]] property. */
  imodelKey: string;
}

/**
 * Properties used to configure [[PresentationManager]]
 * @public
 */
export interface PresentationManagerProps {
  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;

  /**
   * Sets the active unit system to use for formatting property values with
   * units. The  value can later be changed through [[PresentationManager.activeUnitSystem]] setter or
   * overriden for each request through request parameters. If not set, `IModelApp.quantityFormatter.activeUnitSystem`
   * is used by default.
   *
   * @deprecated in 4.0. Use [IModelApp.quantityFormatter]($core-frontend) to set the active unit system.
   */
  activeUnitSystem?: UnitSystemKey;

  /**
   * ID used to identify client that requests data. Generally, clients should
   * store this ID in their local storage so the ID can be reused across
   * sessions - this allows reusing some caches.
   *
   * Defaults to a unique GUID as a client id.
   */
  clientId?: string;

  /**
   * Timeout (in milliseconds) for how long we're going to wait for RPC request to be fulfilled before throwing
   * a timeout error.
   *
   * Defaults to 10 minutes.
   */
  requestTimeout?: number;

  /**
   * Callback that provides [SchemaContext]($ecschema-metadata) for supplied [IModelConnection]($core-frontend).
   * [SchemaContext]($ecschema-metadata) is used for getting metadata required for values formatting.
   * @alpha
   */
  schemaContextProvider?: (imodel: IModelConnection) => SchemaContext;

  /**
   * A map of default unit formats to use for formatting properties that don't have a presentation format
   * in requested unit system.
   *
   * @note Only has effect when frontend value formatting is enabled by supplying the `schemaContextProvider` prop.
   * @alpha
   */
  defaultFormats?: FormatsMap;

  /** @internal */
  rpcRequestsHandler?: RpcRequestsHandler;

  /** @internal */
  ipcRequestsHandler?: IpcRequestsHandler;
}

/**
 * Frontend Presentation manager which basically just forwards all calls to
 * the backend implementation.
 *
 * @public
 */
export class PresentationManager implements IDisposable {
  private _requestsHandler: RpcRequestsHandler;
  private _rulesets: RulesetManager;
  private _localizationHelper: FrontendLocalizationHelper;
  private _explicitActiveUnitSystem: UnitSystemKey | undefined;
  private _rulesetVars: Map<string, RulesetVariablesManager>;
  private _clearEventListener?: () => void;
  private _connections: Map<IModelConnection, Promise<void>>;
  private _schemaContextProvider?: (imodel: IModelConnection) => SchemaContext;
  private _defaultFormats?: FormatsMap;
  private _ipcRequestsHandler?: IpcRequestsHandler;

  /**
   * An event raised when hierarchies created using specific ruleset change
   * @alpha
   */
  public onIModelHierarchyChanged = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();

  /**
   * An event raised when content created using specific ruleset changes
   * @alpha
   */
  public onIModelContentChanged = new BeEvent<(args: IModelContentChangeEventArgs) => void>();

  /**
   * Get / set active unit system used to format property values with units.
   *
   * @deprecated in 4.0. `IModelApp.quantityFormatter` should be used to get/set the active unit system. At the moment
   * [[PresentationManager]] allows overriding it, but returns `IModelApp.quantityFormatter.activeUnitSystem` if override
   * is not set.
   */
  public get activeUnitSystem(): UnitSystemKey {
    return this._explicitActiveUnitSystem ?? IModelApp.quantityFormatter.activeUnitSystem;
  }
  public set activeUnitSystem(value: UnitSystemKey | undefined) { this._explicitActiveUnitSystem = value; }

  private constructor(props?: PresentationManagerProps) {
    if (props) {
      // eslint-disable-next-line deprecation/deprecation
      this._explicitActiveUnitSystem = props.activeUnitSystem;
    }

    this._requestsHandler = props?.rpcRequestsHandler ?? new RpcRequestsHandler(props ? { clientId: props.clientId, timeout: props.requestTimeout } : undefined);
    this._rulesetVars = new Map<string, RulesetVariablesManager>();
    this._rulesets = RulesetManagerImpl.create();
    this._localizationHelper = new FrontendLocalizationHelper(props?.activeLocale);
    this._connections = new Map<IModelConnection, Promise<void>>();
    this._schemaContextProvider = props?.schemaContextProvider;
    this._defaultFormats = props?.defaultFormats;

    if (IpcApp.isValid) {
      // Ipc only works in ipc apps, so the `onUpdate` callback will only be called there.
      this._clearEventListener = IpcApp.addListener(PresentationIpcEvents.Update, this.onUpdate);
      this._ipcRequestsHandler = props?.ipcRequestsHandler ?? new IpcRequestsHandler(this._requestsHandler.clientId);
    }
  }

  /** Get / set active locale used for localizing presentation data */
  public get activeLocale(): string | undefined { return this._localizationHelper.locale; }
  public set activeLocale(locale: string | undefined) { this._localizationHelper.locale = locale; }

  public dispose() {
    if (this._clearEventListener) {
      this._clearEventListener();
      this._clearEventListener = undefined;
    }
  }

  private async onConnection(imodel: IModelConnection) {
    if (!this._connections.has(imodel))
      this._connections.set(imodel, this.initializeIModel(imodel));
    await this._connections.get(imodel);
  }

  private async initializeIModel(imodel: IModelConnection) {
    imodel.onClose.addOnce(() => {
      this._connections.delete(imodel);
    });
    await this.onNewiModelConnection(imodel);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onUpdate = (_evt: Event, report: UpdateInfo) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.handleUpdateAsync(report);
  };

  /** @note This is only called in native apps after changes in iModels */
  private async handleUpdateAsync(report: UpdateInfo) {
    for (const imodelKey in report) {
      // istanbul ignore if
      if (!report.hasOwnProperty(imodelKey))
        continue;

      const imodelReport = report[imodelKey];
      for (const rulesetId in imodelReport) {
        // istanbul ignore if
        if (!imodelReport.hasOwnProperty(rulesetId))
          continue;

        const updateInfo = imodelReport[rulesetId];
        if (updateInfo.content)
          this.onIModelContentChanged.raiseEvent({ rulesetId, updateInfo: updateInfo.content, imodelKey });
        if (updateInfo.hierarchy)
          this.onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: updateInfo.hierarchy, imodelKey });
      }
    }
  }

  /**
   * Function that is called when a new IModelConnection is used to retrieve data.
   * @internal
   */
  public async onNewiModelConnection(_: IModelConnection) { }

  /**
   * Create a new PresentationManager instance
   * @param props Optional properties used to configure the manager
   */
  public static create(props?: PresentationManagerProps) {
    return new PresentationManager(props);
  }

  /** @internal */
  public get rpcRequestsHandler() { return this._requestsHandler; }

  /** @internal */
  public get ipcRequestsHandler() { return this._ipcRequestsHandler; }

  /**
   * Get rulesets manager
   */
  public rulesets() { return this._rulesets; }

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get the vars manager for
   */
  public vars(rulesetId: string) {
    if (!this._rulesetVars.has(rulesetId)) {
      const varsManager = new RulesetVariablesManagerImpl(rulesetId, this._ipcRequestsHandler);
      this._rulesetVars.set(rulesetId, varsManager);
    }
    return this._rulesetVars.get(rulesetId)!;
  }

  private toRpcTokenOptions<TOptions extends { imodel: IModelConnection, locale?: string, unitSystem?: UnitSystemKey, rulesetVariables?: RulesetVariable[] }>(requestOptions: TOptions) {
    // 1. put default `locale` and `unitSystem`
    // 2. put all `requestOptions` members (if `locale` or `unitSystem` are set, they'll override the defaults put at #1)
    // 3. put `imodel` of type `IModelRpcProps` which overwrites the `imodel` from `requestOptions` put at #2
    const defaultOptions: Pick<TOptions, "locale" | "unitSystem"> = {};
    if (this.activeLocale)
      defaultOptions.locale = this.activeLocale;
    defaultOptions.unitSystem = this.activeUnitSystem; // eslint-disable-line deprecation/deprecation

    const { imodel, rulesetVariables, ...rpcRequestOptions } = requestOptions;
    return {
      ...defaultOptions,
      ...rpcRequestOptions,
      ...(rulesetVariables ? { rulesetVariables: rulesetVariables.map(RulesetVariable.toJSON) } : {}),
      imodel: imodel.getRpcProps(),
    };
  }

  private async addRulesetAndVariablesToOptions<TOptions extends { rulesetOrId: Ruleset | string, rulesetVariables?: RulesetVariable[] }>(options: TOptions) {
    const { rulesetOrId, rulesetVariables } = options;
    let foundRulesetOrId: Ruleset | string;
    if (typeof rulesetOrId === "object") {
      foundRulesetOrId = rulesetOrId;
    } else {
      const foundRuleset = await this._rulesets.get(rulesetOrId);
      foundRulesetOrId = foundRuleset ? foundRuleset.toJSON() : rulesetOrId;
    }
    const rulesetId = (typeof foundRulesetOrId === "object") ? foundRulesetOrId.id : foundRulesetOrId;

    // All Id64Array variable values must be sorted for serialization to JSON to work. RulesetVariablesManager
    // sorts them before storing, so that part is taken care of, but we need to ensure that variables coming from
    // request options are also sorted.
    const variables = (rulesetVariables ?? []).map((variable) => {
      if (variable.type === VariableValueTypes.Id64Array)
        return { ...variable, value: OrderedId64Iterable.sortArray(variable.value) };
      return variable;
    });
    if (!this._ipcRequestsHandler) {
      // only need to add variables from variables manager if there's no IPC
      // handler - if there is one, the variables are already known by the backend
      variables.push(...this.vars(rulesetId).getAllVariables());
    }

    return { ...options, rulesetOrId: foundRulesetOrId, rulesetVariables: variables };
  }

  /** Retrieves nodes */
  public async getNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>> & ClientDiagnosticsAttribute): Promise<Node[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    const result = await buildPagedArrayResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    // eslint-disable-next-line deprecation/deprecation
    return this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON));
  }

  /** Retrieves nodes count. */
  public async getNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable> & ClientDiagnosticsAttribute): Promise<number> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    return this._requestsHandler.getNodesCount(rpcOptions);
  }

  /** Retrieves total nodes count and a single page of nodes. */
  public async getNodesAndCount(requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>> & ClientDiagnosticsAttribute): Promise<{ count: number, nodes: Node[] }> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    const result = await buildPagedArrayResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    return {
      count: result.total,
      // eslint-disable-next-line deprecation/deprecation
      nodes: this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON)),
    };
  }

  /**
   * Retrieves hierarchy level descriptor.
   * @beta
   */
  public async getNodesDescriptor(requestOptions: HierarchyLevelDescriptorRequestOptions<IModelConnection, NodeKey, RulesetVariable> & ClientDiagnosticsAttribute): Promise<Descriptor | undefined> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    const result = await this._requestsHandler.getNodesDescriptor(rpcOptions);
    return Descriptor.fromJSON(result);
  }

  /** Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged. */
  public async getNodePaths(requestOptions: FilterByInstancePathsHierarchyRequestOptions<IModelConnection, RulesetVariable> & ClientDiagnosticsAttribute): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    const result = await this._requestsHandler.getNodePaths(rpcOptions);
    // eslint-disable-next-line deprecation/deprecation
    return result.map(NodePathElement.fromJSON);
  }

  /** Retrieves paths from root nodes to nodes containing filter text in their label. */
  public async getFilteredNodePaths(requestOptions: FilterByTextHierarchyRequestOptions<IModelConnection, RulesetVariable> & ClientDiagnosticsAttribute): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const result = await this._requestsHandler.getFilteredNodePaths(this.toRpcTokenOptions(options));
    // eslint-disable-next-line deprecation/deprecation
    return result.map(NodePathElement.fromJSON);
  }

  /**
   * Get information about the sources of content when building it for specific ECClasses. Sources involve classes of the primary select instance,
   * its related instances for loading related and navigation properties.
   * @public
   */
  public async getContentSources(requestOptions: ContentSourcesRequestOptions<IModelConnection> & ClientDiagnosticsAttribute): Promise<SelectClassInfo[]> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions(requestOptions);
    const result = await this._requestsHandler.getContentSources(rpcOptions);
    return SelectClassInfo.listFromCompressedJSON(result.sources, result.classesMap);
  }

  /** Retrieves the content descriptor which describes the content and can be used to customize it. */
  public async getContentDescriptor(requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet, RulesetVariable> & ClientDiagnosticsAttribute): Promise<Descriptor | undefined> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      keys: stripTransientElementKeys(options.keys).toJSON(),
    });
    const result = await this._requestsHandler.getContentDescriptor(rpcOptions);
    return Descriptor.fromJSON(result);
  }

  /** Retrieves overall content set size. */
  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable> & ClientDiagnosticsAttribute): Promise<number> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
    });
    return this._requestsHandler.getContentSetSize(rpcOptions);
  }

  /** Retrieves content which consists of a content descriptor and a page of records. */
  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>> & ClientDiagnosticsAttribute): Promise<Content | undefined> {
    return (await this.getContentAndSize(requestOptions))?.content;
  }

  /** Retrieves content set size and content which consists of a content descriptor and a page of records. */
  public async getContentAndSize(requestOptions: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>> & ClientDiagnosticsAttribute): Promise<{ content: Content, size: number } | undefined> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
      ...(!requestOptions.omitFormattedValues && this._schemaContextProvider !== undefined ? { omitFormattedValues: true } : undefined),
    });
    let descriptor = (requestOptions.descriptor instanceof Descriptor) ? requestOptions.descriptor : undefined;
    const result = await buildPagedArrayResponse(options.paging, async (partialPageOptions, requestIndex) => {
      if (0 === requestIndex && !descriptor) {
        const content = await this._requestsHandler.getPagedContent({ ...rpcOptions, paging: partialPageOptions });
        if (content) {
          descriptor = Descriptor.fromJSON(content.descriptor);
          return content.contentSet;
        }
        return { total: 0, items: [] };
      }
      return this._requestsHandler.getPagedContentSet({ ...rpcOptions, paging: partialPageOptions });
    });
    if (!descriptor)
      return undefined;

    const items = result.items.map((itemJson) => Item.fromJSON(itemJson)).filter<Item>((item): item is Item => (item !== undefined));
    const resultContent = new Content(descriptor, items);
    if (!requestOptions.omitFormattedValues && this._schemaContextProvider) {
      const koqPropertyFormatter = new KoqPropertyValueFormatter(this._schemaContextProvider(requestOptions.imodel), this._defaultFormats);
      const contentFormatter = new ContentFormatter(
        new ContentPropertyValueFormatter(koqPropertyFormatter),
        requestOptions.unitSystem ?? this._explicitActiveUnitSystem ?? IModelApp.quantityFormatter.activeUnitSystem,
      );
      await contentFormatter.formatContent(resultContent);
    }

    return {
      size: result.total,
      content: this._localizationHelper.getLocalizedContent(resultContent),
    };
  }

  /** Retrieves distinct values of specific field from the content. */
  public async getPagedDistinctValues(requestOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable> & ClientDiagnosticsAttribute): Promise<PagedResponse<DisplayValueGroup>> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = {
      ...this.toRpcTokenOptions(options),
      descriptor: getDescriptorOverrides(options.descriptor),
      keys: stripTransientElementKeys(options.keys).toJSON(),
    };
    const result = await buildPagedArrayResponse(requestOptions.paging, async (partialPageOptions) => this._requestsHandler.getPagedDistinctValues({ ...rpcOptions, paging: partialPageOptions }));
    return {
      ...result,
      // eslint-disable-next-line deprecation/deprecation
      items: result.items.map(DisplayValueGroup.fromJSON),
    };
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @public
   */
  public async getElementProperties(requestOptions: SingleElementPropertiesRequestOptions<IModelConnection> & ClientDiagnosticsAttribute): Promise<ElementProperties | undefined> {
    await this.onConnection(requestOptions.imodel);
    const results = await this._requestsHandler.getElementProperties(this.toRpcTokenOptions(requestOptions));
    // istanbul ignore if
    if (!results)
      return undefined;
    return this._localizationHelper.getLocalizedElementProperties(results);
  }

  /**
   * Retrieves content item instance keys.
   * @public
   */
  public async getContentInstanceKeys(requestOptions: ContentInstanceKeysRequestOptions<IModelConnection, KeySet, RulesetVariable> & ClientDiagnosticsAttribute): Promise<{ total: number, items: () => AsyncGenerator<InstanceKey> }> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = {
      ...this.toRpcTokenOptions(options),
      keys: stripTransientElementKeys(options.keys).toJSON(),
    };

    const props = {
      page: requestOptions.paging,
      get: async (page: Required<PageOptions>) => {
        const keys = await this._requestsHandler.getContentInstanceKeys({ ...rpcOptions, paging: page });
        return {
          total: keys.total,
          items: keys.items.instanceKeys.reduce((instanceKeys, entry) => {
            for (const id of CompressedId64Set.iterable(entry[1])) {
              instanceKeys.push({ className: entry[0], id });
            }
            return instanceKeys;
          }, new Array<InstanceKey>()),
        };
      },
    };
    return createPagedGeneratorResponse(props);
  }

  /** Retrieves display label definition of specific item. */
  public async getDisplayLabelDefinition(requestOptions: DisplayLabelRequestOptions<IModelConnection, InstanceKey> & ClientDiagnosticsAttribute): Promise<LabelDefinition> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions });
    const result = await this._requestsHandler.getDisplayLabelDefinition(rpcOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(result);
  }

  /** Retrieves display label definition of specific items. */
  public async getDisplayLabelDefinitions(requestOptions: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> & ClientDiagnosticsAttribute): Promise<LabelDefinition[]> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions });
    const result = await buildPagedArrayResponse(undefined, async (partialPageOptions) => {
      const partialKeys = (!partialPageOptions.start) ? rpcOptions.keys : rpcOptions.keys.slice(partialPageOptions.start);
      return this._requestsHandler.getPagedDisplayLabelDefinitions({ ...rpcOptions, keys: partialKeys });
    });
    return this._localizationHelper.getLocalizedLabelDefinitions(result.items);
  }

}

const getDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor)
    return descriptorOrOverrides.createDescriptorOverrides();
  return descriptorOrOverrides;
};

interface PagedGeneratorCreateProps<TPagedResponseItem> {
  page: PageOptions | undefined;
  get: (pageStart: Required<PageOptions>, requestIndex: number) => Promise<{ total: number, items: TPagedResponseItem[] }>;
}
async function createPagedGeneratorResponse<TPagedResponseItem>(props: PagedGeneratorCreateProps<TPagedResponseItem>) {
  let pageStart = props.page?.start ?? 0;
  let pageSize = props.page?.size ?? 0;
  let requestIndex = 0;

  const firstPage = await props.get({ start: pageStart, size: pageSize }, requestIndex++);
  return {
    total: firstPage.total,
    async *items() {
      let partialResult = firstPage;
      while (true) {
        for (const item of partialResult.items) {
          yield item;
        }

        const receivedItemsCount = partialResult.items.length;
        if (partialResult.total !== 0 && receivedItemsCount === 0) {
          if (pageStart >= partialResult.total)
            throw new Error(`Requested page with start index ${pageStart} is out of bounds. Total number of items: ${partialResult.total}`);
          throw new Error("Paged request returned non zero total count but no items");
        }

        if (pageSize !== 0 && receivedItemsCount >= pageSize || receivedItemsCount >= (partialResult.total - pageStart))
          break;

        if (pageSize !== 0)
          pageSize -= receivedItemsCount;
        pageStart += receivedItemsCount;

        partialResult = await props.get({ start: pageStart, size: pageSize }, requestIndex++);
      }
    },
  };
}

/** @internal */
export const buildPagedArrayResponse = async <TItem>(requestedPage: PageOptions | undefined, getter: (page: Required<PageOptions>, requestIndex: number) => Promise<PagedResponse<TItem>>): Promise<PagedResponse<TItem>> => {
  const items = new Array<TItem>();
  const gen = await createPagedGeneratorResponse({ page: requestedPage, get: getter });
  for await (const item of gen.items()) {
    items.push(item);
  }
  return { total: gen.total, items };
};

const stripTransientElementKeys = (keys: KeySet) => {
  if (!keys.some((key) => Key.isInstanceKey(key) && key.className === TRANSIENT_ELEMENT_CLASSNAME))
    return keys;

  const copy = new KeySet();
  copy.add(keys, (key) => {
    // the callback is not going to be called with EntityProps as KeySet converts them
    // to InstanceKeys, but we want to keep the EntityProps case for correctness
    // istanbul ignore next
    const isTransient = Key.isInstanceKey(key) && key.className === TRANSIENT_ELEMENT_CLASSNAME
      || Key.isEntityProps(key) && key.classFullName === TRANSIENT_ELEMENT_CLASSNAME;
    return !isTransient;
  });
  return copy;
};
