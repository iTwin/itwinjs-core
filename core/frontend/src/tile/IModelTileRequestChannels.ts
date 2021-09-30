/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@itwin/core-bentley";
import { TileTreeContentIds } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import { IModelConnection } from "../IModelConnection";
import { IModelTile, Tile, TileRequest, TileRequestChannel } from "./internal";

/** Handles requests to the cloud storage tile cache, if one is configured. If a tile's content is not found in the cache, subsequent requests for the same tile will
 * use the IModelTileChannel instead.
 * @internal
 */
export class CloudStorageCacheChannel extends TileRequestChannel {
  public override async requestContent(tile: Tile): Promise<TileRequest.Response> {
    assert(tile instanceof IModelTile);
    return IModelApp.tileAdmin.requestCachedTileContent(tile);
  }

  public override onNoContent(request: TileRequest): boolean {
    assert(request.tile instanceof IModelTile);
    request.tile.cacheMiss = true;
    ++this._statistics.totalCacheMisses;
    return true;
  }
}

/** For an [[IpcApp]], allows backend tile generation requests in progress to be canceled.
 * @internal
 */
export class IModelTileChannel extends TileRequestChannel {
  private readonly _canceled = new Map<IModelConnection, Map<string, Set<string>>>();

  public override onActiveRequestCanceled(request: TileRequest): void {
    const tree = request.tile.tree;
    let entry = this._canceled.get(tree.iModel);
    if (!entry)
      this._canceled.set(tree.iModel, entry = new Map<string, Set<string>>());

    let ids = entry.get(tree.id);
    if (!ids)
      entry.set(tree.id, ids = new Set<string>());

    ids.add(request.tile.contentId);
  }

  public override processCancellations(): void {
    for (const [imodel, entries] of this._canceled) {
      const treeContentIds: TileTreeContentIds[] = [];
      for (const [treeId, tileIds] of entries) {
        const contentIds = Array.from(tileIds);
        treeContentIds.push({ treeId, contentIds });
        this._statistics.totalAbortedRequests += contentIds.length;
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IpcApp.callIpcHost("cancelTileContentRequests", imodel.getRpcProps(), treeContentIds);
    }

    this._canceled.clear();
  }

  public override onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}
