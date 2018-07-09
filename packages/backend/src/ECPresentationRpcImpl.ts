/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  ECPresentationRpcInterface,
  HierarchyRequestOptions, Node, NodeKey, NodePathElement,
  ContentRequestOptions, Content, Descriptor, SelectionInfo,
  SettingValue, SettingValueTypes,
  ECPresentationError, ECPresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet, PresentationRuleSet,
} from "@bentley/ecpresentation-common";
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

  private getIModel(token: IModelToken): IModelDb {
    const imodel = IModelDb.find(token);
    if (!imodel)
      throw new ECPresentationError(ECPresentationStatus.InvalidArgument, "IModelToken doesn't point to any iModel");
    return imodel;
  }

  private toIModelDbOptions<TOptions extends RequestOptions<IModelToken>>(options: TOptions) {
    return Object.assign({}, options, {
      imodel: this.getIModel(options.imodel),
    });
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

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelToken>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getRootNodes(this.toIModelDbOptions(requestOptions));
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelToken>): Promise<number> {
    return await this.getManager().getRootNodesCount(this.toIModelDbOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelToken>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getChildren(this.toIModelDbOptions(requestOptions), parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelToken>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await this.getManager().getChildrenCount(this.toIModelDbOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelToken>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await this.getManager().getNodePaths(this.toIModelDbOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelToken>, filterText: string): Promise<NodePathElement[]> {
    return await this.getManager().getFilteredNodePaths(this.toIModelDbOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await this.getManager().getContentDescriptor(this.toIModelDbOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await this.getManager().getContentSetSize(this.toIModelDbOptions(requestOptions), descriptor, keys);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelToken>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content: Content = await this.getManager().getContent(this.toIModelDbOptions(requestOptions), descriptor, keys);
    content.descriptor.resetParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return await this.getManager().getDistinctValues(this.toIModelDbOptions(requestOptions), descriptor, keys, fieldName, maximumValueCount);
  }

  public async setUserSettingValue(ruleSetId: string, settingId: string, value: SettingValue): Promise<void> {
    return await this.getManager().settings.setValue(ruleSetId, settingId, value);
  }

  public async getUserSettingValue(ruleSetId: string, settingId: string, settingType: SettingValueTypes): Promise<any> {
    return await this.getManager().settings.getValue(ruleSetId, settingId, settingType);
  }
}
