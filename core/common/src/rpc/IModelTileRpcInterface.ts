/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { CloudStorageContainerDescriptor, CloudStorageContainerUrl } from "../CloudStorage";
import { CloudStorageTileCache } from "../CloudStorageTileCache";
import { IModelTokenProps, IModelToken } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { TileTreeProps } from "../TileProps";

/** @public */
export abstract class IModelTileRpcInterface extends RpcInterface {
  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelTileRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "1.0.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  /** @beta */
  public async getTileCacheContainerUrl(_tokenProps: IModelTokenProps, _id: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    return this.forward(arguments);
  }

  /** @internal */
  public async requestTileTreeProps(_tokenProps: IModelTokenProps, _id: string): Promise<TileTreeProps> { return this.forward(arguments); }
  /** @internal */
  public async requestTileContent(iModelToken: IModelTokenProps, treeId: string, contentId: string): Promise<Uint8Array> {
    const cached = await IModelTileRpcInterface.checkCache(iModelToken, treeId, contentId);
    return cached || this.forward(arguments);
  }

  private static async checkCache(tokenProps: IModelTokenProps, treeId: string, contentId: string): Promise<Uint8Array | undefined> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const cached = await CloudStorageTileCache.getCache().retrieve({ iModelToken, treeId, contentId });
    if (cached) {
      return cached;
    }

    return undefined;
  }
}
