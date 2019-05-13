/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Guid, BeEvent, IDisposable, Id64String } from "@bentley/bentleyjs-core";
import { IModelToken, RpcManager } from "@bentley/imodeljs-common";
import KeySet from "./KeySet";
import { PresentationStatus, PresentationError } from "./Error";
import { InstanceKey } from "./EC";
import { NodeKey } from "./hierarchy/Key";
import { default as Node } from "./hierarchy/Node";
import { default as NodePathElement } from "./hierarchy/NodePathElement";
import { SelectionInfo, default as Descriptor, DescriptorOverrides } from "./content/Descriptor";
import { default as Content } from "./content/Content";
import { SelectionScope } from "./selection/SelectionScope";
import { HierarchyRequestOptions, ContentRequestOptions, Paged, SelectionScopeRequestOptions, LabelRequestOptions } from "./PresentationManagerOptions";
import PresentationRpcInterface, { RpcRequestOptions, NodesResponse, ContentResponse, PresentationRpcResponse } from "./PresentationRpcInterface";
import { Omit } from "./Utils";

/**
 * Configuration parameters for [[RpcRequestsHandler]].
 *
 * @hidden
 */
export interface Props {
  /**
   * Optional ID used to identify client that requests data. If not specified,
   * the handler creates a unique GUID as a client id.
   * @hidden
   */
  clientId?: string;
}

/**
 * An interface for something that stores client state that needs
 * to be synced with the backend.
 *
 * @hidden
 */
export interface IClientStateHolder<TState> {
  key: string;
  state: TState | undefined;
  onStateChanged: BeEvent<() => void>;
}

/**
 * RPC requests handler that wraps [[PresentationRpcInterface]] and
 * adds handling for cases when backend needs to be synced with client
 * state.
 *
 * @hidden
 */
export default class RpcRequestsHandler implements IDisposable {

  private _clientStateId?: string;
  private _clientStateHolders: Array<IClientStateHolder<any>>;

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  /** ID that identifies current client state */
  public get clientStateId() { return this._clientStateId; }

  public constructor(props?: Props) {
    this.clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
    this._clientStateHolders = [];
  }

  public dispose() {
    this._clientStateHolders.forEach((h) => h.onStateChanged.removeListener(this.onClientStateChanged));
    this._clientStateHolders = [];
  }

  // tslint:disable-next-line:naming-convention
  private get rpcClient(): PresentationRpcInterface { return RpcManager.getClientForInterface(PresentationRpcInterface); }

  private createRequestOptions<T>(options: T): RpcRequestOptions & T {
    return Object.assign({}, options, {
      clientId: this.clientId,
      clientStateId: this._clientStateId,
    });
  }

  public registerClientStateHolder(holder: IClientStateHolder<any>) {
    this._clientStateHolders.push(holder);
    holder.onStateChanged.addListener(this.onClientStateChanged);
  }

  public unregisterClientStateHolder(holder: IClientStateHolder<any>) {
    const index = this._clientStateHolders.indexOf(holder);
    if (- 1 !== index)
      this._clientStateHolders.splice(index, 1);
    holder.onStateChanged.removeListener(this.onClientStateChanged);
  }

  // tslint:disable-next-line:naming-convention
  private onClientStateChanged = (): void => {
    this._clientStateId = Guid.createValue();
  }

  /**
   * Syncs backend with the client state provided by client state holders
   *
   * @hidden
   */
  public async sync(token: IModelToken): Promise<void> {
    const clientState: { [stateKey: string]: any } = {};
    for (const holder of this._clientStateHolders) {
      const holderState = holder.state;
      const existing = clientState[holder.key];
      if (existing && typeof existing === "object" && typeof holderState === "object") {
        clientState[holder.key] = { ...existing, ...holderState };
      } else {
        clientState[holder.key] = holderState;
      }
    }
    await this.rpcClient.syncClientState(token, this.createRequestOptions({ state: clientState }));
  }

  private async requestRepeatedly<TResult, TOptions extends RpcRequestOptions>(func: (opts: TOptions) => PresentationRpcResponse<TResult>, options: TOptions, imodelToken: IModelToken): Promise<TResult> {
    const response = await func(options);

    if (response.statusCode === PresentationStatus.Success)
      return response.result!;

    if (response.statusCode === PresentationStatus.BackendOutOfSync) {
      options.clientStateId = this._clientStateId;
      await this.sync(imodelToken);
      return this.requestRepeatedly(func, options, imodelToken);
    }

    throw new PresentationError(response.statusCode, response.errorMessage);
  }

  /**
   * Send request to current backend. If the backend is unknown to the requestor,
   * the request is rejected with `PresentationStatus.UnknownBackend` status. In
   * such case the client is synced with the backend using registered `syncHandlers`
   * and the request is repeated.
   *
   * @hidden
   */
  public async request<TResult, TOptions extends RpcRequestOptions & { imodel: IModelToken }, TArg = any>(
    context: any,
    func: (token: IModelToken, options: Omit<TOptions, "imodel">, ...args: TArg[]) => PresentationRpcResponse<TResult>,
    options: TOptions,
    ...args: TArg[]): Promise<TResult> {
    type TFuncOptions = Omit<TOptions, "imodel">;
    const { imodel, ...rpcOptions } = (options as (RpcRequestOptions & { imodel: IModelToken })); // TS2700: Rest types may only be created from object types...
    const doRequest = async (funcOptions: TFuncOptions) => func.apply(context, [imodel, funcOptions, ...args]);
    return this.requestRepeatedly(doRequest, rpcOptions as TFuncOptions, options.imodel);
  }
  public async getNodesAndCount(options: Paged<HierarchyRequestOptions<IModelToken>>, parentKey?: NodeKey): Promise<NodesResponse> {
    return this.request<NodesResponse, Paged<HierarchyRequestOptions<IModelToken>>, any>(
      this.rpcClient, this.rpcClient.getNodesAndCount, this.createRequestOptions(options), parentKey);
  }
  public async getNodes(options: Paged<HierarchyRequestOptions<IModelToken>>, parentKey?: NodeKey): Promise<Node[]> {
    return this.request<Node[], Paged<HierarchyRequestOptions<IModelToken>>>(
      this.rpcClient, this.rpcClient.getNodes, this.createRequestOptions(options), parentKey);
  }
  public async getNodesCount(options: HierarchyRequestOptions<IModelToken>, parentKey?: NodeKey): Promise<number> {
    return this.request<number, HierarchyRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getNodesCount, this.createRequestOptions(options), parentKey);
  }
  public async getNodePaths(options: HierarchyRequestOptions<IModelToken>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return this.request<NodePathElement[], HierarchyRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getNodePaths, this.createRequestOptions(options), paths, markedIndex);
  }
  public async getFilteredNodePaths(options: HierarchyRequestOptions<IModelToken>, filterText: string): Promise<NodePathElement[]> {
    return this.request<NodePathElement[], HierarchyRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getFilteredNodePaths, this.createRequestOptions(options), filterText);
  }

  public async getContentDescriptor(options: ContentRequestOptions<IModelToken>, displayType: string, keys: KeySet, selection: SelectionInfo | undefined): Promise<Descriptor | undefined> {
    return this.request<Descriptor | undefined, ContentRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getContentDescriptor, this.createRequestOptions(options), displayType, keys, selection);
  }
  public async getContentSetSize(options: ContentRequestOptions<IModelToken>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<number> {
    return this.request<number, ContentRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getContentSetSize, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getContent(options: ContentRequestOptions<IModelToken>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<Content | undefined> {
    return this.request<Content | undefined, ContentRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getContent, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getContentAndSize(options: ContentRequestOptions<IModelToken>, descriptorOrOverrides: Descriptor | DescriptorOverrides, keys: KeySet): Promise<ContentResponse> {
    return this.request<ContentResponse, ContentRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getContentAndSize, this.createRequestOptions(options), descriptorOrOverrides, keys);
  }
  public async getDistinctValues(options: ContentRequestOptions<IModelToken>, descriptor: Descriptor, keys: KeySet, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return this.request<string[], ContentRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getDistinctValues, this.createRequestOptions(options), descriptor, keys, fieldName, maximumValueCount);
  }

  public async getDisplayLabel(options: LabelRequestOptions<IModelToken>, key: InstanceKey): Promise<string> {
    return this.request<string, LabelRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getDisplayLabel, this.createRequestOptions(options), key);
  }
  public async getDisplayLabels(options: LabelRequestOptions<IModelToken>, keys: InstanceKey[]): Promise<string[]> {
    return this.request<string[], LabelRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getDisplayLabels, this.createRequestOptions(options), keys);
  }

  public async getSelectionScopes(options: SelectionScopeRequestOptions<IModelToken>): Promise<SelectionScope[]> {
    return this.request<SelectionScope[], SelectionScopeRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.getSelectionScopes, this.createRequestOptions(options));
  }
  public async computeSelection(options: SelectionScopeRequestOptions<IModelToken>, ids: Id64String[], scopeId: string): Promise<KeySet> {
    return this.request<KeySet, SelectionScopeRequestOptions<IModelToken>>(
      this.rpcClient, this.rpcClient.computeSelection, this.createRequestOptions(options), ids, scopeId);
  }
}
