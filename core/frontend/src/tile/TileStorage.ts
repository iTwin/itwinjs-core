import type { ClientStorage, TransferConfig } from "@itwin/object-storage-core/lib/frontend";
import { getTileObjectReference, IModelRpcProps, IModelTileRpcInterface } from "@itwin/core-common";

export class TileStorage {
  public constructor(public readonly storage: ClientStorage) { }

  private _transferConfigs: Map<string, TransferConfig> = new Map();
  private _pendingTransferConfigRequests: Map<string, Promise<TransferConfig>> = new Map();

  public async downloadTile(tokenProps: IModelRpcProps, iModelId: string, changesetId: string, treeId: string, contentId: string, guid?: string): Promise<Uint8Array> {
    const buffer = await this.storage.download(
      {
        reference: getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
        transferConfig: await this.getTransferConfig(tokenProps, iModelId),
        transferType: "buffer",
      }
    );
    return buffer; // should always be Buffer because transferType === "buffer"
  }

  private async getTransferConfig(tokenProps: IModelRpcProps, iModelId: string): Promise<TransferConfig> {
    let transferConfig = this._transferConfigs.get(iModelId);
    if (transferConfig && (transferConfig.expiration < new Date())) {
      transferConfig = undefined;
      this._transferConfigs.delete(iModelId);
    }
    if (transferConfig === undefined) {
      let request = this._pendingTransferConfigRequests.get(iModelId);
      if (request === undefined) {
        request = (async () => {
          const client = IModelTileRpcInterface.getClient();
          const config = await client.getTileCacheConfig(tokenProps);
          this._transferConfigs.set(iModelId, config);
          this._pendingTransferConfigRequests.delete(iModelId);
          return config;
        })();
        this._pendingTransferConfigRequests.set(iModelId, request);
      }
      transferConfig = await request;
    }
    return transferConfig;
  }
}
