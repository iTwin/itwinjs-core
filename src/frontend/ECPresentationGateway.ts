/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken, Gateway } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "@bentley/ecpresentation-common";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";

export default class ECPresentationGateway extends ECPresentationGatewayDefinition {
  /** Returns the ECPresentationGateway instance for the frontend. */
  public static getProxy(): ECPresentationGateway {
    return Gateway.getProxyForGateway(ECPresentationGateway);
  }

  public async getRootNodes(_token: Readonly<IModelToken>, _pageOptions: Readonly<PageOptions>, _options: object): Promise<ReadonlyArray<Readonly<NavNode>>> {
    return this.forward.apply(this, arguments);
  }

  public async getRootNodesCount(_token: Readonly<IModelToken>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getChildren(_token: Readonly<IModelToken>, _parent: Readonly<NavNode>, _pageOptions: Readonly<PageOptions>, _options: object): Promise<ReadonlyArray<Readonly<NavNode>>> {
    return this.forward.apply(this, arguments);
  }

  public async getChildrenCount(_token: Readonly<IModelToken>, _parent: Readonly<NavNode>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getNodePaths(_token: Readonly<IModelToken>, _paths: ReadonlyArray<Readonly<NavNodeKeyPath>>, _markedIndex: number, _options: object): Promise<ReadonlyArray<Readonly<NavNodePathElement>>> {
    return this.forward.apply(this, arguments);
  }

  public async getFilteredNodesPaths(_token: Readonly<IModelToken>, _filterText: string, _options: object): Promise<ReadonlyArray<Readonly<NavNodePathElement>>> {
    return this.forward.apply(this, arguments);
  }

  public async getContentDescriptor(_token: Readonly<IModelToken>, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined, _options: object): Promise<Readonly<Descriptor>> {
    return await this.forward.apply(this, arguments);
  }

  public async getContentSetSize(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContent(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _pageOptions: Readonly<PageOptions>, _options: object): Promise<Readonly<Content>> {
    return await this.forward.apply(this, arguments);
  }

  public async getDistinctValues(_token: Readonly<IModelToken>, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<ReadonlyArray<string>> {
    return this.forward.apply(this, arguments);
  }

  public async saveValueChange(_token: Readonly<IModelToken>, _instancesInfo: ReadonlyArray<Readonly<ChangedECInstanceInfo>>, _propertyAccessor: string, _value: any, _options: object): Promise<ReadonlyArray<Readonly<ECInstanceChangeResult>>> {
    return this.forward.apply(this, arguments);
  }
}
