/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  RpcRequestsHandler,
  HierarchyRequestOptions, Node, NodeKey, NodePathElement,
  ContentRequestOptions, Content, Descriptor, SelectionInfo,
  Paged, RequestOptions, KeySet, InstanceKey,
} from "@bentley/presentation-common";
import RulesetVariablesManager from "./RulesetVariablesManager";
import RulesetManager from "./RulesetManager";

/**
 * Properties used to configure [[PresentationManager]]
 */
export interface Props {
  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;

  /** @hidden */
  rpcRequestsHandler?: RpcRequestsHandler;
}

/**
 * Frontend Presentation manager which basically just forwards all calls to
 * the backend implementation
 */
export default class PresentationManager implements IDisposable {

  private _requestsHandler: RpcRequestsHandler;
  private _rulesets: RulesetManager;
  private _rulesetVars: Map<string, RulesetVariablesManager>;

  /**
   * Get / set active locale used for localizing presentation data
   */
  public activeLocale: string | undefined;

  private constructor(props?: Props) {
    if (props)
      this.activeLocale = props.activeLocale;
    this._rulesets = new RulesetManager();
    this._rulesetVars = new Map<string, RulesetVariablesManager>();
    this._requestsHandler = (props && props.rpcRequestsHandler) ? props.rpcRequestsHandler : new RpcRequestsHandler();
    this._requestsHandler.registerClientStateHolder(this._rulesets);
  }

  public dispose() {
    this._requestsHandler.dispose();
  }

  /**
   * Create a new PresentationManager instance
   * @param props Optional properties used to configure the manager
   */
  public static create(props?: Props) {
    return new PresentationManager(props);
  }

  /** @hidden */
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
      const varsManager = new RulesetVariablesManager(rulesetId);
      this._rulesetVars.set(rulesetId, varsManager);
      this._requestsHandler.registerClientStateHolder(varsManager);
    }
    return this._rulesetVars.get(rulesetId)!;
  }

  private toIModelTokenOptions<TOptions extends RequestOptions<IModelConnection>>(options: TOptions) {
    // 1. put default `locale`
    // 2. put all `options` members (if `locale` is set, it'll override the default put at #1)
    // 3. put `imodel` of type `IModelToken` which overwrites the `imodel` from `options` put at #2
    // 4. put `clientId`
    return Object.assign({}, { locale: this.activeLocale }, options, {
      imodel: options.imodel.iModelToken,
    });
  }

  /**
   * Retrieves root nodes.
   * @param requestOptions options for the request
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this._requestsHandler.getRootNodes(this.toIModelTokenOptions(requestOptions));
  }

  /**
   * Retrieves root nodes count.
   * @param requestOptions options for the request
   * @return A promise object that returns the number of root nodes.
   */
  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>): Promise<number> {
    return await this._requestsHandler.getRootNodesCount(this.toIModelTokenOptions(requestOptions));
  }

  /**
   * Retrieves children of the specified parent node.
   * @param requestOptions options for the request
   * @param parentKey    Key of the parent node.
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this._requestsHandler.getChildren(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  /**
   * Retrieves children count for the specified parent node.
   * @param requestOptions options for the request
   * @param parentKey Key of the parent node.
   * @return A promise object that returns the number of child nodes.
   */
  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await this._requestsHandler.getChildrenCount(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @param requestOptions options for the request
   * @param paths Paths from root node to some child node.
   * @param markedIndex Index of the path in `paths` that will be marked.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await this._requestsHandler.getNodePaths(this.toIModelTokenOptions(requestOptions), paths, markedIndex);
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @param requestOptions options for the request
   * @param filterText Text to filter nodes against.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]> {
    return await this._requestsHandler.getFilteredNodePaths(this.toIModelTokenOptions(requestOptions), filterText);
  }

  /**
   * Retrieves the content descriptor which can be used to get content.
   * @param requestOptions options for the request
   * @param displayType  The preferred display type of the return content.
   * @param keys         Keys of ECInstances to get the content for.
   * @param selection    Optional selection info in case the content is being requested due to selection change.
   * @return A promise object that returns either a descriptor on success or an error string on error.
   */
  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await this._requestsHandler.getContentDescriptor(this.toIModelTokenOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  /**
   * Retrieves the content set size based on the supplied content descriptor override.
   * @param requestOptions options for the request
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @return A promise object that returns either a number on success or an error string on error.
   * Even if concrete implementation returns content in pages, this function returns the total
   * number of records in the content set.
   */
  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await this._requestsHandler.getContentSetSize(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
  }

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @param requestOptions options for the request
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @return A promise object that returns either content on success or an error string on error.
   */
  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content = await this._requestsHandler.getContent(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
    content.descriptor.rebuildParentship();
    return content;
  }

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param requestOptions options for the request
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @param fieldName            Name of the field from which to take values.
   * @param maximumValueCount    Maximum numbers of values that can be returned. Unlimited if 0.
   * @return A promise object that returns either distinct values on success or an error string on error.
   */
  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    return await this._requestsHandler.getDistinctValues(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys, fieldName, maximumValueCount);
  }

}
