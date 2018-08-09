/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";
import { KnotVector } from "./KnotVector";
import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "../PointHelpers";
/** Bspline knots and poles for 1d-to-Nd. */
class BSpline1dNd {
  public knots: KnotVector;
  public coffs: Float64Array;
  public poleLength: number;
  public get degree(): number { return this.knots.degree; }
  public get order(): number { return this.knots.degree + 1; }
  public get numSpan(): number { return this.numPoles - this.knots.degree; }
  public get numPoles(): number { return this.coffs.length / this.poleLength; }
  public getPoint3dPole(i: number, result?: Point3d): Point3d | undefined { return Point3d.createFromPacked(this.coffs, i, result); }

  public basisBuffer: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  public basisBuffer1: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public basisBuffer2: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer1: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer2: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE

  /**
   * initialize arrays for given spline dimensions.
   * @param numPoles number of poles
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted, 3 for 2d weigthed)
   * @param order number of poles in support for a section of the bspline
   */
  protected constructor(numPoles: number, poleLength: number, order: number, knots: KnotVector) {
    this.knots = knots;
    this.coffs = new Float64Array(numPoles * poleLength);
    this.poleLength = poleLength;
    this.basisBuffer = new Float64Array(order);
    this.poleBuffer = new Float64Array(poleLength);
    this.basisBuffer1 = new Float64Array(order);
    this.basisBuffer2 = new Float64Array(order);
    this.poleBuffer1 = new Float64Array(poleLength);
    this.poleBuffer2 = new Float64Array(poleLength);
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform) {
    const buffer = this.poleBuffer;
    const n = buffer.length - 2;
    if (transform) {
      for (let i0 = 0; i0 < n; i0 += 3)
        rangeToExtend.extendTransformedXYZ(transform, buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    } else {
      for (let i0 = 0; i0 < n; i0 += 3)
        rangeToExtend.extendXYZ(buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    }
  }

  public static create(numPoles: number, poleLength: number, order: number, knots: KnotVector): BSpline1dNd | undefined {
    return new BSpline1dNd(numPoles, poleLength, order, knots);
  }
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this.knots.spanFractionToKnot(span, localFraction);
  }

  // ASSUME f is sized for {order} basis funtions !!!
  public evaluateBasisFunctionsInSpan(spanIndex: number, spanFraction: number, f: Float64Array, df?: Float64Array, ddf?: Float64Array) {
    if (spanIndex < 0) spanIndex = 0;
    if (spanIndex >= this.numSpan) spanIndex = this.numSpan - 1;
    const knotIndex0 = spanIndex + this.degree - 1;
    const globalKnot = this.knots.baseKnotFractionToKnot(knotIndex0, spanFraction);
    return df ?
      this.knots.evaluateBasisFunctions1(knotIndex0, globalKnot, f, df, ddf) :
      this.knots.evaluateBasisFunctions(knotIndex0, globalKnot, f);
  }
  public evaluateBuffersInSpan(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer);
    this.sumPoleBufferForSpan(spanIndex);
  }
  public evaluateBuffersInSpan1(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer, this.basisBuffer1);
    this.sumPoleBufferForSpan(spanIndex);
    this.sumPoleBuffer1ForSpan(spanIndex);
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBufferForSpan(spanIndex: number) {
    this.poleBuffer.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer) {
      for (let j = 0; j < this.poleLength; j++) { this.poleBuffer[j] += f * this.coffs[k++]; }
    }
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBuffer1ForSpan(spanIndex: number) {
    this.poleBuffer1.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer1) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer1[j] += f * this.coffs[k++];
      }
    }
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBuffer2ForSpan(spanIndex: number) {
    this.poleBuffer2.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer2) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer2[j] += f * this.coffs[k++];
      }
    }
  }
  public evaluateBuffersAtKnot(u: number, numDerivative: number = 0) {
    const knotIndex0 = this.knots.knotToLeftKnotIndex(u);
    if (numDerivative < 1) {
      this.knots.evaluateBasisFunctions(knotIndex0, u, this.basisBuffer);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
    } else if (numDerivative === 1) {
      this.knots.evaluateBasisFunctions1(knotIndex0, u, this.basisBuffer, this.basisBuffer1);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer1ForSpan(knotIndex0 - this.degree + 1);
    } else {
      this.knots.evaluateBasisFunctions1(knotIndex0, u, this.basisBuffer, this.basisBuffer1, this.basisBuffer2);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer1ForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer2ForSpan(knotIndex0 - this.degree + 1);
    }
  }

  public reverseInPlace(): void {
    // reverse poles in blocks ...
    const b = this.poleLength;
    const data = this.coffs;
    for (let i0 = 0, j0 = b * (this.numPoles - 1);
      i0 < j0;
      i0 += b, j0 -= b) {
      let t = 0;
      for (let i = 0; i < b; i++) {
        t = data[i0 + i];
        data[i0 + i] = data[j0 + i];
        data[j0 + i] = t;
      }
    }
    this.knots.reflectKnots();
  }
}

export class BSplineCurve3d extends CurvePrimitive {
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3d; }
  public tryTransformInPlace(transform: Transform): boolean { Point3dArray.multiplyInPlace(transform, this.bcurve.coffs); return true; }
  private bcurve: BSpline1dNd;

  public get degree(): number { return this.bcurve.degree; }
  public get order(): number { return this.bcurve.order; }
  public get numSpan(): number { return this.bcurve.numSpan; }
  public get numPoles(): number { return this.bcurve.numPoles; }
  public getPole(i: number, result?: Point3d): Point3d | undefined { return this.bcurve.getPoint3dPole(i, result); }
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this.bcurve.spanFractionToKnot(span, localFraction);
  }
  private constructor(numPoles: number, order: number, knots: KnotVector) {
    super();
    this.bcurve = BSpline1dNd.create(numPoles, 3, order, knots) as BSpline1dNd;
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPoints(): any[] { return Point3dArray.unpackNumbersToNestedArrays(this.bcurve.coffs, 3); }
  /** Return a simple array of the control points coordinates */
  public copyPointsFloat64Array(): Float64Array { return this.bcurve.coffs.slice(); }
  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(includeExtraEndKnot: boolean): number[] { return this.bcurve.knots.copyKnots(includeExtraEndKnot); }

  /** Create a bspline with uniform knots. */
  public static createUniformKnots(poles: Point3d[], order: number): BSplineCurve3d | undefined {
    const numPoles = poles.length;
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.createUniformClamped(poles.length, order - 1, 0.0, 1.0);
    const curve = new BSplineCurve3d(poles.length, order, knots);
    let i = 0;
    for (const p of poles) { curve.bcurve.coffs[i++] = p.x; curve.bcurve.coffs[i++] = p.y; curve.bcurve.coffs[i++] = p.z; }
    return curve;
  }
  /** Create a bspline with given knots.
   *
   * *  Two count conditions are recognized:
   *
   * ** If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * ** If poleArray.length + order == knotArray.length + 2, the knots are in modern form.
   *
   */
  public static create(poleArray: Float64Array | Point3d[], knotArray: Float64Array | number[], order: number): BSplineCurve3d | undefined {
    let numPoles = poleArray.length;
    if (poleArray instanceof Float64Array) {
      numPoles /= 3;  // blocked as xyz
    }
    const numKnots = knotArray.length;
    // shift knots-of-interest limits for overclampled case ...
    const skipFirstAndLast = (numPoles + order === numKnots);
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.create(knotArray, order - 1, skipFirstAndLast);
    const curve = new BSplineCurve3d(numPoles, order, knots);
    if (poleArray instanceof Float64Array) {
      let i = 0;
      for (const coordinate of poleArray) { curve.bcurve.coffs[i++] = coordinate; }
    } else {
      let i = 0;
      for (const p of poleArray) { curve.bcurve.coffs[i++] = p.x; curve.bcurve.coffs[i++] = p.y; curve.bcurve.coffs[i++] = p.z; }
    }
    return curve;
  }
  public clone(): BSplineCurve3d {
    const knotVector1 = this.bcurve.knots.clone();
    const curve1 = new BSplineCurve3d(this.numPoles, this.order, knotVector1);
    curve1.bcurve.coffs = this.bcurve.coffs.slice();
    return curve1;
  }
  public cloneTransformed(transform: Transform): BSplineCurve3d {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }
  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointInSpan(spanIndex: number, spanFraction: number): Point3d {
    this.bcurve.evaluateBuffersInSpan(spanIndex, spanFraction);
    return Point3d.createFrom(this.bcurve.poleBuffer);
  }
  public evaluatePointAndTangentInSpan(spanIndex: number, spanFraction: number): Ray3d {
    this.bcurve.evaluateBuffersInSpan1(spanIndex, spanFraction);
    return Ray3d.createCapture(
      Point3d.createFrom(this.bcurve.poleBuffer),
      Vector3d.createFrom(this.bcurve.poleBuffer1));
  }

  /** Evaluate at a positioni given by a knot value.  */
  public knotToPoint(u: number, result?: Point3d): Point3d {
    this.bcurve.evaluateBuffersAtKnot(u);
    return Point3d.createFrom(this.bcurve.poleBuffer, result);
  }
  /** Evaluate at a positioni given by a knot value.  */
  public knotToPointAndDerivative(u: number, result?: Ray3d): Ray3d {
    this.bcurve.evaluateBuffersAtKnot(u, 1);
    if (!result) return Ray3d.createCapture(
      Point3d.createFrom(this.bcurve.poleBuffer),
      Vector3d.createFrom(this.bcurve.poleBuffer1));
    result.origin.setFrom(this.bcurve.poleBuffer);
    result.direction.setFrom(this.bcurve.poleBuffer1);
    return result;
  }

  /** Evaluate at a position given by a knot value.  Return point with 2 derivatives. */
  public knotToPointAnd2Derivatives(u: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this.bcurve.evaluateBuffersAtKnot(u, 2);
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      this.bcurve.poleBuffer[0], this.bcurve.poleBuffer[1], this.bcurve.poleBuffer[2],
      this.bcurve.poleBuffer1[0], this.bcurve.poleBuffer1[1], this.bcurve.poleBuffer1[2],
      this.bcurve.poleBuffer2[0], this.bcurve.poleBuffer2[1], this.bcurve.poleBuffer2[2], result);
  }

  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return this.knotToPoint(this.bcurve.knots.fractionToKnot(fraction), result);
  }

  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    const knot = this.bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAndDerivative(knot, result);
    result.direction.scaleInPlace(this.bcurve.knots.knotLength01);
    return result;
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the arc
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const knot = this.bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAnd2Derivatives(knot, result);
    const a = this.bcurve.knots.knotLength01;
    result.vectorU.scaleInPlace(a);
    result.vectorV.scaleInPlace(a * a);
    return result;
  }

  public isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineCurve3d) {
      return this.bcurve.knots.isAlmostEqual(other.bcurve.knots)
        && Point3dArray.isAlmostEqual(this.bcurve.coffs, other.bcurve.coffs);
    }
    return false;
  }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point3dArray.isCloseToPlane(this.bcurve.coffs, plane);
  }
  public startPoint(): Point3d { return this.evaluatePointInSpan(0, 0.0); }
  public endPoint(): Point3d { return this.evaluatePointInSpan(this.numSpan - 1, 1.0); }
  public reverseInPlace(): void { this.bcurve.reverseInPlace(); }
  public quickLength(): number { return Point3dArray.sumLengths(this.bcurve.coffs); }
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numSpan = this.numSpan;
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      handler.announceIntervalForUniformStepStrokes(this, numPerSpan,
        this.bcurve.knots.spanFractionToFraction(spanIndex, 0.0),
        this.bcurve.knots.spanFractionToFraction(spanIndex, 1.0));
    }
  }

  public emitStrokes(dest: LineString3d, _options?: StrokeOptions): void {
    const numSpan = this.numSpan;
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    const fractionStep = 1.0 / numPerSpan;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      for (let i = 0; i <= numPerSpan; i++) {
        const spanFraction = i * fractionStep;
        const point = this.evaluatePointInSpan(spanIndex, spanFraction);
        dest.appendStrokePoint(point);
      }
    }
  }
  /**
   * return true if the spline is (a) unclamped with (degree-1) matching knot intervals,
   * (b) (degree-1) wrapped points,
   * (c) marked wrappable from construction time.
   */
  public isClosable(): boolean {
    if (!this.bcurve.knots.wrappable)
      return false;
    const degree = this.degree;
    const leftKnotIndex = this.bcurve.knots.leftKnotIndex;
    const rightKnotIndex = this.bcurve.knots.rightKnotIndex;
    const period = this.bcurve.knots.rightKnot - this.bcurve.knots.leftKnot;
    const indexDelta = rightKnotIndex - leftKnotIndex;
    for (let k0 = leftKnotIndex - degree + 1; k0 < leftKnotIndex + degree - 1; k0++) {
      const k1 = k0 + indexDelta;
      if (!Geometry.isSameCoordinate(this.bcurve.knots.knots[k0] + period, this.bcurve.knots.knots[k1]))
        return false;
    }
    const poleIndexDelta = this.numPoles - this.degree;
    for (let p0 = 0; p0 + 1 < degree; p0++) {
      const p1 = p0 + poleIndexDelta;
      if (!Geometry.isSamePoint3d(this.getPole(p0) as Point3d, this.getPole(p1) as Point3d))
        return false;
    }
    return true;
  }
  /**
   * Set the flag indicating the bspline might be suitable for having wrapped "closed" interpretation.
   */
  public setWrappable(value: boolean) {
    this.bcurve.knots.wrappable = value;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineCurve3d(this);
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this.bcurve.extendRange(rangeToExtend, transform);
  }
}
