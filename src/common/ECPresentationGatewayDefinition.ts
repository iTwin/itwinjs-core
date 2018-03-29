/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-common";
import { IModelToken } from "@bentley/imodeljs-common";
import { Node, NodeKey, NodeKeyPath, NodePathElement } from "./Hierarchy";
import * as content from "./content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "./Changes";
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
  public static types = () => [
    IModelToken,
  ]

  public abstract getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>>;
  public abstract getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number>;
  public abstract getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>>;
  public abstract getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number>;
  public abstract getNodePaths(token: Readonly<IModelToken>, paths: ReadonlyArray<Readonly<NodeKeyPath>>, markedIndex: number, options: object): Promise<ReadonlyArray<Readonly<NodePathElement>>>;
  public abstract getFilteredNodesPaths(token: Readonly<IModelToken>, filterText: string, options: object): Promise<ReadonlyArray<Readonly<NodePathElement>>>;
  public abstract getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<content.SelectionInfo> | undefined, options: object): Promise<Readonly<content.Descriptor>>;
  public abstract getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<content.Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number>;
  public abstract getContent(token: Readonly<IModelToken>, descriptor: Readonly<content.Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<content.Content>>;
  public abstract getDistinctValues(token: Readonly<IModelToken>, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<ReadonlyArray<string>>;
  public abstract saveValueChange(token: Readonly<IModelToken>, instancesInfo: ReadonlyArray<Readonly<ChangedECInstanceInfo>>, propertyAccessor: string, value: any, options: object): Promise<ReadonlyArray<Readonly<ECInstanceChangeResult>>>;
}
