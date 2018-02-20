/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@build/imodeljs-core/lib/common/Gateway";
import { IModelToken } from "@build/imodeljs-core/lib/common/IModel";
import ECPresentationGatewayDefinition from "../common/ECPresentationGatewayDefinition";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import * as c from "../common/content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions } from "../common/ECPresentationManager";
import { InstanceKeysList } from "../common/EC";

export default class ECPresentationGateway extends ECPresentationGatewayDefinition {
  /** Returns the ECPresentationGateway instance for the frontend. */
  public static getProxy(): ECPresentationGateway {
    return Gateway.getProxyForGateway(ECPresentationGateway);
  }

  public async getRootNodes(_token: IModelToken, _pageOptions: PageOptions, _options: object): Promise<NavNode[]> {
    return this.forward.apply(this, arguments);
  }

  public async getRootNodesCount(_token: IModelToken, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getChildren(_token: IModelToken, _parent: NavNode, _pageOptions: PageOptions, _options: object): Promise<NavNode[]> {
    return this.forward.apply(this, arguments);
  }

  public async getChildrenCount(_token: IModelToken, _parent: NavNode, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getNodePaths(_token: IModelToken, _paths: NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<NavNodePathElement[]> {
    return this.forward.apply(this, arguments);
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<NavNodePathElement[]> {
    return this.forward.apply(this, arguments);
  }

  public async getContentDescriptor(_token: IModelToken, _displayType: string, _keys: InstanceKeysList, _selection: c.SelectionInfo | undefined, _options: object): Promise<c.Descriptor> {
    return await this.forward.apply(this, arguments);
  }

  public async getContentSetSize(_token: IModelToken, _descriptor: c.Descriptor, _keys: InstanceKeysList, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContent(_token: IModelToken, _descriptor: c.Descriptor, _keys: InstanceKeysList, _pageOptions: PageOptions, _options: object): Promise<c.Content> {
    return await this.forward.apply(this, arguments);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    return this.forward.apply(this, arguments);
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> {
    return this.forward.apply(this, arguments);
  }
}
