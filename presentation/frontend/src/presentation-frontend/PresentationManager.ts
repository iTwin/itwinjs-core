/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, IDisposable, Logger } from "@bentley/bentleyjs-core";
import { EventSource, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import {
  Content, ContentDescriptorRequestOptions, ContentRequestOptions, ContentUpdateInfo, Descriptor, DescriptorOverrides, DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions, DisplayValueGroup, DistinctValuesRequestOptions, ExtendedContentRequestOptions, ExtendedHierarchyRequestOptions,
  HierarchyRequestOptions, HierarchyUpdateInfo, InstanceKey, isContentDescriptorRequestOptions, isDisplayLabelRequestOptions,
  isDisplayLabelsRequestOptions, isExtendedContentRequestOptions, isExtendedHierarchyRequestOptions, Item, Key, KeySet, LabelDefinition,
  LabelRequestOptions, Node, NodeKey, NodeKeyJSON, NodePathElement, Paged, PagedResponse, PageOptions, PartialHierarchyModification,
  PresentationDataCompareOptions, PresentationError, PresentationRpcEvents, PresentationRpcInterface, PresentationStatus, PresentationUnitSystem,
  RegisteredRuleset, RequestPriority, RpcRequestsHandler, Ruleset, RulesetVariable, SelectionInfo, UpdateInfo, UpdateInfoJSON,
} from "@bentley/presentation-common";
import { PresentationFrontendLoggerCategory } from "./FrontendLoggerCategory";
import { LocalizationHelper } from "./LocalizationHelper";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./selection/SelectionManager";

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
   * system can later be changed through [[PresentationManager]] or overriden for each request
   *
   * @alpha
   */
  activeUnitSystem?: PresentationUnitSystem;

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
  eventSource?: EventSource;
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

  /**
   * An event raised when hierarchies created using specific ruleset change
   * @alpha
   */
  public onIModelHierarchyChanged = new BeEvent<(args: { ruleset: Ruleset, updateInfo: HierarchyUpdateInfo }) => void>();

  /**
   * An event raised when content created using specific ruleset changes
   * @alpha
   */
  public onIModelContentChanged = new BeEvent<(args: { ruleset: Ruleset, updateInfo: ContentUpdateInfo }) => void>();

  /** Get / set active locale used for localizing presentation data */
  public activeLocale: string | undefined;

  /** Get / set active unit system used to format property values with units */
  public activeUnitSystem: PresentationUnitSystem | undefined;

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

    if (IModelApp.isNativeApp) {
      // EventSource only works in native apps, so the `onUpdate` callback will only be called there. Adding
      // under the condition just to avoid an error message being logged.
      const eventSource = props?.eventSource ?? EventSource.global;
      this._clearEventListener = eventSource.on(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, this.onUpdate);
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
  private onUpdate = (report: UpdateInfoJSON) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.handleUpdateAsync(UpdateInfo.fromJSON(report));
  };

  /** @note This is only called in native apps after changes in iModels */
  private async handleUpdateAsync(report: UpdateInfo) {
    const rulesetIds = new Array<string>();
    for (const rulesetId in report) {
      // istanbul ignore else
      if (report.hasOwnProperty(rulesetId))
        rulesetIds.push(rulesetId);
    }
    const rulesets = (await Promise.all(rulesetIds.map(async (id) => this._rulesets.get(id))))
      .filter<RegisteredRuleset>((ruleset): ruleset is RegisteredRuleset => !!ruleset);
    rulesets.forEach((ruleset: Ruleset) => {
      const updateInfo = report[ruleset.id];
      if (updateInfo.content)
        this.onIModelContentChanged.raiseEvent({ ruleset, updateInfo: updateInfo.content });
      if (updateInfo.hierarchy)
        this.onIModelHierarchyChanged.raiseEvent({ ruleset, updateInfo: updateInfo.hierarchy });
    });
  }

  /** @alpha */
  public async compareHierarchies(props: PresentationDataCompareOptions<IModelConnection, NodeKey>): Promise<PartialHierarchyModification[]> {
    if (!props.prev.rulesetOrId && !props.prev.rulesetVariables)
      return [];

    const options = await this.addRulesetAndVariablesToOptions(props);
    let modifications: PartialHierarchyModification[];
    try {
      modifications = (await this.rpcRequestsHandler.compareHierarchies(this.toRpcTokenOptions(options)))
        .map(PartialHierarchyModification.fromJSON);
    } catch (e) {
      if (e instanceof PresentationError && e.errorNumber === PresentationStatus.Canceled) {
        modifications = [];
      } else {
        // rethrow
        throw e;
      }
    }
    return modifications;
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
      const varsManager = new RulesetVariablesManagerImpl();
      this._rulesetVars.set(rulesetId, varsManager);
    }
    return this._rulesetVars.get(rulesetId)!;
  }

  private toRpcTokenOptions<TOptions extends { imodel: IModelConnection, locale?: string, unitSystem?: PresentationUnitSystem }>(requestOptions: TOptions) {
    // 1. put default `locale` and `unitSystem`
    // 2. put all `requestOptions` members (if `locale` or `unitSystem` are set, they'll override the defaults put at #1)
    // 3. put `imodel` of type `IModelRpcProps` which overwrites the `imodel` from `requestOptions` put at #2
    const managerOptions: Pick<TOptions, "locale" | "unitSystem"> = {};
    if (this.activeLocale)
      managerOptions.locale = this.activeLocale;
    if (this.activeUnitSystem)
      managerOptions.unitSystem = this.activeUnitSystem;
    return {
      ...managerOptions,
      ...requestOptions,
      ...{ imodel: requestOptions.imodel.getRpcProps() },
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
    const variablesManager = this.vars(rulesetId);
    const variables = [...(rulesetVariables || []), ...await variablesManager.getAllVariables()];
    return { ...options, rulesetOrId: foundRulesetOrId, rulesetVariables: variables };
  }

  /**
   * Retrieves nodes
   * @deprecated Use an overload with [[ExtendedHierarchyRequestOptions]]
   */
  public async getNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: NodeKey | undefined): Promise<Node[]>; // eslint-disable-line @typescript-eslint/unified-signatures
  /** Retrieves nodes */
  public async getNodes(requestOptions: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>>): Promise<Node[]>;
  public async getNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection> | ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>>, parentKey?: NodeKey): Promise<Node[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(isExtendedHierarchyRequestOptions(options) ? options.parentKey : parentKey) });
    const result = await buildPagedResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    return this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON));
  }

  /**
   * Retrieves nodes count.
   * @deprecated Use an overload with [[ExtendedHierarchyRequestOptions]]
   */
  public async getNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey: NodeKey | undefined): Promise<number>; // eslint-disable-line @typescript-eslint/unified-signatures
  /** Retrieves nodes count. */
  public async getNodesCount(requestOptions: ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>): Promise<number>;
  public async getNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection> | ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>, parentKey?: NodeKey): Promise<number> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(isExtendedHierarchyRequestOptions(options) ? options.parentKey : parentKey) });
    return this._requestsHandler.getNodesCount(rpcOptions);
  }

  /**
   * Retrieves total nodes count and a single page of nodes.
   * @deprecated Use an overload with [[ExtendedHierarchyRequestOptions]]
   */
  public async getNodesAndCount(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: NodeKey | undefined): Promise<{ count: number, nodes: Node[] }>; // eslint-disable-line @typescript-eslint/unified-signatures
  /** Retrieves total nodes count and a single page of nodes. */
  public async getNodesAndCount(requestOptions: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>>): Promise<{ count: number, nodes: Node[] }>;
  public async getNodesAndCount(requestOptions: Paged<HierarchyRequestOptions<IModelConnection> | ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>>, parentKey?: NodeKey): Promise<{ count: number, nodes: Node[] }> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options, parentKey: optionalNodeKeyToJson(isExtendedHierarchyRequestOptions(options) ? options.parentKey : parentKey) });
    const result = await buildPagedResponse(options.paging, async (partialPageOptions) => this._requestsHandler.getPagedNodes({ ...rpcOptions, paging: partialPageOptions }));
    return {
      count: result.total,
      nodes: this._localizationHelper.getLocalizedNodes(result.items.map(Node.fromJSON)),
    };
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @param requestOptions options for the request
   * @param paths Paths from root node to some child node.
   * @param markedIndex Index of the path in `paths` that will be marked.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);

    const pathsJson = paths.map((p) => p.map(InstanceKey.toJSON));
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const result = await this._requestsHandler.getNodePaths(this.toRpcTokenOptions(options), pathsJson, markedIndex);
    return result.map(NodePathElement.fromJSON);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @param requestOptions options for the request
   * @param filterText Text to filter nodes against.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]> {
    await this.onConnection(requestOptions.imodel);

    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const result = await this._requestsHandler.getFilteredNodePaths(this.toRpcTokenOptions(options), filterText);
    return result.map(NodePathElement.fromJSON);
  }

  /**
   * Loads the whole hierarchy.
   * @param requestOptions options for the request. If `requestOptions.priority` is not set, it defaults to `RequestPriority.Preload`.
   * @return A promise object that resolves as soon as the load request is queued (not when loading finishes)
   * @alpha Will be removed in 3.0.
   */
  public async loadHierarchy(requestOptions: HierarchyRequestOptions<IModelConnection>): Promise<void> {
    await this.onConnection(requestOptions.imodel);

    if (!requestOptions.priority)
      requestOptions.priority = RequestPriority.Preload;
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    return this._requestsHandler.loadHierarchy(this.toRpcTokenOptions(options));
  }

  /**
   * Retrieves the content descriptor which describes the content and can be used to customize it.
   * @deprecated Use an overload with [[ContentDescriptorRequestOptions]]
   */
  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: KeySet, selection: SelectionInfo | undefined): Promise<Descriptor | undefined>;
  /** @beta */
  public async getContentDescriptor(requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet>): Promise<Descriptor | undefined>;
  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection> | ContentDescriptorRequestOptions<IModelConnection, KeySet>, displayType?: string, keys?: KeySet, selection?: SelectionInfo): Promise<Descriptor | undefined> {
    if (!isContentDescriptorRequestOptions(requestOptions))
      return this.getContentDescriptor({ ...requestOptions, displayType: displayType!, keys: keys!, selection });

    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      keys: stripTransientElementKeys(options.keys).toJSON(),
    });
    const result = await this._requestsHandler.getContentDescriptor(rpcOptions);
    return Descriptor.fromJSON(result);
  }

  /**
   * Retrieves content set size based on the supplied content descriptor override.
   * @deprecated Use an overload with [[ExtendedContentRequestOptions]]
   */
  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<number>;
  /** @beta */
  public async getContentSetSize(requestOptions: ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>): Promise<number>;
  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection> | ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>, descriptorOrOverrides?: Descriptor | DescriptorOverrides, keys?: KeySet): Promise<number> {
    if (!isExtendedContentRequestOptions(requestOptions))
      return this.getContentSetSize({ ...requestOptions, descriptor: descriptorOrOverrides!, keys: keys! });

    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
    });
    return this._requestsHandler.getContentSetSize(rpcOptions);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @deprecated Use an overload with [[ExtendedContentRequestOptions]]
   */
  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<Content | undefined>;
  /** @beta */
  public async getContent(requestOptions: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>>): Promise<Content | undefined>;
  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection> | ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>>, argsDescriptor?: Descriptor | DescriptorOverrides, argsKeys?: KeySet): Promise<Content | undefined> {
    if (!isExtendedContentRequestOptions(requestOptions))
      return this.getContent({ ...requestOptions, descriptor: argsDescriptor!, keys: argsKeys! });
    return (await this.getContentAndSize(requestOptions))?.content;
  }

  /**
   * Retrieves the content and content set size based on the supplied content descriptor override.
   * @deprecated Use an overload with [[ExtendedContentRequestOptions]]
   */
  public async getContentAndSize(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<{ content: Content, size: number } | undefined>;
  /** @beta */
  public async getContentAndSize(requestOptions: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>>): Promise<{ content: Content, size: number } | undefined>;
  public async getContentAndSize(requestOptions: Paged<ContentRequestOptions<IModelConnection> | ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>>, argsDescriptor?: Descriptor | DescriptorOverrides, argsKeys?: KeySet): Promise<{ content: Content, size: number } | undefined> {
    if (!isExtendedContentRequestOptions(requestOptions))
      return this.getContentAndSize({ ...requestOptions, descriptor: argsDescriptor!, keys: argsKeys! });

    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
    });
    let descriptor = (requestOptions.descriptor instanceof Descriptor) ? requestOptions.descriptor : undefined;
    const result = await buildPagedResponse(options.paging, async (partialPageOptions, requestIndex) => {
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

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions        options for the request
   * @param descriptorOrOverrides Content descriptor which specifies how the content should be returned.
   * @param keys                  Keys of ECInstances to get the content for.
   * @param fieldName             Name of the field from which to take values.
   * @param maximumValueCount     Maximum numbers of values that can be returned. Unlimited if 0.
   * @return A promise object that returns either distinct values on success or an error string on error.
   */
  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    return this._requestsHandler.getDistinctValues(this.toRpcTokenOptions(options),
      getDescriptorOverrides(descriptorOrOverrides), stripTransientElementKeys(keys).toJSON(), fieldName, maximumValueCount);
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions Options for the request
   * @alpha
   */
  public async getPagedDistinctValues(requestOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor, KeySet>): Promise<PagedResponse<DisplayValueGroup>> {
    await this.onConnection(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = {
      ...this.toRpcTokenOptions(options),
      descriptor: getDescriptorOverrides(options.descriptor),
      keys: stripTransientElementKeys(options.keys).toJSON(),
    };
    const result = await buildPagedResponse(requestOptions.paging, async (partialPageOptions) => this._requestsHandler.getPagedDistinctValues({ ...rpcOptions, paging: partialPageOptions }));
    return {
      ...result,
      items: result.items.map(DisplayValueGroup.fromJSON),
    };
  }

  /**
   * Retrieves display label definition of specific item
   * @deprecated Use an overload with [[DisplayLabelRequestOptions]]
   */
  public async getDisplayLabelDefinition(requestOptions: LabelRequestOptions<IModelConnection>, key: InstanceKey): Promise<LabelDefinition>;
  /** @beta */
  public async getDisplayLabelDefinition(requestOptions: DisplayLabelRequestOptions<IModelConnection, InstanceKey>): Promise<LabelDefinition>;
  public async getDisplayLabelDefinition(requestOptions: LabelRequestOptions<IModelConnection> | DisplayLabelRequestOptions<IModelConnection, InstanceKey>, key?: InstanceKey): Promise<LabelDefinition> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions, key: InstanceKey.toJSON(isDisplayLabelRequestOptions(requestOptions) ? requestOptions.key : key!) });
    const result = await this._requestsHandler.getDisplayLabelDefinition(rpcOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(LabelDefinition.fromJSON(result));
  }
  /**
   * Retrieves display label definition of specific items
   * @deprecated Use an overload with [[DisplayLabelsRequestOptions]]
   */
  public async getDisplayLabelDefinitions(requestOptions: LabelRequestOptions<IModelConnection>, keys: InstanceKey[]): Promise<LabelDefinition[]>;
  /** @beta */
  public async getDisplayLabelDefinitions(requestOptions: DisplayLabelsRequestOptions<IModelConnection, InstanceKey>): Promise<LabelDefinition[]>;
  public async getDisplayLabelDefinitions(requestOptions: LabelRequestOptions<IModelConnection> | DisplayLabelsRequestOptions<IModelConnection, InstanceKey>, keys?: InstanceKey[]): Promise<LabelDefinition[]> {
    await this.onConnection(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions, keys: (isDisplayLabelsRequestOptions(requestOptions) ? requestOptions.keys : keys!).map(InstanceKey.toJSON) });
    const result = await buildPagedResponse(undefined, async (partialPageOptions) => {
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

/** @internal */
export const buildPagedResponse = async <TItem>(requestedPage: PageOptions | undefined, getter: (page: Required<PageOptions>, requestIndex: number) => Promise<PagedResponse<TItem>>): Promise<PagedResponse<TItem>> => {
  const requestedPageStart = requestedPage?.start ?? 0;
  const requestedPageSize = requestedPage?.size ?? 0;
  let pageStart = requestedPageStart;
  let pageSize = requestedPageSize;
  let totalCount;
  let requestIndex = 0;
  const items = new Array<TItem>();
  while (true) {
    const partialResult = await getter({ start: pageStart, size: pageSize }, requestIndex++);
    if (partialResult.total !== 0 && partialResult.items.length === 0) {
      Logger.logError(PresentationFrontendLoggerCategory.Package, "Paged request returned non zero total count but no items");
      return { total: 0, items: [] };
    }
    totalCount = partialResult.total;
    items.push(...partialResult.items);
    if (requestedPageSize !== 0 && items.length >= requestedPageSize || items.length >= (partialResult.total - requestedPageStart))
      break;
    if (requestedPageSize !== 0)
      pageSize -= partialResult.items.length;
    pageStart += partialResult.items.length;
  }
  return { total: totalCount, items };
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
