/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Guid, Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { IModelRpcProps, RpcManager } from "@bentley/imodeljs-common";
import { DescriptorJSON, DescriptorOverrides } from "./content/Descriptor";
import { ItemJSON } from "./content/Item";
import { DisplayValueGroupJSON } from "./content/Value";
import { InstanceKeyJSON } from "./EC";
import { PresentationError, PresentationStatus } from "./Error";
import { NodeKeyJSON } from "./hierarchy/Key";
import { NodeJSON } from "./hierarchy/Node";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { KeySetJSON } from "./KeySet";
import { LabelDefinitionJSON } from "./LabelDefinition";
import {
  ContentDescriptorRequestOptions, ContentRequestOptions, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DistinctValuesRequestOptions,
  ExtendedContentRequestOptions, ExtendedHierarchyRequestOptions, HierarchyRequestOptions, Paged, PresentationDataCompareOptions,
  SelectionScopeRequestOptions,
} from "./PresentationManagerOptions";
import { PresentationRpcInterface, PresentationRpcRequestOptions, PresentationRpcResponse } from "./PresentationRpcInterface";
import { SelectionScope } from "./selection/SelectionScope";
import { HierarchyCompareInfoJSON, PartialHierarchyModificationJSON } from "./Update";
import { Omit, PagedResponse } from "./Utils";

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
  private _maxRequestRepeatCount: number = 5;

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  public constructor(props?: RpcRequestsHandlerProps) {
    this.clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
  }

  public dispose() {
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get rpcClient(): PresentationRpcInterface { return RpcManager.getClientForInterface(PresentationRpcInterface); }

  private injectClientId<T>(options: T): PresentationRpcRequestOptions<T> {
    return {
      ...options,
      clientId: this.clientId,
    };
  }

  private async requestRepeatedly<TResult, TOptions extends PresentationRpcRequestOptions<unknown>>(func: (opts: TOptions) => PresentationRpcResponse<TResult>, options: TOptions, repeatCount: number = 1): Promise<TResult> {
    let error: Error | undefined;
    let shouldRepeat = false;
    try {
      const response = await func(options);

      if (response.statusCode === PresentationStatus.Success)
        return response.result!;

      if (response.statusCode === PresentationStatus.BackendTimeout && repeatCount < this._maxRequestRepeatCount)
        shouldRepeat = true;
      else
        error = new PresentationError(response.statusCode, response.errorMessage);

    } catch (e) {
      error = e;
      if (repeatCount < this._maxRequestRepeatCount)
        shouldRepeat = true;
    }

    if (shouldRepeat) {
      ++repeatCount;
      return this.requestRepeatedly(func, options, repeatCount);
    }

    throw error;
  }

  /**
   * Send request to current backend. If the backend is unknown to the requestor,
   * the request is rejected with `PresentationStatus.UnknownBackend` status. In
   * such case the client is synced with the backend using registered `syncHandlers`
   * and the request is repeated.
   *
   * @internal
   */
  public async request<TResult, TOptions extends { imodel: IModelRpcProps }, TArg = any>(
    func: (token: IModelRpcProps, options: PresentationRpcRequestOptions<Omit<TOptions, "imodel">>, ...args: TArg[]) => PresentationRpcResponse<TResult>,
    options: TOptions,
    ...args: TArg[]): Promise<TResult> {
    type TFuncOptions = PresentationRpcRequestOptions<Omit<TOptions, "imodel">>;
    const { imodel, ...rpcOptions } = options;
    const doRequest = async (funcOptions: TFuncOptions) => func(imodel, funcOptions, ...args);
    return this.requestRepeatedly(doRequest, this.injectClientId(rpcOptions));
  }

  public async getNodesCount(options: ExtendedHierarchyRequestOptions<IModelRpcProps, NodeKeyJSON>): Promise<number> {
    return this.request<number, ExtendedHierarchyRequestOptions<IModelRpcProps, NodeKeyJSON>>(
      this.rpcClient.getNodesCount.bind(this.rpcClient), options); // eslint-disable-line deprecation/deprecation
  }
  public async getPagedNodes(options: Paged<ExtendedHierarchyRequestOptions<IModelRpcProps, NodeKeyJSON>>): Promise<PagedResponse<NodeJSON>> {
    return this.request<PagedResponse<NodeJSON>, Paged<ExtendedHierarchyRequestOptions<IModelRpcProps, NodeKeyJSON>>>(
      this.rpcClient.getPagedNodes.bind(this.rpcClient), options);
  }

  public async getNodePaths(options: HierarchyRequestOptions<IModelRpcProps>, paths: InstanceKeyJSON[][], markedIndex: number): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], HierarchyRequestOptions<IModelRpcProps>>(
      this.rpcClient.getNodePaths.bind(this.rpcClient), options, paths, markedIndex);
  }
  public async getFilteredNodePaths(options: HierarchyRequestOptions<IModelRpcProps>, filterText: string): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], HierarchyRequestOptions<IModelRpcProps>>(
      this.rpcClient.getFilteredNodePaths.bind(this.rpcClient), options, filterText);
  }

  public async loadHierarchy(options: HierarchyRequestOptions<IModelRpcProps>): Promise<void> {
    return this.request<void, HierarchyRequestOptions<IModelRpcProps>>(
      this.rpcClient.loadHierarchy.bind(this.rpcClient), options);
  }

  public async getContentDescriptor(options: ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON>): Promise<DescriptorJSON | undefined> {
    return this.request<DescriptorJSON | undefined, ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON>>(
      this.rpcClient.getContentDescriptor.bind(this.rpcClient), options); // eslint-disable-line deprecation/deprecation
  }
  public async getContentSetSize(options: ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>): Promise<number> {
    return this.request<number, ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>(
      this.rpcClient.getContentSetSize.bind(this.rpcClient), options); // eslint-disable-line deprecation/deprecation
  }
  public async getPagedContent(options: Paged<ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>) {
    return this.request<{ descriptor: DescriptorJSON, contentSet: PagedResponse<ItemJSON> } | undefined, Paged<ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>>(
      this.rpcClient.getPagedContent.bind(this.rpcClient), options);
  }
  public async getPagedContentSet(options: Paged<ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>) {
    return this.request<PagedResponse<ItemJSON>, Paged<ExtendedContentRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>>(
      this.rpcClient.getPagedContentSet.bind(this.rpcClient), options);
  }

  public async getDistinctValues(options: ContentRequestOptions<IModelRpcProps>, descriptor: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return this.request<string[], ContentRequestOptions<IModelRpcProps>>(
      this.rpcClient.getDistinctValues.bind(this.rpcClient), options, descriptor, keys, fieldName, maximumValueCount);
  }
  public async getPagedDistinctValues(options: DistinctValuesRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>): Promise<PagedResponse<DisplayValueGroupJSON>> {
    return this.request<PagedResponse<DisplayValueGroupJSON>, DistinctValuesRequestOptions<IModelRpcProps, DescriptorJSON, KeySetJSON>>(
      this.rpcClient.getPagedDistinctValues.bind(this.rpcClient), options);
  }

  public async getDisplayLabelDefinition(options: DisplayLabelRequestOptions<IModelRpcProps, InstanceKeyJSON>): Promise<LabelDefinitionJSON> {
    return this.request<LabelDefinitionJSON, DisplayLabelRequestOptions<IModelRpcProps, InstanceKeyJSON>, any>(
      this.rpcClient.getDisplayLabelDefinition.bind(this.rpcClient), options); // eslint-disable-line deprecation/deprecation
  }
  public async getPagedDisplayLabelDefinitions(options: DisplayLabelsRequestOptions<IModelRpcProps, InstanceKeyJSON>): Promise<PagedResponse<LabelDefinitionJSON>> {
    return this.request<PagedResponse<LabelDefinitionJSON>, DisplayLabelsRequestOptions<IModelRpcProps, InstanceKeyJSON>, any>(
      this.rpcClient.getPagedDisplayLabelDefinitions.bind(this.rpcClient), options);
  }

  public async getSelectionScopes(options: SelectionScopeRequestOptions<IModelRpcProps>): Promise<SelectionScope[]> {
    return this.request<SelectionScope[], SelectionScopeRequestOptions<IModelRpcProps>>(
      this.rpcClient.getSelectionScopes.bind(this.rpcClient), options);
  }
  public async computeSelection(options: SelectionScopeRequestOptions<IModelRpcProps>, ids: Id64String[], scopeId: string): Promise<KeySetJSON> {
    return this.request<KeySetJSON, SelectionScopeRequestOptions<IModelRpcProps>>(
      this.rpcClient.computeSelection.bind(this.rpcClient), options, ids, scopeId);
  }
  public async compareHierarchies(options: PresentationDataCompareOptions<IModelRpcProps, NodeKeyJSON>): Promise<PartialHierarchyModificationJSON[]> {
    return this.request<PartialHierarchyModificationJSON[], PresentationDataCompareOptions<IModelRpcProps, NodeKeyJSON>>(
      this.rpcClient.compareHierarchies.bind(this.rpcClient), options); // eslint-disable-line deprecation/deprecation
  }
  public async compareHierarchiesPaged(options: PresentationDataCompareOptions<IModelRpcProps, NodeKeyJSON>): Promise<HierarchyCompareInfoJSON> {
    return this.request<HierarchyCompareInfoJSON, PresentationDataCompareOptions<IModelRpcProps, NodeKeyJSON>>(
      this.rpcClient.compareHierarchiesPaged.bind(this.rpcClient), options);
  }
}
