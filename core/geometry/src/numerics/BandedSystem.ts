/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Geometry } from "../Geometry";
/**
 * `BandedSystem` is a class with static methods for solving banded linear systems, such as in computing
 * Bspline poles for pass-through points
 * @internal
 */
export class BandedSystem {
  /** apply LU decomposition to a banded system */
  public static decomposeLU(
    numRow: number,
    bw: number,   /* band width */
    data: Float64Array,
  ): boolean {
    const n = numRow - 1;
    const sbw = Math.floor(bw / 2); // ASSUMES bw is odd?
    let sum;
    // Phase 1:
    //   [A b C]
    //   [d q f]
    //   [G h I]
    // q is a diagonal (pivot
    // d, f are row vectors
    // A,C,I are blocks
    // b,h are column vectors.
    // Phase 1:  [q,f] -= d * [b,C]
    // Phase 2: h = (h- G*b)/q
    // This is standard gaussian elimination, but in row-think rather than the usual column-think
    for (let i = 0; i <= n; i++) {
      const jh = Math.min(n, i + sbw);
      for (let j = i; j <= jh; j++) {
        const kl = Math.max(0, j - sbw);
        sum = 0.0;
        for (let k = kl; k < i; k++)
          sum += data[i * bw + k - i + sbw] * data[k * bw + j - k + sbw];
        data[i * bw + j - i + sbw] -= sum;
      }

      for (let j = i + 1; j <= jh; j++) {
        const kl = Math.max(0, j - sbw);
        sum = 0.0;
        for (let k = kl; k < i; k++)
          sum += data[j * bw + k - j + sbw] * data[k * bw + i - k + sbw];

        if (Math.abs(data[i * bw + sbw]) < 1e-9)   // TODO -- tolerance !!!
          return false;

        data[j * bw + i - j + sbw] = (data[j * bw + i - j + sbw] - sum) / data[i * bw + sbw];
      }
    }
    return true;
  }

  /**
   *
   * @param sum evolving sum.  sum.length
   * @param source data being added
   * @param sourceRow row in source.  Plain offset is sourceRow * sum.length
   * @param scale scale factor to apply.
   */
  private static arrayAddScaledBlock(sum: Float64Array, source: Float64Array, sourceRow: number, scale: number) {
    const n = sum.length;
    let k = n * sourceRow;
    for (let i = 0; i < n; i++, k++) {
      sum[i] += source[k] * scale;
    }
  }
  //   dest[destRow][*] = sourceA[sourceRow][*] - sourceB[*]
  private static blockAssignBlockMinusArray(dest: Float64Array, destRow: number, sourceA: Float64Array, sourceARow: number, sourceB: Float64Array) {
    const n = sourceB.length;
    let destIndex = destRow * n;
    let sourceIndex = sourceARow * n;
    for (let i = 0; i < n; i++, sourceIndex++, destIndex++) {
      dest[destIndex] = sourceA[sourceIndex] - sourceB[i];
    }
  }
  //   dest[destRow][*] = sourceA[sourceBRow][*] * scaleA - sourceB[*] * scaleB
  private static blockSumOfScaledBlockScaledArray(dest: Float64Array, destRow: number, sourceA: Float64Array, sourceBRow: number, scaleA: number, sourceB: Float64Array, scaleB: number) {
    const n = sourceB.length;
    let destIndex = destRow * n;
    let sourceBIndex = sourceBRow * n;
    for (let i = 0; i < n; i++, sourceBIndex++, destIndex++) {
      dest[destIndex] = sourceA[sourceBIndex] * scaleA + sourceB[i] * scaleB;
    }
  }

  /**
   * Solve a linear system A*X=B where
   * * A is nominally an `numRow*numRow` matrix, but is stored in banded row-major form
   * * The band storage is `bw` numbers per row, with the middle value being the diagonal of that row.
   *    * Hence rows near top and bottom have band values `outside` the matrix.
   * * The right hand side is an `numRow*numRHS` matrix in row-major order.
   * @param numRow number of rows (and columns) of the nominal full matrix.
   * @param bw total bandwidth (diagonal + equal number of values to left and right)
   * @param matrix the banded matrix, as packed row-major
   * @param numRHS the number of right hand sides.
   * @param rhs the right hand sides
   */
  public static solveBandedSystemMultipleRHS(
    numRow: number,
    bw: number,   /* band width */
    matrix: Float64Array,
    numRHS: number, // number of components in each RHS row.
    rhs: Float64Array, // RHS data, packed, overwritten by solution
  ): Float64Array | undefined {
    if (!this.decomposeLU(numRow, bw, matrix))
      return undefined;

    const n = numRow - 1;
    const sbw = Math.floor(bw / 2);
    const rhsRowS = new Float64Array(numRHS);

    /* Compute solution vector */
    // Z is solution vector . . .
    const reducedRHS = new Float64Array(numRHS * numRow);
    const result = new Float64Array(numRHS * numRow);

    for (let i = 0; i <= n; i++) {
      rhsRowS.fill(0);

      const jl = Math.max(0, i - sbw);
      for (let j = jl; j < i; j++) {
        this.arrayAddScaledBlock(rhsRowS, reducedRHS, j, matrix[i * bw + j - i + sbw]);
        // S.SumOf(S, Z[j], data[i * bw + j - i + sbw]);
      }
      this.blockAssignBlockMinusArray(reducedRHS, i, rhs, i, rhsRowS);
    }
    for (let i = n; i >= 0; i--) {
      const fact = Geometry.conditionalDivideCoordinate(1.0, matrix[i * bw + sbw]);
      if (fact === undefined)
        return undefined;

      rhsRowS.fill(0);

      const jh = Math.min(n, i + sbw);
      for (let j = i + 1; j <= jh; j++) {
        // S.SumOf(S, Q[j], data[i * bw + j - i + sbw]);
        this.arrayAddScaledBlock(rhsRowS, result, j, matrix[i * bw + j - i + sbw]);
      }
      this.blockSumOfScaledBlockScaledArray(result, i, reducedRHS, i, fact, rhsRowS, -fact);
      // Q[i].SumOf(O, Z[i], fact, S, -fact);
    }

    return result;
  }
  /**
   * Multiply a banded numRow*numRow matrix times a full numRow*numRHS, return as new matrix
   */
  public static multiplyBandedTimesFull(
    numRow: number,
    bw: number,   /* band width */
    bandedMatrix: Float64Array,
    numRHS: number, // number of components in each RHS row.
    rhs: Float64Array, // RHS data, packed, overwritten by solution
  ): Float64Array {
    const result = new Float64Array(rhs.length);
    const halfBandWidth = Math.floor(bw / 2);
    let sum, k0, k1, kRef;

    for (let pivot = 0; pivot < numRow; pivot++) {
      // "k" vars are nominal column indices in the matrix, and nominal row indices in the rhs.
      k0 = pivot - halfBandWidth;
      if (k0 < 0) k0 = 0;
      k1 = pivot + halfBandWidth + 1;
      if (k1 > numRow) k1 = numRow;
      kRef = halfBandWidth + pivot * (bw - 1);
      for (let m = 0; m < numRHS; m++) {
        sum = 0;
        for (let k = k0; k < k1; k++) {
          sum += bandedMatrix[kRef + k] * rhs[k * numRHS + m];
        }
        result[pivot * numRHS + m] = sum;
      }
    }
    return result;
  }
}
