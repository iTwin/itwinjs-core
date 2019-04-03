/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry, AxisOrder, BeJSONFunctions, PlaneAltitudeEvaluator } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Angle } from "../geometry3d/Angle";
import { TrigPolynomial, SmallSystem } from "../numerics/Polynomials";
import { XYAndZ } from "../geometry3d/XYZProps";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { CurvePrimitive, AnnounceNumberNumberCurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { CurveLocationDetail, CurveSearchStatus } from "./CurveLocationDetail";
import { StrokeOptions } from "./StrokeOptions";
import { Clipper } from "../clipping/ClipUtils";
import { LineString3d } from "./LineString3d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";

/* tslint:disable:variable-name no-empty*/
/**
 * Circular or elliptic arc.
 *
 * * The angle to point equation is:
 *
 * **  `X = center + cos(theta) * vector0 + sin(theta) * vector90`
 * * When the two vectors are perpendicular and have equal length, it is a true circle.
 * * Non-perpendicular vectors are always elliptic.
 * *  vectors of unequal length are always elliptic.
 * * To create an ellipse in the common "major and minor axis" form of an ellipse:
 * ** vector0 is the vector from the center to the major axis extreme.
 * ** vector90 is the vector from the center to the minor axis extreme.
 * ** note the constructing the vectors to the extreme points makes them perpendicular.
 * *  The method toScaledMatrix3d () can be called to convert the unrestricted vector0,vector90 to perpendicular form.
 * * The unrestricted form is much easier to work with for common calculations -- stroking, projection to 2d, intersection with plane.
 */
export class Arc3d extends CurvePrimitive implements BeJSONFunctions {
  /**
   * Test if this and other are both instances of Arc3d.
   */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Arc3d; }
  private _center: Point3d;
  private _matrix: Matrix3d; // columns are [vector0, vector90, unitNormal]
  private _sweep: AngleSweep; // sweep limits.
  private static _workPointA = Point3d.create();
  private static _workPointB = Point3d.create();
  /**
   * read property for (clone of) center
   */
  public get center(): Point3d { return this._center.clone(); }
  /**
   * read property for (clone of) vector0
   */
  public get vector0(): Vector3d { return this._matrix.columnX(); }
  /**
   * read property for (clone of) vector90
   */
  public get vector90(): Vector3d { return this._matrix.columnY(); }
  /**
   * read property for (clone of!) matrix of vector0, vector90, unit normal
   */
  public get matrix(): Matrix3d { return this._matrix.clone(); }
  /** property getter for the angle sweep */
  public get sweep(): AngleSweep { return this._sweep; }
  /** property setter for angle sweep */
  public set sweep(value: AngleSweep) { this._sweep.setFrom(value); }
  /**
   * An Arc3d extends along its complete elliptic arc
   */
  public get isExtensibleFractionSpace(): boolean { return true; }

  // constructor copies the pointers !!!
  private constructor(center: Point3d, matrix: Matrix3d, sweep: AngleSweep) {
    super();
    this._center = center;
    this._matrix = matrix;
    this._sweep = sweep;
  }
  /**
   *  Return a clone of the arc, with transform applied
   * @param transform
   */
  public cloneTransformed(transform: Transform): CurvePrimitive {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }

  /**
   * Redefine the arc with (captured references to) given data.
   * @param center arc center
   * @param matrix matrix with columns vector0, vector 90, and their unit cross product
   * @param sweep angle sweep
   */
  public setRefs(center: Point3d, matrix: Matrix3d, sweep: AngleSweep) {
    this._center = center;
    this._matrix = matrix;
    this._sweep = sweep;
  }
  /**
   * Redefine the arc with (clones of) given data.
   * @param center arc center
   * @param matrix matrix with columns vector0, vector 90, and their unit cross product
   * @param sweep angle sweep
   */
  public set(center: Point3d, matrix: Matrix3d, sweep: AngleSweep | undefined) {
    this.setRefs(center.clone(), matrix.clone(), sweep ? sweep.clone() : AngleSweep.create360());
  }
  /**
   * Copy center, matrix, and sweep from other Arc3d.
   */
  public setFrom(other: Arc3d) {
    this._center.setFrom(other._center);
    this._matrix.setFrom(other._matrix);
    this._sweep.setFrom(other._sweep);
  }
  /** Return a clone of this arc. */
  public clone(): Arc3d {
    return new Arc3d(this._center.clone(), this._matrix.clone(), this._sweep.clone());
  }
  /**
   * Create an arc, capturing references to center, matrix and sweep.
   * @param center center point
   * @param matrix matrix with columns vector0, vector90, and unit cross product
   * @param sweep sweep limits
   * @param result optional preallocated result.
   */
  public static createRefs(center: Point3d, matrix: Matrix3d, sweep: AngleSweep, result?: Arc3d): Arc3d {
    if (result) {
      result.setRefs(center, matrix, sweep);
      return result;
    }
    return new Arc3d(center, matrix, sweep);
  }
  /**
   * Create an arc from center, x column to be scaled, and y column to be scaled.
   * @param center center of ellipse
   * @param matrix matrix whose x and y columns are unit vectors to be scaled by radius0 and radius90
   * @param radius0 radius in x direction.
   * @param radius90 radius in y direction.
   * @param sweep sweep limits
   * @param result optional preallocated result.
   */
  public static createScaledXYColumns(center: Point3d, matrix: Matrix3d, radius0: number, radius90: number, sweep: AngleSweep, result?: Arc3d): Arc3d {
    const vector0 = matrix.columnX();
    const vector90 = matrix.columnY();
    return Arc3d.create(center, vector0.scale(radius0, vector0), vector90.scale(radius90, vector90), sweep, result);
  }
  /**
   * Creat an arc by center with vectors to points at 0 and 90 degrees in parameter space.
   * @param center arc center
   * @param vector0 vector to 0 degrees (commonly major axis)
   * @param vector90 vector to 90 degree point (commonly minor axis)
   * @param sweep sweep limits
   * @param result optional preallocted result
   */
  public static create(center: Point3d, vector0: Vector3d, vector90: Vector3d, sweep?: AngleSweep, result?: Arc3d): Arc3d {
    const normal = vector0.unitCrossProductWithDefault(vector90, 0, 0, 0); // normal will be 000 for degenerate case ! !!
    const matrix = Matrix3d.createColumns(vector0, vector90, normal);
    return Arc3d.createRefs(center.clone(), matrix, sweep ? sweep.clone() : AngleSweep.create360(), result);
  }
  /**
   * Return a quick estimate of the eccentricity of the ellipse.
   * * The estimator is the cross magnitude of the product of vectors U and V, divided by square of the larger magnitude
   * * for typical Arc3d with perpendicular UV, this is exactly the small axis divided by large.
   * * note that the eccentricity is AT MOST ONE.
   */
  public quickEccentricity(): number {
    const magX = this._matrix.columnXMagnitude();
    const magY = this._matrix.columnYMagnitude();
    const jacobian = this._matrix.columnXYCrossProductMagnitude();
    const largeAxis = Geometry.maxXY(magX, magY);
    return jacobian / (largeAxis * largeAxis);
  }
  /** Create a circular arc defined by start point, any intermediate point, and end point.
   * If the points are colinear, assemble them into a linestring.
   */
  public static createCircularStartMiddleEnd(
    pointA: XYAndZ,
    pointB: XYAndZ,
    pointC: XYAndZ,
    result?: Arc3d): Arc3d | LineString3d | undefined {
    const vectorAB = Vector3d.createStartEnd(pointA, pointB);
    const vectorAC = Vector3d.createStartEnd(pointA, pointC);
    const ab = vectorAB.magnitude();
    const bc = vectorAC.magnitude();
    const normal = vectorAB.sizedCrossProduct(vectorAC, Math.sqrt(ab * bc));
    if (normal) {
      const vectorToCenter = SmallSystem.linearSystem3d(
        normal.x, normal.y, normal.z,
        vectorAB.x, vectorAB.y, vectorAB.z,
        vectorAC.x, vectorAC.y, vectorAC.z,
        0,              // vectorToCenter DOT normal = 0
        0.5 * ab * ab,  // vectorToCenter DOT vectorBA = 0.5 * vectorBA DOT vectorBA  (Rayleigh quotient)
        0.5 * bc * bc); // vectorToCenter DOT vectorBC = 0.5 * vectorBC DOT vectorBC  (Rayleigh quotient)
      if (vectorToCenter) {
        const center = Point3d.create(pointA.x, pointA.y, pointA.z).plus(vectorToCenter);
        const vectorX = Vector3d.createStartEnd(center, pointA);
        const vectorY = Vector3d.createRotateVectorAroundVector(vectorX, normal, Angle.createDegrees(90));
        if (vectorY) {
          const vectorCenterToC = Vector3d.createStartEnd(center, pointC);
          const sweepAngle = vectorX.signedAngleTo(vectorCenterToC, normal);
          return Arc3d.create(center, vectorX, vectorY,
            AngleSweep.createStartEndRadians(0.0, sweepAngle.radians), result);
        }
      }
    }
    return LineString3d.create(pointA, pointB, pointC);
  }
  /** The arc has simple proportional arc length if and only if it is a circular arc. */
  public getFractionToDistanceScale(): number | undefined {
    const radius = this.circularRadius();
    if (radius !== undefined)
      return Math.abs(radius * this._sweep.sweepRadians);
    return undefined;
  }
  /**
   * Convert a fractional position to xyz coordinates
   * @param fraction fractional position on arc
   * @param result optional preallocated result
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const radians = this._sweep.fractionToRadians(fraction);
    return this._matrix.originPlusMatrixTimesXY(this._center, Math.cos(radians), Math.sin(radians), result);
  }
  /**
   * Convert a fractional position to xyz coordinates and derivative with respect to fraction.
   * @param fraction fractional position on arc
   * @param result optional preallocated result
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = this.radiansToPointAndDerivative(this._sweep.fractionToRadians(fraction), result);
    result.direction.scaleInPlace(this._sweep.sweepRadians);
    return result;
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the arc
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const radians = this._sweep.fractionToRadians(fraction);
    if (!result) result = Plane3dByOriginAndVectors.createXYPlane();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    this._matrix.originPlusMatrixTimesXY(this._center, c, s, result.origin);
    const a = this._sweep.sweepRadians;
    this._matrix.multiplyXY(-a * s, a * c, result.vectorU);
    const aa = a * a;
    this._matrix.multiplyXY(- aa * c, -aa * s, result.vectorV);
    return result;
  }
  /**
   * Evaluate the point and derivative with respect to the angle (in radians)
   * @param radians angular position
   * @param result optional preallocated ray.
   */
  public radiansToPointAndDerivative(radians: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    this._matrix.originPlusMatrixTimesXY(this._center, c, s, result.origin);
    this._matrix.multiplyXY(-s, c, result.direction);
    return result;
  }
  /**
   * Evaluate the point and derivative with respect to the angle (in radians)
   * @param theta angular position
   * @param result optional preallocated ray.
   */
  public angleToPointAndDerivative(theta: Angle, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    const c = theta.cos();
    const s = theta.sin();
    this._matrix.originPlusMatrixTimesXY(this._center, c, s, result.origin);
    this._matrix.multiplyXY(-s, c, result.direction);
    return result;
  }
  /**
   * Return the start point tof the arc.
   * @param result optional preallocated result
   */
  public startPoint(result?: Point3d): Point3d { return this.fractionToPoint(0.0, result); }

  /**
   * Return the end point tof the arc.
   * @param result optional preallocated result
   */
  public endPoint(result?: Point3d): Point3d { return this.fractionToPoint(1.0, result); }
  /** * If this is a circular arc, return the simple length derived from radius and sweep.
   * * Otherwise (i.e. if this elliptical) fall through to CurvePrimitive base implementation which
   *     Uses quadrature.
   */
  public curveLength(): number {
    return this.curveLengthBetweenFractions(0, 1);
  }
  /** Gauss point quadrature count for evaluating curve length.   (The number of intervals is adjusted to the arc sweep) */
  public static readonly quadratureGuassCount = 5;
  /** In quadrature for arc length, use this interval (divided by quickEccentricity) */
  public static readonly quadratureIntervalAngleDegrees = 10.0;
  /** * If this is a circular arc, return the simple length derived from radius and sweep.
   * * Otherwise (i.e. if this elliptical) fall through CurvePrimitive integrator.
   */
  public curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    const simpleLength = this.getFractionToDistanceScale();
    if (simpleLength !== undefined)
      return simpleLength * Math.abs(fraction1 - fraction0);
    // fall through for true ellipse . .. stroke and accumulate quadrature with typical count .  ..
    let f0 = fraction0;
    let f1 = fraction1;
    if (fraction0 > fraction1) {
      f0 = fraction1;
      f1 = fraction0;
    }
    const sweepDegrees = (f1 - f0) * this._sweep.sweepDegrees;
    let eccentricity = this.quickEccentricity();
    if (eccentricity < 0.00001)
      eccentricity = 0.00001;
    let numInterval = Math.ceil(sweepDegrees / (eccentricity * Arc3d.quadratureIntervalAngleDegrees));
    if (numInterval > 400)
      numInterval = 400;
    if (numInterval < 1)
      numInterval = 1;
    return super.curveLengthWithFixedIntervalCountQuadrature(f0, f1, numInterval, Arc3d.quadratureGuassCount);
  }

  /**
   * Return an approximate (but easy to compute) arc length.
   * The estimate is:
   * * Form 8 chords on full circle, proportionally fewer for partials.  (But 2 extras if less than half circle.)
   * * sum the chord lengths
   * * For a circle, we know this crude approximation has to be increased by a factor (theta/(2 sin (theta/2)))
   * * Apply that factor.
   * * Experiments confirm that this is within 3 percent for a variety of eccentricities and arc sweeps.
   */
  public quickLength(): number {
    const totalSweep = Math.abs(this._sweep.sweepRadians);
    let numInterval = Math.ceil(4 * totalSweep / Math.PI);
    if (numInterval < 1)
      numInterval = 1;
    if (numInterval < 4)
      numInterval += 3;
    else if (numInterval < 6)
      numInterval += 2;   // force extras for short arcs
    const pointA = Arc3d._workPointA;
    const pointB = Arc3d._workPointB;
    let chordSum = 0.0;
    this.fractionToPoint(0.0, pointA);
    for (let i = 1; i <= numInterval; i++) {
      this.fractionToPoint(i / numInterval, pointB);
      chordSum += pointA.distance(pointB);
      pointA.setFromPoint3d(pointB);
    }
    // The chord sum is always shorter.
    // if it is a true circular arc, the ratio of correct over sum is easy ...
    const dTheta = totalSweep / numInterval;
    const factor = dTheta / (2.0 * Math.sin(0.5 * dTheta));
    return chordSum * factor;
  }
  /**
   * * See extended comments on `CurvePrimitive.moveSignedDistanceFromFraction`
   * * A zero length line generates `CurveSearchStatus.error`
   * * Nonzero length line generates `CurveSearchStatus.success` or `CurveSearchStatus.stoppedAtBoundary`
   */
  public moveSignedDistanceFromFraction(startFraction: number, signedDistance: number, allowExtension: false, result?: CurveLocationDetail): CurveLocationDetail {
    if (!this.isCircular) // suppress extension !!!
      return super.moveSignedDistanceFromFractionGeneric(startFraction, signedDistance, allowExtension, result);
    const totalLength = this.curveLength();
    const signedFractionMove = Geometry.conditionalDivideFraction(signedDistance, totalLength);
    if (signedFractionMove === undefined) {
      return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
        this, startFraction, this.fractionToPoint(startFraction), 0.0, CurveSearchStatus.error);
    }
    return CurveLocationDetail.createConditionalMoveSignedDistance(
      allowExtension,
      this,
      startFraction,
      startFraction + signedFractionMove,
      signedDistance,
      result);
  }
  /**
   * Return all angles (in radians) where the ellipse tangent is perpendicular to the vector to a spacePoint.
   * @param spacePoint point of origin of vectors to the ellipse
   * @param _extend (NOT SUPPORTED -- ALWAYS ACTS AS "true")
   * @param _endpoints (NOT SUPPORTED -- ALWAYS ACTS AS FALSE)
   */
  public allPerpendicularAngles(spacePoint: Point3d, _extend: boolean = true, _endpoints: boolean = false): number[] {
    const radians: number[] = [];
    const vectorQ = spacePoint.vectorTo(this.center);
    const uu = this._matrix.columnXMagnitudeSquared();
    const uv = this._matrix.columnXDotColumnY();
    const vv = this._matrix.columnYMagnitudeSquared();
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(
      uv,
      vv - uu,
      -uv,
      this._matrix.dotColumnY(vectorQ),
      -this._matrix.dotColumnX(vectorQ),
      0.0, radians);
    return radians;
  }
  /**
   * Return details of the closest point on the arc, optionally extending to full ellipse.
   * @param spacePoint search for point closest to this point.
   * @param extend if true, considere projections to the complete ellipse.   If false, consider only endpoints and projections within the arc sweep.
   * @param result optional preallocated result.
   */
  public closestPoint(spacePoint: Point3d, extend: boolean, result?: CurveLocationDetail): CurveLocationDetail {
    result = CurveLocationDetail.create(this, result);
    const allRadians = this.allPerpendicularAngles(spacePoint);
    if (!extend && !this._sweep.isFullCircle) {
      allRadians.push(this._sweep.startRadians);
      allRadians.push(this._sweep.endRadians);
    }
    // hm... logically there must at least two angles there ...  but if it happens return the start point ...
    const workRay = Ray3d.createZero();
    if (allRadians.length === 0) {
      result.setFR(0.0, this.radiansToPointAndDerivative(this._sweep.startRadians, workRay));
      result.a = spacePoint.distance(result.point);
    } else {
      let dMin = Number.MAX_VALUE;
      let d = 0;
      for (const radians of allRadians) {
        if (extend || this._sweep.isRadiansInSweep(radians)) {
          this.radiansToPointAndDerivative(radians, workRay);
          d = spacePoint.distance(workRay.origin);
          if (d < dMin) {
            dMin = d;
            result.setFR(this._sweep.radiansToSignedPeriodicFraction(radians), workRay);
            result.a = d;
          }
        }
      }
    }
    return result;
  }
  /** Reverse the sweep  of the arc. */
  public reverseInPlace(): void { this._sweep.reverseInPlace(); }
  /** apply a transform to the arc basis vectors.
   * * nonuniform (i.e. skewing) transforms are allowed.
   * * The transformed vector0 and vector90 are NOT squared up as major minor axes.  (This is a good feature!!)
   */
  public tryTransformInPlace(transform: Transform): boolean {
    this._center = transform.multiplyPoint3d(this._center, this._center);
    this._matrix = transform.matrix.multiplyMatrixMatrix(this._matrix, this._matrix);
    // force re-normalization of columnZ.
    this.setVector0Vector90(this._matrix.columnX(), this._matrix.columnY());
    return true;
  }
  /**
   * Return true if the ellispe center and basis vectors are in the plane
   * @param plane
   */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    const normal = plane.getNormalRef();
    // The ellipse vectors are full-length  -- true distance comparisons say things.
    return Geometry.isSmallMetricDistance(plane.altitude(this._center))
      && Geometry.isSmallMetricDistance(this._matrix.dotColumnX(normal))
      && Geometry.isSmallMetricDistance(this._matrix.dotColumnY(normal));
  }
  /**
   * Return true if the vector0 and vector90 are of equal length and perpendicular.
   */
  public get isCircular(): boolean {
    const axx = this._matrix.columnXMagnitudeSquared();
    const ayy = this._matrix.columnYMagnitudeSquared();
    const axy = this._matrix.columnXDotColumnY();
    return Angle.isPerpendicularDotSet(axx, ayy, axy) && Geometry.isSameCoordinateSquared(axx, ayy);
  }
  /** If the arc is circular, return its radius.  Otherwise return undefined */
  public circularRadius(): number | undefined {
    return this.isCircular ? this._matrix.columnXMagnitude() : undefined;
  }

  /** Return the larger of the two defining vectors. */
  public maxVectorLength(): number { return Math.max(this._matrix.columnXMagnitude(), this._matrix.columnYMagnitude()); }
  /**
   * compute intersections with a plane.
   * @param plane plane to intersect
   * @param result array of locations on the curve.
   */
  public appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    const constCoff = plane.altitude(this._center);
    const coffs = this._matrix.coffs;
    const cosCoff = plane.velocityXYZ(coffs[0], coffs[3], coffs[6]);
    const sinCoff = plane.velocityXYZ(coffs[1], coffs[4], coffs[7]);
    const trigPoints = Geometry.solveTrigForm(constCoff, cosCoff, sinCoff);
    let numIntersection = 0;
    if (trigPoints !== undefined) {
      numIntersection = trigPoints.length;
      let xy;
      for (xy of trigPoints) {
        const radians = Math.atan2(xy.y, xy.x);
        const fraction = this._sweep.radiansToPositivePeriodicFraction(radians);
        result.push(CurveLocationDetail.createCurveFractionPoint(this, fraction, this.fractionToPoint(fraction)));
      }
    }
    return numIntersection;
  }
  /**
   * Extend a range to include the range of the arc.
   * @param range range being extended.
   * @param transform optional transform to apply to the arc.
   */
  public extendRange(range: Range3d, transform?: Transform): void {
    const df = 1.0 / 32;
    // KLUDGE --- evaluate lots of points ...
    let point = Point3d.create();
    for (let fraction = 0; fraction <= 1.001; fraction += df) {
      point = this.fractionToPoint(fraction, point);
      if (transform)
        range.extendTransformedPoint(transform, point);
      else
        range.extendPoint(point);
    }
  }
  /**
   * Create a new arc which is a unit circle centered at the origin.
   */
  public static createUnitCircle(): Arc3d {
    return Arc3d.createRefs(Point3d.create(0, 0, 0), Matrix3d.createIdentity(), AngleSweep.create360());
  }
  /**
   * Create a new arc which is parallel to the xy plane, with given center and radius and optional angle sweep.
   * @param center center of arc
   * @param radius radius of arc
   * @param sweep sweep limits.  defaults to full circle.
   */
  public static createXY(
    center: Point3d,
    radius: number,
    sweep: AngleSweep = AngleSweep.create360()): Arc3d {
    return new Arc3d(center.clone(), Matrix3d.createScale(radius, radius, 1.0), sweep);
  }
  /**
   * Create a new arc which is parallel to the xy plane, with given center and x,y radii, and optional angle sweep
   * @param center center of ellipse
   * @param radiusA x axis radius
   * @param radiusB y axis radius
   * @param sweep angle sweep
   */
  public static createXYEllipse(
    center: Point3d,
    radiusA: number,
    radiusB: number,
    sweep: AngleSweep = AngleSweep.create360()): Arc3d {
    return new Arc3d(center.clone(), Matrix3d.createScale(radiusA, radiusB, 1.0), sweep);
  }
  /**
   * Replace the arc's 0 and 90 degree vectors.
   * @param vector0 vector from center to ellipse point at 0 degrees in parameter space
   * @param vector90 vector from center to ellipse point at 90 degrees in parameter space
   */
  public setVector0Vector90(vector0: Vector3d, vector90: Vector3d) {
    this._matrix.setColumns(vector0, vector90,
      vector0.unitCrossProductWithDefault(vector90, 0, 0, 0), // normal will be 000 for degenerate case !!!;
    );
  }
  /** Return the arc definition with rigid matrix form with axis radii.
   */
  public toScaledMatrix3d(): { center: Point3d, axes: Matrix3d, r0: number, r90: number, sweep: AngleSweep } {
    const angleData = Angle.dotProductsToHalfAngleTrigValues(
      this._matrix.columnXMagnitudeSquared(),
      this._matrix.columnYMagnitudeSquared(),
      this._matrix.columnXDotColumnY(), true);
    const vector0A = this._matrix.multiplyXY(angleData.c, angleData.s);
    const vector90A = this._matrix.multiplyXY(-angleData.s, angleData.c);

    const axes = Matrix3d.createRigidFromColumns(vector0A, vector90A, AxisOrder.XYZ);
    return {
      axes: (axes ? axes : Matrix3d.createIdentity()),
      center: this._center,
      r0: vector0A.magnitude(),
      r90: vector90A.magnitude(),
      sweep: this.sweep.cloneMinusRadians(angleData.radians),
    };
  }
  /** Return the arc definition with center, two vectors, and angle sweep;
   */
  public toVectors(): { center: Point3d, vector0: Vector3d, vector90: Vector3d, sweep: AngleSweep } {
    return {
      center: this.center,
      vector0: this._matrix.columnX(),
      vector90: this._matrix.columnY(),
      sweep: this.sweep,
    };
  }

  /** Return the arc definition with center, two vectors, and angle sweep, optionally transformed.
   */
  public toTransformedVectors(transform?: Transform): { center: Point3d, vector0: Vector3d, vector90: Vector3d, sweep: AngleSweep } {
    return transform ? {
      center: transform.multiplyPoint3d(this._center),
      vector0: transform.multiplyVector(this._matrix.columnX()),
      vector90: transform.multiplyVector(this._matrix.columnY()),
      sweep: this.sweep,
    }
      : {
        center: this._center.clone(),
        vector0: this._matrix.columnX(),
        vector90: this._matrix.columnY(),
        sweep: this.sweep,
      };
  }

  /** Return the arc definition with center, two vectors, and angle sweep, transformed to 4d points.
   */
  public toTransformedPoint4d(matrix: Matrix4d): { center: Point4d, vector0: Point4d, vector90: Point4d, sweep: AngleSweep } {
    return {
      center: matrix.multiplyPoint3d(this._center, 1.0),
      vector0: matrix.multiplyPoint3d(this._matrix.columnX(), 0.0),
      vector90: matrix.multiplyPoint3d(this._matrix.columnY(), 0.0),
      sweep: this.sweep,
    };
  }
  /**
   * Set this arc from a json object with these values:
   * * center center point
   * * vector0 vector from center to 0 degree point in parameter space (commonly but not always the major axis vector)
   * * vector90 vector from center to 90 degree point in parameter space (commonly but not always the minor axis vector)
   * @param json
   */
  public setFromJSON(json?: any) {
    if (json && json.center && json.vector0 && json.vector90 && json.sweep) {
      this._center.setFromJSON(json.center);
      const vector0 = Vector3d.create();
      const vector90 = Vector3d.create();
      vector0.setFromJSON(json.vector0);
      vector90.setFromJSON(json.vector90);
      this.setVector0Vector90(vector0, vector90);
      this._sweep.setFromJSON(json.sweep);
    } else {
      this._center.set(0, 0, 0);
      this._matrix.setFrom(Matrix3d.identity);
      this._sweep.setStartEndRadians();
    }
  }
  /**
   * Convert to a JSON object.
   * @return {*} [center:  [], vector0:[], vector90:[], sweep []}
   */
  public toJSON(): any {
    return {
      center: this._center.toJSON(),
      sweep: this._sweep.toJSON(),
      vector0: this._matrix.columnX().toJSON(),
      vector90: this._matrix.columnY().toJSON(),
    };
  }
  /**
   * Test if this arc is almost equal to another GeoemtryQuery object
   */
  public isAlmostEqual(otherGeometry: GeometryQuery): boolean {
    if (otherGeometry instanceof Arc3d) {
      const other = otherGeometry as Arc3d;
      return this._center.isAlmostEqual(other._center)
        && this._matrix.isAlmostEqual(other._matrix)
        && this._sweep.isAlmostEqualAllowPeriodShift(other._sweep);
    }
    return false;
  }

  /** Emit strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const numStrokes = this.computeStrokeCountForOptions(options);
    dest.appendFractionalStrokePoints(this, numStrokes, 0.0, 1.0, true);
  }

  /** Emit strokes to caller-supplied handler */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const numStrokes = this.computeStrokeCountForOptions(options);
    handler.startCurvePrimitive(this);
    handler.announceIntervalForUniformStepStrokes(this, numStrokes, 0.0, 1.0);
    handler.endCurvePrimitive(this);
  }

  /**
   * return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    let numStroke = 1;
    if (options) {
      const rMax = this.maxVectorLength();
      numStroke = options.applyTolerancesToArc(rMax, this._sweep.sweepRadians);
    } else {
      numStroke = StrokeOptions.applyAngleTol(undefined, 1, this._sweep.sweepRadians);
    }
    return numStroke;
  }
  /**
   * Invoke `hander.handleArc3d(this)` per double-dispatch obligation
   */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleArc3d(this);
  }
  /** Return (if possible) an arc which is a portion of this curve.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public clonePartialCurve(fractionA: number, fractionB: number): CurvePrimitive | undefined {
    if (fractionB < fractionA) {
      const arcA = this.clonePartialCurve(fractionB, fractionA);
      if (arcA)
        arcA.reverseInPlace();
      return arcA;
    }
    const arcB = this.clone();

    arcB.sweep.setStartEndRadians(
      this.sweep.fractionToRadians(fractionA),
      this.sweep.fractionToRadians(fractionB));
    return arcB;
  }
  /**
   * Find intervals of this curveprimitve that are interior to a clipper
   * @param clipper clip structure (e.g.clip planes)
   * @param announce(optional) function to be called announcing fractional intervals"  ` announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    return clipper.announceClippedArcIntervals(this, announce);
  }
}
