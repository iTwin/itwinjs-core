/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { RpcInterface, IModelToken, EntityProps } from "@bentley/imodeljs-common";
import { NodeKey } from "./hierarchy/Key";
import { default as NodePathElement } from "./hierarchy/NodePathElement";
import { default as Node } from "./hierarchy/Node";
import { SelectionInfo, default as Descriptor } from "./content/Descriptor";
import { default as Content } from "./content/Content";
import { Field, PropertiesField, NestedContentField } from "./content/Fields";
import { default as Item } from "./content/Item";
import { HierarchyRequestOptions, ContentRequestOptions, SelectionScopeRequestOptions, Paged } from "./PresentationManagerOptions";
import KeySet from "./KeySet";
import { InstanceKey } from "./EC";
import { Omit } from "./Utils";
import { SelectionScope } from "./selection/SelectionScope";

export interface RpcRequestOptions {
  clientId?: string;
  clientStateId?: string;
}
export type HierarchyRpcRequestOptions = RpcRequestOptions & Omit<HierarchyRequestOptions<IModelToken>, "imodel">;
export type ContentRpcRequestOptions = RpcRequestOptions & Omit<ContentRequestOptions<IModelToken>, "imodel">;
export type SelectionScopeRpcRequestOptions = RpcRequestOptions & Omit<SelectionScopeRequestOptions<IModelToken>, "imodel">;
export type RulesetVariableRpcRequestOptions = RpcRequestOptions & { rulesetId: string };
export type ClientStateSyncRequestOptions = RpcRequestOptions & { state: { [id: string]: unknown } };

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
  public static version = "1.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  /** See [[PresentationManager.getRootNodes]] */
  public async getRootNodes(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>): Promise<Node[]> { return this.forward(arguments); }
  /** See [[PresentationManager.getRootNodesCount]] */
  public async getRootNodesCount(_token: IModelToken, _options: HierarchyRpcRequestOptions): Promise<number> { return this.forward(arguments); }
  /** See [[PresentationManager.getChildren]] */
  public async getChildren(_token: IModelToken, _options: Paged<HierarchyRpcRequestOptions>, _parentKey: Readonly<NodeKey>): Promise<Node[]> { return this.forward(arguments); }
  /** See [[PresentationManager.getChildrenCount]] */
  public async getChildrenCount(_token: IModelToken, _options: HierarchyRpcRequestOptions, _parentKey: Readonly<NodeKey>): Promise<number> { return this.forward(arguments); }
  /** See [[PresentationManager.getNodePaths]] */
  public async getNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _paths: InstanceKey[][], _markedIndex: number): Promise<NodePathElement[]> { return this.forward(arguments); }
  /** See [[PresentationManager.getFilteredNodePaths]] */
  public async getFilteredNodePaths(_token: IModelToken, _options: HierarchyRpcRequestOptions, _filterText: string): Promise<NodePathElement[]> { return this.forward(arguments); }

  /** See [[PresentationManager.getContentDescriptor]] */
  public async getContentDescriptor(_token: IModelToken, _options: ContentRpcRequestOptions, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined> { return this.forward(arguments); }
  /** See [[PresentationManager.getContentSetSize]] */
  public async getContentSetSize(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<number> { return this.forward(arguments); }
  /** See [[PresentationManager.getContent]] */
  public async getContent(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<Content> { return this.forward(arguments); }
  /** See [[PresentationManager.getDistinctValues]] */
  public async getDistinctValues(_token: IModelToken, _options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _fieldName: string, _maximumValueCount: number): Promise<string[]> { return this.forward(arguments); }

  public async getSelectionScopes(_token: IModelToken, _options: SelectionScopeRpcRequestOptions): Promise<SelectionScope[]> { return this.forward(arguments); }
  public async computeSelection(_token: IModelToken, _options: SelectionScopeRpcRequestOptions, _keys: Readonly<EntityProps[]>, _scopeId: string): Promise<KeySet> { return this.forward(arguments); }

  public async syncClientState(_token: IModelToken, _options: ClientStateSyncRequestOptions): Promise<void> { return this.forward(arguments); }
}
