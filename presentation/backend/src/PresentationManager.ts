/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import * as hash from "object-hash";
import { ClientRequestContext, Id64String, Id64, DbResult, Logger } from "@bentley/bentleyjs-core";
import { IModelDb, Element, GeometricElement } from "@bentley/imodeljs-backend";
import {
  PresentationError, PresentationStatus,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  DescriptorOverrides, Paged, KeySet, InstanceKey, LabelRequestOptions,
  SelectionScopeRequestOptions, SelectionScope, DefaultContentDisplayTypes,
  ContentFlags, Ruleset, RulesetVariable, RequestPriority,
} from "@bentley/presentation-common";
import { NativePlatformDefinition, createDefaultNativePlatform, NativePlatformRequestTypes } from "./NativePlatform";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";

/**
 * Properties that can be used to configure [[PresentationManager]]
 * @public
 */
export interface PresentationManagerProps {
  /**
   * A list of directories containing presentation rulesets.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing supplemental presentation rulesets.
   */
  supplementalRulesetDirectories?: string[];

  /**
   * A list of directories containing locale-specific localized
   * string files (in simplified i18next v3 format)
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;

  /**
   * Should schemas preloading be enabled. If true, presentation manager listens
   * for `IModelDb.onOpened` event and force pre-loads all ECSchemas.
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
   *
   * @alpha
   */
  taskAllocationsMap?: { [priority: number]: number };

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

  /**
   * Get / set active locale used for localizing presentation data
   */
  public activeLocale: string | undefined;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: PresentationManagerProps) {
    this._props = props || {};
    this._isDisposed = false;
    if (props && props.addon) {
      this._nativePlatform = props.addon;
    } else {
      const nativePlatformImpl = createDefaultNativePlatform(this._props.id || "",
        createLocaleDirectoryList(props), createTaskAllocationsMap(props));
      this._nativePlatform = new nativePlatformImpl();
    }
    this.setupRulesetDirectories(props);
    if (props)
      this.activeLocale = props.activeLocale;
    this._rulesets = new RulesetManagerImpl(this.getNativePlatform);
    if (this._props.enableSchemasPreload)
      this._disposeIModelOpenedListener = IModelDb.onOpened.addListener(this.onIModelOpened);
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

  // tslint:disable-next-line: naming-convention
  private onIModelOpened = (requestContext: ClientRequestContext, imodel: IModelDb) => {
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    // tslint:disable-next-line: no-floating-promises
    this.getNativePlatform().forceLoadSchemas(requestContext, imodelAddon);
  }

  /** @internal */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new PresentationError(PresentationStatus.UseAfterDisposal, "Attempting to use Presentation manager after disposal");
    return this._nativePlatform!;
  }

  private setupRulesetDirectories(props?: PresentationManagerProps) {
    const supplementalRulesetDirectories = [path.join(__dirname, "assets", "supplemental-presentation-rules")];
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

  private ensureRulesetRegistered<TOptions extends { rulesetOrId?: Ruleset | string, rulesetId?: string }>(options: TOptions) {
    const { rulesetOrId, rulesetId, ...strippedOptions } = options;

    if (!rulesetOrId && !rulesetId)
      throw new PresentationError(PresentationStatus.InvalidArgument, "Neither ruleset nor ruleset id are supplied");

    let nativeRulesetId: string;
    if (rulesetOrId && typeof rulesetOrId === "object") {
      const rulesetNativeId = `${rulesetOrId.id}-${hash.MD5(rulesetOrId)}`;
      const rulesetWithNativeId = { ...rulesetOrId, id: rulesetNativeId };
      nativeRulesetId = this._rulesets.add(rulesetWithNativeId).id;
    } else {
      nativeRulesetId = rulesetOrId || rulesetId!;
    }

    return { rulesetId: nativeRulesetId, ...strippedOptions };
  }

  private handleOptions<TOptions extends { rulesetOrId?: Ruleset | string, rulesetId?: string, rulesetVariables?: RulesetVariable[] }>(options: TOptions) {
    const { rulesetVariables, ...strippedOptions } = options;
    const optionsWithRulesetId = this.ensureRulesetRegistered(strippedOptions);

    if (rulesetVariables) {
      const variablesManager = this.vars(optionsWithRulesetId.rulesetId);
      for (const variable of rulesetVariables) {
        variablesManager.setValue(variable.id, variable.type, variable.value);
      }
    }

    return optionsWithRulesetId;
  }

  /**
   * Retrieves nodes and node count
   * @param requestContext Client request context
   * @param requestOptions Options for the request
   * @param parentKey Key of the parentNode
   * @return A promise object that returns either a node response containing nodes and node count on success or an error string on error
   */
  public async getNodesAndCount(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: NodeKey) {
    requestContext.enter();
    const nodesCount = await this.getNodesCount(requestContext, requestOptions, parentKey);

    requestContext.enter();
    const nodesList = await this.getNodes(requestContext, requestOptions, parentKey);

    requestContext.enter();
    return { nodes: nodesList, count: nodesCount };
  }

  /**
   * Retrieves nodes
   * @param requestContext Client request context
   * @param requestOptions options for the request
   * @param parentKey    Key of the parent node if requesting for child nodes.
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  public async getNodes(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: NodeKey): Promise<Node[]> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildren, options, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodes, options);
    return this.request<Node[]>(requestContext, requestOptions.imodel, params, Node.listReviver);
  }

  /**
   * Retrieves nodes count
   * @param requestContext Client request context
   * @param requestOptions options for the request
   * @param parentKey Key of the parent node if requesting for child nodes.
   * @return A promise object that returns the number of nodes.
   */
  public async getNodesCount(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, parentKey?: NodeKey): Promise<number> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildrenCount, options, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodesCount, options);
    return this.request<number>(requestContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param paths Paths from root node to some child node.
   * @param markedIndex Index of the path in `paths` that will be marked.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getNodePaths(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetNodePaths, options, {
      paths,
      markedIndex,
    });
    return this.request<NodePathElement[]>(requestContext, requestOptions.imodel, params, NodePathElement.listReviver);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param filterText Text to filter nodes against.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getFilteredNodePaths(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, filterText: string): Promise<NodePathElement[]> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetFilteredNodePaths, options, {
      filterText,
    });
    return this.request<NodePathElement[]>(requestContext, requestOptions.imodel, params, NodePathElement.listReviver);
  }

  /**
   * Loads the whole hierarchy with the specified parameters
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @return A promise object that resolves when the hierarchy is fully loaded
   * @beta
   */
  public async loadHierarchy(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>): Promise<void> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);
    const params = this.createRequestParams(NativePlatformRequestTypes.LoadHierarchy, options);
    const start = new Date();
    await this.request<void>(requestContext, requestOptions.imodel, params);
    Logger.logInfo("ECPresentation.Node", `Loading full hierarchy for `
      + `iModel "${requestOptions.imodel.iModelToken.iModelId}" and ruleset "${options.rulesetId}" `
      + `completed in ${((new Date()).getTime() - start.getTime()) / 1000} s.`);
  }

  /**
   * Retrieves the content descriptor which can be used to get content.
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param displayType  The preferred display type of the return content.
   * @param keys         Keys of ECInstances to get the content for.
   * @param selection    Optional selection info in case the content is being requested due to selection change.
   * @return A promise object that returns either a descriptor on success or an error string on error.
   */
  public async getContentDescriptor(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: KeySet, selection: SelectionInfo | undefined): Promise<Descriptor | undefined> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentDescriptor, options, {
      displayType,
      keys: this.getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      selection,
    });
    return this.request<Descriptor | undefined>(requestContext, requestOptions.imodel, params, Descriptor.reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          options for the request
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for.
   * @return A promise object that returns either a number on success or an error string on error.
   * Even if concrete implementation returns content in pages, this function returns the total
   * number of records in the content set.
   */
  public async getContentSetSize(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<number> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentSetSize, options, {
      keys: this.getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    return this.request<number>(requestContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          options for the request
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for.
   * @return A promise object that returns either content on success or an error string on error.
   */
  public async getContent(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<Content | undefined> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetContent, options, {
      keys: this.getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    return this.request<Content | undefined>(requestContext, requestOptions.imodel, params, Content.reviver);
  }

  /**
   * Retrieves the content and content size based on supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          Options for thr request.
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for
   * @return A promise object that returns either content and content set size on success or an error string on error.
   */
  public async getContentAndSize(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet) {
    requestContext.enter();
    const size = await this.getContentSetSize(requestContext, requestOptions, descriptorOrOverrides, keys);
    requestContext.enter();
    const content = await this.getContent(requestContext, requestOptions, descriptorOrOverrides, keys);
    requestContext.enter();
    return { content, size };
  }

  private createContentDescriptorOverrides(descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides {
    if (descriptorOrOverrides instanceof Descriptor)
      return descriptorOrOverrides.createDescriptorOverrides();
    return descriptorOrOverrides as DescriptorOverrides;
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
  public async getDistinctValues(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptor: Descriptor, keys: KeySet, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    requestContext.enter();
    const options = this.handleOptions(requestOptions);

    const params = this.createRequestParams(NativePlatformRequestTypes.GetDistinctValues, options, {
      keys: this.getKeysForContentRequest(requestOptions.imodel, keys).toJSON(),
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      fieldName,
      maximumValueCount,
    });
    return this.request<string[]>(requestContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves display label of specific item
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param key Key of an instance to get label for
   */
  public async getDisplayLabel(requestContext: ClientRequestContext, requestOptions: LabelRequestOptions<IModelDb>, key: InstanceKey): Promise<string> {
    requestContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetDisplayLabel, requestOptions, { key });
    return this.request<string>(requestContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves display labels of specific items
   * @param requestContext The client request context
   * @param requestOptions options for the request
   * @param instanceKeys Keys of instances to get labels for
   */
  public async getDisplayLabels(requestContext: ClientRequestContext, requestOptions: LabelRequestOptions<IModelDb>, instanceKeys: InstanceKey[]): Promise<string[]> {
    instanceKeys = instanceKeys.map((k) => {
      if (k.className === "BisCore:Element")
        return this.getElementKey(requestOptions.imodel, k.id);
      return k;
    }).filter<InstanceKey>((k): k is InstanceKey => (undefined !== k));
    const rulesetId = "RulesDrivenECPresentationManager_RulesetId_DisplayLabel";
    const overrides: DescriptorOverrides = {
      displayType: DefaultContentDisplayTypes.List,
      contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
      hiddenFieldNames: [],
    };
    const content = await this.getContent(requestContext, { ...requestOptions, rulesetId }, overrides, new KeySet(instanceKeys));
    requestContext.enter();
    return instanceKeys.map((key) => {
      const item = content ? content.contentSet.find((it) => it.primaryKeys.length > 0 && InstanceKey.compare(it.primaryKeys[0], key) === 0) : undefined;
      if (!item)
        return "";
      return item.label;
    });
  }

  /**
   * Retrieves available selection scopes.
   * @param requestContext The client request context
   * @param requestOptions options for the request
   */
  public async getSelectionScopes(requestContext: ClientRequestContext, requestOptions: SelectionScopeRequestOptions<IModelDb>): Promise<SelectionScope[]> {
    requestContext.enter();
    (requestOptions as any);

    const createSelectionScope = (scopeId: string, label: string, description: string): SelectionScope => ({
      id: scopeId,
      label,
      description,
    });

    return [
      createSelectionScope("element", "Element", "Select the picked element"),
      createSelectionScope("assembly", "Assembly", "Select parent of the picked element"),
      createSelectionScope("top-assembly", "Top Assembly", "Select the topmost parent of the picked element"),
      // WIP: temporarily comment-out "category" and "model" scopes since we can't hilite contents of them fast enough
      // createSelectionScope("category", "Category", "Select all elements in the picked element's category"),
      // createSelectionScope("model", "Model", "Select all elements in the picked element's model"),
    ];
  }

  private getElementKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
    let key: InstanceKey | undefined;
    const query = `SELECT ECClassId FROM ${Element.classFullName} e WHERE ECInstanceId = ?`;
    imodel.withPreparedStatement(query, (stmt) => {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        key = { className: stmt.getValue(0).getClassNameForClassId().replace(".", ":"), id };
    });
    return key;
  }

  private computeElementSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const key = this.getElementKey(requestOptions.imodel, id);
      if (key)
        keys.add(key);
    }));
    return keys;
  }

  private getParentInstanceKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
    const parentRelProps = imodel.elements.getElementProps(id).parent;
    if (!parentRelProps)
      return undefined;
    return this.getElementKey(imodel, parentRelProps.id);
  }

  private computeAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const parentKey = this.getParentInstanceKey(requestOptions.imodel, id);
      if (parentKey) {
        parentKeys.add(parentKey);
      } else {
        const elementKey = this.getElementKey(requestOptions.imodel, id);
        if (elementKey)
          parentKeys.add(elementKey);
      }
    }));
    return parentKeys;
  }

  private computeTopAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      let curr: InstanceKey | undefined;
      let parent = this.getParentInstanceKey(requestOptions.imodel, id);
      while (parent) {
        curr = parent;
        parent = this.getParentInstanceKey(requestOptions.imodel, curr.id);
      }
      if (!curr)
        curr = this.getElementKey(requestOptions.imodel, id);
      if (curr)
        parentKeys.add(curr);
    }));
    return parentKeys;
  }

  private computeCategorySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const categoryKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const el = requestOptions.imodel.elements.getElement(id);
      if (el instanceof GeometricElement) {
        const category = requestOptions.imodel.elements.getElementProps(el.category);
        categoryKeys.add({ className: category.classFullName, id: category.id! });
      }
    }));
    return categoryKeys;
  }

  private computeModelSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const modelKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const el = requestOptions.imodel.elements.getElementProps(id);
      const model = requestOptions.imodel.models.getModelProps(el.model);
      modelKeys.add({ className: model.classFullName, id: model.id! });
    }));
    return modelKeys;
  }

  /**
   * Computes selection set based on provided selection scope.
   * @param requestContext The client request context
   * @param requestOptions Options for the request
   * @param keys Keys of elements to get the content for.
   * @param scopeId ID of selection scope to use for computing selection
   */
  public async computeSelection(requestContext: ClientRequestContext, requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string): Promise<KeySet> {
    requestContext.enter();
    (requestOptions as any);

    switch (scopeId) {
      case "element": return this.computeElementSelection(requestOptions, ids);
      case "assembly": return this.computeAssemblySelection(requestOptions, ids);
      case "top-assembly": return this.computeTopAssemblySelection(requestOptions, ids);
      case "category": return this.computeCategorySelection(requestOptions, ids);
      case "model": return this.computeModelSelection(requestOptions, ids);
    }

    throw new PresentationError(PresentationStatus.InvalidArgument, "scopeId");
  }

  private async request<T>(requestContext: ClientRequestContext, imodel: IModelDb, params: string, reviver?: (key: string, value: any) => any): Promise<T> {
    requestContext.enter();
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const serializedResponse = await this.getNativePlatform().handleRequest(requestContext, imodelAddon, params);
    requestContext.enter();
    if (!serializedResponse)
      throw new PresentationError(PresentationStatus.InvalidResponse, `Received invalid response from the addon: ${serializedResponse}`);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, genericOptions: { imodel: IModelDb, locale?: string }, additionalOptions?: object): string {
    const { imodel, locale, ...genericOptionsStripped } = genericOptions;

    let lowerCaseLocale = locale ? locale : this.activeLocale;
    if (lowerCaseLocale)
      lowerCaseLocale = lowerCaseLocale.toLowerCase();

    const request = {
      requestId,
      params: {
        locale: lowerCaseLocale,
        ...genericOptionsStripped,
        ...additionalOptions,
      },
    };
    return JSON.stringify(request);
  }

  private getKeysForContentRequest(imodel: IModelDb, keys: KeySet): KeySet {
    const elementClassName = "BisCore:Element";
    const instanceKeys = keys.instanceKeys;
    if (!instanceKeys.has(elementClassName))
      return keys;

    const elementIds = instanceKeys.get(elementClassName)!;
    const keyset = new KeySet();
    keyset.add(keys);
    elementIds.forEach((elementId) => {
      const concreteKey = this.getElementKey(imodel, elementId);
      if (concreteKey) {
        keyset.delete({ className: elementClassName, id: elementId });
        keyset.add(concreteKey);
      }
    });
    return keyset;
  }
}

const skipTransients = (callback: (id: Id64String) => void) => {
  return (id: Id64String) => {
    if (!Id64.isTransient(id))
      callback(id);
  };
};

const createLocaleDirectoryList = (props?: PresentationManagerProps) => {
  const localeDirectories = [path.join(__dirname, "assets", "locales")];
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
