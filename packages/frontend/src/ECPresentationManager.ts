/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationManager as ECPInterface, ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { PresentationRuleSet } from "@bentley/ecpresentation-common";

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
export default class ECPresentationManager implements ECPInterface {

  private _activeLocale?: string;

  constructor(props?: Props) {
    if (props)
      this.activeLocale = props.activeLocale;
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

  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getRootNodesCount(token, options);
  }

  public async getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await ECPresentationRpcInterface.getClient().getChildren(token, parentKey, pageOptions, options);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getChildrenCount(token, parentKey, options);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await ECPresentationRpcInterface.getClient().getContentDescriptor(token, displayType, keys, selection, options);
    if (descriptor)
      descriptor.rebuildParentship();
    return descriptor;
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getContentSetSize(token, descriptor.createStrippedDescriptor(), keys, options);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const content = await ECPresentationRpcInterface.getClient().getContent(token, descriptor.createStrippedDescriptor(), keys, pageOptions, options);
    content.descriptor.rebuildParentship();
    return content;
  }
}
