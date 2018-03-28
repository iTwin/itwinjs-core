/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "@bentley/ecpresentation-common";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationManager as ECPInterface } from "@bentley/ecpresentation-common";
import { rebuildParentship } from "@bentley/ecpresentation-common/lib/content/Descriptor";
import ECPresentationGateway from "./ECPresentationGateway";

export default class ECPresentationManager implements ECPInterface {
  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions>, options: object): Promise<ReadonlyArray<Readonly<NavNode>>> {
    return await ECPresentationGateway.getProxy().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    return await ECPresentationGateway.getProxy().getRootNodesCount(token, options);
  }

  public async getChildren(token: Readonly<IModelToken>, parent: Readonly<NavNode>, pageOptions: Readonly<PageOptions>, options: object): Promise<ReadonlyArray<Readonly<NavNode>>> {
    return await ECPresentationGateway.getProxy().getChildren(token, parent, pageOptions, options);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parent: Readonly<NavNode>, options: object): Promise<number> {
    return await ECPresentationGateway.getProxy().getChildrenCount(token, parent, options);
  }

  public async getNodePaths(token: Readonly<IModelToken>, paths: ReadonlyArray<Readonly<NavNodeKeyPath>>, markedIndex: number, options: object): Promise<ReadonlyArray<Readonly<NavNodePathElement>>> {
    return await ECPresentationGateway.getProxy().getNodePaths(token, paths, markedIndex, options);
  }

  public async getFilteredNodesPaths(token: Readonly<IModelToken>, filterText: string, options: object): Promise<ReadonlyArray<Readonly<NavNodePathElement>>> {
    return await ECPresentationGateway.getProxy().getFilteredNodesPaths(token, filterText, options);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor>> {
    const descriptor = await ECPresentationGateway.getProxy().getContentDescriptor(token, displayType, keys, selection, options);
    if (descriptor)
      rebuildParentship(descriptor);
    return descriptor;
  }

  private getStrippedDescriptor(descriptor: Readonly<Descriptor>): Descriptor {
    // strips unnecessary data from the descriptor so it's less heavy for transportation
    // over the gateway
    return { ...descriptor, fields: [], selectClasses: [] };
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    return await ECPresentationGateway.getProxy().getContentSetSize(token, this.getStrippedDescriptor(descriptor), keys, options);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions>, options: object): Promise<Readonly<Content>> {
    const content = await ECPresentationGateway.getProxy().getContent(token, this.getStrippedDescriptor(descriptor), keys, pageOptions, options);
    rebuildParentship(content.descriptor);
    return content;
  }

  public async getDistinctValues(token: Readonly<IModelToken>, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<ReadonlyArray<Readonly<string>>> {
    return await ECPresentationGateway.getProxy().getDistinctValues(token, displayType, fieldName, maximumValueCount, options);
  }

  public async saveValueChange(token: Readonly<IModelToken>, instancesInfo: ReadonlyArray<Readonly<ChangedECInstanceInfo>>, propertyAccessor: string, value: any, options: object): Promise<ReadonlyArray<Readonly<ECInstanceChangeResult>>> {
    return await ECPresentationGateway.getProxy().saveValueChange(token, instancesInfo, propertyAccessor, value, options);
  }
}
