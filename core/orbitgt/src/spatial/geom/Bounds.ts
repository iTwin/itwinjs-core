/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.geom;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "./Coordinate";

/**
 * Class Bounds defines a 3D XYZ bounding box that can be empty.
 */
/** @internal */
export class Bounds {
  public valid: boolean;
  public min: Coordinate;
  public max: Coordinate;

  public constructor() {
    this.valid = false;
    this.min = Coordinate.create();
    this.max = Coordinate.create();
  }

  public clear(): void {
    this.valid = false;
    this.min.clear();
    this.max.clear();
  }

  public isValid(): boolean {
    return this.valid;
  }

  public getMinX(): float64 {
    return this.min.x;
  }

  public getMinY(): float64 {
    return this.min.y;
  }

  public getMinZ(): float64 {
    return this.min.z;
  }

  public getMaxX(): float64 {
    return this.max.x;
  }

  public getMaxY(): float64 {
    return this.max.y;
  }

  public getMaxZ(): float64 {
    return this.max.z;
  }

  public addXYZ(x: float64, y: float64, z: float64): Bounds {
    if (this.valid == false) {
      this.min.x = x;
      this.min.y = y;
      this.min.z = z;
      this.max.x = x;
      this.max.y = y;
      this.max.z = z;
      this.valid = true;
    } else {
      if (x < this.min.x) this.min.x = x;
      if (y < this.min.y) this.min.y = y;
      if (z < this.min.z) this.min.z = z;
      if (x > this.max.x) this.max.x = x;
      if (y > this.max.y) this.max.y = y;
      if (z > this.max.z) this.max.z = z;
    }
    return this;
  }

  public add(c: Coordinate): Bounds {
    return this.addXYZ(c.x, c.y, c.z);
  }

  public containsXYZ(x: float64, y: float64, z: float64): boolean {
    if (this.valid == false) return false;
    if (x < this.min.x) return false;
    if (y < this.min.y) return false;
    if (z < this.min.z) return false;
    if (x > this.max.x) return false;
    if (y > this.max.y) return false;
    if (z > this.max.z) return false;
    return true;
  }

  public contains(c: Coordinate): boolean {
    return this.containsXYZ(c.x, c.y, c.z);
  }

  public hasOverlapXYZ(
    x1: float64,
    y1: float64,
    z1: float64,
    x2: float64,
    y2: float64,
    z2: float64
  ): boolean {
    if (this.valid == false) return false;
    let minX: float64 = Math.min(x1, x2);
    let minY: float64 = Math.min(y1, y2);
    let minZ: float64 = Math.min(z1, z2);
    let maxX: float64 = Math.max(x1, x2);
    let maxY: float64 = Math.max(y1, y2);
    let maxZ: float64 = Math.max(z1, z2);
    return (
      maxX >= this.min.x &&
      minX <= this.max.x &&
      maxY >= this.min.y &&
      minY <= this.max.y &&
      maxZ >= this.min.z &&
      minZ <= this.max.z
    );
  }

  public getCorner(index: int32, point: Coordinate): void {
    point.setX((index & 1) == 0 ? this.min.x : this.max.x);
    point.setY((index & 2) == 0 ? this.min.y : this.max.y);
    point.setZ((index & 4) == 0 ? this.min.z : this.max.z);
  }

  public getIntersection(other: Bounds): Bounds {
    /* Define the intersection */
    let intersection: Bounds = new Bounds();
    /* Both boxes should be valid */
    if (this.valid == false) return intersection;
    if (other.valid == false) return intersection;
    /* Intersect X */
    let minX: float64 = Math.max(this.min.x, other.min.x);
    let maxX: float64 = Math.min(this.max.x, other.max.x);
    if (minX > maxX) return intersection;
    /* Intersect Y */
    let minY: float64 = Math.max(this.min.y, other.min.y);
    let maxY: float64 = Math.min(this.max.y, other.max.y);
    if (minY > maxY) return intersection;
    /* Intersect Z */
    let minZ: float64 = Math.max(this.min.z, other.min.z);
    let maxZ: float64 = Math.min(this.max.z, other.max.z);
    if (minZ > maxZ) return intersection;
    /* Empty? */
    if (minX == maxX && minY == maxY && minZ == maxZ) return intersection;
    /* Return the intersection */
    intersection.valid = true;
    intersection.min.x = minX;
    intersection.max.x = maxX;
    intersection.min.y = minY;
    intersection.max.y = maxY;
    intersection.min.z = minZ;
    intersection.max.z = maxZ;
    return intersection;
  }

  public toString(): string {
    if (this.valid)
      return (
        "(min:" +
        this.min.x +
        "," +
        this.min.y +
        "," +
        this.min.z +
        ",max:" +
        this.max.x +
        "," +
        this.max.y +
        "," +
        this.max.z +
        ")"
      );
    else return "(invalid)";
  }
}
