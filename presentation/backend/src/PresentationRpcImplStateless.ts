/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { ClientRequestContext, Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  Node, NodeKey, NodePathElement,
  Descriptor, SelectionInfo,
  PresentationError, PresentationStatus,
  Paged, RequestOptions, InstanceKey, KeySet,
  Omit, SelectionScope, DescriptorOverrides,
  PresentationRpcResponse, PresentationRpcRequestOptions,
  HierarchyRpcRequestOptions, ContentRpcRequestOptions,
  SelectionScopeRpcRequestOptions, ClientStateSyncRequestOptions,
  LabelRpcRequestOptions, PresentationRpcInterface, Ruleset,
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
export class PresentationRpcImplStateless extends PresentationRpcInterface {

  public constructor(_id?: string) {
    super();
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

  private async makeRequest<TResult>(token: IModelToken, requestOptions: any, request: ContentGetter<Promise<TResult>>): PresentationRpcResponse<TResult> {
    const requestContext = ClientRequestContext.current;

    let options: {};
    try {
      options = this.toIModelDbOptions(token, requestOptions);
    } catch (e) {
      return this.errorResponse((e as PresentationError).errorNumber, (e as PresentationError).message);
    }

    const resultPromise = request(requestContext, options)
      .then((result: TResult) => this.successResponse(result))
      .catch((e: PresentationError) => this.errorResponse(e.errorNumber, e.message));

    if (this.requestTimeout === 0)
      return resultPromise;

    let timeout: NodeJS.Timeout;
    const timeoutPromise = new Promise<any>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject("Timed out");
      }, this.requestTimeout);
    });

    return Promise.race([resultPromise, timeoutPromise])
      .catch(() => this.errorResponse(PresentationStatus.BackendTimeout))
      .finally(() => clearTimeout(timeout));
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

  public async loadHierarchy(token: IModelToken, requestOptions: HierarchyRpcRequestOptions): PresentationRpcResponse<void> {
    return this.makeRequest(token, requestOptions, async (requestContext, options) => {
      // note: we intentionally don't await here - don't want frontend waiting for this task to complete
      // tslint:disable-next-line: no-floating-promises
      this.getManager(requestOptions.clientId).loadHierarchy(requestContext, options)
        .catch((e) => Logger.logWarning("Presentation", `Error loading '${getRulesetId(requestOptions)}' hierarchy: ${e}`));
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

  public async syncClientState(_token: IModelToken, _options: ClientStateSyncRequestOptions): PresentationRpcResponse {
    return {
      statusCode: PresentationStatus.Error,
      errorMessage: "'syncClientState' call is deprecated since PresentationRpcInterface version 1.1.0",
    };
  }
}

// istanbul ignore next: used only for log messages
const getRulesetId = (props: { rulesetOrId?: string | Ruleset; rulesetId?: string }) => {
  if (props.rulesetOrId) {
    if (typeof props.rulesetOrId === "object")
      return props.rulesetOrId.id;
    return props.rulesetOrId;
  }
  if (props.rulesetId)
    return props.rulesetId;
  return "<unknown>";
};

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
