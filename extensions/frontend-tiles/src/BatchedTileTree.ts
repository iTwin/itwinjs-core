/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeTimePoint } from "@itwin/core-bentley";
import { RenderMode, ViewFlagOverrides } from "@itwin/core-common";
import {
  Tile, TileDrawArgs, TileTree, TileTreeParams,
} from "@itwin/core-frontend";
import { BatchedTile, BatchedTileParams } from "./BatchedTile";
import { BatchedTilesetReader } from "./BatchedTilesetReader";

/** @internal */
export interface BatchedTileTreeParams extends TileTreeParams {
  rootTile: BatchedTileParams;
  reader: BatchedTilesetReader;
}

const viewFlagOverrides: ViewFlagOverrides = {
  renderMode: RenderMode.SmoothShade,
  visibleEdges: false,
};

/** @internal */
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

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public override _selectTiles(args: TileDrawArgs): Tile[] {
    const useAltSelect = true;
    if (useAltSelect)
      return this._altSelectTiles(args);

    const selected: BatchedTile[] = [];
    this.rootTile.selectTiles(selected, args, 0);
    return selected;
  }

  private _altSelectTiles(args: TileDrawArgs): Tile[] {
    const selected = new Set<BatchedTile>();
    this.rootTile.altSelectTiles(selected, args, undefined);
    const result = Array.from(selected);
    console.log(`selected ${result.map((tile) => tile.debugId).join()}`);
    return result;
  }

  public override draw(args: TileDrawArgs): void {
    const tiles = this.selectTiles(args);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
  }

  public override prune(): void {
    const olderThan = BeTimePoint.now().minus(this.expirationTime);
    this.rootTile.prune(olderThan);
  }
}
