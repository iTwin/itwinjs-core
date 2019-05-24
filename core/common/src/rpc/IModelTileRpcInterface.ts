/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { CloudStorageContainerDescriptor, CloudStorageContainerUrl } from "../CloudStorage";
import { CloudStorageTileCache } from "../CloudStorageTileCache";
import { IModelToken } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { TileTreeProps } from "../TileProps";
import { IModelNotFoundResponse } from "./IModelReadRpcInterface";

/** @public */
export abstract class IModelTileRpcInterface extends RpcInterface {
  public static types = () => [
    IModelToken,
    IModelNotFoundResponse,
  ]

  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  /** The semantic version of the interface. */
  public static version = "0.3.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  /** @beta */
  public async getTileCacheContainerUrl(_iModelToken: IModelToken, _id: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    return this.forward(arguments);
  }

  /** The following 2 functions may produce a 504 error if the response takes a long time.
   * @internal
   */
  public async getTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps> { return this.forward(arguments); }
  /** @internal */
  public async getTileContent(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array> {
    const cached = await IModelTileRpcInterface.checkCache(iModelToken, treeId, contentId);
    return cached || this.forward(arguments);
  }

  /** The following 2 functions use memoized promises to avoid 504 errors if the response takes a long time.
   * @internal
   */
  public async requestTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps> { return this.forward(arguments); }
  /** @internal */
  public async requestTileContent(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array> {
    const cached = await IModelTileRpcInterface.checkCache(iModelToken, treeId, contentId);
    return cached || this.forward(arguments);
  }

  private static async checkCache(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array | undefined> {
    const cached = await CloudStorageTileCache.getCache().retrieve({ iModelToken, treeId, contentId });
    if (cached) {
      return cached;
    }

    return undefined;
  }
}
