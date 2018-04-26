/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken, Gateway } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { Node, NodeKey } from "@bentley/ecpresentation-common";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";

export default class ECPresentationGateway extends ECPresentationGatewayDefinition {
  /** Returns the ECPresentationGateway instance for the frontend. */
  public static getProxy(): ECPresentationGateway {
    return Gateway.getProxyForGateway(ECPresentationGateway);
  }

  public async getRootNodes(_token: Readonly<IModelToken>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return this.forward.apply(this, arguments);
  }

  public async getRootNodesCount(_token: Readonly<IModelToken>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getChildren(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    return this.forward.apply(this, arguments);
  }

  public async getChildrenCount(_token: Readonly<IModelToken>, _parentKey: Readonly<NodeKey>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContentDescriptor(_token: Readonly<IModelToken>, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined, _options: object): Promise<Readonly<Descriptor>> {
    return await this.forward.apply(this, arguments);
  }

  public async getContentSetSize(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _options: object): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async getContent(_token: Readonly<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _pageOptions: Readonly<PageOptions> | undefined, _options: object): Promise<Readonly<Content>> {
    return await this.forward.apply(this, arguments);
  }
}
