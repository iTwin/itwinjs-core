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

/**
 * A Transform consists of an origin and a Matrix3d. This describes a coordinate frame with this origin, with
 * the columns of the Matrix3d being the local x,y,z axis directions.
 * * The math for a Transform `T` consisting of a Matrix3d `M` and a Point3d `o` on a Vector3d `p` is: `Tp = M*p + o`.
 * In other words, `T` is a combination of two operations on `p`: the action of matrix multiplication, followed by a
 * translation. `Origin` is a traditional term for `o`, because `T` can be interpreted as a change of basis from the
 * global axes centered at the global origin, to a new set of axes specified by matrix M columns centered at `o`.
 * * Beware that for common transformations (e.g. scale about point, rotate around an axis) the `fixed point` that
 * is used when describing the transform is NOT the `origin` stored in the transform. Setup methods (e.g
 * createFixedPointAndMatrix, createScaleAboutPoint) take care of determining the appropriate origin coordinates.
 * * If `T` is a translation, no point is fixed by `T`.
 * * If `T` is the identity, all points are fixed by `T`.
 * * If `T` is a scale about a point, one point is fixed by `T`.
 * * If `T` is a rotation about an axis, a line is fixed by `T`.
 * * If `T` is a projection to the plane, a plane is fixed by `T`.
 * @public
 */
export class Transform implements BeJSONFunctions {
  private _origin: XYZ;
  private _matrix: Matrix3d;
  // Constructor accepts and uses pointer to content (no copy is done here).
  private constructor(origin: XYZ, matrix: Matrix3d) {
    this._origin = origin;
    this._matrix = matrix;
  }
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
  public freeze(): Readonly<this> {
    this._origin.freeze();
    this._matrix.freeze();
    return Object.freeze(this);
  }
  /**
   * Copy contents from other Transform into this Transform
   * @param other source transform
   */
  public setFrom(other: Transform) {
    this._origin.setFrom(other._origin);
    this._matrix.setFrom(other._matrix);
  }
  /** Set this Transform to be an identity. */
  public setIdentity() {
    this._origin.setZero();
    this._matrix.setIdentity();
  }
  /**
   * Set this Transform instance from flexible inputs:
   * * Any object (such as another Transform or TransformProps) that has `origin` and `matrix` members
   * accepted by `Point3d.setFromJSON` and `Matrix3d.setFromJSON`
   * * An array of 3 number arrays, each with 4 entries which are rows in a 3x4 matrix.
   * * An array of 12 numbers, each block of 4 entries as a row 3x4 matrix.
   * * If no input is provided, the identity Transform is returned.
   */
  public setFromJSON(json?: TransformProps | Transform): void {
    if (json) {
      if (json instanceof Object && (json as any).origin && (json as any).matrix) {
        this._origin.setFromJSON((json as any).origin);
        this._matrix.setFromJSON((json as any).matrix);
        return;
      }
      if (Geometry.isArrayOfNumberArray(json, 3, 4)) {
        this._matrix.setRowValues(
          json[0][0], json[0][1], json[0][2],
          json[1][0], json[1][1], json[1][2],
          json[2][0], json[2][1], json[2][2],
        );
        this._origin.set(json[0][3], json[1][3], json[2][3]);
        return;
      }
      if (Geometry.isNumberArray(json, 12)) {
        this._matrix.setRowValues(
          json[0], json[1], json[2],
          json[4], json[5], json[6],
          json[8], json[9], json[10],
        );
        this._origin.set(json[3], json[7], json[11]);
        return;
      }
    }
    this.setIdentity();
  }
  /**
   * Test for near equality with `other` Transform. Comparison uses the `isAlmostEqual` methods on the `origin` and
   * `matrix` parts.
   * @param other Transform to compare to.
   */
  public isAlmostEqual(other: Readonly<Transform>): boolean {
    return this === other || this.origin.isAlmostEqual(other.origin) && this.matrix.isAlmostEqual(other.matrix);
  }
  /**
   * Test for near equality with `other` Transform. Comparison uses the `isAlmostEqual` methods on the `origin` part
   * and the `isAlmostEqualAllowZRotation` method on the `matrix` part.
   * @param other Transform to compare to.
   */
  public isAlmostEqualAllowZRotation(other: Transform): boolean {
    return this._origin.isAlmostEqual(other._origin) && this._matrix.isAlmostEqualAllowZRotation(other._matrix);
  }
  /**
   * Return a 3 by 4 matrix containing the rows of this Transform.
   * * The transform's origin coordinates are the last entries of the 3 json arrays
   */
  public toRows(): number[][] {
    return [
      [this._matrix.coffs[0], this._matrix.coffs[1], this._matrix.coffs[2], this._origin.x],
      [this._matrix.coffs[3], this._matrix.coffs[4], this._matrix.coffs[5], this._origin.y],
      [this._matrix.coffs[6], this._matrix.coffs[7], this._matrix.coffs[8], this._origin.z],
    ];
  }
  /**
   * Return a 3 by 4 matrix containing the rows of this Transform.
   * * The transform's origin coordinates are the last entries of the 3 json arrays
  */
  public toJSON(): TransformProps {
    return this.toRows();
  }
  /** Return a new Transform initialized by `Transform.setFromJSON` */
  public static fromJSON(json?: TransformProps): Transform {
    const result = Transform.createIdentity();
    result.setFromJSON(json);
    return result;
  }
  /** Copy the contents of `this` transform into a new Transform (or to the result, if specified). */
  public clone(result?: Transform): Transform {
    if (result) {
      result._matrix.setFrom(this._matrix);
      result._origin.setFrom(this._origin);
      return result;
    }
    return new Transform(
      Point3d.createFrom(this._origin),
      this._matrix.clone(),
    );
  }
  /**
   * Return a modified copy of `this` Transform so that its `matrix` part is rigid (`origin` part is untouched).
   * * @see [[Matrix3d.axisOrderCrossProductsInPlace]] documentation for details of how the matrix is modified to rigid.
   */
  public cloneRigid(axisOrder: AxisOrder = AxisOrder.XYZ): Transform | undefined {
    const modifiedMatrix = Matrix3d.createRigidFromMatrix3d(this.matrix, axisOrder);
    if (!modifiedMatrix)
      return undefined;
    return new Transform(this.origin.cloneAsPoint3d(), modifiedMatrix);
  }
  /** Create a Transform with the given `origin` and `matrix`. Inputs are captured, not cloned. */
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
  /** Create a Transform with complete contents given. `q` inputs make the matrix and `a` inputs make the origin */
  public static createRowValues(
    qxx: number, qxy: number, qxz: number, ax: number,
    qyx: number, qyy: number, qyz: number, ay: number,
    qzx: number, qzy: number, qzz: number, az: number,
    result?: Transform,
  ): Transform {
    if (result) {
      result._origin.set(ax, ay, az);
      result._matrix.setRowValues(qxx, qxy, qxz, qyx, qyy, qyz, qzx, qzy, qzz);
      return result;
    }
    return new Transform(
      Point3d.create(ax, ay, az),
      Matrix3d.createRowValues(qxx, qxy, qxz, qyx, qyy, qyz, qzx, qzy, qzz),
    );
  }
  /** Create a Transform with all zeros */
  public static createZero(result?: Transform): Transform {
    return Transform.createRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, result);
  }
  /**
   * Create a Transform with translation provided by x,y,z parts.
   * * Translation Transform maps any vector `v` to `v + p` where `p = (x,y,z)`
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/CubeTransform
   * @param x x part of translation
   * @param y y part of translation
   * @param z z part of translation
   * @param result optional pre-allocated Transform
   * @returns new or updated transform
   */
  public static createTranslationXYZ(x: number = 0, y: number = 0, z: number = 0, result?: Transform): Transform {
    return Transform.createRefs(Vector3d.create(x, y, z), Matrix3d.createIdentity(), result);
  }
  /**
   * Create a Transform with specified `translation` part.
   * * Translation Transform maps any vector `v` to `v + translation`
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/CubeTransform
   * @param translation x,y,z parts of the translation
   * @param result optional pre-allocated Transform
   * @returns new or updated transform
   */
  public static createTranslation(translation: XYZ, result?: Transform): Transform {
    return Transform.createRefs(translation, Matrix3d.createIdentity(), result);
  }
  /** Return a reference (and NOT a copy) to the `matrix` part of the Transform. */
  public get matrix(): Matrix3d {
    return this._matrix;
  }
  /** Return a reference (and NOT a copy) to the `origin` part of the Transform. */
  public get origin(): XYZ {
    return this._origin;
  }
  /** return a (clone of) the `origin` part of the Transform, as a `Point3d` */
  public getOrigin(): Point3d {
    return Point3d.createFrom(this._origin);
  }
  /** return a (clone of) the `origin` part of the Transform, as a `Vector3d` */
  public getTranslation(): Vector3d {
    return Vector3d.createFrom(this._origin);
  }
  /** return a (clone of) the `matrix` part of the Transform, as a `Matrix3d` */
  public getMatrix(): Matrix3d {
    return this._matrix.clone();
  }
  /** test if the transform has `origin` = (0,0,0) and identity `matrix` */
  public get isIdentity(): boolean {
    return this._matrix.isIdentity && this._origin.isAlmostZero;
  }
  /** Create an identity transform */
  public static createIdentity(result?: Transform): Transform {
    if (result) {
      result._origin.setZero();
      result._matrix.setIdentity();
      return result;
    }
    return Transform.createRefs(Point3d.createZero(), Matrix3d.createIdentity());
  }
  /**
   * Create a Transform using the given `origin` and `matrix`.
   * * This is a the appropriate construction when the columns of the matrix are coordinate axes of a
   * local-to-world mapping.
   * * This function is a closely related to `createFixedPointAndMatrix` whose point input is the fixed point
   * of the world-to-world transformation.
   * * If origin is `undefined`, (0,0,0) is used. If matrix is `undefined` the identity matrix is used.
   */
  public static createOriginAndMatrix(
    origin: XYZ | undefined, matrix: Matrix3d | undefined, result?: Transform,
  ): Transform {
    if (result) {
      result._origin.setFromPoint3d(origin);
      result._matrix.setFrom(matrix);
      return result;
    }
    return Transform.createRefs(
      origin ? origin.cloneAsPoint3d() : Point3d.createZero(),
      matrix === undefined ? Matrix3d.createIdentity() : matrix.clone(),
      result,
    );
  }
  /** Create a Transform using the given `origin` and columns of the `matrix`. If `undefined` zero is used. */
  public setOriginAndMatrixColumns(
    origin: XYZ | undefined, vectorX: Vector3d | undefined, vectorY: Vector3d | undefined, vectorZ: Vector3d | undefined,
  ): void {
    if (origin !== undefined)
      this._origin.setFrom(origin);
    this._matrix.setColumns(vectorX, vectorY, vectorZ);
  }
  /** Create a Transform using the given `origin` and columns of the `matrix` */
  public static createOriginAndMatrixColumns(
    origin: XYZ, vectorX: Vector3d, vectorY: Vector3d, vectorZ: Vector3d, result?: Transform,
  ): Transform {
    if (result)
      result.setOriginAndMatrixColumns(origin, vectorX, vectorY, vectorZ);
    else
      result = Transform.createRefs(Vector3d.createFrom(origin), Matrix3d.createColumns(vectorX, vectorY, vectorZ));
    return result;
  }
  /**
   * Create a Transform such that its `matrix` part is rigid.
   * @see [[Matrix3d.createRigidFromColumns]] for details of how the matrix is created to be rigid.
   */
  public static createRigidFromOriginAndColumns(
    origin: XYZ | undefined, vectorX: Vector3d, vectorY: Vector3d, axisOrder: AxisOrder, result?: Transform,
  ): Transform | undefined {
    const matrix = Matrix3d.createRigidFromColumns(vectorX, vectorY, axisOrder, result ? result._matrix : undefined);
    if (!matrix)
      return undefined;
    if (result) {
      // result._matrix was already modified to become rigid via createRigidFromColumns
      result._origin.setFrom(origin);
      return result;
    }
    /**
     * We don't want to pass "origin" to createRefs because createRefs does not clone "origin". That means if "origin"
     * is changed via Transform at any point, the initial "origin" passed by the user is also changed. To avoid that,
     * we pass "undefined" to createRefs so that it allocates a new point which then we set it to the "origin" which
     * is passed by user in the next line.
     */
    result = Transform.createRefs(undefined, matrix);
    result._origin.setFromPoint3d(origin);
    return result;
  }
  /**
   * Create a Transform with the specified `matrix`. Compute an `origin` (different from the given `fixedPoint`)
   * so that the `fixedPoint` maps back to itself. The returned Transform, transforms a point `p` to `M*p + (f - M*f)`
   * where `f` is the fixedPoint (i.e., `Tp = M*(p-f) + f`).
   */
  public static createFixedPointAndMatrix(
    fixedPoint: XYAndZ | undefined, matrix: Matrix3d, result?: Transform,
  ): Transform {
    if (fixedPoint) {
      /**
       * if f is a fixed point, then Tf = M*f + o = f where M is the matrix and o is the origin.
       * we define the origin o = f - M*f. Therefore, Tf = Mf + o = M*f + (f - M*f) = f.
       */
      const origin = Matrix3d.xyzMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
      return Transform.createRefs(origin, matrix.clone(), result);
    }
    return Transform.createRefs(undefined, matrix.clone());
  }
  /**
   * Create a transform with the specified `matrix` and points `a` and `b`. The returned Transform maps
   * point `p` to `M*(p-a) + b` (i.e., `Tp = M*(p-a) + b`), so maps `a` to 'b'.
   */
  public static createMatrixPickupPutdown(
    matrix: Matrix3d, a: Point3d, b: Point3d, result?: Transform,
  ): Transform {
    // we define the origin o = b - M*a so Tp = M*p + o = M*p + (b - M*a) = M*(p-a) + b
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(b, matrix, a);
    return Transform.createRefs(origin, matrix.clone(), result);
  }
  /**
   * Create a Transform which leaves the fixedPoint unchanged and scales everything else around it by
   * a single scale factor. The returned Transform maps a point `p` to `M*p + (f - M*f)`
   * where `f` is the fixedPoint and M is the scale matrix (i.e., `Tp = M*(p-f) + f`).
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/CubeTransform
   */
  public static createScaleAboutPoint(fixedPoint: Point3d, scale: number, result?: Transform): Transform {
    const matrix = Matrix3d.createScale(scale, scale, scale);
    /**
     * if f is a fixed point, then Tf = M*f + o = f where M is the matrix and o is the origin.
     * we define the origin o = f - M*f. Therefore, Tf = M*f + o = M*f + (f - M*f) = f.
     */
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(fixedPoint, matrix, fixedPoint);
    return Transform.createRefs(origin, matrix, result);
  }
  /**
   * Return a transformation which flattens space onto a plane, sweeping along a direction which may be different from the plane normal.
   * @param sweepVector vector for the sweep direction
   * @param planePoint any point on the plane
   * @param planeNormal vector normal to the plane.
   */
  public static createFlattenAlongVectorToPlane(sweepVector: Vector3d, planePoint: XYAndZ, planeNormal: Vector3d): Transform | undefined {
    const matrix = Matrix3d.createFlattenAlongVectorToPlane(sweepVector, planeNormal);
    if (matrix === undefined)
      return undefined;
    return Transform.createFixedPointAndMatrix(planePoint, matrix);
  }
  /**
   * Transform the input 2d point (using `Tp = M*p + o`).
   * Return as a new point or in the pre-allocated result (if result is given).
   */
  public multiplyPoint2d(point: XAndY, result?: Point2d): Point2d {
    return Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, point, result);
  }
  /**
   * Transform the input 3d point (using `Tp = M*p + o`).
   * Return as a new point or in the pre-allocated result (if result is given).
   */
  public multiplyPoint3d(point: XYAndZ, result?: Point3d): Point3d {
    // Tx = Mx + o so we return Mx + o
    return Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, point, result);
  }
  /**
   * Transform the input 3d point in place (using `Tp = M*p + o`).
   * Return as a new point or in the pre-allocated result (if result is given).
   */
  public multiplyXYAndZInPlace(point: XYAndZ): void {
    return Matrix3d.xyzPlusMatrixTimesXYZInPlace(this._origin, this._matrix, point);
  }
  /**
   * Transform the input 3d point (using `Tp = M*p + o`).
   * Return as a new point or in the pre-allocated result (if result is given).
   */
  public multiplyXYZ(x: number, y: number, z: number = 0, result?: Point3d): Point3d {
    // Tx = Mx + o so we return Mx + o
    return Matrix3d.xyzPlusMatrixTimesCoordinates(this._origin, this._matrix, x, y, z, result);
  }
  /**
   * Multiply a specific row (component) of the 3x4 instance times (x,y,z,1). Return the result.
   */
  public multiplyComponentXYZ(componentIndex: number, x: number, y: number, z: number = 0): number {
    const coffs = this._matrix.coffs;
    const idx = 3 * componentIndex;
    return this.origin.at(componentIndex) + (coffs[idx] * x) + (coffs[idx + 1] * y) + (coffs[idx + 2] * z);
  }
  /**
   * Multiply a specific row (component) of the 3x4 instance times (x,y,z,w). Return the result.
   */
  public multiplyComponentXYZW(componentIndex: number, x: number, y: number, z: number, w: number): number {
    const coffs = this._matrix.coffs;
    const idx = 3 * componentIndex;
    return (this.origin.at(componentIndex) * w) + (coffs[idx] * x) + (coffs[idx + 1] * y) + (coffs[idx + 2] * z);
  }
  /**
   * Transform the homogeneous point. Return as a new `Point4d`, or in the pre-allocated result (if result is given).
   * * If `p = (x,y,z)` then this method computes `Tp = M*p + o*w` and returns the `Point4d` formed by `Tp` in the
   * first three coordinates, and `w` in the fourth.
   * * Logically, this is multiplication by the 4x4 matrix formed from the 3x4 instance augmented with fourth row 0001.
   */
  public multiplyXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    return Matrix3d.xyzPlusMatrixTimesWeightedCoordinates(this._origin, this._matrix, x, y, z, w, result);
  }
  /**
   * Transform the homogeneous point. Return as new `Float64Array` with size 4, or in the pre-allocated `result` of sufficient size.
   * * If `p = (x,y,z)` then this method computes `Tp = M*p + o*w` and returns the `Float64Array` formed by `Tp`
   * in the first 3 numbers of the array and `w` as the fourth.
   * * Logically, this is multiplication by the 4x4 matrix formed from the 3x4 instance augmented with fourth row 0001.
   */
  public multiplyXYZWToFloat64Array(x: number, y: number, z: number, w: number, result?: Float64Array): Float64Array {
    return Matrix3d.xyzPlusMatrixTimesWeightedCoordinatesToFloat64Array(this._origin, this._matrix, x, y, z, w, result);
  }
  /**
   * * Transform the point. Return as new `Float64Array` with size 3, or in the pre-allocated `result` of sufficient size.
   * * If `p = (x,y,z)` then this method computes `Tp = M*p + o` and returns it as the first 3 elements of the array.
   */
  public multiplyXYZToFloat64Array(x: number, y: number, z: number, result?: Float64Array): Float64Array {
    return Matrix3d.xyzPlusMatrixTimesCoordinatesToFloat64Array(this._origin, this._matrix, x, y, z, result);
  }
  /**
   * Multiply the homogeneous point by the transpose of `this` Transform. Return as a new `Point4d` or in the
   * pre-allocated result (if result is given).
   * * If `p = (x,y,z)` then this method computes `M^t*p` and returns it in the first three coordinates of the `Point4d`,
   * and `o*p + w` in the fourth.
   * * Logically, this is multiplication by the transpose of the 4x4 matrix formed from the 3x4 instance augmented with
   * fourth row 0001.
   */
  public multiplyTransposeXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    const coffs = this._matrix.coffs;
    const origin = this._origin;
    return Point4d.create(
      (x * coffs[0]) + (y * coffs[3]) + (z * coffs[6]),
      (x * coffs[1]) + (y * coffs[4]) + (z * coffs[7]),
      (x * coffs[2]) + (y * coffs[5]) + (z * coffs[8]),
      (x * origin.x) + (y * origin.y) + (z * origin.z) + w,
      result,
    );
  }
  /** For each point in the array, replace point by the transformed point (using `Tp = M*p + o`) */
  public multiplyPoint3dArrayInPlace(points: Point3d[]) {
    let point;
    for (point of points)
      Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, point, point);
  }
  /** For each point in the 2d array, replace point by the transformed point (using `Tp = M*p + o`) */
  public multiplyPoint3dArrayArrayInPlace(chains: Point3d[][]) {
    for (const chain of chains)
      this.multiplyPoint3dArrayInPlace(chain);
  }
  /**
   * Multiply the point by the inverse Transform.
   * * If for a point `p` we have `Tp = M*p + o = q`, then `p = MInverse*(q - o) = TInverse q` so `TInverse`
   * Transform has matrix part `MInverse` and origin part `-MInverse*o`.
   * * Return as a new point or in the optional `result`.
   * * Returns `undefined` if the `matrix` part if this Transform is singular.
   */
  public multiplyInversePoint3d(point: XYAndZ, result?: Point3d): Point3d | undefined {
    return this._matrix.multiplyInverseXYZAsPoint3d(
      point.x - this._origin.x,
      point.y - this._origin.y,
      point.z - this._origin.z,
      result,
    );
  }
  /**
   * Multiply the homogenous point by the inverse Transform.
   * * If for a point `p` we have `Tp = M*p + o = q`, then `p = MInverse*(q - o) = TInverse q` so `TInverse` Transform
   * has matrix part `MInverse` and origin part `-MInverse*o`.
   * * This method computes `TInverse p = MInverse*p - w*MInverse*o` and returns the `Point4d` formed by `TInverse*p`
   * in the first three coordinates, and `w` in the fourth.
   * * Logically, this is multiplication by the inverse of the 4x4 matrix formed from the 3x4 instance augmented with
   * fourth row 0001. This is equivalent to the 4x4 matrix formed in similar fashion from the inverse of this instance.
   * * Return as a new point or in the optional `result`.
   * * Returns `undefined` if the `matrix` part if this Transform is singular.
   */
  public multiplyInversePoint4d(weightedPoint: Point4d, result?: Point4d): Point4d | undefined {
    const w = weightedPoint.w;
    return this._matrix.multiplyInverseXYZW(
      weightedPoint.x - w * this.origin.x,
      weightedPoint.y - w * this.origin.y,
      weightedPoint.z - w * this.origin.z,
      w,
      result,
    );
  }
  /**
   * Multiply the point by the inverse Transform.
   * * If for a point `p` we have `Tp = M*p + o = q`, then `p = MInverse*(q - o) = TInverse q` so `TInverse` Transform
   * has matrix part `MInverse` and origin part `-MInverse*o`.
   * * Return as a new point or in the optional `result`.
   * * Returns `undefined` if the `matrix` part if this Transform is singular.
   */
  public multiplyInverseXYZ(x: number, y: number, z: number, result?: Point3d): Point3d | undefined {
    return this._matrix.multiplyInverseXYZAsPoint3d(
      x - this._origin.x,
      y - this._origin.y,
      z - this._origin.z,
      result,
    );
  }
  /**
   * * Compute (if needed) the inverse of the `matrix` part of the Transform, thereby ensuring inverse
   * operations can complete.
   * @param useCached If true, accept prior cached inverse if available.
   * @returns `true` if matrix inverse completes, `false` otherwise.
   */
  public computeCachedInverse(useCached: boolean = true): boolean {
    return this._matrix.computeCachedInverse(useCached);
  }
  /**
   * Match the length of destination array with the length of source array
   * * If destination has more elements than source, remove the extra elements.
   * * If destination has fewer elements than source, use `constructionFunction` to create new elements.
   * *
   * @param source the source array
   * @param dest the destination array
   * @param constructionFunction function to call to create new elements.
   */
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
   * Multiply each point in the array by the inverse of `this` Transform.
   * * For a transform `T = [M o]` the inverse transform `T' = [M' -M'o]` exists if and only if `M` has an inverse
   * `M'`. Indeed, for any point `p`, we have `T'Tp = T'(Mp + o) = M'(Mp + o) - M'o = M'Mp + M'o - M'o = p.`
   * * If `result` is given, resize it to match the input `points` array and update it with original points `p[]`.
   * * If `result` is not given, return a new array.
   * * Returns `undefined` if the `matrix` part if this Transform is singular.
   */
  public multiplyInversePoint3dArray(points: Point3d[], result?: Point3d[]): Point3d[] | undefined {
    if (!this._matrix.computeCachedInverse(true))
      return undefined;
    const originX = this.origin.x;
    const originY = this.origin.y;
    const originZ = this.origin.z;
    if (result) {
      const n = Transform.matchArrayLengths(points, result, () => Point3d.createZero());
      for (let i = 0; i < n; i++)
        this._matrix.multiplyInverseXYZAsPoint3d(
          points[i].x - originX,
          points[i].y - originY,
          points[i].z - originZ,
          result[i],
        );
      return result;
    }
    result = [];
    for (const point of points)
      result.push(
        this._matrix.multiplyInverseXYZAsPoint3d(
          point.x - originX,
          point.y - originY,
          point.z - originZ,
        )!,
      );
    return result;
  }
  /**
   * Multiply each point in the array by the inverse of `this` Transform in place.
   * * For a transform `T = [M o]` the inverse transform `T' = [M' -M'o]` exists if and only if `M` has an inverse
   * `M'`. Indeed, for any point `p`, we have `T'Tp = T'(Mp + o) = M'(Mp + o) - M'o = M'Mp + M'o - M'o = p.`
   * * Returns `true` if the `matrix` part if this Transform is invertible and `false` if singular.
   */
  public multiplyInversePoint3dArrayInPlace(points: Point3d[]): boolean {
    if (!this._matrix.computeCachedInverse(true))
      return false;
    for (const point of points)
      this._matrix.multiplyInverseXYZAsPoint3d(
        point.x - this.origin.x,
        point.y - this.origin.y,
        point.z - this.origin.z,
        point,
      );
    return true;
  }
  /**
   * Transform the input 2d point array (using `Tp = M*p + o`).
   * * If `result` is given, resize it to match the input `points` array and update it with transformed points.
   * * If `result` is not given, return a new array.
   */
  public multiplyPoint2dArray(points: Point2d[], result?: Point2d[]): Point2d[] {
    if (result) {
      const n = Transform.matchArrayLengths(points, result, () => Point2d.createZero());
      for (let i = 0; i < n; i++)
        Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, points[i], result[i]);
      return result;
    }
    result = [];
    for (const p of points)
      result.push(Matrix3d.xyPlusMatrixTimesXY(this._origin, this._matrix, p));
    return result;
  }
  /**
   * Transform the input 3d point array (using `Tp = M*p + o`).
   * * If `result` is given, resize it to match the input `points` array and update it with transformed points.
   * * If `result` is not given, return a new array.
   */
  public multiplyPoint3dArray(points: Point3d[], result?: Point3d[]): Point3d[] {
    if (result) {
      const n = Transform.matchArrayLengths(points, result, () => Point3d.createZero());
      for (let i = 0; i < n; i++)
        Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, points[i], result[i]);
      return result;
    }
    result = [];
    for (const p of points)
      result.push(Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, p));
    return result;
  }
  /**
   * Multiply the vector by the `matrix` part of the Transform.
   * * The `origin` part of Transform is not used.
   * * If `result` is given, update it with the multiplication. Otherwise, create a new Vector3d.
   */
  public multiplyVector(vector: Vector3d, result?: Vector3d): Vector3d {
    return this._matrix.multiplyVector(vector, result);
  }
  /**
   * Multiply the vector by the `matrix` part of the Transform in place.
   * * The `origin` part of Transform is not used.
   */
  public multiplyVectorInPlace(vector: Vector3d): void {
    this._matrix.multiplyVectorInPlace(vector);
  }
  /**
   * Multiply the vector (x,y,z) by the `matrix` part of the Transform.
   * * The `origin` part of Transform is not used.
   * * If `result` is given, update it with the multiplication. Otherwise, create a new Vector3d.
   */
  public multiplyVectorXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    return this._matrix.multiplyXYZ(x, y, z, result);
  }
  /**
   * Calculate `transformA * transformB` and store it into the calling instance (`this`).
   * * **Note:** If `transformA = [A   a]` and `transformB = [B   b]` then `transformA * transformB` is defined as
   * `[A*B   Ab+a]`.
   * * @see [[multiplyTransformTransform]] documentation for math details.
   * @param transformA first operand
   * @param transformB second operand
   */
  public setMultiplyTransformTransform(transformA: Transform, transformB: Transform): void {
    Matrix3d.xyzPlusMatrixTimesXYZ(
      transformA._origin,
      transformA._matrix,
      transformB._origin,
      this._origin as Point3d,
    );
    transformA._matrix.multiplyMatrixMatrix(transformB._matrix, this._matrix);
  }
  /**
   * Multiply `this` Transform times `other` Transform.
   * * **Note:** If `this = [A   a]` and `other = [B   b]` then `this * other` is defined as `[A*B   Ab+a]` because:
   * ```
   * equation
   * \begin{matrix}
   *    \text{this Transform with matrix part }\bold{A}\text{ and origin part }\bold{a} & \blockTransform{A}{a}\\
   *    \text{other Transform with matrix part }\bold{B}\text{ and origin part }\bold{b} & \blockTransform{B}{b} \\
   * \text{product}& \blockTransform{A}{a}\blockTransform{B}{b}=\blockTransform{AB}{Ab + a}
   * \end{matrix}
   * ```
   * @param other the `other` Transform to be multiplied to `this` Transform.
   * @param result optional preallocated `result` to reuse.
   */
  public multiplyTransformTransform(other: Transform, result?: Transform) {
    if (!result)
      return Transform.createRefs(
        Matrix3d.xyzPlusMatrixTimesXYZ(this._origin, this._matrix, other._origin),
        this._matrix.multiplyMatrixMatrix(other._matrix),
      );
    result.setMultiplyTransformTransform(this, other);
    return result;
  }
  /**
   * Multiply `this` Transform times `other` Matrix3d (considered to be a Transform with 0 `origin`).
   * * **Note:** If `this = [A   a]` and `other = [B   0]`, then `this * other` is defined as [A*B   a] because:
   * ```
   * equation
   * \begin{matrix}
   *    \text{this Transform with matrix part }\bold{A}\text{ and origin part }\bold{a} & \blockTransform{A}{a}\\
   *    \text{other matrix }\bold{B}\text{ promoted to block Transform} & \blockTransform{B}{0} \\
   * \text{product}& \blockTransform{A}{a}\blockTransform{B}{0}=\blockTransform{AB}{a}
   * \end{matrix}
   * ```
   * @param other the `other` Matrix3d to be multiplied to `this` Transform.
   * @param result optional preallocated `result` to reuse.
   */
  public multiplyTransformMatrix3d(other: Matrix3d, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this._origin.cloneAsPoint3d(),
        this._matrix.multiplyMatrixMatrix(other),
      );
    this._matrix.multiplyMatrixMatrix(other, result._matrix);
    result._origin.setFrom(this._origin);
    return result;
  }
  /**
   * Return the range of the transformed corners.
   * * The 8 corners are transformed individually.
   * * **Note:** Suppose you have a geometry, a range box around that geometry, and your Transform is a rotation.
   * If you rotate the range box and recompute a new range box around the rotated range box, then the new range
   * box will have a larger volume than the original range box. However, if you rotate the geometry itself and
   * then recompute the range box, it will be a tighter range box around the rotated geometry. `multiplyRange`
   * function creates the larger range box because it only has access to the range box and not the geometry itself.
   */
  public multiplyRange(range: Range3d, result?: Range3d): Range3d {
    if (range.isNull)
      return range.clone(result);
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
   * Return a Transform which is the inverse of `this` Transform.
   * * If `transform = [M   o]` then `transformInverse = [MInverse   -MInverse*o]`
   * * Return `undefined` if this Transform's matrix is singular.
   */
  public inverse(result?: Transform): Transform | undefined {
    const matrixInverse = this._matrix.inverse(result ? result._matrix : undefined);
    if (!matrixInverse)
      return undefined;
    if (result) {
      // result._matrix is already defined
      matrixInverse.multiplyXYZ(-this._origin.x, -this._origin.y, -this._origin.z, result._origin as Vector3d);
      return result;
    }
    return Transform.createRefs(
      matrixInverse.multiplyXYZ(-this._origin.x, -this._origin.y, -this._origin.z),
      matrixInverse,
    );
  }
  /**
   * Initialize 2 Transforms that map between the unit box (specified by 000 and 111) and the range box specified
   * by the input points.
   * @param min the min corner of the range box
   * @param max the max corner of the range box
   * @param npcToGlobal maps NPC coordinates into range box coordinates. Specifically, maps 000 to `min` and maps
   * 111 to `max`. This Transform is the inverse of `globalToNpc`. Object created by caller, re-initialized here.
   * @param globalToNpc maps range box coordinates into NPC coordinates. Specifically, maps `min` to 000 and maps
   * `max` to 111. This Transform is the inverse of `npcToGlobal`. Object created by caller, re-initialized here.
   * * NPC stands for `Normalized Projection Coordinate`
   */
  public static initFromRange(min: Point3d, max: Point3d, npcToGlobal?: Transform, globalToNpc?: Transform): void {
    const diag = max.minus(min);
    if (diag.x === 0.0)
      diag.x = 1.0;
    if (diag.y === 0.0)
      diag.y = 1.0;
    if (diag.z === 0.0)
      diag.z = 1.0;
    const rMatrix = new Matrix3d();
    /**
     *               [diag.x    0       0      min.x]
     * npcToGlobal = [  0     diag.y    0      min.y]
     *               [  0       0     diag.y   min.z]
     *
     * npcToGlobal * 0 = min
     * npcToGlobal * 1 = diag + min = max
     */
    if (npcToGlobal) {
      Matrix3d.createScale(diag.x, diag.y, diag.z, rMatrix);
      Transform.createOriginAndMatrix(min, rMatrix, npcToGlobal);
    }
    /**
     *               [1/diag.x      0         0      -min.x/diag.x]
     * globalToNpc = [  0       1/diag.y      0      -min.y/diag.y]
     *               [  0         0       1/diag.y   -min.z/diag.z]
     *
     * globalToNpc * min = min/diag - min/diag = 0
     * globalToNpc * max = max/diag - min/diag = diag/diag = 1
     */
    if (globalToNpc) {
      const origin = new Point3d(-min.x / diag.x, -min.y / diag.y, -min.z / diag.z);
      Matrix3d.createScale(1.0 / diag.x, 1.0 / diag.y, 1.0 / diag.z, rMatrix);
      Transform.createOriginAndMatrix(origin, rMatrix, globalToNpc);
    }
  }
}
