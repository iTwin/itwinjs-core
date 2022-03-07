/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, PerfLogger } from "@bentley/bentleyjs-core";
import {
  CloudStorageTileCache, IModelRpcProps,
  TileContentIdentifier,
} from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelHost } from "./IModelHost";
import { CloudStorageUploadOptions } from "./CloudStorageBackend";

/** @internal */

export class CloudStorageTileUploader {
  private _activeUploads: Map<string, Promise<void>> = new Map();

  public get activeUploads(): Iterable<Promise<void>> {
    return this._activeUploads.values();
  }

  private async uploadToCache(id: TileContentIdentifier, content: Uint8Array, containerKey: string, resourceKey: string, metadata?: object) {
    await new Promise((resolve) => setTimeout(resolve));

    try {
      const options: CloudStorageUploadOptions = {};
      if (IModelHost.compressCachedTiles) {
        options.contentEncoding = "gzip";
      }

      const perfInfo = { ...id.tokenProps, treeId: id.treeId, contentId: id.contentId, size: content.byteLength, compress: IModelHost.compressCachedTiles };
      const perfLogger = new PerfLogger("Uploading tile to external tile cache", () => perfInfo);
      await IModelHost.tileCacheService.upload(containerKey, resourceKey, content, options, metadata);
      perfLogger.dispose();
    } catch (err) {
      Logger.logError(BackendLoggerCategory.IModelTileUpload, (err instanceof Error) ? err.toString() : JSON.stringify(err));
    }

    this._activeUploads.delete(containerKey + resourceKey);
  }

  public cacheTile(tokenProps: IModelRpcProps, treeId: string, contentId: string, content: Uint8Array, guid: string | undefined, metadata?: object) {
    const id: TileContentIdentifier = { tokenProps, treeId, contentId, guid };

    const cache = CloudStorageTileCache.getCache();
    const containerKey = cache.formContainerName(id);
    const resourceKey = cache.formResourceName(id);
    const key = containerKey + resourceKey;

    if (this._activeUploads.has(key))
      return;

    this._activeUploads.set(key, this.uploadToCache(id, content, containerKey, resourceKey, metadata));
  }
}
