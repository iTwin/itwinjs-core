/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@build/imodeljs-core/lib/common/Gateway";
import { IModelToken } from "@build/imodeljs-core/lib/common/IModel";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import { ECInstanceKeysList } from "../common/EC";

export default class ECPresentationGateway extends Gateway implements ECPInterface {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    IModelToken,
  ]

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

  public async getDescriptor(_token: IModelToken, _displayType: string, _keys: ECInstanceKeysList, _selection: SelectionInfo | null, _options: object): Promise<Descriptor | null> {
    return this.forward.apply(this, arguments);
  }

  public async getContentSetSize(_token: IModelToken, _descriptor: Descriptor, _keys: ECInstanceKeysList, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContent(_token: IModelToken, _descriptor: Descriptor, _keys: ECInstanceKeysList, _pageOptions: PageOptions, _options: object): Promise<Content | null> {
    return this.forward.apply(this, arguments);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    return this.forward.apply(this, arguments);
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> {
    return this.forward.apply(this, arguments);
  }
}
