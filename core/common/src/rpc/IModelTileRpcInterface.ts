/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { AbandonedError, Id64Array } from "@bentley/bentleyjs-core";
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
  public static interfaceVersion = "1.2.0";

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
  public async requestTileContent(iModelToken: IModelTokenProps, treeId: string, contentId: string, isCanceled?: () => boolean, guid?: string): Promise<Uint8Array> {
    const cached = await IModelTileRpcInterface.checkCache(iModelToken, treeId, contentId, guid);
    if (undefined === cached && undefined !== isCanceled && isCanceled())
      throw new AbandonedError();

    return cached || this.forward(arguments);
  }

  /** This is a temporary workaround for folks developing authoring applications, to be removed when proper support for such applications is introduced.
   * Given a set of model Ids, it purges any associated tile tree state on the back-end so that the next request for the tile tree or content will recreate that state.
   * Invoked after a modification is made to the model(s).
   * If no array of model Ids is supplied, it purges *all* tile trees, which can be quite inefficient.
   * @internal
   */
  public async purgeTileTrees(_tokenProps: IModelTokenProps, _modelIds: Id64Array | undefined): Promise<void> { return this.forward(arguments); }

  private static async checkCache(tokenProps: IModelTokenProps, treeId: string, contentId: string, guid: string | undefined): Promise<Uint8Array | undefined> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return CloudStorageTileCache.getCache().retrieve({ iModelToken, treeId, contentId, guid });
  }
}
