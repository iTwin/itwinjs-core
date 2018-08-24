/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { AxisOrder } from "../Geometry";
import { Point3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, Matrix3d } from "../Transform";
import { Point3dArray, Point4dArray } from "../PointHelpers";
import { Plane3dByOriginAndUnitNormal, Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { KnotVector } from "./KnotVector";
import { Geometry } from "../Geometry";
import { Point4d } from "../numerics/Geometry4d";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { GeometryHandler } from "../GeometryHandler";
/**
 * UVSelect is an integer indicating uDirection (0) or vDirection (1) in a bspline surface parameterization.
 */
export enum UVSelect {
  uDirection = 0,
  VDirection = 1,
}
export enum WeightStyle {
  /** There are no weights. */
  UnWeighted = 0,
  /**
   * * Data is weighted
   * * point with normalized coordinate `[x,y,z]` and weight `w` has weights already multiplied in as `[x*w,y*w,z*w,w]`
   * */
  WeightsAlreadyAppliedToCoordinates = 1,
  /**
   * * Data is weighted
   * * point with normalized coordinate `[x,y,z]` and weight `w` has is `[x,y,z,w]`
   * */
  WeightsSeparateFromCoordinates = 2,
}
/**
 * interface for points returned from getPointGrid, with annotation of physical and weighting dimensions.
 */
export interface PackedPointGrid {
  /**
   * Array of coordinate data.
   * * points[row] is all the data for a grid row.
   * * points[row][j] is the j'th point across the row
   * * points[row][j][k] is numeric value k.
   */
  points: number[][][];
  /**
   * Description of how weights are present in the coordinate data.
  */
  weightStyle?: WeightStyle;
  /**
   * number of cartesian dimensions, e.g. 2 or 3.
   */
  numCartesianDimensions: number;
}
/** Interface for methods supported by both regular (xyz) and weighted (xyzw) bspline surfaces. */
export interface BSplineSurface3dQuery {
  fractionToPoint(uFractioin: number, vFraction: number): Point3d;
  fractionToRigidFrame(uFraction: number, vFraction: number): Transform | undefined;
  knotToPoint(uKnot: number, vKnot: number): Point3d;
  tryTransformInPlace(transform: Transform): boolean;
  clone(): BSplineSurface3dQuery;
  cloneTransformed(transform: Transform): BSplineSurface3dQuery;
  reverseInPlace(select: UVSelect): void;
  isSameGeometryClass(other: any): boolean;
  extendRange(range: Range3d, transform?: Transform): void;
  isAlmostEqual(other: any): boolean;
  isClosable(select: UVSelect): boolean;
  isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean;
  numPolesTotal(): number;
  /**
   * turn a numeric variable into a UVSelect (strict 0 or 1).
   */
  numberToUVSelect(value: number): UVSelect;
  /**
   * Return the degree in in selected direction (0 for u, 1 for v)
   * @param select 0 for u, 1 for v
   */
  degreeUV(select: UVSelect): number;
  /**
   * Return the order in in selected direction (0 for u, 1 for v)
   * @param select 0 for u, 1 for v
   */
  orderUV(select: UVSelect): number;
  /**
   * Return the number of bezier spans in selected direction (0 for u, 1 for v)
   * @param select 0 for u, 1 for v
   */
  numSpanUV(select: UVSelect): number;

  /**
   * Return the number of poles in selected direction (0 for u, 1 for v)
   * @param select 0 for u, 1 for v
   */
  numPolesUV(select: UVSelect): number;

  /**
   * Return the step between adjacent poles in selected direction (0 for u, 1 for v)
   * @param select 0 for u, 1 for v
   */
  poleStepUV(select: UVSelect): number;

  /*
     * evaluate the surface at u and v fractions. Return a (squared, right handed) coordinate frame at that point on the surface.
     * @param fractionU u parameter
     * @param fractionV v parameter
     * @param result undefined if surface derivatives are parallel (or either alone is zero)
     */
  // fractionToRigidFrame(fractionU: number, fractionV: number, result?: Transform): Transform | undefined;
  /**
  * Return control points json arrays.
  * * Each row of points is an an array.
  * * Within the array for each row, each point is an array [x,y,z] or [x,y,z,w].
  * * The PackedPointGrid indicates if weights are present.
  */
  getPointGridJSON(): PackedPointGrid;
}
/** Bspline knots and poles for 2d-to-Nd.
 * * This abstract class in not independently instantiable -- GeometryQuery methods must be implemented by derived classes.
 */
export abstract class BSpline2dNd extends GeometryQuery {
  public knots: KnotVector[];
  public coffs: Float64Array;
  public poleDimension: number;
  private _numPoles: number[];

  public degreeUV(select: UVSelect): number { return this.knots[select].degree; }
  public orderUV(select: UVSelect): number { return this.knots[select].degree + 1; }
  public numSpanUV(select: UVSelect): number { return this._numPoles[select] - this.knots[select].degree; }
  public numPolesTotal(): number { return this.coffs.length / this.poleDimension; }
  public numPolesUV(select: UVSelect): number { return this._numPoles[select]; }
  public poleStepUV(select: UVSelect): number { return select === 0 ? 1 : this._numPoles[0]; }
  public getPoint3dPole(i: number, j: number, result?: Point3d): Point3d | undefined {
    return Point3d.createFromPacked(this.coffs, i + j * this._numPoles[0], result);
  }
  // Get a pole (from i,j indices) as Point3d, assuming data is stored xyzw
  public getPoint3dPoleXYZW(i: number, j: number, result?: Point3d): Point3d | undefined {
    return Point3d.createFromPackedXYZW(this.coffs, i + j * this._numPoles[0], result);
  }
  /**
   * @param value numeric value to convert to strict 0 or 1.
   * @returns Return 0 for 0 input, 1 for any nonzero input.
   */
  public numberToUVSelect(value: number): UVSelect { return value === 0 ? 0 : 1; }
  /** extend a range, treating each block as simple XYZ */
  public extendRangeXYZ(rangeToExtend: Range3d, transform?: Transform) {
    const buffer = this.coffs;
    const pd = this.poleDimension;
    const n = buffer.length + 1 - pd;
    if (transform) {
      for (let i0 = 0; i0 < n; i0 += pd)
        rangeToExtend.extendTransformedXYZ(transform, buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    } else {
      for (let i0 = 0; i0 < n; i0 += pd)
        rangeToExtend.extendXYZ(buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    }
  }

  /** extend a range, treating each block as homogeneous xyzw, with weight at offset 3 */
  public extendRangeXYZH(rangeToExtend: Range3d, transform?: Transform) {
    const buffer = this.coffs;
    const pd = this.poleDimension;
    const n = buffer.length + 1 - pd;
    let w = 0;
    let divW = 0;
    if (transform) {
      for (let i0 = 0; i0 < n; i0 += pd) {
        w = buffer[i0 + 3];
        if (w !== 0.0) {
          divW = 1.0 / w;
          rangeToExtend.extendTransformedXYZ(transform,
            buffer[i0] * divW,
            buffer[i0 + 1] * divW,
            buffer[i0 + 2] * divW);
        }
      }
    } else {
      for (let i0 = 0; i0 < n; i0 += pd) {
        w = buffer[i0 + 3];
        if (w !== 0.0) {
          divW = 1.0 / w;
          rangeToExtend.extendXYZ(
            buffer[i0] * divW,
            buffer[i0 + 1] * divW,
            buffer[i0 + 2] * divW);
        }
      }
    }
  }
  /**
   * abstract declaration for evaluation of (unweighted) 3d point and derivatives.
   * Derived classes must implement to get fractionToRigidFrame support.
   * @param _fractionU u parameter
   * @param _fractionV v parameter
   * @param _result optional result.
   */
  public abstract fractionToPointAndDerivatives(_fractionU: number, _fractionV: number, _result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined;
  /**
     * evaluate the surface at u and v fractions. Return a (squared, right handed) coordinate frame at that point on the surface.
     * @param fractionU u parameter
     * @param fractionV v parameter
     * @param result undefined if surface derivatives are parallel (or either alone is zero)
     */
  public fractionToRigidFrame(fractionU: number, fractionV: number, result?: Transform): Transform | undefined {
    const skewVectors = this.fractionToPointAndDerivatives(fractionU, fractionV);
    if (!skewVectors)
      return undefined;
    const axes = Matrix3d.createColumnsInAxisOrder(AxisOrder.XYZ,
      skewVectors.vectorU, skewVectors.vectorV, undefined);
    const axes1 = Matrix3d.createRigidFromMatrix3d(axes, AxisOrder.XYZ, axes);
    if (axes1)
      result = Transform.createOriginAndMatrix(skewVectors.origin, axes1, result);
    return result;
  }

  protected _basisBufferUV: Float64Array[]; //  basis function buffers for u, v directgions.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  protected _basisBuffer1UV: Float64Array[]; // basis function buffers for u, v directions.   ALLOCATED BY CTOR FOR FREQUENT REUSE

  protected _poleBuffer: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  protected _poleBuffer1UV: Float64Array[]; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE

  /**
   * initialize arrays for given spline dimensions.
   */
  protected constructor(numPolesU: number, numPolesV: number, poleLength: number, knotsU: KnotVector, knotsV: KnotVector) {
    super();
    const orderU = knotsU.degree + 1;
    const orderV = knotsV.degree + 1;
    this.knots = [knotsU, knotsV];
    this.coffs = new Float64Array(numPolesU * numPolesV * poleLength);
    this.poleDimension = poleLength;
    this._basisBufferUV = [new Float64Array(orderU), new Float64Array(orderV)];
    this._basisBuffer1UV = [new Float64Array(orderU), new Float64Array(orderV)];
    this._numPoles = [numPolesU, numPolesV];
    this._poleBuffer = new Float64Array(poleLength);
    this._poleBuffer1UV = [new Float64Array(poleLength), new Float64Array(poleLength)];

  }
  /**
   * Map a position, specified as (uv direction, bezier span, fraction within the bezier), to an overal knot value.
   * @param select selector indicating U or V direction.
   * @param span index of bezier span
   * @param localFraction fractional coordinate within the bezier span
   */
  public spanFractionToKnot(select: UVSelect, span: number, localFraction: number): number {
    return this.knots[select].spanFractionToKnot(span, localFraction);
  }

  // ASSUME f is sized for {order} basis funtions !!!
  public spanFractionsToBasisFunctions(select: UVSelect, spanIndex: number, spanFraction: number, f: Float64Array, df?: Float64Array) {
    spanIndex = Geometry.clampToStartEnd(spanIndex, 0, this.numSpanUV(select));
    const knotIndex0 = spanIndex + this.degreeUV(select) - 1;
    const globalKnot = this.knots[select].baseKnotFractionToKnot(knotIndex0, spanFraction);
    return df ?
      this.knots[select].evaluateBasisFunctions1(knotIndex0, globalKnot, f, df) :
      this.knots[select].evaluateBasisFunctions(knotIndex0, globalKnot, f);
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBufferForSpan(spanIndexU: number, spanIndexV: number) {
    const poleBuffer = this._poleBuffer;
    const coffs = this.coffs;
    poleBuffer.fill(0);
    const m = this.poleDimension;
    const stepV = this.poleDimension * this._numPoles[0];
    let kU = m * spanIndexU + spanIndexV * stepV;
    let g = 0;
    for (const fV of this._basisBufferUV[1]) {
      let k = kU;
      for (const fU of this._basisBufferUV[0]) {
        g = fU * fV;
        for (let j = 0; j < m; j++) {
          poleBuffer[j] += g * coffs[k++];
        }
      }
      kU += stepV;
    }
  }
  /** sum derivatives by the weights in the basisBuffer, using poles for given span */
  public sumpoleBufferDerivativesForSpan(spanIndexU: number, spanIndexV: number) {
    const poleBuffer1U = this._poleBuffer1UV[0];
    const poleBuffer1V = this._poleBuffer1UV[1];
    poleBuffer1U.fill(0);
    poleBuffer1V.fill(0);
    const m = this.poleDimension;
    const stepV = this.poleDimension * this._numPoles[0];
    let kU = m * spanIndexU + spanIndexV * stepV;
    // U partial derivatives ...
    let g = 0;
    for (const fV of this._basisBufferUV[1]) {
      let k = kU;
      for (const fU of this._basisBuffer1UV[0]) {
        g = fU * fV;
        for (let j = 0; j < m; j++) {
          poleBuffer1U[j] += g * this.coffs[k++];
        }
      }
      kU += stepV;
    }

    // V partial derivatives ...
    kU = m * spanIndexU + spanIndexV * stepV;
    for (const fV of this._basisBuffer1UV[1]) {
      let k = kU;
      for (const fU of this._basisBufferUV[0]) {
        g = fU * fV;
        for (let j = 0; j < m; j++) {
          poleBuffer1V[j] += g * this.coffs[k++];
        }
      }
      kU += stepV;
    }
  }

  public evaluateBuffersAtKnot(u: number, v: number, numDerivative: number = 0) {
    const knotIndex0U = this.knots[0].knotToLeftKnotIndex(u);
    const knotIndex0V = this.knots[1].knotToLeftKnotIndex(v);
    const poleIndex0U = knotIndex0U - this.degreeUV(0) + 1;
    const poleIndex0V = knotIndex0V - this.degreeUV(1) + 1;

    if (numDerivative < 1) {
      this.knots[0].evaluateBasisFunctions(knotIndex0U, u, this._basisBufferUV[0]);
      this.knots[1].evaluateBasisFunctions(knotIndex0V, v, this._basisBufferUV[1]);
      this.sumPoleBufferForSpan(poleIndex0U, poleIndex0V);
    } else {
      this.knots[0].evaluateBasisFunctions1(knotIndex0U, u, this._basisBufferUV[0], this._basisBuffer1UV[0]);
      this.knots[1].evaluateBasisFunctions1(knotIndex0V, v, this._basisBufferUV[1], this._basisBuffer1UV[1]);
      this.sumPoleBufferForSpan(poleIndex0U, poleIndex0V);
      this.sumpoleBufferDerivativesForSpan(poleIndex0U, poleIndex0V);
    }
  }
  // Swap numSwap entries in coffs, starting at i0 and i1 (absolute indices -- not blocks)
  private swapBlocks(i0: number, i1: number, numSwap: number) {
    let a: number;
    for (let i = 0; i < numSwap; i++) {
      a = this.coffs[i0 + i];
      this.coffs[i0 + i] = this.coffs[i1 + i];
      this.coffs[i1 + i] = a;
    }
  }
  /**
   * Reverse the parameter direction for either u or v.
   * @param select direction to reverse -- 0 for u, 1 for v.
   */
  public reverseInPlace(select: UVSelect): void {
    const m = this.poleDimension;
    const numU = this.numPolesUV(0);
    const numV = this.numPolesUV(1);
    if (select === 0) {
      // reverse within rows.
      for (let j = 0; j < numV; j++) {
        const rowStart = j * numU * m;
        for (let i0 = 0, i1 = numU - 1; i0 < i1; i0++ , i1--) {
          this.swapBlocks(rowStart + i0 * m, rowStart + i1 * m, m);
        }
      }
    } else {
      // swap full rows ..
      const numPerRow = m * numU;
      for (let i0 = 0, i1 = (numV - 1) * numPerRow;
        i0 < i1;
        i0 += numPerRow, i1 -= numPerRow) {
        this.swapBlocks(i0, i1, numPerRow);
      }
    }
    this.knots[select].reflectKnots();
  }
  /**
   * Set the flag indicating the bspline might be suitable for having wrapped "closed" interpretation.
   */
  public setWrappable(select: UVSelect, value: boolean) {
    this.knots[select].wrappable = value;
  }
}

/**  BSplineSurface3d is a parametric surface in xyz space.
 * * This (BSplineSurface3d) is an unweighted surface.   Use the separate class BSplineSurface3dH for a weighted surface.
 *
 * The various static "create" methods have subtle differences in how grid sizes are conveyed:
 * | Method | control point array | counts |
 * | create | flat array of [x,y,z] | arguments numPolesU, numPolesV |
 * | createGrid | array of array of [x,y,z ] | There are no `numPolesU` or `numPolesV` args. The counts are conveyed by the deep arrays |
 */
export class BSplineSurface3d extends BSpline2dNd implements BSplineSurface3dQuery {
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineSurface3d; }
  public tryTransformInPlace(transform: Transform): boolean { Point3dArray.multiplyInPlace(transform, this.coffs); return true; }

  public getPole(i: number, j: number, result?: Point3d): Point3d | undefined {
    return this.getPoint3dPole(i, j, result);
  }

  private constructor(numPolesU: number, numPolesV: number, knotsU: KnotVector, knotsV: KnotVector) {
    super(numPolesU, numPolesV, 3, knotsU, knotsV);
  }
  /**
   * Return control points json arrays.
   * * if `flatArray===true`, each point appears as an array [x,y,z] in row-major order of a containing array.
   * * if `flatArray===false` each row of points is an an array of [x,y,z] in an array.  Each of these row arrays is in the result array.
   * @param flatArray if true, retur
   */
  public getPointArray(flatArray: boolean = true): any[] {
    if (flatArray)
      return Point3dArray.unpackNumbersToNestedArrays(this.coffs, 3);
    return Point3dArray.unpackNumbersToNestedArraysIJK(this.coffs, 3, this.numPolesUV(0));
  }
  /**
   * Return control points json arrays.
   * * Each row of points is an an array.
   * * Within the array for each row, each point is an array [x,y,z]
   */
  public getPointGridJSON(): PackedPointGrid {
    const result = {
      points: Point3dArray.unpackNumbersToNestedArraysIJK(this.coffs, 3, this.numPolesUV(0)),
      weighStyle: WeightStyle.UnWeighted,
      numCartesianDimensions: 3,
    };
    return result;
  }

  /** Return a simple array of the control points coordinates */
  public copyPointsFloat64Array(): Float64Array { return this.coffs.slice(); }
  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(select: UVSelect, includeExtraEndKnot: boolean): number[] { return this.knots[select].copyKnots(includeExtraEndKnot); }

  /** Create a bspline surface.
   * * This `create` variant takes control points in a "flattened" array, with
   *  points from succeeding U rows packed together in one array.  Use `createGrid` if the points are in
   *  a row-by-row grid structure
   * * knotArrayU and knotArrayV are optional -- uniform knots are implied if they are omited (undefined).
   * *  When knots are given, two knot count conditions are recognized:
   * * + If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * * + If poleArray.length + order == knotArray.length + 2, the knots are in modern form that does not have
   *      the classic unused first and last knot.
   * @param controlPointArray Array of points, ordered along the U direction.
   * @param numPoleU number of poles in each row in the U direction.
   * @param orderU order for the U direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayU knots for the V direction.  See note above about knot counts.
   * @param numPoleV number of poles in each row in the U direction.
   * @param orderV order for the V direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayV knots for the V direction.  See note above about knot counts.
   */
  public static create(controlPointArray: Point3d[] | Float64Array,
    numPolesU: number,
    orderU: number,
    knotArrayU: number[] | Float64Array | undefined,
    numPolesV: number,
    orderV: number,
    knotArrayV: number[] | Float64Array | undefined): BSplineSurface3d | undefined {
    let numPoles = controlPointArray.length;
    if (controlPointArray instanceof Float64Array)
      numPoles /= 3;
    if (numPolesU * numPolesV !== numPoles) return undefined;
    // shift knots-of-interest limits for overclampled case ...
    const numKnotsU = knotArrayU ? knotArrayU.length : numPolesU + orderU - 2;
    const numKnotsV = knotArrayV ? knotArrayV.length : numPolesV + orderV - 2;
    const skipFirstAndLastU = (numPolesU + orderU === numKnotsU);
    const skipFirstAndLastV = (numPolesV + orderV === numKnotsV);
    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const knotsU = knotArrayU ?
      KnotVector.create(knotArrayU, orderU - 1, skipFirstAndLastU) :
      KnotVector.createUniformClamped(numPolesU, orderU - 1, 0.0, 1.0);
    const knotsV = knotArrayV ?
      KnotVector.create(knotArrayV, orderV - 1, skipFirstAndLastV) :
      KnotVector.createUniformClamped(numPolesV, orderV - 1, 0.0, 1.0);

    const surface = new BSplineSurface3d(numPolesU, numPolesV, knotsU, knotsV);
    if (controlPointArray instanceof Float64Array) {
      let i = 0;
      for (const coordinate of controlPointArray) { surface.coffs[i++] = coordinate; }
    } else {
      let i = 0;
      for (const p of controlPointArray) { surface.coffs[i++] = p.x; surface.coffs[i++] = p.y; surface.coffs[i++] = p.z; }
    }
    return surface;
  }

  /** Create a bspline surface.
   * * This `create` variant takes control points in a "grid" array, with the points from
   * each grid row `[rowIndex]` being an independent array `points[rowIndex][indexAlongRow][x,y,z]`
   * * knotArrayU and knotArrayV are optional -- uniform knots are implied if they are omited (undefined).
   * *  When knots are given, two knot count conditions are recognized:
   * * + If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * * + If poleArray.length + order == knotArray.length + 2, the knots are in modern form that does not have
   *      the classic unused first and last knot.
   * @param controlPointArray Array of points, ordered along the U direction.
   * @param numPoleU number of poles in each row in the U direction.
   * @param orderU order for the U direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayU knots for the V direction.  See note above about knot counts.
   * @param numPoleV number of poles in each row in the U direction.
   * @param orderV order for the V direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayV knots for the V direction.  See note above about knot counts.
   */
  public static createGrid(points: number[][][],
    orderU: number,
    knotArrayU: number[] | Float64Array | undefined,
    orderV: number,
    knotArrayV: number[] | Float64Array | undefined): BSplineSurface3d | undefined {
    const numPolesV = points.length;
    const numPolesU = points[0].length;

    // shift knots-of-interest limits for overclampled case ...
    const numKnotsU = knotArrayU ? knotArrayU.length : numPolesU + orderU - 2;
    const numKnotsV = knotArrayV ? knotArrayV.length : numPolesV + orderV - 2;
    const skipFirstAndLastU = (numPolesU + orderU === numKnotsU);
    const skipFirstAndLastV = (numPolesV + orderV === numKnotsV);
    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const knotsU = knotArrayU ?
      KnotVector.create(knotArrayU, orderU - 1, skipFirstAndLastU) :
      KnotVector.createUniformClamped(numPolesU, orderU - 1, 0.0, 1.0);
    const knotsV = knotArrayV ?
      KnotVector.create(knotArrayV, orderV - 1, skipFirstAndLastV) :
      KnotVector.createUniformClamped(numPolesU, orderU - 1, 0.0, 1.0);

    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const surface = new BSplineSurface3d(numPolesU, numPolesV, knotsU, knotsV);
    let i = 0;
    for (const row of points) {
      for (const xyz of row) {
        surface.coffs[i++] = xyz[0];
        surface.coffs[i++] = xyz[1];
        surface.coffs[i++] = xyz[2];
      }
    }
    return surface;
  }
  /**
   * @returns Return a complete copy of the bspline surface.
   */
  public clone(): BSplineSurface3d {
    const knotVector1U = this.knots[0].clone();
    const knotVector1V = this.knots[1].clone();
    const surface1 = new BSplineSurface3d(this.numPolesUV(0), this.numPolesUV(1), knotVector1U, knotVector1V);
    surface1.coffs = this.coffs.slice();
    return surface1;
  }
  /**
   * Return a complete copy of the bspline surface, with a transform applied to the control points.
   * @param transform transform to apply to the control points
   */
  public cloneTransformed(transform: Transform): BSplineSurface3d {
    const surface1 = this.clone();
    surface1.tryTransformInPlace(transform);
    return surface1;
  }

  /** Evaluate at a position given by u and v coordinates in knot space.
   * @param u u value, in knot range.
   * @param v v value in knot range.
 * @returns Return the xyz coordinates on the surface.
   */
  public knotToPoint(u: number, v: number): Point3d {
    this.evaluateBuffersAtKnot(u, v);
    return Point3d.createFrom(this._poleBuffer);
  }
  /** Evaluate at a position given by a knot value.  */
  public knotToPointAndDerivatives(u: number, v: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this.evaluateBuffersAtKnot(u, v, 1);
    return Plane3dByOriginAndVectors.createOriginAndVectorsArrays(
      this._poleBuffer, this._poleBuffer1UV[0], this._poleBuffer1UV[1], result);
  }
  /** Evalute at a position given by fractional coordinte in each direction.
     * @param fractionU u coordinate, as a fraction of the knot range.
     * @param fractionV v coordinate, as a fraction of the knot range.
   * @returns Return the xyz coordinates on the surface.
   */
  public fractionToPoint(fractionU: number, fractionV: number): Point3d {
    return this.knotToPoint(this.knots[0].fractionToKnot(fractionU), this.knots[1].fractionToKnot(fractionV));
  }

  /**
   * evaluate the surface at u and v fractions.
   * @returns plane with origin at the surface point, direction vectors are derivatives in the u and v directions.
   * @param fractionU u coordinate, as a fraction of the knot range.
   * @param fractionV v coordinate, as a fraction of the knot range.
   * @param result optional pre-allocated object for return values.
   * @returns Returns point and derivative directions.
   */
  public fractionToPointAndDerivatives(fractionU: number, fractionV: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const knotU = this.knots[0].fractionToKnot(fractionU);
    const knotV = this.knots[1].fractionToKnot(fractionV);
    return this.knotToPointAndDerivatives(knotU, knotV, result);
  }
  public isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineSurface3d) {
      return this.knots[0].isAlmostEqual(other.knots[0])
        && this.knots[1].isAlmostEqual(other.knots[1])
        && Point3dArray.isAlmostEqual(this.coffs, other.coffs);
    }
    return false;
  }

  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point3dArray.isCloseToPlane(this.coffs, plane);
  }
  /**
   * return true if the spline is (a) unclamped with (degree-1) matching knot intervals,
   * (b) (degree-1) wrapped points,
   * (c) marked wrappable from construction time.
   */
  public isClosable(select: UVSelect): boolean {
    if (!this.knots[select].wrappable)
      return false;
    const degree = this.degreeUV(select);
    const knots = this.knots[select];
    const leftKnotIndex = knots.leftKnotIndex;
    const rightKnotIndex = knots.rightKnotIndex;
    const period = knots.rightKnot - knots.leftKnot;
    const indexDelta = rightKnotIndex - leftKnotIndex;
    for (let k0 = leftKnotIndex - degree + 1; k0 < leftKnotIndex + degree - 1; k0++) {
      const k1 = k0 + indexDelta;
      if (!Geometry.isSameCoordinate(knots.knots[k0] + period, knots.knots[k1]))
        return false;
    }
    const poleIndexDelta = this.numPolesUV(select) - this.degreeUV(select); // index jump between equal wrapped poles.
    const numStringer = select === 0 ? this.numPolesUV(1) : this.numPolesUV(0);
    const i0Step = select === 0 ? 0 : 1;  // to advance stringer
    const j0Step = select === 0 ? 1 : 0;  // to advance stringer
    const iStep = 1 - i0Step; // to advance within stringer
    const jStep = 1 - j0Step; // to advance within stringer
    for (let stringer = 0, i0 = 0, j0 = 0; stringer < numStringer; stringer++ , i0 += i0Step, j0 += j0Step) {
      for (let p0 = 0; p0 < degree; p0++) {
        const p1 = p0 + poleIndexDelta;
        if (!Geometry.isSamePoint3d(
          this.getPole(i0 + p0 * iStep, j0 + p0 * jStep) as Point3d,
          this.getPole(i0 + p1 * iStep, j0 + p1 * jStep) as Point3d))
          return false;
      }
    }
    return true;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineSurface3d(this);
  }
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this.extendRangeXYZ(rangeToExtend, transform);
  }

}

/**  BsplinceCurve in xyzw homogeneous space */
export class BSplineSurface3dH extends BSpline2dNd implements BSplineSurface3dQuery {
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineSurface3dH; }
  public tryTransformInPlace(transform: Transform): boolean {
    Point4dArray.multiplyInPlace(transform, this.coffs); return true;
  }

  public getPole(i: number, j: number, result?: Point3d): Point3d | undefined {
    return this.getPoint3dPoleXYZW(i, j, result);
  }

  private constructor(numPolesU: number, numPolesV: number, knotsU: KnotVector, knotsV: KnotVector) {
    super(numPolesU, numPolesV, 4, knotsU, knotsV);
  }
  /** Return a simple array of the control points. */
  public copyPoints4d(): Point4d[] { return Point4dArray.unpackToPoint4dArray(this.coffs); }

  /** Return a simple array of the control points. */
  public copyPointsAndWeights(points: Point3d[], weights: number[],
    formatter: (x: number, y: number, z: number) => any = Point3d.create) {
    Point4dArray.unpackFloat64ArrayToPointsAndWeights(this.coffs, points, weights,
      formatter);
  }

  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(select: UVSelect, includeExtraEndKnot: boolean): number[] { return this.knots[select].copyKnots(includeExtraEndKnot); }

  /** Create a weighted bspline surface, with control points and weights each organized as flattened array of points continuing from one U row to the next.
   * * This `create` variant takes control points in a "flattened" array, with
   *  points from succeeding U rows packed together in one array.  Use `createGrid` if the points are in
   *  a deeper grid array structure.
   * * knotArrayU and knotArrayV are optional -- uniform knots are implied if they are omited (undefined).
   * *  When knots are given, two knot count conditions are recognized:
   * * * If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * * * If poleArray.length + order == knotArray.length + 2, the knots are in modern form that does not have
   *      the classic unused first and last knot.
   * @param controlPointArray Array of points, ordered along the U direction.
   * @param weightArray array of weights, ordered along the U direction.
   * @param numPoleU number of poles in each row in the U direction.
   * @param orderU order for the U direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayU optional knots for the V direction.  See note above about knot counts.
   * @param numPoleV number of poles in each row in the U direction.
   * @param orderV order for the V direction polynomial (`order` is one more than the `degree`.  "cubic" polynomial is order 4.)
   * @param KnotArrayV optional knots for the V direction.  See note above about knot counts.
   */
  public static create(
    controlPointArray: Point3d[],
    weightArray: number[],
    numPolesU: number,
    orderU: number,
    knotArrayU: number[] | undefined,
    numPolesV: number,
    orderV: number,
    knotArrayV: number[] | undefined): BSplineSurface3dH | undefined {
    const numPoles = controlPointArray.length;
    if (numPolesU * numPolesV !== numPoles) return undefined;

    const numKnotsU = knotArrayU ? knotArrayU.length : numPolesU + orderU - 2;
    const numKnotsV = knotArrayV ? knotArrayV.length : numPolesV + orderV - 2;
    const skipFirstAndLastU = (numPolesU + orderU === numKnotsU);
    const skipFirstAndLastV = (numPolesV + orderV === numKnotsV);
    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const knotsU = knotArrayU ?
      KnotVector.create(knotArrayU, orderU - 1, skipFirstAndLastU) :
      KnotVector.createUniformClamped(numPolesU, orderU - 1, 0.0, 1.0);
    const knotsV = knotArrayV ?
      KnotVector.create(knotArrayV, orderV - 1, skipFirstAndLastV) :
      KnotVector.createUniformClamped(numPolesV, orderV - 1, 0.0, 1.0);

    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const surface = new BSplineSurface3dH(numPolesU, numPolesV, knotsU, knotsV);
    Point4dArray.packPointsAndWeightsToFloat64Array(controlPointArray, weightArray, surface.coffs);
    return surface;
  }

  /** Create a bspline with given knots.
   *
   *   Two count conditions are recognized in each direction:
   *
   * ** If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * ** If poleArray.length + order == knotArray.length + 2, the knots are in modern form.
   *
   */
  public static createGrid(
    xyzwGrid: number[][][],
    weightStyle: WeightStyle,
    orderU: number,
    knotArrayU: number[],
    orderV: number,
    knotArrayV: number[]): BSplineSurface3dH | undefined {
    const numPolesV = xyzwGrid.length;
    const numPolesU = xyzwGrid[0].length;
    // const numPoles = numPolesU * numPolesV;
    // shift knots-of-interest limits for overclampled case ...
    const numKnotsU = knotArrayU.length;
    const numKnotsV = knotArrayV.length;
    const skipFirstAndLastU = (numPolesU + orderU === numKnotsU);
    const skipFirstAndLastV = (numPolesV + orderV === numKnotsV);
    if (orderU < 1 || numPolesU < orderU) return undefined;
    if (orderV < 1 || numPolesV < orderV) return undefined;

    const knotsU = KnotVector.create(knotArrayU, orderU - 1, skipFirstAndLastU);
    const knotsV = KnotVector.create(knotArrayV, orderV - 1, skipFirstAndLastV);

    const surface = new BSplineSurface3dH(numPolesU, numPolesV, knotsU, knotsV);

    if (weightStyle === WeightStyle.WeightsSeparateFromCoordinates) {
      let i = 0;
      for (const row of xyzwGrid) {
        for (const point of row) {
          const w = point[3];
          surface.coffs[i++] = point[0] * w;
          surface.coffs[i++] = point[1] * w;
          surface.coffs[i++] = point[2] * w;
          surface.coffs[i++] = point[3];
        }
      }
    } else {
      // implicit WeightStyle.WeightsAlreadyAppliedToCoordinates
      let i = 0;
      for (const row of xyzwGrid) {
        for (const point of row) {
          surface.coffs[i++] = point[0];
          surface.coffs[i++] = point[1];
          surface.coffs[i++] = point[2];
          surface.coffs[i++] = point[3];
        }
      }
    }
    return surface;
  }

  public clone(): BSplineSurface3dH {
    const knotVector1U = this.knots[0].clone();
    const knotVector1V = this.knots[1].clone();
    const surface1 = new BSplineSurface3dH(this.numPolesUV(0), this.numPolesUV(1), knotVector1U, knotVector1V);
    surface1.coffs = this.coffs.slice();
    return surface1;
  }
  public cloneTransformed(transform: Transform): BSplineSurface3dH {
    const surface1 = this.clone();
    surface1.tryTransformInPlace(transform);
    return surface1;
  }
  /**
    * Return control points json arrays.
    * * Each row of points is an an array.
    * * Within the array for each row, each point is an array [wx,wy,wz,w].
    */
  public getPointGridJSON(): PackedPointGrid {
    const result = {
      points: Point3dArray.unpackNumbersToNestedArraysIJK(this.coffs, 4, this.numPolesUV(0)),
      numCartesianDimensions: 3,
      weightStyle: WeightStyle.WeightsAlreadyAppliedToCoordinates,
    };
    return result;
  }

  /** Evaluate at a position given by a knot value.  */
  public knotToPoint4d(u: number, v: number): Point4d {
    this.evaluateBuffersAtKnot(u, v);
    return Point4d.createFromPackedXYZW(this._poleBuffer, 0);
  }
  /** Evaluate at a position given by a knot value.  */
  public knotToPointAndDerivatives(u: number, v: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this.evaluateBuffersAtKnot(u, v, 1);
    return Plane3dByOriginAndVectors.createOriginAndVectorsWeightedArrays(this._poleBuffer, this._poleBuffer1UV[0], this._poleBuffer1UV[1], result);
  }

  public fractionToPoint4d(fractionU: number, fractionV: number): Point4d {
    return this.knotToPoint4d(this.knots[0].fractionToKnot(fractionU), this.knots[1].fractionToKnot(fractionV));
  }
  /**
   * * evaluate the surface and return the cartesian (weight = 1) point.
   * * if the surface XYZW point has weight0, returns point3d at 000.
   * @param fractionU u direction fraction
   * @param fractionV v direction fraction
   * @param result optional result
   */
  public fractionToPoint(fractionU: number, fractionV: number, result?: Point3d): Point3d {
    const point4d = this.knotToPoint4d(this.knots[0].fractionToKnot(fractionU), this.knots[1].fractionToKnot(fractionV));
    return point4d.realPointDefault000(result);
  }
  /**
 * * evaluate the surface and return the cartesian (weight = 1) point.
 * * if the surface XYZW point has weight0, returns point3d at 000.
 * @param knotU u direction knot
 * @param knotV v direction knot
 * @param result optional result
 */
  public knotToPoint(knotU: number, knotV: number, result?: Point3d): Point3d {
    const point4d = this.knotToPoint4d(knotU, knotV);
    return point4d.realPointDefault000(result);
  }
  /**
   * evaluate the surface at u and v fractions.
   * @returns plane with origin at the surface point, direction vectors are derivatives in the u and v directions.
   * @param fractionU u coordinate, as a fraction of the knot range.
   * @param fractionV v coordinate, as a fraction of the knot range.
   * @param result optional pre-allocated object for return values.
   * @returns Returns point and derivative directions.
   */
  public fractionToPointAndDerivatives(fractionU: number, fractionV: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const knotU = this.knots[0].fractionToKnot(fractionU);
    const knotV = this.knots[1].fractionToKnot(fractionV);
    return this.knotToPointAndDerivatives(knotU, knotV, result);
  }
  public isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineSurface3dH) {
      return this.knots[0].isAlmostEqual(other.knots[0])
        && this.knots[1].isAlmostEqual(other.knots[1])
        && Point4dArray.isAlmostEqual(this.coffs, other.coffs);
    }
    return false;
  }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point4dArray.isCloseToPlane(this.coffs, plane);
  }
  /**
   * return true if the spline is (a) unclamped with (degree-1) matching knot intervals,
   * (b) (degree-1) wrapped points,
   * (c) marked wrappable from construction time.
   */
  public isClosable(select: UVSelect): boolean {
    if (!this.knots[select].wrappable)
      return false;
    const degree = this.degreeUV(select);
    const knots = this.knots[select];
    const leftKnotIndex = knots.leftKnotIndex;
    const rightKnotIndex = knots.rightKnotIndex;
    const period = knots.rightKnot - knots.leftKnot;
    const indexDelta = rightKnotIndex - leftKnotIndex;
    for (let k0 = leftKnotIndex - degree + 1; k0 < leftKnotIndex + degree - 1; k0++) {
      const k1 = k0 + indexDelta;
      if (!Geometry.isSameCoordinate(knots.knots[k0] + period, knots.knots[k1]))
        return false;
    }
    const poleIndexDelta = this.numPolesUV(select) - this.degreeUV(select); // index jump between equal wrapped poles.
    const numStringer = select === 0 ? this.numPolesUV(1) : this.numPolesUV(0);
    const i0Step = select === 0 ? 0 : 1;  // to advance stringer
    const j0Step = select === 0 ? 0 : 1;  // to advance stringer
    const iStep = 1 - i0Step; // to advance within stringer
    const jStep = 1 - j0Step; // to advance within stringer
    for (let stringer = 0, i0 = 0, j0 = 0; stringer < numStringer; stringer++ , i0 += i0Step, j0 += j0Step) {
      for (let p0 = 0; p0 + 1 < degree; p0++) {
        const p1 = p0 + poleIndexDelta;
        if (!Geometry.isSamePoint3d(
          this.getPole(i0 + p0 * iStep, j0 + p0 * jStep) as Point3d,
          this.getPole(i0 + p1 * iStep, j0 + p1 * jStep) as Point3d))
          return false;
      }
    }
    return true;
  }
  /**
   * Pass `this` (strongly typed) to `handler.handleBsplineSurface3dH(this)`.
   * @param handler double dispatch handler.
   */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineSurface3dH(this);
  }
  /**
   * extend a range to include the (optionally transformed) points of this surface
   * @param rangeToExtend range that is updaatd to include this surface range
   * @param transform transform to apply to the surface points
   */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this.extendRangeXYZH(rangeToExtend, transform);
  }
}
