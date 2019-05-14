/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { ClientRequestContext, Id64String, BeDuration } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  Node, NodeKey, NodePathElement,
  Descriptor, SelectionInfo,
  PresentationError, PresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet,
  RulesetManagerState, RulesetVariablesState,
  Omit, SelectionScope, DescriptorOverrides,
  PresentationRpcResponse, PresentationRpcRequestOptions,
  HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  SelectionScopeRpcRequestOptions, ClientStateSyncRequestOptions,
  LabelRpcRequestOptions,
} from "@bentley/presentation-common";
import { NodeJSON } from "@bentley/presentation-common/lib/hierarchy/Node";
import { NodeKeyJSON } from "@bentley/presentation-common/lib/hierarchy/Key";
import { DescriptorJSON } from "@bentley/presentation-common/lib/content/Descriptor";
import { KeySetJSON } from "@bentley/presentation-common/lib/KeySet";
import { InstanceKeyJSON } from "@bentley/presentation-common/lib/EC";
import { NodePathElementJSON } from "@bentley/presentation-common/lib/hierarchy/NodePathElement";
import { ContentJSON } from "@bentley/presentation-common/lib/content/Content";
import { Presentation } from "./Presentation";
import { PresentationManager } from "./PresentationManager";
import { RulesetVariablesManager } from "./RulesetVariablesManager";

type ContentGetter<TResult = any> = (requestContext: ClientRequestContext, requestOptions: any) => TResult;

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
 * @internal
 */
export class PresentationRpcImpl extends PresentationRpcInterface {

  private _clientStateIds: Map<string, string>; // clientId: clientStateId

  public constructor(_id?: string) {
    super();
    this._clientStateIds = new Map();
  }

  /**
   * Get the maximum result waiting time.
   */
  public get requestTimeout(): number { return Presentation.getRequestTimeout(); }

  /** Returns an ok response with result inside */
  private successResponse<TResult>(result: TResult) {
    return {
      statusCode: PresentationStatus.Success,
      result,
    };
  }

  /** Returns a bad request response with empty result and an error code */
  private errorResponse(errorCode: PresentationStatus, errorMessage?: string) {
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

  private toIModelDbOptions<TOptions extends (PresentationRpcRequestOptions & Omit<RequestOptions<IModelToken>, "imodel" | "rulesetId">)>(token: IModelToken, options: TOptions) {
    const { clientId, clientStateId, ...requestOptions } = options;

    return { ...requestOptions, imodel: this.getIModel(token) };
  }

  private verifyRequest(request: PresentationRpcRequestOptions) {
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
    const requestContext = ClientRequestContext.current;

    const status = this.verifyRequest(requestOptions);
    if (status !== PresentationStatus.Success)
      return this.errorResponse(status);

    let options: {};
    try {
      options = this.toIModelDbOptions(token, requestOptions);
    } catch (e) {
      return this.errorResponse((e as PresentationError).errorNumber, (e as PresentationError).message);
    }
    let timeout = false;
    const waitPromise = BeDuration.wait(this.requestTimeout).then(() => { timeout = true; });
    const result = await Promise.race([request(requestContext, options), waitPromise]);
    if (timeout) {
      return {
        statusCode: PresentationStatus.BackendTimeout,
        result: undefined,
      };
    }
    requestContext.enter();
    return this.successResponse(result as TResult);
  }

  public async getNodesAndCount(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: NodeKeyJSON) {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const result = await this.getManager(requestOptions.clientId).getNodesAndCount(requestContext, options, nodeKeyFromJson(parentKey));
      requestContext.enter();
      return { ...result, nodes: result.nodes.map(Node.toJSON) };
    });
  }

  public async getNodes(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: NodeKeyJSON): PresentationRpcResponse<NodeJSON[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const nodes = await this.getManager(requestOptions.clientId).getNodes(requestContext, options, nodeKeyFromJson(parentKey));
      requestContext.enter();
      return nodes.map(Node.toJSON);
    });
  }

  public async getNodesCount(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, parentKey?: NodeKeyJSON): PresentationRpcResponse<number> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getNodesCount(requestContext, options, nodeKeyFromJson(parentKey)),
    );
  }

  public async getNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, paths: InstanceKeyJSON[][], markedIndex: number): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const result = await this.getManager(requestOptions.clientId).getNodePaths(requestContext, options, paths, markedIndex);
      requestContext.enter();
      return result.map(NodePathElement.toJSON);
    });
  }

  public async getFilteredNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, filterText: string): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const result = await this.getManager(requestOptions.clientId).getFilteredNodePaths(requestContext, options, filterText);
      requestContext.enter();
      return result.map(NodePathElement.toJSON);
    });
  }

  public async getContentDescriptor(token: IModelToken, requestOptions: ContentRpcRequestOptions, displayType: string, keys: KeySetJSON, selection: SelectionInfo | undefined): PresentationRpcResponse<DescriptorJSON | undefined> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const descriptor = await this.getManager(requestOptions.clientId).getContentDescriptor(requestContext, options, displayType, KeySet.fromJSON(keys), selection);
      requestContext.enter();
      if (descriptor)
        return descriptor.toJSON();
      return undefined;
    });
  }

  public async getContentSetSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): PresentationRpcResponse<number> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getContentSetSize(requestContext, options, descriptorFromJson(descriptorOrOverrides), KeySet.fromJSON(keys)),
    );
  }

  public async getContentAndSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON) {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const result = await this.getManager(requestOptions.clientId).getContentAndSize(requestContext, options, descriptorFromJson(descriptorOrOverrides), KeySet.fromJSON(keys));
      requestContext.enter();
      if (result.content)
        return { ...result, content: result.content.toJSON() };
      return { ...result, content: undefined };
    });
  }

  public async getContent(token: IModelToken, requestOptions: Paged<ContentRpcRequestOptions>, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): PresentationRpcResponse<ContentJSON | undefined> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const content = await this.getManager(requestOptions.clientId).getContent(requestContext, options, descriptorFromJson(descriptorOrOverrides), KeySet.fromJSON(keys));
      requestContext.enter();
      if (content)
        return content.toJSON();
      return undefined;
    });
  }

  public async getDistinctValues(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptor: DescriptorJSON, keys: KeySetJSON, fieldName: string, maximumValueCount: number): PresentationRpcResponse<string[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getDistinctValues(requestContext, options, Descriptor.fromJSON(descriptor)!, KeySet.fromJSON(keys), fieldName, maximumValueCount),
    );
  }

  public async getDisplayLabel(token: IModelToken, requestOptions: LabelRpcRequestOptions, key: InstanceKeyJSON): PresentationRpcResponse<string> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getDisplayLabel(requestContext, options, InstanceKey.fromJSON(key)),
    );
  }

  public async getDisplayLabels(token: IModelToken, requestOptions: LabelRpcRequestOptions, keys: InstanceKeyJSON[]): PresentationRpcResponse<string[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getDisplayLabels(requestContext, options, keys.map(InstanceKey.fromJSON)),
    );
  }

  public async getSelectionScopes(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) =>
      this.getManager(requestOptions.clientId).getSelectionScopes(requestContext, options),
    );
  }

  public async computeSelection(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions, ids: Id64String[], scopeId: string): PresentationRpcResponse<KeySetJSON> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      const keys = await this.getManager(requestOptions.clientId).computeSelection(requestContext, options, ids, scopeId);
      requestContext.enter();
      return keys.toJSON();
    });
  }

  public async syncClientState(_token: IModelToken, options: ClientStateSyncRequestOptions): PresentationRpcResponse {
    const requestContext = ClientRequestContext.current;
    if (!options.clientStateId)
      return this.errorResponse(PresentationStatus.InvalidArgument, "clientStateId must be set when syncing with client state");

    if (options.state.hasOwnProperty(RulesetManagerState.STATE_ID)) {
      const rulesetsState = options.state[RulesetManagerState.STATE_ID];
      if (!Array.isArray(rulesetsState))
        return this.errorResponse(PresentationStatus.InvalidArgument, "rulesets in client state should be an array");
      await this.syncClientRulesetsState(requestContext, options.clientId, rulesetsState);
      requestContext.enter();
    }

    if (options.state.hasOwnProperty(RulesetVariablesState.STATE_ID)) {
      const varsState = options.state[RulesetVariablesState.STATE_ID];
      if (typeof varsState !== "object")
        return this.errorResponse(PresentationStatus.InvalidArgument, "ruleset variables in client state should be an array");
      await this.syncClientRulesetVariablesState(requestContext, options.clientId, varsState as RulesetVariablesState);
      requestContext.enter();
    }

    this._clientStateIds.set(options.clientId || "", options.clientStateId);

    return this.successResponse(undefined);
  }

  private async syncClientRulesetsState(requestContext: ClientRequestContext, clientId: string | undefined, rulesets: RulesetManagerState): Promise<void> {
    requestContext.enter();
    const manager = this.getManager(clientId).rulesets();
    manager.clear();
    await Promise.all(rulesets.map((r) => manager.add(r)));
  }

  private async syncClientRulesetVariablesState(requestContext: ClientRequestContext, clientId: string | undefined, vars: RulesetVariablesState): Promise<void> {
    requestContext.enter();
    for (const rulesetId in vars) {
      // istanbul ignore if
      if (!vars.hasOwnProperty(rulesetId))
        continue;

      const manager = this.getManager(clientId).vars(rulesetId) as RulesetVariablesManager;
      const values = vars[rulesetId];
      // todo: need to somehow clear client state before setting new values
      await Promise.all(values.map((v) => manager.setValue(v[0], v[1], v[2])));
      requestContext.enter();
    }
  }
}

const nodeKeyFromJson = (json: NodeKeyJSON | undefined): NodeKey | undefined => {
  if (!json)
    return undefined;
  return NodeKey.fromJSON(json);
};

const descriptorFromJson = (json: DescriptorJSON | DescriptorOverrides): Descriptor | DescriptorOverrides => {
  if ((json as DescriptorJSON).connectionId)
    return Descriptor.fromJSON(json as DescriptorJSON)!;
  return json as DescriptorOverrides;
};
