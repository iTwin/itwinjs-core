/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d, Vector3d, Point2d, Segment1d } from "../PointVector";
import { Point4d, Matrix4d } from "../numerics/Geometry4d";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";

import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "../PointHelpers";
import { BezierCoffs, Bezier } from "../numerics/BezierPolynomials";
import { KnotVector } from "./KnotVector";
import { BSplineCurve3d } from "./BSplineCurve";
/**
 * Implements a multidimensional bezier curve of fixed order.
 */
export class Bezier1dNd {
  private _packedData: Float64Array;
  private _order: number;   // bezier order.   probably low
  private _dimension: number; // expected to be 1 to 4
  private _basis: BezierCoffs;  // server for basis queries.  It carries coefficients that we don't use.
  // constructor CAPTURES the control points array.
  public constructor(dimension: number, polygon: Float64Array) {
    this._dimension = dimension;
    this._order = polygon.length / dimension;   // This should be an integer!!!
    this._packedData = polygon;
    this._basis = new Bezier(this._order);
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
  /** Return the curve value at bezier fraction `s` */
  public evaluate(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctions(s, this._packedData, this._dimension, buffer);
  }
  /** Return the curve derivative value at bezier fraction `s` */
  public evaluateDerivative(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctionDerivatives(s, this._packedData, this._dimension, buffer);
  }

  /** get a single point of the polygon as a simple array.  */
  public getPolygonPoint(i: number, buffer?: Float64Array): Float64Array | undefined {
    if (!buffer) buffer = new Float64Array(this._dimension);
    if (i >= 0 && i < this._order) {
      const k0 = this._dimension * i;
      for (let k = 0; k < this._dimension; k++)
        buffer[k] = this._packedData[k0 + k];
      return buffer;
    }
    return undefined;
  }
  /** set a single point of the polygon as a simple array.  */
  public setPolygonPoint(i: number, buffer: Float64Array) {
    if (i >= 0 && i < this._order) {
      const k0 = this._dimension * i;
      for (let k = 0; k < this._dimension; k++)
        this._packedData[k0 + k] = buffer[k];
    }
  }
  /** Load order * dimension doubles from data[dimension * spanIndex] as poles
   * @param data packed source array.  block size in `data` assumed to match dimension for this.
   * @param spanIndex block index in data.
   */
  public loadSpanPoles(data: Float64Array, spanIndex: number) {
    let k = spanIndex * this._dimension;
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
      if (this._dimension !== other._dimension) return false;
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
    const m = this._dimension;
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
    let i0 = poleIndexA * this._dimension;
    let i1 = poleIndexB * this._dimension;
    const data = this._packedData;
    for (let i = 0; i < this._dimension; i++ , i0++ , i1++) {
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
 * This has a Bezier1dNd polygon as a member, and implements dimension-indendent methods
 */
export abstract class BezierCurveBase extends CurvePrimitive {
  protected _polygon: Bezier1dNd;
  protected constructor(dimension: number, data: Float64Array) {
    super();
    this._polygon = new Bezier1dNd(dimension, data);
  }
  /** reverse the poles in place */
  public reverseInPlace(): void { this._polygon.reverseInPlace(); }
  /** saturate the pole in place, using knot intervals from `spanIndex` of the `knotVector` */
  public saturateInPlace(knotVector: KnotVector, spanIndex: number): boolean { return this._polygon.saturateInPlace(knotVector, spanIndex); }
  public get degree(): number { return this._polygon.order - 1; }
  public get order(): number { return this._polygon.order; }
  public get numPoles(): number { return this._polygon.order; }

  public setInterval(a: number, b: number) { this._polygon.setInterval(a, b); }
  public fractionToParentFraction(fraction: number): number { return this._polygon.fractionToParentFraction(fraction); }
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
    const data = this._workData;
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

  private _workData: Float64Array;
  private _workData1: Float64Array;
  private _workPoint: Point3d;
  private _workPoint1: Point3d;
  private _workRay0: Ray3d;
  private _workRay1: Ray3d;
  /** Return a specific pole as a full `[x,y,z,x] Point4d` */
  public getPole(i: number, result?: Point4d): Point4d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData);
    if (data)
      return Point4d.create(data[0], data[1], data[2], data[3], result);
    return undefined;
  }
  /** Return a specific pole normalized to weight 1
   * */
  public getRealPole(i: number, result?: Point3d): Point3d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData);
    if (data)
      return Point3d.createFromPackedXYZW(data, 0, result);
    return undefined;
  }
  /**
   * Capture a polygon as the data for a new `BezierCurve3dH`
   * @param polygon complete packed data and order.
   */
  private constructor(polygon: Float64Array) {
    super(4, polygon);
    this._workData = new Float64Array(4);
    this._workData1 = new Float64Array(4);
    this._workPoint = Point3d.create();
    this._workPoint1 = Point3d.create();
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
  public loadSpan4dPolesWithWeight(data: Float64Array, spanIndex: number) {
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
    this._polygon.evaluate(fraction, this._workData);
    result = Point3d.createFromPackedXYZW(this._workData, 0, result);
    return result ? result : Point3d.createZero();
  }
  /** Return a (deweighted) point on the curve. If deweight fails, returns 000 */
  public fractionToPoint4d(fraction: number, result?: Point4d): Point4d {
    this._polygon.evaluate(fraction, this._workData);
    return Point4d.createFromPackedXYZW(this._workData, 0, result);
  }

  /** Return the cartesian point and derivative vector. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    this._polygon.evaluate(fraction, this._workData);
    this._polygon.evaluateDerivative(fraction, this._workData1);
    result = Ray3d.createWeightedDerivative(this._workData, this._workData1, result);
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
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    let point: Point3d | undefined = this._workPoint;
    for (let i = 0; ; i++) {
      point = this.getRealPole(i, point);
      if (!point)
        return true;
      if (!plane.isPointInPlane(point))
        return false;
    }
    return false;
  }
  public polygonLength(): number {
    if (!this.getRealPole(0, this._workPoint))
      return 0.0;
    let i = 0;
    let sum = 0.0;
    while (this.getRealPole(++i, this._workPoint1)) {
      sum += this._workPoint.distance(this._workPoint1);
      this._workPoint.setFrom(this._workPoint1);
    }
    return sum;
  }

  public startPoint(): Point3d {
    const result = this.getRealPole(0);
    if (!result) return Point3d.createZero();
    return result;
  }
  public endPoint(): Point3d {
    const result = this.getRealPole(this.order - 1);
    if (!result) return Point3d.createZero();
    return result;
  }

  public quickLength(): number { return this.polygonLength(); }
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    handler.announceIntervalForUniformStepStrokes(this, numPerSpan, 0.0, 1.0);
  }

  public emitStrokes(dest: LineString3d, _options?: StrokeOptions): void {
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    const fractionStep = 1.0 / numPerSpan;
    for (let i = 0; i <= numPerSpan; i++) {
      const fraction = i * fractionStep;
      this.fractionToPoint(fraction, this._workPoint);
      dest.appendStrokePoint(this._workPoint);
    }
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    let i = 0;
    if (transform) {
      while (this.getRealPole(i++, this._workPoint)) {
        rangeToExtend.extendTransformedPoint(transform, this._workPoint);
      }
    } else {
      while (this.getRealPole(i++, this._workPoint)) {
        rangeToExtend.extend(this._workPoint);
      }
    }
  }
  public dispatchToGeometryHandler(_handler: GeometryHandler): any {
    // NEEDS WORK
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
}

// ================================================================================================================
// ================================================================================================================
// ================================================================================================================
// ================================================================================================================
/** 3d curve (unweighted) */
export class BezierCurve3d extends BezierCurveBase {
  public isSameGeometryClass(other: any): boolean { return other instanceof BezierCurve3d; }
  public tryTransformInPlace(transform: Transform): boolean {
    const data = this._workData;
    for (let i = 0; i < this._polygon.order; i++) {
      this._polygon.getPolygonPoint(i, data);
      transform.multiplyXYZToFloat64Array(data[0], data[1], data[2], data);
      this._polygon.setPolygonPoint(i, data);
    }
    return true;
  }
  private _workData: Float64Array;
  private _workData1: Float64Array;
  private _workPoint: Point3d;
  private _workPoint1: Point3d;
  private _workRay0: Ray3d;
  private _workRay1: Ray3d;

  /** Return a specific pole as a full `[x,y,z,x] Point3d` */
  public getPole(i: number, result?: Point3d): Point3d | undefined {
    const data = this._polygon.getPolygonPoint(i, this._workData);
    if (data)
      return Point3d.create(data[0], data[1], data[2], result);
    return undefined;
  }
  /**
   * Capture a polygon as the data for a new `BezierCurve3d`
   * @param polygon complete packed data and order.
   */
  private constructor(polygon: Float64Array) {
    super(3, polygon);
    this._workData = new Float64Array(3);
    this._workData1 = new Float64Array(3);
    this._workPoint = Point3d.create();
    this._workPoint1 = Point3d.create();
    this._workRay0 = Ray3d.createXAxis();
    this._workRay1 = Ray3d.createXAxis();
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPolesAsJsonArray(): any[] { return this._polygon.unpackToJsonArrays(); }
  /** Return a simple array of Point3d
  public copyPointsAsPoint3dArrays(): Point3d[] {
    const result = [];
    for (let i = 0; i < this._polygon.order; i++)
      result.push(this.getPole(i)!);
    return result;
  }

  /** Return poles as a linestring */
  public copyPointsAsLineString(): LineString3d {
    const result = LineString3d.create();
    for (let i = 0; i < this._polygon.order; i++)
      result.addPoint(this.getPole(i)!);
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
    this._polygon.evaluate(fraction, this._workData);
    return Point3d.create(this._workData[0], this._workData[1], this._workData[2], result);
  }

  /** Return the cartesian point and derivative vector. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    this._polygon.evaluate(fraction, this._workData);
    this._polygon.evaluateDerivative(fraction, this._workData1);
    return Ray3d.createXYZUVW(this._workData[0], this._workData[1], this._workData[2], this._workData1[0], this._workData1[1], this._workData1[2], result);
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
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    let point: Point3d | undefined = this._workPoint;
    for (let i = 0; ; i++) {
      point = this.getPole(i, point);
      if (!point)
        return true;
      if (!plane.isPointInPlane(point))
        return false;
    }
    return false;
  }
  public polygonLength(): number {
    if (!this.getPole(0, this._workPoint))
      return 0.0;
    let i = 0;
    let sum = 0.0;
    while (this.getPole(++i, this._workPoint1)) {
      sum += this._workPoint.distance(this._workPoint1);
      this._workPoint.setFrom(this._workPoint1);
    }
    return sum;
  }

  public startPoint(): Point3d {
    const result = this.getPole(0);
    if (!result) return Point3d.createZero();
    return result;
  }
  public endPoint(): Point3d {
    const result = this.getPole(this.order - 1);
    if (!result) return Point3d.createZero();
    return result;
  }

  public quickLength(): number { return this.polygonLength(); }
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    handler.announceIntervalForUniformStepStrokes(this, numPerSpan, 0.0, 1.0);
  }

  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    let numPerSpan = 1;
    const order = this.order;
    if (order >= 3) {
      const data = this._polygon.packedData;
      let dx0 = data[3] - data[0];
      let dy0 = data[4] - data[1];
      let dz0 = data[5] - data[2];
      let dx1, dy1, dz1;    // first differences of leading edge
      let ex, ey, ez; // second differences.

      let kMax = 0.0;
      let sumLength = Geometry.hypotenuseXYZ(dx0, dy0, dy0);
      const n = data.length;
      for (let i = 6; i + 2 < n; i++) {
        dx1 = data[i] - data[i - 3];
        dy1 = data[i + 1] - data[i - 2];
        dz1 = data[i + 2] - data[i - 1];
        ex = dx1 - dx0; ey = dy1 - dy0; ez = dz1 - dz0;
        kMax = Math.max(kMax, Geometry.curvatureMagnitude(dx0, dy0, dz0, ex, ey, ez),
          Geometry.curvatureMagnitude(dx1, dy1, dz1, ex, ey, ez));
        sumLength += Geometry.hypotenuseXYZ(dx1, dy1, dz1);
        dx0 = dx1; dy0 = dy1; dz0 = dz1;
      }
      const d = this.degree;
      const factor = d * d; // usual factor applied to derivatives.
      const sweepRadians = (sumLength / factor) * kMax;  // sweep for a circle circumference at highest curvature.
      numPerSpan = StrokeOptions.applyAngleTol(options, 1, sweepRadians, 0.2);
    }
    const fractionStep = 1.0 / numPerSpan;
    for (let i = 0; i <= numPerSpan; i++) {
      const fraction = i * fractionStep;
      this.fractionToPoint(fraction, this._workPoint);
      dest.appendStrokePoint(this._workPoint);
    }
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    let i = 0;
    if (transform) {
      while (this.getPole(i++, this._workPoint)) {
        rangeToExtend.extendTransformedPoint(transform, this._workPoint);
      }
    } else {
      while (this.getPole(i++, this._workPoint)) {
        rangeToExtend.extend(this._workPoint);
      }
    }
  }
  /**
   * convert to bspline curve and dispatch to handler
   * @param handler handelr to receive strongly typed geometry
   */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {

    const poles3d: Point3d[] = [];
    const order = this.order;
    for (let i = 0; i < order; i++) {
      poles3d.push(this.getPole(i)!);
    }
    const bspline = BSplineCurve3d.createUniformKnots(poles3d, this.order);
    if (bspline)
      return bspline.dispatchToGeometryHandler(handler);
    return undefined;
  }
}
