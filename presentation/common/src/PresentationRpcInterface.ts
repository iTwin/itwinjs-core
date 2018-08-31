/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Id64 } from "@bentley/bentleyjs-core";
import {
  RpcInterface, IModelToken,
  RpcOperation, RpcRequest,
} from "@bentley/imodeljs-common";
import { NodeKey, Node, NodePathElement } from "./hierarchy";
import { SelectionInfo, Descriptor, Content, Field, Item, PropertiesField, NestedContentField } from "./content";
import { HierarchyRequestOptions, ContentRequestOptions, Paged } from "./IPresentationManager";
import KeySet from "./KeySet";
import { InstanceKey } from "./EC";

export interface RpcRequestOptions {
  clientId?: string;
  clientStateId?: string;
  imodel: IModelToken;
}
export type HierarchyRpcRequestOptions = RpcRequestOptions & HierarchyRequestOptions<IModelToken>;
export type ContentRpcRequestOptions = RpcRequestOptions & ContentRequestOptions<IModelToken>;
export type RulesetVariableRpcRequestOptions = RpcRequestOptions & { rulesetId: string };
export type ClientStateSyncRequestOptions = RpcRequestOptions & { state: { [id: string]: unknown } };

/** Interface used for communication between Presentation backend and frontend. */
export default class PresentationRpcInterface extends RpcInterface {
  // developer note: It's called an interface but actually it's a real implemented
  // frontend-specific class. It's setup that way to keep consistency with imodeljs-core.

  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  /* istanbul ignore next */
  public static types = () => [
    Descriptor,
    Content,
    Field,
    PropertiesField,
    NestedContentField,
    Item,
    Id64,
  ]

  public constructor() {
    super();
    RpcOperation.forEach(PresentationRpcInterface, (op) => {
      // note: `op` may be undefined if the instance is being created not through
      // the RpcRegistry, however this is not coverable because of the way RpcRegistry
      // is implemented...
      // istanbul ignore if
      if (!op)
        return;

      // note: imodel tokens are nested inside the first parameter of each operation
      op.policy.token = (request: RpcRequest) => {
        const requestOptions: RpcRequestOptions = request.parameters[0];
        return requestOptions.imodel;
      };
    });
  }

  /** See [[PresentationManager.getRootNodes]] */
  public getRootNodes(_options: Paged<HierarchyRpcRequestOptions>): Promise<Node[]> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getRootNodesCount]] */
  public getRootNodesCount(_options: HierarchyRpcRequestOptions): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getChildren]] */
  public getChildren(_options: Paged<HierarchyRpcRequestOptions>, _parentKey: Readonly<NodeKey>): Promise<Node[]> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getChildrenCount]] */
  public getChildrenCount(_options: HierarchyRpcRequestOptions, _parentKey: Readonly<NodeKey>): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getNodePaths]] */
  public getNodePaths(_options: HierarchyRpcRequestOptions, _paths: InstanceKey[][], _markedIndex: number): Promise<NodePathElement[]> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getFilteredNodePaths]] */
  public getFilteredNodePaths(_options: HierarchyRpcRequestOptions, _filterText: string): Promise<NodePathElement[]> { return this.forward.apply(this, arguments); }

  /** See [[PresentationManager.getContentDescriptor]] */
  public getContentDescriptor(_options: ContentRpcRequestOptions, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getContentSetSize]] */
  public getContentSetSize(_options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getContent]] */
  public getContent(_options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<Content> { return this.forward.apply(this, arguments); }
  /** See [[PresentationManager.getDistinctValues]] */
  public getDistinctValues(_options: ContentRpcRequestOptions, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _fieldName: string, _maximumValueCount: number): Promise<string[]> { return this.forward.apply(this, arguments); }

  public syncClientState(_options: ClientStateSyncRequestOptions): Promise<void> { return this.forward.apply(this, arguments); }
}
