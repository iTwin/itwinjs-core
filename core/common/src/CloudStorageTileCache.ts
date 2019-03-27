/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelToken } from "./IModel";
import { CloudStorageCache, CloudStorageProvider, CloudStorageContainerDescriptor, CloudStorageContainerUrl } from "./CloudStorage";
import { IModelTileRpcInterface } from "./rpc/IModelTileRpcInterface";

export interface TileContentIdentifier {
  iModelToken: IModelToken;
  treeId: string;
  contentId: string;
}

export class CloudStorageTileCache extends CloudStorageCache<TileContentIdentifier, Uint8Array> {
  private static _instance: CloudStorageTileCache;

  public static getCache(): CloudStorageTileCache {
    if (!CloudStorageTileCache._instance) {
      CloudStorageTileCache._instance = new CloudStorageTileCache();
    }

    return CloudStorageTileCache._instance;
  }

  /** @alpha */
  public enabled = false;

  private constructor() {
    super();
  }

  protected async obtainContainerUrl(id: TileContentIdentifier, descriptor: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    const client = IModelTileRpcInterface.getClient();
    return client.getTileCacheContainerUrl(id.iModelToken, descriptor);
  }

  protected async requestResource(container: CloudStorageContainerUrl, id: TileContentIdentifier): Promise<Response> {
    if (container.descriptor.provider === CloudStorageProvider.Local) {
      const client = IModelTileRpcInterface.getClient();
      return client.getResource(id.iModelToken, `${container.url}/${this.formResourceName(id)}`);
    }

    return super.requestResource(container, id);
  }

  protected async instantiateResource(response: Response): Promise<Uint8Array | undefined> {
    const data = await response.arrayBuffer();
    if (!data.byteLength) {
      return undefined;
    }

    return new Uint8Array(data);
  }

  public formContainerName(id: TileContentIdentifier): string {
    return `${id.iModelToken.iModelId}`;
  }

  public formResourceName(id: TileContentIdentifier): string {
    const contextId = id.iModelToken.contextId || "snapshot";
    const changeSetId = id.iModelToken.changeSetId || "first";
    return `tiles/${contextId}/${changeSetId}/${id.treeId}/${id.contentId}`;
  }
}
