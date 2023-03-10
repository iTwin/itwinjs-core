/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RenderMode, ViewFlagOverrides } from "@itwin/core-common";
import {
  Tile, TileDrawArgs, TileTree, TileTreeParams,
} from "@itwin/core-frontend";
import { BatchedTile, BatchedTileParams } from "./BatchedTile";
import { BatchedTilesetReader } from "./BatchedTilesetReader";

export interface BatchedTileTreeParams extends TileTreeParams {
  rootTile: BatchedTileParams;
  reader: BatchedTilesetReader;
}

const viewFlagOverrides: ViewFlagOverrides = {
  renderMode: RenderMode.SmoothShade,
  visibleEdges: false,
};

export class BatchedTileTree extends TileTree {
  private readonly _rootTile: BatchedTile;
  public readonly reader: BatchedTilesetReader;

  public constructor(params: BatchedTileTreeParams) {
    super(params);
    this._rootTile = new BatchedTile(params.rootTile, this);
    this.reader = params.reader;
  }

  public override get rootTile(): BatchedTile {
    return this._rootTile;
  }

  public override get is3d(): boolean {
    return true;
  }

  public override get maxDepth(): number | undefined {
    return undefined;
  }

  public override get viewFlagOverrides(): ViewFlagOverrides {
    return viewFlagOverrides;
  }

  public override _selectTiles(args: TileDrawArgs): Tile[] {
    const selected: BatchedTile[] = [];
    this.rootTile.selectTiles(selected, args);
    return selected;
  }

  public override draw(args: TileDrawArgs): void {
    const tiles = this.selectTiles(args);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
  }

  public override prune(): void {
    // ###TODO
  }
}
