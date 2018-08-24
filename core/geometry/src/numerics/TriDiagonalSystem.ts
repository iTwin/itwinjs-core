/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Geometry } from "../Geometry";
import { Point3d } from "../PointVector";

// Enumerated type lies outside of TriDiagonalSystem, as TSLint prevented declaration within class
enum DataState {
  RawMatrix,
  FactorOK,
  FactorFailed,
}

export class TriDiagonalSystem {

  // Lower diagonal, indexed by rows
  private _aLeft: Float64Array;
  // Upper diagonal, indexed by rows
  private _aRight: Float64Array;
  // Main diagonal, indexed by rows
  private _aDiag: Float64Array;
  // Right sude vector
  private _b: Float64Array;
  // Solution vector
  private _x: Float64Array;

  private _dataState!: DataState;

  constructor(n: number) {
    this._aLeft = new Float64Array(n);
    this._aDiag = new Float64Array(n);
    this._aRight = new Float64Array(n);
    this._b = new Float64Array(n);
    this._x = new Float64Array(n);
    this.Reset();
  }

  // Reset to RawMatrix state with all coefficients zero
  public Reset() {
    this._dataState = DataState.RawMatrix;
    const n = this._aDiag.length;
    for (let i = 0; i < n; i++) {
      this._aLeft[i] = this._aRight[i] = this._aDiag[i] = this._b[i] = this._x[i] = 0.0;
    }
  }
  // Install data in a row of the matrix
  public SetRow(row: number, left: number, diag: number, right: number) {
    this._aLeft[row] = left;
    this._aDiag[row] = diag;
    this._aRight[row] = right;
  }
  // Add to row of matrix
  public AddToRow(row: number, left: number, diag: number, right: number) {
    this._aLeft[row] += left;
    this._aDiag[row] += diag;
    this._aRight[row] += right;
  }
  // Install data in the right side (B) vector
  public SetB(row: number, bb: number) {
    this._b[row] = bb;
  }
  // Add to an entry in the right side (B) vector
  public AddToB(row: number, bb: number) {
    this._b[row] += bb;
  }
  // Access data from the right side (B) vector
  public GetB(row: number): number {
    return this._b[row];
  }
  // Install data in the solution (X) vector
  public SetX(row: number, xx: number) {
    this._x[row] = xx;
  }
  // Access data frin the solution (X) vector
  public GetX(row: number): number {
    return this._x[row];
  }
  // Get method for matrix and vector order
  public Order(): number {
    return this._aDiag.length;
  }
  // Compute product of AX and save as B
  public MultiplyAX(): boolean {
    if (this._dataState === DataState.FactorFailed) {
      return false;
    } else if (this._dataState === DataState.FactorOK) {
      const n = this._aDiag.length;
      const nm1 = n - 1;
      for (let i = 0; i < nm1; i++) {
        this._b[i] = this._aDiag[i] * this._x[i] + this._aRight[i] * this._x[i + 1];
      }
      this._b[nm1] = this._aDiag[nm1] * this._x[nm1];

      for (let i = nm1; i > 0; i--) {
        this._b[i] += this._aLeft[i] * this._b[i - 1];
      }

      return true;
    } else {
      const n = this._aDiag.length;
      const nm1 = n - 1;
      this._b[0] = this._aDiag[0] * this._x[0] + this._aRight[0] * this._x[1];
      let i;
      for (i = 1; i < nm1; i++) {
        this._b[i] = this._aLeft[i] * this._x[i - 1] + this._aDiag[i] * this._x[i] + this._aRight[i] * this._x[i + 1];
      }
      this._b[nm1] = this._aLeft[nm1] * this._x[n - 2] + this._aDiag[i] * this._x[nm1];
      return true;
    }
  }

  // Compute product of AX and save as B
  public MultiplyAXPoints(pointX: Point3d[], pointB: Point3d[]): boolean {
    pointB.length = 0;
    while (pointB.length < pointX.length)
      pointB.push(Point3d.create());
    pointB.length = pointX.length;

    if (this._dataState === DataState.FactorFailed) {
      return false;
    } else if (this._dataState === DataState.FactorOK) {

      const n = this._aDiag.length;
      const nm1 = n - 1;
      for (let i = 0; i < nm1; i++) {
        Point3d.createAdd2Scaled(pointX[i], this._aDiag[i], pointX[i + 1], this._aRight[i], pointB[i]);
      }
      Point3d.createScale(pointX[nm1], this._aDiag[nm1], pointB[nm1]);

      for (let i = nm1; i > 0; i--) {
        pointB[i].plusScaled(pointB[i - 1], this._aLeft[i], pointB[i]);
      }

      return true;
    } else {
      const n = this._aDiag.length;
      const nm1 = n - 1;
      Point3d.createAdd2Scaled(pointX[0], this._aDiag[0], pointX[1], this._aRight[0], pointB[0]);
      let i;
      for (i = 1; i < nm1; i++) {
        Point3d.createAdd3Scaled(
          pointX[i - 1], this._aLeft[i], pointX[i], this._aDiag[i],
          pointX[i + 1], this._aRight[i],
          pointB[i]);
      }
      Point3d.createAdd2Scaled(pointX[n - 2], this._aLeft[nm1], pointX[nm1], this._aDiag[nm1], pointB[nm1]);
      return true;
    }
  }

  // Multiply the stored factors together to return to plain matrix form
  public Defactor(): boolean {
    if (this._dataState === DataState.RawMatrix) {
      return true;
    }
    if (this._dataState === DataState.FactorFailed) {
      return false;
    }
    const n = this._aDiag.length;
    const nm1 = n - 1;

    for (let i = nm1; i > 0; i--) {
      this._aDiag[i] += this._aLeft[i] * this._aRight[i - 1];
      this._aLeft[i] *= this._aDiag[i - 1];
    }
    this._dataState = DataState.RawMatrix;
    return true;
  }
  // Factor the tridiagonal matrix to LU parts. b, x, not altered
  public Factor(): boolean {
    if (this._dataState === DataState.FactorOK) {
      return true;
    }
    if (this._dataState !== DataState.RawMatrix) {
      return false;
    }
    this._dataState = DataState.FactorFailed;

    const n1 = this._aDiag.length - 1;    // Last pivot index
    // Eliminate in subdiagonal.
    for (let i = 0; i < n1; i++) {
      const r = Geometry.conditionalDivideFraction(this._aLeft[i + 1], this._aDiag[i]);
      if (!r)
        return false;
      this._aLeft[i + 1] = r;
      this._aDiag[i + 1] -= r * this._aRight[i];
    }
    this._dataState = DataState.FactorOK;
    return true;
  }
  // Solve AX=B. A is left in factored state. B unchanged.
  public FactorAndBackSubstitute(): boolean {
    const n = this._aDiag.length;
    const n1 = n - 1;
    if (!this.Factor())
      return false;

    // Apply Linv to B, same sequence as was done to A:
    for (let i = 0; i < n; i++) {
      this._x[i] = this._b[i];
    }
    for (let i = 1; i < n; i++) {
      this._x[i] -= this._aLeft[i] * this._x[i - 1];
    }

    // Print ("LU  LinvB B");
    // overwrite X with solution of U * X = Linv B, where RHS is already in X...
    // All diagonals are known to be nonzero. Really.  Really???
    this._x[n1] /= this._aDiag[n1];

    for (let i = n1 - 1; i >= 0; i--) {
      this._x[i] = (this._x[i] - this._aRight[i] * this._x[i + 1]) / this._aDiag[i];
    }

    return true;
  }
  // Solve AX=B. A is left in factored state. B unchanged. vectorB and vectorX may be the same array
  public FactorAndBackSubstitutePointArrays(vectorB: Point3d[], vectorX: Point3d[]): boolean {
    const n = this._aDiag.length;
    if (vectorB.length < n)
      return false;

    while (vectorX.length < n)
      vectorX.push(Point3d.create(0, 0, 0));
    vectorX.length = n;
    const n1 = n - 1;
    if (!this.Factor())
      return false;

    // Apply Linv to B, same sequence as was done to A:
    if (vectorB !== vectorX) {
      for (let i = 0; i < n; i++) {
        vectorX[i].setFrom(vectorB[i]);
      }
    }

    let a: number;
    let b: number;
    for (let i = 1; i < n; i++) {
      a = this._aLeft[i];
      vectorX[i].x -= a * vectorX[i - 1].x;
      vectorX[i].y -= a * vectorX[i - 1].y;
      vectorX[i].z -= a * vectorX[i - 1].z;
    }

    // Print ("LU  LinvB B");
    // overwrite X with solution of U * X = Linv B, where RHS is already in X...
    // All diagonals are known to be nonzero. Really.  Really???
    b = 1.0 / this._aDiag[n1];
    vectorX[n1].x *= b;
    vectorX[n1].y *= b;
    vectorX[n1].z *= b;

    for (let i = n1 - 1; i >= 0; i--) {
      a = this._aRight[i];
      b = 1.0 / this._aDiag[i];
      vectorX[i].x = (vectorX[i].x - a * vectorX[i + 1].x) * b;
      vectorX[i].y = (vectorX[i].y - a * vectorX[i + 1].y) * b;
      vectorX[i].z = (vectorX[i].z - a * vectorX[i + 1].z) * b;
    }

    return true;
  }
  // Allocate a complete copy
  public Copy(): TriDiagonalSystem {
    const n = this._aDiag.length;
    const B = new TriDiagonalSystem(n);
    for (let i = 0; i < n; i++) {
      B._aLeft[i] = this._aLeft[i];
      B._aDiag[i] = this._aDiag[i];
      B._aRight[i] = this._aRight[i];
      B._x[i] = this._x[i];
      B._b[i] = this._b[i];
    }
    B._dataState = this._dataState;
    return B;
  }

  // return an array form that may be useful for display ...
  public flatten(): any {
    const n = this._aDiag.length;
    const data = [];

    for (let i = 0; i < n; i++) {
      data.push(
        [i, [this._aLeft[i], this._aDiag[i], this._aRight[i]], this._x[i], this._b[i]]);
    }
    return data;
  }

  // return an array form that may be useful for display ...
  public flattenWithPoints(xyzB: Point3d[]): any {
    const n = this._aDiag.length;
    const data = [];

    for (let i = 0; i < n; i++) {
      data.push(
        [i, [this._aLeft[i], this._aDiag[i], this._aRight[i]], this._x[i], xyzB[i].toJSON()]);
    }
    return data;
  }
}
