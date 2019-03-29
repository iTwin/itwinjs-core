/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Id64String } from "@bentley/bentleyjs-core";
import { RpcInterface, IModelToken } from "@bentley/imodeljs-common";
import { NodeKey } from "./hierarchy/Key";
import { default as NodePathElement } from "./hierarchy/NodePathElement";
import { default as Node } from "./hierarchy/Node";
import { SelectionInfo, default as Descriptor, DescriptorOverrides } from "./content/Descriptor";
import { default as Content } from "./content/Content";
import { Field, PropertiesField, NestedContentField } from "./content/Fields";
import { default as Item } from "./content/Item";
import {
  HierarchyRequestOptions, ContentRequestOptions,
  LabelRequestOptions, SelectionScopeRequestOptions, Paged,
} from "./PresentationManagerOptions";
import KeySet from "./KeySet";
import { InstanceKey } from "./EC";
import { Omit } from "./Utils";
import { SelectionScope } from "./selection/SelectionScope";
import { PresentationStatus } from "./Error";

export interface RpcRequestOptions {
  clientId?: string;
  clientStateId?: string;
}

export interface RpcResponse<TResult = undefined> {
  statusCode: PresentationStatus;
  errorMessage?: string;
  result: TResult;
}

export type PresentationRpcResponse<P = undefined> = Promise<RpcResponse<P> | RpcResponse<undefined>>;

export type HierarchyRpcRequestOptions = RpcRequestOptions & Omit<HierarchyRequestOptions<IModelToken>, "imodel">;
export type ContentRpcRequestOptions = RpcRequestOptions & Omit<ContentRequestOptions<IModelToken>, "imodel">;
export type LabelRpcRequestOptions = RpcRequestOptions & Omit<LabelRequestOptions<IModelToken>, "imodel">;
export type SelectionScopeRpcRequestOptions = RpcRequestOptions & Omit<SelectionScopeRequestOptions<IModelToken>, "imodel">;
export type RulesetVariableRpcRequestOptions = RpcRequestOptions & { rulesetId: string };
export type ClientStateSyncRequestOptions = RpcRequestOptions & { state: { [id: string]: unknown } };

/** Interface used for receiving nodes and nodes count */
export interface NodesResponse {
  nodes: ReadonlyArray<Node>;
  count: number;
}

/** Interface used for receiving content and content set size */
export interface ContentResponse {
  size: number;
  content: Readonly<Content> | undefined;
}

/** Interface used for communication between Presentation backend and frontend. */
export default class PresentationRpcInterface extends RpcInterface {
  // developer note: It's called an interface but actually it's a real implemented
  // frontend-specific class. It's setup that way to keep consistency with imodeljs-core.

  /** The types that can be marshaled by the interface. */
  /* istanbul ignore next */
  public static types = () => [
    Descriptor,
    Content,
    Field,
    PropertiesField,
    NestedContentField,
    Item,
  ]

  /** The semantic version of the interface. */
  public static version = "0.3.1";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  public async getNodesAndCount(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: Readonly<NodeKey>): PresentationRpcResponse<NodesResponse> { return this.forward(arguments); }
  public async getNodes(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: Readonly<NodeKey>): PresentationRpcResponse<Node[]> { return this.forward(arguments); }
  public async getNodesCount(_token: IModelToken, _options: HierarchyRpcRequestOptions, _parentKey?: Readonly<NodeKey>): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _paths: InstanceKey[][], _markedIndex: number): PresentationRpcResponse<NodePathElement[]> { return this.forward(arguments); }
  public async getFilteredNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _filterText: string): PresentationRpcResponse<NodePathElement[]> { return this.forward(arguments); }

  public async getContentDescriptor(_token: IModelToken, _options: ContentRpcRequestOptions, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined): PresentationRpcResponse<Descriptor | undefined> { return this.forward(arguments); }
  public async getContentSetSize(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, _keys: Readonly<KeySet>): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getContent(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, _keys: Readonly<KeySet>): PresentationRpcResponse<Content | undefined> { return this.forward(arguments); }
  public async getContentAndSize(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptorOrOverrides: Readonly<Descriptor> | DescriptorOverrides, _keys: Readonly<KeySet>): PresentationRpcResponse<ContentResponse> { return this.forward(arguments); }
  public async getDistinctValues(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _fieldName: string, _maximumValueCount: number): PresentationRpcResponse<string[]> { return this.forward(arguments); }

  public async getDisplayLabel(_token: IModelToken, _options: LabelRpcRequestOptions, _key: InstanceKey): PresentationRpcResponse<string> { return this.forward(arguments); }
  public async getDisplayLabels(_token: IModelToken, _options: LabelRpcRequestOptions, _keys: InstanceKey[]): PresentationRpcResponse<string[]> { return this.forward(arguments); }

  public async getSelectionScopes(_token: IModelToken, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> { return this.forward(arguments); }
  public async computeSelection(_token: IModelToken, _options: SelectionScopeRpcRequestOptions, _ids: Readonly<Id64String[]>, _scopeId: string): PresentationRpcResponse<KeySet> { return this.forward(arguments); }

  public async syncClientState(_token: IModelToken, _options: ClientStateSyncRequestOptions): PresentationRpcResponse { return this.forward(arguments); }
}
