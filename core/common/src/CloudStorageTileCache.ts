/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CloudStorage
 */

import { IModelToken } from "./IModel";
import { CloudStorageCache, CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageProvider } from "./CloudStorage";
import { IModelTileRpcInterface } from "./rpc/IModelTileRpcInterface";

/** @beta */
export interface TileContentIdentifier {
  iModelToken: IModelToken;
  treeId: string;
  contentId: string;
  guid: string | undefined;
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

  protected constructor() {
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
    const version = id.guid ? id.guid : changeSetId; // NB: id.guid can be null (backend) OR undefined (frontend) here...
    return `tiles/${id.treeId}/${version}/${id.contentId}`;
  }

  protected formContainerKey(id: TileContentIdentifier): string {
    if (this.provider === CloudStorageProvider.AliCloud) {
      return this.formContainerName(id) + this.formResourceName(id);
    }

    return super.formContainerKey(id);
  }
}
