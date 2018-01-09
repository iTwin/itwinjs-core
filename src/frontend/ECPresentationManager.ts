/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { InstanceKeysList } from "../common/EC";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import ECPresentationGateway from "./ECPresentationGateway";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";

class ECPresentationManager implements ECPInterface {
  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return ECPresentationGateway.getProxy().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    return ECPresentationGateway.getProxy().getRootNodesCount(token, options);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return ECPresentationGateway.getProxy().getChildren(token, parent, pageOptions, options);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    return ECPresentationGateway.getProxy().getChildrenCount(token, parent, options);
  }

  public async getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<NavNodePathElement[]> {
    return ECPresentationGateway.getProxy().getNodePaths(token, paths, markedIndex, options);
  }

  public async getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<NavNodePathElement[]> {
    return ECPresentationGateway.getProxy().getFilteredNodesPaths(token, filterText, options);
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: InstanceKeysList, selection: SelectionInfo | null, options: object): Promise<Descriptor | null> {
    return ECPresentationGateway.getProxy().getContentDescriptor(token, displayType, keys, selection, options);
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, options: object): Promise<number> {
    return ECPresentationGateway.getProxy().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, pageOptions: PageOptions, options: object): Promise<Content> {
    return ECPresentationGateway.getProxy().getContent(token, descriptor, keys, pageOptions, options);
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    return ECPresentationGateway.getProxy().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]> {
    return ECPresentationGateway.getProxy().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}

export default ECPresentationManager;
