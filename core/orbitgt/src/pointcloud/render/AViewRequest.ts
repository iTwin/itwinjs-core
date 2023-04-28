/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.render;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../../spatial/geom/Bounds";
import { TileIndex } from "../model/TileIndex";
import { Level } from "./Level";

/**
 * Class AViewRequest defines a abstract request the render a view.
 *
 * @version 1.0 November 2015
 */
/** @internal */
export abstract class AViewRequest {
  /**
   * Make a new request.
   */
  public constructor() {}

  /**
   * Get the frame time.
   * @return the frame time.
   */
  public abstract getFrameTime(): float64;

  /**
   * Check if bounds are visible.
   * @param bounds the bounds (in model space).
   * @return true if visible.
   */
  public abstract isVisibleBox(bounds: Bounds): boolean;

  /**
   * Should a tile be split?
   * @param level the level of the tile.
   * @param tile the tile index.
   * @return true if the tile should be split into its children.
   */
  public abstract shouldSplit(level: Level, tile: TileIndex): boolean;
}
