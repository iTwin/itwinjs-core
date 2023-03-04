/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, RenderSystem, Tile, TileContent, TileDrawArgs, TileParams, TileRequest, TileRequestChannel, TileTreeLoadStatus, TileVisibility,
} from "@itwin/core-frontend";
import { BatchedTileTree } from "./BatchedTileTree";

export type BatchedTileParams = TileParams;

export class BatchedTile extends Tile {
  public constructor(params: BatchedTileParams, tree: BatchedTileTree) {
    super(params, tree);
  }

  private get _batchedChildren(): BatchedTile[] | undefined {
    return this.children as BatchedTile[] | undefined;
  }

  public selectTiles(selected: BatchedTile[], args: TileDrawArgs): void {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis)
      return;

    // ###TODO this currently just draws the first level of the tile tree that has content.
    if (!this.isReady)
      args.insertMissing(this);

    if (this.hasGraphics) {
      args.markReady(this);
      selected.push(this);
      return;
    }

    args.markUsed(this);
    if (this.isReady) {
      const childrenStatus = this.loadChildren();
      if (TileTreeLoadStatus.Loading === childrenStatus)
        args.markChildrenLoading();

      const children = this._batchedChildren;
      if (children)
          for (const child of children)
            child.selectTiles(selected, args);
    }
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    // ###TODO
    resolve([]);
  }

  public override get channel(): TileRequestChannel {
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-batched-models");
  }

  public override requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    // ###TODO
    return Promise.resolve(undefined);
  }

  public override readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled?: () => boolean): Promise<TileContent> {
    // ###TODO
    return Promise.resolve({ });
  }
}
