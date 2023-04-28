/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../../../spatial/geom/Bounds";
import { Coordinate } from "../../../spatial/geom/Coordinate";
import { ABuffer } from "../../../system/buffer/ABuffer";
import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { OutStream } from "../../../system/io/OutStream";
import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { Grid } from "../../model/Grid";

/**
 * Class GeometryRecord defines a geometry record.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class GeometryRecord {
  /** The bounds (48 byte) */
  private _bounds: Bounds;
  /** The tile grid (48 byte) */
  private _tileGrid: Grid;

  /**
   * Create a new record.
   */
  public constructor(bounds: Bounds, tileGrid: Grid) {
    this._bounds = bounds;
    this._tileGrid = tileGrid;
  }

  /**
   * Get the bounds.
   * @return the bounds.
   */
  public getBounds(): Bounds {
    return this._bounds;
  }

  /**
   * Get the tile grid.
   * @return the tile grid.
   */
  public getTileGrid(): Grid {
    return this._tileGrid;
  }

  /**
   * Read a record.
   * @param data the record data.
   * @return the record.
   */
  private static readFromBuffer(data: ABuffer): GeometryRecord {
    /* Get the record fields */
    let minX: float64 = LittleEndian.readBufferDouble(data, 0);
    let maxX: float64 = LittleEndian.readBufferDouble(data, 8);
    let minY: float64 = LittleEndian.readBufferDouble(data, 16);
    let maxY: float64 = LittleEndian.readBufferDouble(data, 24);
    let minZ: float64 = LittleEndian.readBufferDouble(data, 32);
    let maxZ: float64 = LittleEndian.readBufferDouble(data, 40);
    let bounds: Bounds = new Bounds();
    bounds.addXYZ(minX, minY, minZ);
    bounds.addXYZ(maxX, maxY, maxZ);
    let gridX0: float64 = LittleEndian.readBufferDouble(data, 48);
    let gridY0: float64 = LittleEndian.readBufferDouble(data, 56);
    let gridZ0: float64 = LittleEndian.readBufferDouble(data, 64);
    let gridSX: float64 = LittleEndian.readBufferDouble(data, 72);
    let gridSY: float64 = LittleEndian.readBufferDouble(data, 80);
    let gridSZ: float64 = LittleEndian.readBufferDouble(data, 88);
    let tileGrid: Grid = new Grid(
      new Coordinate(gridX0, gridY0, gridZ0),
      new Coordinate(gridSX, gridSY, gridSZ)
    );
    /* Return the record */
    return new GeometryRecord(bounds, tileGrid);
  }

  /**
   * Read a record.
   * @param fileAccess the access to the file.
   * @param offset the file offset to the record.
   * @param size the file size to the record.
   * @return the record.
   */
  public static readNew(
    offset: ALong,
    size: ALong,
    contentLoader: ContentLoader
  ): GeometryRecord {
    /* Request the data? */
    if (contentLoader.isLoaded() == false) {
      /* Add the range */
      contentLoader.requestFilePart(offset, size.toInt());
      return null;
    }
    /* Get the data */
    let data: ABuffer = contentLoader.getFilePart(offset, size.toInt());
    /* Parse the record */
    return GeometryRecord.readFromBuffer(data);
  }

  /**
   * Write the record.
   * @param out the output stream.
   */
  public write(output: OutStream): void {
    LittleEndian.writeStreamDouble(output, this._bounds.min.x);
    LittleEndian.writeStreamDouble(output, this._bounds.max.x);
    LittleEndian.writeStreamDouble(output, this._bounds.min.y);
    LittleEndian.writeStreamDouble(output, this._bounds.max.y);
    LittleEndian.writeStreamDouble(output, this._bounds.min.z);
    LittleEndian.writeStreamDouble(output, this._bounds.max.z);
    LittleEndian.writeStreamDouble(output, this._tileGrid.p0.x);
    LittleEndian.writeStreamDouble(output, this._tileGrid.p0.y);
    LittleEndian.writeStreamDouble(output, this._tileGrid.p0.z);
    LittleEndian.writeStreamDouble(output, this._tileGrid.size.x);
    LittleEndian.writeStreamDouble(output, this._tileGrid.size.y);
    LittleEndian.writeStreamDouble(output, this._tileGrid.size.z);
  }
}
