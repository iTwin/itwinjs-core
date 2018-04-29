/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import ECPresentation from "./ECPresentation";
import ECPresentationManager from "./ECPresentationManager";

/** The backend implementation of ECPresentationGatewayDefinition. */
export default class ECPresentationGateway extends ECPresentationGatewayDefinition {

  public getManager(): ECPresentationManager {
    return ECPresentation.manager;
  }

  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getRootNodes(token, pageOptions, options);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    return await this.getManager().getRootNodesCount(token, options);
  }

  public async getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return await this.getManager().getChildren(token, parentKey, pageOptions, options);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    return await this.getManager().getChildrenCount(token, parentKey, options);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor>> {
    const descriptor = await this.getManager().getContentDescriptor(token, displayType, keys, selection, options);
    if (descriptor)
      descriptor.resetParentship();
    return descriptor;
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    return await this.getManager().getContentSetSize(token, descriptor, keys, options);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const content: Content = await this.getManager().getContent(token, descriptor, keys, pageOptions, options);
    content.descriptor.resetParentship();
    return content;
  }
}
