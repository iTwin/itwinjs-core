/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  Node, NodeKey, NodePathElement,
  Content, Descriptor, SelectionInfo,
  PresentationError, PresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet,
  IRulesetManager, IRulesetVariablesManager,
  Omit,
} from "@bentley/presentation-common";
import {
  RpcRequestOptions,
  HierarchyRpcRequestOptions,
  ContentRpcRequestOptions,
  ClientStateSyncRequestOptions,
} from "@bentley/presentation-common/lib/PresentationRpcInterface";
import Presentation from "./Presentation";
import PresentationManager from "./PresentationManager";
import RulesetVariablesManager from "./RulesetVariablesManager";

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

  private _clientStateIds: Map<string, string>; // clientId: clientStateId

  public constructor(_id?: string) {
    super();
    this._clientStateIds = new Map();
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

  private toIModelDbOptions<TOptions extends (RpcRequestOptions & Omit<RequestOptions<IModelToken>, "imodel">)>(token: IModelToken, options: TOptions) {
    const { clientId, knownBackendIds, ...requestOptions } = options as any;
    return Object.assign({}, requestOptions, {
      imodel: this.getIModel(token),
    });
  }

  private verifyRequest(request: RpcRequestOptions) {
    if (!request.clientStateId) {
      // client has no state of its own
      return;
    }

    const clientId = request.clientId || "";
    const storedClientStateId = this._clientStateIds.get(clientId);
    if (!storedClientStateId || storedClientStateId !== request.clientStateId) {
      // client state needs to be synced
      throw new PresentationError(PresentationStatus.BackendOutOfSync);
    }
  }

  public async getRootNodes(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>): Promise<Node[]> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return [...await this.getManager(requestOptions.clientId).getRootNodes(this.toIModelDbOptions(token, requestOptions))];
  }

  public async getRootNodesCount(token: IModelToken, requestOptions: HierarchyRpcRequestOptions): Promise<number> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getRootNodesCount(this.toIModelDbOptions(token, requestOptions));
  }

  public async getChildren(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey: Readonly<NodeKey>): Promise<Node[]> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return [...await this.getManager(requestOptions.clientId).getChildren(this.toIModelDbOptions(token, requestOptions), parentKey)];
  }

  public async getChildrenCount(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, parentKey: Readonly<NodeKey>): Promise<number> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getChildrenCount(this.toIModelDbOptions(token, requestOptions), parentKey);
  }

  public async getNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getNodePaths(this.toIModelDbOptions(token, requestOptions), paths, markedIndex);
  }

  public async getFilteredNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, filterText: string): Promise<NodePathElement[]> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getFilteredNodePaths(this.toIModelDbOptions(token, requestOptions), filterText);
  }

  public async getContentDescriptor(token: IModelToken, requestOptions: ContentRpcRequestOptions, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    const descriptor = await this.getManager(requestOptions.clientId).getContentDescriptor(this.toIModelDbOptions(token, requestOptions), displayType, keys, selection);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getContentSetSize(this.toIModelDbOptions(token, requestOptions), descriptor, keys);
  }

  public async getContent(token: IModelToken, requestOptions: Paged<ContentRpcRequestOptions>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    const content: Content = await this.getManager(requestOptions.clientId).getContent(this.toIModelDbOptions(token, requestOptions), descriptor, keys);
    content.descriptor.resetParentship();
    return content;
  }

  public async getDistinctValues(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    this.verifyRequest(requestOptions);
    return await this.getManager(requestOptions.clientId).getDistinctValues(this.toIModelDbOptions(token, requestOptions), descriptor, keys, fieldName, maximumValueCount);
  }

  public async syncClientState(_token: IModelToken, options: ClientStateSyncRequestOptions): Promise<void> {
    const actx = ActivityLoggingContext.current!; actx.enter();
    if (!options.clientStateId)
      throw new PresentationError(PresentationStatus.InvalidArgument, "clientStateId must be set when syncing with client state");

    if (options.state.hasOwnProperty(IRulesetManager.STATE_ID)) {
      const rulesetsState = options.state[IRulesetManager.STATE_ID];
      if (!Array.isArray(rulesetsState))
        throw new PresentationError(PresentationStatus.InvalidArgument, "rulesets in client state should be an array");
      await this.syncClientRulesetsState(options.clientId, rulesetsState);
    }

    if (options.state.hasOwnProperty(IRulesetVariablesManager.STATE_ID)) {
      const varsState = options.state[IRulesetVariablesManager.STATE_ID];
      if (typeof varsState !== "object")
        throw new PresentationError(PresentationStatus.InvalidArgument, "ruleset variables in client state should be an array");
      await this.syncClientRulesetVariablesState(options.clientId, varsState as IRulesetVariablesManager.State);
    }

    this._clientStateIds.set(options.clientId || "", options.clientStateId);
  }

  private async syncClientRulesetsState(clientId: string | undefined, rulesets: IRulesetManager.State): Promise<void> {
    const manager = this.getManager(clientId).rulesets();
    await manager.clear();
    await Promise.all(rulesets.map((r) => manager.add(r)));
  }

  private async syncClientRulesetVariablesState(clientId: string | undefined, vars: IRulesetVariablesManager.State): Promise<void> {
    for (const rulesetId in vars) {
      // istanbul ignore if
      if (!vars.hasOwnProperty(rulesetId))
        continue;

      const manager = this.getManager(clientId).vars(rulesetId) as RulesetVariablesManager;
      const values = vars[rulesetId];
      // todo: need to somehow clear client state before setting new values
      await Promise.all(values.map((v) => manager.setValue(v[0], v[1], v[2])));
    }
  }
}
