/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, CompressedId64Set, IDisposable, OrderedId64Iterable } from "@itwin/core-bentley";
import { IModelConnection, IpcApp } from "@itwin/core-frontend";
import { UnitSystemKey } from "@itwin/core-quantity";
import {
  Content, ContentDescriptorRequestOptions, ContentInstanceKeysRequestOptions, ContentRequestOptions, ContentSourcesRequestOptions, ContentUpdateInfo,
  Descriptor, DescriptorOverrides, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DisplayValueGroup, DistinctValuesRequestOptions,
  ElementProperties, FilterByInstancePathsHierarchyRequestOptions, FilterByTextHierarchyRequestOptions,
  HierarchyRequestOptions, HierarchyUpdateInfo, InstanceKey, Item, Key, KeySet, LabelDefinition,
  Node, NodeKey, NodeKeyJSON, NodePathElement, Paged, PagedResponse, PageOptions, PresentationIpcEvents,
  RpcRequestsHandler, Ruleset, RulesetVariable, SelectClassInfo, SingleElementPropertiesRequestOptions, UpdateInfo, UpdateInfoJSON,
  VariableValueTypes,
} from "@itwin/presentation-common";
import { IpcRequestsHandler } from "./IpcRequestsHandler";
import { LocalizationHelper } from "./LocalizationHelper";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./selection/SelectionManager";
import { StateTracker } from "./StateTracker";

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
   * units. Default presentation units are used if this is not specified. The active unit
   * system can later be changed through [[PresentationManager]] or overriden for each request.
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

  /** @internal */
  rpcRequestsHandler?: RpcRequestsHandler;

  /** @internal */
  ipcRequestsHandler?: IpcRequestsHandler;

  /** @internal */
  stateTracker?: StateTracker;
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
  private _localizationHelper: LocalizationHelper;
  private _rulesetVars: Map<string, RulesetVariablesManager>;
  private _clearEventListener?: () => void;
  private _connections: Map<IModelConnection, Promise<void>>;
  private _ipcRequestsHandler?: IpcRequestsHandler;
  private _stateTracker?: StateTracker;

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

  /** Get / set active locale used for localizing presentation data */
  public activeLocale: string | undefined;

  /** Get / set active unit system used to format property values with units */
  public activeUnitSystem: UnitSystemKey | undefined;

  private constructor(props?: PresentationManagerProps) {
    if (props) {
      this.activeLocale = props.activeLocale;
      this.activeUnitSystem = props.activeUnitSystem;
    }

    this._requestsHandler = props?.rpcRequestsHandler ?? new RpcRequestsHandler(props ? { clientId: props.clientId } : undefined);
    this._rulesetVars = new Map<string, RulesetVariablesManager>();
    this._rulesets = RulesetManagerImpl.create();
    this._localizationHelper = new LocalizationHelper();
    this._connections = new Map<IModelConnection, Promise<void>>();

    if (IpcApp.isValid) {
      // Ipc only works in ipc apps, so the `onUpdate` callback will only be called there.
      this._clearEventListener = IpcApp.addListener(PresentationIpcEvents.Update, this.onUpdate);
      this._ipcRequestsHandler = props?.ipcRequestsHandler ?? new IpcRequestsHandler(this._requestsHandler.clientId);
      this._stateTracker = props?.stateTracker ?? new StateTracker(this._ipcRequestsHandler);
    }
  }

  public dispose() {
    this._requestsHandler.dispose();
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
  private onUpdate = (_evt: Event, report: UpdateInfoJSON) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.handleUpdateAsync(UpdateInfo.fromJSON(report));
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

  /** Function that is called when a new IModelConnection is used to retrieve data.
   *  @internal
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

  /** @internal */
  public get stateTracker() { return this._stateTracker; }

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
    if (this.activeUnitSystem)
      defaultOptions.unitSystem = this.activeUnitSystem;

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
  public async getNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>>): Promise<Node[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(options.parentKey) });
    const result = await buildPagedArrayResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    return this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON));
  }

  /** Retrieves nodes count. */
  public async getNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>): Promise<number> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(options.parentKey) });
    return this._requestsHandler.getNodesCount(rpcOptions);
  }

  /** Retrieves total nodes count and a single page of nodes. */
  public async getNodesAndCount(requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>>): Promise<{ count: number, nodes: Node[] }> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(options.parentKey) });
    const result = await buildPagedArrayResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    return {
      count: result.total,
      nodes: this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON)),
    };
  }

  /** Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged. */
  public async getNodePaths(requestOptions: FilterByInstancePathsHierarchyRequestOptions<IModelConnection, RulesetVariable>): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, instancePaths: options.instancePaths.map((p) => p.map(InstanceKey.toJSON)) });
    const result = await this._requestsHandler.getNodePaths(rpcOptions);
    return result.map(NodePathElement.fromJSON);
  }

  /** Retrieves paths from root nodes to nodes containing filter text in their label. */
  public async getFilteredNodePaths(requestOptions: FilterByTextHierarchyRequestOptions<IModelConnection, RulesetVariable>): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const result = await this._requestsHandler.getFilteredNodePaths(this.toRpcTokenOptions(options));
    return result.map(NodePathElement.fromJSON);
  }

  /**
   * Get all content sources for a given list of classes.
   * @beta
   */
  public async getContentSources(requestOptions: ContentSourcesRequestOptions<IModelConnection>): Promise<SelectClassInfo[]> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions(requestOptions);
    const result = await this._requestsHandler.getContentSources(rpcOptions);
    return SelectClassInfo.listFromCompressedJSON(result.sources, result.classesMap);
  }

  /** Retrieves the content descriptor which describes the content and can be used to customize it. */
  public async getContentDescriptor(requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet, RulesetVariable>): Promise<Descriptor | undefined> {
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
  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>): Promise<number> {
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
  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>): Promise<Content | undefined> {
    return (await this.getContentAndSize(requestOptions))?.content;
  }

  /** Retrieves content set size and content which consists of a content descriptor and a page of records. */
  public async getContentAndSize(requestOptions: Paged<ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>): Promise<{ content: Content, size: number } | undefined> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
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
    return {
      size: result.total,
      content: this._localizationHelper.getLocalizedContent(new Content(descriptor, items)),
    };
  }

  /** Retrieves distinct values of specific field from the content. */
  public async getPagedDistinctValues(requestOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>): Promise<PagedResponse<DisplayValueGroup>> {
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
      items: result.items.map(DisplayValueGroup.fromJSON),
    };
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @beta
   */
  public async getElementProperties(requestOptions: SingleElementPropertiesRequestOptions<IModelConnection>): Promise<ElementProperties | undefined> {
    await this.onConnection(requestOptions.imodel);
    return this._requestsHandler.getElementProperties(this.toRpcTokenOptions(requestOptions));
  }

  /**
   * Retrieves content item instance keys.
   * @alpha
   */
  public async getContentInstanceKeys(requestOptions: ContentInstanceKeysRequestOptions<IModelConnection, KeySet, RulesetVariable>): Promise<{ total: number, items: () => AsyncGenerator<InstanceKey> }> {
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
  public async getDisplayLabelDefinition(requestOptions: DisplayLabelRequestOptions<IModelConnection, InstanceKey>): Promise<LabelDefinition> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions, key: InstanceKey.toJSON(requestOptions.key) });
    const result = await this._requestsHandler.getDisplayLabelDefinition(rpcOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(LabelDefinition.fromJSON(result));
  }

  /** Retrieves display label definition of specific items. */
  public async getDisplayLabelDefinitions(requestOptions: DisplayLabelsRequestOptions<IModelConnection, InstanceKey>): Promise<LabelDefinition[]> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions, keys: requestOptions.keys.map(InstanceKey.toJSON) });
    const result = await buildPagedArrayResponse(undefined, async (partialPageOptions) => {
      const partialKeys = (!partialPageOptions.start) ? rpcOptions.keys : rpcOptions.keys.slice(partialPageOptions.start);
      return this._requestsHandler.getPagedDisplayLabelDefinitions({ ...rpcOptions, keys: partialKeys });
    });
    return this._localizationHelper.getLocalizedLabelDefinitions(result.items.map(LabelDefinition.fromJSON));
  }

}

const getDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor)
    return descriptorOrOverrides.createDescriptorOverrides();
  return descriptorOrOverrides;
};

const optionalNodeKeyToJson = (key: NodeKey | undefined): NodeKeyJSON | undefined => key ? NodeKey.toJSON(key) : undefined;

interface PagedGeneratorCreateProps<TPagedResponseItem> {
  page: PageOptions | undefined;
  get: (pageStart: Required<PageOptions>, requestIndex: number) => Promise<{ total: number, items: TPagedResponseItem[] }>;
}
async function createPagedGeneratorResponse<TPagedResponseItem>(props: PagedGeneratorCreateProps<TPagedResponseItem>) {
  const requestedPageStart = props.page?.start ?? 0;
  const requestedPageSize = props.page?.size ?? 0;
  let pageStart = requestedPageStart;
  let pageSize = requestedPageSize;
  let receivedItemsCount = 0;
  let requestIndex = 0;

  const firstPage = await props.get({ start: pageStart, size: pageSize }, requestIndex++);
  return {
    total: firstPage.total,
    async *items() {
      let partialResult = firstPage;
      while (true) {
        for (const item of partialResult.items) {
          yield item;
          ++receivedItemsCount;
        }

        if (partialResult.total !== 0 && receivedItemsCount === 0) {
          if (pageStart >= partialResult.total)
            throw new Error(`Requested page with start index ${pageStart} is out of bounds. Total number of items: ${partialResult.total}`);
          throw new Error("Paged request returned non zero total count but no items");
        }

        if (requestedPageSize !== 0 && receivedItemsCount >= requestedPageSize || receivedItemsCount >= (partialResult.total - requestedPageStart))
          break;

        if (requestedPageSize !== 0)
          pageSize = requestedPageSize - receivedItemsCount;
        pageStart = requestedPageStart + receivedItemsCount;

        partialResult = await props.get({ start: pageStart, size: pageSize }, requestIndex++);
      }
    },
  };
}

/** @internal */
export const buildPagedArrayResponse = async <TItem>(requestedPage: PageOptions | undefined, getter: (page: Required<PageOptions>, requestIndex: number) => Promise<PagedResponse<TItem>>): Promise<PagedResponse<TItem>> => {
  try {
    const items = new Array<TItem>();
    const gen = await createPagedGeneratorResponse({ page: requestedPage, get: getter });
    for await (const item of gen.items()) {
      items.push(item);
    }
    return { total: gen.total, items };
  } catch {
    return { total: 0, items: [] };
  }
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
