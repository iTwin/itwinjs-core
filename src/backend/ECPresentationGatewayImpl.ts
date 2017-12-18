/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGateway from "../gateway/ECPresentationGateway";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions } from "../common/ECPresentationManager";
import { ECInstanceKeysList } from "../common/EC";

let manager: ECPresentationManager | null = null;
const getManager = (): ECPresentationManager => {
  if (!manager)
    manager = new ECPresentationManager();
  return manager;
};

/** The backend implementation of ECPresentationGateway.
 * @hidden
 */
export default class ECPresentationGatewayImpl extends ECPresentationGateway {
  public static register() {
    Gateway.registerImplementation(ECPresentationGateway, ECPresentationGatewayImpl);
  }

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

  public async getDescriptor(token: IModelToken, displayType: string, keys: ECInstanceKeysList, selection: SelectionInfo | null, options: object): Promise<Descriptor | null> {
    return await getManager().getDescriptor(token, displayType, keys, selection, options);
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: ECInstanceKeysList, options: object): Promise<number> {
    return await getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, keys: ECInstanceKeysList, pageOptions: PageOptions, options: object): Promise<Content | null> {
    return await getManager().getContent(token, descriptor, keys, pageOptions, options);
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    return await getManager().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]> {
    return await getManager().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}
