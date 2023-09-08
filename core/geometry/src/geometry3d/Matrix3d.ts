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

/* eslint-disable @itwin/prefer-get */
// cSpell:words XXYZ YXYZ ZXYZ SaeedTorabi arctan newcommand diagonalization
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
   * Multiply 3x3 matrix `a*b`, store in `result`.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(
      result,
      (a[0] * b[0] + a[1] * b[3] + a[2] * b[6]),
      (a[0] * b[1] + a[1] * b[4] + a[2] * b[7]),
      (a[0] * b[2] + a[1] * b[5] + a[2] * b[8]),
      (a[3] * b[0] + a[4] * b[3] + a[5] * b[6]),
      (a[3] * b[1] + a[4] * b[4] + a[5] * b[7]),
      (a[3] * b[2] + a[4] * b[5] + a[5] * b[8]),
      (a[6] * b[0] + a[7] * b[3] + a[8] * b[6]),
      (a[6] * b[1] + a[7] * b[4] + a[8] * b[7]),
      (a[6] * b[2] + a[7] * b[5] + a[8] * b[8]),
    );
    return result;
  }
  /**
   * Multiply 3x3 matrix `a*bTranspose`, store in `result`.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixMatrixTranspose(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(
      result,
      (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
      (a[0] * b[3] + a[1] * b[4] + a[2] * b[5]),
      (a[0] * b[6] + a[1] * b[7] + a[2] * b[8]),
      (a[3] * b[0] + a[4] * b[1] + a[5] * b[2]),
      (a[3] * b[3] + a[4] * b[4] + a[5] * b[5]),
      (a[3] * b[6] + a[4] * b[7] + a[5] * b[8]),
      (a[6] * b[0] + a[7] * b[1] + a[8] * b[2]),
      (a[6] * b[3] + a[7] * b[4] + a[8] * b[5]),
      (a[6] * b[6] + a[7] * b[7] + a[8] * b[8]),
    );
    return result;
  }
  /**
   * Multiply 3x3 matrix `aTranspose*b`, store in `result`.
   * * All params assumed length 9, allocated by caller.
   * * c may alias either input.
   */
  public static multiplyMatrixTransposeMatrix(a: Float64Array, b: Float64Array, result?: Float64Array): Float64Array {
    if (!result) result = new Float64Array(9);
    PackedMatrix3dOps.loadMatrix(
      result,
      (a[0] * b[0] + a[3] * b[3] + a[6] * b[6]),
      (a[0] * b[1] + a[3] * b[4] + a[6] * b[7]),
      (a[0] * b[2] + a[3] * b[5] + a[6] * b[8]),
      (a[1] * b[0] + a[4] * b[3] + a[7] * b[6]),
      (a[1] * b[1] + a[4] * b[4] + a[7] * b[7]),
      (a[1] * b[2] + a[4] * b[5] + a[7] * b[8]),
      (a[2] * b[0] + a[5] * b[3] + a[8] * b[6]),
      (a[2] * b[1] + a[5] * b[4] + a[8] * b[7]),
      (a[2] * b[2] + a[5] * b[5] + a[8] * b[8]),
    );
    return result;
  }
  /** Transpose 3x3 matrix `a` in place */
  public static transposeInPlace(a: Float64Array) {
    let q = a[1]; a[1] = a[3]; a[3] = q;
    q = a[2]; a[2] = a[6]; a[6] = q;
    q = a[5]; a[5] = a[7]; a[7] = q;
  }
  /**
   * Returns the transpose of 3x3 matrix `a`
   * * If `dest` is passed as argument, then the function copies the transpose of 3x3 matrix `a` into `dest`
   * * `a` is not changed unless also passed as the dest, i.e., copyTransposed(a,a) transposes `a` in place
   */
  public static copyTransposed(a: Float64Array, dest?: Float64Array): Float64Array {
    if (dest === a) {
      PackedMatrix3dOps.transposeInPlace(dest);
    } else {
      if (!dest)
        dest = new Float64Array(9);
      dest[0] = a[0]; dest[1] = a[3]; dest[2] = a[6];
      dest[3] = a[1]; dest[4] = a[4]; dest[5] = a[7];
      dest[6] = a[2]; dest[7] = a[5]; dest[8] = a[8];
    }
    return dest;
  }
  /** Copy matrix `a` entries into `dest` */
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
 * * inverseStored: the matrix has its inverse stored.
 * * singular: the matrix is known to be singular.
 * @public
 */
export enum InverseMatrixState {
  /**
   * The invertibility of the `coffs` array has not been determined.
   * Any `inverseCoffs` contents are random.
   */
  unknown,
  /**
   * An inverse was computed and stored as the `inverseCoffs`
   */
  inverseStored,
  /**
   * The `coffs` array is known to be singular.
   * Any `inverseCoffs` contents are random.
   */
  singular,
}

/** A Matrix3d is a 3x3 matrix.
 * * A very common use is to hold a rigid body rotation (which has no scaling or skew), but the 3x3 contents can
 * also hold scaling and skewing.
 * * The matrix with 2-dimensional layout (note: a 2d array can be shown by a matrix)
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
 * * Construction methods that are able to trivially construct the inverse, store it immediately and note that in
 * the inverseState.
 * * Constructions (e.g. createRowValues) for which the inverse is not immediately known mark the inverseState as
 * unknown.
 * * Later queries for the inverse, trigger full computation if needed at that time.
 * * Most matrix queries are present with both "column" and "row" variants.
 * * Usage elsewhere in the library is typically "column" based.  For example, in a Transform that carries a
 * coordinate frame, the matrix columns are the unit vectors for the axes.
 * @public
 */
export class Matrix3d implements BeJSONFunctions {
  /** Control flag for whether this class uses cached inverse of matrices. */
  public static useCachedInverse = true;  // cached inverse can be suppressed for testing.
  /** Total number of times a cached inverse was used to avoid recompute */
  public static numUseCache = 0;
  /** Total number of times a cached inverse was computed. */
  public static numComputeCache = 0;
  /**
   * Matrix contents as a flat array of numbers in row-major order.
   * ```
   * equation
   * \mxy{B}
   * \mij{B}
   * ```
   * * DO NOT directly modify this array. It will destroy safety of the cached inverse state.
   */
  public coffs: Float64Array;
  /**
   * Matrix inverse contents.
   * ```
   * equation
   * \mxy{A}
   * ```
   * * DO NOT directly modify this array. It will destroy integrity of the cached inverse state.
   */
  public inverseCoffs: Float64Array | undefined;
  /** Indicates if inverse is unknown, available, or known singular */
  public inverseState: InverseMatrixState;
  /** The identity matrix */
  private static _identity: Matrix3d;
  /** temporary buffer to store a matrix as a Float64Array (array of 9 floats) */
  private static _productBuffer = new Float64Array(9);
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
    /*
    hm.. can't freeze the Float64Arrays..
    Object.freeze(this.coffs);
    if (this.inverseCoffs)
      Object.freeze(this.inverseCoffs);
    */
    return Object.freeze(this);
  }
  /**
   * Constructor
   * @param coffs optional coefficient array.
   * * **WARNING:** coffs is captured (i.e., is now owned by the Matrix3d object and can be modified by it).
   */
  public constructor(coffs?: Float64Array) {
    this.coffs = coffs ? coffs : new Float64Array(9);
    this.inverseCoffs = undefined;
    this.inverseState = InverseMatrixState.unknown;
  }
  /**
   * Return a json object containing the 9 numeric entries as a single array in row major order,
   * `[ [1, 2, 3],[ 4, 5, 6], [7, 8, 9] ]`
   */
  public toJSON(): Matrix3dProps {
    return [[this.coffs[0], this.coffs[1], this.coffs[2]],
    [this.coffs[3], this.coffs[4], this.coffs[5]],
    [this.coffs[6], this.coffs[7], this.coffs[8]]];
  }
  /**
   * Copy data from various input forms to this matrix.
   * The source can be:
   * * Another `Matrix3d`
   * * An array of 3 arrays, each of which has the 3 numbers for a row of the matrix.
   * * An array of 4 or 9 numbers in row major order.
   * * **WARNING:** if json is an array of numbers but size is not 4 or 9, the matrix is set to zeros.
   */
  public setFromJSON(json?: Matrix3dProps | Matrix3d): void {
    this.inverseCoffs = undefined;
    // if no json is passed
    if (!json) {
      this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
      return;
    }
    // if json is Matrix3d
    if (!Array.isArray(json)) {
      if (json instanceof Matrix3d)
        this.setFrom(json);
      return;
    }
    // if json is Matrix3dProps and is an array of arrays
    if (Geometry.isArrayOfNumberArray(json, 3, 3)) {
      const data = json as number[][];
      this.setRowValues(
        data[0][0], data[0][1], data[0][2],
        data[1][0], data[1][1], data[1][2],
        data[2][0], data[2][1], data[2][2]);
      return;
    }
    // if json is Matrix3dProps and is an array of numbers
    if (json.length === 9) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], data[2],
        data[3], data[4], data[5],
        data[6], data[7], data[8]);
      return;
    } else if (json.length === 4) {
      const data = json as number[];
      this.setRowValues(
        data[0], data[1], 0,
        data[2], data[3], 0,
        0, 0, 1);
      return;
    }
    // if json is Matrix3dProps but is not the right size
    this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
    return;
  }
  /** Return a new Matrix3d constructed from contents of the json value. See `setFromJSON` for layout rules */
  public static fromJSON(json?: Matrix3dProps): Matrix3d {
    const result = Matrix3d.createIdentity();
    result.setFromJSON(json);
    return result;
  }
  /**
   * Test if `this` and `other` are within tolerance in all numeric entries.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqual(other: Matrix3d, tol?: number): boolean {
    return Geometry.isDistanceWithinTol(this.maxDiff(other), tol);
  }
  /**
   * Test if `this` and `other` are within tolerance in the column entries specified by `columnIndex`.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqualColumn(columnIndex: AxisIndex, other: Matrix3d, tol?: number): boolean {
    const max = Geometry.maxAbsXYZ(
      this.coffs[columnIndex] - other.coffs[columnIndex],
      this.coffs[columnIndex + 3] - other.coffs[columnIndex + 3],
      this.coffs[columnIndex + 6] - other.coffs[columnIndex + 6]);
    return Geometry.isDistanceWithinTol(max, tol);
  }
  /**
   * Test if column (specified by `columnIndex`) entries of `this` and [ax,ay,az] are within tolerance.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqualColumnXYZ(columnIndex: AxisIndex, ax: number, ay: number, az: number, tol?: number): boolean {
    const max = Geometry.maxAbsXYZ(
      this.coffs[columnIndex] - ax,
      this.coffs[columnIndex + 3] - ay,
      this.coffs[columnIndex + 6] - az);
    return Geometry.isDistanceWithinTol(max, tol);
  }
  /**
   * Test if `this` and `other` have almost equal Z column and have X and Y columns differing only by a
   * rotation of the same angle around that Z.
   * * **WARNING:** X and Y columns have to be perpendicular to Z column in both `this` and `other`.
   * @param tol optional tolerance for comparisons by Geometry.isDistanceWithinTol
   */
  public isAlmostEqualAllowZRotation(other: Matrix3d, tol?: number): boolean {
    if (this.isAlmostEqual(other, tol))
      return true;
    if (this.isAlmostEqualColumn(AxisIndex.Z, other, tol)) {
      const radians = Angle.radiansBetweenVectorsXYZ(
        this.coffs[0], this.coffs[3], this.coffs[6],
        other.coffs[0], other.coffs[3], other.coffs[6],
      );
      const angle = Angle.createRadians(radians); // angle between X columns in `this` and `other`
      const columnX = this.columnX();
      const columnY = this.columnY();
      const columnZ = this.columnZ();
      /**
       * Here we rotate this.columnX() around this.columnZ() by "angle" and expect to get other.columnX().
       * Then we rotate this.columnY() around this.columnZ() by the same "angle" and if we get other.columnY(),
       * that means `this` and `other` have X and Y columns differing only by a rotation around column Z.
       */
      let column = Vector3d.createRotateVectorAroundVector(columnX, columnZ, angle)!;
      if (other.isAlmostEqualColumnXYZ(0, column.x, column.y, column.z, tol)) {
        column = Vector3d.createRotateVectorAroundVector(columnY, columnZ, angle)!;
        return other.isAlmostEqualColumnXYZ(1, column.x, column.y, column.z, tol);
      }
    }
    return false;
  }
  /** Test for exact (bitwise) equality with other. */
  public isExactEqual(other: Matrix3d): boolean {
    return this.maxDiff(other) === 0.0;
  }
  /** test if all entries in the z row and column are exact 001, i.e. the matrix only acts in 2d */
  public get isXY(): boolean {
    return this.coffs[2] === 0.0
      && this.coffs[5] === 0.0
      && this.coffs[6] === 0.0
      && this.coffs[7] === 0.0
      && this.coffs[8] === 1.0;
  }
  /**
   * If result is not provided, then the method returns a new (zeroed) matrix; otherwise the result is
   * not zeroed first and is just returned as-is.
   */
  private static _create(result?: Matrix3d): Matrix3d {
    return result ? result : new Matrix3d();
  }
  /**
   * Returns a Matrix3d populated by numeric values given in row-major order.
   * Sets all entries in the matrix from call parameters appearing in row-major order, i.e.
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
   * * The inputs are captured into (i.e., owned by) the new Matrix3d.
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
   * Create a matrix by distributing vectors to columns in one of 6 orders.
   * @param axisOrder identifies where the columns are placed.
   * @param columnA vector to place in the column specified by first letter in the AxisOrder name.
   * @param columnB vector to place in the column specified by second letter in the AxisOrder name.
   * @param columnC vector to place in the column specified by third letter in the AxisOrder name.
   * @param result optional result matrix3d
   * * Example: If you pass AxisOrder.YZX, then result will be [columnC, columnA, columnB] because
   * first letter Y means columnA should go to the second column, second letter Z means columnB should
   * go to the third column, and third letter X means columnC should go to the first column.
   */
  public static createColumnsInAxisOrder(
    axisOrder: AxisOrder, columnA: Vector3d | undefined, columnB: Vector3d | undefined,
    columnC: Vector3d | undefined, result?: Matrix3d,
  ): Matrix3d {
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
    } else {  // AxisOrder.XYZ
      result.setColumns(columnA, columnB, columnC);
    }
    return result;
  }
  /**
   * Create the inverseCoffs member (filled with zeros)
   * This is for use by matrix * matrix multiplications which need to be sure the member is there to be
   * filled with method-specific content.
   */
  private createInverseCoffsWithZeros() {
    if (!this.inverseCoffs) {
      this.inverseState = InverseMatrixState.unknown;
      this.inverseCoffs = new Float64Array(9);
    }
  }
  /**
   * Copy the transpose of the coffs to the inverseCoffs.
   * * Mark the matrix as inverseStored.
   */
  private setupInverseTranspose() {
    const coffs = this.coffs;
    this.inverseState = InverseMatrixState.inverseStored;
    this.inverseCoffs = Float64Array.from([
      coffs[0], coffs[3], coffs[6],
      coffs[1], coffs[4], coffs[7],
      coffs[2], coffs[5], coffs[8],
    ]);
  }
  /**
   * Set all entries in the matrix from call parameters appearing in row-major order.
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
  public setIdentity() {
    this.setRowValues(1, 0, 0, 0, 1, 0, 0, 0, 1);
    this.setupInverseTranspose();
  }
  /** Set the matrix to all zeros. */
  public setZero() {
    this.setRowValues(0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.inverseState = InverseMatrixState.singular;
  }
  /** Copy contents from the `other` matrix. If `other` is undefined, use identity matrix. */
  public setFrom(other: Matrix3d | undefined): void {
    if (other === undefined) {
      this.setIdentity();
      return;
    }
    if (other !== this) {
      for (let i = 0; i < 9; i++)
        this.coffs[i] = other.coffs[i];
      if (other.inverseState === InverseMatrixState.inverseStored && other.inverseCoffs !== undefined) {
        this.createInverseCoffsWithZeros();
        for (let i = 0; i < 9; i++)
          this.inverseCoffs![i] = other.inverseCoffs[i];
        this.inverseState = InverseMatrixState.inverseStored;
      } else if (other.inverseState !== InverseMatrixState.inverseStored) {
        this.inverseState = other.inverseState;
      } else {  // This is reached when other says stored but does not have coffs. This should not happen.
        this.inverseState = InverseMatrixState.unknown;
      }
    }
  }
  /**
   * Return a clone of this matrix.
   * * Coefficients are copied.
   * * Inverse coefficients and inverse status are copied if stored by `this`.
   */
  public clone(result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    result.setFrom(this);
    return result;
  }
  /**
   * Create a matrix with all zeros.
   * * Note that for geometry transformations "all zeros" is not a useful default state.
   * * Hence, almost always use `createIdentity` for graphics transformations.
   * * "All zeros" is appropriate for summing moment data.
   * ```
   * equation
   * \begin{bmatrix}0 & 0 & 0 \\ 0 & 0 & 0 \\ 0 & 0 & 0\end{bmatrix}
   * ```
   */
  public static createZero(): Matrix3d {
    const retVal = new Matrix3d();
    retVal.inverseState = InverseMatrixState.singular;
    return retVal;
  }
  /**
   * Create an identity matrix.
   * * All diagonal entries (xx,yy,zz) are one
   * * All others are zero.
   * * This (rather than "all zeros") is the useful state for most graphics transformations.
   * ```
   * equation
   * \begin{bmatrix}1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1\end{bmatrix}
   * ```
   *
   */
  public static createIdentity(result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    result.setIdentity();
    return result;
  }
  /**
   * Create a matrix with distinct x,y,z diagonal (scale) entries.
   * ```
   * equation
   * \begin{bmatrix}s_x & 0 & 0 \\ 0 & s_y & 0\\ 0 & 0 & s_z\end{bmatrix}
   * ```
   */
  public static createScale(
    scaleFactorX: number, scaleFactorY: number, scaleFactorZ: number, result?: Matrix3d,
  ): Matrix3d {
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
      result.inverseCoffs = Float64Array.from(
        [1 / scaleFactorX, 0, 0,
          0, 1 / scaleFactorY, 0,
          0, 0, 1 / scaleFactorZ],
      );
    }
    return result;
  }
  /**
   * Create a matrix with uniform scale factors for scale factor "s"
   * ```
   * equation
   * \begin{bmatrix}s & 0 & 0 \\ 0 & s & 0\\ 0 & 0 & s\end{bmatrix}
   * ```
   */
  public static createUniformScale(scaleFactor: number): Matrix3d {
    return Matrix3d.createScale(scaleFactor, scaleFactor, scaleFactor);
  }
  /**
   * Return a vector that is perpendicular to the input `vectorA`.
   * * Among the infinite number of perpendiculars possible, this method favors having one in the xy plane.
   * * Hence, when `vectorA` is close to the Z axis, the returned vector is `vectorA cross -unitY`
   * but when `vectorA` is NOT close to the Z axis, the returned vector is `unitZ cross vectorA`.
   */
  public static createPerpendicularVectorFavorXYPlane(vectorA: Vector3d, result?: Vector3d): Vector3d {
    const a = vectorA.magnitude();
    const scale = 64.0;   // A constant from the dawn of time in the CAD industry
    const b = a / scale;
    // if vectorA is close to the Z axis
    if (Math.abs(vectorA.x) < b && Math.abs(vectorA.y) < b) {
      return Vector3d.createCrossProduct(vectorA.x, vectorA.y, vectorA.z, 0, -1, 0, result);
    }
    // if vectorA is NOT close to the Z axis
    return Vector3d.createCrossProduct(0, 0, 1, vectorA.x, vectorA.y, vectorA.z, result);
  }
  /**
   * Return a vector that is perpendicular to the input `vectorA`.
   * * Among the infinite number of perpendiculars possible, this method favors having one near the plane
   * containing Z.
   * That is achieved by cross product of `this` vector with the result of createPerpendicularVectorFavorXYPlane.
   */
  public static createPerpendicularVectorFavorPlaneContainingZ(vectorA: Vector3d, result?: Vector3d): Vector3d {
    /**
     * vectorA, result (below), and "vectorA cross result" form a coordinate system where "result" is located on
     * the XY-plane. Once you've got a coordinate system with an axis in the XY-plane, your other two axes form
     * a plane that includes the z-axis.
     */
    result = Matrix3d.createPerpendicularVectorFavorXYPlane(vectorA, result);
    return vectorA.crossProduct(result, result);
  }
  /**
   * Create a matrix from column vectors, shuffled into place per axisOrder
   * * For example, if axisOrder = XYZ then it returns [vectorU, vectorV, vectorW]
   * * Another example, if axisOrder = YZX then it returns [vectorW, vectorU, vectorV] because
   * Y is at index 0 so vectorU goes to the column Y (column 2), Z is at index 1 so vectorV goes
   * to the column Z (column 3), and X is at index 2 so vectorW goes to the column X (column 1)
   */
  public static createShuffledColumns(
    vectorU: Vector3d, vectorV: Vector3d, vectorW: Vector3d, axisOrder: AxisOrder, result?: Matrix3d,
  ): Matrix3d {
    const target = Matrix3d._create(result);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 0), vectorU);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 1), vectorV);
    target.setColumn(Geometry.axisOrderToAxis(axisOrder, 2), vectorW);
    return target;
  }
  /**
   * Create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse).
   * * `vectorA1 = Normalized vectorA` is placed in the column specified by **first** letter in
   * the AxisOrder name.
   * * Normalized `vectorC1 = vectorA1 cross vectorB` is placed in the column specified by **third**
   * letter in the AxisOrder name.
   * * Normalized  `vectorC1 cross vectorA` is placed in the column specified by **second**
   * letter in the AxisOrder name.
   * * This function internally uses createShuffledColumns.
   */
  public static createRigidFromColumns(
    vectorA: Vector3d, vectorB: Vector3d, axisOrder: AxisOrder, result?: Matrix3d,
  ): Matrix3d | undefined {
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
  /**
   * Construct a rigid matrix (orthogonal matrix with +1 determinant) using vectorA and its 2 perpendicular.
   * * If axisOrder is not passed then `AxisOrder = AxisOrder.ZXY` is used as default.
   * * This function internally uses createPerpendicularVectorFavorXYPlane and createRigidFromColumns.
   * * If you want to rotate a given plane (which contains (0,0,0)) to the xy-plane, pass the normal vector of
   * your plane into createRigidHeadsUp. The transpose of the returned Matrix3d can be used to rotate your plane
   * to the xy-plane. If plane does not contain (0,0,0) then the plane is rotated to a plane parallel to the xy-plane.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/2PerpendicularVectorsTo1Vector
   */
  public static createRigidHeadsUp(
    vectorA: Vector3d, axisOrder: AxisOrder = AxisOrder.ZXY, result?: Matrix3d,
  ): Matrix3d {
    const vectorB = Matrix3d.createPerpendicularVectorFavorXYPlane(vectorA);
    const matrix = Matrix3d.createRigidFromColumns(vectorA, vectorB, axisOrder, result);
    if (matrix) {
      matrix.setupInverseTranspose();
      return matrix;
    }
    return Matrix3d.createIdentity(result);
  }
  /**
   * Return the matrix for rotation of `angle` around desired `axis`
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/CubeRotationAroundAnAxis
   * @param axis the axis of rotation
   * @param angle the angle of rotation
   * @param result caller-allocated matrix (optional)
   * @returns the `rotation matrix` or `undefined` (if axis magnitude is near zero).
   */
  public static createRotationAroundVector(axis: Vector3d, angle: Angle, result?: Matrix3d): Matrix3d | undefined {
    // Rodriguez formula (matrix form), https://mathworld.wolfram.com/RodriguesRotationFormula.html
    const c = angle.cos();
    const s = angle.sin();
    const v = 1.0 - c;
    const unit = axis.normalize();
    if (unit) {
      const retVal = Matrix3d.createRowValues(
        unit.x * unit.x * v + c, unit.x * unit.y * v - s * unit.z, unit.x * unit.z * v + s * unit.y,
        unit.y * unit.x * v + s * unit.z, unit.y * unit.y * v + c, unit.y * unit.z * v - s * unit.x,
        unit.z * unit.x * v - s * unit.y, unit.z * unit.y * v + s * unit.x, unit.z * unit.z * v + c,
        result,
      );
      retVal.setupInverseTranspose();
      return retVal;
    }
    return undefined;
  }
  /** Returns a rotation of specified angle around one of the main axis (X,Y,Z).
   * @param axisIndex index of axis (AxisIndex.X, AxisIndex.Y, AxisIndex.Z) kept fixed by the rotation.
   * @param angle angle of rotation
   * @param result optional result matrix.
   * * Math details of 3d rotation matrices derivation can be found at docs/learning/geometry/Angle.md
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
  /**
   * Replace current rows Ui and Uj with (c*Ui + s*Uj) and (c*Uj - s*Ui).
   * * There is no checking for i,j being 0,1,2.
   * * The instance matrix A is multiplied in place on the left by a Givens rotation G, resulting in the matrix G*A.
   * @param i first row index. **must be 0,1,2** (unchecked)
   * @param j second row index. **must be 0,1,2** (unchecked)
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
   * Replace current columns Ui and Uj with (c*Ui + s*Uj) and (c*Uj - s*Ui).
   * * There is no checking for i,j being 0,1,2.
   * * The instance matrix A is multiplied in place on the right by a Givens rotation G, resulting in the matrix A*G.
   * * This is used in compute intensive inner loops
   * @param i first row index. **must be 0,1,2** (unchecked)
   * @param j second row index. **must be 0,1,2** (unchecked)
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
        vectorU.z, vectorV.z, vectorW.z,
        result,
      );
  }
  /** Create a matrix with each column's _x,y_ parts given `XAndY` and separate numeric z values.
   * ```
   * equation
   * \begin{bmatrix}U_x & V_x & W_x \\ U_y & V_y & W_y \\ u & v & w \end{bmatrix}
   * ```
   */
  public static createColumnsXYW(vectorU: XAndY, u: number, vectorV: XAndY, v: number,
    vectorW: XAndY, w: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues
      (
        vectorU.x, vectorV.x, vectorW.x,
        vectorU.y, vectorV.y, vectorW.y,
        u, v, w,
        result,
      );
  }
  /**
   * Create a matrix from "as viewed" right and up vectors.
   * * ColumnX points in the rightVector direction.
   * * ColumnY points in the upVector direction.
   * * ColumnZ is a unit cross product of ColumnX and ColumnY.
   * * Optionally rotate by 45 degrees around `upVector` to bring its left or right vertical edge to center.
   * * Optionally rotate by arctan(1/sqrt(2)) ~ 35.264 degrees around `rightVector` to bring the top or bottom
   * horizontal edge of the view to the center (for isometric views).
   *
   * This is expected to be used with various principal unit vectors that are perpendicular to each other.
   * * STANDARD TOP VIEW: createViewedAxes(Vector3d.unitX(), Vector3d.unitY(), 0, 0)
   * * STANDARD FRONT VIEW: createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), 0, 0)
   * * STANDARD BACK VIEW: createViewedAxes(Vector3d.unitX(-1), Vector3d.unitZ(), 0, 0)
   * * STANDARD RIGHT VIEW: createViewedAxes(Vector3d.unitY(), Vector3d.unitZ(), 0, 0)
   * * STANDARD LEFT VIEW: createViewedAxes(Vector3d.unitY(-1), Vector3d.unitZ(), 0, 0)
   * * STANDARD BOTTOM VIEW: createViewedAxes(Vector3d.unitX(), Vector3d.unitY(-1), 0, 0)
   * * STANDARD ISO VIEW: createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), -1, 1)
   * * STANDARD RIGHT ISO VIEW: createViewedAxes(Vector3d.unitX(), Vector3d.unitZ(), 1, 1)
   * * Front, right, back, left, top, and bottom standard views are views from faces of the cube
   * and iso and right iso standard views are views from corners of the cube.
   * * Note: createViewedAxes is column-based so always returns local to world
   *
   * @param rightVector ColumnX of the returned matrix. Expected to be perpendicular to upVector.
   * @param upVector ColumnY of the returned matrix. Expected to be perpendicular to rightVector.
   * @param leftNoneRight Specifies the ccw rotation around `upVector` axis. Normally one of "-1", "0", and "1",
   * where "-1" indicates rotation by 45 degrees to bring the left vertical edge to center, "0" means no rotation,
   * and "1" indicates rotation by 45 degrees to bring the right vertical edge to center. Other numbers are
   * used as multiplier for this 45 degree rotation.
   * @param topNoneBottom Specifies the ccw rotation around `rightVector` axis. Normally one of "-1", "0", and "1",
   * where "-1" indicates isometric rotation (35.264 degrees) to bring the bottom upward, "0" means no rotation,
   * and "1" indicates isometric rotation (35.264 degrees) to bring the top downward. Other numbers are
   * used as multiplier for the 35.264 degree rotation.
   * @returns matrix = [rightVector, upVector, rightVector cross upVector] with the applied rotations specified
   * by leftNoneRight and topNoneBottom. Returns undefined if rightVector and upVector are parallel.
   */
  public static createViewedAxes(
    rightVector: Vector3d, upVector: Vector3d, leftNoneRight: number = 0, topNoneBottom: number = 0,
  ): Matrix3d | undefined {
    const columnZ = rightVector.crossProduct(upVector);
    if (columnZ.normalizeInPlace()) {
      // matrix = [rightVector, upVector, rightVector cross upVector]
      const matrix = Matrix3d.createColumns(rightVector, upVector, columnZ);
      // "45 degrees * leftNoneRight" rotation around Y
      if (leftNoneRight !== 0.0) {
        let c = Math.sqrt(0.5);
        let s = leftNoneRight < 0.0 ? -c : c;
        if (Math.abs(leftNoneRight) !== 1.0) {
          const radians = Angle.degreesToRadians(45.0 * leftNoneRight);
          c = Math.cos(radians);
          s = Math.sin(radians);
        }
        matrix.applyGivensColumnOp(2, 0, c, s); // rotate around Y (equivalent to matrix*rotationY)
      }
      // "35.264 degrees * topNoneBottom" rotation around X
      if (topNoneBottom !== 0.0) {
        const theta = topNoneBottom * Math.atan(Math.sqrt(0.5));
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        matrix.applyGivensColumnOp(1, 2, c, -s); // rotate around X (equivalent to matrix*rotationX)
      }
      return matrix;
    }
    return undefined;
  }
  /**
   * Create a rotation matrix for one of the 8 standard views.
   * * Default is TOP view (`local X = world X`, `local Y = world Y`, `local Z = world Z`).
   * * To change view from the TOP to one of the other 7 standard views, we need to multiply "world data" to
   * the corresponding matrix1 provided by `createStandardWorldToView(index, false)` and then
   * `matrix1.multiply(world data)` will return "local data".
   * * To change view back to the TOP, we need to multiply "local data" to the corresponding matrix2 provided
   * by `createStandardWorldToView(index, true)` and then `matrix2.multiply(local data)` will returns "world data".
   * * Note: No matter how you rotate the world axis, local X is always pointing right, local Y is always pointing up,
   * and local Z is always pointing toward you.
   *
   * @param index standard view index `StandardViewIndex.Top, Bottom, Left, Right, Front, Back, Iso, RightIso`
   * @param invert if false (default), the return matrix is world to local (view) and if true, the the return
   * matrix is local (view) to world.
   * @param result optional result.
   */
  public static createStandardWorldToView(
    index: StandardViewIndex, invert: boolean = false, result?: Matrix3d,
  ): Matrix3d {
    switch (index) {
      // Start with TOP view, ccw rotation by 180 degrees around X
      case StandardViewIndex.Bottom:
        result = Matrix3d.createRowValues(
          1, 0, 0,
          0, -1, 0,
          0, 0, -1);
        break;
      // Start with TOP view, ccw rotation by -90 degrees around X and by 90 degrees around Z
      case StandardViewIndex.Left:
        result = Matrix3d.createRowValues(
          0, -1, 0,
          0, 0, 1,
          -1, 0, 0);
        break;
      // Start with TOP view, ccw rotation by -90 degrees around X and by -90 degrees around Z
      case StandardViewIndex.Right:
        result = Matrix3d.createRowValues(
          0, 1, 0,
          0, 0, 1,
          1, 0, 0);
        break;
      // Start with TOP view, ccw rotation by -90 degrees around X
      case StandardViewIndex.Front:
        result = Matrix3d.createRowValues(
          1, 0, 0,
          0, 0, 1,
          0, -1, 0);
        break;
      // Start with TOP view, ccw rotation by -90 degrees around X and by 180 degrees around Z
      case StandardViewIndex.Back:
        result = Matrix3d.createRowValues(
          -1, 0, 0,
          0, 0, 1,
          0, 1, 0);
        break;
      /**
       * Isometric view
       * Start with FRONT view, ccw rotation by -45 degrees around Y and by arctan(1/sqrt(2)) ~ 35.264 degrees around X
       * cos(45) = 1/sqrt(2) = 0.70710678118 and sin(45) = 1/sqrt(2) = 0.70710678118
       * cos(35.264) = 2/sqrt(6) = 0.81649658092 and sin(35.264) = 1/sqrt(3) = 0.57735026919
       * More info: https://en.wikipedia.org/wiki/Isometric_projection
       */
      case StandardViewIndex.Iso:
        result = Matrix3d.createRowValues(
          0.707106781186548, -0.70710678118654757, 0.00000000000000000,
          0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          -0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      // Start with FRONT view, ccw rotation by 45 degrees around Y and by 35.264 degrees around X
      case StandardViewIndex.RightIso:
        result = Matrix3d.createRowValues(
          0.707106781186548, 0.70710678118654757, 0.00000000000000000,
          -0.408248290463863, 0.40824829046386302, 0.81649658092772603,
          0.577350269189626, -0.57735026918962573, 0.57735026918962573);
        break;
      // no rotation
      case StandardViewIndex.Top:
      default:
        result = Matrix3d.createIdentity(result);
    }
    if (invert)
      result.transposeInPlace(); // matrix is rigid so transpose and inverse are the same
    return result;
  }
  /**
   * Apply (in place) a jacobi eigenvalue algorithm.
   * @param i row index of zeroed member
   * @param j column index of zeroed member
   * @param leftEigenvectors a matrix that its columns will be filled by the left eigenvectors of `this` Matrix3d
   * (allocated by caller, computed and filled by this function). Note that columns of leftEigenVectors will be
   * mutually perpendicular because `this` matrix is symmetric.
   * @param lambda a matrix that its diagonal entries will be filled by eigenvalues and its non-diagonal elements
   * converge to 0 (allocated by caller, computed and filled by this function).
   */
  private applySymmetricJacobi(i: number, j: number, leftEigenvectors: Matrix3d, lambda: Matrix3d): number {
    const sii = lambda.at(i, i);
    const sjj = lambda.at(j, j);
    const sij = lambda.at(i, j);
    if (Math.abs(sij) < Geometry.smallFloatingPoint * (sii + sjj))
      return 0.0;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(sii - sjj, 2.0 * sij);
    const c = jacobi.c;
    const s = jacobi.s;
    /**
     * The following check does not exist in applyFastSymmetricJacobi because here if we don't return
     * early, the matrix remains untouched. However, applyFastSymmetricJacobi zeroes-out elements ij
     * and ji. Therefore, if we return early in applyFastSymmetricJacobi, zeroing-out wont happen.
     */
    if (Math.abs(s) < 2.0e-15)
      return 0.0;
    /**
     * If you apply the following 2 lines to a symmetric matrix, you get same lines used in
     * applyFastSymmetricJacobi. There are 2 differences which make applyFastSymmetricJacobi
     * more efficient. First, we directly set elements ij and ji equal to zero rather than
     * calculation them. Second, we copy symmetric elements from upper triangle to lower
     * instead of calculating them.
     */
    lambda.applyGivensRowOp(i, j, c, s);
    lambda.applyGivensColumnOp(i, j, c, s);
    leftEigenvectors.applyGivensColumnOp(i, j, c, s);
    return Math.abs(sij);
  }
  /**
   * Factor `this` matrix as a product `U * lambda * UT` where `U` is an orthogonal matrix and `lambda`
   * is a diagonal matrix.
   *
   * * **Note 1:** You must apply this function to a `symmetric` matrix. Otherwise, the lower triangle is ignored
   * and the upper triangle is mirrored to the lower triangle to enforce symmetry.
   * * **Note 2:** This function is replaced by a faster method called `fastSymmetricEigenvalues` so consider
   * using the fast version instead.
   * @param leftEigenvectors a matrix that its columns will be filled by the left eigenvectors of `this` Matrix3d
   * (allocated by caller, computed and filled by this function). Note that columns of leftEigenVectors will be
   * mutually perpendicular because `this` matrix is symmetric.
   * @param lambda a vector that its entries will be filled by eigenvalues of `this` Matrix3d (allocated by
   * caller, computed and filled by this function).
   */
  public symmetricEigenvalues(leftEigenvectors: Matrix3d, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    matrix.coffs[3] = matrix.coffs[1];
    matrix.coffs[6] = matrix.coffs[2];
    matrix.coffs[7] = matrix.coffs[5];
    const tolerance = 1.0e-12 * this.sumSquares();
    const numberOfIterations = 7;
    for (let iteration = 0; iteration < numberOfIterations; iteration++) {
      const sum = this.applySymmetricJacobi(0, 1, leftEigenvectors, matrix)
        + this.applySymmetricJacobi(0, 2, leftEigenvectors, matrix)
        + this.applySymmetricJacobi(1, 2, leftEigenvectors, matrix);
      if (sum < tolerance) {
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }
  /**
   * Apply (in place) a jacobi eigenvalue algorithm that diagonalize `this` matrix, i.e., zeros out this.at(i,j).
   * * During diagonalization, the upper triangle is mirrored to lower triangle to enforce symmetry.
   * * Math details can be found at docs/learning/geometry/Matrix.md
   * @param i row index of zeroed member.
   * @param j column index of zeroed member.
   * @param k other row/column index (different from i and j).
   * @param leftEigenVectors a matrix that its columns will be filled by the left eigenvectors of `this` Matrix3d
   * (allocated by caller, computed and filled by this function). Note that columns of leftEigenVectors will be
   * mutually perpendicular because `this` matrix is symmetric.
   */
  private applyFastSymmetricJacobi(i: number, j: number, k: number, leftEigenVectors: Matrix3d): number {
    const indexII = 4 * i;
    const indexJJ = 4 * j;
    const indexIJ = 3 * i + j;
    const indexJI = 3 * j + i;
    const indexIK = 3 * i + k;
    const indexKI = 3 * k + i;
    const indexJK = 3 * j + k;
    const indexKJ = 3 * k + j;
    const sii = this.coffs[indexII];
    const sjj = this.coffs[indexJJ];
    const sij = this.coffs[indexIJ];
    if (Math.abs(sij) < Geometry.smallFloatingPoint * (sii + sjj))
      return 0.0;
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(sii - sjj, 2.0 * sij);
    const c = jacobi.c;
    const s = jacobi.s;
    const cc = c * c;
    const ss = s * s;
    const sc2 = 2.0 * c * s;
    this.coffs[indexII] = cc * sii + sc2 * sij + ss * sjj;
    this.coffs[indexJJ] = ss * sii - sc2 * sij + cc * sjj;
    this.coffs[indexIJ] = 0.0;
    this.coffs[indexJI] = 0.0;
    const a = this.coffs[indexIK];
    const b = this.coffs[indexJK];
    this.coffs[indexIK] = c * a + s * b;
    this.coffs[indexJK] = -s * a + c * b;
    this.coffs[indexKI] = this.coffs[indexIK];
    this.coffs[indexKJ] = this.coffs[indexJK];
    leftEigenVectors.applyGivensColumnOp(i, j, c, s);
    return Math.abs(sij);
  }
  /**
   * Factor `this` matrix as a product `U * lambda * UT` where `U` is an orthogonal matrix and `lambda`
   * is a diagonal matrix.
   *
   * * **Note:** You must apply this function to a `symmetric` matrix. Otherwise, the lower triangle is ignored
   * and the upper triangle is mirrored to the lower triangle to enforce symmetry.
   * * Math details can be found at docs/learning/geometry/Matrix.md
   * @param leftEigenvectors a matrix that its columns will be filled by the left eigenvectors of `this` Matrix3d
   * (allocated by caller, computed and filled by this function). Note that columns of leftEigenVectors will be
   * mutually perpendicular because `this` matrix is symmetric.
   * @param lambda a vector that its entries will be filled by eigenvalues of `this` Matrix3d (allocated by
   * caller, computed and filled by this function).
   */
  public fastSymmetricEigenvalues(leftEigenvectors: Matrix3d, lambda: Vector3d): boolean {
    const matrix = this.clone();
    leftEigenvectors.setIdentity();
    const tolerance = 1.0e-12 * this.sumSquares();
    const numberOfIterations = 7;
    for (let iteration = 0; iteration < numberOfIterations; iteration++) {
      const sum = matrix.applyFastSymmetricJacobi(0, 1, 2, leftEigenvectors)
        + matrix.applyFastSymmetricJacobi(0, 2, 1, leftEigenvectors)
        + matrix.applyFastSymmetricJacobi(1, 2, 0, leftEigenvectors);
      if (sum < tolerance) {
        lambda.set(matrix.at(0, 0), matrix.at(1, 1), matrix.at(2, 2));
        return true;
      }
    }
    return false;
  }
  /**
   * Compute the (unit vector) axis and angle for the rotation generated by `this` Matrix3d.
   * * Math details can be found at docs/learning/geometry/Angle.md
   * @returns Returns axis and angle of rotation with result.ok === true when the conversion succeeded.
   */
  public getAxisAndAngleOfRotation(): { axis: Vector3d, angle: Angle, ok: boolean } {
    const trace = this.coffs[0] + this.coffs[4] + this.coffs[8];
    const skewXY = this.coffs[3] - this.coffs[1]; // 2*z*sin
    const skewYZ = this.coffs[7] - this.coffs[5]; // 2*y*sin
    const skewZX = this.coffs[2] - this.coffs[6]; // 2*x*sin
    // trace = (m00^2 + m11^2 + m22^2) * (1-cos) + 3cos = (1-cos) + 3cos = 1 + 2cos ==> cos = (trace-1) / 2
    const c = (trace - 1.0) / 2.0; // cosine
    const s = Geometry.hypotenuseXYZ(skewXY, skewYZ, skewZX) / 2.0; // sine
    const e = c * c + s * s - 1.0; // s^2 + c^2 = 1
    // if s^2 + c^2 != 1 then we have a bad matrix so return false
    if (Math.abs(e) > Geometry.smallAngleRadians) {
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
    }
    // sin is close to 0 then we got to special cases (angle 0 or 180) which needs to be handled differently
    if (Math.abs(s) < Geometry.smallAngleRadians) {
      if (c > 0)  // sin = 0 and cos = 1 so angle = 0 (i.e., no rotation)
        return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: true };
      /**
       * If sin = 0 and cos = -1 then angle = 180 (i.e., 180 degree rotation around some axis)
       * then the rotation matrix becomes
       *                                 2x^2-1  2xy      2xz
       *                                 2xy     2y^2-1   2yz
       *                                 2xz     2yz      2z^2-1
       * Note that the matrix is "symmetric".
       * If rotation is around one the standard basis then non-diagonal entries become 0 and we
       * have one 1 and two -1s on the diagonal.
       * If rotation is around an axis other than standard basis, then the axis is the eigenvector
       * of the rotation matrix with eigenvalue = 1.
       */
      const axx = this.coffs[0];
      const ayy = this.coffs[4];
      const azz = this.coffs[8];
      // Look for a pair of "-1" entries on the diagonal (for rotation around the basis X,Y,Z axis)
      if (Geometry.isAlmostEqualNumber(-1.0, ayy) && Geometry.isAlmostEqualNumber(-1, azz)) {
        return { axis: Vector3d.create(1, 0, 0), angle: Angle.createDegrees(180), ok: true };
      } else if (Geometry.isAlmostEqualNumber(-1.0, axx) && Geometry.isAlmostEqualNumber(-1, azz)) {
        return { axis: Vector3d.create(0, 1, 0), angle: Angle.createDegrees(180), ok: true };
      } else if (Geometry.isAlmostEqualNumber(-1.0, axx) && Geometry.isAlmostEqualNumber(-1, ayy)) {
        return { axis: Vector3d.create(0, 0, 1), angle: Angle.createDegrees(180), ok: true };
      }
      // Look for eigenvector with eigenvalue = 1
      const eigenvectors = Matrix3d.createIdentity();
      const eigenvalues = Vector3d.create(0, 0, 0);
      if (this.fastSymmetricEigenvalues(eigenvectors, eigenvalues)) { // note: this matrix is "symmetric"
        for (let axisIndex = 0; axisIndex < 2; axisIndex++) {
          const lambda = eigenvalues.at(axisIndex);
          if (Geometry.isAlmostEqualNumber(1, lambda))
            return { axis: eigenvectors.getColumn(axisIndex), angle: Angle.createDegrees(180), ok: true };
        }
        // if no eigenvalue = 1 was found return false
        return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
      }
      // if no axis was found return false
      return { axis: Vector3d.create(0, 0, 1), angle: Angle.createRadians(0), ok: false };
    }
    // good matrix and non-zero sine
    const a = 1.0 / (2.0 * s);
    const result = {
      axis: Vector3d.create(skewYZ * a, skewZX * a, skewXY * a),
      angle: Angle.createAtan2(s, c),
      ok: true,
    };
    return result;
  }
  /**
   * Rotate columns i and j of `this` matrix to make them perpendicular using the angle that zero-out
   * `thisTranspose * this`.
   * @param i row index of zeroed member.
   * @param j column index of zeroed member.
   * @param matrixU a matrix that its columns will be filled by the right eigenvectors of `thisTranspose * this`
   * (allocated by caller, computed and filled by this function). Note that columns of matrixU will be mutually
   *  perpendicular because `thisTranspose * this` matrix is symmetric.
   */
  private applyJacobiColumnRotation(i: number, j: number, matrixU: Matrix3d): number {
    const uDotU = this.coffs[i] * this.coffs[i]
      + this.coffs[i + 3] * this.coffs[i + 3]
      + this.coffs[i + 6] * this.coffs[i + 6];
    const vDotV = this.coffs[j] * this.coffs[j]
      + this.coffs[j + 3] * this.coffs[j + 3]
      + this.coffs[j + 6] * this.coffs[j + 6];
    const uDotV = this.coffs[i] * this.coffs[j]
      + this.coffs[i + 3] * this.coffs[j + 3]
      + this.coffs[i + 6] * this.coffs[j + 6];
    const jacobi = Angle.trigValuesToHalfAngleTrigValues(uDotU - vDotV, 2.0 * uDotV);
    const c = jacobi.c;
    const s = jacobi.s;
    if (Math.abs(s) < 2.0e-15)
      return 0.0;
    this.applyGivensColumnOp(i, j, c, s); // make columns i and j of `this` matrix perpendicular
    matrixU.applyGivensRowOp(i, j, c, s); // right eigenvalues of `thisTranspose * this`
    return Math.abs(uDotV);
  }
  /**
   * Factor `this` matrix as a product `VD * U` where `VD` has mutually perpendicular columns and `U` is orthogonal.
   * @param matrixVD a matrix that its columns will be filled by rotating columns of `this` to make them mutually
   * perpendicular (allocated by caller, computed and filled by this function).
   * @param matrixU a matrix that its columns will be filled by the right eigenvectors of `thisTranspose * this`
   * (allocated by caller, computed and filled by this function). Note that columns of matrixU will be mutually
   *  perpendicular because `thisTranspose * this` matrix is symmetric.
   */
  public factorPerpendicularColumns(matrixVD: Matrix3d, matrixU: Matrix3d): boolean {
    matrixVD.setFrom(this);
    matrixU.setIdentity();
    const tolerance = 1.0e-12 * this.sumSquares();
    const numberOfIterations = 7;
    for (let iteration = 0; iteration < numberOfIterations; iteration++) {
      const sum = matrixVD.applyJacobiColumnRotation(0, 1, matrixU)
        + matrixVD.applyJacobiColumnRotation(0, 2, matrixU)
        + matrixVD.applyJacobiColumnRotation(1, 2, matrixU);
      if (sum < tolerance) {
        return true;
      }
    }
    return false;
  }
  /**
   * Factor `this` matrix as a product `V * D * U` where `V` and `U` are orthogonal and `D` is diagonal with
   * positive entries.
   * * This is formally known as the `Singular Value Decomposition` or `SVD`.
   * @param matrixV an orthogonal matrix that its columns will be filled by the left eigenvectors of
   * `thisTranspose * this` (allocated by caller, computed and filled by this function).
   * @param scale singular values of `this` (allocated by caller, computed and filled by this function).
   * The singular values in the `scale` are non-negative and decreasing.
   * @param matrixU an orthogonal matrix that its columns will be filled by the right eigenvectors of
   * `thisTranspose * this` (allocated by caller, computed and filled by this function).
   */
  public factorOrthogonalScaleOrthogonal(matrixV: Matrix3d, scale: Point3d, matrixU: Matrix3d): boolean {
    const matrixVD = Matrix3d.createZero();
    if (!this.factorPerpendicularColumns(matrixVD, matrixU))
      return false;
    const column: Vector3d[] = [];
    column.push(matrixVD.getColumn(0));
    column.push(matrixVD.getColumn(1));
    column.push(matrixVD.getColumn(2));
    scale.set(column[0].magnitude(), column[1].magnitude(), column[2].magnitude()); // singular values of `this`
    const det = matrixVD.determinant();
    if (det < 0)
      scale.z = -scale.z;
    const almostZero = Geometry.smallFloatingPoint;
    const scaleXIsZero: boolean = Math.abs(scale.x) < almostZero;
    const scaleYIsZero: boolean = Math.abs(scale.y) < almostZero;
    const scaleZIsZero: boolean = Math.abs(scale.z) < almostZero;
    // NOTE: We assume any zero-magnitude column(s) of matrixVD are last
    if (!scaleXIsZero && !scaleYIsZero && !scaleZIsZero) { // full rank
      matrixV = matrixVD.scaleColumns(1 / scale.x, 1 / scale.y, 1 / scale.z, matrixV);
    } else if (!scaleXIsZero && !scaleYIsZero) { // rank 2
      column[0].scaleInPlace(1 / scale.x);
      column[1].scaleInPlace(1 / scale.y);
      column[2] = column[0].unitCrossProduct(column[1], column[2])!;
      matrixV.setColumns(column[0], column[1], column[2]);
    } else if (!scaleXIsZero) { // rank 1
      matrixV = Matrix3d.createRigidHeadsUp(column[0], AxisOrder.XYZ, matrixV); // preserve column0
    } else { // rank 0
      matrixV.setIdentity();
    }
    return true;
  }
  /**
   * Return a matrix that rotates a fraction of the angular sweep from vectorA to vectorB.
   * @param vectorA initial vector position
   * @param fraction fractional rotation (1 means rotate all the way)
   * @param vectorB final vector position
   * @param result optional result matrix.
   */
  public static createPartialRotationVectorToVector(
    vectorA: Vector3d, fraction: number, vectorB: Vector3d, result?: Matrix3d,
  ): Matrix3d | undefined {
    let upVector = vectorA.unitCrossProduct(vectorB);
    // the usual case (both vectors and also their cross product is non-zero)
    if (upVector) {
      return Matrix3d.createRotationAroundVector(
        upVector,
        Angle.createRadians(fraction * vectorA.planarAngleTo(vectorB, upVector).radians),
      );
    }
    // if either vector is zero
    if (Geometry.isSmallMetricDistance(vectorA.magnitude())
      || Geometry.isSmallMetricDistance(vectorB.magnitude()))
      return undefined;
    // aligned vectors (cross product = 0, dot product > 0)
    if (vectorA.dotProduct(vectorB) > 0.0)
      return Matrix3d.createIdentity(result);
    // opposing vectors (cross product = 0, dot product < 0)
    upVector = Matrix3d.createPerpendicularVectorFavorPlaneContainingZ(vectorA, upVector);
    return Matrix3d.createRotationAroundVector(upVector, Angle.createRadians(fraction * Math.PI));
  }
  /** Returns a matrix that rotates from vectorA to vectorB. */
  public static createRotationVectorToVector(
    vectorA: Vector3d, vectorB: Vector3d, result?: Matrix3d,
  ): Matrix3d | undefined {
    return this.createPartialRotationVectorToVector(vectorA, 1.0, vectorB, result);
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
  public columnX(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[0], this.coffs[3], this.coffs[6], result);
  }
  /** Return (a copy of) the Y column */
  public columnY(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[1], this.coffs[4], this.coffs[7], result);
  }
  /** Return (a copy of) the Z column */
  public columnZ(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[2], this.coffs[5], this.coffs[8], result);
  }
  /** Return the X column magnitude squared */
  public columnXMagnitudeSquared(): number {
    return Geometry.hypotenuseSquaredXYZ(this.coffs[0], this.coffs[3], this.coffs[6]);
  }
  /** Return the Y column magnitude squared */
  public columnYMagnitudeSquared(): number {
    return Geometry.hypotenuseSquaredXYZ(this.coffs[1], this.coffs[4], this.coffs[7]);
  }
  /** Return the Z column magnitude squared */
  public columnZMagnitudeSquared(): number {
    return Geometry.hypotenuseSquaredXYZ(this.coffs[2], this.coffs[5], this.coffs[8]);
  }
  /** Return the X column magnitude */
  public columnXMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[3], this.coffs[6]);
  }
  /** Return the Y column magnitude */
  public columnYMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[1], this.coffs[4], this.coffs[7]);
  }
  /** Return the Z column magnitude */
  public columnZMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[2], this.coffs[5], this.coffs[8]);
  }
  /** Return magnitude of columnX cross columnY. */
  public columnXYCrossProductMagnitude(): number {
    return Geometry.crossProductMagnitude(
      this.coffs[0], this.coffs[3], this.coffs[6],
      this.coffs[1], this.coffs[4], this.coffs[7],
    );
  }
  /** Return the X row magnitude */
  public rowXMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[1], this.coffs[2]);
  }
  /** Return the Y row magnitude  */
  public rowYMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[3], this.coffs[4], this.coffs[5]);
  }
  /** Return the Z row magnitude  */
  public rowZMagnitude(): number {
    return Geometry.hypotenuseXYZ(this.coffs[6], this.coffs[7], this.coffs[8]);
  }
  /** Return the dot product of column X with column Y */
  public columnXDotColumnY(): number {
    return this.coffs[0] * this.coffs[1]
      + this.coffs[3] * this.coffs[4]
      + this.coffs[6] * this.coffs[7];
  }
  /** Return the dot product of column X with column Z */
  public columnXDotColumnZ(): number {
    return this.coffs[0] * this.coffs[2]
      + this.coffs[3] * this.coffs[5]
      + this.coffs[6] * this.coffs[8];
  }
  /** Return the dot product of column Y with column Z */
  public columnYDotColumnZ(): number {
    return this.coffs[1] * this.coffs[2]
      + this.coffs[4] * this.coffs[5]
      + this.coffs[7] * this.coffs[8];
  }
  /**
   * Dot product of an indexed column with a vector given as x,y,z
   * @param columnIndex index of column. Must be 0,1,2.
   * @param x x component of vector
   * @param y y component of vector
   * @param z z component of vector
   */
  public columnDotXYZ(columnIndex: AxisIndex, x: number, y: number, z: number): number {
    return this.coffs[columnIndex] * x + this.coffs[columnIndex + 3] * y + this.coffs[columnIndex + 6] * z;
  }
  /** Return (a copy of) the X row */
  public rowX(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[0], this.coffs[1], this.coffs[2], result);
  }
  /** Return (a copy of) the Y row */
  public rowY(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[3], this.coffs[4], this.coffs[5], result);
  }
  /** Return (a copy of) the Z row */
  public rowZ(result?: Vector3d): Vector3d {
    return Vector3d.create(this.coffs[6], this.coffs[7], this.coffs[8], result);
  }
  /** Return the dot product of the vector parameter with the X column. */
  public dotColumnX(vector: XYZ): number {
    return vector.x * this.coffs[0] + vector.y * this.coffs[3] + vector.z * this.coffs[6];
  }
  /** Return the dot product of the vector parameter with the Y column. */
  public dotColumnY(vector: XYZ): number {
    return vector.x * this.coffs[1] + vector.y * this.coffs[4] + vector.z * this.coffs[7];
  }
  /** Return the dot product of the vector parameter with the Z column. */
  public dotColumnZ(vector: XYZ): number {
    return vector.x * this.coffs[2] + vector.y * this.coffs[5] + vector.z * this.coffs[8];
  }
  /** Return the dot product of the vector parameter with the X row. */
  public dotRowX(vector: XYZ): number {
    return vector.x * this.coffs[0] + vector.y * this.coffs[1] + vector.z * this.coffs[2];
  }
  /** Return the dot product of the vector parameter with the Y row. */
  public dotRowY(vector: XYZ): number {
    return vector.x * this.coffs[3] + vector.y * this.coffs[4] + vector.z * this.coffs[5];
  }
  /** Return the dot product of the vector parameter with the Z row. */
  public dotRowZ(vector: XYZ): number {
    return vector.x * this.coffs[6] + vector.y * this.coffs[7] + vector.z * this.coffs[8];
  }
  /** Return the dot product of the x,y,z with the X row. */
  public dotRowXXYZ(x: number, y: number, z: number): number {
    return x * this.coffs[0] + y * this.coffs[1] + z * this.coffs[2];
  }
  /** Return the dot product of the x,y,z with the Y row. */
  public dotRowYXYZ(x: number, y: number, z: number): number {
    return x * this.coffs[3] + y * this.coffs[4] + z * this.coffs[5];
  }
  /** Return the dot product of the x,y,z with the Z row. */
  public dotRowZXYZ(x: number, y: number, z: number): number {
    return x * this.coffs[6] + y * this.coffs[7] + z * this.coffs[8];
  }
  /** Return the cross product of the Z column with the vector parameter. */
  public columnZCrossVector(vector: XYZ, result?: Vector3d): Vector3d {
    return Geometry.crossProductXYZXYZ(
      this.coffs[2], this.coffs[5], this.coffs[8], vector.x, vector.y, vector.z, result,
    );
  }
  /** Set data from xyz parts of Point4d  (w part of Point4d ignored) */
  public setColumnsPoint4dXYZ(vectorU: Point4d, vectorV: Point4d, vectorW: Point4d) {
    this.inverseState = InverseMatrixState.unknown;
    this.setRowValues(
      vectorU.x, vectorV.x, vectorW.x,
      vectorU.y, vectorV.y, vectorW.y,
      vectorU.z, vectorV.z, vectorW.z);
  }
  /**
   * Set entries in one column of the matrix.
   * @param columnIndex column index (this is interpreted cyclically. See Geometry.cyclic3dAxis for more info).
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
  /**
   * Set all columns of the matrix. Any undefined vector is zeros.
   * @param vectorX values for column 0
   * @param vectorY values for column 1
   * @param vectorZ optional values for column 2 (it's optional in case column 2 is 000, which is a
   * projection onto the xy-plane)
   */
  public setColumns(vectorX: Vector3d | undefined, vectorY: Vector3d | undefined, vectorZ?: Vector3d) {
    this.setColumn(0, vectorX);
    this.setColumn(1, vectorY);
    this.setColumn(2, vectorZ);
  }
  /**
   * Set entries in one row of the matrix.
   * @param rowIndex row index. This is interpreted cyclically (using Geometry.cyclic3dAxis).
   * @param value x,y,z values for row.
   */
  public setRow(rowIndex: number, value: Vector3d) {
    const index = 3 * Geometry.cyclic3dAxis(rowIndex);
    this.coffs[index] = value.x;
    this.coffs[index + 1] = value.y;
    this.coffs[index + 2] = value.z;
    this.inverseState = InverseMatrixState.unknown;
  }
  /**
   * Return (a copy of) a column of the matrix.
   * @param i column index. This is interpreted cyclically (using Geometry.cyclic3dAxis).
   * @param result optional preallocated result.
   */
  public getColumn(columnIndex: number, result?: Vector3d): Vector3d {
    const index = Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 3],
      this.coffs[index + 6],
      result,
    );
  }
  /**
   * Return a (copy of) a row of the matrix.
   * @param i row index. This is interpreted cyclically (using Geometry.cyclic3dAxis).
   * @param result optional preallocated result.
   */
  public getRow(columnIndex: number, result?: Vector3d): Vector3d {
    const index = 3 * Geometry.cyclic3dAxis(columnIndex);
    return Vector3d.create(
      this.coffs[index],
      this.coffs[index + 1],
      this.coffs[index + 2],
      result,
    );
  }
  /**
   * Create a matrix from row vectors.
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
        vectorW.x, vectorW.y, vectorW.z,
        result,
      );
  }
  /**
   * Create a matrix that scales along a specified `direction`. This means if you multiply the returned matrix
   * by a `vector`, you get `directional scale` of that `vector`. Suppose `plane` is the plane perpendicular
   * to the `direction`. When scale = 0, `directional scale` is projection of the `vector` to the `plane`.
   * When scale = 1, `directional scale` is the `vector` itself. When scale = -1, `directional scale` is
   * mirror of the `vector` across the `plane`. In general, When scale != 0, the result is computed by first
   * projecting the `vector` to the `plane`, then translating that projection along the `direction` (if scale > 0)
   * or in opposite direction (if scale < 0).
   * ```
   * equation
   * \text{The matrix is } I + (s-1) D D^T
   * \\ \text{with }D\text{ being the normalized direction vector and }s\text{ being the scale.}
   * ```
   * * Visualization can be found at itwinjs.org/sandbox/SaeedTorabi/DirectionalScale
   */
  public static createDirectionalScale(direction: Vector3d, scale: number, result?: Matrix3d): Matrix3d {
    const unit = direction.normalize();
    if (unit) {
      const x = unit.x;
      const y = unit.y;
      const z = unit.z;
      const a = scale - 1;
      return Matrix3d.createRowValues(
        1 + a * x * x, a * x * y, a * x * z,
        a * y * x, 1 + a * y * y, a * y * z,
        a * z * x, a * z * y, 1 + a * z * z,
        result,
      );
    }
    return Matrix3d.createUniformScale(scale);
  }
  /**
   * Create a matrix which sweeps a vector along `sweepVector` until it hits the plane through the origin with the given normal.
   * * To sweep an arbitrary vector U0 along direction W to the vector U1 in the plane through the origin with normal N:
   *   *   `U1 = U0 + W * alpha`
   *   *   `U1 DOT N = (U0 + W * alpha) DOT N = 0`
   *   *   `U0 DOT N = - alpha * W DOT N`
   *   *   `alpha = - U0 DOT N / W DOT N`
   * * Insert the alpha definition in U1:
   *   *   `U1 = U0 -  W * N DOT U0 / W DOT N`
   * * Write vector dot expression N DOT U0 as a matrix product (^T indicates transpose):
   *   *   `U1 = U0 -  W * N^T * U0 / W DOT N`
   * * Note W * N^T is an outer product, i.e. a 3x3 matrix. By associativity of matrix multiplication:
   *   *   `U1 = (I - W * N^T / W DOT N) * U0`
   * * and the matrix to do the sweep for any vector in place of U0 is `I - W * N^T / W DOT N`.
   * @param sweepVector sweep direction
   * @param planeNormal normal to the target plane
   */
  public static createFlattenAlongVectorToPlane(sweepVector: Vector3d, planeNormal: Vector3d): Matrix3d | undefined {
    const result = Matrix3d.createIdentity();
    const dot = sweepVector.dotProduct(planeNormal);
    const inverse = Geometry.conditionalDivideCoordinate(1.0, -dot);
    if (inverse !== undefined) {
      result.addScaledOuterProductInPlace(sweepVector, planeNormal, inverse);
      return result;
    }
    return undefined;
  }
  /**
  * Multiply `matrix * point`, treating the point as a column vector on the right.
  * ```
  * equation
  * \matrixXY{A}\columnSubXYZ{U}
  * ```
  * @return the point result
  */
  public multiplyPoint(point: Point3d, result?: Point3d): Point3d {
    const x = point.x;
    const y = point.y;
    const z = point.z;
    return Point3d.create(
      this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z,
      this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z,
      this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z,
      result,
    );
  }
  /**
   * Multiply `matrix * vector`, treating the vector is a column vector on the right.
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
      this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z,
      this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z,
      this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z,
      result,
    );
  }
  /**
   * Multiply `matrix * vector` in place for vector in the array, i.e. treating the vector is a column
   * vector on the right.
   * * Each `vector` is updated to be `matrix * vector`
   */
  public multiplyVectorArrayInPlace(data: XYZ[]): void {
    for (const v of data) v.set(
      this.coffs[0] * v.x + this.coffs[1] * v.y + this.coffs[2] * v.z,
      this.coffs[3] * v.x + this.coffs[4] * v.y + this.coffs[5] * v.z,
      this.coffs[6] * v.x + this.coffs[7] * v.y + this.coffs[8] * v.z,
    );
  }
  /** Compute `origin - matrix * vector` */
  public static xyzMinusMatrixTimesXYZ(origin: XYAndZ, matrix: Matrix3d, vector: XYAndZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x - (matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z),
      origin.y - (matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z),
      origin.z - (matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z),
      result,
    );
  }
  /** Compute `origin + matrix * vector`  using only the xy parts of the inputs. */
  public static xyPlusMatrixTimesXY(origin: XAndY, matrix: Matrix3d, vector: XAndY, result?: Point2d): Point2d {
    const x = vector.x;
    const y = vector.y;
    return Point2d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y,
      result,
    );
  }
  /** Compute `origin + matrix * vector`  using all xyz parts of the inputs. */
  public static xyzPlusMatrixTimesXYZ(origin: XYZ, matrix: Matrix3d, vector: XYAndZ, result?: Point3d): Point3d {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result,
    );
  }
  /** Updates vector to be `origin + matrix * vector` using all xyz parts of the inputs. */
  public static xyzPlusMatrixTimesXYZInPlace(origin: XYZ, matrix: Matrix3d, vector: WritableXYAndZ): void {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    vector.x = origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z;
    vector.y = origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z;
    vector.z = origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z;
  }
  /** Compute `origin + matrix * vector` where the final vector is given as direct x,y,z coordinates */
  public static xyzPlusMatrixTimesCoordinates(
    origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, result?: Point3d,
  ): Point3d {
    return Point3d.create(
      origin.x + matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z,
      origin.y + matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z,
      origin.z + matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z,
      result,
    );
  }
  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply the 4x4 matrix by `[x,y,z,w]`
   * ```
   * equation
   * \begin{bmatrix}M_0 & M_1 & M_2 & Ox \\ M_3 & M_4 & M_5 & Oy \\ M_6 & M_7 & M_8 & Oz \\ 0 & 0 & 0 & 1\end{bmatrix} * \begin{bmatrix}x \\ y \\ z \\ w\end{bmatrix}
   * ```
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional preallocated result.
   */
  public static xyzPlusMatrixTimesWeightedCoordinates(
    origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, w: number, result?: Point4d,
  ): Point4d {
    return Point4d.create(
      matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z + origin.x * w,
      matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z + origin.y * w,
      matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z + origin.z * w,
      w,
      result,
    );
  }
  /**
   * Treat the 3x3 matrix and origin as upper 3x4 part of a 4x4 matrix, with 0001 as the final row.
   * Multiply the 4x4 matrix by `[x,y,z,w]`
   * ```
   * equation
   * \begin{bmatrix}M_0 & M_1 & M_2 & Ox \\ M_3 & M_4 & M_5 & Oy \\ M_6 & M_7 & M_8 & Oz \\ 0 & 0 & 0 & 1\end{bmatrix} * \begin{bmatrix}x \\ y \\ z \\ w\end{bmatrix}
   * ```
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param w w part of multiplied point
   * @param result optional preallocated result.
   */
  public static xyzPlusMatrixTimesWeightedCoordinatesToFloat64Array(
    origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, w: number, result?: Float64Array,
  ): Float64Array {
    if (!result)
      result = new Float64Array(4);
    result[0] = matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z + origin.x * w;
    result[1] = matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z + origin.y * w;
    result[2] = matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z + origin.z * w;
    result[3] = w;
    return result;
  }
  /**
   * Treat the 3x3 matrix and origin as a 3x4 matrix.
   * * Multiply the 3x4 matrix by `[x,y,z,1]`
   * ```
   * equation
   * \begin{bmatrix}M_0 & M_1 & M_2 & Ox \\ M_3 & M_4 & M_5 & Oy \\ M_6 & M_7 & M_8 & Oz\end{bmatrix} * \begin{bmatrix}x \\ y \\ z \\ 1\end{bmatrix}
   * ```
   * @param origin translation part (xyz in column 3)
   * @param matrix matrix part (leading 3x3)
   * @param x x part of multiplied point
   * @param y y part of multiplied point
   * @param z z part of multiplied point
   * @param result optional preallocated result.
   */
  public static xyzPlusMatrixTimesCoordinatesToFloat64Array(
    origin: XYZ, matrix: Matrix3d, x: number, y: number, z: number, result?: Float64Array,
  ): Float64Array {
    if (!result)
      result = new Float64Array(3);
    result[0] = matrix.coffs[0] * x + matrix.coffs[1] * y + matrix.coffs[2] * z + origin.x;
    result[1] = matrix.coffs[3] * x + matrix.coffs[4] * y + matrix.coffs[5] * z + origin.y;
    result[2] = matrix.coffs[6] * x + matrix.coffs[7] * y + matrix.coffs[8] * z + origin.z;
    return result;
  }
  /**
   * Multiply the transpose matrix times a vector.
   * * This produces the same x,y,z as treating the vector as a row on the left of the (un-transposed) matrix.
   * ```
   * equation
   * \begin{matrix}
   * \text{Treating U as a column to the right of transposed matrix\:  return column}&\columnSubXYZ{V}&=&\matrixTransposeSubXY{A}\columnSubXYZ{U} \\
   * \text{Treating U as a row to the left of untransposed matrix\: return row}&\rowSubXYZ{V}&=&\rowSubXYZ{U}\matrixXY{A}
   * \end{matrix}
   * ```
   * @param result the vector result (optional)
   */
  public multiplyTransposeVector(vector: Vector3d, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    result.x = this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z;
    result.y = this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z;
    result.z = this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z;
    return result;
  }
  /**
   * Multiply the matrix * [x,y,z], i.e. the vector [x,y,z] is a column vector on the right.
   * @param result the vector result (optional)
   */
  public multiplyXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z;
    result.y = this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z;
    result.z = this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z;
    return result;
  }
  /**
   * Multiply the matrix * xyz, place result in (required) return value.
   * @param xyz right side
   * @param result the result.
   */
  public multiplyXYZtoXYZ(xyz: XYZ, result: XYZ): XYZ {
    const x = xyz.x;
    const y = xyz.y;
    const z = xyz.z;
    result.x = this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z;
    result.y = this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z;
    result.z = this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z;
    return result;
  }
  /**
   * Multiply the matrix * [x,y,0], i.e. the vector [x,y,0] is a column vector on the right.
   * @param result the vector result (optional)
   */
  public multiplyXY(x: number, y: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.coffs[0] * x + this.coffs[1] * y;
    result.y = this.coffs[3] * x + this.coffs[4] * y;
    result.z = this.coffs[6] * x + this.coffs[7] * y;
    return result;
  }
  /**
   * Compute origin + the matrix * [x,y,0].
   * @param result the Point3d result (optional)
   */
  public originPlusMatrixTimesXY(origin: XYZ, x: number, y: number, result?: Point3d): Point3d {
    return Point3d.create(
      origin.x + this.coffs[0] * x + this.coffs[1] * y,
      origin.y + this.coffs[3] * x + this.coffs[4] * y,
      origin.z + this.coffs[6] * x + this.coffs[7] * y,
      result,
    );
  }
  /**
   * Multiply the matrix * (x,y,z) in place, i.e. the vector (x,y,z) is a column vector on the right and
   * the multiplication updates the vector values.
   * @param xyzData the vector data.
   */
  public multiplyVectorInPlace(xyzData: XYZ): void {
    const x = xyzData.x;
    const y = xyzData.y;
    const z = xyzData.z;
    xyzData.x = this.coffs[0] * x + this.coffs[1] * y + this.coffs[2] * z;
    xyzData.y = this.coffs[3] * x + this.coffs[4] * y + this.coffs[5] * z;
    xyzData.z = this.coffs[6] * x + this.coffs[7] * y + this.coffs[8] * z;
  }
  /**
   * Multiply the transpose matrix times [x,y,z] in place, i.e. the vector [x,y,z] is a column vector on
   * the right and the multiplication updates the vector values.
   * * This is equivalent to `multiplyTransposeVector` but always returns the result directly in the input.
   * @param vectorU the vector data
   */
  public multiplyTransposeVectorInPlace(vectorU: XYZ): void {
    const x = vectorU.x;
    const y = vectorU.y;
    const z = vectorU.z;
    vectorU.x = this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z;
    vectorU.y = this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z;
    vectorU.z = this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z;
  }
  /**
   * Multiply the transpose matrix times column using individual numeric inputs.
   * * This produces the same x,y,z as treating the vector as a row on the left of the (un-transposed) matrix.
   * ```
   * equation
   * \begin{matrix}
   * \text{treating the input as a column vector } \columnXYZ{x}{y}{z}\text{ compute  }&\columnSubXYZ{V} &= &A^T \columnXYZ{x}{y}{z} \\
   * \text{or as a row vector } \rowXYZ{x}{y}{z} \text{ compute }&\rowSubXYZ{V} &= &\rowXYZ{x}{y}{z} A \\
   * \phantom{8888}\text{and return V as a Vector3d} & & &
   * \end{matrix}
   * ````
   * @param result the vector result (optional)
   */
  public multiplyTransposeXYZ(x: number, y: number, z: number, result?: Vector3d): Vector3d {
    result = result ? result : new Vector3d();
    result.x = this.coffs[0] * x + this.coffs[3] * y + this.coffs[6] * z;
    result.y = this.coffs[1] * x + this.coffs[4] * y + this.coffs[7] * z;
    result.z = this.coffs[2] * x + this.coffs[5] * y + this.coffs[8] * z;
    return result;
  }
  /**
   * Solve `matrix * result = vector` for an unknown `result`.
   * * This is equivalent to multiplication `result = matrixInverse * vector`.
   * * Result is `undefined` if the matrix is singular (e.g. has parallel columns or a zero magnitude column)
   */
  public multiplyInverse(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z,
        this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z,
        this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z,
        result,
      );
    }
    return undefined;
  }
  /**
   * Solve `matrixTranspose * result = vector` for an unknown `result`.
   * * This is equivalent to multiplication `result = matrixInverseTranspose * vector`.
   * * Result is `undefined` if the matrix is singular (e.g. has parallel columns or a zero magnitude column)
   */
  public multiplyInverseTranspose(vector: Vector3d, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      const x = vector.x;
      const y = vector.y;
      const z = vector.z;
      return Vector3d.create(
        this.inverseCoffs[0] * x + this.inverseCoffs[3] * y + this.inverseCoffs[6] * z,
        this.inverseCoffs[1] * x + this.inverseCoffs[4] * y + this.inverseCoffs[7] * z,
        this.inverseCoffs[2] * x + this.inverseCoffs[5] * y + this.inverseCoffs[8] * z,
        result,
      );
    }
    return undefined;
  }
  /**
   * Multiply `matrixInverse * [x,y,z]`.
   * * This is equivalent to solving `matrix * result = [x,y,z]` for an unknown `result`.
   * * Result is `undefined` if the matrix is singular (e.g. has parallel columns or a zero magnitude column)
   * @return result as a Vector3d or undefined (if the matrix is singular).
   */
  public multiplyInverseXYZAsVector3d(x: number, y: number, z: number, result?: Vector3d): Vector3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Vector3d.create(
        this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z,
        this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z,
        this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z,
        result,
      );
    }
    return undefined;
  }
  /**
   * Multiply `matrixInverse * [x,y,z]` and return result as a `Point4d` with the given weight as the last coordinate.
   * * Equivalent to solving `matrix * result = [x,y,z]` for an unknown `result`.
   * * Result is `undefined` if the matrix is singular (e.g. has parallel columns or a zero magnitude column)
   * @return result as a Point4d with the same weight.
   */
  public multiplyInverseXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Point4d.create(
        this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z,
        this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z,
        this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z,
        w,
        result,
      );
    }
    return undefined;
  }
  /**
   * Multiply `matrixInverse * [x,y,z]` and return result as `Point3d`.
   * * Equivalent to solving `matrix * result = [x,y,z]` for an unknown `result`.
   * @return result as a Point3d or `undefined` (if the matrix is singular).
   */
  public multiplyInverseXYZAsPoint3d(x: number, y: number, z: number, result?: Point3d): Point3d | undefined {
    this.computeCachedInverse(true);
    if (this.inverseCoffs) {
      return Point3d.create(
        this.inverseCoffs[0] * x + this.inverseCoffs[1] * y + this.inverseCoffs[2] * z,
        this.inverseCoffs[3] * x + this.inverseCoffs[4] * y + this.inverseCoffs[5] * z,
        this.inverseCoffs[6] * x + this.inverseCoffs[7] * y + this.inverseCoffs[8] * z,
        result,
      );
    }
    return undefined;
  }
  /**
   * Invoke a given matrix*matrix operation to compute the inverse matrix and set this.inverseCoffs
   * * If either input coffA or coffB is `undefined`, set state to `InverseMatrixState.unknown` but
   * leave the inverseCoffs untouched.
   * @param f the given matrix*matrix operation that is called by this function to compute the inverse.
   * `f` must be a matrix*matrix operation. Otherwise, the function does not generate the inverse properly.
   */
  private finishInverseCoffs(
    f: (factorA: Float64Array, factorB: Float64Array, result: Float64Array) => void, coffA?: Float64Array,
    coffB?: Float64Array,
  ): void {
    if (coffA && coffB) {
      this.createInverseCoffsWithZeros();
      this.inverseState = InverseMatrixState.inverseStored;
      f(coffA, coffB, this.inverseCoffs!); // call function f (which is provided by user) to compute the inverse.
    } else {
      this.inverseState = InverseMatrixState.unknown;
    }
  }
  // Notes on inverse of matrix products:
  //      1) M = A * B           ===>  MInverse = BInverse * AInverse
  //      2) M = A * BInverse    ===>  MInverse = B * AInverse
  //      3) M = AInverse * B    ===>  MInverse = BInverse * A
  //      4) M = A * BTranspose  ===>  MInverse = BInverseTranspose * AInverse
  //      5) M = ATranspose * B  ===>  MInverse = BInverse * AInverseTranspose
  /**
   * Multiply `this` matrix times `other` matrix
   * @return the matrix result: this*other
   */
  public multiplyMatrixMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.coffs, other.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored
      && other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs((a, b, _result) => PackedMatrix3dOps.multiplyMatrixMatrix(a, b, _result), other.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular
      || other.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }
  /**
   * Multiply `this` matrix times `inverse of other` matrix
   * @return the matrix result: this*otherInverse
   */
  public multiplyMatrixMatrixInverse(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined {
    if (!other.computeCachedInverse(true))
      return undefined;
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.coffs, other.inverseCoffs!, Matrix3d._productBuffer);
    if (this.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs((a, b, _result) => PackedMatrix3dOps.multiplyMatrixMatrix(a, b, _result), other.coffs, this.inverseCoffs);
    else
      result.inverseState = InverseMatrixState.unknown;
    PackedMatrix3dOps.copy(Matrix3d._productBuffer, result.coffs);
    return result;
  }
  /**
   * Multiply `inverse of this` matrix times `other` matrix
   * @return the matrix result: thisInverse*other
   */
  public multiplyMatrixInverseMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d | undefined {
    if (!this.computeCachedInverse(true))
      return undefined;
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrix(this.inverseCoffs!, other.coffs, Matrix3d._productBuffer);
    if (other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs((a, b, _result) => PackedMatrix3dOps.multiplyMatrixMatrix(a, b, _result), other.inverseCoffs, this.coffs);
    else
      result.inverseState = InverseMatrixState.unknown;
    PackedMatrix3dOps.copy(Matrix3d._productBuffer, result.coffs);
    return result;
  }
  /**
   * Multiply `this` matrix times the transpose of `other` matrix
   * ```
   * equation
   * \text{for instance matrix }A\text{ and matrix }B\text{ return matrix }C{\text where }\\\matrixXY{C}=\matrixXY{A}\matrixTransposeSubXY{B}
   * ```
   * @return the matrix result: this*otherTranspose
   */
  public multiplyMatrixMatrixTranspose(other: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixMatrixTranspose(this.coffs, other.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored && other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs((a, b, _result) => PackedMatrix3dOps.multiplyMatrixTransposeMatrix(a, b, _result), other.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular || other.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }
  /**
   * Multiply the transpose of `this` matrix times `other` matrix
   * ```
   * equation
   * \matrixXY{result}=\matrixXY{\text{this}}\matrixTransposeSubXY{\text{other}}
   * ```
   * @return the matrix result: thisTranspose*other
   */
  public multiplyMatrixTransposeMatrix(other: Matrix3d, result?: Matrix3d): Matrix3d {
    result = result ? result : new Matrix3d();
    PackedMatrix3dOps.multiplyMatrixTransposeMatrix(this.coffs, other.coffs, result.coffs);
    if (this.inverseState === InverseMatrixState.inverseStored && other.inverseState === InverseMatrixState.inverseStored)
      result.finishInverseCoffs((a, b, _result) => PackedMatrix3dOps.multiplyMatrixMatrixTranspose(a, b, _result), other.inverseCoffs, this.inverseCoffs);
    else if (this.inverseState === InverseMatrixState.singular || other.inverseState === InverseMatrixState.singular)
      result.inverseState = InverseMatrixState.singular;
    else
      result.inverseState = InverseMatrixState.unknown;
    return result;
  }
  /**
   * Multiply `this` Matrix3d (considered to be a Transform with 0 `origin`) times `other` Transform.
   * * **Note:** If `this = [A   0]` and `other = [B   b]`, then `this * other` is defined as [A*B   Ab] because:
   * ```
   * equation
   * \begin{matrix}
   * \text{this matrix }\bold{A}\text{ promoted to block Transform} & \blockTransform{A}{0} \\
   * \text{other Transform with `matrix` part }\bold{B}\text{ and origin part }\bold{b} & \blockTransform{B}{b}\\
   * \text{product}& \blockTransform{A}{0}\blockTransform{B}{b}=\blockTransform{AB}{Ab}
   * \end{matrix}
   * ```
   * @param other the `other` Transform to be multiplied to `this` matrix.
   * @param result optional preallocated `result` to reuse.
   */
  public multiplyMatrixTransform(other: Transform, result?: Transform): Transform {
    if (!result)
      return Transform.createRefs(
        this.multiplyXYZ(other.origin.x, other.origin.y, other.origin.z),
        this.multiplyMatrixMatrix(other.matrix),
      );
    this.multiplyXYZtoXYZ(other.origin, result.origin);
    this.multiplyMatrixMatrix(other.matrix, result.matrix);
    return result;
  }
  /**
   * Return the transpose of `this` matrix.
   * * If `result` is passed as argument, then the function copies the transpose of `this` into `result`.
   * * `this` is not changed unless also passed as the result, i.e., `this.transpose(this)` transposes `this` in place.
   */
  public transpose(result?: Matrix3d): Matrix3d {
    if (!result)
      result = new Matrix3d();
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
  /**
   * Transpose this matrix in place.
   */
  public transposeInPlace() {
    PackedMatrix3dOps.transposeInPlace(this.coffs);
    if (this.inverseCoffs)
      PackedMatrix3dOps.transposeInPlace(this.inverseCoffs); // inverse of transpose is equal to transpose of inverse
  }
  /**
   * Return the inverse matrix.
   * The return is undefined if the matrix is singular (e.g. has parallel columns or a zero magnitude column)
   * * If `result == this`, then content of inverse of `this` matrix is copied into `this`. Otherwise, inverse
   * of `this` is stored in `result`.
   * * **Note:** Each Matrix3d object caches its own inverse (`this.inverseCoffs`) and has methods to multiply
   * the inverse times matrices and vectors (e.g., `multiplyMatrixInverseMatrix`, `multiplyMatrixMatrixInverse`,
   * `multiplyInverse`). Hence explicitly constructing this new inverse object is rarely necessary.
   */
  public inverse(result?: Matrix3d): Matrix3d | undefined {
    if (!this.computeCachedInverse(true))
      return undefined;
    if (result === this) {
      // swap the contents of this.coffs and this.inverseCoffs
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
  /**
   * Take the dot product of a row (specified by `rowStartA`) of `coffA` and `columnStartB` of `coffB`.
   * * **Note:** We don't validate row/column numbers. Pass 0/3/6 for row 0/1/2 and pass 0/1/2 for column 0/1/2.
   */
  private static rowColumnDot(
    coffA: Float64Array, rowStartA: number, coffB: Float64Array, columnStartB: number,
  ): number {
    return coffA[rowStartA] * coffB[columnStartB] +
      coffA[rowStartA + 1] * coffB[columnStartB + 3] +
      coffA[rowStartA + 2] * coffB[columnStartB + 6];
  }
  /**
   * Take the cross product of 2 rows (specified by `rowStart0` and `rowStart1`) of `source` and store the result
   * in `columnStart` of `dest`.
   * * **Note:** We don't validate row/column numbers. Pass 0/3/6 for row 0/1/2 and pass 0/1/2 for column 0/1/2.
   */
  private static indexedRowCrossProduct(
    source: Float64Array, rowStart0: number, rowStart1: number, dest: Float64Array, columnStart: number,
  ): void {
    dest[columnStart] = source[rowStart0 + 1] * source[rowStart1 + 2] - source[rowStart0 + 2] * source[rowStart1 + 1];
    dest[columnStart + 3] = source[rowStart0 + 2] * source[rowStart1] - source[rowStart0] * source[rowStart1 + 2];
    dest[columnStart + 6] = source[rowStart0] * source[rowStart1 + 1] - source[rowStart0 + 1] * source[rowStart1];
  }
  /**
   * Take the cross product of 2 columns (i.e., `colStart0` and `colStart1`) of `this` matrix and store the
   * result in `colStart2` of the same matrix.
   * * **Note:** We don't validate column numbers. Pass 0/1/2 for column 0/1/2.
   */
  private indexedColumnCrossProductInPlace(colStart0: number, colStart1: number, colStart2: number): void {
    const coffs = this.coffs;
    coffs[colStart2] = coffs[colStart0 + 3] * coffs[colStart1 + 6] - coffs[colStart0 + 6] * coffs[colStart1 + 3];
    coffs[colStart2 + 3] = coffs[colStart0 + 6] * coffs[colStart1] - coffs[colStart0] * coffs[colStart1 + 6];
    coffs[colStart2 + 6] = coffs[colStart0] * coffs[colStart1 + 3] - coffs[colStart0 + 3] * coffs[colStart1];
  }
  /**
   * Form cross products among columns in axisOrder.
   * For axis order ABC:
   * * form cross product of column A and B, store in C.
   * * form cross product of column C and A, store in B.
   * * [A   B   C] ===> [A   B   AxB] ===> [A   (AxB)xA   AxB]
   *
   * This means that in the final matrix:
   * * first column is same as original column A.
   * * second column is linear combination of original A and B (i.e., is in the plane of original A and B).
   * * third column is perpendicular to first and second columns of both the original and final.
   * * original column C is overwritten and does not participate in the result.
   *
   * The final matrix will have 3 orthogonal columns.
   */
  public axisOrderCrossProductsInPlace(axisOrder: AxisOrder): void {
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
  /**
   * Normalize each column in place.
   * @param originalColumnMagnitudes optional vector to store original column magnitudes.
   * @returns return true if all columns have non-zero lengths. Otherwise, return false.
   * * If false is returned, the magnitudes are stored in the `originalColumnMagnitudes` vector but no columns
   * are altered.
   */
  public normalizeColumnsInPlace(originalColumnMagnitudes?: Vector3d): boolean {
    const ax = this.columnXMagnitude();
    const ay = this.columnYMagnitude();
    const az = this.columnZMagnitude();
    if (originalColumnMagnitudes)
      originalColumnMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleColumns(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  /**
   * Normalize each row in place.
   * @param originalRowMagnitudes optional vector to store original row magnitudes.
   * @returns return true if all rows have non-zero lengths. Otherwise, return false.
   * * If false is returned, the magnitudes are stored in the `originalRowMagnitudes` vector but no rows
   * are altered.
   */
  public normalizeRowsInPlace(originalRowMagnitudes?: Vector3d): boolean {
    const ax = this.rowXMagnitude();
    const ay = this.rowYMagnitude();
    const az = this.rowZMagnitude();
    if (originalRowMagnitudes)
      originalRowMagnitudes.set(ax, ay, az);
    if (Geometry.isSmallMetricDistance(ax) || Geometry.isSmallMetricDistance(ay) || Geometry.isSmallMetricDistance(az))
      return false;
    this.scaleRows(1.0 / ax, 1.0 / ay, 1.0 / az, this);
    return true;
  }
  /**
   * Returns true if the matrix is singular.
   */
  public isSingular(): boolean {
    return !this.computeCachedInverse(true);
  }
  /**
   * Mark this matrix as singular.
   */
  public markSingular(): void {
    this.inverseState = InverseMatrixState.singular;
  }
  /**
   * Compute the inverse of `this` Matrix3d. The inverse is stored in `this.inverseCoffs` for later use.
   * @param useCacheIfAvailable if `true`, use the previously computed inverse if available. If `false`,
   * recompute the inverse.
   * @returns return `true` if the inverse is computed. Return `false` if matrix is singular.
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
    /**
     * We calculate the inverse using cross products.
     * Math details can be found at docs/learning/matrix/Matrix.md
     *                    [   A   ]
     * In summary, if M = [   B   ] then inverse of M = (1/det)[BxC   CxA   AxB] where
     *                    [   C   ]
     * det is the determinant of matrix M (which is equal to "A dot BxC").
     */
    Matrix3d.indexedRowCrossProduct(coffs, 3, 6, inverseCoffs, 0); // BxC
    Matrix3d.indexedRowCrossProduct(coffs, 6, 0, inverseCoffs, 1); // CxA
    Matrix3d.indexedRowCrossProduct(coffs, 0, 3, inverseCoffs, 2); // AxB
    Matrix3d.numComputeCache++;
    const det = Matrix3d.rowColumnDot(coffs, 0, inverseCoffs, 0); // A dot BxC
    if (det === 0.0) {
      this.inverseState = InverseMatrixState.singular;
      this.inverseCoffs = undefined;
      return false;
    }
    const f = 1.0 / det;
    for (let i = 0; i < 9; i++)
      inverseCoffs[i] *= f;
    this.inverseState = InverseMatrixState.inverseStored;
    return true;
  }
  /**
   * Convert a (row,column) index pair to the single index within flattened array of 9 numbers in row-major-order
   * * **Note:** Out of range row/column is interpreted cyclically.
   */
  public static flatIndexOf(row: number, column: number): number {
    return 3 * Geometry.cyclic3dAxis(row) + Geometry.cyclic3dAxis(column);
  }
  /**
   * Get elements of column `index` packaged as a Point4d with given `weight`.
   * * **Note:** Out of range index is interpreted cyclically.
   */
  public indexedColumnWithWeight(index: number, weight: number, result?: Point4d): Point4d {
    index = Geometry.cyclic3dAxis(index);
    return Point4d.create(this.coffs[index], this.coffs[index + 3], this.coffs[index + 6], weight, result);
  }
  /** Return the entry at specific row and column */
  public at(row: number, column: number): number {
    return this.coffs[Matrix3d.flatIndexOf(row, column)];
  }
  /** Set the entry at specific row and column */
  public setAt(row: number, column: number, value: number): void {
    this.coffs[Matrix3d.flatIndexOf(row, column)] = value;
    this.inverseState = InverseMatrixState.unknown;
  }
  /**
   * Create a Matrix3d whose values are uniformly scaled from `this` Matrix3d.
   * @param scale scale factor to apply.
   * @param result optional result.
   * @returns return the scaled matrix.
   */
  public scale(scale: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues(
      this.coffs[0] * scale, this.coffs[1] * scale, this.coffs[2] * scale,
      this.coffs[3] * scale, this.coffs[4] * scale, this.coffs[5] * scale,
      this.coffs[6] * scale, this.coffs[7] * scale, this.coffs[8] * scale,
      result,
    );
  }
  /**
   * Create a Matrix3d whose columns are scaled copies of `this` Matrix3d.
   * @param scaleX scale factor for column 0
   * @param scaleY scale factor for column 1
   * @param scaleZ scale factor for column 2
   * @param result optional result
   */
  public scaleColumns(scaleX: number, scaleY: number, scaleZ: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues(
      this.coffs[0] * scaleX, this.coffs[1] * scaleY, this.coffs[2] * scaleZ,
      this.coffs[3] * scaleX, this.coffs[4] * scaleY, this.coffs[5] * scaleZ,
      this.coffs[6] * scaleX, this.coffs[7] * scaleY, this.coffs[8] * scaleZ,
      result,
    );
  }
  /**
   * Scale the columns of `this` Matrix3d in place.
   * @param scaleX scale factor for column 0
   * @param scaleY scale factor for column 1
   * @param scaleZ scale factor for column 2
   */
  public scaleColumnsInPlace(scaleX: number, scaleY: number, scaleZ: number) {
    this.coffs[0] *= scaleX; this.coffs[1] *= scaleY; this.coffs[2] *= scaleZ;
    this.coffs[3] *= scaleX; this.coffs[4] *= scaleY; this.coffs[5] *= scaleZ;
    this.coffs[6] *= scaleX; this.coffs[7] *= scaleY; this.coffs[8] *= scaleZ;
    if (this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined) {
      // apply reciprocal scales to the ROWS of the inverse
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
  /**
   * Create a Matrix3d whose rows are scaled copies of `this` Matrix3d.
   * @param scaleX scale factor for row 0
   * @param scaleY scale factor for row 1
   * @param scaleZ scale factor for row 2
   * @param result optional result
   */
  public scaleRows(scaleX: number, scaleY: number, scaleZ: number, result?: Matrix3d): Matrix3d {
    return Matrix3d.createRowValues(
      this.coffs[0] * scaleX, this.coffs[1] * scaleX, this.coffs[2] * scaleX,
      this.coffs[3] * scaleY, this.coffs[4] * scaleY, this.coffs[5] * scaleY,
      this.coffs[6] * scaleZ, this.coffs[7] * scaleZ, this.coffs[8] * scaleZ,
      result,
    );
  }
  /**
   * Scale the rows of `this` Matrix3d in place.
   * @param scaleX scale factor for row 0
   * @param scaleY scale factor for row 1
   * @param scaleZ scale factor for row 2
   */
  public scaleRowsInPlace(scaleX: number, scaleY: number, scaleZ: number) {
    this.coffs[0] *= scaleX; this.coffs[1] *= scaleX; this.coffs[2] *= scaleX;
    this.coffs[3] *= scaleY; this.coffs[4] *= scaleY; this.coffs[5] *= scaleY;
    this.coffs[6] *= scaleZ; this.coffs[7] *= scaleZ; this.coffs[8] *= scaleZ;
    if (this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined) {
      // apply reciprocal scales to the COLUMNs of the inverse
      const divX = Geometry.conditionalDivideFraction(1.0, scaleX);
      const divY = Geometry.conditionalDivideFraction(1.0, scaleY);
      const divZ = Geometry.conditionalDivideFraction(1.0, scaleZ);
      if (divX !== undefined && divY !== undefined && divZ !== undefined) {
        this.inverseCoffs[0] *= divX; this.inverseCoffs[1] *= divY; this.inverseCoffs[2] *= divZ;
        this.inverseCoffs[3] *= divX; this.inverseCoffs[4] *= divY; this.inverseCoffs[5] *= divZ;
        this.inverseCoffs[6] *= divX; this.inverseCoffs[7] *= divY; this.inverseCoffs[8] *= divZ;
      } else
        this.inverseState = InverseMatrixState.singular;
    }
  }
  /**
   * Add scaled values from `other` Matrix3d to `this` Matrix3d.
   * @param other Matrix3d with values to be added.
   * @param scale scale factor to apply to the added values.
   */
  public addScaledInPlace(other: Matrix3d, scale: number): void {
    for (let i = 0; i < 9; i++)
      this.coffs[i] += scale * other.coffs[i];
    this.inverseState = InverseMatrixState.unknown;
  }
  /**
   * Add scaled values from an outer product of vectors U and V.
   * * The scaled outer product is a matrix with `rank 1` (all columns/rows are linearly dependent).
   * * This is useful in constructing mirrors and directional scales.
   * ```
   * equation
   * A += s \columnSubXYZ{U}\rowSubXYZ{V}
   * \\ \matrixXY{A} += s \begin{bmatrix}
   * U_x * V_x & U_x * V_y & U_x * V_z \\
   * U_y * V_x & U_y * V_y & U_y * V_z \\
   * U_z * V_x & U_z * V_y & U_z * V_z \end{bmatrix}
   * ```
   * @param vectorU first vector in the outer product.
   * @param vectorV second vector in the outer product.
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
  /**
   * Create a rigid matrix (columns and rows are unit length and pairwise perpendicular) for the given eye coordinate.
   * * column 2 is parallel to (x,y,z).
   * * column 0 is perpendicular to column 2 and is in the xy plane.
   * * column 1 is perpendicular to both. It is the "up" vector on the view plane.
   * * Multiplying the returned matrix times a local (view) vector gives the world vector.
   * * Multiplying transpose of the returned matrix times a world vector gives the local (view) vector.
   * * If you want to rotate a given plane (which contains (0,0,0)) to the xy-plane, pass coordinates of the normal
   * vector of your plane into createRigidViewAxesZTowardsEye. The transpose of the returned Matrix3d can be used
   * to rotate your plane to the xy-plane. If plane does not contain (0,0,0) then the plane is rotated to a plane
   * parallel to the xy-plane.
   * @param x eye x coordinate
   * @param y eye y coordinate
   * @param z eye z coordinate
   * @param result optional preallocated result
   */
  public static createRigidViewAxesZTowardsEye(x: number, y: number, z: number, result?: Matrix3d): Matrix3d {
    result = Matrix3d.createIdentity(result);
    const rxy = Geometry.hypotenuseXY(x, y);
    // if coordinate is (0,0,z), i.e., Top or Bottom view
    if (Geometry.isSmallMetricDistance(rxy)) {
      if (z < 0.0)
        result.scaleColumnsInPlace(1.0, -1.0, -1.0);
    } else {
      /**
       * The matrix that the "else" statement creates is
       *        [-s   -s1*c    c1*c]
       *        [c    -s1*s    c1*s]
       *        [0      c1      s1 ]
       * where
       *        c = x / sqrt(x*x + y*y)
       *        s = y / sqrt(x*x + y*y)
       *        c1 = sqrt(x*x + y*y) / sqrt(x*x + y*y + z*z)
       *        s1 = z / sqrt(x*x + y*y + z*z)
       *
       * This is an orthogonal matrix meaning it rotates the standard XYZ axis to ABC axis system
       * (if matrix is [A B C]). The matrix rotates (0,0,1), i.e., the default Top view or Z axis,
       * to the eye point (x/r,y/r,z/r) where r = sqrt(x*x + y*y + z*z). The matrix also rotates
       * (1,0,0) to a point on XY plane.
       */
      const c = x / rxy;
      const s = y / rxy;
      // if coordinate is (x,y,0), e.g., Front or Back or Left or Right view (for those 4 views x or y is 0 not both)
      result.setRowValues(
        -s, 0, c,
        c, 0, s,
        0, 1, 0);
      // if coordinate is (x,y,z) and z is not 0, i.e., other views such as Iso or RightIso
      if (z !== 0.0) {
        const r = Geometry.hypotenuseXYZ(x, y, z);
        const s1 = z / r;
        const c1 = rxy / r;
        result.applyGivensColumnOp(1, 2, c1, -s1);
      }
    }
    return result;
  }
  /** Return the determinant of `this` matrix. */
  public determinant(): number {
    return this.coffs[0] * this.coffs[4] * this.coffs[8]
      - this.coffs[0] * this.coffs[5] * this.coffs[7]
      - this.coffs[1] * this.coffs[3] * this.coffs[8]
      + this.coffs[1] * this.coffs[5] * this.coffs[6]
      + this.coffs[2] * this.coffs[3] * this.coffs[7]
      - this.coffs[2] * this.coffs[4] * this.coffs[6];
  }
  /**
   * Return an estimate of how independent the columns of `this` matrix are. Near zero is bad (i.e.,
   * columns are almost dependent and matrix is nearly singular). Near 1 is good (i.e., columns are
   * almost independent and matrix is invertible).
   */
  public conditionNumber(): number {
    const determinant = Math.abs(this.determinant());
    const columnMagnitudeSum =
      Geometry.hypotenuseXYZ(this.coffs[0], this.coffs[3], this.coffs[6])
      + Geometry.hypotenuseXYZ(this.coffs[1], this.coffs[4], this.coffs[7])
      + Geometry.hypotenuseXYZ(this.coffs[2], this.coffs[5], this.coffs[8]);
    return Geometry.safeDivideFraction(determinant, columnMagnitudeSum, 0.0);
  }
  /** Return the sum of squares of all entries */
  public sumSquares(): number {
    let sum = 0;
    for (let i = 0; i < 9; i++)
      sum += this.coffs[i] * this.coffs[i];
    return sum;
  }
  /** Return the sum of squares of diagonal entries */
  public sumDiagonalSquares(): number {
    let sum = 0;
    for (let i = 0; i < 9; i += 4)
      sum += this.coffs[i] * this.coffs[i];
    return sum;
  }
  /** Return the matrix `trace` (sum of diagonal entries) */
  public sumDiagonal(): number {
    return this.coffs[0] + this.coffs[4] + this.coffs[8];
  }
  /** Return the Maximum absolute value of any single entry */
  public maxAbs(): number {
    let max = 0;
    for (let i = 0; i < 9; i++)
      max = Math.max(max, Math.abs(this.coffs[i]));
    return max;
  }
  /** Return the maximum absolute difference between corresponding entries of `this` and `other` */
  public maxDiff(other: Matrix3d): number {
    let max = 0;
    for (let i = 0; i < 9; i++)
      max = Math.max(max, Math.abs(this.coffs[i] - other.coffs[i]));
    return max;
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
  /** Sum of squared differences between symmetric pairs (symmetric pairs have indices (1,3), (2,6), and (5,7).) */
  public sumSkewSquares(): number {
    return Geometry.hypotenuseSquaredXYZ(
      this.coffs[1] - this.coffs[3],
      this.coffs[2] - this.coffs[6],
      this.coffs[5] - this.coffs[7],
    );
  }
  /** Test if the matrix is (very near to) symmetric */
  public isSymmetric(): boolean {
    const offDiagonal: number = this.sumSkewSquares();
    return Math.sqrt(offDiagonal) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(this.sumSquares()));
  }
  /** Test if the stored inverse is present and marked valid */
  public get hasCachedInverse(): boolean {
    return this.inverseState === InverseMatrixState.inverseStored && this.inverseCoffs !== undefined;
  }
  /** Test if the below diagonal entries (3,6,7) are all nearly zero */
  public get isUpperTriangular(): boolean {
    const sumAll = this.sumSquares();
    const sumLow = Geometry.hypotenuseSquaredXYZ(this.coffs[3], this.coffs[6], this.coffs[7]);
    return Math.sqrt(sumLow) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }
  /** Test if the above diagonal entries (1,2,5) are all nearly zero */
  public get isLowerTriangular(): boolean {
    const sumAll = this.sumSquares();
    const sumLow = Geometry.hypotenuseSquaredXYZ(this.coffs[1], this.coffs[2], this.coffs[5]);
    return Math.sqrt(sumLow) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll));
  }
  /**
   * If the matrix is diagonal and all diagonals are almost equal, return the first diagonal (entry 0
   * which is same as entry 4 and 8). Otherwise return `undefined`.
   */
  public sameDiagonalScale(): number | undefined {
    const sumAll = this.sumSquares();
    const sumDiagonal = this.sumDiagonalSquares();
    const sumOff = Math.abs(sumAll - sumDiagonal);
    if (Math.sqrt(sumOff) <= Geometry.smallAngleRadians * (1.0 + Math.sqrt(sumAll))
      && Geometry.isSameCoordinate(this.coffs[0], this.coffs[4])
      && Geometry.isSameCoordinate(this.coffs[0], this.coffs[8])
    )
      return this.coffs[0];
    return undefined;
  }
  /**
   * Test if all rows and columns are unit length and are perpendicular to each other, i.e., the matrix is either
   * a `pure rotation` (determinant is +1) or is a `mirror` (determinant is -1).
   * * **Note:** such a matrix is called `orthogonal` and its inverse is its transpose.
   */
  public testPerpendicularUnitRowsAndColumns(): boolean {
    const product = this.multiplyMatrixMatrixTranspose(this);
    return product.isIdentity;
  }
  /**
   * Test if the matrix is a `rigid` matrix (or `pure rotation`, i.e., columns and rows are unit length and
   * pairwise perpendicular and determinant is +1).
   * @param allowMirror whether to widen the test to return true if the matrix is a `mirror` (determinant is -1).
  */
  public isRigid(allowMirror: boolean = false): boolean {
    return this.testPerpendicularUnitRowsAndColumns() && (allowMirror || this.determinant() > 0);
  }
  /**
   * Test if all rows and columns are perpendicular to each other and have equal length.
   * If so, the length (or its negative) is the `scale` factor from a set of `orthonormal axes` to
   * the set of axes created by columns of `this` matrix. Otherwise, returns `undefined`.
   * @param result optional pre-allocated object to populate and return
   * @returns returns `{ rigidAxes, scale }` where `rigidAxes` is a Matrix3d with its columns as the rigid axes
   * (with the scale factor removed) and `scale` is the scale factor.
   * * Note that determinant of a rigid matrix is +1.
   * * The context for this method is to determine if the matrix is the product a `rotation` matrix and a uniform
   * `scale` matrix (diagonal matrix with all diagonal entries the same nonzero number).
   */
  public factorRigidWithSignedScale(result?: Matrix3d): { rigidAxes: Matrix3d, scale: number } | undefined {
    const product = this.multiplyMatrixMatrixTranspose(this);
    const scaleSquare = product.sameDiagonalScale();
    if (scaleSquare === undefined || scaleSquare <= 0.0)
      return undefined;
    const scale = this.determinant() > 0 ? Math.sqrt(scaleSquare) : -Math.sqrt(scaleSquare);
    const scaleInverse = 1.0 / scale;
    return { rigidAxes: this.scaleColumns(scaleInverse, scaleInverse, scaleInverse, result), scale };
  }
  /** Test if `this` matrix reorders and/or negates the columns of the `identity` matrix. */
  public get isSignedPermutation(): boolean {
    let count = 0;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const q = this.at(row, col);
        if (q === 0) {
          // do nothing
        } else if (q === 1 || q === -1) {
          count++;
          // if the rest of this row and column should be 0 ("at" will apply cyclic indexing)
          if ((this.at(row + 1, col) !== 0) || (this.at(row + 2, col) !== 0) ||
            (this.at(row, col + 1) !== 0) || (this.at(row, col + 2) !== 0))
            return false;
        } else { // entry is not 0, 1, or -1
          return false;
        }
      }
    return count === 3;
  }
  /**
   * Adjust the matrix in place to make is a `rigid` matrix so that:
   * * columns are perpendicular and have unit length.
   * * transpose equals inverse.
   * * mirroring is removed.
   * * This function internally uses `axisOrderCrossProductsInPlace` to make the matrix rigid.
   * @param axisOrder how to reorder the matrix columns
   * @return whether the adjusted matrix is `rigid` on return
   */
  public makeRigid(axisOrder: AxisOrder = AxisOrder.XYZ): boolean {
    const maxAbs = this.maxAbs();
    if (Geometry.isSmallMetricDistance(maxAbs))
      return false;
    const scale = 1.0 / maxAbs;
    this.scaleColumnsInPlace(scale, scale, scale);
    this.axisOrderCrossProductsInPlace(axisOrder);
    return this.normalizeColumnsInPlace();
  }
  /**
   * Create a new orthogonal matrix (perpendicular columns, unit length, transpose is inverse).
   * * Columns are taken from the source Matrix3d in order indicated by the axis order.
   * * Mirroring in the matrix is removed.
   * * This function internally uses `axisOrderCrossProductsInPlace` to make the matrix rigid.
   */
  public static createRigidFromMatrix3d(
    source: Matrix3d, axisOrder: AxisOrder = AxisOrder.XYZ, result?: Matrix3d,
  ): Matrix3d | undefined {
    result = source.clone(result);
    if (result.makeRigid(axisOrder))
      return result;
    return undefined;
  }
  /**
   * Create a matrix from a quaternion.
   * **WARNING:** There is frequent confusion over whether a "from quaternion" matrix is organized by
   * rows or columns. If you find that the matrix seems to rotate by the opposite angle, transpose it.
   *
   * Some math details can be found at
   * http://marc-b-reynolds.github.io/quaternions/2017/08/08/QuatRotMatrix.html
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
        // first row
        a * (qqw + qqx - qqy - qqz),
        2.0 * a * (quat.w * quat.z + quat.x * quat.y),
        2.0 * a * (quat.x * quat.z - quat.w * quat.y),
        // second row
        2.0 * a * (quat.x * quat.y - quat.w * quat.z),
        a * (qqw - qqx + qqy - qqz),
        2.0 * a * (quat.w * quat.x + quat.y * quat.z),
        // third row
        2.0 * a * (quat.x * quat.z + quat.w * quat.y),
        2.0 * a * (quat.y * quat.z - quat.w * quat.x),
        a * (qqw - qqx - qqy + qqz),
      );
      return matrix;
    }
  }
  /** Calculate quaternion terms used to convert matrix to a quaternion */
  private static computeQuatTerm(numerator: number, denomCoff: number, reciprocal: number, diagSum: number): number {
    let coff: number;
    const diagTol = 0.500;
    if (diagSum > diagTol) {
      coff = 0.5 * Math.sqrt(diagSum);
      if (denomCoff * numerator < 0.0)
        coff = -coff;
    } else {
      coff = numerator * reciprocal;
    }
    return coff;
  }
  /**
   * Create `this` matrix to a quaternion.
   * **Note:** This calculation requires `this` matrix to have unit length rows and columns.
   * **WARNING:** There is frequent confusion over whether a "from quaternion" matrix is organized by
   * rows or columns. If you find that the matrix seems to rotate by the opposite angle, transpose it.
   *
   * Some math details can be found at
   * http://marc-b-reynolds.github.io/quaternions/2017/08/08/QuatRotMatrix.html
   */
  public toQuaternion(): Point4d {
    const result = Point4d.createZero();
    const props = [
      [this.coffs[0], this.coffs[3], this.coffs[6]],
      [this.coffs[1], this.coffs[4], this.coffs[7]],
      [this.coffs[2], this.coffs[5], this.coffs[8]],
    ];
    const xx = props[0][0];
    const yy = props[1][1];
    const zz = props[2][2];
    const dSum: number[] = [];
    dSum[0] = 1.0 + xx - yy - zz;
    dSum[1] = 1.0 - xx + yy - zz;
    dSum[2] = 1.0 - xx - yy + zz;
    dSum[3] = 1.0 + xx + yy + zz;
    let denom: number;
    let maxIndex = 0;
    for (let i = 1; i <= 3; i++) {
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
