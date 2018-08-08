/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Guid } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  IPresentationManager, PresentationRpcInterface,
  HierarchyRequestOptions, Node, NodeKey, NodePathElement,
  ContentRequestOptions, Content, Descriptor, SelectionInfo,
  IRulesetVariablesManager, IRulesetManager,
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
  clientId?: string;
}

/**
 * Frontend Presentation manager which basically just forwards all calls to
 * the backend implementation.
 */
export default class PresentationManager implements IPresentationManager<IModelConnection> {

  private _clientId: string;
  public activeLocale: string | undefined;

  private constructor(props?: Props) {
    if (props)
      this.activeLocale = props.activeLocale;
    this._clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
  }

  /**
   * Create a new PresentationManager instance
   * @param props Optional properties used to configure the manager
   */
  public static create(props?: Props) {
    return new PresentationManager(props);
  }

  /** @hidden */
  public get clientId() { return this._clientId; }

  public rulesets(): IRulesetManager {
      return new RulesetManager(this._clientId);
  }

  public vars(rulesetId: string): IRulesetVariablesManager {
    return new RulesetVariablesManager(this._clientId, rulesetId);
  }

  private toIModelTokenOptions<TOptions extends RequestOptions<IModelConnection>>(options: TOptions) {
    // 1. put default `locale`
    // 2. put all `options` members (if `locale` is set, it'll override the default put at #1)
    // 3. put `imodel` of type `IModelToken` which overwrites the `imodel` from `options` put at #2
    // 4. put `clientId`
    return Object.assign({}, { locale: this.activeLocale }, options, {
      imodel: options.imodel.iModelToken,
      clientId: this._clientId,
    });
  }

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await PresentationRpcInterface.getClient().getRootNodes(this.toIModelTokenOptions(requestOptions));
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>): Promise<number> {
    return await PresentationRpcInterface.getClient().getRootNodesCount(this.toIModelTokenOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await PresentationRpcInterface.getClient().getChildren(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await PresentationRpcInterface.getClient().getChildrenCount(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await PresentationRpcInterface.getClient().getNodePaths(this.toIModelTokenOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]> {
    return await PresentationRpcInterface.getClient().getFilteredNodePaths(this.toIModelTokenOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await PresentationRpcInterface.getClient().getContentDescriptor(this.toIModelTokenOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await PresentationRpcInterface.getClient().getContentSetSize(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content = await PresentationRpcInterface.getClient().getContent(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
    content.descriptor.rebuildParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    return await PresentationRpcInterface.getClient().getDistinctValues(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys, fieldName, maximumValueCount);
  }

}
