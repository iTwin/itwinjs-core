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
import { ABuffer } from "../../system/buffer/ABuffer";
import { Uint16Buffer } from "../../system/buffer/Uint16Buffer";
import { Uint8Buffer } from "../../system/buffer/Uint8Buffer";
import { PointData } from "./PointData";
import { TileIndex } from "./TileIndex";

/**
 * Class PointDataRaw stores point data with 8 or 16-bit XYZ geometry and 24-bit BGR color precision.
 */
/** @internal */
export class PointDataRaw extends PointData {
  // the identifier of this data format
  public static readonly TYPE: int32 = 1;

  // the 16-bit XYZ geometries (length tileIndex.pointCount)
  public points16: Uint16Buffer;
  // the 8-bit XYZ geometries (length tileIndex.pointCount)
  public points8: Uint8Buffer;
  // the 24-bit BGR colors (length tileIndex.pointCount)
  public colors: Uint8Buffer;

  /**
   * Create new point data.
   */
  public constructor(
    tileIndex: TileIndex,
    bounds: Bounds,
    points16: Uint16Buffer,
    points8: Uint8Buffer,
    colors: Uint8Buffer
  ) {
    super(tileIndex, bounds);
    this.bounds = bounds;
    this.points16 = points16;
    this.points8 = points8;
    this.colors = colors;
  }

  public getRawX(pointIndex: int32): int32 {
    if (this.points16 == null) return this.points8.get(3 * pointIndex + 0);
    return this.points16.get(3 * pointIndex + 0);
  }

  public getRawY(pointIndex: int32): int32 {
    if (this.points16 == null) return this.points8.get(3 * pointIndex + 1);
    return this.points16.get(3 * pointIndex + 1);
  }

  public getRawZ(pointIndex: int32): int32 {
    if (this.points16 == null) return this.points8.get(3 * pointIndex + 2);
    return this.points16.get(3 * pointIndex + 2);
  }

  public getX(pointIndex: int32): float64 {
    let range: float64 = this.points16 == null ? 256.0 : 65536.0;
    let bias: float64 = this.points16 == null ? 0.5 : 0.0;
    return (
      this.bounds.min.x +
      ((this.getRawX(pointIndex) + bias) / range) *
        (this.bounds.max.x - this.bounds.min.x)
    );
  }

  public getY(pointIndex: int32): float64 {
    let range: float64 = this.points16 == null ? 256.0 : 65536.0;
    let bias: float64 = this.points16 == null ? 0.5 : 0.0;
    return (
      this.bounds.min.y +
      ((this.getRawY(pointIndex) + bias) / range) *
        (this.bounds.max.y - this.bounds.min.y)
    );
  }

  public getZ(pointIndex: int32): float64 {
    let range: float64 = this.points16 == null ? 256.0 : 65536.0;
    let bias: float64 = this.points16 == null ? 0.5 : 0.0;
    return (
      this.bounds.min.z +
      ((this.getRawZ(pointIndex) + bias) / range) *
        (this.bounds.max.z - this.bounds.min.z)
    );
  }

  public getRed(pointIndex: int32): int32 {
    return this.colors.get(3 * pointIndex + 2);
  }

  public getGreen(pointIndex: int32): int32 {
    return this.colors.get(3 * pointIndex + 1);
  }

  public getBlue(pointIndex: int32): int32 {
    return this.colors.get(3 * pointIndex + 0);
  }
}
