/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Guid, BeEvent, IDisposable } from "@bentley/bentleyjs-core";
import { IModelToken, RpcManager } from "@bentley/imodeljs-common";
import KeySet from "./KeySet";
import { PresentationStatus } from "./Error";
import { InstanceKey } from "./EC";
import { NodeKey, Node, NodePathElement } from "./hierarchy";
import { SelectionInfo, Descriptor, Content } from "./content";
import { HierarchyRequestOptions, ContentRequestOptions, Paged } from "./IPresentationManager";
import PresentationRpcInterface, { RpcRequestOptions } from "./PresentationRpcInterface";

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

  /**
   * Send request to current backend. If the backend is unknown to the requestor,
   * the request is rejected with `PresentationStatus.UnknownBackend` status. In
   * such case the client is synced with the backend using registered `syncHandlers`
   * and the request is repeated.
   *
   * @hidden
   */
  public async request<TResult, TOptions extends RpcRequestOptions & { imodel: IModelToken }, TArg extends any[]>(
    context: any,
    func: (token: IModelToken, options: TOptions, ...args: TArg) => Promise<TResult>,
    options: TOptions,
    ...args: TArg): Promise<TResult> {

    const { imodel, ...rpcOptions } = options as (RpcRequestOptions & { imodel: IModelToken });
    const doRequest = () => func.apply(context, [imodel, rpcOptions, ...args]);
    try {
      return await doRequest();
    } catch (e) {
      if (e.errorNumber === PresentationStatus.BackendOutOfSync) {
        await this.sync(options.imodel);
        return await doRequest();
      } else {
        // unknown error - rethrow
        throw e;
      }
    }
  }

  public async getRootNodes(options: Paged<HierarchyRequestOptions<IModelToken>>): Promise<Node[]> {
    return await this.request<Node[], Paged<HierarchyRequestOptions<IModelToken>>, any>(
      this.rpcClient, this.rpcClient.getRootNodes, this.createRequestOptions(options));
  }
  public async getRootNodesCount(options: HierarchyRequestOptions<IModelToken>): Promise<number> {
    return await this.request<number, HierarchyRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getRootNodesCount, this.createRequestOptions(options));
  }
  public async getChildren(options: Paged<HierarchyRequestOptions<IModelToken>>, parentKey: Readonly<NodeKey>): Promise<Node[]> {
    return await this.request<Node[], Paged<HierarchyRequestOptions<IModelToken>>, any>(
      this.rpcClient, this.rpcClient.getChildren, this.createRequestOptions(options), parentKey);
  }
  public async getChildrenCount(options: HierarchyRequestOptions<IModelToken>, parentKey: Readonly<NodeKey>): Promise<number> {
    return await this.request<number, HierarchyRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getChildrenCount, this.createRequestOptions(options), parentKey);
  }
  public async getNodePaths(options: HierarchyRequestOptions<IModelToken>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return await this.request<NodePathElement[], HierarchyRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getNodePaths, this.createRequestOptions(options), paths, markedIndex);
  }
  public async getFilteredNodePaths(options: HierarchyRequestOptions<IModelToken>, filterText: string): Promise<NodePathElement[]> {
    return await this.request<NodePathElement[], HierarchyRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getFilteredNodePaths, this.createRequestOptions(options), filterText);
  }

  public async getContentDescriptor(options: ContentRequestOptions<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined> {
    return await this.request<Descriptor | undefined, ContentRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getContentDescriptor, this.createRequestOptions(options), displayType, keys, selection);
  }
  public async getContentSetSize(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return await this.request<number, ContentRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getContentSetSize, this.createRequestOptions(options), descriptor, keys);
  }
  public async getContent(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Content> {
    return await this.request<Content, ContentRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getContent, this.createRequestOptions(options), descriptor, keys);
  }
  public async getDistinctValues(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> {
    return await this.request<string[], ContentRequestOptions<IModelToken>, any>(
      this.rpcClient, this.rpcClient.getDistinctValues, this.createRequestOptions(options), descriptor, keys, fieldName, maximumValueCount);
  }
}
