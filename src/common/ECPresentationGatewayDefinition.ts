/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@build/imodeljs-core/lib/common/Gateway";
import { IModelToken } from "@build/imodeljs-core/lib/common/IModel";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "./Hierarchy";
import * as content from "./content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "./Changes";
import { PageOptions } from "./ECPresentationManager";
import * as ec from "./EC";

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

  public abstract getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>>;
  public abstract getRootNodesCount(token: IModelToken, options: object): Promise<number>;
  public abstract getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>>;
  public abstract getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number>;
  public abstract getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<Array<Readonly<NavNodePathElement>>>;
  public abstract getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<Array<Readonly<NavNodePathElement>>>;
  public abstract getContentDescriptor(token: IModelToken, displayType: string, keys: ec.InstanceKeysList, selection: content.SelectionInfo | undefined, options: object): Promise<Readonly<content.Descriptor>>;
  public abstract getContentSetSize(token: IModelToken, descriptor: content.Descriptor, keys: ec.InstanceKeysList, options: object): Promise<number>;
  public abstract getContent(token: IModelToken, descriptor: content.Descriptor, keys: ec.InstanceKeysList, pageOptions: PageOptions, options: object): Promise<Readonly<content.Content>>;
  public abstract getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]>;
  public abstract saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<Array<Readonly<ECInstanceChangeResult>>>;
}
