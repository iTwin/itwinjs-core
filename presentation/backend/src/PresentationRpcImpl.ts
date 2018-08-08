/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  Node, NodeKey, NodePathElement,
  Content, Descriptor, SelectionInfo,
  PresentationError, PresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet, Ruleset,
} from "@bentley/presentation-common";
import {
  HierarchyRpcRequestOptions,
  ContentRpcRequestOptions,
  RulesetRpcRequestOptions,
  RulesetVariableRpcRequestOptions,
} from "@bentley/presentation-common/lib/PresentationRpcInterface";
import { VariableValueJSON, VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import Presentation from "./Presentation";
import RulesetVariablesManager from "./RulesetVariablesManager";
import IBackendPresentationManager from "./IBackendPresentationManager";

/**
 * The backend implementation of PresentationRpcInterface. All it's basically
 * responsible for is forwarding calls to [[Presentation.manager]].
 *
 * Consumers should not use this class. Instead, they should register
 * [PresentationRpcInterface]($presentation-common):
 * ``` ts
 * [[include:Backend.Initialization.RpcInterface]]
 * ```
 */
export default class PresentationRpcImpl extends PresentationRpcInterface {

  /**
   * Get the [[IBackendPresentationManager]] used by this RPC impl.
   */
  public getManager(): IBackendPresentationManager {
    return Presentation.manager;
  }

  private getIModel(token: IModelToken): IModelDb {
    const imodel = IModelDb.find(token);
    if (!imodel)
      throw new PresentationError(PresentationStatus.InvalidArgument, "IModelToken doesn't point to any iModel");
    return imodel;
  }

  private toIModelDbOptions<TOptions extends RequestOptions<IModelToken>>(options: TOptions) {
    return Object.assign({}, options, {
      imodel: this.getIModel(options.imodel),
    });
  }

  public async getRootNodes(requestOptions: Paged<HierarchyRpcRequestOptions>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getRootNodes(this.toIModelDbOptions(requestOptions));
  }

  public async getRootNodesCount(requestOptions: HierarchyRpcRequestOptions): Promise<number> {
    return await this.getManager().getRootNodesCount(this.toIModelDbOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getChildren(this.toIModelDbOptions(requestOptions), parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRpcRequestOptions, parentKey: Readonly<NodeKey>): Promise<number> {
    return await this.getManager().getChildrenCount(this.toIModelDbOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRpcRequestOptions, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await this.getManager().getNodePaths(this.toIModelDbOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRpcRequestOptions, filterText: string): Promise<NodePathElement[]> {
    return await this.getManager().getFilteredNodePaths(this.toIModelDbOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRpcRequestOptions, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const descriptor = await this.getManager().getContentDescriptor(this.toIModelDbOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await this.getManager().getContentSetSize(this.toIModelDbOptions(requestOptions), descriptor, keys);
  }

  public async getContent(requestOptions: Paged<ContentRpcRequestOptions>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const content: Content = await this.getManager().getContent(this.toIModelDbOptions(requestOptions), descriptor, keys);
    content.descriptor.resetParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return await this.getManager().getDistinctValues(this.toIModelDbOptions(requestOptions), descriptor, keys, fieldName, maximumValueCount);
  }

  public async getRuleset(requestOptions: RulesetRpcRequestOptions, rulesetId: string): Promise<[Ruleset, string] | undefined> {
    const ruleset = await this.getManager().rulesets(requestOptions.clientId).get(rulesetId);
    if (ruleset)
      return [ruleset.toJSON(), ruleset.hash];
    return undefined;
  }

  public async addRuleset(requestOptions: RulesetRpcRequestOptions, ruleset: Ruleset): Promise<string> {
    return (await this.getManager().rulesets(requestOptions.clientId).add(ruleset)).hash;
  }

  public async removeRuleset(requestOptions: RulesetRpcRequestOptions, rulesetId: string, hash: string): Promise<boolean> {
    return await this.getManager().rulesets(requestOptions.clientId).remove([rulesetId, hash]);
  }

  public async clearRulesets(requestOptions: RulesetRpcRequestOptions): Promise<void> {
    return await this.getManager().rulesets(requestOptions.clientId).clear();
  }

  public async setRulesetVariableValue(requestOptions: RulesetVariableRpcRequestOptions, type: VariableValueTypes, value: VariableValueJSON): Promise<void> {
    const vars = this.getManager().vars(requestOptions.rulesetId, requestOptions.clientId) as RulesetVariablesManager;
    return await vars.setValue(requestOptions.variableId, type, value);
  }

  public async getRulesetVariableValue(requestOptions: RulesetVariableRpcRequestOptions, type: VariableValueTypes): Promise<VariableValueJSON> {
    const vars = this.getManager().vars(requestOptions.rulesetId, requestOptions.clientId) as RulesetVariablesManager;
    return await vars.getValue(requestOptions.variableId, type);
  }
}
