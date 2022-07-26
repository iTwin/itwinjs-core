/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { gunzip, gzip } from "zlib";
import { promisify } from "util";
import { Metadata, ServerStorage, TransferConfig } from "@itwin/object-storage-core";
import { getTileObjectReference } from "@itwin/core-common";
import { Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelHost } from "./IModelHost";

/** @beta */
export class TileStorage {
  public constructor(public readonly storage: ServerStorage) { }

  private _initializedIModels: Set<string> = new Set();

  public async initialize(iModelId: string): Promise<void> {
    if (this._initializedIModels.has(iModelId))
      return;
    if (!(await this.storage.baseDirectoryExists({ baseDirectory: iModelId }))) {
      await this.storage.createBaseDirectory({ baseDirectory: iModelId });
    }
    this._initializedIModels.add(iModelId);
  }

  public async getDownloadConfig(iModelId: string, expiresInSeconds?: number): Promise<TransferConfig> {
    try {
      return await this.storage.getDownloadConfig({ baseDirectory: iModelId }, expiresInSeconds);
    } catch (err) {
      this.logException("Failed to get download config", err);
      throw err;
    }
  }

  public async uploadTile(iModelId: string, changesetId: string, treeId: string, contentId: string, content: Uint8Array, guid?: string, metadata?: Metadata): Promise<void> {
    try {
      await this.storage.upload(
        getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
        Buffer.from(IModelHost.compressCachedTiles ? await promisify(gzip)(content.buffer) : content.buffer),
        metadata
      );
    } catch (err) {
      this.logException("Failed to upload tile", err);
      throw err;
    }
  }

  public async downloadTile(iModelId: string, changesetId: string, treeId: string, contentId: string, guid?: string): Promise<Uint8Array> {
    try {
      const buffer = await this.storage.download(
        getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
        "buffer"
      );
      return IModelHost.compressCachedTiles ? await promisify(gunzip)(buffer) : buffer;
    } catch (err) {
      this.logException("Failed to download tile", err);
      throw err;
    }
  }

  public async getCachedTiles(iModelId: string, _prefix: string): Promise<{ treeId: string, contentId: string, guid?: string }[]> {
    return (await this.storage.list({ baseDirectory: iModelId }))
      .map((objectReference) => ({
        parts: objectReference.relativeDirectory?.split("/") ?? [""],
        objectName: objectReference.objectName,
      }))
      .filter(({ parts, objectName }) => {
        if (parts[0] !== "tiles")
          return false;
        if (parts.length !== 3) {
          Logger.logWarning(BackendLoggerCategory.IModelTileStorage, "Malformed tile id found in tile cache: {tileId}", { tileId: [...parts, objectName].join("/") });
          return false;
        }
        return true;
      }).map(({ parts, objectName }) => {
        // relativeDirectory = tiles/<treeId>/<guid>
        // objectName = <contentId>
        return {
          treeId: parts[1],
          contentId: objectName,
          guid: parts[2],
        };
      });
  }

  public async isTileCached(iModelId: string, changesetId: string, treeId: string, contentId: string, guid?: string): Promise<boolean> {
    return this.storage.objectExists(getTileObjectReference(iModelId, changesetId, treeId, contentId, guid));
  }

  private logException(message: string, err: unknown): void {
    Logger.logException(
      BackendLoggerCategory.IModelTileStorage,
      err,
      (category, msg, errorMetadata) => Logger.logError(category, `${message}: {errorMessage}`, { ...errorMetadata, errorMessage: msg })
    );
  }
}
