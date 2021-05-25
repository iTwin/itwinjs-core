/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AxisOrder, BeJSONFunctions, Geometry } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Matrix3d } from "./Matrix3d";
import { Point2d } from "./Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "./Point3dVector3d";
import { Range3d } from "./Range";
import { TransformProps, XAndY, XYAndZ } from "./XYZProps";

/** A transform is an origin and a Matrix3d.
 *
 * * This describes a coordinate frame with
 * this origin, with the columns of the Matrix3d being the
 * local x,y,z axis directions.
 * *  Beware that for common transformations (e.g. scale about point,
 * rotate around line, mirror across a plane) the "fixed point" that is used
 * when describing the transform is NOT the "origin" stored in the transform.
 * Setup methods (e.g createFixedPointAndMatrix, createScaleAboutPoint)
 * take care of determining the appropriate origin coordinates.
 * @public
 */
export class Transform implements BeJSONFunctions {
  // static (one per class) vars for temporaries in computation.
  // ASSUME any user of these vars needs them only within its own scope
  // ASSUME no calls to other methods that use the same scratch.
  // When Transform was in the same file with Point3d, this was initialized right here.
  // But when split, there is a load order issue, so it has to be initialized at point-of-use
  private static _scratchPoint: Point3d;
  private _origin: XYZ;
  private _matrix: Matrix3d;
  // Constructor accepts and uses POINTER to content .. no copy here.
  private constructor(origin: XYZ, matrix: Matrix3d) { this._origin = origin; this._matrix = matrix; }

  private static _identity?: Transform;
  /** The identity Transform. Value is frozen and cannot be modified. */
  public static get identity(): Transform {
    if (undefined === this._identity) {
      this._identity = Transform.createIdentity();
      this._identity.freeze();
    }

    return this._identity;
  }
  /** Freeze this instance (and its members) so it is read-only */
  public freeze(): Readonly<this> { this._origin.freeze(); this._matrix.freeze(); return Object.freeze(this); }
  /**
   * Copy contents from other Transform into this Transform
   * @param other source transform
   */
  public setFrom(other: Transform) { this._origin.setFrom(other._origin), this._matrix.setFrom(other._matrix); }
  /** Set this Transform to be an identity. */
  public setIdentity() { this._origin.setZero(); this._matrix.setIdentity(); }
  /** Set this Transform instance from flexible inputs:
   * * Any object (such as another Transform) that has `origin` and `matrix` members accepted by Point3d.setFromJSON and Matrix3d.setFromJSON
   * * An array of 3 number arrays, each with 4 entries which are rows in a 3x4 matrix.
   * * An array of 12 numbers, each block of 4 entries as a row 3x4 matrix.
   */
  public setFromJSON(json?: TransformProps | Transform): void {
    if (json) {
      if (json instanceof Object && (json as any).origin && (json as any).matrix) {
        this._origin.setFromJSON((json as any).origin);
        this._matrix.setFromJSON((json as any).matrix);
        return;
      }
      if (Geometry.isArrayOfNumberArray(json, 3, 4)) {
        const data = json as number[][];
        this._matrix.setRowValues(
          data[0][0], data[0][1], data[0][2],
          data[1][0], data[1][1], data[1][2],
          data[2][0], data[2][1], data[2][2]);
        this._origin.set(data[0][3], data[1][3], data[2][3]);
        return;
      }
      if (Geometry.isNumberArray(json, 12)) {
        const data = json as number[];
        this._matrix.setRowValues(
          data[0], data[1], data[2],
          data[4], data[5], data[6],
          data[8], data[9], data[10]);
        this._origin.set(data[3], data[7], data[11]);
        return;
      }
    }
    this.setIdentity();
  }
  /**
   * Test for near equality with other Transform.  Comparison uses the isAlmostEqual methods on
   * the origin and matrix parts.
   * @param other Transform to compare to.
   */
  public isAlmostEqual(other: Transform): boolean { return this._origin.isAlmostEqual(other._origin) && this._matrix.isAlmostEqual(other._matrix); }

  /**
   * Test for near equality with other Transform.  Comparison uses the isAlmostEqualAllowZRotation method of Matrix3d
   * the origin and matrix parts.
   * @param other Transform to compare to.
   */
   public isAlmostEqualAllowZRotation(other: Transform): boolean { return this._origin.isAlmostEqual(other._origin) && this._matrix.isAlmostEqualAllowZRotation(other._matrix); }

   /** Return a 3 by 4 matrix containing the rows of this Transform
   * * This transform's origin is the [3] entry of the json arrays
   */
  public toJSON(): TransformProps {
    return this.toRows();
  }

  /** Return a 3 by 4 matrix containing the rows of this Transform
   * * This transform's origin is the [3] entry of the json arrays
   */
  public toRows(): number[][] {
    return [
      [this._matrix.coffs[0], this._matrix.coffs[1], this._matrix.coffs[2], this._origin.x],
      [this._matrix.coffs[3], this._matrix.coffs[4], this._matrix.coffs[5], this._origin.y],
      [this._matrix.coffs[6], this._matrix.coffs[7], this._matrix.coffs[8], this._origin.z],
    ];
  }

  /** Return a new Transform initialized by `setFromJSON (json)` */
  public static fromJSON(json?: TransformProps): Transform {
    const result = Transform.createIdentity();
    result.setFromJSON(json);
    return result;
  }
  /** Copy the contents of this transform into a new Transform (or to the result, if specified). */
  public clone(result?: Transform): Transform {
    if (result) {
      result._matrix.setFrom(this._matrix);
      result._origin.setFrom(this._origin);
      return result;
    }
    return new Transform(
      Point3d.createFrom(this._origin),
      this._matrix.clone());
  }
  /** Return a copy of this Transform, modified so that its axes are rigid
   * * The first axis direction named in axisOrder is preserved
   * * The plane of the first and second directions is preserved, and its vector in the rigid matrix has positive dot product with the corresponding vector if the instance
   * * The third named column is the cross product of the first and second.
   */
  public cloneRigid(axisOrder: AxisOrder = AxisOrder.XYZ): Transform | undefined {
    const axes0 = Matrix3d.createRigidFromMatrix3d(this.matrix, axisOrder);
    if (!axes0)
      return undefined;
    return new Transform(this.origin.cloneAsPoint3d(), axes0);
  }
  /** Create a copy with the given origin and matrix captured as the Transform origin and Matrix3d. */
  public static createRefs(origin: XYZ | undefined, matrix: Matrix3d, result?: Transform): Transform {
    if (!origin)
      origin = Point3d.createZero();
    if (result) {
      result._origin = origin;
      result._matrix = matrix;
      return result;
    }
    return new Transform(origin, matrix);
  }
  /** Create a transform with complete contents given */
  public static createRowValues(
    qxx: number, qxy: number, qxz: number, ax: number,
    qyx: number, qyy: number, qyz: number, ay: number,
    qzx: number, qzy: number, qzz: number, az: number,
    result?: Transform): Transform {
    if (result) {
      result._origin.set(ax, ay, az);
      result._matrix.setRowValues(qxx, qxy, qxz, qyx, qyy, qyz, qzx, qzy, qzz);
      return result;
    }
    return new Transform(Point3d.create(ax, ay, az), Matrix3d.createRowValues(qxx, qxy, qxz, qyx, qyy, qyz, qzx, qzy, qzz));
  }
  /** Create a transform with all zeros.
   */
  public static createZero(result?: Transform): Transform {
    return Transform.createRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, result);
  }

  /**
   * create a Transform with translation provided by x,y,z parts.
   * @param x x part of translation
   * @param y y part of translation
   * @param z z part of translation
   * @param result optional result
   * @returns new or updated transform.
   */
  public static createTranslationXYZ(x: number = 0, y: number = 0, z: number = 0, result?: Transform): Transform {
    return Transform.createRefs(Vector3d.create(x, y, z), Matrix3d.createIdentity(), result);
  }
  /** Create a matrix with specified translation part.
   * @param XYZ x,y,z parts of the translation.
   * @returns new or updated transform.
   */
  public static createTranslation(translation: XYZ, result?: Transform): Transform {
    return Transform.createRefs(translation, Matrix3d.createIdentity(), result);
  }

  /** Return a reference to the matrix within the transform.  (NOT a copy) */
  public get matrix(): Matrix3d { return this._matrix; }
  /** Return a reference to the origin within the transform.  (NOT a copy) */
  public get origin(): XYZ { return this._origin; }

  /** return a (clone of) the origin part of the transform, as a Point3d */
  public getOrigin(): Point3d { return Point3d.createFrom(this._origin); }

  /** return a (clone of) the origin part of the transform, as a Vector3d */
  public getTranslation(): Vector3d { return Vector3d.createFrom(this._origin); }

  /** test if the transform has 000 origin and identity Matrix3d */
  public get isIdentity(): boolean {
    return this._matrix.isIdentity && this._origin.isAlmostZero;
  }
  /** Return an identity transform, optionally filling existing transform.  */
  public static createIdentity(result?: Transform): Transform {
    if (result) {
      result._origin.setZero();
      result._matrix.setIdentity();
      return result;
    }
    return Transform.createRefs(Point3d.createZero(), Matrix3d.createIdentity());
  }
  /** Create by directly installing origin and matrix
   * this is a the appropriate construction when the columns of the matrix are coordinate axes of a local-to-global mapping
   * Note there is a closely related createFixedPointAndMatrix whose point input is the fixed point of the global-to-global transformation.
   */
  public static createOriginAndMatrix(origin: XYZ | undefined, matrix: Matrix3d | undefined, result?: Transform): Transform {
    if (result) {
      result._origin.setFromPoint3d(origin);
      result._matrix.setFrom(matrix);
      return result;
    }
    return Transform.createRefs(
      origin ? origin.cloneAsPoint3d() : Point3d.createZero(),
      matrix === undefined ? Matrix3d.createIdentity() : matrix.clone(), result);
  }
  /** Create by directly installing origin and columns of the matrix
   */
  public static createOriginAndMatrixColumns(origin: XYZ, vectorX: Vector3d, vectorY: Vector3d, vectorZ: Vector3d, result?: Transform): Transform {
    if (result)
      result.setOriginAndMatrixColumns(origin, vectorX, vectorY, vectorZ);
    else
      result = Transform.createRefs(Vector3d.createFrom(origin), Matrix3d.createColumns(vectorX, vectorY, vectorZ));
    return result;
  }
  /** Create by with matrix from Matrix3d.createRigidFromColumns.
   * * Has careful logic for building up optional result without allocations.
   */
  public static createRigidFromOriginAndColumns(origin: XYZ | undefined, vectorX: Vector3d, vectorY: Vector3d, axisOrder: AxisOrder, result?: Transform): Transform | undefined {
    const matrix = Matrix3d.createRigidFromColumns(vectorX, vectorY, axisOrder,
      result ? result._matrix : undefined);
    if (!matrix)
      return undefined;
    if (result) {
      // The matrix was already defined !!!
      result._origin.setFrom(origin);
      return result;
    }
    // cleanly capture the matrix and then the point ..
    result = Transform.createRefs(undefined, matrix);
    result._origin.setFromPoint3d(origin);
    return result;
  }

  /** Reinitialize by directly installing origin and columns of the matrix
   */
  public setOriginAndMatrixColumns(origin: XYZ | undefined, vectorX: Vector3d | undefined, vectorY: Vector3d | undefined, vectorZ: Vector3d | undefined) {
    if (origin !== undefined)
      this._origin.setFrom(origin);
    this._matrix.setColumns(vectorX, vectorY, vectorZ);
  }

  /** Create a transform with the specified matrix. Compute an origin (different from the given fixedPoint)
   * so that the fixedPoint maps back to itself.
   */
  public static createFixedPointAndMatrix(fixedPoint: XYAndZ | undefined, matrix: Matrix3d, result?: Transform): Transform {
    if (fixedPoint) {
      const origin = Matrix3d.xyzMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
      return Transform.createRefs(origin, matrix.clone(), result);
    }
    return Transform.createRefs(undefined, matrix.clone());
  }
  /** Create a transform with the specified matrix, acting on any `pointX `via
   * `pointY = matrix * (pointX - pointA) + pointB`
   * so that the fixedPoint maps back to itself.
   */
  public static createMatrixPickupPutdown(matrix: Matrix3d, pointA: Point3d, pointB: Point3d, result?: Transform): Transform {
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(pointB, matrix, pointA);
    return Transform.createRefs(origin, matrix.clone(), result);
  }

  /** Create a Transform which leaves the fixedPoint unchanged and
   * scales everything else around it by a single scale factor.
   */
  public static createScaleAboutPoint(fixedPoint: Point3d, scale: number, result?: Transform): Transform {
    const matrix = Matrix3d.createScale(scale, scale, scale);
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
    return Transform.createRefs(origin, matrix, result);
  }

  /** Transform the input 2d point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyPoint2d(source: XAndY, result?: Point2d): Point2d {
    return Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, source, result);
  }

  /** Transform the input 3d point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyPoint3d(point: XYAndZ, result?: Point3d): Point3d {
    return Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, point, result);
  }

  /** Transform the input object with x,y,z members */
  public multiplyXYAndZInPlace(point: XYAndZ) {
    return Matrix3d.xyzPlusMatrixTimesXYZInPlace(this._origin, this._matrix, point);
  }

  /** Transform the input point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZ(x: number, y: number, z: number = 0, result?: Point3d): Point3d {
    return Matrix3d.xyzPlusMatrixTimesCoordinates(this._origin, this._matrix, x, y, z, result);
  }
  /** Multiply a specific row of the transform times xyz. Return the (number). */
  public multiplyComponentXYZ(componentIndex: number, x: number, y: number, z: number = 0): number {
    const coffs = this._matrix.coffs;
    const i0 = 3 * componentIndex;
    return this.origin.at(componentIndex) + coffs[i0] * x + coffs[i0 + 1] * y + coffs[i0 + 2] * z;
  }
  /** Multiply a specific row of the transform times (weighted!) xyzw. Return the (number). */
  public multiplyComponentXYZW(componentIndex: number, x: number, y: number, z: number, w: number): number {
    const coffs = this._matrix.coffs;
    const i0 = 3 * componentIndex;
    return this.origin.at(componentIndex) * w +
      coffs[i0] * x + coffs[i0 + 1] * y + coffs[i0 + 2] * z;
  }

  /** Transform the input homogeneous point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    return Matrix3d.xyzPlusMatrixTimesWeightedCoordinates(this._origin, this._matrix, x, y, z, w, result);
  }
  /** Transform the input homogeneous point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZWToFloat64Array(x: number, y: number, z: number, w: number, result?: Float64Array): Float64Array {
    return Matrix3d.xyzPlusMatrixTimesWeightedCoordinatesToFloat64Array(this._origin, this._matrix, x, y, z, w, result);
  }

  /** Transform the input homogeneous point.  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyXYZToFloat64Array(x: number, y: number, z: number, result?: Float64Array): Float64Array {
    return Matrix3d.xyzPlusMatrixTimesCoordinatesToFloat64Array(this._origin, this._matrix, x, y, z, result);
  }
  /** Multiply the transposed transform (as 4x4 with 0001 row) by Point4d given as xyzw..  Return as a new point or in the pre-allocated result (if result is given) */
  public multiplyTransposeXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    const coffs = this._matrix.coffs;
    const origin = this._origin;
    return Point4d.create(
      x * coffs[0] + y * coffs[3] + z * coffs[6],
      x * coffs[1] + y * coffs[4] + z * coffs[7],
      x * coffs[2] + y * coffs[5] + z * coffs[8],
      x * origin.x + y * origin.y + z * origin.z + w,
      result);
  }

  /** for each point:  replace point by Transform*point */
  public multiplyPoint3dArrayInPlace(points: Point3d[]) {
    let point;
    for (point of points)
      Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, point, point);
  }

  /** for each point:  replace point by Transform*point */
  public multiplyPoint3dArrayArrayInPlace(chains: Point3d[][]) {
    for (const chain of chains)
      this.multiplyPoint3dArrayInPlace(chain);
  }
  /** Return product of the transform's inverse times a point. */
  public multiplyInversePoint3d(point: XYAndZ, result?: Point3d): Point3d | undefined {
    return this._matrix.multiplyInverseXYZAsPoint3d(
      point.x - this._origin.x,
      point.y - this._origin.y,
      point.z - this._origin.z,
      result);
  }
  /** Inverse transform the input homogeneous point.
   * * Return as a new point or in the optional result.
   * * returns undefined if the matrix part if this Transform is singular.
   */
  public multiplyInversePoint4d(weightedPoint: Point4d, result?: Point4d): Point4d | undefined {
    const w = weightedPoint.w;
    return this._matrix.multiplyInverseXYZW(
      weightedPoint.x - w * this.origin.x,
      weightedPoint.y - w * this.origin.y,
      weightedPoint.z - w * this.origin.z,
      w, result);
  }

  /** Return product of the transform's inverse times a point (point given as x,y,z) */
  public multiplyInverseXYZ(x: number, y: number, z: number, result?: Point3d): Point3d | undefined {
    return this._matrix.multiplyInverseXYZAsPoint3d(
      x - this._origin.x,
      y - this._origin.y,
      z - this._origin.z,
      result);
  }

  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyInversePoint3dArray(source: Point3d[], result?: Point3d[]): Point3d[] | undefined {
    if (!this._matrix.computeCachedInverse(true))
      return undefined;
    const originX = this.origin.x;
    const originY = this.origin.y;
    const originZ = this.origin.z;
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point3d.createZero);
      for (let i = 0; i < n; i++)
        this._matrix.multiplyInverseXYZAsPoint3d(
          source[i].x - originX,
          source[i].y - originY,
          source[i].z - originZ,
          result[i]);
    }
    result = [];
    for (const p of source)
      result.push(this._matrix.multiplyInverseXYZAsPoint3d(
        p.x - originX,
        p.y - originY,
        p.z - originZ)!);

    return result;
  }
  /**
   * * for each point in source: multiply transformInverse * point in place in the point.
   * * return false if not invertible.
   */
  public multiplyInversePoint3dArrayInPlace(source: Point3d[]): boolean {
    if (!this._matrix.computeCachedInverse(true))
      return false;
    const originX = this.origin.x;
    const originY = this.origin.y;
    const originZ = this.origin.z;
    const n = source.length;
    for (let i = 0; i < n; i++)
      this._matrix.multiplyInverseXYZAsPoint3d(
        source[i].x - originX,
        source[i].y - originY,
        source[i].z - originZ,
        source[i]);
    return true;
  }
  /**
   * * Compute (if needed) the inverse of the matrix part, thereby ensuring inverse operations can complete.
   * * Return true if matrix inverse completes.
   * @param useCached If true, accept prior cached inverse if available.
   */
  public computeCachedInverse(useCached: boolean = true): boolean {
    return this._matrix.computeCachedInverse(useCached);
  }
  /**
   * * If destination has more values than source, remove the extras.
   * * If destination has fewer values, use the constructionFunction to create new ones.
   * @param source array
   * @param dest destination array, to  be modified to match source length
   * @param constructionFunction function to call to create new entries.
   */
  // modify destination so it has non-null points for the same length as the source.
  // (ASSUME existing elements of dest are non-null, and that parameters are given as either Point2d or Point3d arrays)
  public static matchArrayLengths(source: any[], dest: any[], constructionFunction: () => any): number {
    const numSource = source.length;
    const numDest = dest.length;
    if (numSource > numDest) {
      for (let i = numDest; i < numSource; i++) {
        dest.push(constructionFunction());
      }
    } else if (numDest > numSource) {
      dest.length = numSource;
    }
    return numSource;
  }

  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyPoint2dArray(source: Point2d[], result?: Point2d[]): Point2d[] {
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point2d.createZero);
      for (let i = 0; i < n; i++)
        Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, source[i], result[i]);
      return result;
    }
    result = [];
    for (const p of source)
      result.push(Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, p));

    return result;
  }
  /**
   * *  for each point:   multiply    transform * point
   * *  if result is given, resize to match source and replace each corresponding pi
   * *  if result is not given, return a new array.
   */
  public multiplyPoint3dArray(source: Point3d[], result?: Point3d[]): Point3d[] {
    if (result) {
      const n = Transform.matchArrayLengths(source, result, Point3d.createZero);
      for (let i = 0; i < n; i++)
        Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, source[i], result[i]);
      return result;
    }
    result = [];
    for (const p of source)
      result.push(Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, p));

    return result;
  }

  /** Multiply the vector by the Matrix3d part of the transform.
   *
   * *  The transform's origin is not used.
   * *  Return as new or result by usual optional result convention
   */
  public multiplyVector(vector: Vector3d, result?: Vector3d): Vector3d {
    return this._matrix.multiplyVector(vector, result);
  }
  /** Multiply the vector (x,y,z) by the Matrix3d part of the transform.
   *
   * *  The transform's origin is not used.
   * *  Return as new or result by usual optional result convention
   */
  public multiplyVectorXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    return this._matrix.multiplyXYZ(x, y, z, result);
  }
  /** multiply this Transform times other Transform.
   * ```
   * equation
   * \begin{matrix}
   *    \text{`this` transform with matrix part }\bold{A}\text{ and translation }\bold{a} & \blockTransform{A}{a}\\
   *    \text{`other` transform with matrix part }\bold{B}\text{ and translation part }\bold{b}\text{ promoted to block transform} & \blockTransform{B}{b} \\
   * \text{product}& \blockTransform{A}{a}\blockTransform{B}{b}=\blockTransform{AB}{Ab + a}
   * \end{matrix}
   * ```
   * @param other right hand transform for multiplication.
   * @param result optional preallocated result to reuse.
   */
  public multiplyTransformTransform(other: Transform, result?: Transform) {
    if (!result)
      return Transform.createRefs(
        Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, other._origin),
        this._matrix.multiplyMatrixMatrix(other._matrix));
    result.setMultiplyTransformTransform(this, other);
    return result;
  }
  /**
   * multiply transformA * transformB, store to calling instance.
   * @param transformA left operand
   * @param transformB right operand
   */
  public setMultiplyTransformTransform(transformA: Transform, transformB: Transform): void {
    if (Transform._scratchPoint === undefined)
      Transform._scratchPoint = Point3d.create();
    Matrix3d.xyzPlusMatrixTimesXYZ(transformA._origin, transformA._matrix, transformB._origin, Transform._scratchPoint);
    this._origin.setFrom(Transform._scratchPoint);
    transformA._matrix.multiplyMatrixMatrix(transformB._matrix, this._matrix);
  }
  //   [Q A][R 0] = [QR A]
  //   [0 1][0 1]   [0  1]
  /** multiply this Transform times other Matrix3d, with other considered to be a Transform with 0 translation.
   * ```
   * equation
   * \begin{matrix}
   *    \text{`this` transform with matrix part }\bold{A}\text{ and translation }\bold{b} & \blockTransform{B}{b}\\
   *    \text{`other` matrix }\bold{B}\text{ promoted to block transform} & \blockTransform{B}{0} \\
   * \text{product}& \blockTransform{A}{a}\blockTransform{B}{0}=\blockTransform{AB}{a}
   * \end{matrix}
   * ```
   * @param other right hand Matrix3d for multiplication.
   * @param result optional preallocated result to reuse.
   */
  public multiplyTransformMatrix3d(other: Matrix3d, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this._origin.cloneAsPoint3d(),
        this._matrix.multiplyMatrixMatrix(other));
    this._matrix.multiplyMatrixMatrix(other, result._matrix);
    result._origin.setFrom(this._origin);
    return result;
  }

  /**
   * Return the range of the transformed corners.
   * * The 8 corners are transformed individually.
   * * Note that if there is anything other than translation and principal axis scaling in the transform, the volume of the range rotation will increase.
   *    * Hence to get a "tight" range on rotated geometry, a range computation must be made on the rotated geometry itself.
   */
  public multiplyRange(range: Range3d, result?: Range3d): Range3d {
    if (range.isNull)
      return range.clone(result);

    // snag current values to allow aliasing.
    const lowX = range.low.x;
    const lowY = range.low.y;
    const lowZ = range.low.z;
    const highX = range.high.x;
    const highY = range.high.y;
    const highZ = range.high.z;
    result = Range3d.createNull(result);
    result.extendTransformedXYZ(this, lowX, lowY, lowZ);
    result.extendTransformedXYZ(this, highX, lowY, lowZ);
    result.extendTransformedXYZ(this, lowX, highY, lowZ);
    result.extendTransformedXYZ(this, highX, highY, lowZ);

    result.extendTransformedXYZ(this, lowX, lowY, highZ);
    result.extendTransformedXYZ(this, highX, lowY, highZ);
    result.extendTransformedXYZ(this, lowX, highY, highZ);
    result.extendTransformedXYZ(this, highX, highY, highZ);
    return result;
  }
  /**
   * * Return a Transform which is the inverse of this transform.
   * * Return undefined if this Transform's matrix is singular.
   */
  public inverse(): Transform | undefined {
    const matrixInverse = this._matrix.inverse();
    if (!matrixInverse)
      return undefined;
    return Transform.createRefs(
      matrixInverse.multiplyXYZ(-this._origin.x, -this._origin.y, -this._origin.z),
      matrixInverse);
  }
  /** Initialize transforms that map each direction of a box (axis aligned) to `[0,1]`.
   * * The corner coordinates do _not_ need to be in order in any of the x,y,z directions.
   * * The npcToGlobalTransform (if supplied) maps 000 to the point named point000.
   * * The npcToGlobalTransform (if supplied) maps 11 to the point named point000.
   * * The globalToNpc transform is the inverse.
   * @param min the "000" corner of the box
   * @param max the "111" corner of the box
   * @param npcToGlobal (object created by caller, re-initialized here) transform that carries 01 coordinates into the min,max box.
   * @param globalToNpc (object created by caller, re-initialized here) transform that carries world coordinates into 01
   */
  public static initFromRange(min: Point3d, max: Point3d, npcToGlobal?: Transform, globalToNpc?: Transform) {
    const diag = max.minus(min);
    if (diag.x === 0.0) diag.x = 1.0;
    if (diag.y === 0.0) diag.y = 1.0;
    if (diag.z === 0.0) diag.z = 1.0;

    const rMatrix = new Matrix3d();
    if (npcToGlobal) {
      Matrix3d.createScale(diag.x, diag.y, diag.z, rMatrix);
      Transform.createOriginAndMatrix(min, rMatrix, npcToGlobal);
    }

    if (globalToNpc) {
      const origin = new Point3d(- min.x / diag.x, - min.y / diag.y, - min.z / diag.z);
      Matrix3d.createScale(1.0 / diag.x, 1.0 / diag.y, 1.0 / diag.z, rMatrix);
      Transform.createOriginAndMatrix(origin, rMatrix, globalToNpc);
    }
  }
}
