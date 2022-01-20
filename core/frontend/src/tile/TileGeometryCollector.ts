/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Polyface, Range3d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import {
  Tile, TileTreeReference, TileUser,
} from "./internal";

export type CollectTileStatus = "accept" | "reject" | "continue";

export interface TileGeometryCollectorOptions {
  chordTolerance: number;
  range: Range3d;
  user: TileUser;
  transform?: Transform;
}

export class TileGeometryCollector {
  public readonly polyfaces: Polyface[] = [];
  private readonly _missing = new Set<Tile>();
  private _childrenLoading = false;
  protected readonly _options: TileGeometryCollectorOptions;

  public constructor(options: TileGeometryCollectorOptions) {
    this._options = options;
  }

  /** @internal */
  public markChildrenLoading(): void {
    this._childrenLoading = true;
  }

  public requestMissingTiles(): void {
    IModelApp.tileAdmin.requestTiles(this._options.user, this._missing);
  }

  public get isAllGeometryLoaded(): boolean {
    return !this._childrenLoading && this._missing.size === 0;
  }

  public collectTile(tile: Tile): CollectTileStatus {
    const range = this._options.transform ? this._options.transform.multiplyRange(tile.range) : tile.range;
    if (!range.intersectsRange(this._options.range))
      return "reject";

    if (tile.maximumSize === 0 || !tile.isDisplayable)
      return "continue";

    const tolerance = tile.radius / tile.maximumSize;
    return tolerance < this._options.chordTolerance ? "accept" : "continue";
  }
}

export interface GeometryTileTreeReference extends TileTreeReference {
  collectTilePolyfaces: (collector: TileGeometryCollector) => void;
}
