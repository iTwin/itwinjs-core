/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AxisIndex, AxisOrder, BeJSONFunctions, Geometry, StandardViewIndex } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Angle } from "./Angle";
import { Point2d } from "./Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { Matrix3dProps, WritableXYAndZ, XAndY, XYAndZ } from "./XYZProps";

/* eslint-disable @bentley/prefer-get */
/**
 * PackedMatrix3dOps contains static methods for matrix operations where the matrix is a Float64Array.
 * * The Float64Array contains the matrix entries in row-major order
 * @internal
 * ```
 * equation
 * \newcommand[1]\mij{#1_{00}\ #1_{01}\ a_{02}}
 * ```
 */
export class PackedMatrix3dOps {
  /**
   * Load 9 doubles into the packed format.
   * @param dest destination, allocated by caller
   * @param a00 row 0, column 0 entry
   * @param a01 row 0, column 1 entry
   * @param a02 row 0, column 2 entry
   * @param a10 row 1, column 0 entry
   * @param a11 row 1, column 1 entry
   * @param a12 row 1, column 2 entry
   * @param a20 row 2, column 0 entry
   * @param a21 row 2, column 1 entry
   * @param a22 row 2, column 2 entry
   */
  public static loadMatrix(dest: Float64Array,
    a00: number, a01: number, a02: number,
    a10: number, a11: number, a12: number,
    a20: number, a21: number, a22: number) {
    dest[0] = a00; dest[1] = a01; dest[2] = a02;
    dest[3] = a10; dest[4] = a11; dest[5] = a12;
    dest[6] = a20; dest[7] = a21; dest[8] = a22;
  }

  /**
   * * multiply 3x3 matrix `a*b`, store in c.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(result,
      (a[0] * b[0] + a[1] * b[3] + a[2] * b[6]),
      (a[0] * b[1] + a[1] * b[4] + a[2] * b[7]),
      (a[0] * b[2] + a[1] * b[5] + a[2] * b[8]),
      (a[3] * b[0] + a[4] * b[3] + a[5] * b[6]),
      (a[3] * b[1] + a[4] * b[4] + a[5] * b[7]),
      (a[3] * b[2] + a[4] * b[5] + a[5] * b[8]),
      (a[6] * b[0] + a[7] * b[3] + a[8] * b[6]),
      (a[6] * b[1] + a[7] * b[4] + a[8] * b[7]),
      (a[6] * b[2] + a[7] * b[5] + a[8] * b[8]));
    return result;
  }

  /**
   * * multiply 3x3 matrix `a*bTranspose`, store in c.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixMatrixTranspose(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(result,
      (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
      (a[0] * b[3] + a[1] * b[4] + a[2] * b[5]),
      (a[0] * b[6] + a[1] * b[7] + a[2] * b[8]),
      (a[3] * b[0] + a[4] * b[1] + a[5] * b[2]),
      (a[3] * b[3] + a[4] * b[4] + a[5] * b[5]),
      (a[3] * b[6] + a[4] * b[7] + a[5] * b[8]),
      (a[6] * b[0] + a[7] * b[1] + a[8] * b[2]),
      (a[6] * b[3] + a[7] * b[4] + a[8] * b[5]),
      (a[6] * b[6] + a[7] * b[7] + a[8] * b[8]));
    return result;
  }

  /**
   * * multiply 3x3 matrix `a*bTranspose`, store in c.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixTransposeMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(result,
      (a[0] * b[0] + a[3] * b[3] + a[6] * b[6]),
      (a[0] * b[1] + a[3] * b[4] + a[6] * b[7]),
      (a[0] * b[2] + a[3] * b[5] + a[6] * b[8]),
      (a[1] * b[0] + a[4] * b[3] + a[7] * b[6]),
      (a[1] * b[1] + a[4] * b[4] + a[7] * b[7]),
      (a[1] * b[2] + a[4] * b[5] + a[7] * b[8]),
      (a[2] * b[0] + a[5] * b[3] + a[8] * b[6]),
      (a[2] * b[1] + a[5] * b[4] + a[8] * b[7]),
      (a[2] * b[2] + a[5] * b[5] + a[8] * b[8]));
    return result;
  }
  /** transpose 3x3 coefficients in place */
  public static transposeInPlace(a: Float64Array) {
    let q = a[1]; a[1] = a[3]; a[3] = q;
    q = a[2]; a[2] = a[6]; a[6] = q;
    q = a[5]; a[5] = a[7]; a[7] = q;
  }
  /** transpose 3x3 coefficients in place */
  public static copyTransposed(a: Float64Array, dest?: Float64Array): Float64Array {
    if (dest === a) {
      PackedMatrix3dOps.transposeInPlace(a);
    } else {
      if (!dest)
        dest = new Float64Array(9);
      dest[0] = a[0]; dest[1] = a[3]; dest[2] = a[6];
      dest[3] = a[1]; dest[4] = a[4]; dest[5] = a[7];
      dest[6] = a[2]; dest[7] = a[5]; dest[8] = a[8];
    }
    return dest;
  }
  /** transpose 3x3 coefficients in place */
  public static copy(a: Float64Array, dest: Float64Array): Float64Array {
    if (dest !== a) {
      dest[0] = a[0]; dest[1] = a[1]; dest[2] = a[2];
      dest[3] = a[3]; dest[4] = a[4]; dest[5] = a[5];
      dest[6] = a[6]; dest[7] = a[7]; dest[8] = a[8];
    }
    return dest;
  }

}
/** A Matrix3d is tagged indicating one of the following states:
 * * unknown: it is not know if the matrix is invertible.
 * * inverseStored: the matrix has its inverse stored
 * * singular: the matrix is known to be singular.
 * @public
 */
export enum InverseMatrixState {
  /**
   * * The invertibility of the  `coffs` array has not been determined.
   * * Any `inverseCoffs` contents are random.
   */
  unknown,
  /** An inverse was computed and stored as the `inverseCoffs` */
  inverseStored,
  /**
   * * The `coffs` array is known to be singular.
   * * Any `inverseCoffs` contents are random.
   */
  singular,
}
/** A Matrix3d is a 3x3 matrix.
 * * A very common use is to hold a rigid body rotation (which has no scaling or skew), but the 3x3 contents can
 * also hold scaling and skewing.
 * * The matrix with 2-dimensional layout
 * ```
 * equation
 *      \matrixXY{A}
 * ```
 * is stored as 9 numbers in "row-major" order in a `Float64Array`, viz
 * ```
 * equation
 *      \rowMajorMatrixXY{A}
 * ```
 * * If the matrix inverse is known it is stored in the inverseCoffs array.
 * * The inverse status (`unknown`, `inverseStored`, `singular`) status is indicated by the `inverseState` property.
 * * construction methods that are able to trivially construct the inverse store it immediately and note that in the inverseState.
 * * constructions (e.g. createRowValues) for which the inverse is not immediately known mark the
 *     inverseState as unknown.
 * * Later queries for the inverse trigger full computation if needed at that time.
 * * Most matrix queries are present with both "column" and "row" variants.
 * * Usage elsewhere in the library is typically "column" based.  For example, in a Transform
 *     that carries a coordinate frame the matrix columns are the unit vectors for the axes.
 * @public
 */
export class Matrix3d implements BeJSONFunctions {
  /** Control flag for whether this class uses cached inverse of matrices. */
  public static useCachedInverse = true;  // cached inverse can be suppressed for testing.
  /** total number of times a cached inverse was used to avoid recompute */
  public static numUseCache = 0;
  /** total number of times a cached inverse was computed. */
  public static numComputeCache = 0;
  /** Matrix contents as a flat array of numbers in row-major order.
   * ```
   * equation
   * \mxy{B}
   * \mij{B}
   * ```
   * * DO NOT directly modify this array.  It will destroy safety of the cached inverse state.
   */
  public coffs: Float64Array;
  /** matrix inverse contents.
   * * DO NOT directly modify this array.  It will destroy integrity of the cached inverse state.
   * ```
   * equation
   * \mxy{A}
   * ```
   *
   *
   */
  public inverseCoffs: Float64Array | undefined;
  /** indicates if inverse is unknown, available, or known singular */
  public inverseState: InverseMatrixState;
  private static _identity: Matrix3d;

  /** The identity Matrix3d. Value is frozen and cannot be modified. */
  public static get identity(): Matrix3d {
    if (undefined === this._identity) {
      this._identity = Matrix3d.createIdentity();
      this._identity.freeze();
    }

    return this._identity;
  }

  /** Freeze this Matrix3d. */
  public freeze(): Readonly<this> {
    this.computeCachedInverse(true);
    /* hm.. can't freeze the Float64Arrays . . .
    Object.freeze(this.coffs);
    if (this.inverseCoffs)
      Object.freeze(this.inverseCoffs);
    */
    return Object.freeze(this);
  }
  /**
   *
   * @param coffs optional coefficient array. This is captured.
   */
  public constructor(coffs?: Float64Array) {
    this.coffs = coffs ? coffs : new Float64Array(9);
    this.inverseCoffs = undefined;
    this.inverseState = InverseMatrixState.unknown;
  }
  /** Return a json object containing the 9 numeric entries as a single array in row major order,
   * `[ [1, 2, 3],[ 4, 5, 6], [7, 8, 9] ]`
   */
  public toJSON(): Matrix3dProps {
    return [[this.coffs[0], this.coffs[1], this.coffs[2]],
    [this.coffs[3], this.coffs[4], this.coffs[5]],
    [this.coffs[6], this.coffs[7], this.coffs[8]]];
  }
  /** copy data from various input forms to this matrix.
   * The source can be:
   * * Another `Matrix3d`
   * * An array of 3 arrays, each of which has the 3 numbers for a row of the matrix.
   * * An array of 9 numbers in row major order.
   */
  public setFromJSON(json?: Matrix3dProps | Matrix3d): void {
    this.inverseCoffs = undefined;
    if (!json) {
      this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
      return;
    }
    if (!Array.isArray(json)) {
      if (json instanceof Matrix3d)
        this.setFrom(json);
      return;
    }

    if (Geometry.isArrayOfNumberArray(json, 3, 3)) {
      const data = json as number[][];
      this.setRowValues(
        data[0][0], data[0][1], data[0][2],
        data[1][0], data[1][1], data[1][2],
        data[2][0], data[2][1], data[2][2]);
      return;
    }

    if (json.length === 9) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], data[2],
        data[3], data[4], data[5],
        data[6], data[7], data[8]);
    } else if (json.length === 4) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], 0,
        data[2], data[3], 0,
        0, 0, 1);
    }
  }
  /** Return a new Matrix3d constructed from contents of the json value. Se `setFromJSON` for layout rules */
  public static fromJSON(json?: Matrix3dProps): Matrix3d { const result = Matrix3d.createIdentity(); result.setFromJSON(json); return result; }
  /** Test if this Matrix3d and other are within tolerance in all numeric entries.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqual(other: Matrix3d, tol?: number): boolean {
      return Geometry.isDistanceWithinTol(this.maxDiff(other), tol);
  }
  /** Test if `this` and `other` have almost equal Z column and have X and Y columns differing only by a rotation around that Z.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqualAllowZRotation(other: Matrix3d, tol?: number): boolean {
    if (this.isAlmostEqual(other, tol))
      return true;

    if (this.isAlmostEqualColumn(AxisIndex.Z, other, tol)) {
      const radians = Angle.radiansBetweenVectorsXYZ(this.coffs[0], this.coffs[3], this.coffs[6], other.coffs[0], other.coffs[3], other.coffs[6]);
      const angle = Angle.createRadians(radians);
      const columnX = this.columnX();
      const columnY = this.columnY();
      const columnZ = this.columnZ();
      let column = Vector3d.createRotateVectorAroundVector(columnX, columnZ, angle)!;
      if (other.isAlmostEqualColumnXYZ(0, column.x, column.y, column.z, tol)){
        column = Vector3d.createRotateVectorAroundVector(columnY, columnZ, angle)!;
        return other.isAlmostEqualColumnXYZ(1, column.x, column.y, column.z, tol);
      }
    }
    return false;
  }

  public isAlmostEqualColumn(columnIndex: AxisIndex, other: Matrix3d, tol?: number): boolean{
    const a = Geometry.maxAbsXYZ(
      this.coffs[columnIndex] - other.coffs[columnIndex],
      this.coffs[columnIndex + 3] - other.coffs[columnIndex + 3],
      this.coffs[columnIndex + 6] - other.coffs[columnIndex + 6]);
    return Geometry.isDistanceWithinTol(a, tol);
  }
  public isAlmostEqualColumnXYZ(columnIndex: AxisIndex, ax: number, ay: number, az: number, tol?: number): boolean{
    const a = Geometry.maxAbsXYZ(
      this.coffs[columnIndex] - ax,
      this.coffs[columnIndex + 3] - ay,
      this.coffs[columnIndex + 6] - az);
    return Geometry.isDistanceWithinTol(a, tol);
  }

  /** Test for exact (bitwise) equality with other. */
  public isExactEqual(other: Matrix3d): boolean { return this.maxDiff(other) === 0.0; }
  /** test if all entries in the z row and column are exact 001, i.e. the matrix only acts in 2d */
  public get isXY(): boolean {
    return this.coffs[2] === 0.0
      && this.coffs[5] === 0.0
      && this.coffs[6] === 0.0
      && this.coffs[7] === 0.0
      && this.coffs[8] === 1.0;
  }
  // !! does not clear supplied result !!
  private static _create(result?: Matrix3d): Matrix3d { return result ? result : new Matrix3d(); }

  /** Returns a Matrix3d populated by numeric values given in row-major order.
   *  set all entries in the matrix from call parameters appearing in row - major order, i.e.
   * ```
   * equation
   * \begin{bmatrix}a_{xx}\ a_{xy}\ a_{xz}\\ a_{yx}\ a_{yy}\ a_{yz}\\ a_{zx}\ a_{zy}\ a_{zz}\end{bmatrix}
   * ```
   * @param axx Row x, column x(0, 0) entry
   * @param axy Row x, column y(0, 1) entry
   * @param axz Row x, column z(0, 2) entry
   * @param ayx Row y, column x(1, 0) entry
   * @param ayy Row y, column y(1, 1) entry
   * @param ayz Row y, column z(1, 2) entry
   * @param azx Row z, column x(2, 0) entry
   * @param azy Row z, column y(2, 2) entry
   * @param azz row z, column z(2, 3) entry
   */
  public static createRowValues(
    axx: number, axy: number, axz: number,
    ayx: number, ayy: number, ayz: number,
    azx: number, azy: number, azz: number,
    result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    result.inverseState = InverseMatrixState.unknown;
    result.coffs[0] = axx; result.coffs[1] = axy; result.coffs[2] = axz;
    result.coffs[3] = ayx; result.coffs[4] = ayy; result.coffs[5] = ayz;
    result.coffs[6] = azx; result.coffs[7] = azy; result.coffs[8] = azz;
    return result;
  }

  /**
   * Create a Matrix3d with caller-supplied coefficients and optional inverse coefficients.
   * * The inputs are captured into the new Matrix3d.
   * * The caller is responsible for validity of the inverse coefficients.
   * @param coffs (required) array of 9 coefficients.
   * @param inverseCoffs (optional) array of 9 coefficients.
   * @returns a Matrix3d populated by a coffs array.
   */
  public static createCapture(coffs: Float64Array, inverseCoffs?: Float64Array): Matrix3d {
    const result = new Matrix3d(coffs);
    if (inverseCoffs) {
      result.inverseCoffs = inverseCoffs;
      result.inverseState = InverseMatrixState.inverseStored;
    } else {
      result.inverseState = InverseMatrixState.unknown;
    }
    return result;
  }

  /**
   * create a matrix by distributing vectors to columns in one of 6 orders.
   * @param axisOrder identifies where the columns are placed.
   * @param columnA vector to place in the first column named by the axis order.
   * @param columnB vector to place in the second column named by the axis order.
   * @param columnC vector to place in the third column named by the axis order.
   * @param result
   */
  public static createColumnsInAxisOrder(axisOrder: AxisOrder, columnA: Vector3d, columnB: Vector3d, columnC: Vector3d | undefined, result?: Matrix3d) {
    if (!result) result = new Matrix3d();
    if (axisOrder === AxisOrder.YZX) {
      result.setColumns(columnC, columnA, columnB);
    } else if (axisOrder === AxisOrder.ZXY) {
      result.setColumns(columnB, columnC, columnA);
    } else if (axisOrder === AxisOrder.XZY) {
      result.setColumns(columnA, columnC, columnB);
    } else if (axisOrder === AxisOrder.YXZ) {
      result.setColumns(columnB, columnA, columnC);
    } else if (axisOrder === AxisOrder.ZYX) {
      result.setColumns(columnC, columnB, columnA);
    } else {  // fallthrough should only happen for AxisOrder.XYZ
      result.setColumns(columnA, columnB, columnC);
    }
    return result;
  }

  /**
   *  set all entries in the matrix from call parameters appearing in row-major order.
   * @param axx Row x, column x (0,0) entry
   * @param axy Row x, column y (0,1) entry
   * @param axz Row x, column z (0,2) entry
   * @param ayx Row y, column x (1,0) entry
   * @param ayy Row y, column y (1,1) entry
   * @param ayz Row y, column z (1,2) entry
   * @param azx Row z, column x (2,0) entry
   * @param azy Row z, column y (2,2) entry
   * @param azz row z, column z (2,3) entry
   */
  public setRowValues(
    axx: number, axy: number, axz: number,
    ayx: number, ayy: number, ayz: number,
    azx: number, azy: number, azz: number): void {
    this.coffs[0] = axx; this.coffs[1] = axy; this.coffs[2] = axz;
    this.coffs[3] = ayx; this.coffs[4] = ayy; this.coffs[5] = ayz;
    this.coffs[6] = azx; this.coffs[7] = azy; this.coffs[8] = azz;
    this.inverseState = InverseMatrixState.unknown;
  }
  /** Set the matrix to an identity. */
  public setIdentity() { this.setRowValues(1, 0, 0, 0, 1, 0, 0, 0, 1); this.setupInverseTranspose(); }
  /** Set the matrix to all zeros. */
  public setZero() { this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0); this.inverseState = InverseMatrixState.singular; }
  /** copy contents from another matrix. */
  public setFrom(other: Matrix3d | undefined) {
    if (other === undefined) {
      this.setIdentity();
    } else if (other !== this) {
      for (let i = 0; i < 9; i++)
        this.coffs[i] = other.coffs[i];
      if (other.inverseState === InverseMatrixState.inverseStored && other.inverseCoffs !== undefined) {
        this.createInverseCoffsWithZeros();
        for (let i = 0; i < 9; i++)
          this.inverseCoffs![i] = other.inverseCoffs[i];
        this.inverseState = InverseMatrixState.inverseStored;
      } else if (other.inverseState !== InverseMatrixState.inverseStored) {
        this.inverseState = other.inverseState;
      } else {  // This is reached of other says stored but does not have coffs.  This should not happen.
        this.inverseState = InverseMatrixState.unknown;
      }
    }
  }

  /** return a clone of this matrix.
   * * coefficients are copied.
   * * inverse coefficients are NOT copied.
   * * inverse status is set to unknown
   */
  public clone(result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    result.setFrom(this);
    return result;
  }
  /** create a matrix with all zeros.
   * * Note that for geometry transformations "all zeros" is not a useful default state.
   * * Hence almost always use `createIdentity` for graphics transformations.
   * * "all zeros" is appropriate for summing moment data.
   * ```
   * equation
   * \begin{bmatrix}0 0 0 \\ 0 0 0 \\ 0 0 0\end{bmatrix}
   * ```
   */
  public static createZero(): Matrix3d {
    const retVal = new Matrix3d();
    retVal.inverseState = InverseMatrixState.singular;
    return retVal;
  }
  /** create an identity matrix.
   * * all diagonal entries (xx,yy,zz) are one
   * * all others are zero.
   * * This (rather than all zeros) is the useful state for most graphics transformations.
   * ```
   * equation
   * \begin{bmatrix}1 0 0 \\ 0 1 0 \\ 0 0 1\end{bmatrix}
   * ```
   *
   */
  public static createIdentity(result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    result.setIdentity();
    return result;
  }

  /**
   * Create a matrix with uniform scale factors.
   * For scale factor _s_,
   * ```
   * equation
   * \begin{bmatrix}s & 0 & 0 \\ 0 & s & 0\\ 0 & 0 & s\end{bmatrix}
   * ```
   */
  public static createUniformScale(scaleFactor: number): Matrix3d {
    return Matrix3d.createScale(scaleFactor, scaleFactor, scaleFactor);
  }
  /**
   * Construct a rigid matrix using createHeadsUpPerpendicular to generate a vector perpendicular to vectorA..
   * *
   */
  public static createRigidHeadsUp(vectorA: Vector3d, axisOrder: AxisOrder = AxisOrder.ZXY, result?: Matrix3d): Matrix3d {
    const vectorB = Matrix3d.createPerpendicularVectorFavorXYPlane(vectorA);
    const matrix = Matrix3d.createRigidFromColumns(vectorA, vectorB, axisOrder, result);
    if (matrix) {
      matrix.setupInverseTranspose();
      return matrix;
    }
    return Matrix3d.createIdentity(result);
  }
  /**
   * return a vector that is perpendicular to the input direction.
   * * Among the infinite number of perpendiculars possible, this method
   * favors having one in the xy plane.
   * * Hence, when vectorA is NOT close to the Z axis, the returned vector is Z cross vectorA.
   * * But vectorA is close to the Z axis, the returned vector is unitY cross vectorA.
   */
  public static createPerpendicularVectorFavorXYPlane(vector: Vector3d, result?: Vector3d): Vector3d {
    const a = vector.magnitude();
    const b = a / 64.0;   // A constant from the dawn of time in the CAD industry.
    if (Math.abs(vector.x) < b && Math.abs(vector.y) < b) {
      return Vector3d.createCrossProduct(vector.x, vector.y, vector.z, 0, -1, 0, result);
    }
    return Vector3d.createCrossProduct(0, 0, 1, vector.x, vector.y, vector.z, result);
  }

  /**
   * return a vector that is perpendicular to the input direction.
   * * Among the infinite number of perpendiculars possible, this method
   * favors having one near the Z.
   * That is achieved by crossing "this" vector with the result of createHeadsUpPerpendicularFavorXYPlane.
   */
  public static createPerpendicularVectorFavorPlaneContainingZ(vector: Vector3d, result?: Vector3d): Vector3d {
    result = Matrix3d.createPerpendicularVectorFavorXYPlane(vector, result);
    return vector.crossProduct(result, result);
  }

  /** Create a matrix with distinct x,y,z diagonal (scale) entries.
   * ```
   * equation
   * \begin{bmatrix}s_x & 0 & 0 \\ 0 & s_y & 0\\ 0 & 0 & s_z\end{bmatrix}
   * ```
   */
  public static createScale(scaleFactorX: number, scaleFactorY: number, scaleFactorZ: number, result?: Matrix3d): Matrix3d {
    if (result)
      result.setZero();
    else
      result = new Matrix3d();

    result.coffs[0] = scaleFactorX;
    result.coffs[4] = scaleFactorY;
    result.coffs[8] = scaleFactorZ;
    if (scaleFactorX === 0 || scaleFactorY === 0 || scaleFactorZ === 0) {
      result.inverseState = InverseMatrixState.singular;
    } else {
      result.inverseState = InverseMatrixState.inverseStored;
      result.inverseCoffs = Float64Array.from([1 / scaleFactorX, 0, 0,
        0, 1 / scaleFactorY, 0,
        0, 0, 1 / scaleFactorZ]);
    }
    return result;
  }

  /** return a rotation of specified angle around an axis */
  public static createRotationAroundVector(axis: Vector3d, angle: Angle, result?: Matrix3d): Matrix3d | undefined {
    const c = angle.cos();
    const s = angle.sin();
    const v = 1.0 - c;
    const unit = axis.normalize();
    if (unit) {
      const retVal = Matrix3d.createRowValues(
        unit.x * unit.x * v + c,
        unit.x * unit.y * v - s * unit.z,
        unit.x * unit.z * v + s * unit.y,
        unit.y * unit.x * v + s * unit.z,
        unit.y * unit.y * v + c,
        unit.y * unit.z * v - s * unit.x,
        unit.z * unit.x * v - s * unit.y,
        unit.z * unit.y * v + s * unit.x,
        unit.z * unit.z * v + c, result);
      retVal.setupInverseTranspose();
      return retVal;
    }
    return undefined;
  }

  /** Returns a rotation of specified angle around an axis
   * @param axisIndex index of axis (AxisIndex.X, AxisIndex.Y, AxisIndex.Z) kept fixed by the rotation.
   * @param angle angle of rotation
   * @param result optional result matrix.
   */
  public static createRotationAroundAxisIndex(axisIndex: AxisIndex, angle: Angle, result?: Matrix3d): Matrix3d {
    const c = angle.cos();
    const s = angle.sin();
    let myResult;
    if (axisIndex === AxisIndex.X) {
      myResult = Matrix3d.createRowValues(
        1, 0, 0,
        0, c, -s,
        0, s, c,
        result);
    } else if (axisIndex === AxisIndex.Y) {
      myResult = Matrix3d.createRowValues(
        c, 0, s,
        0, 1, 0,
        -s, 0, c,
        result);
    } else {
      myResult = Matrix3d.createRowValues(
        c, -s, 0,
        s, c, 0,
        0, 0, 1,
        result);
    }
    myResult.setupInverseTranspose();
    return myResult;
  }

  /** Create a matrix from "as viewed" right and up vectors.
   * * ColumnX points in the rightVector direction
   * * ColumnY points in in the upVectorDirection
   * * ColumnZ is a unit cross product.
   * Optionally rotate the standard cube by 45 to bring its left or right vertical edge to center
   * * leftNoneRight = [-1,0,1] respectively for left edge, no rotation, or right edge
   * * bottomNoneTop = [-1,0,1] respectively for isometric rotation to view the bottom, no isometric rotation, and isometric rotation to view the top
   * This is expected to be used with various principal unit vectors that are perpendicular to each other.
   *  * STANDARD TOP VIEW: (Vector3d.UnitX (), Vector3d.UnitY (), 0, 0)
   *  * STANDARD FRONT VIEW: (Vector3d.UnitX (), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD BACK VIEW: (Vector3d.UnitX (-1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD RIGHT VIEW: (Vector3d.UnitY (1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD LEFT VIEW: (Vector3d.UnitY (-1), Vector3d.UnitZ (), 0, 0)
   *  * STANDARD BOTTOM VIEW: (Vector3d.UnitX (1), Vector3d.UnitY (-1), 0, 0)
   * @param leftNoneRight Normally one of {-1,0,1}, where (-1) indicates the left vertical is rotated to center and (1) for right.  Other numbers are used as multiplier for this 45 degree rotation
   * @returns undefined if columnX, columnY are coplanar.
   */
  public static createViewedAxes(rightVector: Vector3d, upVector: Vector3d, leftNoneRight: number = 0, topNoneBottom: number = 0): Matrix3d | undefined {
    const columnZ = rightVector.crossProduct(upVector);
    if (columnZ.normalizeInPlace()) {
      const geometry = Matrix3d.createColumns(rightVector, upVector, columnZ);
      if (leftNoneRight !== 0.0) {
        let c = Math.sqrt(0.5);
        let s = leftNoneRight < 0.0 ? -c : c;
        if (Math.abs(leftNoneRight) !== 1.0) {
          const radians = Angle.degreesToRadians(45.0 * leftNoneRight);
          c = Math.cos(radians);
          s = Math.sin(radians);
        }
        geometry.applyGivensColumnOp(2, 0, c, s);   // rotate around Y
      }
      if (topNoneBottom !== 0.0) {
        const theta = topNoneBottom * Math.atan(Math.sqrt(0.5));
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        geometry.applyGivensColumnOp(1, 2, c, -s); // rotate around X
      }
      return geometry;
    }
    return undefined;
  }
  /**
   * Create a rotation matrix for one of the 8 standard views.
   * * With `invert === false` the return is such that `matrix.multiply(worldVector)` returns the vector as seen in the xy (projected) coordinates of the view.
   * * With invert === true the matrix is transposed so that `matrix.multiply(viewVector` maps the "in view" vector to a world vector.
   *
   * @param index standard view index `StandardViewIndex.Top, Bottom, LEft, Right, Front, Back, Iso, LeftIso`
   * @param invert if false (default), the returned Matrix3d "projects" world vectors into XY view vectors.  If true, it is inverted to map view vectors to world.
   * @param result optional result.
   */
  public static createStandardWorldToView(index: StandardViewIndex, invert: boolean = false, result?: Matrix3d): Matrix3d {
    switch (index) {

      case StandardViewIndex.Bottom:
        result = Matrix3d.createRowValues(
          1, 0, 0,
          0, -1, 0,
          0, 0, -1);
        break;
      case StandardViewIndex.Left:
        result = Matrix3d.createRowValues(
          0, -1, 0,
          0, 0, 1,
          -1, 0, 0);
        break;
      case StandardViewIndex.Right:
        result = Matrix3d.createRowValues(
          0, 1, 0,
          0, 0, 1,
          1, 0, 0);
        break;
      case StandardViewIndex.Front: // 0-based 4
        result = Matrix3d.createRowValues(
          1, 0, 0,
          0, 0, 1,
          0, -1, 0);
        break;
      case StandardViewIndex.Back: // 0-based 5
        result = Matrix3d.createRowValues(
          -1, 0, 0,
          0, 0, 1,
          0, 1, 0);
        break;
      case StandardViewIndex.Iso:
        result = Matrix3d.createRowValues(
          0.707106781186548, -0.70710678118654757, 0.00000000000000000,
          0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          -0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      case StandardViewIndex.RightIso:
        result = Matrix3d.createRowValues(
          0.707106781186548, 0.70710678118654757, 0.00000000000000000,
          -0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      case StandardViewIndex.Top:
      default:
        result = Matrix3d.createIdentity(result);
    }
    if (invert)
      result.transposeInPlace();
    return result;
  }
  /*
  // this implementation has problems distinguishing failure (normalize) from small angle.
  public getAxisAndAngleOfRotation(): { axis: Vector3d, angle: Angle, error: boolean } {

    const result = { axis: Vector3d.unitZ(), angle: Angle.createRadians(0), error: true };
    if (this.isIdentity) {
      result.error = false;
      return result;
    }
    if (!this.isRigid())
      return result;
    const QMinusI = this.clone();
    QMinusI.coffs[0] -= 1.0;
    QMinusI.coffs[4] -= 1.0;
    QMinusI.coffs[8] -= 1.0;
    // Each column of (Q - I) is the motion of the corresponding axis vector
    // during the rotation.
    // Only one of the three axes can really be close to the rotation axis.
    const delta0 = QMinusI.columnX();
    const delta1 = QMinusI.columnY();
    const delta2 = QMinusI.columnZ();
    const cross01 = delta0.crossProduct(delta1);
    const cross12 = delta1.crossProduct(delta2);
    const cross20 = delta2.crossProduct(delta0);

    const aa01 = cross01.magnitudeSquared();
    const aa12 = cross12.magnitudeSquared();
    const aa20 = cross20.magnitudeSquared();

    const cross = cross01.clone(); // This will end up as the biggest cross product
    const v0 = delta0.clone();  // This will end up as one of the two largest delta vectors
    let aaMax = aa01;
    if (aa12 > aaMax) {
      cross.setFrom(cross12);
      aaMax = aa12;
      v0.setFrom(delta1);
    }
    if (aa20 > aaMax) {
      cross.setFrom(cross20);
      aaMax = aa20;
      v0.setFrom(delta2);
    }

    if (aaMax === 0.0) {
      // The vectors did not move.  Just accept the zero rotation, with error flag set.
      return result;
    }

    v0.normalizeInPlace();
    // V0 is a unit vector perpendicular to the rotation axis.
    // Rotate it.   Its image V1 is also a unit vector, and the angle from V0 to V1 is the quat angle.
    // CrossProduct is axis vector times sine of angle.
    // Dot Product is cosine of angle.
    // V2 is zero in 180 degree case, so we use the Cross from the search as the axis
    //   as direction, being careful to keep sine positive.
    const v1 = this.multiplyVector(v0);
    const v2 = v0.crossProduct(v1);
    const sine = v2.magnitude();
    if (v2.dotProduct(cross) < 0.0)
      cross.scaleInPlace(-1.0);
    const cosine = v0.dotProduct(v1);
    result.angle.setRadians(Math.atan2(sine, cosine));
    result.axis.setFrom(cross);
    result.error = !result.axis.tryNormalizeInPlace();
    return result
  }
*/
  /**
   * Compute the (unit vector) axis and angle of rotation.
   * @returns Returns with result.ok === true when the conversion succeeded.
   */
  public getAxisAndAngleOfRotation(): { axis: Vector3d, angle: Angle, ok: boolean } {
    const trace = this.coffs[0] + this.coffs[4] + this.coffs[8];
    // trace = (xx + yy * zz) * (1-c) + 3 * c = 1 + 2c ==> c = (trace-1) / 2
    const skewXY = this.coffs[3] - this.coffs[1];  // == 2sz
    const skewYZ = this.coffs[7] - this.coffs[5]; // == 2sx
    const skewZX = this.coffs[2] - this.coffs[6]; // == 2sy
    const c = (trace - 1.0) / 2.0;
    const s = Geometry.hypotenuseXYZ(skewXY, skewYZ, skewZX) / 2.0;
    const e = c * c + s * s - 1.0;
    if (Math.abs(e) > Geometry.smallAngleRadians) {
      // the sine and cosine are not a unit circle point.   bad matrix . ..
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
    }
    if (Math.abs(s) < Geometry.smallAngleRadians) {
      // There is no significant skew.
      // The matrix is symmetric
      // So it has simple eigenvalues -- either (1,1,1) or (1,-1,-1).
      if (c > 0)  // no rotation
        return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: true };
      // 180 degree flip around some axis ?
      // Look for the simple case of a principal rotation ...
      // look for a pair of (-1) entries on the diagonal ...
      const axx = this.coffs[0];
      const ayy = this.coffs[4];
      const azz = this.coffs[8];
      const theta180 = Angle.createDegrees(180);
      // Look for principal axis flips as a special case . ..
      if (Geometry.isAlmostEqualNumber(-1.0, ayy) && Geometry.isAlmostEqualNumber(-1, azz)) {
        // rotate around
        return { axis: Vector3d.create(1, 0, 0), angle: theta180, ok: true };
      } else if (Geometry.isAlmostEqualNumber(-1.0, axx) && Geometry.isAlmostEqualNumber(-1, azz)) {
        return { axis: Vector3d.create(0, 1, 0), angle: theta180, ok: true };
      } else if (Geometry.isAlmostEqualNumber(-1.0, axx) && Geometry.isAlmostEqualNumber(-1, ayy)) {
        return { axis: Vector3d.create(0, 0, 1), angle: theta180, ok: true };
      }

      // 180 degree flip around some other axis ...
      // eigenvalues will have 1.0 once, -1.0 twice.
      // These cases look for each place (x,y,z) that the 1.0 might appear.
      // But fastSymmetricEigenvalues reliably always seems to put the 1.0 as the x eigenvalue.
      // so only the getColumn(0) return seems reachable in unit tests.
      const eigenvectors = Matrix3d.createIdentity();
      const eigenvalues = Vector3d.create(0, 0, 0);
      if (this.fastSymmetricEigenvalues(eigenvectors, eigenvalues)) {
        for (let axisIndex = 0; axisIndex < 2; axisIndex++) {
          const lambda = eigenvalues.at(axisIndex);
          if (Geometry.isAlmostEqualNumber(1, lambda))
            return { axis: eigenvectors.getColumn(axisIndex), angle: theta180, ok: true };
        }
        // Don't know if this can be reached ....
        return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
      }
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
    }
    const a = 1.0 / (2.0 * s);
    const result = { axis: Vector3d.create(skewYZ * a, skewZX * a, skewXY * a), angle: Angle.createAtan2(s, c), ok: true };
    return result;
  }
  /**
   * Returns a matrix that rotates from vectorA to vectorB.
   */
  public static createRotationVectorToVector(vectorA: Vector3d, vectorB: Vector3d, result?: Matrix3d): Matrix3d | undefined {
    return this.createPartialRotationVectorToVector(vectorA, 1.0, vectorB, result);
  }
  /**
   * Return a matrix that rotates a fraction of the angular sweep from vectorA to vectorB.
   * @param vectorA initial vector position
   * @param fraction fractional rotation.  1.0 is "all the way"
   * @param vectorB final vector position
   * @param result optional result matrix.
   */
  public static createPartialRotationVectorToVector(vectorA: Vector3d, fraction: number, vectorB: Vector3d, result?: Matrix3d): Matrix3d | undefined {

    let upVector = vectorA.unitCrossProduct(vectorB);
    if (upVector) {  // the usual case --
      return Matrix3d.createRotationAroundVector(upVector,
        Angle.createRadians(fraction * vectorA.planarAngleTo(vectorB, upVector).radians));
    }
    // fail if either vector is zero ...
    if (Geometry.isSmallMetricDistance(vectorA.magnitude())
      || Geometry.isSmallMetricDistance(vectorB.magnitude()))
      return undefined;
    // nonzero but aligned vectors ...
    if (vectorA.dotProduct(vectorB) > 0.0)
      return Matrix3d.createIdentity(result);
    // nonzero opposing vectors ..
    upVector = Matrix3d.createPerpendicularVectorFavorPlaneContainingZ(vectorA, upVector);
    return Matrix3d.createRotationAroundVector(upVector, Angle.createRadians(fraction * Math.PI));
  }

  /** Create a 90 degree rotation around a principal axis */
  public static create90DegreeRotationAroundAxis(axisIndex: number): Matrix3d {
    axisIndex = Geometry.cyclic3dAxis(axisIndex);
    if (axisIndex === 0) {
      const retVal = Matrix3d.createRowValues(
        1, 0, 0,
        0, 0, -1,
        0, 1, 0);
      retVal.setupInverseTranspose();
      return retVal;
    } else if (axisIndex === 1) {
      const retVal = Matrix3d.createRowValues(
        0, 0, 1,
        0, 1, 0,
        -1, 0, 0);
      retVal.setupInverseTranspose();
      return retVal;
    } else {
      const retVal = Matrix3d.createRowValues(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1);
      retVal.setupInverseTranspose();
      return retVal;
    }
  }

  /** Return (a copy of) the X column */
  public columnX(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[0], this.coffs[3], this.coffs[6], result); }
  /** Return (a copy of)the Y column */
  public columnY(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[1], this.coffs[4], this.coffs[7], result); }
  /** Return (a copy of)the Z column */
  public columnZ(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[2], this.coffs[5], this.coffs[8], result); }

  /** Return the X column magnitude squared */
  public columnXMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[0], this.coffs[3], this.coffs[6]); }
  /** Return the Y column magnitude squared */
  public columnYMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[1], this.coffs[4], this.coffs[7]); }
  /** Return the Z column magnitude squared */
  public columnZMagnitudeSquared(): number { return Geometry.hypotenuseSquaredXYZ(this.coffs[2], this.coffs[5], this.coffs[8]); }

  /** Return the X column magnitude */
  public columnXMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[3], this.coffs[6]); }
  /** Return the Y column magnitude */
  public columnYMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[1], this.coffs[4], this.coffs[7]); }
  /** Return the Z column magnitude */
  public columnZMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[2], this.coffs[5], this.coffs[8]); }

  /** Return magnitude of columnX cross columnY. */
  public columnXYCrossProductMagnitude(): number {
    return Geometry.crossProductMagnitude(
      this.coffs[0], this.coffs[3], this.coffs[6],
      this.coffs[1], this.coffs[4], this.coffs[7]);
  }

  /** Return the X row magnitude d */
  public rowXMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[1], this.coffs[2]); }
  /** Return the Y row magnitude  */
  public rowYMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[3], this.coffs[4], this.coffs[5]); }
  /** Return the Z row magnitude  */
  public rowZMagnitude(): number { return Geometry.hypotenuseXYZ(this.coffs[6], this.coffs[7], this.coffs[8]); }
  /** Return the dot product of column X with column Y */
  /** Return the dot product of column X with column Y */
  public columnXDotColumnY(): number {
    return this.coffs[0] * this.coffs[1]
      + this.coffs[3] * this.coffs[4]
      + this.coffs[6] * this.coffs[7];
  }
  /**
   * Dot product of an indexed column with a vector given as x,y,z
   * @param columnIndex index of column.  Must be 0,1,2
   * @param x x component of vector
   * @param y y component of vector
   * @param z z component of vector
   */
  public columnDotXYZ(columnIndex: AxisIndex, x: number, y: number, z: number) {
    return this.coffs[columnIndex] * x + this.coffs[columnIndex + 3] * y + this.coffs[columnIndex + 6] * z;
  }

  /** Return (a copy of) the X row */
  public rowX(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[0], this.coffs[1], this.coffs[2], result); }
  /** Return (a copy of) the Y row */
  public rowY(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[3], this.coffs[4], this.coffs[5], result); }
  /** Return (a copy of) the Z row */
  public rowZ(result?: Vector3d): Vector3d { return Vector3d.create(this.coffs[6], this.coffs[7], this.coffs[8], result); }

  /** Return the dot product of the vector parameter with the X column. */
  public dotColumnX(vector: XYZ): number { return vector.x * this.coffs[0] + vector.y * this.coffs[3] + vector.z * this.coffs[6]; }
  /** Return the dot product of the vector parameter with the Y column. */
  public dotColumnY(vector: XYZ): number { return vector.x * this.coffs[1] + vector.y * this.coffs[4] + vector.z * this.coffs[7]; }
  /** Return the dot product of the vector parameter with the Z column. */
  public dotColumnZ(vector: XYZ): number { return vector.x * this.coffs[2] + vector.y * this.coffs[5] + vector.z * this.coffs[8]; }

  /** Return the dot product of the vector parameter with the X row. */
  public dotRowX(vector: XYZ): number { return vector.x * this.coffs[0] + vector.y * this.coffs[1] + vector.z * this.coffs[2]; }
  /** Return the dot product of the vector parameter with the Y row. */
  public dotRowY(vector: XYZ): number { return vector.x * this.coffs[3] + vector.y * this.coffs[4] + vector.z * this.coffs[5]; }
  /** Return the dot product of the vector parameter with the Z row. */
  public dotRowZ(vector: XYZ): number { return vector.x * this.coffs[6] + vector.y * this.coffs[7] + vector.z * this.coffs[8]; }

  // cSpell:words XXYZ YXYZ ZXYZ XYZAs Eigen
  /** Return the dot product of the x,y,z with the X row. */
  public dotRowXXYZ(x: number, y: number, z: number): number { return x * this.coffs[0] + y * this.coffs[1] + z * this.coffs[2]; }
  /** Return the dot product of the x,y,z with the Y row. */
  public dotRowYXYZ(x: number, y: number, z: number): number { return x * this.coffs[3] + y * this.coffs[4] + z * this.coffs[5]; }
  /** Return the dot product of the x,y,z with the Z row. */
  public dotRowZXYZ(x: number, y: number, z: number): number { return x * this.coffs[6] + y * this.coffs[7] + z * this.coffs[8]; }

  /** Return the (vector) cross product of the Z column with the vector parameter. */
  public columnZCrossVector(vector: XYZ, result?: Vector3d): Vector3d {
    return Geometry.crossProductXYZXYZ(this.coffs[2], this.coffs[5], this.coffs[8], vector.x, vector.y, vector.z, result);
  }
  /**
   * Replace current rows Ui Uj with (c*Ui - s*Uj) and (c*Uj + s*Ui).
   * @param i first row index.  must be 0,1,2 (unchecked)
   * @param j second row index. must be 0,1,2 (unchecked)
   * @param c fist coefficient
   * @param s second coefficient
   */
  private applyGivensRowOp(i: number, j: number, c: number, s: number): void {
    let ii = 3 * i;
    let jj = 3 * j;
    const limit = ii + 3;
    for (; ii < limit; ii++, jj++) {
      const a = this.coffs[ii];
      const b = this.coffs[jj];
      this.coffs[ii] = a * c + b * s;
      this.coffs[jj] = -a * s + b * c;
    }
  }
  /**
   * Replace current columns Ui Uj with (c*Ui - s*Uj) and (c*Uj + s*Ui).
   * * This is used in compute intensive inner loops -- there is no checking for i,j being 0,1,2.
   * @param i first row index.  must be 0,1,2 (unchecked)
   * @param j second row index. must be 0,1,2 (unchecked)
   * @param c fist coefficient
   * @param s second coefficient
   */
  public applyGivensColumnOp(i: number, j: number, c: number, s: number): void {
    const limit = i + 9;
    for (; i < limit; i += 3, j += 3) {
      const a = this.coffs[i];
      const b = this.coffs[j];
      this.coffs[i] = a * c + b * s;
      this.coffs[j] = -a * s + b * c;
    }
  }

  /**
   * create a rigid coordinate frame column z parallel to (_x_,_y_,_z_) and column x in the xy plane.
   * * column z points from origin to x,y,z
   * * column x is perpendicular and in the xy plane
   * * column y is perpendicular to both.  It is the "up" vector on the view plane.
   * * Multiplying a world vector times the transpose of this matrix transforms into the view xy
   * * Multiplying the matrix times the an in-view vector transforms the vector to world.
   * @param x eye x coordinate
   * @param y eye y coordinate
   * @param z eye z coordinate
   * @param result
   */
  public static createRigidViewAxesZTowardsEye(x: number, y: number, z: number, result?: Matrix3d): Matrix3d {
    result = Matrix3d.createIdentity(result);
    const rxy = Geometry.hypotenuseXY(x, y);
    if (Geometry.isSmallMetricDistance(rxy)) {
      // special case for top or bottom view.
      if (z < 0.0)
        result.scaleColumnsInPlace(1.0, -1, -1.0);
    } else {
      //      const d = Geometry.hypotenuseSquaredXYZ(x, y, z);
      const c = x / rxy;
      const s = y / rxy;
      result.setRowValues(
        -s, 0, c,
        c, 0, s,
        0, 1, 0);
      if (z !== 0.0) {
        const r = Geometry.hypotenuseXYZ(x, y, z);
        const s1 = z / r;
        const c1 = rxy / r;
        result.applyGivensColumnOp(1, 2, c1, -s1);
      }
    }
    return result;
  }
  /** Rotate so columns i and j become perpendicular */
  private applyJacobiColumnRotation(i: number, j: number, matrixU: Matrix3d): number {
    const uDotU = this.coffs[i] * this.coffs[i] + this.coffs[i + 3] * this.coffs[i + 3] + this.coffs[i + 6] * this.coffs[i + 6];
    const vDotV = this.coffs[j] * this.coffs[j] + this.coffs[j + 3] * this.coffs[j + 3] + this.coffs[j + 6] * this.coffs[j + 6];
    const uDotV = this.coffs[i] * this.coffs[j] + this.coffs[i + 3] * this.coffs[j + 3] + this.coffs[i + 6] * this.coffs[j + 6];
    // const c2 = uDotU - vDotV;
    // const s2 = 2.0 * uDotV;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(uDotU - vDotV, 2.0 * uDotV);
    // const h = Math.hypot(c2, s2);
    // console.log(" c2 s2", c2 / h, s2 / h);
    // console.log(" C S ", Math.cos(2 * jacobi.radians), Math.sin(2 * jacobi.radians));
    // console.log("i j uDotV", i, j, uDotV);
    if (Math.abs(jacobi.s) < 2.0e-15)
      return 0.0;
    this.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);
    matrixU.applyGivensRowOp(i, j, jacobi.c, jacobi.s);
    // const BTB = this.multiplyMatrixTransposeMatrix(this);
    // console.log("BTB", BTB.at(0, 0), BTB.at(1, 1), BTB.at(2, 2), "       off", BTB.at(0, 1), BTB.at(0, 2), BTB.at(1, 2), "  at(i,j)", BTB.at(i, j));
    return Math.abs(uDotV);
  }
  /**
   * Factor this as a product C * U where C has mutually perpendicular columns and
   * U is orthogonal.
   * @param matrixC (allocate by caller, computed here)
   * @param factor  (allocate by caller, computed here)
   */
  public factorPerpendicularColumns(matrixC: Matrix3d, matrixU: Matrix3d): boolean {
    matrixC.setFrom(this);
    matrixU.setIdentity();
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = matrixC.applyJacobiColumnRotation(0, 1, matrixU)
        + matrixC.applyJacobiColumnRotation(0, 2, matrixU)
        + matrixC.applyJacobiColumnRotation(1, 2, matrixU);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("jacobi iterations", iteration);
        return true;
      }
    }
    return false;
  }
  /** Apply a jacobi step to lambda which evolves towards diagonal. */
  private applySymmetricJacobi(i: number, j: number, lambda: Matrix3d): number {
    const uDotU = lambda.at(i, i);
    const vDotV = lambda.at(j, j);
    const uDotV = lambda.at(i, j);
    if (Math.abs(uDotV) < 1.0e-15 * (uDotU + vDotV))
      return 0.0;
    // const c2 = uDotU - vDotV;
    // const s2 = 2.0 * uDotV;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(uDotU - vDotV, 2.0 * uDotV);
    // const h = Math.hypot(c2, s2);
    // console.log(" c2 s2", c2 / h, s2 / h);
    // console.log(" C S ", Math.cos(2 * jacobi.radians), Math.sin(2 * jacobi.radians));
    // console.log("i j uDotV", i, j, uDotV);
    if (Math.abs(jacobi.s) < 2.0e-15)
      return 0.0;
    // Factored form is this *lambda * thisTranspose
    // Let Q be the rotation matrix.  Q*QT is inserted, viz
    //          this*Q * QT * lambda * Q*thisTranspose
    this.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);

    lambda.applyGivensRowOp(i, j, jacobi.c, jacobi.s);
    lambda.applyGivensColumnOp(i, j, jacobi.c, jacobi.s);
    // const BTB = this.multiplyMatrixTransposeMatrix(this);
    // console.log("BTB", BTB.at(0, 0), BTB.at(1, 1), BTB.at(2, 2), "       off", BTB.at(0, 1), BTB.at(0, 2), BTB.at(1, 2), "  at(i,j)", BTB.at(i, j));
    return Math.abs(uDotV);
  }
  /**
   * Factor this (symmetrized) as a product U * lambda * UT where U is orthogonal, lambda is diagonal.
   * The upper triangle is mirrored to lower triangle to enforce symmetry.
   * @param matrixC (allocate by caller, computed here)
   * @param factor  (allocate by caller, computed here)
   */
  public symmetricEigenvalues(leftEigenvectors: Matrix3d, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    matrix.coffs[3] = matrix.coffs[1];
    matrix.coffs[6] = matrix.coffs[2];
    matrix.coffs[7] = matrix.coffs[5];
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = leftEigenvectors.applySymmetricJacobi(0, 1, matrix)
        + leftEigenvectors.applySymmetricJacobi(0, 2, matrix)
        + leftEigenvectors.applySymmetricJacobi(1, 2, matrix);
      // console.log("symmetric sum", sum);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("symmetric iterations", iteration);
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }

  /** Apply (in place a jacobi update that zeros out this.at(i,j).
   *
   */
  private applyFastSymmetricJacobiUpdate(
    i: number,  // row index of zeroed member
    j: number,  // column index of zeroed member
    k: number,  // other row/column index (different from i and j)
    leftEigenVectors: Matrix3d): number {
    const indexII = 4 * i;
    const indexJJ = 4 * j;
    const indexIJ = 3 * i + j;
    const indexIK = 3 * i + k;
    const indexJK = 3 * j + k;
    const dotUU = this.coffs[indexII];
    const dotVV = this.coffs[indexJJ];
    const dotUV = this.coffs[indexIJ];
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(dotUU - dotVV, 2.0 * dotUV);
    if (Math.abs(dotUV) < 1.0e-15 * (dotUU + dotVV))
      return 0.0;
    const c = jacobi.c;
    const s = jacobi.s;
    const cc = c * c;
    const ss = s * s;
    const sc2 = 2.0 * c * s;
    this.coffs[indexII] = cc * dotUU + sc2 * dotUV + ss * dotVV;
    this.coffs[indexJJ] = ss * dotUU - sc2 * dotUV + cc * dotVV;
    this.coffs[indexIJ] = 0.0;
    const a = this.coffs[indexIK];
    const b = this.coffs[indexJK];
    this.coffs[indexIK] = a * c + b * s;
    this.coffs[indexJK] = -s * a + c * b;
    this.coffs[3 * j + i] = 0.0;
    this.coffs[3 * k + i] = this.coffs[indexIK];
    this.coffs[3 * k + j] = this.coffs[indexJK];
    leftEigenVectors.applyGivensColumnOp(i, j, c, s);
    return Math.abs(dotUV);
  }

  /**
   * Factor this (symmetrized) as a product U * lambda * UT where U is orthogonal, lambda is diagonal.
   * The upper triangle is mirrored to lower triangle to enforce symmetry.
   * @param matrixC (allocate by caller, computed here)
   * @param factor  (allocate by caller, computed here)
   */
  public fastSymmetricEigenvalues(leftEigenvectors: Matrix3d, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    const ss = this.sumSquares();
    const tolerance = 1.0e-12 * ss;
    for (let iteration = 0; iteration < 7; iteration++) {
      const sum = matrix.applyFastSymmetricJacobiUpdate(0, 1, 2, leftEigenvectors)
        + matrix.applyFastSymmetricJacobiUpdate(0, 2, 1, leftEigenvectors)
        + matrix.applyFastSymmetricJacobiUpdate(1, 2, 0, leftEigenvectors);
      // console.log("symmetric sum", sum);
      // console.log ("   sum", sum);
      if (sum < tolerance) {
        // console.log("symmetric iterations", iteration);
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }
  /**
   * Create a matrix from column vectors.
   * ```
   * equation
   * \begin{bmatrix}U_x & V_x & W_x \\ U_y & V_y & W_y \\ U_z & V_z & W_z \end{bmatrix}
   * ```
   */
  public static createColumns(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        vectorU.x, vectorV.x, vectorW.x,
        vectorU.y, vectorV.y, vectorW.y,
        vectorU.z, vectorV.z, vectorW.z, result);
  }

  /** Create a matrix with each column's _x,y_ parts given `XAndY` and separate numeric z values.
   * ```
   * equation
   * \begin{bmatrix}U_x & V_x & W_x \\ U_y & V_y & W_y \\ u & v & w \end{bmatrix}
   * ```
   */
  public static createColumnsXYW(vectorU: XAndY, u: number, vectorV: XAndY, v: number, vectorW: XAndY, w: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        vectorU.x, vectorV.x, vectorW.x,
        vectorU.y, vectorV.y, vectorW.y,
        u, v, w, result);
  }

  /** Install data from xyz parts of Point4d  (w part of Point4d ignored) */
  public setColumnsPoint4dXYZ(vectorU: Point4d, vectorV: Point4d, vectorW: Point4d) {
    this.inverseState = InverseMatrixState.unknown;
    this.setRowValues(
      vectorU.x, vectorV.x, vectorW.x,
      vectorU.y, vectorV.y, vectorW.y,
      vectorU.z, vectorV.z, vectorW.z);
  }
  /**
   * set entries in one column of the matrix.
   * @param columnIndex column index. this is interpreted cyclically.
   * @param value x,yz, values for column.  If undefined, zeros are installed.
   */
  public setColumn(columnIndex: number, value: Vector3d | undefined) {
    const index = Geometry.cyclic3dAxis(columnIndex);
    this.inverseState = InverseMatrixState.unknown;
    if (value) {
      this.coffs[index] = value.x;
      this.coffs[index + 3] = value.y;
      this.coffs[index + 6] = value.z;
    } else {
      this.coffs[index] = 0.0;
      this.coffs[index + 3] = 0.0;
      this.coffs[index + 6] = 0.0;
    }
  }
  /** Set all columns of the matrix. Any undefined vector is zeros. */
  public setColumns(vectorX: Vector3d | undefined, vectorY: Vector3d | undefined, vectorZ?: Vector3d | undefined) {
    this.setColumn(0, vectorX);
    this.setColumn(1, vectorY);
    this.setColumn(2, vectorZ);
  }
  /**
   * set entries in one row of the matrix.
   * @param rowIndex row index. this is interpreted cyclically.
   * @param value x,yz, values for row.  If undefined, zeros are installed.
   */
  public setRow(rowIndex: number, value: Vector3d) {
    const index = 3 * Geometry.cyclic3dAxis(rowIndex);
    this.coffs[index] = value.x;
    this.coffs[index + 1] = value.y;
    this.coffs[index + 2] = value.z;
    this.inverseState = InverseMatrixState.unknown;
  }
  /** Return a (copy of) a column of the matrix.
   * @param i column index.  This is corrected to 012 by Geometry.cyclic3dAxis.
   */
  public getColumn(columnIndex: number, result?: Vector3d): Vector3d {
    const index = Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 3],
      this.coffs[index + 6], result);
  }

  /** Return a (copy of) a row of the matrix.
   * @param i row index.  This is corrected to 012 by Geometry.cyclic3dAxis.
   */
  public getRow(columnIndex: number, result?: Vector3d): Vector3d {
    const index = 3 * Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 1],
      this.coffs[index + 2], result);
  }

  /** Create a matrix from column vectors, shuffled into place per AxisTriple */
  public static createShuffledColumns(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, axisOrder: AxisOrder, result?: Matrix3d): Matrix3d {
    const target = Matrix3d._create(result);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 0), vectorU);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 1), vectorV);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 2), vectorW);
    return target;
  }

  /** Create a matrix from row vectors.
   * ```
   * equation
   * \begin{bmatrix}U_x & U_y & U_z \\ V_x & V_y & V_z \\ W_x & W_y & W_z \end{bmatrix}
   * ```
   */
  public static createRows(vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        vectorU.x, vectorU.y, vectorU.z,
        vectorV.x, vectorV.y, vectorV.z,
        vectorW.x, vectorW.y, vectorW.z, result);
  }

  /** Create a matrix that scales along a specified direction.
   * * The scale factor can be negative.
   *  * A scale of -1.0 (negative one) is a mirror across the plane perpendicular to the vector.
   * ```
   * equation
   * \text{The matrix is } I - (s-1) U U^T
   * \\ \text{with }U\text{ being the unit vector in the direction of the input vector.}
   * ```
   */
  public static createDirectionalScale(direction: Vector3d, scale: number, result?: Matrix3d): Matrix3d {
    const unit = direction.normalize();
    if (unit) {
      const x = unit.x;
      const y = unit.y;
      const z = unit.z;
      const a = (scale - 1);
      return Matrix3d.createRowValues
        (
          1 + a * x * x, a * x * y, a * x * z,
          a * y * x, 1 + a * y * y, a * y * z,
          a * z * x, a * z * y, 1 + a * z * z, result);
    }
    return Matrix3d.createUniformScale(scale);
  }

  /* Create a matrix with the indicated column in the (normalized) direction, and the other two columns perpendicular. All columns are normalized.
   * * The direction vector is normalized and appears in column axisIndex
   * * If the direction vector is not close to Z, the "next" column ((axisIndex + 1) mod 3) will be in the XY plane in the direction of (direction cross Z)
   * * If the direction vector is close to Z, the "next" column ((axisIndex + 1) mode 3) will be in the direction of (direction cross Y)
  */
  // static create1Vector(direction: Vector3d, axisIndex: number): Matrix3d;
  // static createFromXYVectors(vectorX: Vector3d, vectorY: Vector3d, axisIndex: number): Matrix3d;

  /** Multiply the matrix * vector, treating the vector is a column vector on the right.
   * ```
   * equation
   * \matrixXY{A}\columnSubXYZ{U}
   * ```
   * @return the vector result
   */
  public multiplyVector(vectorU: XYAndZ, result?: Vector3d): Vector3d {
    const x = vectorU.x;
    const y = vectorU.y;
    const z = vectorU.z;
    return Vector3d.create(
      (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z),
      (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z),
      (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z),
      result);
  }

  /** Multiply matrix * vector for each array member, i.e. the vector is a column vector on the right.
   * @return the vector result
   */
  public multiplyVectorArrayInPlace(data: XYZ[]): void {
    for (const v of data) v.set(
      (this.coffs[0] * v.x + this.coffs[1] * v.y + this.coffs[2] * v.z),
      (this.coffs[3] * v.x + this.coffs[4] * v.y + this.coffs[5] * v.z),
      (this.coffs[6] * v.x + this.coffs[7] * v.y + this.coffs[8] * v.z));
  }

  /** compute `origin - matrix * vector` */
  public static xyzMinusMatrixTimesXYZ(origin: XYAndZ, matrix: Matrix3d, vector: XYAndZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x - (matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z),
      origin.y - (matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z),
      origin.z - (matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z),
      result);
  }

  /** compute  `origin + matrix * vector`  using only the xy parts of the inputs. */
  public static xyPlusMatrixTimesXY(origin: XAndY, matrix: Matrix3d, vector: XAndY, result?: Point2d): Point2d {
    const x = vector.x;
    const y = vector.y;
    return Point2d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y,
      result);
  }

  /** compute  `origin + matrix * vector`  using all xyz parts of the inputs. */
  public static xyzPlusMatrixTimesXYZ(origin: XYZ, matrix: Matrix3d, vector: XYAndZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result);
  }
  /** compute  `origin + matrix * vector`  using all xyz parts of the inputs. */
  public static xyzPlusMatrixTimesXYZInPlace(origin: XYZ, matrix: Matrix3d, vector: WritableXYAndZ) {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    vector.x = origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z;
    vector.y = origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z;
    vector.z = origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z;
  }
  /** compute `origin + matrix * vector` where the final vector is given as direct x,y,z coordinates */
  public static xyzPlusMatrixTimesCoordinates(origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, result?: Point3d): Point3d {
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result);
  }

  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply times point with coordinates `[x,y,z,w]`
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional result.
   */
  public static xyzPlusMatrixTimesWeightedCoordinates(origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    return Point4d.create(
      w * origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      w * origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      w * origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      w,
      result);
  }
  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply times point with coordinates `[x,y,z,w]`
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional result.
   */
  public static xyzPlusMatrixTimesWeightedCoordinatesToFloat64Array(origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, w: number, result?: Float64Array): Float64Array {
    if (!result)
      result = new Float64Array(4);
    result[0] = w * origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z;
    result[1] = w * origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z;
    result[2] = w * origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z;
    result[3] = w;
    return result;
  }

  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply times point with coordinates `[x,y,z,w]`
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional result.
   */
  public static xyzPlusMatrixTimesCoordinatesToFloat64Array(origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, result?: Float64Array): Float64Array {
    if (!result)
      result = new Float64Array(3);
    result[0] = origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z;
    result[1] = origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z;
    result[2] = origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z;
    return result;
  }
  /**
   * Multiply transpose of this matrix times a vector.
   * * This produces the same x,y,z as treating the vector as a row on the left of the (un-transposed) matrix.
   * ```
   * equation
   * \begin{matrix}
   * \text{Treating U as a column to the right of transposed matrix\:  return column}&\columnSubXYZ{V}&=&\matrixTransposeSubXY{A}\columnSubXYZ{U} \\
   * \text{Treating U as a row to the left of untransposed matrix\: return row}&\rowSubXYZ{V}&=&\rowSubXYZ{U}\matrixXY{A}
   * \end{matrix}
   * ```
   * @return the vector result
   */
  public multiplyTransposeVector(vector: Vector3d, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    result.x = (this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z);
    result.y = (this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z);
    result.z = (this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * (x,y,z), i.e. the vector (x,y,z) is a column vector on the right.
   * @return the vector result
   */
  public multiplyXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z);
    result.y = (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z);
    result.z = (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * xyz, place result in (required) return value.
   *   @param xyz right side
   *   @param result result.
   */
  public multiplyXYZtoXYZ(xyz: XYZ, result: XYZ) {
    const x = xyz.x;
    const y = xyz.y;
    const z = xyz.z;
    result.x = (this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z);
    result.y = (this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z);
    result.z = (this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z);
    return result;
  }

  /** Multiply the matrix * (x,y,0), i.e. the vector (x,y,z) is a column vector on the right.
   *   @return the vector result
   */
  public multiplyXY(x: number, y: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[1] * y);
    result.y = (this.coffs[3] * x + this.coffs[4] * y);
    result.z = (this.coffs[6] * x + this.coffs[7] * y);
    return result;
  }

  /** compute `origin + this*[x,y,0]`  */
  public originPlusMatrixTimesXY(origin: XYZ, x: number, y: number, result?: Point3d): Point3d {
    return Point3d.create(
      origin.x + this.coffs[0] * x + this.coffs[1] * y,
      origin.y + this.coffs[3] * x + this.coffs[4] * y,
      origin.z + this.coffs[6] * x + this.coffs[7] * y,
      result);
  }

  /** Multiply matrix * (x, y, z) using any 3d object given containing those members */
  public multiplyVectorInPlace(xyzData: XYZ): void {
    const x = xyzData.x;
    const y = xyzData.y;
    const z = xyzData.z;
    const coffs = this.coffs;
    xyzData.x = (coffs[0] * x + coffs[1] * y + coffs[2] * z);
    xyzData.y = (coffs[3] * x + coffs[4] * y + coffs[5] * z);
    xyzData.z = (coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  /** Multiply the transpose matrix times column using any 3d object with x,y,z members.
   * This is equivalent to `multiplyTransposeVector` but always returns the result directly in the input.
   */
  public multiplyTransposeVectorInPlace(vectorU: XYZ): void {
    const x = vectorU.x;
    const y = vectorU.y;
    const z = vectorU.z;
    const coffs = this.coffs;
    vectorU.x = (coffs[0] * x + coffs[3] * y + coffs[6] * z);
    vectorU.y = (coffs[1] * x + coffs[4] * y + coffs[7] * z);
    vectorU.z = (coffs[2] * x + coffs[5] * y + coffs[8] * z);
  }

  /** Multiply the transpose matrix times column using individual numeric inputs.
   * * This is equivalent to multiplying with the vector as a row to the left of the plain matrix.
   * ```
   * equation
   * \begin{matrix}
   * \text{treating the input as a column } \columnXYZ{x}{y}{z}\text{ compute  }&\columnSubXYZ{V} &= &A^T \columnXYZ{x}{y}{z} \\
   * \text{or row vector } \rowXYZ{x}{y}{z} \text{ compute }&\rowSubXYZ{V} &= &\rowXYZ{x}{y}{z} A \\
   * \phantom{8888}\text{and return V as a Vector3d} & & &
   * \end{matrix}
   * ````
   * @return the vector result
   */
  public multiplyTransposeXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = (this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z);
    result.y = (this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z);
    result.z = (this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z);
    return result;
  }
  /** Solve `matrix * result = vector`.
   * * This is equivalent to multiplication `result = matrixInverse * vector`.
   * * Result is undefined if the matrix is singular (e.g. has parallel or zero length columns)
   */
  public multiplyInverse(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /** Solve `matrixTranspose * result = vector`.
   * * This is equivalent to multiplication `result = matrixInverseTranspose * vector`.
   * * Result is undefined if the matrix is singular (e.g. has parallel or zero length columns)
   */
  public multiplyInverseTranspose(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[3] * y + this.inverseCoffs[6] * z),
        (this.inverseCoffs[1] * x + this.inverseCoffs[4] * y + this.inverseCoffs[7] * z),
        (this.inverseCoffs[2] * x + this.inverseCoffs[5] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /**
   * multiply `matrixInverse * [x,y,z]`.
   * *  This is equivalent to solving `matrix * result = [x,y,z]`
   * *  return as a Vector3d, or undefined if the matrix is singular.
   */
  public multiplyInverseXYZAsVector3d(x: number, y: number, z: number, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Vector3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /**
   * multiply `matrixInverse * [x,y,z]` and return packaged as `Point4d` with given weight.
   * *  Equivalent to solving matrix * result = [x,y,z]
   * *  return as a Point4d with the same weight.
   * *  Called by Transform with x,y,z adjusted by subtraction ((xw) - w * origin.x, etc) where xw is the pre-weighted space point.
   */
  public multiplyInverseXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Point4d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        w,
        result);
    }
    return undefined;
  }

  /**
   * multiply `matrixInverse * [x,y,z]` and return packaged as `Point3d`.
   * *  multiply matrixInverse * [x,y,z]
   * *  Equivalent to solving matrix * result = [x,y,z]
   * *  return as a Point3d.
   */
  public multiplyInverseXYZAsPoint3d(x: number, y: number, z: number, result?: Point3d): Point3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Point3d.create(
        (this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z),
        (this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z),
        (this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z),
        result);
    }
    return undefined;
  }

  /**
   * * invoke a given matrix-matrix operation (product function) to compute this.inverseCOffs
   * * set this.inverseCoffs
   * * if either input cffA or coffB is undefined, set state to `InverseMatrixState.unknown` (but leave the inverseCoffs untouched)
   */
  private finishInverseCoffs(f: (factorA: Float64Array, factorB: Float64Array, result: Float64Array) => void, coffA?: Float64Array, coffB?: Float64Array): void {
    if (coffA && coffB) {
      this.createInverseCoffsWithZeros();
      this.inverseState = InverseMatrixState.inverseStored;
      f(coffA, coffB, this.inverseCoffs!);
    } else {
      this.inverseState = InverseMatrixState.unknown;
    }
  }

  /*
   Notes on inverses of products
   * 1) M = A * B       MInverse = BInverse * AInverse
   * 2) M = A * BInverse       MInverse = B * AInverse
   * 3) M = AInverse * B       MInverse = BInverse * A
   * 4) M = ATranspose * B       MInverse = BInverse * AInverseTranspose
   * 5) M = A * BTranspose       MInverse = BInverseTranspose * AInverse
  */
  /** Multiply two matrices.
   *   @return the matrix result
   */
  public multiplyMatrixMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.coffs, other.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored && other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs(PackedMatrix3dOps.multiplyMatrixMatrix, other.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular || other.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }
  private static _productBuffer = new Float64Array(9);
  /** Multiply this matrix times inverse of other
   *   @return the matrix result
   */
  public multiplyMatrixMatrixInverse(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined {
    if (!other.computeCachedInverse(true))
      return undefined;
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.coffs, other.inverseCoffs!, Matrix3d._productBuffer);
    if (this.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs(PackedMatrix3dOps.multiplyMatrixMatrix, other.coffs, this.inverseCoffs);
    else
      result.inverseState = InverseMatrixState.unknown;
    PackedMatrix3dOps.copy(Matrix3d._productBuffer, result.coffs);
    return result;
  }
  /** Multiply this matrix times inverse of other
   *   @return the matrix result
   */
  public multiplyMatrixInverseMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined {
    if (!this.computeCachedInverse(true))
      return undefined;
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.inverseCoffs!, other.coffs, Matrix3d._productBuffer);
    if (other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs(PackedMatrix3dOps.multiplyMatrixMatrix, other.inverseCoffs, this.coffs);
    else
      result.inverseState = InverseMatrixState.unknown;
    PackedMatrix3dOps.copy(Matrix3d._productBuffer, result.coffs);
    return result;
  }
  /** Multiply `this` matrix times the transpose of `matrixB`.
   * ```
   * equation
   * \text{for instance matrix }A\text{ and other matrix }B\text{ return matrix }C{\text where }\\\matrixXY{C}=\matrixXY{A}\matrixTransposeSubXY{B}
   * ```
   * @return the matrix result
   */
  public multiplyMatrixMatrixTranspose(matrixB: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrixTranspose(this.coffs, matrixB.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored && matrixB.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs(PackedMatrix3dOps.multiplyMatrixTransposeMatrix, matrixB.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular || matrixB.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }

  /** Matrix multiplication `thisTranspose * other`.
   * ```
   * equation
   * \matrixXY{result}=\matrixXY{\text{this}}\matrixTransposeSubXY{\text{other}}
   * ```
   *   @return the matrix result
   */
  public multiplyMatrixTransposeMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixTransposeMatrix(this.coffs, other.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored && other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs(PackedMatrix3dOps.multiplyMatrixMatrixTranspose, other.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular || other.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }
  /** multiply this Matrix3d (considered as a transform with 0 translation) times other Transform.
   * ```
   * equation
   * \begin{matrix}
   *    \text{This matrix }\bold{A}\text{ promoted to block transform} & \blockTransform{A}{0} \\
   *    \text{other transform with matrix part }\bold{B}\text{ and translation }\bold{b} & \blockTransform{B}{b}\\
   * \text{product}& \blockTransform{A}{0}\blockTransform{B}{b}=\blockTransform{AB}{Ab}
   * \end{matrix}
   * ```
   * @param other right hand Matrix3d for multiplication.
   * @param result optional preallocated result to reuse.
   */
  public multiplyMatrixTransform(other: Transform, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this.multiplyXYZ(other.origin.x, other.origin.y, other.origin.z),
        this.multiplyMatrixMatrix(other.matrix));
    // be sure to do the point multiplication first before aliasing changes the matrix ..
    this.multiplyXYZtoXYZ(other.origin, result.origin);
    this.multiplyMatrixMatrix(other.matrix, result.matrix);
    return result;
  }

  /** return a transposed matrix. `this` is not changed unless also passed as the result. */
  public transpose(result?: Matrix3d): Matrix3d {
    if (!result) result = new Matrix3d();
    PackedMatrix3dOps.copyTransposed(this.coffs, result.coffs);
    if (this.inverseCoffs !== undefined) {
      result.inverseState = InverseMatrixState.inverseStored;
      result.inverseCoffs = PackedMatrix3dOps.copyTransposed(this.inverseCoffs, result.inverseCoffs);
    } else {
      result.inverseState = this.inverseState;  // singular or unknown.
      result.inverseCoffs = undefined;
    }
    return result;
  }

  /** transpose this matrix in place.
   *
   */
  public transposeInPlace() {
    PackedMatrix3dOps.transposeInPlace(this.coffs);
    if (this.inverseCoffs)
      PackedMatrix3dOps.transposeInPlace(this.inverseCoffs);
  }

  /** return the inverse matrix.
   * The return is undefined if the matrix is singular (has columns that are coplanar or colinear)
   * * Note that each Matrix3d object caches its own inverse, and has methods to multiply the inverse times matrices and vectors.
   * * Hence explicitly constructing this new inverse object is rarely necessary.
   */
  public inverse(result?: Matrix3d): Matrix3d | undefined {
    if (!this.computeCachedInverse(true))
      return undefined;
    if (result === this) {
      // swap the contents (preserve pointers .. caller better know what they are doing)
      PackedMatrix3dOps.copy(this.coffs, Matrix3d._productBuffer);
      PackedMatrix3dOps.copy(this.inverseCoffs!, this.coffs);
      PackedMatrix3dOps.copy(Matrix3d._productBuffer, this.inverseCoffs!);

      return result;
    }
    if (result === undefined) {
      result = Matrix3d.createIdentity();
    }
    result.createInverseCoffsWithZeros();
    PackedMatrix3dOps.copy(this.coffs, result.inverseCoffs!);
    PackedMatrix3dOps.copy(this.inverseCoffs!, result.coffs);
    result.inverseState = this.inverseState;
    return result;
  }

  /** copy the transpose of the coffs to the inverseCoffs.
   * * mark the matrix as inverseStored.
   */
  private setupInverseTranspose() {
    const coffs = this.coffs;
    this.inverseState = InverseMatrixState.inverseStored;
    this.inverseCoffs = Float64Array.from([
      coffs[0], coffs[3], coffs[6],
      coffs[1], coffs[4], coffs[7],
      coffs[2], coffs[5], coffs[8]]);
  }

  /* Alternate implementation of computedCachedInverse - more direct addressing of arrays.
     This is indeed 10% faster than using static work areas. */

  // take the cross product of two rows of source.
  // store as a column of dest.
  private static indexedRowCrossProduct(source: Float64Array, rowStart0: number, rowStart1: number, dest: Float64Array, columnStart: number) {
    dest[columnStart] = source[rowStart0 + 1] * source[rowStart1 + 2] - source[rowStart0 + 2] * source[rowStart1 + 1];
    dest[columnStart + 3] = source[rowStart0 + 2] * source[rowStart1] - source[rowStart0] * source[rowStart1 + 2];
    dest[columnStart + 6] = source[rowStart0] * source[rowStart1 + 1] - source[rowStart0 + 1] * source[rowStart1];
  }

  // take the cross product of two columns of source.
  // store as third column in same Matrix3d.
  // This is private because the columnStart values are unchecked raw indices into the coffs
  private indexedColumnCrossProductInPlace(colStart0: number, colStart1: number, colStart2: number) {
    const coffs = this.coffs;
    coffs[colStart2] = coffs[colStart0 + 3] * coffs[colStart1 + 6] - coffs[colStart0 + 6] * coffs[colStart1 + 3];
    coffs[colStart2 + 3] = coffs[colStart0 + 6] * coffs[colStart1] - coffs[colStart0] * coffs[colStart1 + 6];
    coffs[colStart2 + 6] = coffs[colStart0] * coffs[colStart1 + 3] - coffs[colStart0 + 3] * coffs[colStart1];
  }
  /** Form cross products among columns in axisOrder.
   * For axis order ABC,
   * * form cross product of column A and B, store in C
   * * form cross product of column C and A, store in B.
   * This means that in the final matrix:
   * * column A is strictly parallel to original column A
   * * column B is linear combination of only original A and B
   * * column C is perpendicular to A and B of both the original and final.
   * * original column C does not participate in the result.
   */
  public axisOrderCrossProductsInPlace(axisOrder: AxisOrder) {
    switch (axisOrder) {
      case AxisOrder.XYZ: {
        this.indexedColumnCrossProductInPlace(0, 1, 2);
        this.indexedColumnCrossProductInPlace(2, 0, 1);
        break;
      }
      case AxisOrder.YZX: {
        this.indexedColumnCrossProductInPlace(1, 2, 0);
        this.indexedColumnCrossProductInPlace(0, 1, 2);
        break;
      }
      case AxisOrder.ZXY: {
        this.indexedColumnCrossProductInPlace(2, 0, 1);
        this.indexedColumnCrossProductInPlace(1, 2, 0);
        break;
      }
      case AxisOrder.XZY: {
        this.indexedColumnCrossProductInPlace(0, 2, 1);
        this.indexedColumnCrossProductInPlace(1, 0, 2);
        break;
      }
      case AxisOrder.YXZ: {
        this.indexedColumnCrossProductInPlace(1, 0, 2);
        this.indexedColumnCrossProductInPlace(2, 1, 0);
        break;
      }
      case AxisOrder.ZYX: {
        this.indexedColumnCrossProductInPlace(2, 1, 0);
        this.indexedColumnCrossProductInPlace(0, 2, 1);
        break;
      }
    }
  }

  /** Normalize each column in place.
   * * For false return the magnitudes are stored in the originalMagnitudes vector but no columns are altered.
   * @returns Return true if all columns had nonzero lengths.
   * @param originalMagnitudes optional vector to receive original column magnitudes.
   */
  public normalizeColumnsInPlace(originalMagnitudes?: Vector3d): boolean {
    const ax = this.columnXMagnitude();
    const ay = this.columnYMagnitude();
    const az = this.columnZMagnitude();
    if (originalMagnitudes)
      originalMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleColumns(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  /** Normalize each row in place */
  public normalizeRowsInPlace(originalMagnitudes?: Vector3d): boolean {
    const ax = this.rowXMagnitude();
    const ay = this.rowYMagnitude();
    const az = this.rowZMagnitude();
    if (originalMagnitudes)
      originalMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleRows(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  // take the cross product of two rows of source.
  // store as a column of dest.
  private static rowColumnDot(coffA: Float64Array, rowStartA: number, coffB: Float64Array, columnStartB: number): number {
    return coffA[rowStartA] * coffB[columnStartB] + coffA[rowStartA + 1] * coffB[columnStartB + 3] + coffA[rowStartA + 2] * coffB[columnStartB + 6];
  }
  /**
   * Returns true if the matrix is singular (i.e. collapses data to a plane, line, or point)
   */
  public isSingular(): boolean {
    return !this.computeCachedInverse(true);
  }
  /**
   * Mark this matrix as singular.
   */
  public markSingular() {
    this.inverseState = InverseMatrixState.singular;
  }
  /** Create the inverseCoffs member (filled with zeros)
   * This is for use by matrix * matrix multiplications which need to be sure the member is there to be filled with method-specific content.
   */
  private createInverseCoffsWithZeros() {
    if (!this.inverseCoffs) {
      this.inverseState = InverseMatrixState.unknown;
      this.inverseCoffs = new Float64Array(9);
    }
  }
  /** compute the inverse of this Matrix3d. The inverse is stored for later use.
   * @returns Return true if the inverse computed.  (False if the columns collapse to a point, line or plane.)
   */
  public computeCachedInverse(useCacheIfAvailable: boolean): boolean {
    if (useCacheIfAvailable && Matrix3d.useCachedInverse && this.inverseState !== InverseMatrixState.unknown) {
      Matrix3d.numUseCache++;
      return this.inverseState === InverseMatrixState.inverseStored;
    }
    this.inverseState = InverseMatrixState.unknown;
    this.createInverseCoffsWithZeros();
    const coffs = this.coffs;
    const inverseCoffs = this.inverseCoffs!;
    Matrix3d.indexedRowCrossProduct(coffs, 3, 6, inverseCoffs, 0);
    Matrix3d.indexedRowCrossProduct(coffs, 6, 0, inverseCoffs, 1);
    Matrix3d.indexedRowCrossProduct(coffs, 0, 3, inverseCoffs, 2);
    Matrix3d.numComputeCache++;
    const d = Matrix3d.rowColumnDot(coffs, 0, inverseCoffs, 0);
    if (d === 0.0) {     // better test?
      this.inverseState = InverseMatrixState.singular;
      this.inverseCoffs = undefined;
      return false;
    }
    const f = 1.0 / d;
    for (let i = 0; i < 9; i++)inverseCoffs[i] *= f;
    this.inverseState = InverseMatrixState.inverseStored;
    // verify inverse
    // const p = new Float64Array(9);
    // for (let i = 0; i < 9; i += 3)
    //   for (let j = 0; j < 3; j++)
    //    p[i + j] = Matrix3d.rowColumnDot (coffs, i, inverseCoffs, j);
    return true;
  }

  /* "Classic" inverse implementation with temporary vectors.
    private static rowX: Vector3d = Vector3d.create();
    private static rowY: Vector3d = Vector3d.create();
    private static rowZ: Vector3d = Vector3d.create();
    private static crossXY: Vector3d = Vector3d.create();
    private static crossZX: Vector3d = Vector3d.create();
    private static crossYZ: Vector3d = Vector3d.create();
  private computeCachedInverse(useCacheIfAvailable: boolean) {
      if (useCacheIfAvailable && Matrix3d.useCachedInverse && this.inverseState !== InverseMatrixState.unknown) {
        Matrix3d.numUseCache++;
        return this.inverseState === InverseMatrixState.inverseStored;
      }
      this.inverseState = InverseMatrixState.unknown;
      Matrix3d.numComputeCache++;
      const rowX = this.rowX(Matrix3d.rowX);
      const rowY = this.rowY(Matrix3d.rowY);
      const rowZ = this.rowZ(Matrix3d.rowZ);
      const crossXY = rowX.crossProduct(rowY, Matrix3d.crossXY);
      const crossYZ = rowY.crossProduct(rowZ, Matrix3d.crossYZ);
      const crossZX = rowZ.crossProduct(rowX, Matrix3d.crossZX);
      const d = rowX.dotProduct(crossYZ);  // that's the determinant
      if (d === 0.0) {     // better test?
        this.inverseState = InverseMatrixState.singular;
        this.inverseCoffs = undefined;
        return false;
      }
      const f = 1.0 / d;
      this.inverseState = InverseMatrixState.inverseStored;   // Currently just lists that the inverse has been stored... singular case not handled
      this.inverseCoffs = Float64Array.from([crossYZ.x * f, crossZX.x * f, crossXY.x * f,
      crossYZ.y * f, crossZX.y * f, crossXY.y * f,
      crossYZ.z * f, crossZX.z * f, crossXY.z * f]);
      return true;
    }
  */
  /** convert a (row,column) index pair to the single index within flattened array of 9 numbers in row-major-order  */
  public static flatIndexOf(row: number, column: number): number {
    return 3 * Geometry.cyclic3dAxis(row) + Geometry.cyclic3dAxis(column);
  }

  /** Get a column by index (0,1,2), packaged as a Point4d with given weight.   Out of range index is interpreted cyclically.  */
  public indexedColumnWithWeight(index: number, weight: number, result?: Point4d): Point4d {
    index = Geometry.cyclic3dAxis(index);
    return Point4d.create(this.coffs[index], this.coffs[index + 3], this.coffs[index + 6], weight, result);
  }

  /** return the entry at specific row and column */
  public at(row: number, column: number): number {
    return this.coffs[Matrix3d.flatIndexOf(row, column)];
  }

  /** Set the entry at specific row and column */
  public setAt(row: number, column: number, value: number): void {
    this.coffs[Matrix3d.flatIndexOf(row, column)] = value;
    this.inverseState = InverseMatrixState.unknown;
  }

  /** create a Matrix3d whose columns are scaled copies of this Matrix3d.
   * @param scaleX scale factor for columns x
   * @param scaleY scale factor for column y
   * @param scaleZ scale factor for column z
   * @param result optional result.
   */
  public scaleColumns(scaleX: number, scaleY: number, scaleZ: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        this.coffs[0] * scaleX, this.coffs[1] * scaleY, this.coffs[2] * scaleZ,
        this.coffs[3] * scaleX, this.coffs[4] * scaleY, this.coffs[5] * scaleZ,
        this.coffs[6] * scaleX, this.coffs[7] * scaleY, this.coffs[8] * scaleZ,
        result);
  }

  /** create a Matrix3d whose columns are scaled copies of this Matrix3d.
   * @param scaleX scale factor for columns x
   * @param scaleY scale factor for column y
   * @param scaleZ scale factor for column z
   * @param result optional result.
   */
  public scaleColumnsInPlace(scaleX: number, scaleY: number, scaleZ: number) {

    this.coffs[0] *= scaleX; this.coffs[1] *= scaleY; this.coffs[2] *= scaleZ;
    this.coffs[3] *= scaleX; this.coffs[4] *= scaleY; this.coffs[5] *= scaleZ;
    this.coffs[6] *= scaleX; this.coffs[7] *= scaleY; this.coffs[8] *= scaleZ;
    if (this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined) {
      // apply reciprocal scales to the ROWS of the inverse .  . .
      const divX = Geometry.conditionalDivideFraction(1.0, scaleX);
      const divY = Geometry.conditionalDivideFraction(1.0, scaleY);
      const divZ = Geometry.conditionalDivideFraction(1.0, scaleZ);
      if (divX !== undefined && divY !== undefined && divZ !== undefined) {
        this.inverseCoffs[0] *= divX; this.inverseCoffs[1] *= divX; this.inverseCoffs[2] *= divX;
        this.inverseCoffs[3] *= divY; this.inverseCoffs[4] *= divY; this.inverseCoffs[5] *= divY;
        this.inverseCoffs[6] *= divZ; this.inverseCoffs[7] *= divZ; this.inverseCoffs[8] *= divZ;
      } else
        this.inverseState = InverseMatrixState.singular;
    }
  }

  /** create a Matrix3d whose rows are scaled copies of this Matrix3d.
   * @param scaleX scale factor for row x
   * @param scaleY scale factor for row y
   * @param scaleZ scale factor for row z
   * @param result optional result.
   */
  public scaleRows(scaleX: number, scaleY: number, scaleZ: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        this.coffs[0] * scaleX, this.coffs[1] * scaleX, this.coffs[2] * scaleX,
        this.coffs[3] * scaleY, this.coffs[4] * scaleY, this.coffs[5] * scaleY,
        this.coffs[6] * scaleZ, this.coffs[7] * scaleZ, this.coffs[8] * scaleZ,
        result);
  }
  /**
   * add scaled values from other Matrix3d to this Matrix3d
   * @param other Matrix3d with values to be added
   * @param scale scale factor to apply to th eadded values.
   */
  public addScaledInPlace(other: Matrix3d, scale: number): void {
    for (let i = 0; i < 9; i++)
      this.coffs[i] += scale * other.coffs[i];
    this.inverseState = InverseMatrixState.unknown;
  }
  /**
   * add scaled values from an outer product.
   * * The scaled outer product is a "rank 1" matrix.
   * * This is useful in constructing mirrors and directional scales.
   * ```
   * equation
   * A += s \columnSubXYZ{U}\rowSubXYZ{V}
   * \\ \matrixXY{A} += s \begin{bmatrix}
   * U_x * V_x & U_y * V_x & U_z * V_x \\
   * U_x * V_y & U_y * V_y & U_z * V_y \\
   * U_x * V_z & U_y * V_z & U_z * V_z \end{bmatrix}
   * ```
   * @param other Matrix3d with values to be added
   * @param scale scale factor to apply to the added values.
   */
  public addScaledOuterProductInPlace(vectorU: Vector3d, vectorV: Vector3d, scale: number): void {
    this.coffs[0] += scale * vectorU.x * vectorV.x;
    this.coffs[1] += scale * vectorU.x * vectorV.y;
    this.coffs[2] += scale * vectorU.x * vectorV.z;

    this.coffs[3] += scale * vectorU.y * vectorV.x;
    this.coffs[4] += scale * vectorU.y * vectorV.y;
    this.coffs[5] += scale * vectorU.y * vectorV.z;

    this.coffs[6] += scale * vectorU.z * vectorV.x;
    this.coffs[7] += scale * vectorU.z * vectorV.y;
    this.coffs[8] += scale * vectorU.z * vectorV.z;
    this.inverseState = InverseMatrixState.unknown;
  }

  /** create a Matrix3d whose values are uniformly scaled from this.
   * @param scale scale factor to apply.
   * @param result optional result.
   * @returns Return the new or repopulated matrix
   */
  public scale(scale: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        this.coffs[0] * scale, this.coffs[1] * scale, this.coffs[2] * scale,
        this.coffs[3] * scale, this.coffs[4] * scale, this.coffs[5] * scale,
        this.coffs[6] * scale, this.coffs[7] * scale, this.coffs[8] * scale,
        result);

  }

  /** Return the determinant of this matrix. */
  public determinant(): number {
    return this.coffs[0] * this.coffs[4] * this.coffs[8]
      - this.coffs[0] * this.coffs[7] * this.coffs[5]
      + this.coffs[3] * this.coffs[7] * this.coffs[2]
      - this.coffs[3] * this.coffs[1] * this.coffs[8]
      + this.coffs[6] * this.coffs[1] * this.coffs[5]
      - this.coffs[6] * this.coffs[4] * this.coffs[2];
  }

  /** Return an estimate of how independent the columns are.  Near zero is bad. Near 1 is good
   */
  public conditionNumber(): number {
    const determinant = this.determinant();
    const columnMagnitudeProduct =
      Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[3], this.coffs[6])
      + Geometry.hypotenuseXYZ(this.coffs[1], this.coffs[4], this.coffs[7])
      + Geometry.hypotenuseXYZ(this.coffs[2], this.coffs[5], this.coffs[8]);
    return Geometry.safeDivideFraction(determinant, columnMagnitudeProduct, 0.0);
  }
  /** Return the sum of squares of all entries */
  public sumSquares(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a += this.coffs[i] * this.coffs[i];
    return a;
  }

  /** Return the sum of squares of diagonal entries */
  public sumDiagonalSquares(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i += 4)
      a += this.coffs[i] * this.coffs[i];
    return a;
  }

  /** Return the sum of diagonal entries (also known as the trace) */
  public sumDiagonal(): number {
    return this.coffs[0] + this.coffs[4] + this.coffs[8];
  }

  /** Return the Maximum absolute value of any single entry */
  public maxAbs(): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a = Math.max(a, Math.abs(this.coffs[i]));
    return a;
  }

  /** Return the maximum absolute difference between corresponding entries */
  public maxDiff(other: Matrix3d): number {
    let i = 0;
    let a = 0;
    for (i = 0; i < 9; i++)
      a = Math.max(a, Math.abs(this.coffs[i] - other.coffs[i]));
    return a;
  }

  /** Test if the matrix is (very near to) an identity */
  public get isIdentity(): boolean {
    return this.maxDiff(Matrix3d.identity) < Geometry.smallAngleRadians;
  }

  /** Test if the off diagonal entries are all nearly zero */
  public get isDiagonal(): boolean {
    const sumAll = this.sumSquares();
    const sumDiagonal = this.sumDiagonalSquares();
    const sumOff = Math.abs(sumAll - sumDiagonal);
    return Math.sqrt(sumOff) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }

  /** Test if the stored inverse is present and marked valid */
  public get hasCachedInverse(): boolean {
    return this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined;
  }
  /** Test if the below diagonal entries are all nearly zero */
  public get isUpperTriangular(): boolean {
    const sumAll = this.sumSquares();
    const sumLow = Geometry.hypotenuseSquaredXYZ(this.coffs[3], this.coffs[6], this.coffs[7]);
    return Math.sqrt(sumLow) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }

  /** If the matrix is diagonal and all diagonals are within tolerance, return the first diagonal.  Otherwise return undefined.
   */
  public sameDiagonalScale(): number | undefined {
    const sumAll = this.sumSquares();
    const sumDiagonal = this.sumDiagonalSquares();
    const sumOff = Math.abs(sumAll - sumDiagonal);
    if (Math.sqrt(sumOff) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll))
      && Geometry.isSameCoordinate(this.coffs[0], this.coffs[4]) && Geometry.isSameCoordinate(this.coffs[0], this.coffs[8]))
      return this.coffs[0];
    return undefined;
  }

  /** Sum of squared differences between symmetric pairs */
  public sumSkewSquares(): number {
    return Geometry.hypotenuseSquaredXYZ(
      this.coffs[1] - this.coffs[3],
      this.coffs[2] - this.coffs[6],
      this.coffs[5] - this.coffs[7]);
  }

  /** Test if the matrix is a pure rotation. */
  public isRigid(allowMirror: boolean = false): boolean {
    return this.testPerpendicularUnitRowsAndColumns() && (allowMirror || this.determinant() > 0);
  }
  /** Test if all rows and columns are perpendicular to each other and have equal length.
   * If so, the length (or its negative) is the scale factor from a set of rigid axes to these axes.
   * * result.rigidAxes is the rigid axes (with the scale factor removed)
   * * result.scale is the scale factor
   */
  public factorRigidWithSignedScale(): { rigidAxes: Matrix3d, scale: number } | undefined {
    const product = this.multiplyMatrixMatrixTranspose(this);
    const ss = product.sameDiagonalScale();
    if (ss === undefined || ss <= 0.0) return undefined;
    const s = this.determinant() > 0 ? Math.sqrt(ss) : -Math.sqrt(ss);
    const divS = 1.0 / s;
    const result = { rigidAxes: this.scaleColumns(divS, divS, divS), scale: s };
    return result;
  }

  /** Test if the matrix is shuffles and negates columns. */
  public get isSignedPermutation(): boolean {
    let count = 0;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const q = this.at(row, col);
        if (q === 0) {// This comment makes the block non-empty
        } else if (q === 1 || q === -1) {
          // the rest of this row and column should be 0.
          // "at" will apply cyclic indexing.
          count++;
          if (this.at(row + 1, col) !== 0)
            return false;
          if (this.at(row + 2, col) !== 0)
            return false;
          if (this.at(row, col + 1) !== 0)
            return false;
          if (this.at(row, col + 2) !== 0)
            return false;
        } else {// entry is not from 0,1,-1 . . .
          return false;
        }
      }
    return count === 3;
  }

  /** Test if all rows and columns are length 1 and are perpendicular to each other.  (I.e. the matrix is either a pure rotation with uniform scale factor of 1 or -1) */
  public testPerpendicularUnitRowsAndColumns(): boolean {
    const product = this.multiplyMatrixMatrixTranspose(this);
    return product.isIdentity;
  }
  /** create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse).
   * vectorA is placed in the first column of the axis order.
   * vectorB is projected perpendicular to vectorA within their plane and placed in the second column.
   */
  public static createRigidFromColumns(
    vectorA: Vector3d,
    vectorB: Vector3d,
    axisOrder: AxisOrder,
    result?: Matrix3d): Matrix3d | undefined {
    const vectorA1 = vectorA.normalize();
    if (vectorA1) {
      const vectorC1 = vectorA1.unitCrossProduct(vectorB);
      if (vectorC1) {
        const vectorB1 = vectorC1.unitCrossProduct(vectorA);
        if (vectorB1) {
          const retVal = Matrix3d.createShuffledColumns(vectorA1, vectorB1, vectorC1, axisOrder, result);
          retVal.setupInverseTranspose();
          return retVal;
        }
      }
    }
    return undefined;
  }

  /** create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse).
   * columns are taken from the source Matrix3d in order indicated by the axis order.
   */
  public static createRigidFromMatrix3d(
    source: Matrix3d,
    axisOrder: AxisOrder = AxisOrder.XYZ,
    result?: Matrix3d): Matrix3d | undefined {
    result = source.clone(result);
    const maxAbs = result.maxAbs();
    if (Geometry.isSmallMetricDistance(maxAbs))
      return undefined;
    const scale = 1.0 / maxAbs;
    result.scaleColumnsInPlace(scale, scale, scale);
    result.axisOrderCrossProductsInPlace(axisOrder);
    if (result.normalizeColumnsInPlace())
      return result;
    return undefined;
  }
  private static computeQuatTerm(numerator: number, denomCoff: number, reciprocal: number, diagSum: number): number {
    let coff: number;
    const diagTol = 0.500;
    if (diagSum > diagTol) {
      coff = Math.sqrt(diagSum) * 0.5;
      if (denomCoff * numerator < 0.0)
        coff = - coff;
    } else {
      coff = numerator * reciprocal;
    }
    return coff;
  }

  /** create a matrix from a quaternion.
   * WARNING: There is frequent confusion over whether a "from quaternion" matrix is organized by rows and columns.
   * WARNING: If you find that the matrix seems to rotate by the opposite angle expect it, transpose it.
   */
  public static createFromQuaternion(quat: Point4d): Matrix3d {

    const qqx = quat.x * quat.x;
    const qqy = quat.y * quat.y;
    const qqz = quat.z * quat.z;
    const qqw = quat.w * quat.w;

    const mag2 = qqx + qqy + qqz + qqw;

    if (mag2 === 0.0) {
      return Matrix3d.createIdentity();
    } else {
      const a = 1.0 / mag2;

      const matrix = Matrix3d.createRowValues(
        a * (qqw + qqx - qqy - qqz), 2.0 * a * (quat.w * quat.z + quat.x * quat.y), 2.0 * a * (quat.x * quat.z - quat.w * quat.y),
        2.0 * a * (quat.x * quat.y - quat.w * quat.z), a * (qqw - qqx + qqy - qqz), 2.0 * a * (quat.w * quat.x + quat.y * quat.z),
        2.0 * a * (quat.x * quat.z + quat.w * quat.y), 2.0 * a * (quat.y * quat.z - quat.w * quat.x), a * (qqw - qqx - qqy + qqz));
      return matrix;
    }
  }
  /** convert the matrix to a quaternion.
   * @note This calculation requires the matrix to have unit length rows and columns.
   * WARNING: There is frequent confusion over whether a "from quaternion" matrix is organized by rows and columns.
   * WARNING: If you find that the matrix seems to rotate by the opposite angle expect it, transpose it.
   */
  public toQuaternion(): Point4d {
    const result = Point4d.createZero();
    const props = [[this.coffs[0], this.coffs[3], this.coffs[6]],
    [this.coffs[1], this.coffs[4], this.coffs[7]],
    [this.coffs[2], this.coffs[5], this.coffs[8]]];

    const xx = props[0][0];
    const yy = props[1][1];
    const zz = props[2][2];
    const dSum: number[] = [];
    let denom: number, maxIndex: number, i: number;

    dSum[0] = 1.0 + xx - yy - zz;
    dSum[1] = 1.0 - xx + yy - zz;
    dSum[2] = 1.0 - xx - yy + zz;
    dSum[3] = 1.0 + xx + yy + zz;

    maxIndex = 0;
    for (i = 1; i < 4; i++) {
      if (dSum[i] > dSum[maxIndex])
        maxIndex = i;
    }

    if (maxIndex === 0) {
      result.x = 0.5 * Math.sqrt(dSum[0]);
      denom = 1.0 / (4.0 * result.x);
      result.y = Matrix3d.computeQuatTerm(props[0][1] + props[1][0], result.x, denom, dSum[1]);
      result.z = Matrix3d.computeQuatTerm(props[0][2] + props[2][0], result.x, denom, dSum[2]);
      result.w = Matrix3d.computeQuatTerm(props[2][1] - props[1][2], result.x, denom, dSum[3]);
    } else if (maxIndex === 1) {
      result.y = 0.5 * Math.sqrt(dSum[1]);
      denom = 1.0 / (4.0 * result.y);
      result.x = Matrix3d.computeQuatTerm(props[0][1] + props[1][0], result.y, denom, dSum[0]);
      result.z = Matrix3d.computeQuatTerm(props[1][2] + props[2][1], result.y, denom, dSum[2]);
      result.w = Matrix3d.computeQuatTerm(props[0][2] - props[2][0], result.y, denom, dSum[3]);

    } else if (maxIndex === 2) {
      result.z = 0.5 * Math.sqrt(dSum[2]);
      denom = 1.0 / (4.0 * result.z);
      result.x = Matrix3d.computeQuatTerm(props[0][2] + props[2][0], result.z, denom, dSum[0]);
      result.y = Matrix3d.computeQuatTerm(props[1][2] + props[2][1], result.z, denom, dSum[1]);
      result.w = Matrix3d.computeQuatTerm(props[1][0] - props[0][1], result.z, denom, dSum[3]);

    } else {
      result.w = 0.5 * Math.sqrt(dSum[3]);
      denom = 1.0 / (4.0 * result.w);
      result.x = Matrix3d.computeQuatTerm(props[2][1] - props[1][2], result.w, denom, dSum[0]);
      result.y = Matrix3d.computeQuatTerm(props[0][2] - props[2][0], result.w, denom, dSum[1]);
      result.z = Matrix3d.computeQuatTerm(props[1][0] - props[0][1], result.w, denom, dSum[2]);
    }
    return result;
  }
}
