/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { RpcInterface, IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { Node, NodeKey } from "./hierarchy";
import { SelectionInfo, Descriptor, Content, Field, Item, PropertiesField, NestedContentField } from "./content";
import { PageOptions } from "./ECPresentationManager";
import KeySet from "./KeySet";

/** Interface used for communication between ECPresentation backend and frontend. */
export default class ECPresentationRpcInterface extends RpcInterface {
  // developer note: It's called an interface but actually it's a real implemented
  // frontend-specific class.It's setup that way to keep consistency with imodeljs-core.

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
  ]

  /** Get the frontend client of this interface */
  public static getClient(): ECPresentationRpcInterface { return RpcManager.getClientForInterface(ECPresentationRpcInterface); }

  /** Change active locale used by the backend */
  public setActiveLocale(_locale: string | undefined): Promise<void> { return this.forward.apply(this, arguments); }

  /** See [[ECPresentationManager.getRootNodes]] */
  public getRootNodes(_token: Readonly<IModelToken>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getRootNodesCount]] */
  public getRootNodesCount(_token: Readonly<IModelToken>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getChildren]] */
  public getChildren(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getChildrenCount]] */
  public getChildrenCount(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }

  /** See [[ECPresentationManager.getContentDescriptor]] */
  public getContentDescriptor(_token: Readonly<IModelToken>, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined, _options: object): Promise<Readonly<Descriptor> | undefined> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getContentSetSize]] */
  public getContentSetSize(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getContent]] */
  public getContent(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<Readonly<Content>> { return this.forward.apply(this, arguments); }
}
