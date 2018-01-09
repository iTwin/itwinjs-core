/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGatewayDefinition from "../common/ECPresentationGatewayDefinition";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPresentationManagerDefinition } from "../common/ECPresentationManager";
import { InstanceKeysList } from "../common/EC";

/** Gateway uses singleton presentation manager instance. */
let manager: ECPresentationManagerDefinition | null = null;
const getManager = (): ECPresentationManagerDefinition => {
  if (!manager)
    manager = new ECPresentationManager();
  return manager;
};

/** The backend implementation of ECPresentationGatewayDefinition. */
export default class ECPresentationGateway extends ECPresentationGatewayDefinition {

  /** @hidden */
  public static set manager(value: ECPresentationManagerDefinition) { manager = value; }
  /** @hidden */
  public static get manager(): ECPresentationManagerDefinition { return getManager(); }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return await getManager().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    return await getManager().getRootNodesCount(token, options);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return await getManager().getChildren(token, parent, pageOptions, options);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    return await getManager().getChildrenCount(token, parent, options);
  }

  public async getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<NavNodePathElement[]> {
    return await getManager().getNodePaths(token, paths, markedIndex, options);
  }

  public async getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<NavNodePathElement[]> {
    return await getManager().getFilteredNodesPaths(token, filterText, options);
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: InstanceKeysList, selection: SelectionInfo | null, options: object): Promise<Descriptor | null> {
    return await getManager().getContentDescriptor(token, displayType, keys, selection, options);
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, options: object): Promise<number> {
    return await getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, pageOptions: PageOptions, options: object): Promise<Content> {
    return await getManager().getContent(token, descriptor, keys, pageOptions, options);
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    return await getManager().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]> {
    return await getManager().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}

/** Auto-register the gateway when this file is included. */
Gateway.registerImplementation(ECPresentationGatewayDefinition, ECPresentationGateway);
