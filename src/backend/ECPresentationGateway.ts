/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition, ECPresentationManager as ECPresentationManagerDefinition } from "@bentley/ecpresentation-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "@bentley/ecpresentation-common";
import { resetParentship } from "@bentley/ecpresentation-common/lib/content/Descriptor";
import ECPresentation from "./ECPresentation";

/** The backend implementation of ECPresentationGatewayDefinition. */
export default class ECPresentationGateway extends ECPresentationGatewayDefinition {

  public getManager(): ECPresentationManagerDefinition {
    return ECPresentation.manager;
  }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>> {
    return await this.getManager().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    return await this.getManager().getRootNodesCount(token, options);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>> {
    return await this.getManager().getChildren(token, parent, pageOptions, options);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    return await this.getManager().getChildrenCount(token, parent, options);
  }

  public async getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<Array<Readonly<NavNodePathElement>>> {
    return await this.getManager().getNodePaths(token, paths, markedIndex, options);
  }

  public async getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<Array<Readonly<NavNodePathElement>>> {
    return await this.getManager().getFilteredNodesPaths(token, filterText, options);
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: KeySet, selection: SelectionInfo | undefined, options: object): Promise<Readonly<Descriptor>> {
    const descriptor = await this.getManager().getContentDescriptor(token, displayType, keys, selection, options);
    if (descriptor)
      resetParentship(descriptor);
    return descriptor;
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: KeySet, options: object): Promise<number> {
    return await this.getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, keys: KeySet, pageOptions: PageOptions, options: object): Promise<Readonly<Content>> {
    const content: Content = await this.getManager().getContent(token, descriptor, keys, pageOptions, options);
    resetParentship(content.descriptor);
    return content;
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    return await this.getManager().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<Array<Readonly<ECInstanceChangeResult>>> {
    return await this.getManager().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}
