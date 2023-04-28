/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */
/** @internal */
// NOTE: this class has been translated from Java.
// Do not modify this file, changes will be overwritten.

//package orbitgt.pointcloud.render;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../../spatial/geom/Coordinate";
import { iComparator } from "../../system/runtime/iComparator";
import { Grid } from "../model/Grid";
import { GridIndex } from "../model/GridIndex";
import { TileIndex } from "../model/TileIndex";
import { ViewTree } from "./ViewTree";

/** @internal */
export interface IProjectToViewForSort {
  projectToViewForSort(point: Coordinate): void;
}

/**
 * Class TileLoadSorter sorts file tiles by their angle with the forward view direction (smaller angles first to load tiles in the view center first).
 *
 * @internal
 */
export class TileLoadSorter implements iComparator<TileIndex> {
  /** @ignore */
  public static readonly _CLASSNAME_: string =
    "orbitgt.pointcloud.render.TileLoadSorter"; // the full name of the original java class
  // the interface implementation markers:
  private isiComparator_TileIndex_Instance: boolean = true;

  /** The global tile index */
  private tileIndex: ViewTree;
  /** The model transformation */
  private projectToView: (point: Coordinate) => void;
  /** The view projection */

  /**
   * Create a new sorter.
   * @param tileIndex the global tile index.
   * @param modelTransform the model transformation.
   * @param projection the view projection.
   */
  public constructor(
    tileIndex: ViewTree,
    private viewProjector: IProjectToViewForSort
  ) {
    this.tileIndex = tileIndex;
  }

  /**
   * Get the position of a tile in the view (camera) space.
   * @param tile the grid index of the tile.
   * @param dX the x grid index offset.
   * @param dY the y grid index offset.
   * @param dZ the z grid index offset.
   * @return the position in view space.
   */
  private getTilePosition(
    tile: TileIndex,
    dX: int32,
    dY: int32,
    dZ: int32
  ): Coordinate {
    /* Get the position of the tile center in the view world space */
    let tileGrid: Grid = this.tileIndex.getLevel(tile.level).getTileGrid();
    let tileCenter: Coordinate = tileGrid.getCellCenter(
      new GridIndex(
        tile.gridIndex.x + dX,
        tile.gridIndex.y + dY,
        tile.gridIndex.z + dZ
      )
    );
    this.viewProjector.projectToViewForSort(tileCenter);
    /* Return the position */
    return tileCenter;
  }

  /**
   * Get the radius of a tile.
   * @param tile the grid index of the tile.
   * @param tilePosition the position of the tile in view space.
   * @return the radius of the tile.
   */
  private getTileRadius(tile: TileIndex, tilePosition: Coordinate): float64 {
    /* Get the position of the next tile */
    let nextTilePosition: Coordinate = this.getTilePosition(tile, 1, 0, 0);
    /* Get the distance (in view space) */
    return nextTilePosition.distance3D(tilePosition);
  }

  /**
   * Get the score of a tile.
   * @param tile the tile index.
   * @return the score (the lower the better).
   */
  private getScore(tile: TileIndex): float64 {
    /* We need a tile index */
    if (tile == null) return 0.0;
    /* Get the position of the tile center in the view (camera) space */
    let tileCenter: Coordinate = this.getTilePosition(tile, 0, 0, 0);
    if (tileCenter == null) return 0.0;
    /* Get the angle from the camera boresight (screen center) (the smaller the better) (radians) */
    let angleFromScreenCenter: float64 = Coordinate.getAngleRad(
      tileCenter,
      new Coordinate(0.0, 0.0, 1.0) /*forward*/
    );
    /* Get the radius of the tile in the view (camera) space */
    let tileRadius: float64 = this.getTileRadius(tile, tileCenter);
    /* Get the angular extent of the tile (the bigger the better) (radians) */
    let tileDistance: float64 = tileCenter.getLength();
    let tileExtent: float64 = 2.0 * Math.atan2(tileRadius, tileDistance);
    /* We want tiles with a small screen center angle and with a big screen extent */
    return angleFromScreenCenter - tileExtent;
  }

  // Comparator interface method
  public compare(tile1: TileIndex, tile2: TileIndex): int32 {
    /* Load higher level tiles first (added on 21/03/2017 by LER) */
    let dLevel: int32 = tile1.level - tile2.level;
    if (dLevel != 0) return -dLevel;
    /* Compare the scores inside the level */
    let d: float64 = this.getScore(tile1) - this.getScore(tile2); // new scoring method on 02/02/2017 by LER
    return d > 0.0 ? 1 : d < 0.0 ? -1 : 0;
  }
}
