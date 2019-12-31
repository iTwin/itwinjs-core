/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Id64String } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import {
  PresentationRpcInterface, SelectionInfo,
  Paged, SelectionScope, DescriptorOverrides,
  PresentationRpcResponse, HierarchyRpcRequestOptions,
  ContentRpcRequestOptions, SelectionScopeRpcRequestOptions,
  LabelRpcRequestOptions, ClientStateSyncRequestOptions,
} from "@bentley/presentation-common";
import { NodeJSON } from "@bentley/presentation-common/lib/hierarchy/Node";
import { NodeKeyJSON } from "@bentley/presentation-common/lib/hierarchy/Key";
import { DescriptorJSON } from "@bentley/presentation-common/lib/content/Descriptor";
import { KeySetJSON } from "@bentley/presentation-common/lib/KeySet";
import { InstanceKeyJSON } from "@bentley/presentation-common/lib/EC";
import { NodePathElementJSON } from "@bentley/presentation-common/lib/hierarchy/NodePathElement";
import { ContentJSON } from "@bentley/presentation-common/lib/content/Content";
import { PresentationRpcImplStateless } from "./PresentationRpcImplStateless";
import { PresentationRpcImplStateful } from "./PresentationRpcImplStateful";

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

  private _statelessImpl: PresentationRpcImplStateless;
  private _statefulImpl: PresentationRpcImplStateful;

  public constructor(id?: string) {
    super();
    this._statelessImpl = new PresentationRpcImplStateless(id);
    this._statefulImpl = new PresentationRpcImplStateful(id);
  }

  private pickImpl<TOptions extends { clientStateId?: string }>(options: TOptions) {
    if (options.clientStateId)
      return this._statefulImpl;
    return this._statelessImpl;
  }

  public async getNodesAndCount(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: NodeKeyJSON) {
    return this.pickImpl(requestOptions).getNodesAndCount(token, requestOptions, parentKey);
  }

  public async getNodes(token: IModelToken, requestOptions: Paged<HierarchyRpcRequestOptions>, parentKey?: NodeKeyJSON): PresentationRpcResponse<NodeJSON[]> {
    return this.pickImpl(requestOptions).getNodes(token, requestOptions, parentKey);
  }

  public async getNodesCount(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, parentKey?: NodeKeyJSON): PresentationRpcResponse<number> {
    return this.pickImpl(requestOptions).getNodesCount(token, requestOptions, parentKey);
  }

  public async getNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, paths: InstanceKeyJSON[][], markedIndex: number): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.pickImpl(requestOptions).getNodePaths(token, requestOptions, paths, markedIndex);
  }

  public async getFilteredNodePaths(token: IModelToken, requestOptions: HierarchyRpcRequestOptions, filterText: string): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.pickImpl(requestOptions).getFilteredNodePaths(token, requestOptions, filterText);
  }

  public async loadHierarchy(token: IModelToken, requestOptions: HierarchyRpcRequestOptions): PresentationRpcResponse<void> {
    return this.pickImpl(requestOptions).loadHierarchy(token, requestOptions);
  }

  public async getContentDescriptor(token: IModelToken, requestOptions: ContentRpcRequestOptions, displayType: string, keys: KeySetJSON, selection: SelectionInfo | undefined): PresentationRpcResponse<DescriptorJSON | undefined> {
    return this.pickImpl(requestOptions).getContentDescriptor(token, requestOptions, displayType, keys, selection);
  }

  public async getContentSetSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): PresentationRpcResponse<number> {
    return this.pickImpl(requestOptions).getContentSetSize(token, requestOptions, descriptorOrOverrides, keys);
  }

  public async getContentAndSize(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON) {
    return this.pickImpl(requestOptions).getContentAndSize(token, requestOptions, descriptorOrOverrides, keys);
  }

  public async getContent(token: IModelToken, requestOptions: Paged<ContentRpcRequestOptions>, descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, keys: KeySetJSON): PresentationRpcResponse<ContentJSON | undefined> {
    return this.pickImpl(requestOptions).getContent(token, requestOptions, descriptorOrOverrides, keys);
  }

  public async getDistinctValues(token: IModelToken, requestOptions: ContentRpcRequestOptions, descriptor: DescriptorJSON, keys: KeySetJSON, fieldName: string, maximumValueCount: number): PresentationRpcResponse<string[]> {
    return this.pickImpl(requestOptions).getDistinctValues(token, requestOptions, descriptor, keys, fieldName, maximumValueCount);
  }

  public async getDisplayLabel(token: IModelToken, requestOptions: LabelRpcRequestOptions, key: InstanceKeyJSON): PresentationRpcResponse<string> {
    return this.pickImpl(requestOptions).getDisplayLabel(token, requestOptions, key);
  }

  public async getDisplayLabels(token: IModelToken, requestOptions: LabelRpcRequestOptions, keys: InstanceKeyJSON[]): PresentationRpcResponse<string[]> {
    return this.pickImpl(requestOptions).getDisplayLabels(token, requestOptions, keys);
  }

  public async getSelectionScopes(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.pickImpl(requestOptions).getSelectionScopes(token, requestOptions);
  }

  public async computeSelection(token: IModelToken, requestOptions: SelectionScopeRpcRequestOptions, ids: Id64String[], scopeId: string): PresentationRpcResponse<KeySetJSON> {
    return this.pickImpl(requestOptions).computeSelection(token, requestOptions, ids, scopeId);
  }

  public async syncClientState(token: IModelToken, requestOptions: ClientStateSyncRequestOptions): PresentationRpcResponse {
    return this.pickImpl(requestOptions).syncClientState(token, requestOptions);
  }
}
