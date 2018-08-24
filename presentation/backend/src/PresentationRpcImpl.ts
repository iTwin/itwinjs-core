/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Guid } from "@bentley/bentleyjs-core";
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
  RpcRequestOptions,
} from "@bentley/presentation-common/lib/PresentationRpcInterface";
import { VariableValueTypes, VariableValue } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import Presentation from "./Presentation";
import RulesetVariablesManager from "./RulesetVariablesManager";
import PresentationManager from "./PresentationManager";

/**
 * The backend implementation of PresentationRpcInterface. All it's basically
 * responsible for is forwarding calls to [[Presentation.manager]].
 *
 * Consumers should not use this class. Instead, they should register
 * [PresentationRpcInterface]($presentation-common):
 * ``` ts
 * [[include:Backend.Initialization.RpcInterface]]
 * ```
 *
 * @hidden
 */
export default class PresentationRpcImpl extends PresentationRpcInterface {

  private _implId: string;

  public constructor(id?: string) {
    super();
    this._implId = id || Guid.createValue();
  }

  /**
   * Get the [[PresentationManager]] used by this RPC impl.
   */
  public getManager(clientId?: string): PresentationManager {
    return Presentation.getManager(clientId);
  }

  private getIModel(token: IModelToken): IModelDb {
    const imodel = IModelDb.find(token);
    if (!imodel)
      throw new PresentationError(PresentationStatus.InvalidArgument, "IModelToken doesn't point to any iModel");
    return imodel;
  }

  private toIModelDbOptions<TOptions extends (RpcRequestOptions & RequestOptions<IModelToken>)>(options: TOptions) {
    const { clientId, knownBackendIds, ...requestOptions } = options as any;
    return Object.assign({}, requestOptions, {
      imodel: this.getIModel(options.imodel),
    });
  }

  private verifyRequest(request: RpcRequestOptions) {
    if (-1 === request.knownBackendIds.indexOf(this._implId))
      throw new PresentationError(PresentationStatus.UnknownBackend, this._implId);
  }

  public async getRootNodes(requestOptions: Paged<HierarchyRpcRequestOptions>): Promise<Node[]> {
    this.verifyRequest(requestOptions);
    return [...await this.getManager(requestOptions.clientId).getRootNodes(this.toIModelDbOptions(requestOptions))];
  }

  public async getRootNodesCount(requestOptions: HierarchyRpcRequestOptions): Promise<number> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getRootNodesCount(this.toIModelDbOptions(requestOptions));
  }

  public async getChildren(requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey: Readonly<NodeKey>): Promise<Node[]> {
    this.verifyRequest(requestOptions);
    return [...await this.getManager(requestOptions.clientId).getChildren(this.toIModelDbOptions(requestOptions), parentKey)];
  }

  public async getChildrenCount(requestOptions: HierarchyRpcRequestOptions, parentKey: Readonly<NodeKey>): Promise<number> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getChildrenCount(this.toIModelDbOptions(requestOptions), parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRpcRequestOptions, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getNodePaths(this.toIModelDbOptions(requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRpcRequestOptions, filterText: string): Promise<NodePathElement[]> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getFilteredNodePaths(this.toIModelDbOptions(requestOptions), filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRpcRequestOptions, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    this.verifyRequest(requestOptions);
    const descriptor = await this.getManager(requestOptions.clientId).getContentDescriptor(this.toIModelDbOptions(requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getContentSetSize(this.toIModelDbOptions(requestOptions), descriptor, keys);
  }

  public async getContent(requestOptions: Paged<ContentRpcRequestOptions>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    this.verifyRequest(requestOptions);
    const content: Content = await this.getManager(requestOptions.clientId).getContent(this.toIModelDbOptions(requestOptions), descriptor, keys);
    content.descriptor.resetParentship();
    return content;
  }

  public async getDistinctValues(requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getDistinctValues(this.toIModelDbOptions(requestOptions), descriptor, keys, fieldName, maximumValueCount);
  }

  public async getRuleset(requestOptions: RulesetRpcRequestOptions, rulesetId: string): Promise<[Ruleset, string] | undefined> {
    this.verifyRequest(requestOptions);
    const ruleset = await this.getManager(requestOptions.clientId).rulesets().get(rulesetId);
    if (ruleset)
      return [ruleset.toJSON(), ruleset.hash];
    return undefined;
  }

  public async addRuleset(requestOptions: RulesetRpcRequestOptions, ruleset: Ruleset): Promise<string> {
    this.verifyRequest(requestOptions);
    return (await this.getManager(requestOptions.clientId).rulesets().add(ruleset)).hash;
  }

  public async addRulesets(requestOptions: RulesetRpcRequestOptions, rulesets: Ruleset[]): Promise<string[]> {
    this.verifyRequest(requestOptions);
    const rulesetsManager = this.getManager(requestOptions.clientId).rulesets();
    const registeredRulesets = await Promise.all(rulesets.map((r) => rulesetsManager.add(r)));
    return registeredRulesets.map((r) => r.hash);
  }

  public async removeRuleset(requestOptions: RulesetRpcRequestOptions, rulesetId: string, hash: string): Promise<boolean> {
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).rulesets().remove([rulesetId, hash]);
  }

  public async clearRulesets(requestOptions: RulesetRpcRequestOptions): Promise<void> {
    this.verifyRequest(requestOptions);
    await this.getManager(requestOptions.clientId).rulesets().clear();
  }

  public async getRulesetVariableValue(requestOptions: RulesetVariableRpcRequestOptions, id: string, type: VariableValueTypes): Promise<VariableValue> {
    this.verifyRequest(requestOptions);
    return await (this.getManager(requestOptions.clientId).vars(requestOptions.rulesetId) as RulesetVariablesManager).getValue(id, type);
  }

  public async setRulesetVariableValue(requestOptions: RulesetVariableRpcRequestOptions, id: string, type: VariableValueTypes, value: VariableValue): Promise<void> {
    this.verifyRequest(requestOptions);
    await (this.getManager(requestOptions.clientId).vars(requestOptions.rulesetId) as RulesetVariablesManager).setValue(id, type, value);
  }

  public async setRulesetVariableValues(requestOptions: RulesetVariableRpcRequestOptions, values: Array<[string, VariableValueTypes, VariableValue]>): Promise<void> {
    this.verifyRequest(requestOptions);
    const vars = this.getManager(requestOptions.clientId).vars(requestOptions.rulesetId) as RulesetVariablesManager;
    await Promise.all(values.map((entry) => vars.setValue(entry[0], entry[1], entry[2])));
  }
}
