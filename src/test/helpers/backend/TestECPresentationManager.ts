/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { PageOptions, ECPresentationManager as ECPresentationManagerDefinition } from "@bentley/ecpresentation-backend/lib/common/ECPresentationManager";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "@bentley/ecpresentation-backend/lib/common/Changes";
import * as h from "@bentley/ecpresentation-backend/lib/common/Hierarchy";
import * as c from "@bentley/ecpresentation-backend/lib/common/Content";
import * as ec from "@bentley/ecpresentation-backend/lib/common/EC";

export default class TestECPresentationManager implements ECPresentationManagerDefinition {
  public getRootNodes = (_token: IModelToken, _pageOptions: PageOptions, _options: object): Promise<h.NavNode[]> => { throw new Error("Not implemented"); };
  public getRootNodesCount = (_token: IModelToken, _options: object): Promise<number> => { throw new Error("Not implemented"); };
  public getChildren = (_token: IModelToken, _parent: h.NavNode, _pageOptions: PageOptions, _options: object): Promise<h.NavNode[]> => { throw new Error("Not implemented"); };
  public getChildrenCount = (_token: IModelToken, _parent: h.NavNode, _options: object): Promise<number> => { throw new Error("Not implemented"); };
  public getNodePaths = (_token: IModelToken, _paths: h.NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<h.NavNodePathElement[]> => { throw new Error("Not implemented"); };
  public getFilteredNodesPaths = (_token: IModelToken, _filterText: string, _options: object): Promise<h.NavNodePathElement[]> => { throw new Error("Not implemented"); };
  public getContentDescriptor = (_token: IModelToken, _displayType: string, _keys: ec.InstanceKeysList, _selection: c.SelectionInfo | null, _options: object): Promise<c.Descriptor | null> => { throw new Error("Not implemented"); };
  public getContentSetSize = (_token: IModelToken, _descriptor: c.Descriptor, _keys: ec.InstanceKeysList, _options: object): Promise<number> => { throw new Error("Not implemented"); };
  public getContent = (_token: IModelToken, _descriptor: c.Descriptor, _keys: ec.InstanceKeysList, _pageOptions: PageOptions, _options: object): Promise<c.Content> => { throw new Error("Not implemented"); };
  public getDistinctValues = (_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> => { throw new Error("Not implemented"); };
  public saveValueChange = (_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> => { throw new Error("Not implemented"); };
}
