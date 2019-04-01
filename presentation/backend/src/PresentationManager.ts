/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import { ClientRequestContext, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { IModelDb, Element, GeometricElement } from "@bentley/imodeljs-backend";
import {
  PresentationError, PresentationStatus,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  NodesResponse, ContentResponse, DescriptorOverrides,
  Paged, KeySet, InstanceKey, LabelRequestOptions,
  SelectionScopeRequestOptions, SelectionScope, DefaultContentDisplayTypes,
  compareInstanceKeys,
  ContentFlags,
} from "@bentley/presentation-common";
import { toJSON as keysetToJSON } from "@bentley/presentation-common/lib/KeySet";
import { listReviver as nodesListReviver } from "@bentley/presentation-common/lib/hierarchy/Node";
import { listReviver as nodePathElementReviver } from "@bentley/presentation-common/lib/hierarchy/NodePathElement";
import { NativePlatformDefinition, createDefaultNativePlatform, NativePlatformRequestTypes } from "./NativePlatform";
import RulesetVariablesManager from "./RulesetVariablesManager";
import RulesetManager from "./RulesetManager";

/**
 * Properties that can be used to configure [[PresentationManager]]
 */
export interface Props {
  /**
   * A list of directories containing presentation rulesets.
   */
  rulesetDirectories?: string[];

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

  /** @hidden */
  addon?: NativePlatformDefinition;
}

/**
 * Backend Presentation manager which pulls the presentation data from
 * an iModel using native platform.
 */
export default class PresentationManager {

  private _props: Props;
  private _nativePlatform?: NativePlatformDefinition;
  private _rulesets: RulesetManager;
  private _isDisposed: boolean;

  /**
   * Get / set active locale used for localizing presentation data
   */
  public activeLocale: string | undefined;

  /**
   * Creates an instance of PresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._props = props || {};
    this._isDisposed = false;
    if (props && props.addon)
      this._nativePlatform = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
    if (props)
      this.activeLocale = props.activeLocale;
    this.setupLocaleDirectories(props);
    this._rulesets = new RulesetManager(this.getNativePlatform);
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    if (this._nativePlatform) {
      this.getNativePlatform().dispose();
      this._nativePlatform = undefined;
    }
    this._isDisposed = true;
  }

  /** @hidden */
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
    return new RulesetVariablesManager(this.getNativePlatform, rulesetId);
  }

  /** @hidden */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new PresentationError(PresentationStatus.UseAfterDisposal, "Attempting to use Presentation manager after disposal");
    if (!this._nativePlatform) {
      const nativePlatformImpl = createDefaultNativePlatform();
      this._nativePlatform = new nativePlatformImpl();
    }
    return this._nativePlatform!;
  }

  private setupLocaleDirectories(props?: Props) {
    const localeDirectories = [path.join(__dirname, "assets", "locales")];
    if (props && props.localeDirectories) {
      props.localeDirectories.forEach((dir) => {
        if (-1 === localeDirectories.indexOf(dir))
          localeDirectories.push(dir);
      });
    }
    this.getNativePlatform().setupLocaleDirectories(localeDirectories);
  }

  /**
   * Retrieves nodes and node count
   * @param requestContext Client request context
   * @param requestOptions Options for the request
   * @param parentKey Key of the parentNode
   * @return A promise object that returns either a node response containing nodes and node count on success or an error string on error
   */
  public async getNodesAndCount(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: Readonly<NodeKey>): Promise<Readonly<NodesResponse>> {
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
  public async getNodes(requestContext: ClientRequestContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    requestContext.enter();
    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildren, requestOptions, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodes, requestOptions);
    return this.request<Node[]>(requestContext, requestOptions.imodel, params, nodesListReviver);
  }

  /**
   * Retrieves nodes count
   * @param requestContext Client request context
   * @param requestOptions options for the request
   * @param parentKey Key of the parent node if requesting for child nodes.
   * @return A promise object that returns the number of nodes.
   */
  public async getNodesCount(requestContext: ClientRequestContext, requestOptions: HierarchyRequestOptions<IModelDb>, parentKey?: Readonly<NodeKey>): Promise<number> {
    requestContext.enter();
    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildrenCount, requestOptions, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodesCount, requestOptions);
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
    const params = this.createRequestParams(NativePlatformRequestTypes.GetNodePaths, requestOptions, {
      paths,
      markedIndex,
    });
    return this.request<NodePathElement[]>(requestContext, requestOptions.imodel, params, nodePathElementReviver);
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
    const params = this.createRequestParams(NativePlatformRequestTypes.GetFilteredNodePaths, requestOptions, {
      filterText,
    });
    return this.request<NodePathElement[]>(requestContext, requestOptions.imodel, params, nodePathElementReviver);
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
  public async getContentDescriptor(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    requestContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentDescriptor, requestOptions, {
      displayType,
      keys: keysetToJSON(this.getKeysForContentRequest(requestOptions.imodel, keys)),
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
  public async getContentSetSize(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<number> {
    requestContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentSetSize, requestOptions, {
      keys: keysetToJSON(this.getKeysForContentRequest(requestOptions.imodel, keys)),
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      return await this.request<number>(requestContext, requestOptions.imodel, params);
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return 0;
    }
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          options for the request
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for.
   * @return A promise object that returns either content on success or an error string on error.
   */
  public async getContent(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<Content> | undefined> {
    requestContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContent, requestOptions, {
      keys: keysetToJSON(this.getKeysForContentRequest(requestOptions.imodel, keys)),
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      return await this.request<Content | undefined>(requestContext, requestOptions.imodel, params, Content.reviver);
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return undefined;
    }
  }

  /**
   * Retrieves the content and content size based on supplied content descriptor override.
   * @param requestContext Client request context
   * @param requestOptions          Options for thr request.
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for
   * @return A promise object that returns either content and content set size on success or an error string on error.
   */
  public async getContentAndSize(requestContext: ClientRequestContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<ContentResponse>> {
    requestContext.enter();
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      const size = await this.getContentSetSize(requestContext, requestOptions, descriptorOrOverrides, keys);
      requestContext.enter();
      const content = await this.getContent(requestContext, requestOptions, descriptorOrOverrides, keys);
      requestContext.enter();
      return { content, size };
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return { content: undefined, size: 0 };
    }
  }

  private createContentDescriptorOverrides(descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides): DescriptorOverrides {
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
  public async getDistinctValues(requestContext: ClientRequestContext, requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    requestContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetDistinctValues, requestOptions, {
      keys: keysetToJSON(this.getKeysForContentRequest(requestOptions.imodel, keys)),
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
    });
    const rulesetId = "RulesDrivenECPresentationManager_RulesetId_DisplayLabel";
    const overrides: DescriptorOverrides = {
      displayType: DefaultContentDisplayTypes.LIST,
      contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
      hiddenFieldNames: [],
    };
    const content = await this.getContent(requestContext, { ...requestOptions, rulesetId }, overrides, new KeySet(instanceKeys));
    requestContext.enter();
    return instanceKeys.map((key) => {
      const item = content ? content.contentSet.find((it) => it.primaryKeys.length > 0 && compareInstanceKeys(it.primaryKeys[0], key) === 0) : undefined;
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
      createSelectionScope("category", "Category", "Select all elements in the picked element's category"),
      createSelectionScope("model", "Model", "Select all elements in the picked element's model"),
    ];
  }

  private getElementKey(imodel: IModelDb, id: Id64String): InstanceKey {
    let key: InstanceKey;
    const query = `SELECT ECClassId FROM ${Element.classFullName} e WHERE ECInstanceId = ?`;
    imodel.withPreparedStatement(query, (stmt) => {
      stmt.bindId(1, id);
      stmt.step();
      key = { className: stmt.getValue(0).getClassNameForClassId().replace(".", ":"), id };
    });
    return key!;
  }

  private computeElementSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id) => {
      keys.add(this.getElementKey(requestOptions.imodel, id));
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
        parentKeys.add(this.getElementKey(requestOptions.imodel, id));
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
      parentKeys.add(curr ? curr : this.getElementKey(requestOptions.imodel, id));
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

  private getKeysForContentRequest(imodel: IModelDb, keys: Readonly<KeySet>): Readonly<KeySet> {
    const elementClassName = "BisCore:Element";
    const instanceKeys = keys.instanceKeys;
    if (!instanceKeys.has(elementClassName))
      return keys;

    const elementIds = instanceKeys.get(elementClassName)!;
    const keyset = new KeySet();
    keyset.add(keys);
    elementIds.forEach((elementId) => {
      keyset.delete({ className: elementClassName, id: elementId });
      keyset.add(this.getElementKey(imodel, elementId));
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
