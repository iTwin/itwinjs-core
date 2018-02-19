/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGatewayDefinition from "../common/ECPresentationGatewayDefinition";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPresentationManagerDefinition } from "../common/ECPresentationManager";
import { InstanceKeysList } from "../common/EC";

/** The backend implementation of ECPresentationGatewayDefinition. */
export default class ECPresentationGateway extends ECPresentationGatewayDefinition {

  private _manager: ECPresentationManagerDefinition | null = null;

  /** @hidden */
  public getManager(): ECPresentationManagerDefinition {
    if (!this._manager)
      this._manager = new ECPresentationManager();
    return this._manager;
  }

  /** @hidden */
  public setManager(mgr: ECPresentationManagerDefinition | null): void {
    this._manager = mgr;
  }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return await this.getManager().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: IModelToken, options: object): Promise<number> {
    return await this.getManager().getRootNodesCount(token, options);
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    return await this.getManager().getChildren(token, parent, pageOptions, options);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    return await this.getManager().getChildrenCount(token, parent, options);
  }

  public async getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<NavNodePathElement[]> {
    return await this.getManager().getNodePaths(token, paths, markedIndex, options);
  }

  public async getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<NavNodePathElement[]> {
    return await this.getManager().getFilteredNodesPaths(token, filterText, options);
  }

  public async getContentDescriptor(token: IModelToken, displayType: string, keys: InstanceKeysList, selection: SelectionInfo | null, options: object): Promise<Descriptor | null> {
    return await this.getManager().getContentDescriptor(token, displayType, keys, selection, options);
  }

  public async getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, options: object): Promise<number> {
    return await this.getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, pageOptions: PageOptions, options: object): Promise<Content> {
    return await this.getManager().getContent(token, descriptor, keys, pageOptions, options);
  }

  public async getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]> {
    return await this.getManager().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<ECInstanceChangeResult[]> {
    return await this.getManager().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}

/** Auto-register the gateway when this file is included. */
Gateway.registerImplementation(ECPresentationGatewayDefinition, ECPresentationGateway);
