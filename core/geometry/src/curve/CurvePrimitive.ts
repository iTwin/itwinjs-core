/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { AxisOrder, Geometry } from "../Geometry";
import { StrokeOptions } from "./StrokeOptions";
import { Order2Bezier } from "../numerics/BezierPolynomials";
import { Point3d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, RotMatrix } from "../Transform";
import { Plane3dByOriginAndUnitNormal, Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";
import { NewtonEvaluatorRtoR, Newton1dUnboundedApproximateDerivative } from "../numerics/Newton";
import { Quadrature } from "../numerics/Quadrature";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";
import { LineString3d } from "./LineString3d";
import { ClipperMethods } from "../numerics/ClipPlanes";

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
  public isIsolated(): boolean {
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
    let axes = RotMatrix.createRigidFromColumns(plane.vectorU, plane.vectorV, AxisOrder.XYZ);
    if (axes)
      return Transform.createRefs(plane.origin, axes, result);
    // 2nd derivative not distinct -- do arbitrary headsup ...
    const perpVector = RotMatrix.createRigidHeadsUpFavorXYPlane(plane.vectorU, plane.vectorV);
    axes = RotMatrix.createRigidFromColumns(plane.vectorU, perpVector, AxisOrder.XYZ);
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
  public announceClipIntervals(_clipper: ClipperMethods, _announce?: AnnounceNumberNumberCurvePrimitive): boolean {
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
  protected parentCurvePrimitive: CurvePrimitive | undefined;
  constructor() {
    super();
    this.parentCurvePrimitive = undefined;
  }
  /** retain the parentCurvePrimitive */
  public startParentCurvePrimitive(curve: CurvePrimitive | undefined) { this.parentCurvePrimitive = curve; }
  /** Forget the parentCurvePrimitive */
  public endParentCurvePrimitive(_curve: CurvePrimitive | undefined) { this.parentCurvePrimitive = undefined; }
}

class AppendPlaneIntersectionStrokeHandler extends NewtonRotRStrokeHandler implements IStrokeHandler {
  private curve: CurvePrimitive | undefined;
  private plane: Plane3dByOriginAndUnitNormal;
  private intersections: CurveLocationDetail[];
  private fractionA: number = 0;
  private functionA: number = 0;
  // private derivativeA: number;   <---- Not currently used
  private functionB: number = 0;
  private fractionB: number = 0;
  private derivativeB: number = 0;
  private numThisCurve: number = 0;
  // scratch vars for use within methods.
  private ray: Ray3d;
  private newtonSolver: Newton1dUnboundedApproximateDerivative;
  // Return the first defined curve among: this.parentCurvePrimitive, this.curve;
  public effectiveCurve(): CurvePrimitive | undefined {
    if (this.parentCurvePrimitive)
      return this.parentCurvePrimitive;
    return this.curve;
  }
  public get getDerivativeB() { return this.derivativeB; }    // <--- DerivativeB is not currently used anywhere. Provided getter to suppress tslint error

  public constructor(plane: Plane3dByOriginAndUnitNormal, intersections: CurveLocationDetail[]) {
    super();
    this.plane = plane;
    this.intersections = intersections;
    this.startCurvePrimitive(undefined);
    this.ray = Ray3d.createZero();
    this.newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this.curve = curve;
    this.fractionA = 0.0;
    this.numThisCurve = 0;
    this.functionA = 0.0;
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
      cp.fractionToPointAndDerivative(fraction, this.ray);
      this.announcePointTangent(this.ray.origin, fraction, this.ray.direction);
    }
  }
  public announceSegmentInterval(
    _cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    const h0 = this.plane.altitude(point0);
    const h1 = this.plane.altitude(point1);
    if (h0 * h1 > 0.0)
      return;
    const fraction01 = Order2Bezier.solveCoffs(h0, h1);
    // let numIntersection = 0;
    if (fraction01 !== undefined) {
      // numIntersection++;
      const fraction = Geometry.interpolate(fraction0, fraction01, fraction1);
      this.newtonSolver.setX(fraction);
      if (this.newtonSolver.runIterations()) {
        this.announceSolutionFraction(this.newtonSolver.getX());
      }
      // this.intersections.push(CurveLocationDetail.createCurveFractionPoint(cp, fraction, cp.fractionToPoint(fraction)));
    }
  }
  private announceSolutionFraction(fraction: number) {
    if (this.curve) {
      this.ray = this.curve.fractionToPointAndDerivative(fraction, this.ray);
      this.intersections.push(CurveLocationDetail.createCurveFractionPoint(this.curve, fraction, this.ray.origin));
    }
  }
  public evaluate(fraction: number): boolean {
    const curve = this.effectiveCurve();
    if (!curve)
      return false;
    this.currentF = this.plane.altitude(curve.fractionToPoint(fraction));
    return true;
  }
  private searchInterval() {
    if (this.functionA * this.functionB > 0) return;
    if (this.functionA === 0) this.announceSolutionFraction(this.fractionA);
    if (this.functionB === 0) this.announceSolutionFraction(this.fractionB);
    if (this.functionA * this.functionB > 0) {
      const fraction = Geometry.inverseInterpolate(this.fractionA, this.functionA, this.fractionB, this.functionB);
      if (fraction) {
        this.newtonSolver.setX(fraction);
        if (this.newtonSolver.runIterations())
          this.announceSolutionFraction(this.newtonSolver.getX());
      }
    }
  }
  private evaluateB(xyz: Point3d, fraction: number, tangent: Vector3d) {
    this.functionB = this.plane.altitude(xyz);
    this.derivativeB = this.plane.velocity(tangent);
    this.fractionB = fraction;
  }
  public announcePointTangent(xyz: Point3d, fraction: number, tangent: Vector3d): void {
    this.evaluateB(xyz, fraction, tangent);
    if (this.numThisCurve++ > 0) this.searchInterval();
    this.functionA = this.functionB;
    this.fractionA = this.fractionB;
    this.fractionA = this.fractionB;
  }
}

class CurveLengthContext implements IStrokeHandler {
  private curve: CurvePrimitive | undefined;
  private summedLength: number;
  private ray: Ray3d;
  private gaussX: Float64Array;
  private gaussW: Float64Array;
  private gaussMapper: (xA: number, xB: number, xx: Float64Array, ww: Float64Array) => number;

  private tangentMagnitude(fraction: number): number {
    this.ray = (this.curve as CurvePrimitive).fractionToPointAndDerivative(fraction, this.ray);
    return this.ray.direction.magnitude();
  }
  public getSum() { return this.summedLength; }

  public constructor() {
    this.startCurvePrimitive(undefined);
    this.summedLength = 0.0;
    this.ray = Ray3d.createZero();

    const maxGauss = 7;
    this.gaussX = new Float64Array(maxGauss);
    this.gaussW = new Float64Array(maxGauss);
    this.gaussMapper = Quadrature.setupGauss5;
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this.curve = curve;
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
      const numGauss = this.gaussMapper(fractionA, fractionB, this.gaussX, this.gaussW);
      for (let k = 0; k < numGauss; k++) {
        this.summedLength += this.gaussW[k] * this.tangentMagnitude(this.gaussX[k]);
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
    this.summedLength += point0.distance(point1);
  }
  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d): void {
    // uh oh -- need to retain point for next interval
  }
}
// context for searching for closest point .. .
class ClosestPointStrokeHandler extends NewtonRotRStrokeHandler implements IStrokeHandler {
  private curve: CurvePrimitive | undefined;
  private closestPoint: CurveLocationDetail | undefined;
  private spacePoint: Point3d;
  private extend: boolean;
  private fractionA: number = 0;
  private functionA: number = 0;
  private functionB: number = 0;
  private fractionB: number = 0;
  private numThisCurve: number = 0;
  // scratch vars for use within methods.
  private workPoint: Point3d;
  private workRay: Ray3d;
  private newtonSolver: Newton1dUnboundedApproximateDerivative;

  public constructor(spacePoint: Point3d, extend: boolean) {
    super();
    this.spacePoint = spacePoint;
    this.workPoint = Point3d.create();
    this.workRay = Ray3d.createZero();
    this.closestPoint = undefined;
    this.extend = extend;
    this.startCurvePrimitive(undefined);
    this.newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }

  public claimResult(): CurveLocationDetail | undefined {
    if (this.closestPoint) {
      this.newtonSolver.setX(this.closestPoint.fraction);
      this.curve = this.closestPoint.curve;
      if (this.newtonSolver.runIterations())
        this.announceSolutionFraction(this.newtonSolver.getX());
    }
    return this.closestPoint;
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this.curve = curve;
    this.fractionA = 0.0;
    this.numThisCurve = 0;
    this.functionA = 0.0;
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
      cp.fractionToPointAndDerivative(fraction, this.workRay);
      this.announceRay(fraction, this.workRay);
    }
  }

  private announceCandidate(cp: CurvePrimitive, fraction: number, point: Point3d) {
    const distance = this.spacePoint.distance(point);
    if (this.closestPoint && distance > this.closestPoint.a)
      return;
    this.closestPoint = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point, this.closestPoint);
    this.closestPoint.a = distance;
    if (this.parentCurvePrimitive !== undefined)
      this.closestPoint.curve = this.parentCurvePrimitive;
  }
  public announceSegmentInterval(
    cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    let localFraction = this.spacePoint.fractionOfProjectionToLine(point0, point1, 0.0);
    // only consider extending the segment if the immediate caller says we are at endpoints ...
    if (!this.extend)
      localFraction = Geometry.clampToStartEnd(localFraction, 0.0, 1.0);
    else {
      if (fraction0 !== 0.0)
        localFraction = Math.max(localFraction, 0.0);
      if (fraction1 !== 1.0)
        localFraction = Math.min(localFraction, 1.0);
    }
    this.workPoint = point0.interpolate(localFraction, point1);
    const globalFraction = Geometry.interpolate(fraction0, localFraction, fraction1);
    this.announceCandidate(cp, globalFraction, this.workPoint);
  }
  private searchInterval() {
    if (this.functionA * this.functionB > 0) return;
    if (this.functionA === 0) this.announceSolutionFraction(this.fractionA);
    if (this.functionB === 0) this.announceSolutionFraction(this.fractionB);
    if (this.functionA * this.functionB < 0) {
      const fraction = Geometry.inverseInterpolate(this.fractionA, this.functionA, this.fractionB, this.functionB);
      if (fraction) {
        this.newtonSolver.setX(fraction);
        if (this.newtonSolver.runIterations())
          this.announceSolutionFraction(this.newtonSolver.getX());
      }
    }
  }
  private evaluateB(fractionB: number, dataB: Ray3d) {
    this.functionB = dataB.dotProductToPoint(this.spacePoint);
    this.fractionB = fractionB;
  }
  private announceSolutionFraction(fraction: number) {
    if (this.curve)
      this.announceCandidate(this.curve, fraction, this.curve.fractionToPoint(fraction));
  }
  public evaluate(fraction: number): boolean {
    let curve = this.curve;
    if (this.parentCurvePrimitive)
      curve = this.parentCurvePrimitive;
    if (curve) {
      this.workRay = curve.fractionToPointAndDerivative(fraction, this.workRay);
      this.currentF = this.workRay.dotProductToPoint(this.spacePoint);
      return true;
    }
    return false;
  }
  public announceRay(fraction: number, data: Ray3d): void {
    this.evaluateB(fraction, data);
    if (this.numThisCurve++ > 0) this.searchInterval();
    this.functionA = this.functionB;
    this.fractionA = this.fractionB;
    this.fractionA = this.fractionB;
  }
  public announcePointTangent(point: Point3d, fraction: number, tangent: Vector3d) {
    this.workRay.set(point, tangent);
    this.announceRay(fraction, this.workRay);
  }
}

/** A Coordinate is a persistable Point3d */
export class CoordinateXYZ extends GeometryQuery {
  private xyz: Point3d;
  public get point() { return this.xyz; }
  /**
   * @param xyz point to be CAPTURED.
   */
  private constructor(xyz: Point3d) {
    super();
    this.xyz = xyz;
  }
  public static create(point: Point3d): CoordinateXYZ {
    return new CoordinateXYZ(point.clone());
  }
  /** return the range of the point */
  public range(): Range3d { return Range3d.create(this.xyz); }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    if (transform)
      rangeToExtend.extendTransformedXYZ(transform, this.xyz.x, this.xyz.y, this.xyz.z);
    else
      rangeToExtend.extend(this.xyz);
  }
  /** Apply transform to the Coordinate's point. */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyPoint3d(this.xyz, this.xyz);
    return true;
  }
  /** return a transformed clone.
   */
  public cloneTransformed(transform: Transform): GeometryQuery | undefined {
    const result = new CoordinateXYZ(this.xyz.clone());
    result.tryTransformInPlace(transform);
    return result;
  }
  /** return a clone */
  public clone(): GeometryQuery | undefined {
    return new CoordinateXYZ(this.xyz.clone());
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
    return (other instanceof CoordinateXYZ) && this.xyz.isAlmostEqual(other.xyz);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleCoordinateXYZ(this);
  }
}
