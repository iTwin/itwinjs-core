/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { AxisOrder, Geometry } from "../Geometry";
import { StrokeOptions } from "./StrokeOptions";
import { Order2Bezier } from "../numerics/BezierPolynomials";
import { Point3d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, Matrix3d } from "../Transform";
import { Plane3dByOriginAndUnitNormal, Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { NewtonEvaluatorRtoR, Newton1dUnboundedApproximateDerivative } from "../numerics/Newton";
import { Quadrature } from "../numerics/Quadrature";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";
import { LineString3d } from "./LineString3d";
import { Clipper } from "../clipping/ClipUtils";

/**
 * An enumeration of special conditions being described by a CurveLocationDetail.
 */
export enum CurveIntervalRole {
  /** This point is an isolated point NOT at a primary vertex. */
  isolated = 0,
  /**  This point is an isolated vertex hit */
  isolatedAtVertex = 1,
  /** This is the beginning of an interval */
  intervalStart = 10,
  /** This is an interior point of an interval. */
  intervalInterior = 11,
  /** This is the end of an interval */
  intervalEnd = 12,
}
/** Type for callback function which announces a pair of numbers, such as a fractional interval, along with a containing CurvePrimitive. */
export type AnnounceNumberNumberCurvePrimitive = (a0: number, a1: number, cp: CurvePrimitive) => void;
export type AnnounceNumberNumber = (a0: number, a1: number) => void;
export type AnnounceCurvePrimitive = (cp: CurvePrimitive) => void;

/**
 * CurveLocationDetail carries point and paramter data about a point evaluated on a curve.
 */
export class CurveLocationDetail {
  /** The curve being evaluated */
  public curve?: CurvePrimitive;
  /** The fractional position along the curve */
  public fraction: number;
  /** Deail condition of the role this point has in some context */
  public intervalRole?: CurveIntervalRole;
  /** The point on the curve */
  public point: Point3d;
  /** A vector (e.g. tangent vector) in context */
  public vector: Vector3d;
  /** A context-specific numeric value.  (E.g. a distance) */
  public a: number;
  /** A context-specific addtional point */
  public pointQ: Point3d;  // extra point for use in computations

  public constructor() {
    this.pointQ = Point3d.createZero();
    this.fraction = 0;
    this.point = Point3d.createZero();
    this.vector = Vector3d.unitX();
    this.a = 0.0;
  }
  /** Set the (optional) intervalRole field */
  public setIntervalRole(value: CurveIntervalRole): void {
    this.intervalRole = value;
  }
  /** test if this is an isolated point. This is true if intervalRole is any of (undefined, isolated, isolatedAtVertex) */
  public get isIsolated(): boolean {
    return this.intervalRole === undefined
      || this.intervalRole === CurveIntervalRole.isolated
      || this.intervalRole === CurveIntervalRole.isolatedAtVertex;
  }
  /** @returns Return a complete copy */
  public clone(result?: CurveLocationDetail): CurveLocationDetail {
    if (result === this)
      return result;
    result = result ? result : new CurveLocationDetail();
    result.curve = this.curve;
    result.fraction = this.fraction;
    result.point = this.point;
    result.vector = this.vector;
    result.a = this.a;
    return result;
  }

  // Set the fraction, point, with optional vector and number.
  // (curve is unchanged)
  public setFP(fraction: number, point: Point3d, vector?: Vector3d, a?: number) {
    this.fraction = fraction;
    this.point.setFrom(point);
    if (vector)
      this.vector.setFrom(vector);
    else
      this.vector.set(0, 0, 0);
    this.a = a ? a : 0;
  }

  // Set the fraction, point, and vector
  public setFR(fraction: number, ray: Ray3d, a?: number) {
    this.fraction = fraction;
    this.point.setFrom(ray.origin);
    this.vector.setFrom(ray.direction);
    this.a = a ? a : 0;
  }
  /** Set the CurvePrimitive pointer, leaving all other properties untouched.
   */
  public setCurve(curve: CurvePrimitive) { this.curve = curve; }

  /** record the distance from the CurveLocationDetail's point to the parameter point. */
  public setDistanceTo(point: Point3d) {
    this.a = this.point.distance(point);
  }

  /** create with a CurvePrimitive pointer but no coordinate data.
   */
  public static create(
    curve: CurvePrimitive,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    return result;
  }

  /** create with CurvePrimitive pointer, fraction, and point coordinates.
   */
  public static createCurveFractionPoint(
    curve: CurvePrimitive,
    fraction: number,
    point: Point3d,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point = point.clone();
    result.vector.set(0, 0, 0);
    result.a = 0.0;
    return result;
  }

}
/** A pair of CurveLocationDetail. */
export class CurveLocationDetailPair {
  public detailA: CurveLocationDetail;
  public detailB: CurveLocationDetail;

  public constructor() {
    this.detailA = new CurveLocationDetail();
    this.detailB = new CurveLocationDetail();
  }

  /** Create a curve detail pair using references to two CurveLocationDetails */
  public static createDetailRef(detailA: CurveLocationDetail, detailB: CurveLocationDetail, result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = detailA;
    result.detailB = detailB;
    return result;
  }

  /** Make a deep copy of this CurveLocationDetailPair */
  public clone(result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = this.detailA.clone();
    result.detailB = this.detailB.clone();
    return result;
  }
}

/** Queries to be supported by Curve, Surface, and Solid objects */
export abstract class GeometryQuery {

  /** return the range of the entire (tree) GeometryQuery */
  public range(transform?: Transform, result?: Range3d): Range3d {
    if (result) result.setNull();
    const range = result ? result : Range3d.createNull();
    this.extendRange(range, transform);
    return range;
  }

  /** extend rangeToExtend by the range of this geometry multiplied by the transform */
  public abstract extendRange(rangeToExtend: Range3d, transform?: Transform): void;

  /** Attempt to transform in place.
   *
   * * LineSegment3d, Arc3d, LineString3d, BsplineCurve3d always succeed.
   * * Some geometry types may fail if scaling is non-uniform.
   */
  public abstract tryTransformInPlace(transform: Transform): boolean;

  /** try to move the geometry by dx,dy,dz */
  public tryTranslateInPlace(dx: number, dy: number = 0.0, dz: number = 0.0): boolean {
    return this.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy, dz));
  }
  /** return a transformed clone.
   */
  public abstract cloneTransformed(transform: Transform): GeometryQuery | undefined;
  /** return a clone */
  public abstract clone(): GeometryQuery | undefined;
  /** return GeometryQuery children for recursive queries.
   *
   * * leaf classes do not need to implement.
   */
  public get children(): GeometryQuery[] | undefined { return undefined; }
  /** test if (other instanceof this.Type).  REQUIRED IN ALL CONCRETE CLASSES */
  public abstract isSameGeometryClass(other: GeometryQuery): boolean;
  /** test for exact structure and nearly identical geometry.
   *
   * *  Leaf classes must implement !!!
   * *  base class implementation recurses through children.
   * *  base implementation is complete for classes with children and no properties.
   * *  classes with both children and properties must implement for properties, call super for children.
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (this.isSameGeometryClass(other)) {
      const childrenA = this.children;
      const childrenB = other.children;
      if (childrenA && childrenB) {
        if (childrenA.length !== childrenB.length)
          return false;
        for (let i = 0; i < childrenA.length; i++) {
          if (!childrenA[i].isAlmostEqual(childrenB[i])) return false;
        }
        return true;
      } else if (childrenA || childrenB) {
        return false;   // plainly different .
      } else {
        // both children null. call it equal?   This class should probably have implemented.
        return true;
      }
    }
    return false;
  }

  // Every class provides its own handler for dgnjs writing, querying, etc...
  public abstract dispatchToGeometryHandler(handler: GeometryHandler): any;
}

/**
 * A curve primitive is bounded
 * A curve primitive maps fractions in 0..1 to points in space.
 * As the fraction proceeds from 0 towards 1, the point moves "forward" along the curve.
 * True distance along the curve is not always strictly proportional to fraction.
 * * LineSegment3d always has proportional fraction and distance
 * * an Arc3d which is true circular has proportional fraction and distance
 * *  A LineString3d is not proportional (except for special case of all segments of equal length)
 * * A Spiral3d is proportional
 * * A BsplineCurve3d is only proportional for special cases.
 *
 * For fractions outside 0..1, the curve primitive class may either (a) return the near endpoint or (b) evaluate an extended curve.
 */
export abstract class CurvePrimitive extends GeometryQuery {
  protected constructor() { super(); }
  /** Return the point (x,y,z) on the curve at fractional position.
   * @param fraction fractional position along the geometry.
   * @returns Returns a point on the curve.
   */
  public abstract fractionToPoint(fraction: number, result?: Point3d): Point3d;
  /** Return the point (x,y,z) and derivative on the curve at fractional position.
   *
   * * Note that this derivative is "derivative of xyz with respect to fraction."
   * * this derivative shows the speed of the "fractional point" moving along the curve.
   * * this is not generally a unit vector.  use fractionToPointAndUnitTangent for a unit vector.
   * @param fraction fractional position along the geometry.
   * @returns Returns a ray whose origin is the curve point and direction is the derivative with respect to the fraction.
   */
  public abstract fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d;
  /**
   *
   * @param fraction fractional position on the curve
   * @param result optional receiver for the result.
   * @returns Returns a ray whose origin is the curve point and direction is the unit tangent.
   */
  public fractionToPointAndUnitTangent(fraction: number, result?: Ray3d): Ray3d {
    const ray = this.fractionToPointAndDerivative(fraction, result);
    ray.trySetDirectionMagnitudeInPlace(1.0);
    return ray;
  }
  /** Return a plane with
   *
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to the fraction.
   * * vectorV is the second derivative, i.e.derivative of vectorU.
   */
  public abstract fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined;

  /** Construct a frenet frame:
   * * origin at the point on the curve
   * * x axis is unit vector along the curve (tangent)
   * * y axis is perpendicular and in the plane of the osculating circle.
   * * z axis perpendicular to those.
   */
  public fractionToFrenetFrame(fraction: number, result?: Transform): Transform | undefined {
    const plane = this.fractionToPointAnd2Derivatives(fraction);
    if (!plane) return undefined;
    let axes = Matrix3d.createRigidFromColumns(plane.vectorU, plane.vectorV, AxisOrder.XYZ);
    if (axes)
      return Transform.createRefs(plane.origin, axes, result);
    // 2nd derivative not distinct -- do arbitrary headsup ...
    const perpVector = Matrix3d.createRigidHeadsUpFavorXYPlane(plane.vectorU, plane.vectorV);
    axes = Matrix3d.createRigidFromColumns(plane.vectorU, perpVector, AxisOrder.XYZ);
    if (axes)
      return Transform.createRefs(plane.origin, axes, result);
    return undefined;
  }
  /**
   *
   * * Curve length is always positive.
   * @returns Returns a (high accuracy) length of the curve.
   * @returns Returns the length of the curve.
   */
  public curveLength(): number {
    const context = new CurveLengthContext();
    this.emitStrokableParts(context);
    return context.getSum();
  }
  /**
   * Compute a length which may be an fast approximation to the true length.
   * This is expected to be either (a) exact or (b) larger than the actual length, but by no more than
   * a small multiple, perhaps up to PI/2, but commonly much closer to 1.
   *
   * * An example use of this is for setting a tolerance which is a small multiple of the curve length.
   * * Simple line, circular arc, and transition spiral may return exact length
   * * Ellipse may return circumference of some circle or polygon that encloses the ellipse.
   * * bspline curve may return control polygon length
   * *
   */
  public abstract quickLength(): number;
  /** Search for the curve point that is closest to the spacePoint.
   *
   * * If the space point is exactly on the curve, this is the reverse of fractionToPoint.
   * * Since CurvePrimitive should always have start and end available as candidate points, this method should always succeed
   * @param spacePoint point in space
   * @param extend true to extend the curve (if possible)
   * @returns Returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public closestPoint(spacePoint: Point3d, extend: boolean): CurveLocationDetail | undefined {
    const strokeHandler = new ClosestPointStrokeHandler(spacePoint, extend);
    this.emitStrokableParts(strokeHandler);
    return strokeHandler.claimResult();
  }
  /**
   * Find intervals of this curvePrimitive that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce (optional) function to be called announcing fractional intervals"  ` announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public announceClipIntervals(_clipper: Clipper, _announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    // DEFAULT IMPLEMENTATION -- no interior parts
    return false;
  }

  /** Return (if possible) a curve primitive which is a portion of this curve.
   * @param _fractionA [in] start fraction
   * @param _fractionB [in] end fraction
   */
  public clonePartialCurve(_fractionA: number, _fractionB: number): CurvePrimitive | undefined {
    return undefined;
  }

  /** Reverse the curve's data so that its fractional stroking moves in the opposite direction. */
  public abstract reverseInPlace(): void;
  /**
   * Compute intersections with a plane.
   * The intersections are appended to the result array.
   * The base class implementation emits strokes to an AppendPlaneIntersectionStrokeHandler object, which uses a Newton iteration to get
   * high-accuracy intersection points within strokes.
   * Derived classes should override this default implementation if there are easy analytic solutions.
   * @param plane The plane to be intersected.
   * @param result Array to receive intersections
   * @returns Return the number of CurveLocationDetail's added to the result array.
   */
  public appendPlaneIntersectionPoints(plane: Plane3dByOriginAndUnitNormal, result: CurveLocationDetail[]): number {
    const strokeHandler = new AppendPlaneIntersectionStrokeHandler(plane, result);
    const n0 = result.length;
    this.emitStrokableParts(strokeHandler);
    return result.length - n0;
  }
  /** Ask if the curve is within tolerance of a plane.
   * @returns Returns true if the curve is completely within tolerance of the plane.
   */
  public abstract isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean;
  /** return the start point of the primitive.  The default implementation returns fractionToPoint (0.0) */
  public startPoint(result?: Point3d): Point3d { return this.fractionToPoint(0.0, result); }
  /** @returns return the end point of the primitive. The default implementation returns fractionToPoint(1.0) */
  public endPoint(result?: Point3d): Point3d { return this.fractionToPoint(1.0, result); }
  /** Add strokes to caller-supplied linestring */
  public abstract emitStrokes(dest: LineString3d, options?: StrokeOptions): void;
  /** Ask the curve to announce points and simple subcurve fragments for stroking.
   * See IStrokeHandler for description of the sequence of the method calls.
   */
  public abstract emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void;
}

/** Intermediate class for managing the parentCurve announcements from an IStrokeHandler */
abstract class NewtonRotRStrokeHandler extends NewtonEvaluatorRtoR {
  protected _parentCurvePrimitive: CurvePrimitive | undefined;
  constructor() {
    super();
    this._parentCurvePrimitive = undefined;
  }
  /** retain the parentCurvePrimitive */
  public startParentCurvePrimitive(curve: CurvePrimitive | undefined) { this._parentCurvePrimitive = curve; }
  /** Forget the parentCurvePrimitive */
  public endParentCurvePrimitive(_curve: CurvePrimitive | undefined) { this._parentCurvePrimitive = undefined; }
}

class AppendPlaneIntersectionStrokeHandler extends NewtonRotRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _plane: Plane3dByOriginAndUnitNormal;
  private _intersections: CurveLocationDetail[];
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // private derivativeA: number;   <---- Not currently used
  private _functionB: number = 0;
  private _fractionB: number = 0;
  private _derivativeB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars for use within methods.
  private _ray: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;
  // Return the first defined curve among: this.parentCurvePrimitive, this.curve;
  public effectiveCurve(): CurvePrimitive | undefined {
    if (this._parentCurvePrimitive)
      return this._parentCurvePrimitive;
    return this._curve;
  }
  public get getDerivativeB() { return this._derivativeB; }    // <--- DerivativeB is not currently used anywhere. Provided getter to suppress tslint error

  public constructor(plane: Plane3dByOriginAndUnitNormal, intersections: CurveLocationDetail[]) {
    super();
    this._plane = plane;
    this._intersections = intersections;
    this.startCurvePrimitive(undefined);
    this._ray = Ray3d.createZero();
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
    this._fractionA = 0.0;
    this._numThisCurve = 0;
    this._functionA = 0.0;
    // this.derivativeA = 0.0;
  }
  public endCurvePrimitive() { }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 0; i <= numStrokes; i++) {
      const fraction = Geometry.interpolate(fraction0, i * df, fraction1);
      cp.fractionToPointAndDerivative(fraction, this._ray);
      this.announcePointTangent(this._ray.origin, fraction, this._ray.direction);
    }
  }
  public announceSegmentInterval(
    _cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    const h0 = this._plane.altitude(point0);
    const h1 = this._plane.altitude(point1);
    if (h0 * h1 > 0.0)
      return;
    const fraction01 = Order2Bezier.solveCoffs(h0, h1);
    // let numIntersection = 0;
    if (fraction01 !== undefined) {
      // numIntersection++;
      const fraction = Geometry.interpolate(fraction0, fraction01, fraction1);
      this._newtonSolver.setX(fraction);
      if (this._newtonSolver.runIterations()) {
        this.announceSolutionFraction(this._newtonSolver.getX());
      }
      // this.intersections.push(CurveLocationDetail.createCurveFractionPoint(cp, fraction, cp.fractionToPoint(fraction)));
    }
  }
  private announceSolutionFraction(fraction: number) {
    if (this._curve) {
      this._ray = this._curve.fractionToPointAndDerivative(fraction, this._ray);
      this._intersections.push(CurveLocationDetail.createCurveFractionPoint(this._curve, fraction, this._ray.origin));
    }
  }
  public evaluate(fraction: number): boolean {
    const curve = this.effectiveCurve();
    if (!curve)
      return false;
    this.currentF = this._plane.altitude(curve.fractionToPoint(fraction));
    return true;
  }
  private searchInterval() {
    if (this._functionA * this._functionB > 0) return;
    if (this._functionA === 0) this.announceSolutionFraction(this._fractionA);
    if (this._functionB === 0) this.announceSolutionFraction(this._fractionB);
    if (this._functionA * this._functionB > 0) {
      const fraction = Geometry.inverseInterpolate(this._fractionA, this._functionA, this._fractionB, this._functionB);
      if (fraction) {
        this._newtonSolver.setX(fraction);
        if (this._newtonSolver.runIterations())
          this.announceSolutionFraction(this._newtonSolver.getX());
      }
    }
  }
  private evaluateB(xyz: Point3d, fraction: number, tangent: Vector3d) {
    this._functionB = this._plane.altitude(xyz);
    this._derivativeB = this._plane.velocity(tangent);
    this._fractionB = fraction;
  }
  public announcePointTangent(xyz: Point3d, fraction: number, tangent: Vector3d): void {
    this.evaluateB(xyz, fraction, tangent);
    if (this._numThisCurve++ > 0) this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
    this._fractionA = this._fractionB;
  }
}

class CurveLengthContext implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _summedLength: number;
  private _ray: Ray3d;
  private _gaussX: Float64Array;
  private _gaussW: Float64Array;
  private _gaussMapper: (xA: number, xB: number, xx: Float64Array, ww: Float64Array) => number;

  private tangentMagnitude(fraction: number): number {
    this._ray = (this._curve as CurvePrimitive).fractionToPointAndDerivative(fraction, this._ray);
    return this._ray.direction.magnitude();
  }
  public getSum() { return this._summedLength; }

  public constructor() {
    this.startCurvePrimitive(undefined);
    this._summedLength = 0.0;
    this._ray = Ray3d.createZero();

    const maxGauss = 7;
    this._gaussX = new Float64Array(maxGauss);
    this._gaussW = new Float64Array(maxGauss);
    this._gaussMapper = Quadrature.setupGauss5;
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
  }
  public startParentCurvePrimitive(_curve: CurvePrimitive) { }
  public endParentCurvePrimitive(_curve: CurvePrimitive) { }

  public endCurvePrimitive() { }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 1; i <= numStrokes; i++) {
      const fractionA = Geometry.interpolate(fraction0, (i - 1) * df, fraction1);
      const fractionB = i === numStrokes ? fraction1 : Geometry.interpolate(fraction0, (i) * df, fraction1);
      const numGauss = this._gaussMapper(fractionA, fractionB, this._gaussX, this._gaussW);
      for (let k = 0; k < numGauss; k++) {
        this._summedLength += this._gaussW[k] * this.tangentMagnitude(this._gaussX[k]);
      }
    }
  }
  public announceSegmentInterval(
    _cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    _fraction0: number,
    _fraction1: number): void {
    this._summedLength += point0.distance(point1);
  }
  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d): void {
    // uh oh -- need to retain point for next interval
  }
}
// context for searching for closest point .. .
class ClosestPointStrokeHandler extends NewtonRotRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _closestPoint: CurveLocationDetail | undefined;
  private _spacePoint: Point3d;
  private _extend: boolean;
  private _fractionA: number = 0;
  private _functionA: number = 0;
  private _functionB: number = 0;
  private _fractionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars for use within methods.
  private _workPoint: Point3d;
  private _workRay: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;

  public constructor(spacePoint: Point3d, extend: boolean) {
    super();
    this._spacePoint = spacePoint;
    this._workPoint = Point3d.create();
    this._workRay = Ray3d.createZero();
    this._closestPoint = undefined;
    this._extend = extend;
    this.startCurvePrimitive(undefined);
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }

  public claimResult(): CurveLocationDetail | undefined {
    if (this._closestPoint) {
      this._newtonSolver.setX(this._closestPoint.fraction);
      this._curve = this._closestPoint.curve;
      if (this._newtonSolver.runIterations())
        this.announceSolutionFraction(this._newtonSolver.getX());
    }
    return this._closestPoint;
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
    this._fractionA = 0.0;
    this._numThisCurve = 0;
    this._functionA = 0.0;
  }
  public endCurvePrimitive() { }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 0; i <= numStrokes; i++) {
      const fraction = Geometry.interpolate(fraction0, i * df, fraction1);
      cp.fractionToPointAndDerivative(fraction, this._workRay);
      this.announceRay(fraction, this._workRay);
    }
  }

  private announceCandidate(cp: CurvePrimitive, fraction: number, point: Point3d) {
    const distance = this._spacePoint.distance(point);
    if (this._closestPoint && distance > this._closestPoint.a)
      return;
    this._closestPoint = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point, this._closestPoint);
    this._closestPoint.a = distance;
    if (this._parentCurvePrimitive !== undefined)
      this._closestPoint.curve = this._parentCurvePrimitive;
  }
  public announceSegmentInterval(
    cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    let localFraction = this._spacePoint.fractionOfProjectionToLine(point0, point1, 0.0);
    // only consider extending the segment if the immediate caller says we are at endpoints ...
    if (!this._extend)
      localFraction = Geometry.clampToStartEnd(localFraction, 0.0, 1.0);
    else {
      if (fraction0 !== 0.0)
        localFraction = Math.max(localFraction, 0.0);
      if (fraction1 !== 1.0)
        localFraction = Math.min(localFraction, 1.0);
    }
    this._workPoint = point0.interpolate(localFraction, point1);
    const globalFraction = Geometry.interpolate(fraction0, localFraction, fraction1);
    this.announceCandidate(cp, globalFraction, this._workPoint);
  }
  private searchInterval() {
    if (this._functionA * this._functionB > 0) return;
    if (this._functionA === 0) this.announceSolutionFraction(this._fractionA);
    if (this._functionB === 0) this.announceSolutionFraction(this._fractionB);
    if (this._functionA * this._functionB < 0) {
      const fraction = Geometry.inverseInterpolate(this._fractionA, this._functionA, this._fractionB, this._functionB);
      if (fraction) {
        this._newtonSolver.setX(fraction);
        if (this._newtonSolver.runIterations())
          this.announceSolutionFraction(this._newtonSolver.getX());
      }
    }
  }
  private evaluateB(fractionB: number, dataB: Ray3d) {
    this._functionB = dataB.dotProductToPoint(this._spacePoint);
    this._fractionB = fractionB;
  }
  private announceSolutionFraction(fraction: number) {
    if (this._curve)
      this.announceCandidate(this._curve, fraction, this._curve.fractionToPoint(fraction));
  }
  public evaluate(fraction: number): boolean {
    let curve = this._curve;
    if (this._parentCurvePrimitive)
      curve = this._parentCurvePrimitive;
    if (curve) {
      this._workRay = curve.fractionToPointAndDerivative(fraction, this._workRay);
      this.currentF = this._workRay.dotProductToPoint(this._spacePoint);
      return true;
    }
    return false;
  }
  public announceRay(fraction: number, data: Ray3d): void {
    this.evaluateB(fraction, data);
    if (this._numThisCurve++ > 0) this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
    this._fractionA = this._fractionB;
  }
  public announcePointTangent(point: Point3d, fraction: number, tangent: Vector3d) {
    this._workRay.set(point, tangent);
    this.announceRay(fraction, this._workRay);
  }
}

/** A Coordinate is a persistable Point3d */
export class CoordinateXYZ extends GeometryQuery {
  private _xyz: Point3d;
  public get point() { return this._xyz; }
  /**
   * @param xyz point to be CAPTURED.
   */
  private constructor(xyz: Point3d) {
    super();
    this._xyz = xyz;
  }
  public static create(point: Point3d): CoordinateXYZ {
    return new CoordinateXYZ(point.clone());
  }
  /** return the range of the point */
  public range(): Range3d { return Range3d.create(this._xyz); }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    if (transform)
      rangeToExtend.extendTransformedXYZ(transform, this._xyz.x, this._xyz.y, this._xyz.z);
    else
      rangeToExtend.extend(this._xyz);
  }
  /** Apply transform to the Coordinate's point. */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyPoint3d(this._xyz, this._xyz);
    return true;
  }
  /** return a transformed clone.
   */
  public cloneTransformed(transform: Transform): GeometryQuery | undefined {
    const result = new CoordinateXYZ(this._xyz.clone());
    result.tryTransformInPlace(transform);
    return result;
  }
  /** return a clone */
  public clone(): GeometryQuery | undefined {
    return new CoordinateXYZ(this._xyz.clone());
  }
  /** return GeometryQuery children for recursive queries.
   *
   * * leaf classes do not need to implement.
   */

  /** test if (other instanceof Coordinate).  */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof CoordinateXYZ;
  }
  /** test for exact structure and nearly identical geometry.
   *
   * *  Leaf classes must implement !!!
   * *  base class implementation recurses through children.
   * *  base implementation is complete for classes with children and no properties.
   * *  classes with both children and properties must implement for properties, call super for children.
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    return (other instanceof CoordinateXYZ) && this._xyz.isAlmostEqual(other._xyz);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleCoordinateXYZ(this);
  }
}
