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
import { Coordinate } from "../../spatial/geom/Coordinate";
import { Numbers } from "../../system/runtime/Numbers";
import { GridIndex } from "./GridIndex";

/**
 * Class Grid defines an infinite 3D grid of cells.
 *
 * @version 1.0 January 2012
 */
/** @internal */
export class Grid {
  /** The x origin */
  public p0: Coordinate;
  /** The cell X size */
  public size: Coordinate;

  /**
   * Create a new grid.
   * @param x0 the x origin.
   * @param y0 the y origin.
   * @param z0 the z origin.
   * @param sizeX the cell X size.
   * @param sizeY the cell Y size.
   * @param sizeZ the cell Z size.
   */
  public constructor(p0: Coordinate, size: Coordinate) {
    this.p0 = p0;
    this.size = size;
  }

  /**
   * Get the cell index of an X position.
   * @param x the x position.
   * @return the cell index.
   */
  public getCellX(x: float64): float64 {
    return (x - this.p0.x) / this.size.x;
  }

  /**
   * Get the cell index of a Y position.
   * @param y the y position.
   * @return the cell index.
   */
  public getCellY(y: float64): float64 {
    return (y - this.p0.y) / this.size.y;
  }

  /**
   * Get the cell index of a Z position.
   * @param z the z position.
   * @return the cell index.
   */
  public getCellZ(z: float64): float64 {
    return (z - this.p0.z) / this.size.z;
  }

  /**
   * Get the cell index of a position.
   * @param position the position.
   * @param cellIndex the cell index.
   */
  public getCellIndexTo(position: Coordinate, cellIndex: GridIndex): GridIndex {
    cellIndex.x = Numbers.intFloor((position.x - this.p0.x) / this.size.x);
    cellIndex.y = Numbers.intFloor((position.y - this.p0.y) / this.size.y);
    cellIndex.z = Numbers.intFloor((position.z - this.p0.z) / this.size.z);
    return cellIndex;
  }

  /**
   * Get the cell index of a position.
   * @param position the position.
   * @return the cell index.
   */
  public getCellIndex(position: Coordinate): GridIndex {
    return this.getCellIndexTo(position, new GridIndex(0, 0, 0));
  }

  /**
   * Get the center point of a cell.
   * @param cellIndex the index of the cell.
   * @return the center point.
   */
  public getCellCenter(cellIndex: GridIndex): Coordinate {
    let cx: float64 = this.p0.x + (cellIndex.x + 0.5) * this.size.x;
    let cy: float64 = this.p0.y + (cellIndex.y + 0.5) * this.size.y;
    let cz: float64 = this.p0.z + (cellIndex.z + 0.5) * this.size.z;
    return new Coordinate(cx, cy, cz);
  }

  /**
   * Get the bounds of a cell.
   * @param cellIndex the index of the cell.
   * @return the bounds.
   */
  public getCellBounds(cellIndex: GridIndex): Bounds {
    let x0: float64 = this.p0.x + cellIndex.x * this.size.x;
    let y0: float64 = this.p0.y + cellIndex.y * this.size.y;
    let z0: float64 = this.p0.z + cellIndex.z * this.size.z;
    let bounds: Bounds = new Bounds();
    bounds.addXYZ(x0, y0, z0);
    bounds.addXYZ(x0 + this.size.x, y0 + this.size.y, z0 + this.size.z);
    return bounds;
  }

  /**
   * Scale the grid.
   * @param scale the scale factor.
   * @return the scaled grid.
   */
  public scale(scale: float64): Grid {
    return new Grid(
      new Coordinate(this.p0.x, this.p0.y, this.p0.z),
      new Coordinate(scale * this.size.x, scale * this.size.y, scale * this.size.z)
    );
  }

  /**
   * Move the grid.
   * @param dx the x offset.
   * @param dy the y offset.
   * @param dz the z offset.
   * @return the scaled grid.
   */
  public scale3(dx: float64, dy: float64, dz: float64): Grid {
    return new Grid(
      new Coordinate(this.p0.x + dx, this.p0.y + dy, this.p0.z + dz),
      new Coordinate(this.size.x, this.size.y, this.size.z)
    );
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[Grid:x0=" +
      this.p0.x +
      ",y0=" +
      this.p0.y +
      ",z0=" +
      this.p0.z +
      ",sx=" +
      this.size.x +
      ",sy=" +
      this.size.y +
      ",sz=" +
      this.size.z +
      "]"
    );
  }
}
