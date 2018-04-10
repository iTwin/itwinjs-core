/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken, Gateway } from "@bentley/imodeljs-common";
import { InstanceKeysList, PageOptions } from "@bentley/ecpresentation-common";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "@bentley/ecpresentation-common";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";

export default class ECPresentationGateway extends ECPresentationGatewayDefinition {
  /** Returns the ECPresentationGateway instance for the frontend. */
  public static getProxy(): ECPresentationGateway {
    return Gateway.getProxyForGateway(ECPresentationGateway);
  }

  public async getRootNodes(_token: IModelToken, _pageOptions: PageOptions, _options: object): Promise<Array<Readonly<NavNode>>> {
    return this.forward.apply(this, arguments);
  }

  public async getRootNodesCount(_token: IModelToken, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getChildren(_token: IModelToken, _parent: NavNode, _pageOptions: PageOptions, _options: object): Promise<Array<Readonly<NavNode>>> {
    return this.forward.apply(this, arguments);
  }

  public async getChildrenCount(_token: IModelToken, _parent: NavNode, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getNodePaths(_token: IModelToken, _paths: NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<Array<Readonly<NavNodePathElement>>> {
    return this.forward.apply(this, arguments);
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<Array<Readonly<NavNodePathElement>>> {
    return this.forward.apply(this, arguments);
  }

  public async getContentDescriptor(_token: IModelToken, _displayType: string, _keys: InstanceKeysList, _selection: SelectionInfo | undefined, _options: object): Promise<Readonly<Descriptor>> {
    return await this.forward.apply(this, arguments);
  }

  public async getContentSetSize(_token: IModelToken, _descriptor: Descriptor, _keys: InstanceKeysList, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContent(_token: IModelToken, _descriptor: Descriptor, _keys: InstanceKeysList, _pageOptions: PageOptions, _options: object): Promise<Readonly<Content>> {
    return await this.forward.apply(this, arguments);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    return this.forward.apply(this, arguments);
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<Array<Readonly<ECInstanceChangeResult>>> {
    return this.forward.apply(this, arguments);
  }
}
