import { Metadata, ObjectReference, ServerStorage, TransferConfig } from "@itwin/object-storage-core";
import { getTileObjectReference } from "@itwin/core-common";

export class TileStorage {
  public constructor(public readonly storage: ServerStorage) { }

  private _initializedIModels: Set<string> = new Set();

  public async initialize(iModelId: string): Promise<void> {
    if (this._initializedIModels.has(iModelId))
      return;
    if (!(await this.storage.exists({ baseDirectory: iModelId }))) {
      await this.storage.create({ baseDirectory: iModelId });
    }
    this._initializedIModels.add(iModelId);
  }

  public async getDownloadConfig(iModelId: string, expiresInSeconds?: number): Promise<TransferConfig> {
    return this.storage.getDownloadConfig({ baseDirectory: iModelId }, expiresInSeconds);
  }

  public async uploadTile(iModelId: string, changesetId: string, treeId: string, contentId: string, content: Uint8Array, guid?: string, metadata?: Metadata): Promise<void> {
    await this.storage.upload(
      getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
      Buffer.from(content.buffer),
      metadata
    );
  }

  public async downloadTile(iModelId: string, changesetId: string, treeId: string, contentId: string, guid?: string): Promise<Uint8Array> {
    const buffer = await this.storage.download(
      getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
      "buffer"
    );
    return buffer;
  }

  public async getCachedTiles(iModelId: string, prefix: string): Promise<ObjectReference[]> {
    return this.storage.list({ baseDirectory: iModelId, relativeDirectory: prefix });
  }

  public async isTileCached(iModelId: string, changesetId: string, treeId: string, contentId: string, guid?: string): Promise<boolean> {
    return this.storage.exists(getTileObjectReference(iModelId, changesetId, treeId, contentId, guid));
  }
}
