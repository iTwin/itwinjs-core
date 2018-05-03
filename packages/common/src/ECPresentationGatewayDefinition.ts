/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, IModelToken } from "@bentley/imodeljs-common";
import { Node, NodeKey } from "./hierarchy";
import { SelectionInfo, Descriptor, Content, Field, Item, PropertiesField, NestedContentField } from "./content";
import { PageOptions } from "./ECPresentationManager";
import KeySet from "./KeySet";

/** Gateway definition for ECPresentation services.
 * WIP: would like to name it ECPresentationGatewayDefinition, but can't because
 * Gateway's API requires it's name to match the name of the frontend implementation.
 */
export default abstract class ECPresentationGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  /* istanbul ignore next */
  public static types = () => [
    Descriptor,
    Content,
    Field,
    PropertiesField,
    NestedContentField,
    Item,
  ]

  public abstract getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>>;
  public abstract getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number>;
  public abstract getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>>;
  public abstract getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number>;
  public abstract getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor>>;
  public abstract getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number>;
  public abstract getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>>;
}
