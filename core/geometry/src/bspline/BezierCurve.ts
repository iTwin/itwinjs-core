/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";

import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { BezierCoffs, UnivariateBezier, BezierPolynomialAlgebra } from "../numerics/BezierPolynomials";
import { KnotVector } from "./KnotVector";
import { BSplineCurve3d } from "./BSplineCurve";
/**
 * Implements a multidimensional bezier curve of fixed order.
 * BezierCurve3d implements with blockSize 3.
 * BezierCurve3dH implements with blockSize 4.
 */
export class Bezier1dNd {
  private _packedData: Float64Array;

  private _order: number;   // bezier order.   probably low
  private _blockSize: number; // expected to be 1 to 4
  private _basis: BezierCoffs;  // server for basis queries.  It carries coefficients that we don't use.
  // constructor CAPTURES the control points array.
  public constructor(blockSize: number, polygon: Float64Array) {
    this._blockSize = blockSize;
    this._order = polygon.length / blockSize;   // This should be an integer!!!
    this._packedData = polygon;
    this._basis = new UnivariateBezier(this._order);
  }
  /** return a clone of the data array */
  public clonePolygon(result?: Float64Array): Float64Array {
    const n = this._packedData.length;
    if (!result || result.length !== n) return this._packedData.slice();
    /** move data into the supplied result */
    for (let i = 0; i < n; i++)
      result[i] = this._packedData[i];
    return result;
  }
  /** Return the bezier order */
  public get order() { return this._order; }
  /** return the packed data array.  This is a REFERENCE to the array. */
  public get packedData() { return this._packedData; }
  /** Create a Bezier1dNd, using the structure of `data[0]` to determine the beizer order. */
  public create(data: Point2d[] | Point3d[] | Point4d[]): Bezier1dNd | undefined {
    if (data.length < 1)
      return undefined;
    if (data[0] instanceof Point3d) {
      const polygon = new Float64Array(data.length * 3);
      let i = 0;
      for (const p of (data as Point3d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
      }
      return new Bezier1dNd(3, polygon);
    } else if (data[0] instanceof Point4d) {
      const polygon = new Float64Array(data.length * 4);
      let i = 0;
      for (const p of (data as Point4d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
        polygon[i++] = p.w;
      }
      return new Bezier1dNd(4, polygon);
    } else if (data[0] instanceof Point2d) {
      const polygon = new Float64Array(data.length * 2);
      let i = 0;
      for (const p of (data as Point2d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
      }
      return new Bezier1dNd(2, polygon);
    }
    return undefined;
  }
  /** Return the curve value at bezier fraction `s`
   * @return buffer of length `blockSize`.
  */
  public evaluate(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctions(s, this._packedData, this._blockSize, buffer);
  }
  /** Return the curve derivative value at bezier fraction `s`
  * @return buffer of length `blockSize`.
  */
  public evaluateDerivative(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctionDerivatives(s, this._packedData, this._blockSize, buffer);
  }

  /** get a single point of the polygon as a simple array.  */
  public getPolygonPoint(i: number, buffer?: Float64Array): Float64Array | undefined {
    if (!buffer) buffer = new Float64Array(this._blockSize);
    if (i >= 0 && i < this._order) {
      const k0 = this._blockSize * i;
      for (let k = 0; k < this._blockSize; k++)
        buffer[k] = this._packedData[k0 + k];
      return buffer;
    }
    return undefined;
  }
  /** set a single point of the polygon as a simple array.  */
  public setPolygonPoint(i: number, buffer: Float64Array) {
    if (i >= 0 && i < this._order) {
      const k0 = this._blockSize * i;
      for (let k = 0; k < this._blockSize; k++)
        this._packedData[k0 + k] = buffer[k];
    }
  }
  /** Load order * dimension doubles from data[dimension * spanIndex] as poles
   * @param data packed source array.  block size in `data` assumed to match dimension for this.
   * @param spanIndex block index in data.
   */
  public loadSpanPoles(data: Float64Array, spanIndex: number) {
    let k = spanIndex * this._blockSize;
    for (let i = 0; i < this._packedData.length; i++)
      this._packedData[i] = data[k++];
  }

  /** Load order * (dataDimension + 1)  doubles from data[dataDimension * spanIndex] as poles with weight inserted
   * @param data packed array of data.
   * @param dataDimension dimension of data. Must have `dataDimension+1=this.order`
   * @param spanIndex index of first data block to access.
   * @param weight weight to append to each block
   */
  public loadSpanPolesWithWeight(data: Float64Array, dataDimension: number, spanIndex: number, weight: number) {
    let destIndex = 0;
    const order = this._order;
    let dataIndex = spanIndex * dataDimension;
    for (let i = 0; i < order; i++) {
      for (let j = 0; j < dataDimension; j++)
        this._packedData[destIndex++] = data[dataIndex++];
      this._packedData[destIndex++] = weight;
    }
  }

  /**  return a json array of arrays with each control point as a lower level array of numbers */
  public unpackToJsonArrays(): any[] {
    return Point3dArray.unpackNumbersToNestedArrays(this._packedData, this.order);
  }
  /** equality test with usual metric tolerances */
  public isAlmostEqual(other: any): boolean {
    if (other instanceof Bezier1dNd) {
      if (this._blockSize !== other._blockSize) return false;
      if (this._order !== other._order) return false;
      if (this._packedData.length !== other._packedData.length) return false;
      for (let i = 0; i < this._packedData.length; i++) {
        if (!Geometry.isSameCoordinate(this._packedData[i], other._packedData[i]))
          return false;
      }
      return true;
    }
    return false;
  }

  /** block-by-block reversal */
  public reverseInPlace() {
    const m = this._blockSize;
    const n = this._order;
    let i, j;
    let a;
    for (i = 0, j = (n - 1) * m; i < j; i += m, j -= m) {
      for (let k = 0; k < m; k++) {
        a = this._packedData[i + k];
        this._packedData[i + k] = this._packedData[j + k];
        this._packedData[j + k] = a;
      }
    }
  }

  //
  /**
   * interpolate at `fraction` between poleA and poleB.
   * @param poleIndexA first pole index
   * @param fraction fractional position
   * @param poleIndexB second pole index
   */
  public interpolatePoleInPlace(poleIndexA: number, fraction: number, poleIndexB: number) {
    let i0 = poleIndexA * this._blockSize;
    let i1 = poleIndexB * this._blockSize;
    const data = this._packedData;
    for (let i = 0; i < this._blockSize; i++ , i0++ , i1++) {
      data[i0] += fraction * (data[i1] - data[i0]);
    }
  }
  /**
   *
   * @param knots
   * @param spanIndex index of span whose (unsaturated) poles are in the bezie.
   * @param optional function for `setInterval (knotA, knotB)` call to announce knot limits.
   */
  public saturateInPlace(knots: KnotVector, spanIndex: number): boolean {
    const degree = knots.degree;
    const kA = spanIndex + degree - 1;   // left knot index of the active span
    const kB = kA + 1;
    if (spanIndex < 0 || spanIndex >= knots.numSpans)
      return false;
    const knotArray = knots.knots;
    const knotA = knotArray[kA];
    const knotB = knotArray[kB];
    this.setInterval(knotA, knotB);

    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      //  left numInsert poles are pulled forward
      let k0 = kA - numInsert;
      if (knotArray[k0] < knotA) {
        let k1 = kB;
        for (let i = 0; i < numInsert; i++ , k0++ , k1++) {
          const knot0 = knotArray[k0];
          const knot1 = knotArray[k1];
          const fraction = (knotA - knot0) / (knot1 - knot0);
          this.interpolatePoleInPlace(i, fraction, i + 1);
        }
      }
    }

    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      let k2 = kB + numInsert;
      if (knotArray[k2] > knotB) {
        for (let i = 0; i < numInsert; i++ , k2--) {
          const knot2 = knotArray[k2];    // right side of moving window
          // left side of window ia always the (previously saturated) knotA
          const fraction = (knotB - knot2) / (knotA - knot2);
          this.interpolatePoleInPlace(degree - i, fraction, degree - i - 1);
        }
      }
    }
    return true;
  }
  /** optional interval for mapping to a parent object */
  public interval?: Segment1d;
  /** create or update the mapping to parent curve. */
  public setInterval(a: number, b: number) {
    this.interval = Segment1d.create(a, b, this.interval);
  }
  /** map a fraction to the parent space. */
  public fractionToParentFraction(fraction: number): number { return this.interval ? this.interval.fractionToPoint(fraction) : fraction; }
}
// ================================================================================================================
// ================================================================================================================
/**
 * Base class for CurvePrimitve (necessarily 3D) with _polygon.
 * * This has a Bezier1dNd polygon as a member, and implements dimension-indendent methods
 * * This exists to support BezeierCurve3d and BezierCurve3dH.
 * * The implementations of "pure 3d" queries is based on calling `getPolePoint3d`.
 * * This has the subtle failure difference that `getPolePoint3d` call with a valid index on on a 3d curve always succeeds, but on 3dH curve fails when weight is zero.
 */
export abstract class BezierCurveBase extends CurvePrimitive {
  protected _polygon: Bezier1dNd;
  /** data blocks accessible by concrete class.   Initialized to correct blockSize in constructor. */
  protected _workData0: Float64Array;
  protected _workData1: Float64Array;
  /**
   * *_workPoint0 and _workPoint1 are conventional 3d points
   * * create by constructor
   * * accessbile by derived classes
   * */
  protected _workPoint0: Point3d;
  protected _workPoint1: Point3d;

  protected constructor(blockSize: number, data: Float64Array) {
    super();
    this._polygon = new Bezier1dNd(blockSize, data);
    this._workPoint0 = Point3d.create();
    this._workPoint1 = Point3d.create();
    this._workData0 = new Float64Array(blockSize);
    this._workData1 = new Float64Array(blockSize);

  }
  /** reverse the poles in place */
  public reverseInPlace(): void { this._polygon.reverseInPlace(); }
  /** saturate the pole in place, using knot intervals from `spanIndex` of the `knotVector` */
  public saturateInPlace(knotVector: KnotVector, spanIndex: number): boolean { return this._polygon.saturateInPlace(knotVector, spanIndex); }
  public get degree(): number { return this._polygon.order - 1; }
  public get order(): number { return this._polygon.order; }
  public get numPoles(): number { return this._polygon.order; }
  /** Get pole `i` as a Point3d.
   * * For 3d curve, this is simple a pole access, and only fails (return `undefined`) for invalid index
   * * For 4d curve, this deweights the homogeneous pole and can fail due to 0 weight.
   */
  public abstract getPolePoint3d(i: number, point?: Point3d): Point3d | undefined;

  /** Get pole `i` as a Point4d.
   * * For 3d curve, this accesses the simple pole and returns with weight 1.
   * * For 4d curve, this accesses the (weighted) pole.
   */
  public abstract getPolePoint4d(i: number, point?: Point4d): Point4d | undefined;

  public setInterval(a: number, b: number) { this._polygon.setInterval(a, b); }
  public fractionToParentFraction(fraction: number): number { return this._polygon.fractionToParentFraction(fraction); }
  /** Return a stroke count appropriate for given stroke options. */
  public abstract strokeCount(options?: StrokeOptions): number;

  /** append stroke points to a linestring, based on `strokeCount` and `fractionToPoint` from derived class*/
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const numPerSpan = this.strokeCount(options);
    const fractionStep = 1.0 / numPerSpan;
    for (let i = 0; i <= numPerSpan; i++) {
      const fraction = i * fractionStep;
      this.fractionToPoint(fraction, this._workPoint0);
      dest.appendStrokePoint(this._workPoint0);
    }
  }
  /** announce intervals with stroke counts */
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numPerSpan = this.strokeCount(_options);
    handler.announceIntervalForUniformStepStrokes(this, numPerSpan, 0.0, 1.0);
  }
  /** return true if all poles are on a plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    let point: Point3d | undefined = this._workPoint0;
    for (let i = 0; ; i++) {
      point = this.getPolePoint3d(i, point);
      if (!point)
        return true;
      if (!plane.isPointInPlane(point))
        return false;
    }
    return false;
  }
  public polygonLength(): number {
    if (!this.getPolePoint3d(0, this._workPoint0))
      return 0.0;
    let i = 0;
    let sum = 0.0;
    while (this.getPolePoint3d(++i, this._workPoint1)) {
      sum += this._workPoint0.distance(this._workPoint1);
      this._workPoint0.setFrom(this._workPoint1);
    }
    return sum;
  }

  public startPoint(): Point3d {
    const result = this.getPolePoint3d(0);
    if (!result) return Point3d.createZero();
    return result;
  }
  public endPoint(): Point3d {
    const result = this.getPolePoint3d(this.order - 1);
    if (!result) return Point3d.createZero();
    return result;
  }

  public quickLength(): number { return this.polygonLength(); }
  /** Extend range by all poles.  */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    let i = 0;
    if (transform) {
      while (this.getPolePoint3d(i++, this._workPoint0)) {
        rangeToExtend.extendTransformedPoint(transform, this._workPoint0);
      }
    } else {
      while (this.getPolePoint3d(i++, this._workPoint0)) {
        rangeToExtend.extend(this._workPoint0);
      }
    }
  }

}

// ================================================================================================================
// ================================================================================================================
/** 3d curve with homogeneous weights. */
export class BezierCurve3dH extends BezierCurveBase {
  public isSameGeometryClass(other: any): boolean { return other instanceof BezierCurve3dH; }
  /**
   * Apply (multiply by) an affine transform
   * @param transform
   */
  public tryTransformInPlace(transform: Transform): boolean {
    const data = this._workData0;
    for (let i = 0; i < this._polygon.order; i++) {
      this._polygon.getPolygonPoint(i, data);
      transform.multiplyXYZWToFloat64Array(data[0], data[1], data[2], data[3], data);
      this._polygon.setPolygonPoint(i, data);
    }
    return true;
  }
  /**
     * Apply (multiply by) a perspective transform
     * @param matrix
     */
  public tryMultiplyMatrix4dInPlace(matrix: Matrix4d) {
    matrix.multiplyBlockedFloat64ArrayInPlace(this._polygon.packedData);
  }

  private _workRay0: Ray3d;
  private _workRay1: Ray3d;
  /** Return a specific pole as a full `[x,y,z,x] Point4d` */
  public getPolePoint4d(i: number, result?: Point4d): Point4d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData0);
    if (data)
      return Point4d.create(data[0], data[1], data[2], data[3], result);
    return undefined;
  }
  /** Return a specific pole normalized to weight 1
   * */
  public getPolePoint3d(i: number, result?: Point3d): Point3d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData0);
    if (data)
      return Point3d.createFromPackedXYZW(data, 0, result);
    return undefined;
  }
  /**
   * @returns true if all weights are within tolerance of 1.0
   */
  public isUnitWeight(tolerance?: number): boolean {
    if (tolerance === undefined) tolerance = Geometry.smallAngleRadians;
    const aLow = 1.0 - tolerance;
    const aHigh = 1.0 + tolerance;
    const data = this._polygon.packedData;
    const n = data.length;
    let a;
    for (let i = 3; i < n; i += 4) {
      a = data[i];
      if (a < aLow || a > aHigh)
        return false;
    }
    return true;
  }
  /**
   * Capture a polygon as the data for a new `BezierCurve3dH`
   * @param polygon complete packed data and order.
   */
  private constructor(polygon: Float64Array) {
    super(4, polygon);
    this._workRay0 = Ray3d.createXAxis();
    this._workRay1 = Ray3d.createXAxis();
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPointsAsJsonArrays(): any[] { return this._polygon.unpackToJsonArrays(); }

  /** Create a curve with given points.
   * * If input is `Point2d[]`, the points are promoted with `z=0` and `w=1`
   * * If input is `Point3d[]`, the points are promoted with w=1`
   *
   */
  public static create(data: Point3d[] | Point4d[] | Point2d[]): BezierCurve3dH | undefined {
    if (data.length < 1)
      return undefined;
    const polygon = new Float64Array(data.length * 4);
    if (data[0] instanceof Point3d) {
      let i = 0;
      for (const p of (data as Point3d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
        polygon[i++] = 1.0;
      }
      return new BezierCurve3dH(polygon);
    } else if (data[0] instanceof Point4d) {
      let i = 0;
      for (const p of (data as Point4d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
        polygon[i++] = p.w;
      }
      return new BezierCurve3dH(polygon);
    } else if (data[0] instanceof Point2d) {
      let i = 0;
      for (const p of (data as Point2d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = 0.0;
        polygon[i++] = 1.0;
      }
      return new BezierCurve3dH(polygon);
    }
    return undefined;
  }
  /** create a bezier curve of specified order, filled with zeros */
  public static createOrder(order: number): BezierCurve3dH {
    const polygonArray = new Float64Array(order * 4); // and we trust that this is all zeros !!!
    return new BezierCurve3dH(polygonArray);
  }
  /** Load order * 4 doubles from data[3 * spanIndex] as poles (with added weight) */
  public loadSpan3dPolesWithWeight(data: Float64Array, spanIndex: number, weight: number) {
    this._polygon.loadSpanPolesWithWeight(data, 3, spanIndex, weight);
  }
  /** Load order * 4 doubles from data[3 * spanIndex] as poles (with added weight) */
  public loadSpan4dPoles(data: Float64Array, spanIndex: number) {
    this._polygon.loadSpanPoles(data, spanIndex);
  }

  public clone(): BezierCurve3dH {
    return new BezierCurve3dH(this._polygon.clonePolygon());
  }
  /**
   * Return a curve after transform.
   */
  public cloneTransformed(transform: Transform): BezierCurve3dH {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }
  /** Return a (deweighted) point on the curve. If deweight fails, returns 000 */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    this._polygon.evaluate(fraction, this._workData0);
    result = Point3d.createFromPackedXYZW(this._workData0, 0, result);
    return result ? result : Point3d.createZero();
  }
  /** Return a (deweighted) point on the curve. If deweight fails, returns 000 */
  public fractionToPoint4d(fraction: number, result?: Point4d): Point4d {
    this._polygon.evaluate(fraction, this._workData0);
    return Point4d.createFromPackedXYZW(this._workData0, 0, result);
  }

  /** Return the cartesian point and derivative vector. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    this._polygon.evaluate(fraction, this._workData0);
    this._polygon.evaluateDerivative(fraction, this._workData1);
    result = Ray3d.createWeightedDerivative(this._workData0, this._workData1, result);
    if (result)
      return result;
    // Bad. Very Bad.  Return origin and x axis.   Should be undefined, but usual cartesian typs do not allow that
    return Ray3d.createXAxis();
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the arc
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const epsilon = 1.0e-8;
    const a = 1.0 / (2.0 * epsilon);
    if (!result)
      result = Plane3dByOriginAndVectors.createXYPlane();

    const ray = this.fractionToPointAndDerivative(fraction, this._workRay0);
    result.origin.setFrom(ray.origin);
    result.vectorU.setFrom(ray.direction);

    const ray0 = this.fractionToPointAndDerivative(fraction - epsilon, this._workRay0);
    const ray1 = this.fractionToPointAndDerivative(fraction + epsilon, this._workRay1);
    Vector3d.createAdd2Scaled(ray0.direction, -a, ray1.direction, a, result.vectorV);
    return result;
  }

  public isAlmostEqual(other: any): boolean {
    if (other instanceof BezierCurve3dH) {
      return this._polygon.isAlmostEqual(other._polygon);
    }
    return false;
  }

  /**
   * Assess legnth and turn to determine a stroke count.
   * @param options stroke options structure.
   */
  public strokeCount(options?: StrokeOptions): number {
    // ugh.   for pure 3d case, local dx,dy,dz vars worked efficiently.
    // managing the weights is tricky, so just do the easy code with temporary point vars.
    this.getPolePoint3d(0, this._workPoint0);
    this.getPolePoint3d(1, this._workPoint1);
    let numStrokes = 1;
    if (this._workPoint0 && this._workPoint1) {
      let dx0 = this._workPoint1.x - this._workPoint0.x;
      let dy0 = this._workPoint1.y - this._workPoint0.y;
      let dz0 = this._workPoint1.z - this._workPoint0.z;
      let dx1, dy1, dz1;    // first differences of leading edge
      let sweepRadians = 0.0;
      let sumLength = Geometry.hypotenuseXYZ(dx0, dy0, dz0);
      this._workPoint1.setFromPoint3d(this._workPoint0);
      for (let i = 2; this.getPolePoint3d(i, this._workPoint1); i++) {
        dx1 = this._workPoint1.x - this._workPoint0.x;
        dy1 = this._workPoint1.y - this._workPoint0.y;
        dz1 = this._workPoint1.z - this._workPoint0.z;
        sweepRadians += Angle.radiansBetweenVectorsXYZ(dx0, dy0, dz0, dx1, dy1, dz1);
        sumLength += Geometry.hypotenuseXYZ(dx1, dy1, dz1);
        dx0 = dx1; dy0 = dy1; dz0 = dz1;
        this._workPoint0.setFrom(this._workPoint1);
      }
      numStrokes = StrokeOptions.applyAngleTol(options,
        StrokeOptions.applyMaxEdgeLength(options, 1, sumLength), sweepRadians, 0.1);
    }
    return numStrokes;
  }

  public dispatchToGeometryHandler(_handler: GeometryHandler): any {
    // NEEDS WORK  -- GEOMETRY HANDLER DOES NOT DEMAND THIS TYPE !!!
  }
  /**
   * Form dot products of each pole with given coefficients. Return as entries in products array.
   * @param products array of (scalar) dot products
   * @param ax x coefficient
   * @param ay y coefficient
   * @param az z coefficient
   * @param aw w coefficient
   */
  public poleProductsXYZW(products: Float64Array, ax: number, ay: number, az: number, aw: number) {
    const n = this.numPoles;
    const data = this._polygon.packedData;
    for (let i = 0, k = 0; i < n; i++ , k += 4)
      products[i] = ax * data[k] + ay * data[k + 1] + az * data[k + 2] + aw * data[k + 3];
  }
  private _workBezier?: UnivariateBezier;  // available for bezier logic within a method
  private _workCoffsA?: Float64Array;
  private _workCoffsB?: Float64Array;
  /**
   * set up the _workBezier members with specific order.
   * * Try to reuse existing members if their sizes match.
   * * Ignore members corresponding to args that are 0 or negative.
   * @param primaryBezierOrder order of expected bezier
   * @param orderA length of _workCoffsA (simple array)
   * @param orderB length of _workdCoffsB (simple array)
   */
  private allocateAndZeroBezierWorkData(primaryBezierOrder: number, orderA: number, orderB: number) {
    if (primaryBezierOrder > 0) {
      if (this._workBezier !== undefined && this._workBezier.order === primaryBezierOrder) {
        this._workBezier.zero();
      } else
        this._workBezier = new UnivariateBezier(primaryBezierOrder);
    }
    if (orderA > 0) {
      if (this._workCoffsA !== undefined && this._workCoffsA.length === orderA)
        this._workCoffsA.fill(0);
      else
        this._workCoffsA = new Float64Array(orderA);
    }
    if (orderB > 0) {
      if (this._workCoffsB !== undefined && this._workCoffsB.length === orderB)
        this._workCoffsB.fill(0);
      else
        this._workCoffsB = new Float64Array(orderB);
    }
  }
  /** Find the closest point within the bezier span, using true perpendicular test (but no endpoint test)
   * * If closer than previously recorded, update the CurveLocationDetail
   * * This assumes this bezier is saturated.
   * @param spacePoint point being projected
   * @param detail pre-allocated detail to record (evolving) closest point.
   * @returns true if an updated occured, false if either (a) no perpendicular projections or (b) perpendiculars were not closer.
   */
  public updateClosestPointByTruePerpendicular(spacePoint: Point3d, detail: CurveLocationDetail): boolean {
    let numUpdates = 0;
    let roots: number[] | undefined;
    if (this.isUnitWeight()) {
      // unweighted !!!
      const productOrder = 2 * this.order - 2;
      this.allocateAndZeroBezierWorkData(productOrder, 0, 0);
      const bezier = this._workBezier!;

      // closestPoint condition is:
      //   (spacePoint - curvePoint) DOT curveTangent = 0;
      // Each product (x,y,z) of the DOT is the product of two bezier polynonmials
      BezierPolynomialAlgebra.accumulateShiftedComponentTimesComponentDelta(bezier.coffs, this._polygon.packedData, 4, this.order, 0, -spacePoint.x, 0);
      BezierPolynomialAlgebra.accumulateShiftedComponentTimesComponentDelta(bezier.coffs, this._polygon.packedData, 4, this.order, 1, -spacePoint.y, 1);
      BezierPolynomialAlgebra.accumulateShiftedComponentTimesComponentDelta(bezier.coffs, this._polygon.packedData, 4, this.order, 2, -spacePoint.z, 2);
      roots = bezier.roots(0.0, true);
    } else {
      // This bezier has weights.
      // The pure cartesian closest point condition is
      //   (spacePoint - X/w) DOT (X' w - w' X)/ w^2 = 0
      // ignoring denominator and using bezier coefficient differences for the derivative, making the numerator 0 is
      //   (w * spacePoint - X) DOT ( DELTA X * w - DELTA w * X) = 0
      const orderA = this.order;
      const orderB = 2 * this.order - 2;  // products of component and component difference.
      const productOrder = orderA + orderB - 1;

      this.allocateAndZeroBezierWorkData(productOrder, orderA, orderB);
      const bezier = this._workBezier!;
      const workA = this._workCoffsA!;
      const workB = this._workCoffsB!;
      const packedData = this._polygon.packedData;

      for (let i = 0; i < 3; i++) {
        // x representing loop pass:   (w * spacePoint.x - curve.x(s), 1.0) * (curveDelta.x(s) * curve.w(s) - curve.x(s) * curveDelta.w(s))
        // (and p.w is always 1)
        BezierPolynomialAlgebra.scaledComponentSum(workA,
          packedData, 4, orderA,
          3, spacePoint.at(i),    // w * spacePoint.x
          i, -1.0);              // curve.x(s) * 1.0
        BezierPolynomialAlgebra.accumulateShiftedComponentTimesComponentDelta(workB,
          packedData, 4, orderA,
          3, 1.0, i);
        BezierPolynomialAlgebra.accumulateShiftedComponentTimesComponentDelta(workB,
          packedData, 4, orderA,
          i, 1.0, 3);
        BezierPolynomialAlgebra.accumulateProduct(bezier.coffs, workA, workB);
      }
      roots = bezier.roots(0.0, true);
    }
    if (roots) {
      for (const fraction of roots) {
        const xyz = this.fractionToPoint(fraction);
        const a = xyz.distance(spacePoint);
        numUpdates += detail.updateIfCloserCurveFractionPointDistance(this, fraction, xyz, a) ? 1 : 0;
      }
    }
    return numUpdates > 0;
  }

}

// ================================================================================================================
// ================================================================================================================
// ================================================================================================================
// ================================================================================================================
/** 3d curve (unweighted) */
export class BezierCurve3d extends BezierCurveBase {
  public isSameGeometryClass(other: any): boolean { return other instanceof BezierCurve3d; }
  public tryTransformInPlace(transform: Transform): boolean {
    const data = this._workData0;
    for (let i = 0; i < this._polygon.order; i++) {
      this._polygon.getPolygonPoint(i, data);
      transform.multiplyXYZToFloat64Array(data[0], data[1], data[2], data);
      this._polygon.setPolygonPoint(i, data);
    }
    return true;
  }
  private _workRay0: Ray3d;
  private _workRay1: Ray3d;

  /** Return a specific pole as a full `[x,y,z] Point3d` */
  public getPolePoint3d(i: number, result?: Point3d): Point3d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData0);
    if (data)
      return Point3d.create(data[0], data[1], data[2], result);
    return undefined;
  }

  /** Return a specific pole as a full `[w*x,w*y,w*z, w] Point4d` */
  public getPolePoint4d(i: number, result?: Point4d): Point4d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData0);
    if (data)
      return Point4d.create(data[0], data[1], data[2], data[3], result);
    return undefined;
  }

  /**
   * Capture a polygon as the data for a new `BezierCurve3d`
   * @param polygon complete packed data and order.
   */
  private constructor(polygon: Float64Array) {
    super(3, polygon);
    this._workRay0 = Ray3d.createXAxis();
    this._workRay1 = Ray3d.createXAxis();
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPolesAsJsonArray(): any[] { return this._polygon.unpackToJsonArrays(); }

  /** Return poles as a linestring */
  public copyPointsAsLineString(): LineString3d {
    const result = LineString3d.create();
    for (let i = 0; i < this._polygon.order; i++)
      result.addPoint(this.getPolePoint3d(i)!);
    return result;
  }

  /** Create a curve with given points.
   * * If input is `Point2d[]`, the points are promoted with `z=0` and `w=1`
   * * If input is `Point3d[]`, the points are promoted with w=1`
   *
   */
  public static create(data: Point3d[] | Point2d[]): BezierCurve3d | undefined {
    if (data.length < 1)
      return undefined;
    const polygon = new Float64Array(data.length * 3);
    if (data[0] instanceof Point3d) {
      let i = 0;
      for (const p of (data as Point3d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
      }
      return new BezierCurve3d(polygon);
    } else if (data[0] instanceof Point2d) {
      let i = 0;
      for (const p of (data as Point2d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = 0.0;
      }
      return new BezierCurve3d(polygon);
    }
    return undefined;
  }
  /** create a bezier curve of specified order, filled with zeros */
  public static createOrder(order: number): BezierCurve3d {
    const polygonArray = new Float64Array(order * 3); // This is initialized to zeros!!
    return new BezierCurve3d(polygonArray);
  }
  /** Load order * 3 doubles from data[3 * spanIndex] as poles */
  public loadSpanPoles(data: Float64Array, spanIndex: number) {
    this._polygon.loadSpanPoles(data, spanIndex);
  }

  public clone(): BezierCurve3d {
    return new BezierCurve3d(this._polygon.clonePolygon());
  }
  /**
   * Return a curve after transform.
   */
  public cloneTransformed(transform: Transform): BezierCurve3d {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }
  /** Return a (deweighted) point on the curve. If deweight fails, returns 000 */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    this._polygon.evaluate(fraction, this._workData0);
    return Point3d.create(this._workData0[0], this._workData0[1], this._workData0[2], result);
  }

  /** Return the cartesian point and derivative vector. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    this._polygon.evaluate(fraction, this._workData0);
    this._polygon.evaluateDerivative(fraction, this._workData1);
    return Ray3d.createXYZUVW(this._workData0[0], this._workData0[1], this._workData0[2], this._workData1[0], this._workData1[1], this._workData1[2], result);
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the arc
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const epsilon = 1.0e-8;
    const a = 1.0 / (2.0 * epsilon);
    if (!result)
      result = Plane3dByOriginAndVectors.createXYPlane();

    const ray = this.fractionToPointAndDerivative(fraction, this._workRay0);
    result.origin.setFrom(ray.origin);
    result.vectorU.setFrom(ray.direction);

    const ray0 = this.fractionToPointAndDerivative(fraction - epsilon, this._workRay0);
    const ray1 = this.fractionToPointAndDerivative(fraction + epsilon, this._workRay1);
    Vector3d.createAdd2Scaled(ray0.direction, -a, ray1.direction, a, result.vectorV);
    return result;
  }

  public isAlmostEqual(other: any): boolean {
    if (other instanceof BezierCurve3d) {
      return this._polygon.isAlmostEqual(other._polygon);
    }
    return false;
  }

  /**
   * Assess legnth and turn to determine a stroke count.
   * @param options stroke options structure.
   */
  public strokeCount(options?: StrokeOptions): number {

    const data = this._polygon.packedData;
    let dx0 = data[3] - data[0];
    let dy0 = data[4] - data[1];
    let dz0 = data[5] - data[2];
    let dx1, dy1, dz1;    // first differences of leading edge
    // let ex, ey, ez; // second differences.
    let sweepRadians = 0.0;
    let sumLength = Geometry.hypotenuseXYZ(dx0, dy0, dz0);
    const n = data.length;
    for (let i = 6; i + 2 < n; i += 3) {
      dx1 = data[i] - data[i - 3];
      dy1 = data[i + 1] - data[i - 2];
      dz1 = data[i + 2] - data[i - 1];
      //        ex = dx1 - dx0; ey = dy1 - dy0; ez = dz1 - dz0;
      sweepRadians += Angle.radiansBetweenVectorsXYZ(dx0, dy0, dz0, dx1, dy1, dz1);
      sumLength += Geometry.hypotenuseXYZ(dx1, dy1, dz1);
      dx0 = dx1; dy0 = dy1; dz0 = dz1;
    }
    const numPerSpan = StrokeOptions.applyAngleTol(options,
      StrokeOptions.applyMaxEdgeLength(options, 1, sumLength), sweepRadians, 0.2);

    return numPerSpan;
  }

  /**
   * convert to bspline curve and dispatch to handler
   * @param handler handelr to receive strongly typed geometry
   */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {

    const poles3d: Point3d[] = [];
    const order = this.order;
    for (let i = 0; i < order; i++) {
      poles3d.push(this.getPolePoint3d(i)!);
    }
    const bspline = BSplineCurve3d.createUniformKnots(poles3d, this.order);
    if (bspline)
      return bspline.dispatchToGeometryHandler(handler);
    return undefined;
  }
}
