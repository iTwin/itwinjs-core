/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, PageOptions, InstanceKey, NodePathElement } from "@bentley/ecpresentation-common";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationManager as ECPInterface, ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { PresentationRuleSet } from "@bentley/ecpresentation-common";
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

  private _activeLocale?: string;
  private _settings: UserSettingsManager;

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

  /**
   * Get currently active locale
   */
  public get activeLocale(): string | undefined {
    return this._activeLocale;
  }

  /**
   * Set active locale
   */
  public set activeLocale(locale: string | undefined) {
    if (this._activeLocale !== locale) {
      this._activeLocale = locale;
      ECPresentationRpcInterface.getClient().setActiveLocale(locale);
    }
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

  public async getRootNodes(imodel: IModelConnection, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getRootNodes(imodel.iModelToken, pageOptions, options);
  }

  public async getRootNodesCount(imodel: IModelConnection, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getRootNodesCount(imodel.iModelToken, options);
  }

  public async getChildren(imodel: IModelConnection, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getChildren(imodel.iModelToken, parentKey, pageOptions, options);
  }

  public async getChildrenCount(imodel: IModelConnection, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getChildrenCount(imodel.iModelToken, parentKey, options);
  }

  public async getNodePaths(imodel: IModelConnection, paths: InstanceKey[][], markedIndex: number, options: object): Promise<NodePathElement[]> {
    return await ECPresentationRpcInterface.getClient().getNodePaths(imodel.iModelToken, paths, markedIndex, options);
  }

  public async getFilteredNodePaths(imodel: IModelConnection, filterText: string, options: object): Promise<NodePathElement[]> {
    return await ECPresentationRpcInterface.getClient().getFilteredNodePaths(imodel.iModelToken, filterText, options);
  }

  public async getContentDescriptor(imodel: IModelConnection, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await ECPresentationRpcInterface.getClient().getContentDescriptor(imodel.iModelToken, displayType, keys, selection, options);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  public async getContentSetSize(imodel: IModelConnection, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getContentSetSize(imodel.iModelToken, descriptor.createStrippedDescriptor(), keys, options);
  }

  public async getContent(imodel: IModelConnection, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const content = await ECPresentationRpcInterface.getClient().getContent(imodel.iModelToken, descriptor.createStrippedDescriptor(), keys, pageOptions, options);
    content.descriptor.rebuildParentship();
    return content;
  }

  public async getDistinctValues(imodel: IModelConnection, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, options: object, maximumValueCount: number = 0): Promise<string[]> {
    return await ECPresentationRpcInterface.getClient().getDistinctValues(imodel.iModelToken, descriptor.createStrippedDescriptor(), keys, fieldName, options, maximumValueCount);
  }

}
