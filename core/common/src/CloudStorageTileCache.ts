/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelToken } from "./IModel";
import { CloudStorageCache, CloudStorageContainerDescriptor, CloudStorageContainerUrl } from "./CloudStorage";
import { IModelTileRpcInterface } from "./rpc/IModelTileRpcInterface";

/** @beta */
export interface TileContentIdentifier {
  iModelToken: IModelToken;
  treeId: string;
  contentId: string;
}

/** @beta */
export class CloudStorageTileCache extends CloudStorageCache<TileContentIdentifier, Uint8Array> {
  private static _instance: CloudStorageTileCache;

  public static getCache(): CloudStorageTileCache {
    if (!CloudStorageTileCache._instance) {
      CloudStorageTileCache._instance = new CloudStorageTileCache();
    }

    return CloudStorageTileCache._instance;
  }

  public supplyExpiryForContainerUrl(_id: CloudStorageContainerDescriptor): Date {
    const expiry = new Date();

    const today = new Date().getDay();
    const rolloverDay = 6; // saturday
    expiry.setHours((rolloverDay - today) * 24);

    expiry.setHours(23);
    expiry.setMinutes(59);
    expiry.setSeconds(59);
    expiry.setMilliseconds(999);

    return expiry;
  }

  private constructor() {
    super();
  }

  protected async obtainContainerUrl(id: TileContentIdentifier, descriptor: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    const client = IModelTileRpcInterface.getClient();
    return client.getTileCacheContainerUrl(id.iModelToken.toJSON(), descriptor);
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
    const changeSetId = id.iModelToken.changeSetId || "first";
    return `tiles/${id.treeId}/${changeSetId}/${id.contentId}`;
  }
}
