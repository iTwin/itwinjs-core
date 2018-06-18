/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../GrowableArray";
import { PascalCoefficients } from "../numerics/PascalCoefficients";
import { Segment1d } from "../PointVector";
/* tslint:disable:no-console */
export class BezierStackFrame {
  public order: number;    // number of coefficients in the bezier
  public index0: number;   // first coefficient index on the stack.
  public originalCount: number; // number of allocated coefficients
  public u0: number;       // start parameter value
  public u1: number;       // end parameter value

  public constructor(order: number = 0, index0: number = 0, u0: number = 0.0, u1: number = 1.0) {
    this.order = order;           // count -- can change during calculation.
    this.index0 = index0;
    this.originalCount = order; // original count.
    this.u0 = u0;
    this.u1 = u1;
  }
  /** Reinitialize all entries. */
  public setAll(order: number, index0: number, originalCount: number, u0: number, u1: number) {
    this.order = order;
    this.index0 = index0;
    this.originalCount = originalCount;
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
   * * Return the second from top frame
   * * No check for empty stack.
   */
  private get topBezierB(): BezierStackFrame { return this.frames[this.numBezierFrames - 2]; }
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
  public pushBezier(coffs: number[] | Float64Array, u0: number = 0.0, u1: number = 1.0) {
    const frame = this.openFrame();
    const index0 = this.coffs.length;
    frame.setAll(coffs.length, index0, coffs.length, u0, u1);
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
  private _basisBuffer1: Float64Array | undefined = undefined;
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
  public static create(coffs: number[] | Float64Array, globalU0: number, globalU1: number): BezierRoots {
    const rootFinder = new BezierRoots();
    rootFinder.pushBezier(coffs, globalU0, globalU1);
    return rootFinder;
  }
  /**
   * Return the simple array of coefficients of a frame on the stack.
   * @param frameIndex index (0 ..) of the frame to access.
   */
  public getFrameBezier(frameIndex: number): number[] | undefined {
    if (frameIndex >= 0 && frameIndex < this.numBezierFrames) {
      const frame = this.frames[frameIndex];
      const index0 = frame.index0;
      const coffs = this.coffs;
      const out = [];
      for (let i = 0; i < frame.order; i++)
        out.push(coffs.at(index0 + i));
      return out;
    }
    return undefined;
  }
  /**
   * Return the parameter iterval of a frame on the stack.
   * @param frameIndex index (0 ..) of the frame to access.
   */
  public getFrameParams(frameIndex: number): Segment1d | undefined {
    if (frameIndex >= 0 && frameIndex < this.numBezierFrames) {
      const frame = this.frames[frameIndex];
      return Segment1d.create(frame.u0, frame.u1);
    }
    return undefined;
  }
  /**
   * Apply deflation from the left to a frame.
   * * This assumes that the left coefficient is zero.
   * @param frame frame description
   */
  public deflateFrameLeft(frame: BezierStackFrame) {
    // coefficient 0 is zero (caller promises.)
    // get bezier coffs for both orders ...
    const order1 = frame.order;
    const order0 = order1 - 1;
    const coff0 = PascalCoefficients.getRow(order0 - 1);
    const coff1 = PascalCoefficients.getRow(order1 - 1);
    const i0 = frame.index0;
    let a;
    for (let i = 0; i < order0; i++) {
      a = this.coffs.at(i0 + i + 1);
      this.coffs.setAt(i0 + i, a * coff1[i + 1] / coff0[i]);
    }
    frame.order--;
  }

  /**
   * Apply deflation from the right to a frame.
   * * This assumes that the right coefficient is zero.
   * @param frame frame description
   */
  public deflateFrameRight(frame: BezierStackFrame) {
    // final coefficient is zero (caller promises.)
    // get bezier coffs for both orders ...
    const order1 = frame.order;
    const order0 = order1 - 1;
    const coff0 = PascalCoefficients.getRow(order0 - 1);
    const coff1 = PascalCoefficients.getRow(order1 - 1);
    const i0 = frame.index0;
    let a, b;
    for (let i = 0; i < order0; i++) {
      a = this.coffs.at(i0 + i);
      b = a * coff1[i] / coff0[i];
      this.coffs.setAt(i0 + i, b);
    }
    frame.order--;
  }
  /** Subdivide the bezier in stack frame  `frameA`, leaving its left part at `frameA`
   *       and its right part in `frameB.
   * * The interval values for the `frameA` coefficients are also updated.
   * * It is ASSUMED that frameB has the same order as frameA.
   * @param fraction [in] fractional parameter within the `frameA` bezier
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
  /** Search for the highest polygon crossing in a frame.
   * @param frame [in] stack frame for bezier coefficients.
   * @returns undefined if not crossing.  Otherwise the local fraction of the rightmost
   * polygon crossing.
   */
  private searchRightPolygonCrossing(frame: BezierStackFrame): number | undefined {
    const order = frame.order;
    const i0 = frame.index0;
    let i2 = i0 + order;
    const coffs = this.coffs;
    let i1;
    let a2, a1;
    while (--i2 > i0) {
      a2 = coffs.at(i2);
      if (a2 === 0.0)
        return (i2 - i0) / (order - 1);
      i1 = i2 - 1;
      a1 = coffs.at(i1);
      if (a1 * a2 <= 0.0)
        return ((i1 - i0) - a1 / (a2 - a1)) / (order - 1);
    }
    return undefined;
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
  /**
   *
   * @param frame [in] stack frame with coefficients
   * @param startFraction [in] fraction for first iteration
   * @param tolerance [in] convergence tolerance.   The iteration is considered converged on the
   * second time the tolerance is satisfied.   For a typical iteration (not double root), the extra pass
   * will double the number of digits.  Hence this tolerance is normally set to 10 to 12 digits, trusting
   * that the final iteration will clean it up to nearly machine precision.
   * @param tolerance
   */
  private runNewton(frame: BezierStackFrame, startFraction: number, tolerance: number = 1.0e-11): number | undefined {
    const derivativeFactor = frame.order - 1;
    let numConverged = 0;
    let u = startFraction;
    const bigStep = 10.0;
    for (let iterations = 0; iterations++ < 10;) {
      this._basisBuffer = PascalCoefficients.getBezierBasisValues(frame.order, u, this._basisBuffer);
      const f = this.coffs.weightedSum(frame.index0, this._basisBuffer);
      this._basisBuffer1 = PascalCoefficients.getBezierBasisValues(frame.order - 1, u, this._basisBuffer1);
      const df = derivativeFactor * this.coffs.weightedDifferenceSum(frame.index0, this._basisBuffer1);
      if (Math.abs(f) > bigStep * Math.abs(df))
        return undefined;
      const du = f / df;
      if (Math.abs(du) < tolerance) {
        numConverged++;
        if (numConverged >= 2)
          return u - du;
      } else {
        numConverged = 0;
      }
      u -= du;
    }
    return undefined;
  }
  /** Find roots by subdividing at highest polygon crossing.
   * * Top frame (with the subject bezier) is unchanged.
   */
  public appendTopFrameRoots(roots: GrowableFloat64Array) {
    const numBezierAtStart = this.numBezier;
    this.pushCopyOfTopBezier();
    roots.clear();
    while (this.numBezier > numBezierAtStart) {
      const topFrame = this.topBezier;
      if (topFrame.order <= 1) {
        this.popBezier()
        continue;
      }
      /** find the hightest polygon crossing */
      const polygonCrossing = this.searchRightPolygonCrossing(topFrame);
      // console.log("Candidate", this.getFrameBezier(this.numBezier - 1));
      // console.log("rightCrossing", polygonCrossing);
      if (undefined === polygonCrossing) {
        this.popBezier();
      } else {
        const newtonRoot = this.runNewton(topFrame, polygonCrossing);
        if (newtonRoot) {
          roots.push(topFrame.fractionToParam(newtonRoot));
          if (newtonRoot >= 1.0) {
            this.deflateFrameRight(this.topBezier);
          } else if (newtonRoot <= 0.0) {
            this.deflateFrameLeft(this.topBezier);
          } else {
            this.pushSubdivide(newtonRoot);
            const rightFrame = this.topBezier;
            const leftFrame = this.topBezierB;
            // console.log("left", this.getFrameBezier(this.numBezier - 2));
            // console.log("right", this.getFrameBezier(this.numBezier - 1));
            this.deflateFrameRight(leftFrame);
            this.deflateFrameLeft(rightFrame);
            // console.log("deflated left", this.getFrameBezier(this.numBezier - 2));
            // console.log("deflated right", this.getFrameBezier(this.numBezier - 1));
          }
        } else {
          this.pushSubdivide(polygonCrossing);
        }
      }
    }
  }
}
