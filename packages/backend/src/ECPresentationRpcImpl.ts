/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { PresentationRuleSet } from "@bentley/ecpresentation-common";
import ECPresentation from "./ECPresentation";
import ECPresentationManager from "./ECPresentationManager";

/**
 * The backend implementation of ECPresentationRpcInterface. All it's basically
 * responsible for is forwarding calls to [[ECPresentation.manager]].
 *
 * Consumers should not use this class. Instead, they should register
 * [ECPresentationRpcInterface]($ecpresentation-common):
 * ``` ts
 * [[include:Backend.Initialization.RpcInterface]]
 * ```
 */
export default class ECPresentationRpcImpl extends ECPresentationRpcInterface {

  /**
   * Get the ECPresentationManager used by this RPC impl.
   */
  public getManager(): ECPresentationManager {
    return ECPresentation.manager;
  }

  public setActiveLocale(locale: string | undefined): Promise<void> {
    this.getManager().activeLocale = locale;
    return Promise.resolve();
  }

  public async addRuleSet(ruleSet: PresentationRuleSet): Promise<void> {
    return await this.getManager().addRuleSet(ruleSet);
  }

  public async removeRuleSet(ruleSetId: string): Promise<void> {
    return await this.getManager().removeRuleSet(ruleSetId);
  }

  public async clearRuleSets(): Promise<void> {
    return await this.getManager().clearRuleSets();
  }

  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    return await this.getManager().getRootNodesCount(token, options);
  }

  public async getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getChildren(token, parentKey, pageOptions, options);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    return await this.getManager().getChildrenCount(token, parentKey, options);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await this.getManager().getContentDescriptor(token, displayType, keys, selection, options);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    return await this.getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const content: Content = await this.getManager().getContent(token, descriptor, keys, pageOptions, options);
    content.descriptor.resetParentship();
    return content;
  }
}
