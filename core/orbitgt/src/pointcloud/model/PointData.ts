/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.model;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../../spatial/geom/Bounds";
import { TileIndex } from "./TileIndex";

/**
 * Abstract class PointData stores the data of the points in a tile.
 */
/** @internal */
export class PointData {
  // the index of the tile
  public tileIndex: TileIndex;
  // the spatial bounds of the tile
  public bounds: Bounds;

  /**
   * Create new point data.
   */
  public constructor(tileIndex: TileIndex, bounds: Bounds) {
    this.tileIndex = tileIndex;
    this.bounds = bounds;
  }
}
