/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import { ActivityLoggingContext, Id64String } from "@bentley/bentleyjs-core";
import { IModelDb, GeometricElement } from "@bentley/imodeljs-backend";
import {
  PresentationError, PresentationStatus,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  RequestOptions, Paged, KeySet, InstanceKey,
  SelectionScopeRequestOptions, SelectionScope,
  NodesResponse, ContentResponse, DescriptorOverrides,
} from "@bentley/presentation-common";
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
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions Options for the request
   * @param parentKey Key of the parentNode
   * @return A promise object that returns either a node response containing nodes and node count on success or an error string on error
   */
  public async getNodesAndCount(activityLoggingContext: ActivityLoggingContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: Readonly<NodeKey>): Promise<Readonly<NodesResponse>> {
    activityLoggingContext.enter();

    const nodesCount = await this.getNodesCount(activityLoggingContext, requestOptions, parentKey);
    activityLoggingContext.enter();

    const nodesList = await this.getNodes(activityLoggingContext, requestOptions, parentKey);
    activityLoggingContext.enter();

    return { nodes: nodesList, count: nodesCount };
  }

  /**
   * Retrieves nodes
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param parentKey    Key of the parent node if requesting for child nodes.
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  public async getNodes(activityLoggingContext: ActivityLoggingContext, requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey?: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    activityLoggingContext.enter();
    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildren, requestOptions, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodes, requestOptions);
    return this.request<Node[]>(activityLoggingContext, requestOptions.imodel, params, nodesListReviver);
  }

  /**
   * Retrieves nodes count
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param parentKey Key of the parent node if requesting for child nodes.
   * @return A promise object that returns the number of nodes.
   */
  public async getNodesCount(activityLoggingContext: ActivityLoggingContext, requestOptions: HierarchyRequestOptions<IModelDb>, parentKey?: Readonly<NodeKey>): Promise<number> {
    activityLoggingContext.enter();
    let params;
    if (parentKey)
      params = this.createRequestParams(NativePlatformRequestTypes.GetChildrenCount, requestOptions, { nodeKey: parentKey });
    else
      params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodesCount, requestOptions);
    return this.request<number>(activityLoggingContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param paths Paths from root node to some child node.
   * @param markedIndex Index of the path in `paths` that will be marked.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getNodePaths(activityLoggingContext: ActivityLoggingContext, requestOptions: HierarchyRequestOptions<IModelDb>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetNodePaths, requestOptions, {
      paths,
      markedIndex,
    });
    return this.request<NodePathElement[]>(activityLoggingContext, requestOptions.imodel, params, nodePathElementReviver);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param filterText Text to filter nodes against.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getFilteredNodePaths(activityLoggingContext: ActivityLoggingContext, requestOptions: HierarchyRequestOptions<IModelDb>, filterText: string): Promise<NodePathElement[]> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetFilteredNodePaths, requestOptions, {
      filterText,
    });
    return this.request<NodePathElement[]>(activityLoggingContext, requestOptions.imodel, params, nodePathElementReviver);
  }

  /**
   * Retrieves the content descriptor which can be used to get content.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param displayType  The preferred display type of the return content.
   * @param keys         Keys of ECInstances to get the content for.
   * @param selection    Optional selection info in case the content is being requested due to selection change.
   * @return A promise object that returns either a descriptor on success or an error string on error.
   */
  public async getContentDescriptor(activityLoggingContext: ActivityLoggingContext, requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentDescriptor, requestOptions, {
      displayType,
      keys,
      selection,
    });
    return this.request<Descriptor | undefined>(activityLoggingContext, requestOptions.imodel, params, Descriptor.reviver);
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override.
   * @param activityLoggingContext  Logging context holding request's ActivityId
   * @param requestOptions          options for the request
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for.
   * @return A promise object that returns either a number on success or an error string on error.
   * Even if concrete implementation returns content in pages, this function returns the total
   * number of records in the content set.
   */
  public async getContentSetSize(activityLoggingContext: ActivityLoggingContext, requestOptions: ContentRequestOptions<IModelDb>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<number> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentSetSize, requestOptions, {
      keys,
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      return await this.request<number>(activityLoggingContext, requestOptions.imodel, params);
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return 0;
    }
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @param activityLoggingContext  Logging context holding request's ActivityId
   * @param requestOptions          options for the request
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for.
   * @return A promise object that returns either content on success or an error string on error.
   */
  public async getContent(activityLoggingContext: ActivityLoggingContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<Content> | undefined> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContent, requestOptions, {
      keys,
      descriptorOverrides: this.createContentDescriptorOverrides(descriptorOrOverrides),
    });
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      return await this.request<Content | undefined>(activityLoggingContext, requestOptions.imodel, params, Content.reviver);
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return undefined;
    }
  }

  /**
   * Retrieves the content and content size based on supplied content descriptor override.
   * @param activityLoggingContext  Logging context holding request's ActivityId.
   * @param requestOptions          Options for thr request.
   * @param descriptorOrOverrides   Content descriptor or its overrides specifying how the content should be customized
   * @param keys                    Keys of ECInstances to get the content for
   * @return A promise object that returns either content and content set size on success or an error string on error.
   */
  public async getContentAndSize(activityLoggingContext: ActivityLoggingContext, requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): Promise<Readonly<ContentResponse>> {
    activityLoggingContext.enter();
    // wip: the try/catch block is a temp workaround until native platform changes
    // are available for the backend
    try {
      const size = await this.getContentSetSize(activityLoggingContext, requestOptions, descriptorOrOverrides, keys);
      activityLoggingContext.enter();
      const content = await this.getContent(activityLoggingContext, requestOptions, descriptorOrOverrides, keys);
      activityLoggingContext.enter();
      return { content, size };
    } catch (e) {
      // wip: temporary code:
      // istanbul ignore next
      return { content: undefined, size: 0 };
    }
  }

  private createContentDescriptorOverrides(descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides) {
    if (descriptorOrOverrides instanceof Descriptor)
      return descriptorOrOverrides.createDescriptorOverrides();
    return descriptorOrOverrides;
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @param fieldName            Name of the field from which to take values.
   * @param maximumValueCount    Maximum numbers of values that can be returned. Unlimited if 0.
   * @return A promise object that returns either distinct values on success or an error string on error.
   */
  public async getDistinctValues(activityLoggingContext: ActivityLoggingContext, requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    activityLoggingContext.enter();
    const params = this.createRequestParams(NativePlatformRequestTypes.GetDistinctValues, requestOptions, {
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      keys,
      fieldName,
      maximumValueCount,
    });
    return this.request<string[]>(activityLoggingContext, requestOptions.imodel, params);
  }

  /**
   * Retrieves available selection scopes.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions options for the request
   */
  public async getSelectionScopes(activityLoggingContext: ActivityLoggingContext, requestOptions: SelectionScopeRequestOptions<IModelDb>): Promise<SelectionScope[]> {
    activityLoggingContext.enter();
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
    const props = imodel.elements.getElementProps(id);
    return { className: props.classFullName, id: props.id! };
  }

  private computeElementSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach((id) => {
      keys.add(this.getElementKey(requestOptions.imodel, id));
    });
    return keys;
  }

  private getParentInstanceKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
    const parentRelProps = imodel.elements.getElementProps(id).parent;
    if (!parentRelProps)
      return undefined;
    const parentProps = imodel.elements.getElementProps(parentRelProps.id);
    return {
      className: parentProps!.classFullName,
      id: parentProps!.id!,
    };
  }

  private computeAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach((id) => {
      const parentKey = this.getParentInstanceKey(requestOptions.imodel, id);
      if (parentKey) {
        parentKeys.add(parentKey);
      } else {
        parentKeys.add(this.getElementKey(requestOptions.imodel, id));
      }
    });
    return parentKeys;
  }

  private computeTopAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach((id) => {
      let curr: InstanceKey | undefined;
      let parent = this.getParentInstanceKey(requestOptions.imodel, id);
      while (parent) {
        curr = parent;
        parent = this.getParentInstanceKey(requestOptions.imodel, curr.id);
      }
      parentKeys.add(curr ? curr : this.getElementKey(requestOptions.imodel, id));
    });
    return parentKeys;
  }

  private computeCategorySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const categoryKeys = new KeySet();
    ids.forEach((id) => {
      const el = requestOptions.imodel.elements.getElement(id);
      if (el instanceof GeometricElement) {
        const category = requestOptions.imodel.elements.getElementProps(el.category);
        categoryKeys.add({ className: category.classFullName, id: category.id! });
      }
    });
    return categoryKeys;
  }

  private computeModelSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const modelKeys = new KeySet();
    ids.forEach((id) => {
      const el = requestOptions.imodel.elements.getElementProps(id);
      const model = requestOptions.imodel.models.getModelProps(el.model);
      modelKeys.add({ className: model.classFullName, id: model.id! });
    });
    return modelKeys;
  }

  /**
   * Computes selection set based on provided selection scope.
   * @param activityLoggingContext Logging context holding request's ActivityId
   * @param requestOptions Options for the request
   * @param keys Keys of elements to get the content for.
   * @param scopeId ID of selection scope to use for computing selection
   */
  public async computeSelection(activityLoggingContext: ActivityLoggingContext, requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string): Promise<KeySet> {
    activityLoggingContext.enter();
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

  private async request<T>(activityLoggingContext: ActivityLoggingContext, imodel: IModelDb, params: string, reviver?: (key: string, value: any) => any): Promise<T> {
    activityLoggingContext.enter();
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const serializedResponse = await this.getNativePlatform().handleRequest(activityLoggingContext, imodelAddon, params);
    activityLoggingContext.enter();
    if (!serializedResponse)
      throw new PresentationError(PresentationStatus.InvalidResponse, `Received invalid response from the addon: ${serializedResponse}`);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, genericOptions: Paged<RequestOptions<IModelDb>>, additionalOptions?: object): string {
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
}
