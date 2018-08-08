/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Numerics */

// import { Angle, AngleSweep, Geometry } from "../Geometry";
import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../GrowableArray";
import { PascalCoefficients } from "./PascalCoefficients";
import { Degree2PowerPolynomial, Degree3PowerPolynomial, Degree4PowerPolynomial, AnalyticRoots } from "./Polynomials";
/* tslint:disable:variable-name*/
/**
 * * BezierCoffs is an abstract base class for one-dimensional (u to f(u)) Bezier polynomials.
 * * The base class carries a Float64Array with coefficients.
 * * The Float64Array is NOT Growable unless derived classes add logic to do so.  Its length is the Bezier polynomial order.
 * * The family of derived classes is starts with low order (at least linear through cubic) with highly optimized calculations.
 * * The general degree Bezier class also uses this as its base class.
 * * The length of the coefficient array is NOT always the bezier order.   Use the `order` property to access the order.
 */
export abstract class BezierCoffs {
  /** Array of coefficients.
   * * The number of coefficients is the order of the Bezier polynomial.
   */
  public coffs: Float64Array;
  /**
   * * If `data` is a number, an array of that size is created with zeros.
   * * If `data` is a Float64Array, it is cloned (NOT CAPTURED)
   * * If `data` is a number array, its values are copied.
   */
  constructor(data: number | Float64Array | number[]) {
    if (data instanceof Float64Array) {
      this.coffs = data.slice();
    } else if (Array.isArray(data)) {
      this.coffs = new Float64Array(data.length);
      let i = 0;
      for (const a of data) this.coffs[i++] = a;
    } else {
      this.coffs = new Float64Array(data);
    }
  }
  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public abstract basisFunctions(u: number): Float64Array;
  /** @returns Return a clone of this bezier. */
  public abstract clone(): BezierCoffs;
  /**
   * create an object of same order with zero coefficients.
   * The base implementation makes a generic Bezier of the same order.
   */
  public createPeer(): BezierCoffs {
    const peer = new Bezier(this.order);
    return peer;
  }
  /** Evaluate the polynomial at u.
   * @param u bezier parameter for evaluation.
   */
  public abstract evaluate(u: number): number;
  /** The order (number of coefficients) as a readable property  */
  public get order(): number { return this.coffs.length; }
  /** Copy coefficients from other Bezier. Note that the coefficient count (order) of "this" can change. */
  public copyFrom(other: BezierCoffs): void {
    if (this.order === other.order)
      for (let i = 0; i < this.coffs.length; i++) { this.coffs[i] = other.coffs[i]; }
    else this.coffs = other.coffs.slice();
  }
  /**
   * Apply a scale factor to all coefficients.
   * @param scale scale factor to apply to all coefficients.
   */
  public scaleInPlace(scale: number): void {
    for (let i = 0; i < this.coffs.length; i++)
      this.coffs[i] *= scale;
  }
  /** add a constant to each coefficient.
   * @param a constant to add.
   */
  public addInPlace(a: number): void {
    for (let i = 0; i < this.coffs.length; i++)
      this.coffs[i] += a;
  }
  /** Compute parameter values where the bezier value matches _targetValue.
   * * The base class finds roots only in 01.  (i.e. ignores _restrictTo01)
   * * Order-specific implementations apply special case  analytic logic, e.g. for degree 1,2,3,4.
   */
  public roots(targetValue: number, _restrictTo01: boolean): number[] | undefined {
    const bezier = Bezier.create(this);
    bezier.addInPlace(- targetValue);
    return Bezier.deflateRoots01(bezier);
  }
  /** Given an array of numbers, optionally remove those not in the 0..1 interval.
   * @param roots candidate values
   * @param restrictTo01 If false, no filtering occurs and the pointer to the original array is unchanged.
   *     If true, filtering is done and values are returned, possibly in a new array and possibly in the original.
   */
  public filter01(roots: number[] | undefined, restrictTo01 = false): number[] | undefined {
    if (!roots || !restrictTo01)
      return roots;
    let anyFound = false;
    for (const r of roots) {
      if (Geometry.isIn01(r)) { anyFound = true; break; }
    }
    if (anyFound) {
      const roots01: number[] = [];
      for (const r of roots) { if (Geometry.isIn01(r)) roots01.push(r); }
      return roots01;
    }
    return undefined;
  }
  public zero(): void { for (let i = 0; i < this.coffs.length; i++) { this.coffs[i] = 0.0; } }
  /** Subdivide -- write results into caller-supplied bezier coffs (which must be of the same order) */
  public subdivide(u: number, left: BezierCoffs, right: BezierCoffs): boolean {
    const order = this.order;
    if (left.order !== order && right.order !== order)
      return false;
    const v = 1.0 - u;
    right.copyFrom(this);
    // each left will be filled in directly, so there is no need to initialize it.
    let n1 = order - 1; // number of interpolations in inner loop.
    for (let i0 = 0; i0 < order; i0++) {
      left.coffs[i0] = right.coffs[0];
      for (let i = 0; i < n1; i++)
        right.coffs[i] = v * right.coffs[i] + u * right.coffs[i + 1];
      n1--;
    }
    return true;
  }
  public static maxAbsDiff(dataA: BezierCoffs, dataB: BezierCoffs): number | undefined {
    const order = dataA.order;
    if (dataB.order !== order)
      return undefined;
    let d = 0.0;
    let d1;
    for (let i = 0; i < order; i++) {
      d1 = Math.abs(dataA.coffs[i] - dataB.coffs[i]);
      if (d1 > d)
        d = d1;
    }
    return d;
  }
}
/**
 * * The Bezier class is an one-dimensional bezier polynomial with no particular order.
 * * More specific classes -- Order2Bezier, Order3Bezier, Order4Bezier -- should be used when a fixed order is known.
 * * When working with xy and xyz curves whose order is the common 2,3,4, various queries (e.g. project point to curve)
 *     generate higher order one-dimensional bezier polynomials with order that is a small multiple of the
 *     curve order.   Hence those polynomials commonly reach degree 8 to 12.
 * * Higher order bezier polynomials are possible, but performance and accuracy issues become significant.
 * * Some machine-level constraints apply for curves of extrmely high order, e.g. 70.   For instance, at that level use of
 *     Pascal triangle coefficients becomes inaccurate because IEEE doubles cannot represent integers that
 *     large.
 */
export class Bezier extends BezierCoffs {
  private _order: number;
  public get order() { return this._order; }
  public constructor(order: number) {
    super(order);
    this._order = order;
  }
  /** Return a copy, optionally with coffs array length reduced to actual order. */
  public clone(compressToMinimalAllocation: boolean = false): Bezier {
    if (compressToMinimalAllocation) {
      const result1 = new Bezier(this.order);
      result1.coffs = this.coffs.slice(0, this.order);
      return result1;
    }
    const result = new Bezier(this.coffs.length);
    result._order = this._order;
    result.coffs = this.coffs.slice();
    return result;
  }
  /** Create a new bezier which is a copy of other.
   * * Note that `other` may be a more specialized class such as `Order2Bezier`, but the result is general `Bezier`
   * @param other coefficients to copy.
   */
  public static create(other: BezierCoffs): Bezier {
    const result = new Bezier(other.order);
    result.coffs = other.coffs.slice();
    return result;
  }
  /**
   * copy coefficients into a new bezier.
   * @param coffs coefficients for bezier
   */
  public static createCoffs(coffs: number[]): Bezier {
    const result = new Bezier(coffs.length);
    for (let i = 0; i < coffs.length; i++)result.coffs[i] = coffs[i];
    return result;
  }
  /**
   * Create a product of 2 bezier polynomials.
   * @param bezierA
   * @param bezierB
   */
  public static createProduct(bezierA: BezierCoffs, bezierB: BezierCoffs): Bezier {
    const result = new Bezier(bezierA.order + bezierB.order - 1);
    const pascalA = PascalCoefficients.getRow(bezierA.order - 1);
    const pascalB = PascalCoefficients.getRow(bezierB.order - 1);
    const pascalC = PascalCoefficients.getRow(bezierA.order + bezierB.order - 2);
    for (let iA = 0; iA < bezierA.order; iA++) {
      const a = bezierA.coffs[iA] * pascalA[iA];
      for (let iB = 0; iB < bezierB.order; iB++) {
        const b = bezierB.coffs[iB] * pascalB[iB];
        const iC = iA + iB;
        const c = pascalC[iC];
        result.coffs[iC] += a * b / c;
      }
    }
    return result;
  }
  private _basisValues?: Float64Array;
  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public basisFunctions(u: number, result?: Float64Array): Float64Array {
    this._basisValues = PascalCoefficients.getBezierBasisValues(this.order, u, this._basisValues);
    if (!result || result.length !== this.order) result = new Float64Array(this.order);
    let i = 0;
    for (const a of this._basisValues) result[i++] = a;
    return result;
  }
  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluate(u: number): number {
    this._basisValues = PascalCoefficients.getBezierBasisValues(this.order, u, this._basisValues);
    let sum = 0;
    for (let i = 0; i < this.order; i++)
      sum += this._basisValues[i] * this.coffs[i];
    return sum;
  }
  /**
   * Apply deflation from the left to a bezier.
   * * This assumes that the left coefficient is zero.
   */
  public deflateLeft() {
    // coefficient 0 is zero (caller promises.)
    // get bezier coffs for both orders ...
    const order1 = this.order;
    const order0 = order1 - 1;
    const coff0 = PascalCoefficients.getRow(order0 - 1);
    const coff1 = PascalCoefficients.getRow(order1 - 1);
    let a;
    for (let i = 0; i < order0; i++) {
      a = this.coffs[i + 1];
      this.coffs[i] = a * coff1[i + 1] / coff0[i];
    }
    this._order--;
  }

  /**
   * Apply deflation from the right to a frame.
   * * This assumes that the right coefficient is zero.
   * @param frame frame description
   */
  public deflateRight() {
    // final coefficient is zero (caller promises.)
    // get bezier coffs for both orders ...
    const order1 = this.order;
    const order0 = order1 - 1;
    const coff0 = PascalCoefficients.getRow(order0 - 1);
    const coff1 = PascalCoefficients.getRow(order1 - 1);
    let a, b;
    for (let i = 0; i < order0; i++) {
      a = this.coffs[i];
      b = a * coff1[i] / coff0[i];
      this.coffs[i] = b;
    }
    this._order--;
  }
  /**
   * divide the polynomial by `(x-root)`.
   * * If `root` is truly a root.
   * @param root root to remove
   */
  public deflateRoot(root: number): number {
    const orderA = this.order;
    const orderC = orderA - 1;  // the order of the deflated bezier.
    if (orderA === 1) {
      this._order = 0;
      return this.coffs[0];
    }
    if (orderA < 1) {
      this._order = 0;
      return 0.0;
    }
    const pascalA = PascalCoefficients.getRow(orderA - 1);
    const pascalC = PascalCoefficients.getRow(orderC - 1);
    const b0 = -root;
    const b1 = 1.0 - root;
    let remainder = 0;
    if (root > 0.5) {
      let c0 = this.coffs[0] / b0;
      let c1;
      this.coffs[0] = c0;
      let a1 = this.coffs[1];
      for (let i = 1; i < orderC; i++) {
        a1 = this.coffs[i] * pascalA[i];
        c1 = (a1 - c0 * b1) / b0;
        this.coffs[i] = c1 / pascalC[i];
        c0 = c1;
      }
      remainder = this.coffs[orderA - 1] - c0 * b1;
    } else {
      // work backwards (to get division by larger of b0, b1)
      // replace coefficients of a starting wtih orderA -1 --
      // at end move them all forward.
      let c1 = this.coffs[orderA - 1] / b1;
      let c0;
      this.coffs[orderA - 1] = c1;
      let a1;
      for (let i = orderA - 2; i > 0; i--) {
        a1 = this.coffs[i] * pascalA[i];
        c0 = (a1 - c1 * b0) / b1;
        this.coffs[i] = c0 / pascalC[i - 1];  // pascalC index is from destination, which is not shifted.
        c1 = c0;
      }
      remainder = (this.coffs[0] - c1 * b0);
      for (let i = 0; i < orderC; i++)
        this.coffs[i] = this.coffs[i + 1];
    }
    this._order = orderC;
    // This should be zero !!!! (If not, `root` was not really a root!!)
    return remainder;
  }
  private static _basisBuffer?: Float64Array;
  private static _basisBuffer1?: Float64Array;
  /**
   * Run a Newton iteration from startFraction.
   * @param startFraction [in] fraction for first iteration
   * @param tolerance [in] convergence tolerance.   The iteration is considered converged on the
   * second time the tolerance is satisfied.   For a typical iteration (not double root), the extra pass
   * will double the number of digits.  Hence this tolerance is normally set to 10 to 12 digits, trusting
   * that the final iteration will clean it up to nearly machine precision.
   * @returns final fraction of iteration if converged.  undefined if iteration failed to converge.
   */
  public runNewton(startFraction: number, tolerance: number = 1.0e-11): number | undefined {
    const derivativeFactor = this.order - 1;
    let numConverged = 0;
    let u = startFraction;
    let f, df;
    const bigStep = 10.0;
    const order = this.order;
    const coffs = this.coffs;
    const orderD = order - 1;
    for (let iterations = 0; iterations++ < 10;) {
      Bezier._basisBuffer = PascalCoefficients.getBezierBasisValues(order, u, Bezier._basisBuffer);
      f = 0; for (let i = 0; i < order; i++) f += coffs[i] * Bezier._basisBuffer[i];
      Bezier._basisBuffer1 = PascalCoefficients.getBezierBasisValues(orderD, u, Bezier._basisBuffer1);
      df = 0; for (let i = 0; i < orderD; i++) df += (coffs[i + 1] - coffs[i]) * Bezier._basisBuffer1[i];
      df *= derivativeFactor;
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

  // Deflation table.  b0, b1 are coefficients of term being divided out
  // Pascal coffs for b0,b1 are just 1.
  // Each ai is a coefficient of the (known) input, with its Pascal coefficient blended in.
  // each ci is a coefficient of the (unknown) result, with its coefficient blended in.
  // note b0, b1 are both nonzero, so the divisions are safe.
  // within the products, each c[i]*b0 pairs with c[i-1]*b1 (above and right diagonally) to make a[i]
  // first and last c0*b0 and c[orderC-1]*b1 make a0 and a[orderA-1]
  // |    |  b0    | b1      |   equivalence               | solve moving down
  // | c0 | c0* b0 | c0 * b1 |    a0 = c0 * b0             | c0 = a0 / b0
  // | c1 | c1* b0 | c1 * b1 |    a1 = c1 * b0 + c0 * b1   | c1 = (a1 - c0 * b1) / b0
  // | c2 | c2* b0 | c2 * b1
  // Each internal ci = (ai - c[i-1] * b1) /b0
  // first c0*b0 = a0
  // last c[orderC-1]*b1 = a[orderA-1]
  public static deflateRoots01(bezier: Bezier): number[] | undefined {
    const roots = [];
    const coffs = bezier.coffs;
    let a0, a1, segmentFraction, globalStartFraction, newtonFraction;
    while (bezier.order > 1) {
      const order = bezier.order;
      // Find any crossing
      if (coffs[0] === 0.0) {
        bezier.deflateLeft();
        roots.push(0.0);
        continue;
      }
      let numCrossing = 0;
      let numNewtonOK = 0;
      for (let i = 1; i < order; i++) {
        a0 = coffs[i - 1];
        a1 = coffs[i];
        if (a0 * a1 <= 0.0) {
          numCrossing++;
          segmentFraction = -a0 / (a1 - a0);
          globalStartFraction = (i - 1 + segmentFraction) / (order - 1);
          newtonFraction = bezier.runNewton(globalStartFraction, 1.0e-10);
          if (newtonFraction !== undefined) {
            roots.push(newtonFraction);
            bezier.deflateRoot(newtonFraction);
            numNewtonOK++;
            break;
          }
        }
      }
      if (numNewtonOK)
        continue;
      // if any crossing was found and led to a good newton, the "continue" jumped past this.
      // if no crossings found, there are no roots to be had -- accept
      if (numCrossing === 0)
        return roots;
      // reach here if there were crossings but not roots.
      // is this just a local min?  or maybe a big problem?   Whatever, accept it
      return roots;
    }
    return roots;
  }
}
/** Bezier polynomial specialized to order 2 (2 coefficients, straight line function) */
export class Order2Bezier extends BezierCoffs {
  constructor(f0: number = 0.0, f1: number = 0.0) {
    super(2);
    this.coffs[0] = f0;
    this.coffs[1] = f1;
  }
  /** return an Order2Bezier (linear) with the two coefficients from this Order2Bezier */
  public clone(): Order2Bezier {
    return new Order2Bezier(this.coffs[0], this.coffs[1]);
  }

  /** normally, return fractional coordinate where bezier (a0,a1) has a root.
   * but if the fraction would exceed Geometry.largeFractionResult, return undefined.
   */
  public static solveCoffs(a0: number, a1: number): number | undefined {
    return Geometry.conditionalDivideFraction(-a0, (a1 - a0));
  }
  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public basisFunctions(u: number): Float64Array {
    const result = new Float64Array(2);
    result[0] = 1.0 - u;
    result[1] = u;
    return result;
  }
  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluate(u: number): number {
    return (1.0 - u) * this.coffs[0] + u * this.coffs[1];
  }
  // "just like" roots() but never creates an array.
  public solve(rightHandSide: number): number | undefined {
    const df = this.coffs[1] - this.coffs[0];
    return Geometry.conditionalDivideFraction(rightHandSide - this.coffs[0], df);
  }
  /**
   * Concrete implementation of the abstract roots method
   * @param targetValue target function value.
   * @param restrictTo01 flag for optional second step to eliminate root outside 0..1.
   * @returns If no roots, return undefined.  If single root, return an array with the root.
   */
  public roots(targetValue: number, restrictTo01: boolean): number[] | undefined {
    const x = this.solve(targetValue);
    if (x === undefined)
      return undefined;
    if (!restrictTo01 || Geometry.isIn01(x))
      return [x];
    return undefined;
  }
}

/** Bezier polynomial specialized to order 3 (3 coefficients, paraboloa  function) */
export class Order3Bezier extends BezierCoffs {
  public constructor(f0: number = 0, f1: number = 0, f2: number = 0) {
    super(3);
    this.coffs[0] = f0;
    this.coffs[1] = f1;
    this.coffs[2] = f2;
  }
  public clone(): Order3Bezier {
    return new Order3Bezier(this.coffs[0], this.coffs[1], this.coffs[2]);
  }

  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public basisFunctions(u: number): Float64Array {
    const v = 1.0 - u;
    const result = new Float64Array(3);
    result[0] = v * v;
    result[1] = 2.0 * u * v;
    result[2] = u * u;
    return result;
  }
  /**
   * Add the square of a linear bezier.
   * @param f0 linear factor value at u=0.
   * @param f1 linear factor value at u=1.
   * @param a  scale factor.
   */
  public addSquareLinear(f0: number, f1: number, a: number) {
    this.coffs[0] += a * f0 * f0;
    this.coffs[1] += a * f0 * f1;
    this.coffs[2] += a * f1 * f1;
  }
  public roots(targetValue: number, restrictTo01: boolean): number[] | undefined {
    const a0 = this.coffs[0] - targetValue;
    const a1 = this.coffs[1] - targetValue;
    const a2 = this.coffs[2] - targetValue;
    const a01 = a1 - a0;
    const a12 = a2 - a1;
    const a012 = a12 - a01;
    const roots = Degree2PowerPolynomial.solveQuadratic(a012, 2.0 * a01, a0);
    return super.filter01(roots, restrictTo01);
  }
  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluate(u: number): number {
    const v = 1.0 - u;
    return this.coffs[0] * v * v + u * (2.0 * this.coffs[1] * v + this.coffs[2] * u);
  }
}

/** Bezier polynomial specialized to order 4 (4 coefficients, cubic  function) */
export class Order4Bezier extends BezierCoffs {
  public constructor(f0: number = 0, f1: number = 0, f2: number = 0, f3: number = 0) {
    super(4);
    this.coffs[0] = f0;
    this.coffs[1] = f1;
    this.coffs[2] = f2;
    this.coffs[3] = f3;
  }

  public clone(): Order4Bezier {
    return new Order4Bezier(this.coffs[0], this.coffs[1], this.coffs[2], this.coffs[3]);
  }
  public static createProductOrder3Order2(factorA: Order3Bezier, factorB: Order2Bezier): Order4Bezier {
    return new Order4Bezier(
      factorA.coffs[0] * factorB.coffs[0],
      (factorA.coffs[0] * factorB.coffs[1] + 2.0 * factorA.coffs[1] * factorB.coffs[0]) / 3.0,
      (2.0 * factorA.coffs[1] * factorB.coffs[1] + factorA.coffs[2] * factorB.coffs[0]) / 3.0,
      factorA.coffs[2] * factorB.coffs[1]);
  }
  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public basisFunctions(u: number): Float64Array {
    const v = 1.0 - u;
    const uu = u * u;
    const vv = v * v;
    const result = new Float64Array(4);
    result[0] = vv * v;
    result[1] = 3.0 * vv * u;
    result[2] = 3.0 * v * uu;
    result[3] = u * uu;
    return result;
  }
  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluate(u: number): number {
    const v1 = 1.0 - u;
    const v2 = v1 * v1;
    const v3 = v2 * v1;
    return this.coffs[0] * v3
      + u * (3.0 * this.coffs[1] * v2
        + u * (3.0 * this.coffs[2] * v1
          + u * this.coffs[3]));
  }
  /**
   * convert a power polynomial to bezier
   */
  public static createFromDegree3PowerPolynomial(source: Degree3PowerPolynomial): Order4Bezier {
    const f0 = source.evaluate(0.0);
    const d0 = source.evaluateDerivative(0.0);
    const d1 = source.evaluateDerivative(1.0);
    const f1 = source.evaluate(1.0);
    const a = 3.0;

    return new Order4Bezier(f0, f0 + d0 / a, f1 - d1 / a, f1);
  }
  // Find solutions (u values) of the bezier-form cubic
  // y0 (1-u)^3 + 3 y1 u(1-u)^2 + 3 y2 u^2 (1-u) + y3 u^3= e
  // i.e. y0, y1, y2, y3 are coefficients of bezier-basis polynomial, e is y level whose crossings
  // are needed.
  //
  public realRoots(e: number, restrictTo01: boolean, roots: GrowableFloat64Array) {
    // Get direct solutions in standard basis
    roots.clear();
    const cc = new Float64Array(4);
    const y0 = this.coffs[0];
    const y1 = this.coffs[1];
    const y2 = this.coffs[2];
    const y3 = this.coffs[3];
    const yMax = Math.max(y0, y1, y2, y3);
    const yMin = Math.min(y0, y1, y2, y3);
    const smallValue = Geometry.smallMetricDistance;
    if (yMin > smallValue)
      return undefined;
    if (yMax < -smallValue)
      return undefined;

    if (yMin >= -smallValue && yMax < smallValue) {
      // all 4 are near zero . ..
      roots.push(0);
      roots.push(1.0 / 3.0);
      roots.push(2.0 / 3.0);
      roots.push(1.0);
      return;  // p(x) == 0 has infinite roots .... return 4, which is a red flag for cubic
    }
    cc[0] = (y0 - e);
    cc[1] = 3.0 * (y1 - y0);
    cc[2] = 3.0 * (y0 - 2.0 * y1 + y2);
    cc[3] = - y0 + 3.0 * y1 - 3.0 * y2 + y3;
    AnalyticRoots.appendCubicRoots(cc, roots);  // can't have zero solutions after passing minmax conditions . . .
    if (restrictTo01)
      roots.reassign(0, 1);
    return;
  }

}
/** Bezier polynomial specialized to order 5 (5 coefficients, quartic  function) */
export class Order5Bezier extends BezierCoffs {
  constructor(f0: number = 0, f1: number = 0, f2: number = 0, f3: number = 0, f4: number = 0) {
    super(5);
    this.coffs[0] = f0;
    this.coffs[1] = f1;
    this.coffs[2] = f2;
    this.coffs[3] = f3;
    this.coffs[4] = f4;
  }
  /**
   * @returns Return a clone of this bezier.
   */
  public clone(): Order5Bezier {
    return new Order5Bezier(this.coffs[0], this.coffs[1], this.coffs[2], this.coffs[3], this.coffs[4]);
  }
  /**
   * convert a power polynomial to bezier
   */
  public static createFromDegree4PowerPolynomial(source: Degree4PowerPolynomial): Order5Bezier {
    const f0 = source.evaluate(0.0);
    const d0 = source.evaluateDerivative(0.0);
    const d4 = source.evaluateDerivative(1.0);
    const f4 = source.evaluate(1.0);
    const a = 0.25;
    const d0a = a * d0;
    const fa = f0 + d0a;
    const fm = 2.0 * fa - f0 + source.coffs[2] / 6.0;
    return new Order5Bezier(f0, fa, fm, f4 - d4 * a, f4);
  }

  /** evaluate the basis fucntions at specified u.
   * @param u bezier parameter for evaluation.
   * @returns Return a (newly allocated) array of basis function values.
   */
  public basisFunctions(u: number): Float64Array {
    const v = 1.0 - u;
    const uu = u * u;
    const uuu = uu * u;
    const vv = v * v;
    const vvv = vv * v;
    const result = new Float64Array(5);
    result[0] = vv * vv;
    result[1] = 4.0 * vvv * u;
    result[2] = 6.0 * vv * uu;
    result[3] = 4.0 * v * uuu;
    result[4] = uu * uu;
    return result;
  }
  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluate(u: number): number {
    const v1 = 1.0 - u;
    const v2 = v1 * v1;
    const v3 = v2 * v1;
    const v4 = v2 * v2;
    return this.coffs[0] * v4
      + u * (4.0 * this.coffs[1] * v3
        + u * (6.0 * this.coffs[2] * v2
          + u * (4.0 * this.coffs[3] * v1
            + u * this.coffs[4])));
  }
  public addProduct(f: Order3Bezier, g: Order3Bezier, a: number) {
    this.coffs[0] += a * f.coffs[0] * g.coffs[0];
    this.coffs[1] += a * (f.coffs[0] * g.coffs[1] + f.coffs[1] * g.coffs[0]) * 0.5;
    this.coffs[2] += a * (f.coffs[0] * g.coffs[2] + 4.0 * f.coffs[1] * g.coffs[1] + f.coffs[2] * g.coffs[0]) / 6.0;
    this.coffs[3] += a * (f.coffs[1] * g.coffs[2] + f.coffs[2] * g.coffs[1]) * 0.5;
    this.coffs[4] += a * f.coffs[2] * g.coffs[2];
  }
  public addConstant(a: number): void {
    for (let i = 0; i < 5; i++) this.coffs[i] += a;
  }
  // Find solutions (u values) of the bezier-form quartic
  // y0 (1-u)u^4 + etc = e
  //
  public realRoots(e: number, restrictTo01: boolean, roots: GrowableFloat64Array): void {
    roots.clear();
    const y0 = this.coffs[0] - e;
    const y1 = this.coffs[1] - e;
    const y2 = this.coffs[2] - e;
    const y3 = this.coffs[3] - e;
    const y4 = this.coffs[4] - e;
    // Get direct solutions in standard basis
    const yMax = Math.max(y0, y1, y2, y3, y4);
    const yMin = Math.min(y0, y1, y2, y3, y4);
    const smallValue = Geometry.smallMetricDistance;
    if (yMin > smallValue)
      return undefined;
    if (yMax < -smallValue)
      return undefined;

    if (yMin >= -smallValue && yMax < smallValue) {
      // all 4 are near zero . ..
      roots.push(0);
      roots.push(0.25);
      roots.push(0.5);
      roots.push(0.75);
      roots.push(1.0);
      return; // p(x) == 0 has infinite roots .... return 5, which is a red flag for cubic ...
    }

    const cc = new Float64Array(5);

    cc[0] = (y0 - e);
    cc[1] = 4.0 * (-y0 + y1);
    cc[2] = 6.0 * (y0 - 2.0 * y1 + y2);
    cc[3] = 4.0 * (-y0 + 3.0 * y1 - 3.0 * y2 + y3);
    cc[4] = (y0 - 4.0 * y1 + 6.0 * y2 - 4.0 * y3 + y4);

    AnalyticRoots.appendQuarticRoots(cc, roots);
    if (restrictTo01)
      roots.reassign(0, 1);
    return;
  }
}
