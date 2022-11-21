/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { FrontendStorage, TransferConfig } from "@itwin/object-storage-core/lib/frontend";
import { getTileObjectReference, IModelRpcProps, IModelTileRpcInterface } from "@itwin/core-common";

/** @beta */
export class TileStorage {
  public constructor(public readonly storage: FrontendStorage) { }

  private _transferConfigs: Map<string, TransferConfig | undefined> = new Map();
  private _pendingTransferConfigRequests: Map<string, Promise<TransferConfig | undefined>> = new Map();

  public async downloadTile(
    tokenProps: IModelRpcProps,
    iModelId: string,
    changesetId: string,
    treeId: string,
    contentId: string,
    guid?: string
  ): Promise<Uint8Array | undefined> {
    const transferConfig = await this.getTransferConfig(tokenProps, iModelId);
    if(transferConfig === undefined)
      return undefined;
    try {
      const buffer = await this.storage.download({
        reference: getTileObjectReference(iModelId, changesetId, treeId, contentId, guid),
        transferConfig,
        transferType: "buffer",
      });

      return new Uint8Array(buffer); // should always be Buffer because transferType === "buffer"
    } catch (_) {
      // @itwin/object-storage re-throws internal implementation-specific errors, so let's treat them all as 404 for now.
      return undefined;
    }
  }

  private async getTransferConfig(tokenProps: IModelRpcProps, iModelId: string): Promise<TransferConfig | undefined> {
    if(this._transferConfigs.has(iModelId)) {
      const transferConfig = this._transferConfigs.get(iModelId);
      if(transferConfig === undefined)
        return undefined;
      if(transferConfig.expiration > new Date())
        return transferConfig;
      else // Refresh expired transferConfig
        return this.sendTransferConfigRequest(tokenProps, iModelId);
    }
    return this.sendTransferConfigRequest(tokenProps, iModelId);
  }

  private async sendTransferConfigRequest(tokenProps: IModelRpcProps, iModelId: string): Promise<TransferConfig | undefined> {
    const pendingRequest = this._pendingTransferConfigRequests.get(iModelId);
    if(pendingRequest !== undefined)
      return pendingRequest;

    const request = (async () => {
      const config = await IModelTileRpcInterface.getClient().getTileCacheConfig(tokenProps);
      this._transferConfigs.set(iModelId, config);
      this._pendingTransferConfigRequests.delete(iModelId);
      return config;
    })();
    this._pendingTransferConfigRequests.set(iModelId, request);
    return request;
  }
}
