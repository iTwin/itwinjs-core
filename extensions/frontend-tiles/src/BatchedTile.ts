/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { Tileset3dSchema } from "@itwin/core-common";
import {
  IModelApp, RenderSystem, Tile, TileContent, TileDrawArgs, TileParams, TileRequest, TileRequestChannel, TileTreeLoadStatus, TileVisibility,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTileTree } from "./BatchedTileTree";

export interface BatchedTileParams extends TileParams {
  childrenProps: Tileset3dSchema.Tile[] | undefined;
}

export class BatchedTile extends Tile {
  private readonly _childrenProps?: Tileset3dSchema.Tile[];

  public get batchedTree(): BatchedTileTree {
    return this.tree as BatchedTileTree;
  }

  public constructor(params: BatchedTileParams, tree: BatchedTileTree) {
    super(params, tree);
    if (params.childrenProps?.length)
      this._childrenProps = params.childrenProps;

    if (!this.contentId)
      this.setIsReady();
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

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void {
    let children: BatchedTile[] | undefined;
    if (this._childrenProps) {
      try {
        for (const childProps of this._childrenProps) {
          const params = this.batchedTree.reader.readTileParams(childProps, this);
          const child = new BatchedTile(params, this.batchedTree);
          children = children ?? [];
          children.push(child);
        }
      } catch (err) {
        Logger.logException(loggerCategory, err);
        children = undefined;
        if (err instanceof Error)
          reject(err);
      }
    }

    resolve(children);
  }

  public override get channel(): TileRequestChannel {
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-batched-models");
  }

  public override async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    const url = `${this.batchedTree.reader.baseUrl}${this.contentId}`;
    const response = await fetch(url);
    return response.arrayBuffer();
  }

  public override async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled?: () => boolean): Promise<TileContent> {
    // ###TODO
    return Promise.resolve({ });
  }
}
