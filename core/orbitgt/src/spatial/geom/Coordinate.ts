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

/**
 * Class Coordinate defines a 3D XYZ coordinate.
 */
/** @internal */
export class Coordinate {
  public x: float64;
  public y: float64;
  public z: float64;

  public constructor(x: float64, y: float64, z: float64) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public static create(): Coordinate {
    return new Coordinate(0.0, 0.0, 0.0);
  }

  public static fromXY(x: float64, y: float64): Coordinate {
    return new Coordinate(x, y, 0.0);
  }

  public static fromXYZ(x: float64, y: float64, z: float64): Coordinate {
    return new Coordinate(x, y, z);
  }

  public getX(): float64 {
    return this.x;
  }

  public setX(x: float64): void {
    this.x = x;
  }

  public getY(): float64 {
    return this.y;
  }

  public setY(y: float64): void {
    this.y = y;
  }

  public getZ(): float64 {
    return this.z;
  }

  public setZ(z: float64): void {
    this.z = z;
  }

  public set(point: Coordinate): void {
    this.x = point.x;
    this.y = point.y;
    this.z = point.z;
  }

  public setXYZ(x: float64, y: float64, z: float64): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public clear(): void {
    this.x = 0.0;
    this.y = 0.0;
    this.z = 0.0;
  }

  public isZero(): boolean {
    return this.x == 0.0 && this.y == 0.0 && this.z == 0.0;
  }

  public isNonZero(): boolean {
    return this.isZero() == false;
  }

  public same(other: Coordinate): boolean {
    if (other.x != this.x) return false;
    if (other.y != this.y) return false;
    if (other.z != this.z) return false;
    return true;
  }

  public same2D(other: Coordinate): boolean {
    if (other.x != this.x) return false;
    if (other.y != this.y) return false;
    return true;
  }

  public distance3D(other: Coordinate): float64 {
    let dx: float64 = other.x - this.x;
    let dy: float64 = other.y - this.y;
    let dz: float64 = other.z - this.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public distance2D(other: Coordinate): float64 {
    let dx: float64 = other.x - this.x;
    let dy: float64 = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public getLength(): float64 {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  public normalize0(): Coordinate {
    let len: float64 = this.getLength();
    if (len == 0.0) return this;
    return this.scale0(1.0 / len);
  }
  public normalize(): Coordinate {
    return this.copy().normalize0();
  }

  public copy(): Coordinate {
    return new Coordinate(this.x, this.y, this.z);
  }

  public add0(point: Coordinate): Coordinate {
    this.x += point.x;
    this.y += point.y;
    this.z += point.z;
    return this;
  }
  public add(point: Coordinate): Coordinate {
    return this.copy().add0(point);
  }

  public subtract0(point: Coordinate): Coordinate {
    this.x -= point.x;
    this.y -= point.y;
    this.z -= point.z;
    return this;
  }
  public subtract(point: Coordinate): Coordinate {
    return this.copy().subtract0(point);
  }

  public scale0(f: float64): Coordinate {
    this.x *= f;
    this.y *= f;
    this.z *= f;
    return this;
  }
  public scale(f: float64): Coordinate {
    return this.copy().scale0(f);
  }

  public crossProduct0(point: Coordinate): Coordinate {
    let cx: float64 = this.y * point.z - this.z * point.y;
    let cy: float64 = this.z * point.x - this.x * point.z;
    let cz: float64 = this.x * point.y - this.y * point.x;
    this.x = cx;
    this.y = cy;
    this.z = cz;
    return this;
  }
  public crossProduct(point: Coordinate): Coordinate {
    return this.copy().crossProduct0(point);
  }

  public dotProduct(point: Coordinate): float64 {
    return this.x * point.x + this.y * point.y + this.z * point.z;
  }

  public toString(): string {
    return "(" + this.x + "," + this.y + "," + this.z + ")";
  }

  /**
   * Get the angle between two directions.
   * @param direction1 the first direction.
   * @param direction2 the second direction.
   * @return the angle between the directions, in radians from 0.0 to PI (never negative).
   */
  public static getAngleRad(direction1: Coordinate, direction2: Coordinate): float64 {
    let length1: float64 = direction1.getLength();
    if (length1 == 0.0) return 0.0;
    let length2: float64 = direction2.getLength();
    if (length2 == 0.0) return 0.0;
    let cos: float64 = direction1.dotProduct(direction2) / length1 / length2;
    if (cos >= 1.0) return 0.0; // avoid rounding issues like acos(1.0000000000000002) = NaN
    if (cos <= -1.0) return Math.PI;
    return Math.acos(cos);
  }

  /**
   * Get the angle between two directions.
   * @param direction1 the first direction.
   * @param direction2 the second direction.
   * @return the angle between the directions, in degrees from 0.0 to 180.0 (never negative).
   */
  public static getAngleDeg(direction1: Coordinate, direction2: Coordinate): float64 {
    return (Coordinate.getAngleRad(direction1, direction2) / Math.PI) * 180.0;
  }
}
