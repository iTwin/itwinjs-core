/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
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

  public static getClient(): ECPresentationRpcInterface { return RpcManager.getClientForInterface(ECPresentationRpcInterface); }

  public getRootNodes(_token: Readonly<IModelToken>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  public getRootNodesCount(_token: Readonly<IModelToken>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }
  public getChildren(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  public getChildrenCount(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }
  public getContentDescriptor(_token: Readonly<IModelToken>, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined, _options: object): Promise<Readonly<Descriptor>> { return this.forward.apply(this, arguments); }
  public getContentSetSize(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _options: object): Promise<number> { return this.forward.apply(this, arguments); }
  public getContent(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<Readonly<Content>> { return this.forward.apply(this, arguments); }
}
