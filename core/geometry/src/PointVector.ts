/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Geometry, Angle, BeJSONFunctions, AngleProps } from "./Geometry";
import { Ray3d } from "./AnalyticGeometry";
import { Matrix3d, Transform } from "./Transform";

export interface IsNullCheck { isNull(): boolean; }
export interface WritableXAndY { x: number; y: number; }
export interface WriteableHasZ { z: number; }
export interface WritableXYAndZ extends XAndY, WriteableHasZ { }
export interface WritableLowAndHighXY { low: WritableXAndY; high: WritableXAndY; }
export interface WritableLowAndHighXYZ { low: WritableXYAndZ; high: WritableXYAndZ; }

export type HasZ = Readonly<WriteableHasZ>;
export type XAndY = Readonly<WritableXAndY>;
export type XYAndZ = Readonly<WritableXYAndZ>;
export type LowAndHighXY = Readonly<WritableLowAndHighXY>;
export type LowAndHighXYZ = Readonly<WritableLowAndHighXYZ>;

export type XYZProps = { x?: number; y?: number; z?: number } | number[];
export type XYProps = { x?: number; y?: number; } | number[];
export type Matrix3dProps = number[][] | Matrix3d | number[];
export type TransformProps = number[][] | number[] | { origin: XYZProps; matrix: Matrix3dProps; };
export type Range3dProps = { low: XYZProps; high: XYZProps; } | XYZProps[];
export type Range2dProps = { low: XYProps; high: XYProps; } | XYProps[];
export type Range1dProps = { low: number; high: number } | number[];

/** Minimal object containing x,y and operations that are meaningful without change in both point and vector. */
export class XY implements XAndY {
  /** x component */
  public x: number;
  /** y component */
  public y: number;
  /** Set both x and y. */
  public set(x: number = 0, y: number = 0) { this.x = x; this.y = y; }
  /** Set both x and y to zero */
  public setZero() { this.x = 0; this.y = 0; }
  protected constructor(x: number = 0, y: number = 0) { this.x = x; this.y = y; }
  /** Set both x and y from other. */
  public setFrom(other?: XAndY) {
    if (other) {
      this.x = other.x; this.y = other.y;
    } else {
      this.x = 0; this.y = 0;
    }
  }

  /** Returns true if this and other have equal x,y parts within Geometry.smallMetricDistance. */
  public isAlmostEqual(other: XAndY, tol?: number): boolean { return Geometry.isSameCoordinate(this.x, other.x, tol) && Geometry.isSameCoordinate(this.y, other.y, tol); }

  /** return a json array or object with the [x,y] data.  */
  public toJSON(): XYProps { return [this.x, this.y]; }
  public toJSONXY(): XYProps { return { x: this.x, y: this.y }; }

  /** Set x and y from a JSON source */
  public setFromJSON(json?: XYProps): void {
    if (Array.isArray(json)) {
      this.set(json[0] || 0, json[1] || 0);
      return;
    }
    if (json) {
      this.set(json.x || 0, json.y || 0);
      return;
    }
    this.set(0, 0);
  }

  /** Return the distance from this point to other */
  public distance(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (Math.sqrt(xDist * xDist + yDist * yDist));
  }

  /** Return squared distance from this point to other */
  public distanceSquared(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (xDist * xDist + yDist * yDist);
  }

  /** Return the largest absolute distance between corresponding components */
  public maxDiff(other: XAndY): number {
    return Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y));
  }
  /** @returns true if the x,y components are both small by metric metric tolerance */
  public get isAlmostZero(): boolean {
    return Geometry.isSmallMetricDistance(this.x) && Geometry.isSmallMetricDistance(this.y);
  }

  /** Return the largest absolute value of any component */
  public maxAbs(): number { return Math.max(Math.abs(this.x), Math.abs(this.y)); }
  /** Return the magnitude of the vector */
  public magnitude(): number { return Math.sqrt(this.x * this.x + this.y * this.y); }
  /** Return the squared magnitude of the vector.  */
  public magnitudeSquared(): number { return this.x * this.x + this.y * this.y; }

  /** @returns true if the x,y components are exactly equal. */
  public isExactEqual(other: XAndY): boolean { return this.x === other.x && this.y === other.y; }
  public isAlmostEqualMetric(other: XAndY): boolean { return this.maxDiff(other) <= Geometry.smallMetricDistance; }

  /** Return a (full length) vector from this point to other */
  public vectorTo(other: XAndY, result?: Vector2d): Vector2d {
    return Vector2d.create(
      other.x - this.x,
      other.y - this.y,
      result);
  }
  /** Return a unit vector from this point to other */
  public unitVectorTo(target: XAndY, result?: Vector2d): Vector2d | undefined {
    return this.vectorTo(target, result).normalize(result);
  }
}

/** Minimal object containing x,y,z and operations that are meaningful without change in both point and vector. */
export class XYZ implements XYAndZ {
  public x: number;
  public y: number;
  public z: number;
  /**
   * Set the x,y,z  parts.
   * @param x (optional) x part
   * @param y (optional) y part
   * @param z (optional) z part
   */
  public set(x: number = 0, y: number = 0, z: number = 0) { this.x = x; this.y = y; this.z = z; }
  /** Set the x,y,z parts to zero. */
  public setZero() { this.x = 0; this.y = 0; this.z = 0; }
  protected constructor(x: number = 0, y: number = 0, z: number = 0) { this.x = x; this.y = y; this.z = z; }

  /** Type guard for XAndY.
   * @note this will return true for an XYAndZ. If you wish to distinguish between the two, call isXYAndZ first.
   */
  public static isXAndY(arg: any): arg is XAndY { return arg.x !== undefined && arg.y !== undefined; }
  /** Type guard to determine whether an object has a member called "z" */
  public static hasZ(arg: any): arg is HasZ { return arg.z !== undefined; }
  /** Type guard for XYAndZ.  */
  public static isXYAndZ(arg: any): arg is XYAndZ { return this.isXAndY(arg) && this.hasZ(arg); }

  /**
   * Set the x,y,z parts from one of these input types
   *
   * * XYZ -- copy the x,y,z parts
   * * Float64Array -- Copy from indices 0,1,2 to x,y,z
   * * XY -- copy the x, y parts and set z=0
   */
  public setFrom(other: Float64Array | XAndY | XYAndZ) {
    if (XYZ.isXAndY(other)) {
      this.x = other.x; this.y = other.y; this.z = XYZ.hasZ(other) ? other.z : 0;
    } else {
      this.x = other[0]; this.y = other[1]; this.z = other[2];
    }
  }
  /** Returns true if this and other have equal x,y,z parts within Geometry.smallMetricDistance.
   * @param other The other XYAndZ to compare
   * @param tol The tolerance for the comparison. If undefined, use [[Geometry.smallMetricDistance]]
   */
  public isAlmostEqual(other: XYAndZ, tol?: number): boolean {
    return Geometry.isSameCoordinate(this.x, other.x, tol)
      && Geometry.isSameCoordinate(this.y, other.y, tol)
      && Geometry.isSameCoordinate(this.z, other.z, tol);
  }

  /** Return true if this and other have equal x,y,z parts within Geometry.smallMetricDistance. */
  public isAlmostEqualXYZ(x: number, y: number, z: number, tol?: number): boolean {
    return Geometry.isSameCoordinate(this.x, x, tol)
      && Geometry.isSameCoordinate(this.y, y, tol)
      && Geometry.isSameCoordinate(this.z, z, tol);
  }

  /** Return true if this and other have equal x,y parts within Geometry.smallMetricDistance. */
  public isAlmostEqualXY(other: XAndY, tol?: number): boolean {
    return Geometry.isSameCoordinate(this.x, other.x, tol)
      && Geometry.isSameCoordinate(this.y, other.y, tol);
  }

  /** Return a JSON object as array [x,y,z] */
  public toJSON(): XYZProps { return [this.x, this.y, this.z]; }
  public toJSONXYZ(): XYZProps { return { x: this.x, y: this.y, z: this.z }; }

  /** Pack the x,y,z values in a Float64Array. */
  public toFloat64Array(): Float64Array { return Float64Array.of(this.x, this.y, this.z); }
  /**
   * Set the x,y,z properties from one of several json forms:
   *
   * *  array of numbers: [x,y,z]
   * *  object with x,y, and (optional) z as numeric properties {x: xValue, y: yValue, z: zValue}
   */
  public setFromJSON(json?: XYZProps): void {
    if (Array.isArray(json)) { this.set(json[0] || 0, json[1] || 0, json[2] || 0); return; }
    if (json) { this.set(json.x || 0, json.y || 0, json.z || 0); return; }
    this.set(0, 0, 0);
  }

  /** Return the distance from this point to other */
  public distance(other: XYAndZ): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    const zDist = other.z - this.z;
    return (Math.sqrt(xDist * xDist + yDist * yDist + zDist * zDist));
  }

  /** Return squared distance from this point to other */
  public distanceSquared(other: XYAndZ): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    const zDist = other.z - this.z;
    return (xDist * xDist + yDist * yDist + zDist * zDist);
  }

  /** Return the XY distance from this point to other */
  public distanceXY(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (Math.sqrt(xDist * xDist + yDist * yDist));
  }

  /** Return squared XY distance from this point to other */
  public distanceSquaredXY(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (xDist * xDist + yDist * yDist);
  }

  /** Return the largest absolute distance between corresponding components */
  public maxDiff(other: XYAndZ): number {
    return Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y), Math.abs(this.z - other.z));
  }
  /**
   * Return the x,y, z component corresponding to 0,1,2.
   */
  public at(index: number): number { if (index < 0.5) return this.x; if (index > 1.5) return this.z; return this.y; }
  /** Return the index (0,1,2) of the x,y,z component with largest absolute value */
  public indexOfMaxAbs(): number {
    let index = 0;
    let a = Math.abs(this.x);
    let b = Math.abs(this.y);
    if (b > a) { index = 1; a = b; }
    b = Math.abs(this.z);
    if (b > a) { index = 2; a = b; }
    return index;
  }
  /** Return true if the if x,y,z components are all nearly zero to tolerance Geometry.smallMetricDistance */
  public get isAlmostZero(): boolean {
    return Geometry.isSmallMetricDistance(this.x) && Geometry.isSmallMetricDistance(this.y) && Geometry.isSmallMetricDistance(this.z);
  }

  /** Return the largest absolute value of any component */
  public maxAbs(): number { return Math.max(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); }
  /** Return the sqrt of the sum of squared x,y,z parts */
  public magnitude(): number { return Math.hypot(this.x, this.y, this.z); }
  /** Return the sum of squared x,y,z parts */
  public magnitudeSquared(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  /** Return sqrt of the sum of squared x,y parts */
  public magnitudeXY(): number { return Math.hypot(this.x, this.y); }
  /** Return the sum of squared x,y parts */
  public magnitudeSquaredXY(): number { return this.x * this.x + this.y * this.y; }

  /** exact equality test. */
  public isExactEqual(other: XYAndZ): boolean { return this.x === other.x && this.y === other.y && this.z === other.z; }
  /** equality test with Geometry.smallMetricDistance tolerance */
  public isAlmostEqualMetric(other: XYAndZ): boolean { return this.maxDiff(other) <= Geometry.smallMetricDistance; }
  /** add x,y,z from other in place. */
  public addInPlace(other: XYAndZ): void { this.x += other.x; this.y += other.y; this.z += other.z; }
  /** add (in place) the scaled x,y,z of other */
  public addScaledInPlace(other: XYAndZ, scale: number): void {
    this.x += scale * other.x; this.y += scale * other.y; this.z += scale * other.z;
  }
  /** Multiply the x, y, z parts by scale. */
  public scaleInPlace(scale: number) { this.x *= scale; this.y *= scale; this.z *= scale; }
  /** Clone strongly typed as Point3d */
  public cloneAsPoint3d() { return Point3d.create(this.x, this.y, this.z); }

  /** Return a (full length) vector from this point to other */
  public vectorTo(other: XYAndZ, result?: Vector3d): Vector3d {
    return Vector3d.create(
      other.x - this.x,
      other.y - this.y,
      other.z - this.z,
      result);
  }

  /** Return a multiple of a the (full length) vector from this point to other */
  public scaledVectorTo(other: XYAndZ, scale: number, result?: Vector3d): Vector3d {
    return Vector3d.create(
      scale * (other.x - this.x),
      scale * (other.y - this.y),
      scale * (other.z - this.z),
      result);
  }

  /** Return a unit vector from this vector to other. Return a 000 vector if the input is too small to normalize.
   * @param other target of created vector.
   * @param result optional result vector.
   */
  public unitVectorTo(target: XYAndZ, result?: Vector3d): Vector3d | undefined { return this.vectorTo(target, result).normalize(result); }

  /** Freeze this XYZ */
  public freeze() { Object.freeze(this); }
}

export class Point3d extends XYZ {
  /** Constructor for Point3d */
  constructor(x: number = 0, y: number = 0, z: number = 0) { super(x, y, z); }
  public static fromJSON(json?: XYZProps): Point3d { const val = new Point3d(); val.setFromJSON(json); return val; }
  /** Return a new Point3d with the same coordinates */
  public clone(): Point3d { return new Point3d(this.x, this.y, this.z); }

  /** Create a new Point3d with given coordinates
   * @param x x part
   * @param y y part
   * @param z z part
   */
  public static create(x: number = 0, y: number = 0, z: number = 0, result?: Point3d): Point3d {
    if (result) {
      result.x = x;
      result.y = y;
      result.z = z;
      return result;
    }
    return new Point3d(x, y, z);
  }
  /** Copy contents from another Point3d, Point2d, Vector2d, or Vector3d */
  public static createFrom(data: XYAndZ | XAndY | Float64Array, result?: Point3d): Point3d {
    if (data instanceof Float64Array) {
      if (data.length >= 3)
        return Point3d.create(data[0], data[1], data[2], result);
      if (data.length >= 2)
        return Point3d.create(data[0], data[1], 0, result);
      if (data.length >= 1)
        return Point3d.create(data[0], 0, 0, result);
      return Point3d.create(0, 0, 0, result);
    }
    return Point3d.create(data.x, data.y, XYZ.hasZ(data) ? data.z : 0, result);
  }
  /**
   * Copy x,y,z from
   * @param xyzData flat array of xyzxyz for multiple points
   * @param pointIndex index of point to extract.   This index is multiplied by 3 to obtain starting index in the array.
   * @param result optional result point.
   */
  public static createFromPacked(xyzData: Float64Array, pointIndex: number, result?: Point3d): Point3d | undefined {
    const indexX = pointIndex * 3;
    if (indexX >= 0 && indexX + 2 < xyzData.length)
      return Point3d.create(xyzData[indexX], xyzData[indexX + 1], xyzData[indexX + 2], result);
    return undefined;
  }

  /**
   * Copy and unweight xyzw.
   * @param xyzData flat array of xyzwxyzw for multiple points
   * @param pointIndex index of point to extract.   This index is multiplied by 4 to obtain starting index in the array.
   * @param result optional result point.
   */
  public static createFromPackedXYZW(xyzData: Float64Array, pointIndex: number, result?: Point3d): Point3d | undefined {
    const indexX = pointIndex * 4;
    if (indexX >= 0 && indexX + 3 < xyzData.length) {
      const w = xyzData[indexX + 3];
      if (!Geometry.isSmallMetricDistance(w)) {
        const divW = 1.0 / w;
        return Point3d.create(divW * xyzData[indexX], divW * xyzData[indexX + 1], divW * xyzData[indexX + 2], result);
      }
    }
    return undefined;
  }

  /** Create a new point with 000 xyz */
  public static createZero(result?: Point3d): Point3d { return Point3d.create(0, 0, 0, result); }

  /** Return the cross product of the vectors from this to pointA and pointB
   *
   * *  the result is a vector
   * *  the result is perpendicular to both vectors, with right hand orientation
   * *  the magnitude of the vector is twice the area of the triangle.
   */
  public crossProductToPoints(pointA: Point3d, pointB: Point3d, result?: Vector3d): Vector3d {
    return Vector3d.createCrossProduct(
      pointA.x - this.x, pointA.y - this.y, pointA.z - this.z,
      pointB.x - this.x, pointB.y - this.y, pointB.z - this.z,
      result);
  }

  /** Return the triple product of the vectors from this to pointA, pointB, pointC
   *
   * * This is a scalar (number)
   * *  This is 6 times the (signed) volume of the tetrahedron on the 4 points.
   */
  public tripleProductToPoints(pointA: Point3d, pointB: Point3d, pointC: Point3d): number {
    return Geometry.tripleProduct(
      pointA.x - this.x, pointA.y - this.y, pointA.z - this.z,
      pointB.x - this.x, pointB.y - this.y, pointB.z - this.z,
      pointC.x - this.x, pointC.y - this.y, pointC.z - this.z);
  }
  /** Return the cross product of the vectors from this to pointA and pointB
   *
   * *  the result is a scalar
   * *  the magnitude of the vector is twice the signed area of the triangle.
   * *  this is positive for counter-clockwise order of the points, negative for clockwise.
   */
  public crossProductToPointsXY(pointA: Point3d, pointB: Point3d): number {
    return Geometry.crossProductXYXY(
      pointA.x - this.x, pointA.y - this.y,
      pointB.x - this.x, pointB.y - this.y);
  }

  /** Return a point interpolated between this point and the right param. */
  public interpolate(fraction: number, other: Point3d, result?: Point3d): Point3d {
    if (fraction <= 0.5)
      return Point3d.create(
        this.x + fraction * (other.x - this.x),
        this.y + fraction * (other.y - this.y),
        this.z + fraction * (other.z - this.z),
        result);
    const t: number = fraction - 1.0;
    return Point3d.create(
      other.x + t * (other.x - this.x),
      other.y + t * (other.y - this.y),
      other.z + t * (other.z - this.z), result);
  }

  /**
   * Return a ray whose ray.origin is interpolated, and ray.direction is the vector between points with a
   * scale factor applied.
   * @param fraction fractional position between points.
   * @param other endpoint of interpolation
   * @param tangentScale scale factor to apply to the startToEnd vector
   * @param result  optional receiver.
   */
  public interpolatePointAndTangent(fraction: number, other: Point3d, tangentScale: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const dz = other.z - this.z;
    result.direction.set(tangentScale * dx, tangentScale * dy, tangentScale * dz);
    if (fraction <= 0.5)
      result.origin.set(
        this.x + fraction * dx,
        this.y + fraction * dy,
        this.z + fraction * dz);
    else {
      const t: number = fraction - 1.0;
      result.origin.set(
        other.x + t * dx,
        other.y + t * dy,
        other.z + t * dz);
    }
    return result;
  }

  /** Return a point with independent x,y,z fractional interpolation. */
  public interpolateXYZ(fractionX: number, fractionY: number, fractionZ: number, other: Point3d, result?: Point3d): Point3d {
    return Point3d.create(
      Geometry.interpolate(this.x, fractionX, other.x),
      Geometry.interpolate(this.y, fractionY, other.y),
      Geometry.interpolate(this.z, fractionZ, other.z),
      result);
  }

  /** Interpolate between points, then add a shift in the xy plane by a fraction of the XY projection perpendicular. */
  public interpolatePerpendicularXY(fraction: number, pointB: Point3d, fractionXYPerp: number, result?: Point3d): Point3d {
    result = result ? result : new Point3d();
    const vector = pointB.minus(this);
    this.interpolate(fraction, pointB, result);
    result.x -= fractionXYPerp * vector.y;
    result.y += fractionXYPerp * vector.x;
    return result;
  }

  /** Return point minus vector */
  public minus(vector: XYAndZ, result?: Point3d): Point3d {
    return Point3d.create(
      this.x - vector.x,
      this.y - vector.y,
      this.z - vector.z, result);
  }

  /** Return point plus vector */
  public plus(vector: XYAndZ, result?: Point3d): Point3d {
    return Point3d.create(
      this.x + vector.x,
      this.y + vector.y,
      this.z + vector.z, result);
  }

  /** Return point plus vector */
  public plusXYZ(dx: number = 0, dy: number = 0, dz: number = 0, result?: Point3d): Point3d {
    return Point3d.create(
      this.x + dx,
      this.y + dy,
      this.z + dz, result);
  }
  /** Return point + vector * scalar */
  public plusScaled(vector: XYAndZ, scaleFactor: number, result?: Point3d): Point3d {
    return Point3d.create(
      this.x + vector.x * scaleFactor,
      this.y + vector.y * scaleFactor,
      this.z + vector.z * scaleFactor, result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB */
  public plus2Scaled(vectorA: XYAndZ, scalarA: number, vectorB: XYZ, scalarB: number, result?: Point3d): Point3d {
    return Point3d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB,
      this.z + vectorA.z * scalarA + vectorB.z * scalarB, result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB + vectorC * scalarC */
  public plus3Scaled(vectorA: XYAndZ, scalarA: number, vectorB: XYAndZ, scalarB: number, vectorC: XYAndZ, scalarC: number, result?: Point3d): Point3d {
    return Point3d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC,
      this.z + vectorA.z * scalarA + vectorB.z * scalarB + vectorC.z * scalarC, result);
  }
  /**
   * Return a point that is scaled from the source point.
   * @param source existing point
   * @param scale scale factor to apply to its x,y,z parts
   * @param result optional point to receive coordinates
   */
  public static createScale(source: XYAndZ, scale: number, result?: Point3d): Point3d {
    return Point3d.create(source.x * scale, source.y * scale, source.z * scale, result);
  }
  /** create a point that is a linear combination (weighted sum) of 2 input points.
   * @param pointA first input point
   * @param scaleA scale factor for pointA
   * @param pointB second input point
   * @param scaleB scale factor for pointB
   */
  public static createAdd2Scaled(pointA: XYAndZ, scaleA: number, pointB: XYAndZ, scaleB: number, result?: Point3d): Point3d {
    return Point3d.create(
      pointA.x * scaleA + pointB.x * scaleB,
      pointA.y * scaleA + pointB.y * scaleB,
      pointA.z * scaleA + pointB.z * scaleB,
      result);
  }

  /** Create a point that is a linear combination (weighted sum) of 3 input points.
   * @param pointA first input point
   * @param scaleA scale factor for pointA
   * @param pointB second input point
   * @param scaleB scale factor for pointB
   * @param pointC third input point.
   * @param scaleC scale factor for pointC
   */
  public static createAdd3Scaled(pointA: XYAndZ, scaleA: number, pointB: XYAndZ, scaleB: number, pointC: XYAndZ, scaleC: number, result?: Point3d): Point3d {
    return Point3d.create(
      pointA.x * scaleA + pointB.x * scaleB + pointC.x * scaleC,
      pointA.y * scaleA + pointB.y * scaleB + pointC.y * scaleC,
      pointA.z * scaleA + pointB.z * scaleB + pointC.z * scaleC,
      result);
  }
  /**
   * Return the dot product of vectors from this to pointA and this to pointB.
   * @param targetA target point for first vector
   * @param targetB target point for second vector
   */
  public dotVectorsToTargets(targetA: Point3d, targetB: Point3d): number {
    return (targetA.x - this.x) * (targetB.x - this.x) +
      (targetA.y - this.y) * (targetB.y - this.y) +
      (targetA.z - this.z) * (targetB.z - this.z);
  }
  /** Return the fractional projection of this onto a line between points.
   *
   */
  public fractionOfProjectionToLine(startPoint: Point3d, endPoint: Point3d, defaultFraction: number = 0): number {
    const denominator = startPoint.distanceSquared(endPoint);
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction;
    return startPoint.dotVectorsToTargets(endPoint, this) / denominator;
  }
}

/** 3D vector with x,y,z properties */
export class Vector3d extends XYZ {
  constructor(x: number = 0, y: number = 0, z: number = 0) { super(x, y, z); }

  public clone(): Vector3d { return new Vector3d(this.x, this.y, this.z); }

  public static create(x: number = 0, y: number = 0, z: number = 0, result?: Vector3d): Vector3d {
    if (result) {
      result.x = x;
      result.y = y;
      result.z = z;
      return result;
    }
    return new Vector3d(x, y, z);
  }
  /**
   * Create a vector which is cross product of two vectors supplied as separate arguments
   * @param ux x coordinate of vector u
   * @param uy y coordinate of vector u
   * @param uz z coordinate of vector u
   * @param vx x coordinate of vector v
   * @param vy y coordinate of vector v
   * @param vz z coordinate of vector v
   * @param result optional result vector.
   */
  public static createCrossProduct(
    ux: number,
    uy: number,
    uz: number,
    vx: number,
    vy: number,
    vz: number,
    result?: Vector3d): Vector3d {
    return Vector3d.create(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
      result);
  }

  /**
   * Accumulate a vector which is cross product vectors from origin (ax,ay,az) to targets (bx,by,bz) and (cx,cy,cz)
   * @param ax x coordinate of origin
   * @param ay y coordinate of origin
   * @param az z coordinate of origin
   * @param bx x coordinate of target point b
   * @param by y coordinate of target point b
   * @param bz z coordinate of target point b
   * @param cx x coordinate of target point c
   * @param cy y coordinate of target point c
   * @param cz z coordinate of target point c
   */
  public addCrossProductToTargetsInPlace(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;

    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;

    this.x += uy * vz - uz * vy;
    this.y += uz * vx - ux * vz;
    this.z += ux * vy - uy * vx;
  }

  /**
   * Return the cross product of the vectors from origin to pointA and pointB.
   *
   * * the result is a vector
   * * the result is perpendicular to both vectors, with right hand orientation
   * * the magnitude of the vector is twice the area of the triangle.
   */
  public static createCrossProductToPoints(origin: XYAndZ, pointA: XYAndZ, pointB: XYAndZ, result?: Vector3d): Vector3d {
    return Vector3d.createCrossProduct(
      pointA.x - origin.x, pointA.y - origin.y, pointA.z - origin.z,
      pointB.x - origin.x, pointB.y - origin.y, pointB.z - origin.z,
      result);
  }
  /**
   * Return a vector defined by polar coordinates distance and angle from x axis
   * @param r distance measured from origin
   * @param theta angle from x axis to the vector (in xy plane)
   * @param z optional z coordinate
   */
  public static createPolar(r: number, theta: Angle, z?: number): Vector3d {
    return Vector3d.create(r * theta.cos(), r * theta.sin(), z);
  }
  /**
   * Return a vector defined in spherical coordinates.
   * @param r sphere radius
   * @param theta angle in xy plane
   * @param phi angle from xy plane to the vector
   */
  public static createSpherical(r: number, theta: Angle, phi: Angle): Vector3d {
    const cosPhi = phi.cos();
    return Vector3d.create(
      cosPhi * r * theta.cos(),
      cosPhi * r * theta.sin(),
      phi.sin());
  }
  public static fromJSON(json?: XYZProps): Vector3d { const val = new Vector3d(); val.setFromJSON(json); return val; }

  /** Copy contents from another Point3d, Point2d, Vector2d, or Vector3d */
  public static createFrom(data: XYAndZ | XAndY | Float64Array, result?: Vector3d): Vector3d {
    if (data instanceof Float64Array) {
      if (data.length >= 3)
        return Vector3d.create(data[0], data[1], data[2]);
      if (data.length >= 2)
        return Vector3d.create(data[0], data[1], 0);
      if (data.length >= 1)
        return Vector3d.create(data[0], 0, 0);
      return Vector3d.create(0, 0, 0);
    }
    return Vector3d.create(data.x, data.y, XYZ.hasZ(data) ? data.z : 0.0, result);
  }
  /**
   * Return a vector defined by start and end points (end - start).
   * @param start start point for vector
   * @param end end point for vector
   * @param result optional result
   */
  public static createStartEnd(start: XYAndZ, end: XYAndZ, result?: Vector3d): Vector3d {
    if (result) {
      result.set(end.x - start.x, end.y - start.y, end.z - start.z);
      return result;
    }
    return new Vector3d(end.x - start.x, end.y - start.y, end.z - start.z);
  }
  /**
   * @param x0 start point x coordinate
   * @param y0 start point y coordinate
   * @param z0 start point z coordinate
   * @param x1 end point x coordinate
   * @param y1 end point y coordinate
   * @param z1 end point z coordinate
   * @param result optional result vector
   */
  public static createStartEndXYZXYZ(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, result?: Vector3d): Vector3d {
    if (result) {
      result.set(x1 - x0, y1 - y0, z1 - z0);
      return result;
    }
    return new Vector3d(x1 - x0, y1 - y0, z1 - z0);
  }
  /**
   * Return a vector which is the input vector rotated around the axis vector.
   * @param vector initial vector
   * @param axis axis of rotation
   * @param angle angle of rotation.  If undefined, 90 degrees is implied
   * @param result optional result vector
   */
  public static createRotateVectorAroundVector(vector: Vector3d, axis: Vector3d, angle?: Angle): Vector3d | undefined {
    // Rodriguez formula, https://en.wikipedia.org/wiki/Rodrigues'_rotation_formula
    const unitAxis = axis.normalize();
    if (unitAxis) {
      const xProduct = unitAxis.crossProduct(vector);
      if (angle) {
        const c = angle.cos();
        const s = angle.sin();
        return Vector3d.createAdd3Scaled(vector, c, xProduct, s, unitAxis, unitAxis.dotProduct(vector) * (1.0 - c));
      } else {
        // implied c = 0, s = 1 . . .
        return vector.plusScaled(unitAxis, unitAxis.dotProduct(vector));
      }
    }
    // unchanged vector if axis is null
    return undefined;
  }
  /**
   * Set (replace) xzz components so they are a vector from point0 to point1
   * @param point0 start point of computed vector
   * @param point1 end point of computed vector.
   */
  public setStartEnd(point0: XYAndZ, point1: XYAndZ) {
    this.x = point1.x - point0.x;
    this.y = point1.y - point0.y;
    this.z = point1.z - point0.z;
  }

  /** Return a vector with 000 xyz parts. */
  public static createZero(result?: Vector3d): Vector3d { return Vector3d.create(0, 0, 0, result); }

  /** Return a unit X vector optionally multiplied by a scale  */
  public static unitX(scale: number = 1): Vector3d { return new Vector3d(scale, 0, 0); }
  /** Return a unit Y vector  */
  public static unitY(scale: number = 1): Vector3d { return new Vector3d(0, scale, 0); }
  /** Return a unit Z vector  */
  public static unitZ(scale: number = 1): Vector3d { return new Vector3d(0, 0, scale); }

  /** Divide by denominator, but return undefined if denominator is zero. */
  public safeDivideOrNull(denominator: number, result?: Vector3d): Vector3d | undefined {
    if (denominator !== 0.0) {
      return this.scale(1.0 / denominator, result);
    }
    return undefined;
  }
  /**
   * Return a pair object containing (a) property `v` which is a unit vector in the direction
   * of the input and (b) property mag which is the magnitude (length) of the input (instance) prior to normalization.
   * If the instance (input) is a near zero length the `v` property of the output is undefined.
   * @param result optional result.
   */
  public normalizeWithLength(result?: Vector3d): { v: Vector3d | undefined, mag: number } {
    const magnitude = Geometry.correctSmallMetricDistance(this.magnitude());
    result = result ? result : new Vector3d();
    return { v: this.safeDivideOrNull(magnitude, result), mag: magnitude };
  }
  /**
   * Return a unit vector parallel with this.  Return undefined if this.magnitude is near zero.
   * @param result optional result.
   */
  public normalize(result?: Vector3d): Vector3d | undefined { return this.normalizeWithLength(result).v; }
  /**
   * If this vector has nonzero length, divide by the length to change to a unit vector.
   * @returns true if normalization completed.
   */
  public normalizeInPlace(): boolean {
    const a = Geometry.inverseMetricDistance(this.magnitude());
    if (!a) return false;
    this.x *= a; this.y *= a; this.z *= a;
    return true;
  }

  /** Return the fractional projection of spaceVector onto this */
  public fractionOfProjectionToVector(target: Vector3d, defaultFraction: number = 0): number {
    const numerator = this.dotProduct(target);
    const denominator = target.magnitudeSquared();
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction;
    return numerator / denominator;
  }

  /** Return a new vector with components negated from the calling instance.
   * @param result optional result vector.
   */
  public negate(result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = -this.x;
    result.y = -this.y;
    result.z = -this.z;
    return result;
  }

  /** Return a vector same length as this but rotate 90 degrees CCW */
  public rotate90CCWXY(result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    // save x,y to allow aliasing ..
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    result.z = this.z;
    return result;
  }

  public unitPerpendicularXY(result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    result.z = 0.0;
    const d2: number = xx * xx + yy * yy;
    if (d2 !== 0.0) {
      const a = 1.0 / Math.sqrt(d2);
      result.x *= a;
      result.y *= a;
    }
    return result;
  }

  public rotateXY(angle: Angle, result?: Vector3d): Vector3d {
    const s = angle.sin();
    const c = angle.cos();
    const xx: number = this.x;
    const yy: number = this.y;
    result = result ? result : new Vector3d();
    result.x = xx * c - yy * s;
    result.y = xx * s + yy * c;
    result.z = this.z;
    return result;
  }

  public rotate90Towards(target: Vector3d, result?: Vector3d): Vector3d | undefined {
    const normal = this.crossProduct(target).normalize();
    return normal ? normal.crossProduct(this, result) : undefined;
  }

  public rotate90Around(axis: Vector3d, result?: Vector3d): Vector3d | undefined {
    const unitNormal = axis.normalize();

    return unitNormal ? unitNormal.crossProduct(this).plusScaled(unitNormal, unitNormal.dotProduct(this), result) : undefined;
  }

  // Adding vectors
  public interpolate(fraction: number, right: Vector3d, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    if (fraction <= 0.5) {
      result.x = this.x + fraction * (right.x - this.x);
      result.y = this.y + fraction * (right.y - this.y);
      result.z = this.z + fraction * (right.z - this.z);
    } else {
      const t: number = fraction - 1.0;
      result.x = right.x + t * (right.x - this.x);
      result.y = right.y + t * (right.y - this.y);
      result.z = right.z + t * (right.z - this.z);
    }
    return result;
  }

  public plus(vector: XYAndZ, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x + vector.x;
    result.y = this.y + vector.y;
    result.z = this.z + vector.z;
    return result;
  }

  public minus(vector: XYAndZ, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x - vector.x;
    result.y = this.y - vector.y;
    result.z = this.z - vector.z;
    return result;
  }

  /** Return vector + vector * scalar */
  public plusScaled(vector: XYAndZ, scaleFactor: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x + vector.x * scaleFactor;
    result.y = this.y + vector.y * scaleFactor;
    result.z = this.z + vector.z * scaleFactor;
    return result;
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB */
  public plus2Scaled(vectorA: XYAndZ, scalarA: number, vectorB: XYAndZ, scalarB: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB;
    result.z = this.z + vectorA.z * scalarA + vectorB.z * scalarB;
    return result;
  }

  /** Return `point + vectorA * scalarA + vectorB * scalarB + vectorC * scalarC` */
  public plus3Scaled(vectorA: XYAndZ, scalarA: number, vectorB: XYAndZ, scalarB: number, vectorC: XYAndZ, scalarC: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC;
    result.z = this.z + vectorA.z * scalarA + vectorB.z * scalarB + vectorC.z * scalarC;
    return result;
  }

  /** Return `point + vectorA * scalarA + vectorB * scalarB` */
  public static createAdd2Scaled(vectorA: XYAndZ, scaleA: number, vectorB: XYAndZ, scaleB: number, result?: Vector3d): Vector3d {
    return Vector3d.create(
      vectorA.x * scaleA + vectorB.x * scaleB,
      vectorA.y * scaleA + vectorB.y * scaleB,
      vectorA.z * scaleA + vectorB.z * scaleB,
      result);
  }

  /** Return `point + vectorA * scalarA + vectorB * scalarB` with all components presented as numbers */
  public static createAdd2ScaledXYZ(ax: number, ay: number, az: number, scaleA: number, bx: number, by: number, bz: number, scaleB: number, result?: Vector3d): Vector3d {
    return Vector3d.create(
      ax * scaleA + bx * scaleB,
      ay * scaleA + by * scaleB,
      az * scaleA + bz * scaleB,
      result);
  }

  public static createAdd3Scaled(vectorA: XYAndZ, scaleA: number, vectorB: XYAndZ, scaleB: number, vectorC: XYAndZ, scaleC: number, result?: Vector3d): Vector3d {
    return Vector3d.create(
      vectorA.x * scaleA + vectorB.x * scaleB + vectorC.x * scaleC,
      vectorA.y * scaleA + vectorB.y * scaleB + vectorC.y * scaleC,
      vectorA.z * scaleA + vectorB.z * scaleB + vectorC.z * scaleC,
      result);
  }

  /** Return vector * scalar */
  public scale(scale: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.x * scale;
    result.y = this.y * scale;
    result.z = this.z * scale;
    return result;
  }

  public scaleToLength(length: number, result?: Vector3d): Vector3d {
    const mag = Geometry.correctSmallMetricDistance(this.magnitude());
    if (mag === 0)
      return new Vector3d();
    return this.scale(length / mag, result);
  }

  public unitCrossProduct(vectorB: Vector3d, result?: Vector3d): Vector3d | undefined {
    return this.crossProduct(vectorB, result).normalize(result);
  }

  public unitCrossProductWithDefault(vectorB: Vector3d, x: number, y: number, z: number, result?: Vector3d): Vector3d {
    const unit = this.crossProduct(vectorB, result).normalize(result);
    if (unit === undefined)
      return Vector3d.create(x, y, z, result);
    return unit;
  }

  public normalizeWithDefault(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    const unit = this.normalize(result);
    if (unit)
      return unit;
    return Vector3d.create(x, y, z, result);
  }

  public tryNormalizeInPlace(smallestMagnitude: number = Geometry.smallMetricDistance): boolean {
    const a = this.magnitude();
    if (a < smallestMagnitude || a === 0.0)
      return false;
    this.scaleInPlace(1.0 / a);
    return true;
  }

  public sizedCrossProduct(vectorB: Vector3d, productLength: number, result?: Vector3d): Vector3d | undefined {
    result = this.crossProduct(vectorB, result);
    if (result.tryNormalizeInPlace()) {
      result.scaleInPlace(productLength);
      return result;
    }
    return undefined;
  }

  // products
  public crossProductMagnitudeSquared(vectorB: Vector3d): number {
    const xx = this.y * vectorB.z - this.z * vectorB.y;
    const yy = this.z * vectorB.x - this.x * vectorB.z;
    const zz = this.x * vectorB.y - this.y * vectorB.x;
    return xx * xx + yy * yy + zz * zz;
  }

  public crossProductMagnitude(vectorB: Vector3d): number {
    return Math.sqrt(this.crossProductMagnitudeSquared(vectorB));
  }

  public dotProduct(vectorB: XYAndZ): number {
    return this.x * vectorB.x + this.y * vectorB.y + this.z * vectorB.z;
  }
  /** Dot product with vector from pointA to pointB */
  public dotProductStartEnd(pointA: Point3d, pointB: Point3d): number {
    return this.x * (pointB.x - pointA.x)
      + this.y * (pointB.y - pointA.y)
      + this.z * (pointB.z - pointA.z);
  }

  /** Cross product with vector from pointA to pointB */
  public crossProductStartEnd(pointA: Point3d, pointB: Point3d, result?: Vector3d): Vector3d {
    return Vector3d.createCrossProduct(this.x, this.y, this.z,
      pointB.x - pointA.x,
      pointB.y - pointA.y,
      pointB.z - pointA.z, result);
  }

  /** Cross product (xy parts only) with vector from pointA to pointB */
  public crossProductStartEndXY(pointA: Point3d, pointB: Point3d): number {
    return Geometry.crossProductXYXY(this.x, this.y,
      pointB.x - pointA.x, pointB.y - pointA.y);
  }

  /** Dot product with vector from pointA to pointB, with pointB given as x,y,z */
  public dotProductStartEndXYZ(pointA: Point3d, x: number, y: number, z: number): number {
    return this.x * (x - pointA.x)
      + this.y * (y - pointA.y)
      + this.z * (z - pointA.z);
  }

  /** Dot product with vector from pointA to pointB, with pointB given as (weighted) x,y,z,w
   * * pointB is a homogeneous point that has to be unweighted
   * * if the weight is near zero metric, the return is zero.
   */
  public dotProductStartEndXYZW(pointA: Point3d, x: number, y: number, z: number, w: number): number {
    if (Geometry.isSmallMetricDistance(w))
      return 0.0;
    const dw = 1.0 / w;
    return this.x * (dw * x - pointA.x)
      + this.y * (dw * y - pointA.y)
      + this.z * (dw * z - pointA.z);
  }
  /** Return the dot product of the instance and vectorB, using only the x and y parts. */
  public dotProductXY(vectorB: Vector3d): number {
    return this.x * vectorB.x + this.y * vectorB.y;
  }
  /**
   * Dot product with vector (x,y,z)
   * @param x x component for dot product
   * @param y y component for dot product
   * @param z z component for dot product
   */
  public dotProductXYZ(x: number, y: number, z: number = 0): number {
    return this.x * x + this.y * y + this.z * z;
  }

  /** Return the triple product of the instance, vectorB, and vectorC  */
  public tripleProduct(vectorB: Vector3d, vectorC: Vector3d): number {
    return Geometry.tripleProduct(this.x, this.y, this.z,
      vectorB.x, vectorB.y, vectorB.z,
      vectorC.x, vectorC.y, vectorC.z);
  }

  /** Return the cross product of the instance and vectorB, using only the x and y parts. */
  public crossProductXY(vectorB: Vector3d): number {
    return this.x * vectorB.y - this.y * vectorB.x;
  }
  public crossProduct(vectorB: Vector3d, result?: Vector3d): Vector3d {
    return Vector3d.createCrossProduct(
      this.x, this.y, this.z,
      vectorB.x, vectorB.y, vectorB.z, result);
  }
  // angles
  public angleTo(vectorB: Vector3d): Angle {
    return Angle.createAtan2(this.crossProductMagnitude(vectorB), this.dotProduct(vectorB));
  }

  public angleToXY(vectorB: Vector3d): Angle {
    return Angle.createAtan2(this.crossProductXY(vectorB), this.dotProductXY(vectorB));
  }

  public planarRadiansTo(vector: Vector3d, planeNormal: Vector3d): number {
    const square = planeNormal.dotProduct(planeNormal);
    if (square === 0.0)
      return 0.0;

    const factor = 1.0 / square;
    const projection0: Vector3d = this.plusScaled(planeNormal, - this.dotProduct(planeNormal) * factor);
    const projection1: Vector3d = vector.plusScaled(planeNormal, - vector.dotProduct(planeNormal) * factor);
    return projection0.signedRadiansTo(projection1, planeNormal);
  }
  public planarAngleTo(vector: Vector3d, planeNormal: Vector3d): Angle {
    return Angle.createRadians(this.planarRadiansTo(vector, planeNormal));
  }

  public signedRadiansTo(vector1: Vector3d, vectorW: Vector3d): number {
    const p = this.crossProduct(vector1);
    const theta = Math.atan2(p.magnitude(), this.dotProduct(vector1));

    if (vectorW.dotProduct(p) < 0.0)
      return - theta;
    else
      return theta;
  }

  public signedAngleTo(vector1: Vector3d, vectorW: Vector3d): Angle { return Angle.createRadians(this.signedRadiansTo(vector1, vectorW)); }
  /*  smallerUnorientedAngleTo(vectorB: Vector3d): Angle { }
    signedAngleTo(vectorB: Vector3d, upVector: Vector3d): Angle { }
    // sectors
    isInSmallerSector(vectorA: Vector3d, vectorB: Vector3d): boolean { }
    isInCCWSector(vectorA: Vector3d, vectorB: Vector3d, upVector: Vector3d): boolean { }
    */
  /**
   * Test if this vector is parallel to other.
   * @param other second vector in comparison
   * @param oppositeIsParallel if the vectors are on the same line but in opposite directions, return this value.
   * @param returnValueIfAnInputIsZeroLength if either vector is near zero length, return this value.
   */
  public isParallelTo(other: Vector3d, oppositeIsParallel: boolean = false, returnValueIfAnInputIsZeroLength: boolean = false): boolean {
    const a2 = this.magnitudeSquared();
    const b2 = other.magnitudeSquared();
    // we know both are 0 or positive -- no need for
    if (a2 < Geometry.smallMetricDistanceSquared || b2 < Geometry.smallMetricDistanceSquared)
      return returnValueIfAnInputIsZeroLength;

    const dot = this.dotProduct(other);
    if (dot < 0.0 && !oppositeIsParallel)
      return returnValueIfAnInputIsZeroLength;

    const cross2 = this.crossProductMagnitudeSquared(other);

    /* a2,b2,cross2 are squared lengths of respective vectors */
    /* cross2 = sin^2(theta) * a2 * b2 */
    /* For small theta, sin^2(theta)~~theta^2 */
    return cross2 <= Geometry.smallAngleRadiansSquared * a2 * b2;
  }
  /**
   * Test if this vector is perpendicular to other.
   * @param other second vector in comparison
   * @param returnValueIfAnInputIsZeroLength if either vector is near zero length, return this value.
   */
  public isPerpendicularTo(other: Vector3d, returnValueIfAnInputIsZeroLength: boolean = false): boolean {
    const aa = this.magnitudeSquared();
    if (aa < Geometry.smallMetricDistanceSquared)
      return returnValueIfAnInputIsZeroLength;
    const bb = other.magnitudeSquared();
    if (bb < Geometry.smallMetricDistanceSquared)
      return returnValueIfAnInputIsZeroLength;
    const ab = this.dotProduct(other);

    return ab * ab <= Geometry.smallAngleRadiansSquared * aa * bb;
  }
}

export class Segment1d {
  public x0: number;
  public x1: number;
  private constructor(x0: number, x1: number) {
    this.x0 = x0;
    this.x1 = x1;
  }
  public set(x0: number, x1: number) { this.x0 = x0, this.x1 = x1; }
  public static create(x0: number = 0, x1: number = 1, result?: Segment1d): Segment1d {
    if (!result) return new Segment1d(x0, x1);
    result.set(x0, x1);
    return result;
  }
  public setFrom(other: Segment1d) { this.x0 = other.x0; this.x1 = other.x1; }
  public clone(): Segment1d { return new Segment1d(this.x0, this.x1); }
  public fractionToPoint(fraction: number): number { return Geometry.interpolate(this.x0, fraction, this.x1); }
  public reverseInPlace(): void { const x = this.x0; this.x0 = this.x1; this.x1 = x; }
  /**
   * Near equality test, using Geometry.isSameCoordinate for tolerances.
   */
  public isAlmostEqual(other: Segment1d): boolean {
    return Geometry.isSameCoordinate(this.x0, other.x0) && Geometry.isSameCoordinate(this.x1, other.x1);
  }
  /**
   * Return true if the segment limits are (exactly) 0 and 1
   */
  public get isExact01(): boolean { return this.x0 === 0.0 && this.x1 === 1.0; }
}

/** The properties that define [[YawPitchRollAngles]]. */
export interface YawPitchRollProps {
  yaw?: AngleProps;
  pitch?: AngleProps;
  roll?: AngleProps;
}

/** Three angles that determine the orientation of an object in space. Sometimes referred to as [Tait–Bryan angles](https://en.wikipedia.org/wiki/Euler_angles). */
export class YawPitchRollAngles {
  public yaw: Angle;
  public pitch: Angle;
  public roll: Angle;
  constructor(yaw: Angle = Angle.zero(), pitch: Angle = Angle.zero(), roll: Angle = Angle.zero()) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
  }

  /** Freeze this YawPitchRollAngles */
  public freeze() { Object.freeze(this.yaw); Object.freeze(this.pitch); Object.freeze(this.roll); }

  /** constructor for YawPitchRollAngles with angles in degrees. */
  public static createDegrees(yawDegrees: number, pitchDegrees: number, rollDegrees: number): YawPitchRollAngles {
    return new YawPitchRollAngles(
      Angle.createDegrees(yawDegrees),
      Angle.createDegrees(pitchDegrees),
      Angle.createDegrees(rollDegrees));
  }
  /** constructor for YawPitchRollAngles with angles in radians. */
  public static createRadians(yawRadians: number, pitchRadians: number, rollRadians: number): YawPitchRollAngles {
    return new YawPitchRollAngles(
      Angle.createRadians(yawRadians),
      Angle.createRadians(pitchRadians),
      Angle.createRadians(rollRadians));
  }

  public static fromJSON(json?: YawPitchRollProps): YawPitchRollAngles {
    json = json ? json : {};
    return new YawPitchRollAngles(Angle.fromJSON(json.yaw), Angle.fromJSON(json.pitch), Angle.fromJSON(json.roll));
  }
  public setFromJSON(json?: YawPitchRollProps): void {
    json = json ? json : {};
    this.yaw = Angle.fromJSON(json.yaw);
    this.pitch = Angle.fromJSON(json.pitch);
    this.roll = Angle.fromJSON(json.roll);
  }
  /** Convert to a JSON object of form { pitch: 20 , roll: 29.999999999999996 , yaw: 10 }. Any values that are exactly zero (with tolerance `Geometry.smallAngleRadians`) are omitted. */
  public toJSON(): YawPitchRollProps {
    const val: YawPitchRollProps = {};
    if (!this.pitch.isAlmostZero) val.pitch = this.pitch.toJSON();
    if (!this.roll.isAlmostZero) val.roll = this.roll.toJSON();
    if (!this.yaw.isAlmostZero) val.yaw = this.yaw.toJSON();
    return val;
  }
  /**
   * Install all rotations from `other` into `this`.
   * @param other YawPitchRollAngles source
   */
  public setFrom(other: YawPitchRollAngles) {
    this.yaw.setFrom(other.yaw);
    this.pitch.setFrom(other.pitch);
    this.roll.setFrom(other.roll);
  }
  /**
   * * Compare angles between `this` and `other`.
   * * Comparisons are via `isAlmostEqualAllowPeriodShift`.
   * @param other YawPitchRollAngles source
   */
  public isAlmostEqual(other: YawPitchRollAngles) {
    return this.yaw.isAlmostEqualAllowPeriodShift(other.yaw)
      && this.pitch.isAlmostEqualAllowPeriodShift(other.pitch)
      && this.roll.isAlmostEqualAllowPeriodShift(other.roll);
  }
  /**
   * Make a copy of this YawPitchRollAngles.
   */
  public clone() { return new YawPitchRollAngles(this.yaw.clone(), this.pitch.clone(), this.roll.clone()); }
  /**
   * Expand the angles into a (rigid rotation) matrix.
   *
   * * The returned matrix is "rigid" -- unit length rows and columns, and its transpose is its inverse.
   * * The "rigid" matrix is always a right handed coordinate system.
   * @param result optional pre-allocated `Matrix3d`
   */
  public toMatrix3d(result?: Matrix3d) {
    const c0 = Math.cos(this.yaw.radians);
    const s0 = Math.sin(this.yaw.radians);
    const c1 = Math.cos(this.pitch.radians);
    const s1 = Math.sin(this.pitch.radians);
    const c2 = Math.cos(this.roll.radians);
    const s2 = Math.sin(this.roll.radians);
    return Matrix3d.createRowValues
      (
      c0 * c1, -(s0 * c2 + c0 * s1 * s2), (s0 * s2 - c0 * s1 * c2),
      s0 * c1, (c0 * c2 - s0 * s1 * s2), -(c0 * s2 + s0 * s1 * c2),
      s1, c1 * s2, c1 * c2,
      result,
      );
  }
  /** @returns Return the largest angle in radians */
  public maxAbsRadians(): number {
    return Geometry.maxAbsXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }

  /** Return the sum of the angles in squared radians */
  public sumSquaredRadians(): number {
    return Geometry.hypotenuseSquaredXYZ(this.yaw.radians, this.pitch.radians, this.roll.radians);
  }
  /** @returns true if the rotation is 0 */
  public isIdentity(allowPeriodShift: boolean = true): boolean {
    if (allowPeriodShift)
      return Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.yaw.radians)
        && Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.pitch.radians)
        && Angle.isAlmostEqualRadiansAllowPeriodShift(0.0, this.roll.radians);
    else
      return Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.yaw.radians)
        && Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.pitch.radians)
        && Angle.isAlmostEqualRadiansNoPeriodShift(0.0, this.roll.radians);
  }
  /** Return the largest difference of angles (in radians) between this and other */
  public maxDiffRadians(other: YawPitchRollAngles): number {
    return Math.max
      (
      this.yaw.radians - other.yaw.radians,
      this.pitch.radians - other.pitch.radians,
      this.roll.radians - other.roll.radians,
      );
  }
  /** Return the largest angle in degrees. */
  public maxAbsDegrees(): number { return Geometry.maxAbsXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees); }
  /** Return the sum of squared angles in degrees. */
  public sumSquaredDegrees(): number { return Geometry.hypotenuseSquaredXYZ(this.yaw.degrees, this.pitch.degrees, this.roll.degrees); }
  /** Return an object from a Transform as an origin and YawPitchRollAngles. */
  public static tryFromTransform(transform: Transform): { origin: Point3d, angles: YawPitchRollAngles | undefined } {
    // bundle up the transform's origin with the angle data extracted from the transform
    return {
      angles: YawPitchRollAngles.createFromMatrix3d(transform.matrix),
      origin: Point3d.createFrom(transform.origin),
    };
  }

  /** Attempts to create a YawPitchRollAngles object from an Matrix3d
   * * This conversion fails if the matrix is not rigid (unit rows and columns, transpose is inverse)
   * * In the failure case the method's return value is `undefined`.
   * * In the failure case, if the optional result was supplied, that result will nonetheless be filled with a set of angles.
   */
  public static createFromMatrix3d(matrix: Matrix3d, result?: YawPitchRollAngles): YawPitchRollAngles | undefined {
    const s1 = matrix.at(2, 0);
    const c1 = Math.sqrt(matrix.at(2, 1) * matrix.at(2, 1) + matrix.at(2, 2) * matrix.at(2, 2));

    const pitchA = Angle.createAtan2(s1, c1); // with positive cosine
    const pitchB = Angle.createAtan2(s1, -c1); // with negative cosine
    const angles = result ? result : new YawPitchRollAngles(); // default undefined . . .
    if (c1 < Geometry.smallAngleRadians) { // This is a radians test !!!
      angles.yaw = Angle.createAtan2(-matrix.at(0, 1), matrix.at(1, 1));
      angles.pitch = pitchA;
      angles.roll = Angle.createRadians(0.0);
    } else {
      const yawA = Angle.createAtan2(matrix.at(1, 0), matrix.at(0, 0));
      const rollA = Angle.createAtan2(matrix.at(2, 1), matrix.at(2, 2));

      const yawB = Angle.createAtan2(-matrix.at(1, 0), -matrix.at(0, 0));
      const rollB = Angle.createAtan2(-matrix.at(2, 1), -matrix.at(2, 2));

      const yprA = new YawPitchRollAngles(yawA, pitchA, rollA);
      const yprB = new YawPitchRollAngles(yawB, pitchB, rollB);

      const absFactor = 0.95;
      const radiansA = yprA.maxAbsRadians();
      const radiansB = yprB.maxAbsRadians();

      if (radiansA < absFactor * radiansB) {
        angles.setFrom(yprA);
      } else if (radiansB < absFactor * radiansA) {
        angles.setFrom(yprB);
      } else {
        const sumA = yprA.sumSquaredRadians();
        const sumB = yprB.sumSquaredRadians();
        if (sumA <= sumB) {
          angles.setFrom(yprA);
        } else {
          angles.setFrom(yprB);
        }
      }
    }
    const matrix1 = angles.toMatrix3d();
    return matrix.maxDiff(matrix1) < Geometry.smallAngleRadians ? angles : undefined;
  }

}

export class Point2d extends XY implements BeJSONFunctions {
  /** Constructor for Point2d */
  constructor(x: number = 0, y: number = 0) { super(x, y); }
  public clone(): Point2d { return new Point2d(this.x, this.y); }

  /**
   * Return a point (newly created unless result provided) with given x,y coordinates
   * @param x x coordinate
   * @param y y coordinate
   * @param result optional result
   */
  public static create(x: number = 0, y: number = 0, result?: Point2d): Point2d {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Point2d(x, y);
  }
  public static fromJSON(json?: XYProps): Point2d { const val = new Point2d(); val.setFromJSON(json); return val; }

  public static createFrom(xy: XAndY | undefined, result?: Point2d): Point2d {
    if (xy)
      return Point2d.create(xy.x, xy.y, result);
    return Point2d.create(0, 0, result);
  }

  public static createZero(result?: Point2d): Point2d { return Point2d.create(0, 0, result); }

  public addForwardLeft(tangentFraction: number, leftFraction: number, vector: Vector2d): Point2d {
    const dx = vector.x;
    const dy = vector.y;
    return Point2d.create(this.x + tangentFraction * dx - leftFraction * dy,
      this.y + tangentFraction * dy + leftFraction * dx);
  }

  public forwardLeftInterpolate(tangentFraction: number, leftFraction: number, point: XAndY): Point2d {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    return Point2d.create(
      this.x + tangentFraction * dx - leftFraction * dy,
      this.y + tangentFraction * dy + leftFraction * dx);
  }

  /** Return a point interpolated between this point and the right param. */
  public interpolate(fraction: number, other: XAndY, result?: Point2d): Point2d {
    if (fraction <= 0.5)
      return Point2d.create(
        this.x + fraction * (other.x - this.x),
        this.y + fraction * (other.y - this.y),
        result);
    const t: number = fraction - 1.0;
    return Point2d.create(
      other.x + t * (other.x - this.x),
      other.y + t * (other.y - this.y),
      result);
  }

  /** Return a point with independent x,y fractional interpolation. */
  public interpolateXY(fractionX: number, fractionY: number, other: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      Geometry.interpolate(this.x, fractionX, other.x),
      Geometry.interpolate(this.y, fractionY, other.y),
      result);
  }

  /** Return point minus vector */
  public minus(vector: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      this.x - vector.x,
      this.y - vector.y,
      result);
  }

  /** Return point plus vector */
  public plus(vector: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vector.x,
      this.y + vector.y,
      result);
  }
  /** Return point plus vector */
  public plusXY(dx: number = 0, dy: number = 0, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + dx,
      this.y + dy, result);
  }

  /** Return point + vector * scalar */
  public plusScaled(vector: XAndY, scaleFactor: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vector.x * scaleFactor,
      this.y + vector.y * scaleFactor,
      result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB */
  public plus2Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB,
      result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB + vectorC * scalarC */
  public plus3Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, vectorC: XAndY, scalarC: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC,
      result);
  }
  /**
   * @returns dot product of vector from this to targetA and vector from this to targetB
   * @param targetA target of first vector
   * @param targetB target of second vector
   */
  public dotVectorsToTargets(targetA: XAndY, targetB: XAndY): number {
    return (targetA.x - this.x) * (targetB.x - this.x) +
      (targetA.y - this.y) * (targetB.y - this.y);
  }

  /** Returns the (scalar) cross product of two points/vectors, computed from origin to target1 and target2 */
  public crossProductToPoints(target1: XAndY, target2: XAndY): number {
    const x1 = target1.x - this.x;
    const y1 = target1.y - this.y;
    const x2 = target2.x - this.x;
    const y2 = target2.y - this.y;
    return x1 * y2 - y1 * x2;
  }

  public fractionOfProjectionToLine(startPoint: Point2d, endPoint: Point2d, defaultFraction?: number): number {
    const denominator = startPoint.distanceSquared(endPoint);
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction ? defaultFraction : 0;
    return startPoint.dotVectorsToTargets(endPoint, this) / denominator;
  }
}
/** 3D vector with x,y properties */
export class Vector2d extends XY implements BeJSONFunctions {
  constructor(x: number = 0, y: number = 0) { super(x, y); }
  public clone(): Vector2d { return new Vector2d(this.x, this.y); }

  public static create(x: number = 0, y: number = 0, result?: Vector2d): Vector2d {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Vector2d(x, y);
  }

  // unit X vector
  public static unitX(scale: number = 1): Vector2d { return new Vector2d(scale, 0); }

  // unit Y vector
  public static unitY(scale: number = 1): Vector2d { return new Vector2d(0, scale); }

  // zero vector
  public static createZero(result?: Vector2d): Vector2d { return Vector2d.create(0, 0, result); }

  /** copy contents from another Point3d, Point2d, Vector2d, or Vector3d */
  public static createFrom(data: XAndY | Float64Array, result?: Vector2d): Vector2d {
    if (data instanceof Float64Array) {
      if (data.length >= 2)
        return Vector2d.create(data[0], data[1]);
      if (data.length >= 1)
        return Vector2d.create(data[0], 0);
      return Vector2d.create(0, 0);
    }
    return Vector2d.create(data.x, data.y, result);
  }

  public static fromJSON(json?: XYProps): Vector2d { const val = new Vector2d(); val.setFromJSON(json); return val; }

  public static createPolar(r: number, theta: Angle): Vector2d {
    return Vector2d.create(r * theta.cos());
  }

  public static createStartEnd(point0: XAndY, point1: XAndY, result?: Vector2d): Vector2d {
    if (result) {
      result.set(point1.x - point0.x, point1.y - point0.y);
      return result;
    }
    return new Vector2d(point1.x - point0.x, point1.y - point0.y);
  }
  /**
   * Return a vector that bisects the angle between two normals and extends to the intersection of two offset lines
   * @param unitPerpA unit perpendicular to incoming direction
   * @param unitPerpB  unit perpendicular to outgoing direction
   * @param offset offset distance
   */
  public static createOffsetBisector(unitPerpA: Vector2d, unitPerpB: Vector2d, offset: number): Vector2d | undefined {
    let bisector: Vector2d | undefined = unitPerpA.plus(unitPerpB);
    bisector = bisector.normalize();
    if (bisector) {
      const c = offset * bisector.dotProduct(unitPerpA);
      return bisector.safeDivideOrNull(c);
    }
    return undefined;
  }

  // Divide by denominator, but return undefined if denominator is zero.
  public safeDivideOrNull(denominator: number, result?: Vector2d): Vector2d | undefined {
    if (denominator !== 0.0) {
      return this.scale(1.0 / denominator, result);
    }
    return undefined;
  }

  public normalize(result?: Vector2d): Vector2d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.magnitude());
    result = result ? result : new Vector2d();
    return this.safeDivideOrNull(mag, result);
  }

  /** return the fractional projection of spaceVector onto this */
  public fractionOfProjectionToVector(target: Vector2d, defaultFraction?: number): number {
    const numerator = this.dotProduct(target);
    const denominator = target.magnitudeSquared();
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction ? defaultFraction : 0;
    return numerator / denominator;
  }

  /** Negate components */
  public negate(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = -this.x;
    result.y = -this.y;
    return result;
  }

  // return a vector same length as this but rotate 90 degrees CCW
  public rotate90CCWXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    // save x,y to allow aliasing ..
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    return result;
  }

  // return a vector same length as this but rotate 90 degrees CW
  public rotate90CWXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    // save x,y to allow aliasing ..
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = yy;
    result.y = -xx;
    return result;
  }

  public unitPerpendicularXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    const d2: number = xx * xx + yy * yy;
    if (d2 !== 0.0) {
      const a = 1.0 / Math.sqrt(d2);
      result.x *= a;
      result.y *= a;
    }
    return result;
  }

  public rotateXY(angle: Angle, result?: Vector2d): Vector2d {
    const s = angle.sin();
    const c = angle.cos();
    const xx: number = this.x;
    const yy: number = this.y;
    result = result ? result : new Vector2d();
    result.x = xx * c - yy * s;
    result.y = xx * s + yy * c;
    return result;
  }

  /** return the interpolation {this + fraction * (right - this)} */
  public interpolate(fraction: number, right: Vector2d, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    /* For best last-bit behavior, if fraction is below 0.5, use this as base point.   If above 0.5, use right as base point.   */
    if (fraction <= 0.5) {
      result.x = this.x + fraction * (right.x - this.x);
      result.y = this.y + fraction * (right.y - this.y);
    } else {
      const t: number = fraction - 1.0;
      result.x = right.x + t * (right.x - this.x);
      result.y = right.y + t * (right.y - this.y);
    }
    return result;
  }

  /** return {this + vector}. */
  public plus(vector: XAndY, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vector.x;
    result.y = this.y + vector.y;
    return result;
  }
  /** return {this - vector}. */
  public minus(vector: XAndY, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x - vector.x;
    result.y = this.y - vector.y;
    return result;
  }

  /** Return {point + vector \* scalar} */
  public plusScaled(vector: XAndY, scaleFactor: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vector.x * scaleFactor;
    result.y = this.y + vector.y * scaleFactor;
    return result;
  }

  /** Return {point + vectorA \* scalarA + vectorB \* scalarB} */
  public plus2Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB;
    return result;
  }

  /** Return {this + vectorA \* scalarA + vectorB \* scalarB + vectorC \* scalarC} */
  public plus3Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, vectorC: XAndY, scalarC: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC;
    return result;
  }
  /** Return {this * scale} */
  public scale(scale: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x * scale;
    result.y = this.y * scale;
    return result;
  }
  /** return a vector parallel to this but with specified length */
  public scaleToLength(length: number, result?: Vector2d): Vector2d {
    const mag = Geometry.correctSmallMetricDistance(this.magnitude());
    if (mag === 0)
      return new Vector2d();
    return this.scale(length / mag, result);
  }
  /** return the dot product of this with vectorB */
  public dotProduct(vectorB: Vector2d): number { return this.x * vectorB.x + this.y * vectorB.y; }

  /** dot product with vector from pointA to pointB */
  public dotProductStartEnd(pointA: XAndY, pointB: XAndY): number {
    return this.x * (pointB.x - pointA.x)
      + this.y * (pointB.y - pointA.y);
  }

  /** vector cross product {this CROSS vectorB} */
  public crossProduct(vectorB: Vector2d): number { return this.x * vectorB.y - this.y * vectorB.x; }
  /** return the (signed) angle from this to vectorB.   This is positive if the shortest turn is counterclockwise, negative if clockwise. */
  public angleTo(vectorB: Vector2d): Angle {
    return Angle.createAtan2(this.crossProduct(vectorB), this.dotProduct(vectorB));
  }

  /*  smallerUnorientedAngleTo(vectorB: Vector2d): Angle { }
    signedAngleTo(vectorB: Vector2d, upVector: Vector2d): Angle { }
    planarAngleTo(vectorB: Vector2d, planeNormal: Vector2d): Angle { }
    // sectors
    isInSmallerSector(vectorA: Vector2d, vectorB: Vector2d): boolean { }
    isInCCWSector(vectorA: Vector2d, vectorB: Vector2d, upVector: Vector2d): boolean { }
    */
  public isParallelTo(other: Vector2d, oppositeIsParallel: boolean = false): boolean {
    const a2 = this.magnitudeSquared();
    const b2 = other.magnitudeSquared();
    // we know both are 0 or positive -- no need for
    if (a2 < Geometry.smallMetricDistanceSquared || b2 < Geometry.smallMetricDistanceSquared)
      return false;

    const dot = this.dotProduct(other);
    if (dot < 0.0 && !oppositeIsParallel)
      return false;

    const cross = this.crossProduct(other);

    /* a2,b2,cross2 are squared lengths of respective vectors */
    /* cross2 = sin^2(theta) * a2 * b2 */
    /* For small theta, sin^2(theta)~~theta^2 */
    return cross * cross <= Geometry.smallAngleRadiansSquared * a2 * b2;
  }
  /**
   * @returns `true` if `this` vector is perpendicular to `other`.
   * @param other second vector.
   */
  public isPerpendicularTo(other: Vector2d): boolean {
    return Angle.isPerpendicularDotSet(this.magnitudeSquared(), other.magnitudeSquared(), this.dotProduct(other));
  }
}
