/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  ECPresentationManager as ECPInterface, ECPresentationRpcInterface,
  HierarchyRequestOptions, Node, NodeKey, NodePathElement,
  ContentRequestOptions, Content, Descriptor, SelectionInfo,
  Paged, RequestOptions, KeySet, InstanceKey, PresentationRuleSet,
} from "@bentley/ecpresentation-common";
import UserSettingsManager from "./UserSettingsManager";

/**
 * Properties used to configure [[ECPresentationManager]].
 */
export interface Props {
  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[ECPresentationManager]].
   */
  activeLocale?: string;
}

/**
 * Frontend ECPresentation manager which basically just forwards all calls to
 * the backend implementation.
 */
export default class ECPresentationManager implements ECPInterface<IModelConnection> {

  private _settings: UserSettingsManager;
  public activeLocale: string | undefined;

  private constructor(props?: Props) {
    if (props)
      this.activeLocale = props.activeLocale;
    this._settings = new UserSettingsManager();
  }

  public get settings(): UserSettingsManager {
    return this._settings;
  }

  /**
   * Create a new ECPresentationManager instance
   * @param props Optional properties used to configure the manager
   */
  public static create(props?: Props) {
    return new ECPresentationManager(props);
  }

  private toIModelTokenOptions<TOptions extends RequestOptions<IModelConnection>>(options: TOptions) {
    // 1. put default `locale`
    // 2. put all `options` members (if `locale` is set, it'll override the default put at #1)
    // 3. put `imodel` of type `IModelToken` which overwrites the `imodel` from `options`
    return Object.assign({}, { locale: this.activeLocale }, options, {
      imodel: options.imodel.iModelToken,
    });
  }

  /**
   * Register a presentation ruleset.
   */
  public async addRuleSet(ruleSet: PresentationRuleSet): Promise<void> {
    return await ECPresentationRpcInterface.getClient().addRuleSet(ruleSet);
  }

  /**
   * Unregister presentation ruleset with the specified id.
   */
  public async removeRuleSet(ruleSetId: string): Promise<void> {
    return await ECPresentationRpcInterface.getClient().removeRuleSet(ruleSetId);
  }

  /**
   * Unregister all registered presentation ruleset
   */
  public async clearRuleSets(): Promise<void> {
    return await ECPresentationRpcInterface.getClient().clearRuleSets();
  }

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getRootNodes(this.toIModelTokenOptions(requestOptions));
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelConnection>): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getRootNodesCount(this.toIModelTokenOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelConnection>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getChildren(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelConnection>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getChildrenCount(this.toIModelTokenOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await ECPresentationRpcInterface.getClient().getNodePaths(this.toIModelTokenOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelConnection>, filterText: string): Promise<NodePathElement[]> {
    return await ECPresentationRpcInterface.getClient().getFilteredNodePaths(this.toIModelTokenOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelConnection>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await ECPresentationRpcInterface.getClient().getContentDescriptor(this.toIModelTokenOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getContentSetSize(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelConnection>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content = await ECPresentationRpcInterface.getClient().getContent(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys);
    content.descriptor.rebuildParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelConnection>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    return await ECPresentationRpcInterface.getClient().getDistinctValues(this.toIModelTokenOptions(requestOptions), descriptor.createStrippedDescriptor(), keys, fieldName, maximumValueCount);
  }

}
