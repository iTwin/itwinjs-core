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

import { AList } from "../../system/collection/AList";
import { BlockIndex } from "../model/BlockIndex";
import { PointData } from "../model/PointData";
import { TileIndex } from "../model/TileIndex";
import { Level } from "./Level";

/**
 * Class FrameData bundles the data needed to render a certain view, some data is available, some data needs to be loaded.
 */
/** @internal */
export class FrameData {
  /** The list of tiles that have been loaded and need to be rendered */
  public tilesToRender: AList<PointData>;
  /** The levels of which the block indexes need to be loaded */
  public levelsToLoad: AList<Level>;
  /** The blocks of which the tile indexes need to be loaded */
  public blocksToLoad: AList<BlockIndex>;
  /** The tiles of which the points need to be loaded */
  public tilesToLoad: AList<TileIndex>;

  /**
   * Create a new frame data holder.
   */
  public constructor() {
    this.tilesToRender = new AList<PointData>();
    this.levelsToLoad = new AList<Level>();
    this.blocksToLoad = new AList<BlockIndex>();
    this.tilesToLoad = new AList<TileIndex>();
  }

  /**
   * Is frame data missing? (so a data load is needed).
   */
  public hasMissingData(): boolean {
    if (this.levelsToLoad.size() > 0) return true;
    if (this.blocksToLoad.size() > 0) return true;
    if (this.tilesToLoad.size() > 0) return true;
    return false;
  }
}
