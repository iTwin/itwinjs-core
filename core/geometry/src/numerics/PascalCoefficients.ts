/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/**
 * PascalCoeffients class has static methods which return rows of the PascalTriangle.
 *
 */
export class PascalCoefficients {
  private static _allRows: Float64Array[] = [];
  /**
   * * return a row of the pascal table.
   * * The contents must not be altered by the user !!!
   * * Hypothetically the request row can be any integer.
   * * BUT in practice, values 60 create integer entries that are too big for IEEE double.
   */
  public static getRow(row: number): Float64Array {
    const allRows = PascalCoefficients._allRows;
    if (allRows.length === 0) {
      // seed the table . . .
      allRows.push(new Float64Array([1]));
      allRows.push(new Float64Array([1, 1]));
      allRows.push(new Float64Array([1, 2, 1]));
      allRows.push(new Float64Array([1, 3, 3, 1]));
      allRows.push(new Float64Array([1, 4, 6, 4, 1]));
      allRows.push(new Float64Array([1, 5, 10, 10, 5, 1]));
      allRows.push(new Float64Array([1, 6, 15, 20, 15, 6, 1]));
      allRows.push(new Float64Array([1, 7, 21, 35, 35, 21, 7, 1]));
    }

    while (allRows.length <= row) {
      const k = allRows.length;
      const oldRow = allRows[k - 1];
      const newRow = new Float64Array(k + 1);
      newRow[0] = 1.0;
      for (let i = 1; i < k; i++)
        newRow[i] = oldRow[i - 1] + oldRow[i];
      newRow[k] = 1.0;
      allRows.push(newRow);
    }
    return allRows[row];
  }
  /** Return an array with Bezier weighted pascal coefficients
   * @param row row index in the pascal triangle.  (`row+1` entries)
   * @param u parameter value
   * @param result optional destination array.
   * @note if the destination array is undefined or too small, a new Float64Array is allocated.
   * @note if the destination array is larger than needed, its leading `row+1` values are filled,
   *     and the array is returned.
   */
  public static getBezierBasisValues(order: number, u: number, result?: Float64Array): Float64Array {
    const row = order - 1;
    const pascalRow = PascalCoefficients.getRow(row);
    if (result === undefined || result.length < order)
      result = new Float64Array(order);
    for (let i = 0; i < order; i++)
      result[i] = pascalRow[i];
    // multiply by increasing powers of u ...
    let p = u;
    for (let i = 1; i < order; i++ , p *= u) {
      result[i] *= p;
    }
    // multiply by powers of (1-u), working from right
    const v = 1.0 - u;
    p = v;
    for (let i = order - 2; i >= 0; i-- , p *= v) {
      result[i] *= p;
    }
    return result;
  }

  /** Return an array with derivatives of Bezier weighted pascal coefficients
   * @param row row index in the pascal triangle.  (`row+1` entries)
   * @param u parameter value
   * @param result optional destination array.
   * @note if the destination array is undefined or too small, a new Float64Array is allocated.
   * @note if the destination array is larger than needed, its leading `row+1` values are filled,
   *     and the array is returned.
   */
  public static getBezierBasisDerivatives(order: number, u: number, result?: Float64Array): Float64Array {
    result = this.getBezierBasisValues(order - 1, u, result);
    // derivative is df/du = (order-1 ) * sum ( q[i+1] - q[i])   summed on 0 <= i < order - 1.\
    // evaluate lower order basis, overwrite in place from right to left
    const f = order - 1;
    result[order - 1] = f * result[order - 2];
    for (let k = order - 2; k > 0; k--) {
      result[k] = f * (result[k - 1] - result[k]);
    }
    result[0] = - f * result[0];
    return result;
  }
}
