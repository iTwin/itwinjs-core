/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { RenderMode, ViewFlagOverrides } from "@itwin/core-common";
import {
  Tile, TileDrawArgs, TileTree, TileTreeParams,
} from "@itwin/core-frontend";
import { BatchedTile, BatchedTileParams } from "./BatchedTile";

export interface BatchedTileTreeParams extends TileTreeParams {
  rootTile: BatchedTileParams;
}

const viewFlagOverrides: ViewFlagOverrides = {
  renderMode: RenderMode.SmoothShade,
  visibleEdges: false,
};

export class BatchedTileTree extends TileTree {
  private readonly _rootTile: BatchedTile;

  public constructor(params: TileTreeParams) {
    super(params);
    this._rootTile = new BatchedTile({
      contentId: "###TODO",
      range: new Range3d(), // ###TODO
      maximumSize: 512, // ###TODO
    }, this);
  }

  public override get rootTile(): BatchedTile {
    return this._rootTile;
  }

  public override get is3d(): boolean {
    return true;
  }

  public override get maxDepth(): number | undefined {
    // ###TODO?
    return undefined;
  }

  public override get viewFlagOverrides(): ViewFlagOverrides {
    return viewFlagOverrides;
  }

  public override _selectTiles(_args: TileDrawArgs): Tile[] {
    // ###TODO
    return [];
  }

  public override draw(_args: TileDrawArgs): void {
    // ###TODO
  }

  public override prune(): void {
    // ###TODO
  }
}
