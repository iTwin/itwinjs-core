/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import ECPresentationGateway from "../gateway/ECPresentationGateway";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

class ECPresentationManager implements ECPInterface {
  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    token;
    pageOptions;
    options;
    return [];
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    return ECPresentationGateway.getProxy().getRootNodesCount(token);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    token;
    parent;
    pageOptions;
    options;
    return [];
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    token;
    parent;
    options;
    return 0;
  }

  public async getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<NavNodePathElement[]> {
    token;
    paths;
    markedIndex;
    options;
    return [];
  }

  public async getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<NavNodePathElement[]> {
    token;
    filterText;
    options;
    return [];
  }

  public async getDescriptor(token: IModelToken, displayType: string, selection: SelectionInfo, options: object): Promise<Descriptor | null> {
    token;
    displayType;
    selection;
    options;
    return null;
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, selection: SelectionInfo, options: object): Promise<number> {
    token;
    descriptor;
    selection;
    options;
    return 0;
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, selection: SelectionInfo, pageOptions: PageOptions, options: object): Promise<Content | null> {
    token;
    descriptor;
    selection;
    pageOptions;
    options;
    return null;
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    token;
    displayType;
    fieldName;
    maximumValueCount;
    options;
    return [];
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]> {
    token;
    instancesInfo;
    propertyAccessor;
    value;
    options;
    return [];
  }
}

export default ECPresentationManager;
