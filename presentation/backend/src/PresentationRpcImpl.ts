/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { ActivityLoggingContext, Id64String } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  Node, NodeKey, NodePathElement,
  Content, Descriptor, SelectionInfo,
  PresentationError, PresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet,
  RulesetManagerState, RulesetVariablesState,
  Omit, SelectionScope, DescriptorOverrides,
  NodesResponse, ContentResponse, RpcResponse,
  PresentationRpcResponse, RpcRequestOptions,
  HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  SelectionScopeRpcRequestOptions, ClientStateSyncRequestOptions,
} from "@bentley/presentation-common";
import Presentation from "./Presentation";
import PresentationManager from "./PresentationManager";
import RulesetVariablesManager from "./RulesetVariablesManager";

type ContentGetter<TResult = any> = (actx: ActivityLoggingContext, requestOptions: any) => TResult;

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

  /** Returns an ok response with result inside */
  private successResponse<TResult>(result: TResult): RpcResponse<TResult> {
    return {
      statusCode: PresentationStatus.Success,
      result,
    };
  }

  /** Returns a bad request response with empty result and an error code */
  private errorResponse(errorCode: PresentationStatus, errorMessage?: string): RpcResponse<undefined> {
    return {
      statusCode: errorCode,
      result: undefined,
      errorMessage,
    };
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

  private toIModelDbOptions<TOptions extends (RpcRequestOptions & Omit<RequestOptions<IModelToken>, "imodel" | "rulesetId">)>(token: IModelToken, options: TOptions) {
    const { clientId, clientStateId, ...requestOptions } = options;

    return { ...requestOptions, imodel: this.getIModel(token) };
  }

  private verifyRequest(request: RpcRequestOptions) {
    if (!request.clientStateId) {
      // client has no state of its own
      return PresentationStatus.Success;
    }

    const clientId = request.clientId || "";
    const storedClientStateId = this._clientStateIds.get(clientId);
    if (!storedClientStateId || storedClientStateId !== request.clientStateId) {
      // client state needs to be synced
      return PresentationStatus.BackendOutOfSync;
    }

    return PresentationStatus.Success;
  }

  private async makeRequest<TResult>(token: IModelToken, requestOptions: any, request: ContentGetter<Promise<TResult>>): PresentationRpcResponse<TResult> {
    const actx = ActivityLoggingContext.current;
    actx.enter();

    const status = this.verifyRequest(requestOptions);
    if (status !== PresentationStatus.Success)
      return this.errorResponse(status);

    let options: {};
    try {
      options = this.toIModelDbOptions(token, requestOptions);
    } catch (e) {
      return this.errorResponse((e as PresentationError).errorNumber, (e as PresentationError).message);
    }

    const result = await request(actx, options) as TResult;
    actx.enter();
    return this.successResponse(result);
  }

  public async getNodesAndCount(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: Readonly<NodeKey>): PresentationRpcResponse<NodesResponse> {
    const contentGetter: ContentGetter<Promise<NodesResponse>> = async (actx, options) =>
      this.getManager(requestOptions.clientId).getNodesAndCount(actx, options, parentKey);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getNodes(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: Readonly<NodeKey>): PresentationRpcResponse<Node[]> {
    const contentGetter: ContentGetter<Promise<Node[]>> = async (actx, options) => [
      ...await this.getManager(requestOptions.clientId).getNodes(actx, options, parentKey),
    ];

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getNodesCount(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, parentKey?: Readonly<NodeKey>): PresentationRpcResponse<number> {
    const contentGetter: ContentGetter<Promise<number>> = (actx, options) =>
      this.getManager(requestOptions.clientId).getNodesCount(actx, options, parentKey);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, paths: InstanceKey[][], markedIndex: number): PresentationRpcResponse<NodePathElement[]> {
    const contentGetter: ContentGetter<Promise<NodePathElement[]>> = (actx, options) =>
      this.getManager(requestOptions.clientId).getNodePaths(actx, options, paths, markedIndex);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getFilteredNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, filterText: string): PresentationRpcResponse<NodePathElement[]> {
    const contentGetter: ContentGetter<Promise<NodePathElement[]>> = (actx, options) =>
      this.getManager(requestOptions.clientId).getFilteredNodePaths(actx, options, filterText);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getContentDescriptor(token: IModelToken, requestOptions: ContentRpcRequestOptions, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): PresentationRpcResponse<Readonly<Descriptor> | undefined> {
    const contentGetter: ContentGetter<Promise<Readonly<Descriptor> | undefined>> = async (actx, options) => {
      const descriptor = await this.getManager(requestOptions.clientId).getContentDescriptor(actx, options, displayType, keys, selection);
      actx.enter();
      if (descriptor)
        descriptor.resetParentship();
      return descriptor;
    };

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getContentSetSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): PresentationRpcResponse<number> {
    const contentGetter: ContentGetter<Promise<number>> = async (actx, options) =>
      this.getManager(requestOptions.clientId).getContentSetSize(actx, options, descriptorOrOverrides, keys);
    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getContentAndSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): PresentationRpcResponse<Readonly<ContentResponse>> {
    const contentGetter: ContentGetter<Promise<Readonly<ContentResponse>>> = async (actx, options) => {
      const result = await this.getManager(requestOptions.clientId).getContentAndSize(actx, options, descriptorOrOverrides, keys);
      actx.enter();
      if (result.content)
        result.content.descriptor.resetParentship();
      return result;
    };
    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getContent(token: IModelToken, requestOptions: Paged<ContentRpcRequestOptions>, descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, keys: Readonly<KeySet>): PresentationRpcResponse<Readonly<Content> | undefined> {
    const contentGetter: ContentGetter<Promise<Readonly<Content> | undefined>> = async (actx, options) => {
      const content = await this.getManager(requestOptions.clientId).getContent(actx, options, descriptorOrOverrides, keys);
      actx.enter();
      if (content)
        content.descriptor.resetParentship();
      return content;
    };
    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getDistinctValues(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): PresentationRpcResponse<string[]> {
    const contentGetter: ContentGetter<Promise<string[]>> = (actx, options) =>
      this.getManager(requestOptions.clientId).getDistinctValues(actx, options, descriptor, keys, fieldName, maximumValueCount);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async getSelectionScopes(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    const contentGetter: ContentGetter<Promise<SelectionScope[]>> = (actx, options) =>
      this.getManager(requestOptions.clientId).getSelectionScopes(actx, options);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async computeSelection(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions, ids: Readonly<Id64String[]>, scopeId: string): PresentationRpcResponse<KeySet> {
    const contentGetter: ContentGetter<Promise<KeySet>> = (actx, options) =>
      this.getManager(requestOptions.clientId).computeSelection(actx, options, ids, scopeId);

    return this.makeRequest(token, requestOptions, contentGetter);
  }

  public async syncClientState(_token: IModelToken, options: ClientStateSyncRequestOptions): PresentationRpcResponse {
    const actx = ActivityLoggingContext.current; actx.enter();
    if (!options.clientStateId)
      return this.errorResponse(PresentationStatus.InvalidArgument, "clientStateId must be set when syncing with client state");

    if (options.state.hasOwnProperty(RulesetManagerState.STATE_ID)) {
      const rulesetsState = options.state[RulesetManagerState.STATE_ID];
      if (!Array.isArray(rulesetsState))
        return this.errorResponse(PresentationStatus.InvalidArgument, "rulesets in client state should be an array");
      await this.syncClientRulesetsState(actx, options.clientId, rulesetsState);
      actx.enter();
    }

    if (options.state.hasOwnProperty(RulesetVariablesState.STATE_ID)) {
      const varsState = options.state[RulesetVariablesState.STATE_ID];
      if (typeof varsState !== "object")
        return this.errorResponse(PresentationStatus.InvalidArgument, "ruleset variables in client state should be an array");
      await this.syncClientRulesetVariablesState(actx, options.clientId, varsState as RulesetVariablesState);
      actx.enter();
    }

    this._clientStateIds.set(options.clientId || "", options.clientStateId);

    return this.successResponse(undefined);
  }

  private async syncClientRulesetsState(actx: ActivityLoggingContext, clientId: string | undefined, rulesets: RulesetManagerState): Promise<void> {
    actx.enter();
    const manager = this.getManager(clientId).rulesets();
    manager.clear();
    await Promise.all(rulesets.map((r) => manager.add(r)));
  }

  private async syncClientRulesetVariablesState(actx: ActivityLoggingContext, clientId: string | undefined, vars: RulesetVariablesState): Promise<void> {
    actx.enter();
    for (const rulesetId in vars) {
      // istanbul ignore if
      if (!vars.hasOwnProperty(rulesetId))
        continue;

      const manager = this.getManager(clientId).vars(rulesetId) as RulesetVariablesManager;
      const values = vars[rulesetId];
      // todo: need to somehow clear client state before setting new values
      await Promise.all(values.map((v) => manager.setValue(v[0], v[1], v[2])));
      actx.enter();
    }
  }
}
