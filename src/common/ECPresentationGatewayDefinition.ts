/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@build/imodeljs-core/lib/common/Gateway";
import { IModelToken } from "@build/imodeljs-core/lib/common/IModel";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import * as content from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import { ECInstanceKeysList } from "../common/EC";

/** Gateway definition for ECPresentation services. 
 * WIP: would like to name it ECPresentationGatewayDefinition, but can't because
 * Gateway's API requires it's name to match the name of the frontend implementation.
 */
export default abstract class ECPresentationGateway extends Gateway implements ECPInterface {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    IModelToken,
    content.CategoryDescription,
    content.SelectClassInfo,
    content.TypeDescription,
    content.PrimitiveTypeDescription,
    content.ArrayTypeDescription,
    content.StructTypeDescription,
    content.EditorDescription,
    content.Property,
    content.Field,
    content.PropertiesField,
    content.NestedContentField,
    content.SelectionInfo,
    content.Descriptor,
    content.PropertyValueKeys,
    content.ContentSetItem,
    content.Content,
  ]

  public abstract getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]>;
  public abstract getRootNodesCount(token: IModelToken, options: object): Promise<number>;
  public abstract getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]>;
  public abstract getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number>;
  public abstract getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<NavNodePathElement[]>;
  public abstract getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<NavNodePathElement[]>;
  public abstract getContentDescriptor(token: IModelToken, displayType: string, keys: ECInstanceKeysList, selection: content.SelectionInfo | null, options: object): Promise<content.Descriptor | null>;
  public abstract getContentSetSize(token: IModelToken, descriptor: content.Descriptor, keys: ECInstanceKeysList, options: object): Promise<number>;
  public abstract getContent(token: IModelToken, descriptor: content.Descriptor, keys: ECInstanceKeysList, pageOptions: PageOptions, options: object): Promise<content.Content>;
  public abstract getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]>;
  public abstract saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]>;
}
