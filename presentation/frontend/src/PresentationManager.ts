/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  IPresentationManager, RpcRequestsHandler,
  HierarchyRequestOptions, Node, NodeKey, NodePathElement,
  ContentRequestOptions, Content, Descriptor, SelectionInfo,
  Paged, RequestOptions, KeySet, InstanceKey,
} from "@bentley/presentation-common";
import RulesetVariablesManager from "./RulesetVariablesManager";
import RulesetManager from "./RulesetManager";

/**
 * Properties used to configure [[PresentationManager]].
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
 * the backend implementation.
 */
export default class PresentationManager implements IPresentationManager<IModelConnection>, IDisposable {

  private _requestsHandler: RpcRequestsHandler;
  private _rulesets: RulesetManager;
  private _rulesetVars: Map<string, RulesetVariablesManager>;
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

  public rulesets() { return this._rulesets; }

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

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this._requestsHandler.getRootNodes(this.toIModelTokenOptions(requestOptions));
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>): Promise<number> {
    return await this._requestsHandler.getRootNodesCount(this.toIModelTokenOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this._requestsHandler.getChildren(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await this._requestsHandler.getChildrenCount(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await this._requestsHandler.getNodePaths(this.toIModelTokenOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]> {
    return await this._requestsHandler.getFilteredNodePaths(this.toIModelTokenOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await this._requestsHandler.getContentDescriptor(this.toIModelTokenOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await this._requestsHandler.getContentSetSize(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content = await this._requestsHandler.getContent(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
    content.descriptor.rebuildParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    return await this._requestsHandler.getDistinctValues(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys, fieldName, maximumValueCount);
  }

}
