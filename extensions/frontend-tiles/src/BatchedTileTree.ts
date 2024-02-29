/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeTimePoint, Id64Set, Id64String } from "@itwin/core-bentley";
import { BatchType, RenderMode, RenderSchedule, ViewFlagOverrides } from "@itwin/core-common";
import {
  acquireImdlDecoder, ImdlDecoder, IModelApp, Tile, TileDrawArgs, TileTree, TileTreeParams,
} from "@itwin/core-frontend";
import { BatchedTile, BatchedTileParams } from "./BatchedTile";
import { BatchedTilesetReader, ModelMetadata } from "./BatchedTilesetReader";
import { frontendTilesOptions } from "./FrontendTiles";

const defaultViewFlags: ViewFlagOverrides = {
  renderMode: RenderMode.SmoothShade,
  visibleEdges: false,
};

/** @internal */
export interface BatchedTileTreeParams extends TileTreeParams {
  rootTile: BatchedTileParams;
  reader: BatchedTilesetReader;
  script?: RenderSchedule.Script;
  models: Map<Id64String, ModelMetadata>;
  modelGroups: Id64Set[] | undefined;
}

/** @internal */
export class BatchedTileTree extends TileTree {
  private readonly _rootTile: BatchedTile;
  public readonly reader: BatchedTilesetReader;
  public readonly scheduleScript?: RenderSchedule.Script;
  public readonly decoder: ImdlDecoder;
  public readonly modelGroups: Id64Set[] | undefined;

  public constructor(params: BatchedTileTreeParams) {
    super(params);
    this._rootTile = new BatchedTile(params.rootTile, this);
    this.reader = params.reader;
    this.scheduleScript = params.script;
    this.modelGroups = params.modelGroups;

    this.decoder = acquireImdlDecoder({
      type: BatchType.Primary,
      timeline: this.scheduleScript,
      iModel: this.iModel,
      batchModelId: this.modelId,
      is3d: true,
      containsTransformNodes: false,
      noWorker: !IModelApp.tileAdmin.decodeImdlInWorker,
    });
  }

  public override dispose(): void {
    this.decoder.release();
    super.dispose();
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
    return frontendTilesOptions.enableEdges ?{ } : defaultViewFlags;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public override _selectTiles(args: TileDrawArgs): Tile[] {
    const selected = new Set<BatchedTile>();
    this.rootTile.selectTiles(selected, args, undefined);
    return Array.from(selected);
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
