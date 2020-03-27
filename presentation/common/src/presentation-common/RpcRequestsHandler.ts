/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Guid, IDisposable, Id64String } from "@bentley/bentleyjs-core";
import { IModelTokenProps, RpcManager } from "@bentley/imodeljs-common";
import { KeySetJSON } from "./KeySet";
import { PresentationStatus, PresentationError } from "./Error";
import { InstanceKeyJSON } from "./EC";
import { NodeKeyJSON } from "./hierarchy/Key";
import { NodeJSON } from "./hierarchy/Node";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { LabelDefinitionJSON } from "./LabelDefinition";
import { SelectionInfo, DescriptorJSON, DescriptorOverrides } from "./content/Descriptor";
import { ContentJSON } from "./content/Content";
import { SelectionScope } from "./selection/SelectionScope";
import { HierarchyRequestOptions, ContentRequestOptions, Paged, SelectionScopeRequestOptions, LabelRequestOptions } from "./PresentationManagerOptions";
import { PresentationRpcInterface, PresentationRpcRequestOptions, PresentationRpcResponse } from "./PresentationRpcInterface";
import { Omit } from "./Utils";

/**
 * Configuration parameters for [[RpcRequestsHandler]].
 *
 * @internal
 */
export interface RpcRequestsHandlerProps {
  /**
   * Optional ID used to identify client that requests data. If not specified,
   * the handler creates a unique GUID as a client id.
   * @internal
   */
  clientId?: string;
}

/**
 * RPC requests handler that wraps [[PresentationRpcInterface]] and
 * adds handling for cases when backend needs to be synced with client
 * state.
 *
 * @internal
 */
export class RpcRequestsHandler implements IDisposable {
  private _maxRequestRepeatCount: number = 10;

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  public constructor(props?: RpcRequestsHandlerProps) {
    this.clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
  }

  public dispose() {
  }

  // tslint:disable-next-line:naming-convention
  private get rpcClient(): PresentationRpcInterface { return RpcManager.getClientForInterface(PresentationRpcInterface); }

  private createRequestOptions<T>(options: T): PresentationRpcRequestOptions & T {
    return Object.assign({}, options, {
      clientId: this.clientId,
    });
  }

  private async requestRepeatedly<TResult, TOptions extends PresentationRpcRequestOptions>(func: (opts: TOptions) => PresentationRpcResponse<TResult>, options: TOptions, imodelToken: IModelTokenProps, repeatCount: number = 1): Promise<TResult> {
    const response = await func(options);

    if (response.statusCode === PresentationStatus.Success)
      return response.result!;

    if (response.statusCode === PresentationStatus.BackendTimeout && repeatCount < this._maxRequestRepeatCount) {
      repeatCount++;
      return this.requestRepeatedly(func, options, imodelToken, repeatCount);
    }

    throw new PresentationError(response.statusCode, response.errorMessage);
  }

  /**
   * Send request to current backend. If the backend is unknown to the requestor,
   * the request is rejected with `PresentationStatus.UnknownBackend` status. In
   * such case the client is synced with the backend using registered `syncHandlers`
   * and the request is repeated.
   *
   * @internal
   */
  public async request<TResult, TOptions extends PresentationRpcRequestOptions & { imodel: IModelTokenProps }, TArg = any>(
    context: any,
    func: (token: IModelTokenProps, options: Omit<TOptions, "imodel">, ...args: TArg[]) => PresentationRpcResponse<TResult>,
    options: TOptions,
    ...args: TArg[]): Promise<TResult> {
    type TFuncOptions = Omit<TOptions, "imodel">;
    const { imodel, ...rpcOptions } = (options as (PresentationRpcRequestOptions & { imodel: IModelTokenProps })); // TS2700: Rest types may only be created from object types...
    const doRequest = async (funcOptions: TFuncOptions) => func.apply(context, [imodel, funcOptions, ...args]);
    return this.requestRepeatedly(doRequest, rpcOptions as TFuncOptions, options.imodel);
  }
  public async getNodesAndCount(options: Paged<HierarchyRequestOptions<IModelTokenProps>>, parentKey?: NodeKeyJSON) {
    return this.request<{ nodes: NodeJSON[], count: number }, Paged<HierarchyRequestOptions<IModelTokenProps>>, any>(
      this.rpcClient, this.rpcClient.getNodesAndCount, this.createRequestOptions(options), parentKey);
  }
  public async getNodes(options: Paged<HierarchyRequestOptions<IModelTokenProps>>, parentKey?: NodeKeyJSON): Promise<NodeJSON[]> {
    return this.request<NodeJSON[], Paged<HierarchyRequestOptions<IModelTokenProps>>>(
      this.rpcClient, this.rpcClient.getNodes, this.createRequestOptions(options), parentKey);
  }
  public async getNodesCount(options: HierarchyRequestOptions<IModelTokenProps>, parentKey?: NodeKeyJSON): Promise<number> {
    return this.request<number, HierarchyRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getNodesCount, this.createRequestOptions(options), parentKey);
  }
  public async getNodePaths(options: HierarchyRequestOptions<IModelTokenProps>, paths: InstanceKeyJSON[][], markedIndex: number): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], HierarchyRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getNodePaths, this.createRequestOptions(options), paths, markedIndex);
  }
  public async getFilteredNodePaths(options: HierarchyRequestOptions<IModelTokenProps>, filterText: string): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], HierarchyRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getFilteredNodePaths, this.createRequestOptions(options), filterText);
  }
  public async loadHierarchy(options: HierarchyRequestOptions<IModelTokenProps>): Promise<void> {
    return this.request<void, HierarchyRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.loadHierarchy, this.createRequestOptions(options));
  }

  public async getContentDescriptor(options: ContentRequestOptions<IModelTokenProps>, displayType: string, keys: KeySetJSON, selection: SelectionInfo | undefined): Promise<DescriptorJSON | undefined> {
    return this.request<DescriptorJSON | undefined, ContentRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getContentDescriptor, this.createRequestOptions(options), displayType, keys, selection);
  }
  public async getContentSetSize(options: ContentRequestOptions<IModelTokenProps>, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): Promise<number> {
    return this.request<number, ContentRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getContentSetSize, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getContent(options: ContentRequestOptions<IModelTokenProps>, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): Promise<ContentJSON | undefined> {
    return this.request<ContentJSON | undefined, ContentRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getContent, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getContentAndSize(options: ContentRequestOptions<IModelTokenProps>, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON) {
    return this.request<{ content?: ContentJSON, size: number }, ContentRequestOptions<IModelTokenProps>, any>(
      this.rpcClient, this.rpcClient.getContentAndSize, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getDistinctValues(options: ContentRequestOptions<IModelTokenProps>, descriptor: DescriptorJSON, keys: KeySetJSON, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return this.request<string[], ContentRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getDistinctValues, this.createRequestOptions(options), descriptor, keys, fieldName, maximumValueCount);
  }

  public async getDisplayLabelDefinition(options: LabelRequestOptions<IModelTokenProps>, key: InstanceKeyJSON): Promise<LabelDefinitionJSON> {
    return this.request<LabelDefinitionJSON, LabelRequestOptions<IModelTokenProps>, any>(
      this.rpcClient, this.rpcClient.getDisplayLabelDefinition, this.createRequestOptions(options), key);
  }
  public async getDisplayLabelDefinitions(options: LabelRequestOptions<IModelTokenProps>, keys: InstanceKeyJSON[]): Promise<LabelDefinitionJSON[]> {
    return this.request<LabelDefinitionJSON[], LabelRequestOptions<IModelTokenProps>, any>(
      this.rpcClient, this.rpcClient.getDisplayLabelDefinitions, this.createRequestOptions(options), keys);
  }

  public async getSelectionScopes(options: SelectionScopeRequestOptions<IModelTokenProps>): Promise<SelectionScope[]> {
    return this.request<SelectionScope[], SelectionScopeRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.getSelectionScopes, this.createRequestOptions(options));
  }
  public async computeSelection(options: SelectionScopeRequestOptions<IModelTokenProps>, ids: Id64String[], scopeId: string): Promise<KeySetJSON> {
    return this.request<KeySetJSON, SelectionScopeRequestOptions<IModelTokenProps>>(
      this.rpcClient, this.rpcClient.computeSelection, this.createRequestOptions(options), ids, scopeId);
  }
}
