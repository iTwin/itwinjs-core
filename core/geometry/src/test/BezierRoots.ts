/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../GrowableArray";

export class BezierStackFrame {
  public order: number;    // number of coefficients in the bezier
  public index0: number;   // first coefficient index on the stack.
  public u0: number;       // start parameter value
  public u1: number;       // end parameter value

  public constructor(order: number = 0, index0: number = 0, u0: number = 0.0, u1: number = 1.0) {
    this.order = order;
    this.index0 = index0;
    this.u0 = u0;
    this.u1 = u1;
  }
  /** Reinitialize all entries. */
  public setAll(order: number, index0: number, u0: number, u1: number) {
    this.order = order;
    this.index0 = index0;
    this.u0 = u0;
    this.u1 = u1;
  }
  /** set the parameter limits */
  public setU0U1(u0: number, u1: number) {
    this.u0 = u0;
    this.u1 = u1;
  }
  /** return the parmeter value interpolated between members u0 and u1 */
  public fractionToParam(f: number): number { return (1.0 - f) * this.u0 + f * this.u1; }
}
/**
 * PascalCoeffients class has static methods which return rows of the PascalTriangle.
 *
 */
export class PascalCoefficients {
  private static allRows: Float64Array[] = [];
  /**
   * * return a row of the pascal table.
   * * The contents must not be altered by the user !!!
   * * Hypothetically the request row can be any integer.
   * * BUT in practice, values 60 create integer entries that are too big for IEEE double.
   */
  public static getRow(row: number): Float64Array {
    const allRows = PascalCoefficients.allRows;
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
   * @note if the destination array is larger than needed, it's leanding `row+1` values are filled,
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
}
//
//
export class BezierRoots {
  /**
   * * During iterations, subdivision steps are organized to reuse memory within the data array.
   * * Any individual set of `order` coefficients (either original or subdivided) of a 1D bezier is present in a block of `order` numbers on
   * a single Float64Array.
   * * A second array holds descriptors with `{order: number, start: number, fraction0: number, fraction1: number}`.
   * * Root finder logic is responsible for managing the descriptors and coefficients in stack-like fashion to avoid allocations.
   */
  private coffs: GrowableFloat64Array;
  private frames: BezierStackFrame[];
  private numBezierFrames: number;

  private constructor() {
    this.coffs = new GrowableFloat64Array(40);
    this.frames = [];
    this.numBezierFrames = 0;
  }
  public isEmptyStack(): boolean { return this.frames.length === 0; }

  /**
   * * Return the top frame
   * * No check for empty stack.
   */
  private get topBezier(): BezierStackFrame { return this.frames[this.numBezierFrames - 1]; }
  /**
   * Read-only property: number of beziers on the stack.
   */
  public get numBezier(): number { return this.numBezierFrames; }
  /**
   * Read-only property: order of top stack frame.
   */
  public get topOrder(): number { return this.topBezier.order; }
  /**
   * Read-only property: u0 of top stack frame.
   */
  public get topU0(): number { return this.topBezier.u0; }
  /**
   * Read-only property: u1 of top stack frame.
   */
  public get topU1(): number { return this.topBezier.u1; }
  /**
   * Compute the global parameter value at fractional parameter within the top frame.
   * @param f fractional coordinate
   */
  public topInterpolatedParam(f: number): number { return this.topBezier.fractionToParam(f); }
  /** return a frame at the top of the stack.
   * * This frame will be reused if possible.
   */
  private openFrame(): BezierStackFrame {
    if (this.numBezierFrames === this.frames.length) {
      // push a new uninitialized frame . ..
      this.frames.push(new BezierStackFrame());
    }
    return this.frames[this.numBezierFrames++];
  }
  public pushBezier(coffs: number[], u0: number = 0.0, u1: number = 1.0) {
    const frame = this.openFrame();
    const index0 = this.coffs.length;
    frame.setAll(coffs.length, index0, u0, u1);
    for (const a of coffs) { this.coffs.push(a); }
  }
  /** pop the top of stack bezier.
   * the BezierStackFrame object is retained for reuse on subsequent push.
   */
  public popBezier() {
    this.numBezierFrames--;
    const newCoffSize = this.frames[this.numBezierFrames].index0;
    this.coffs.resize(newCoffSize);
  }
  /** push a complete copy of the topOfStack bezier. */
  public pushCopyOfTopBezier(): BezierStackFrame {
    const frame0 = this.topBezier;
    const frame1 = this.openFrame();
    const order = frame0.order;
    frame1.order = frame0.order;
    frame1.index0 = this.coffs.length;
    frame1.u0 = frame0.u0;
    frame1.u1 = frame0.u1;
    this.coffs.pushBlockCopy(frame0.index0, order);
    return frame1;
  }
  private _basisBuffer: Float64Array | undefined = undefined;
  /**
   * Evaluate the top of stack bezier at given parameter
   * @param u fractional coordinate (within the top bezier)
   */
  public evaluateTopBezierAtLocalFraction(u: number): number {
    const frame = this.topBezier;
    this._basisBuffer = PascalCoefficients.getBezierBasisValues(frame.order, u, this._basisBuffer);
    return this.coffs.weightedSum(frame.index0, this._basisBuffer);

  }
  /** Create for given univariate bezier coefficients and global domain */
  public static create(coffs: number[], globalU0: number, globalU1: number): BezierRoots {
    const rootFinder = new BezierRoots();
    rootFinder.pushBezier(coffs, globalU0, globalU1);
    return rootFinder;
  }
  /** Subdivide the bezier at `i0`, leaving its left part at `i0` and its right part at `j0.
   * * The interval values for the `i0` coefficients are also updated.
   * * It is ASSUMED that frameB has the same order as frameA.
   * @param fraction [in] fractional parameter within the `frame0` bezier
   * @param frameA [in] stack frame for existing coffs which become left part
   * @param frameB [in] stack frame for destination.
   */
  private subdivideLeftInPlaceGo(fraction: number, frameA: BezierStackFrame, frameB: BezierStackFrame) {
    const order = frameA.order;
    const i0 = frameA.index0;
    const i1 = i0 + order;
    const j0 = frameB.index0;
    const j1 = j0 + order;

    const globalU = frameA.fractionToParam(fraction);
    frameB.u1 = frameA.u1;
    frameA.u1 = globalU;
    frameB.u0 = globalU;
    const coffs = this.coffs;
    let jMovingRight = j1 - 1;
    const f0 = 1.0 - fraction;
    const f1 = fraction;
    const iRight = i1 - 1;    // each step leaves last coff of left part ready move to right part.
    for (let i = i0; i + 1 < i1; i++) {
      coffs.move(iRight, jMovingRight--);
      coffs.overwriteWithScaledCombinations(i, iRight, f0, f1);
    }
    coffs.move(iRight, jMovingRight);
  }
  /**
   * * Push one new block.
   * * subdivide the prior top block, leaving left half in prior top, right in new top.
   * * return the tip-of-triangle value.
   * @param localFraction
   */
  public pushSubdivide(localFraction: number): number {
    const frameA = this.topBezier;
    const frameB = this.pushCopyOfTopBezier();
    this.subdivideLeftInPlaceGo(localFraction, frameA, frameB);
    return this.coffs.at(frameB.index0);
  }
  /** Evaluate the top bezier at local fractional coordinate */
  public evaluateLocal(localFraction: number): number {
    this.pushCopyOfTopBezier();
    const a = this.pushSubdivide(localFraction);
    this.popBezier();
    this.popBezier();
    return a;
  }
}
