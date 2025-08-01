/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Clipper } from "../clipping/ClipUtils";
import { Constant } from "../Constant";
import { AxisOrder, BeJSONFunctions, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { XYAndZ } from "../geometry3d/XYZProps";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { SineCosinePolynomial, TrigPolynomial } from "../numerics/Polynomials";
import { SmallSystem } from "../numerics/SmallSystem";
import { CurveChain } from "./CurveCollection";
import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveIntervalRole, CurveLocationDetail, CurveSearchStatus } from "./CurveLocationDetail";
import { AnnounceNumberNumberCurvePrimitive, CurvePrimitive, TangentOptions } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { CurveOffsetXYHandler } from "./internalContexts/CurveOffsetXYHandler";
import { EllipticalArcApproximationContext } from "./internalContexts/EllipticalArcApproximationContext";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { OffsetOptions } from "./OffsetOptions";
import { Path } from "./Path";
import { StrokeOptions } from "./StrokeOptions";

// cspell:words binormal

/**
 * Compact vector form of an elliptic arc defined by center, vectors at 0 and 90 degrees, and angular sweep.
 * * @see [Curve Collections]($docs/learning/geometry/CurvePrimitive.md) learning article for further details of the
 * parameterization and meaning of the vectors.
 * @public
 */
export interface ArcVectors {
  /** Center point of arc. */
  center: Point3d;
  /** Vector from the arc center to the arc point at parameter 0 degrees. */
  vector0: Vector3d;
  /** Vector from the arc center to the arc point at parameter 90 degrees. */
  vector90: Vector3d;
  /** Angular range swept by the arc, of length less than 2*pi if not a full ellipse. */
  sweep: AngleSweep;
}

/**
 * Carrier structure for an arc with fractional data on incoming, outgoing curves.
 * @public
 */
export interface ArcBlendData {
  /** Constructed arc. */
  arc?: Arc3d;
  /** Fraction "moving backward" on the inbound curve. */
  fraction10: number;
  /** Fraction "moving forward" on the outbound curve. */
  fraction12: number;
  /** Optional reference point. */
  point?: Point3d;
}

/**
 * Enumeration of methods used to sample an elliptical arc in [[Arc3d.constructCircularArcChainApproximation]].
 * * Because ellipses have two axes of symmetry, samples are computed for one quadrant and reflected across each
 * axis to the other quadrants. Any samples that fall outside the arc sweep are filtered out.
 * @public
 */
export enum EllipticalArcSampleMethod {
  /** Generate n samples uniformly interpolated between the min and max parameters of a full ellipse quadrant. */
  UniformParameter = 0,
  /** Generate n samples uniformly interpolated between the min and max curvatures of a full ellipse quadrant. */
  UniformCurvature = 1,
  /**
   * Generate n samples interpolated between the min and max curvatures of a full ellipse quadrant, using a
   * [[FractionMapper]] callback to generate the interpolation weights.
   */
  NonUniformCurvature = 2,
  /**
   * Generate samples by subdividing parameter space until the approximation has less than a given max
   * distance to the elliptical arc.
   */
  AdaptiveSubdivision = 3,
}

/**
 * A function that maps [0,1]->[0,1].
 * @public
 */
export type FractionMapper = (f: number) => number;

/**
 * Options for generating samples for the construction of an approximation to an elliptical arc.
 * * Used by [[Arc3d.constructCircularArcChainApproximation]].
 * @public
 */
export class EllipticalArcApproximationOptions {
  private _sampleMethod: EllipticalArcSampleMethod;
  private _numSamplesInQuadrant: number;
  private _maxError: number;
  private _remapFunction: FractionMapper;
  private _forcePath: boolean;

  /** Default error tolerance. */
  public static defaultMaxError = Constant.oneCentimeter;

  private constructor(
    method: EllipticalArcSampleMethod,
    numSamplesInQuadrant: number,
    maxError: number,
    remapFunction: FractionMapper,
    forcePath: boolean,
  ) {
    this._sampleMethod = method;
    this._numSamplesInQuadrant = numSamplesInQuadrant;
    this._maxError = maxError;
    this._remapFunction = remapFunction;
    this._forcePath = forcePath;
  }
  /**
   * Construct options with optional defaults.
   * @param method sample method, default [[EllipticalArcSampleMethod.AdaptiveSubdivision]].
   * @param numSamplesInQuadrant samples in each full quadrant for interpolation methods, default 4.
   * @param maxError positive maximum distance to ellipse for the subdivision method, default 1cm.
   * @param remapFunction optional callback to remap fraction space for [[EllipticalArcSampleMethod.NonUniformCurvature]],
   * default quadratic. For best results, this function should be a bijection.
   * @param forcePath whether to return a [[Path]] instead of a [[Loop]] when approximating a full elliptical arc,
   * default false.
   */
  public static create(
    method: EllipticalArcSampleMethod = EllipticalArcSampleMethod.AdaptiveSubdivision,
    numSamplesInQuadrant: number = 4,
    maxError: number = this.defaultMaxError,
    remapFunction: FractionMapper = (x: number) => x * x,
    forcePath: boolean = false,
  ) {
    if (numSamplesInQuadrant < 2)
      numSamplesInQuadrant = 2;
    if (maxError <= 0)
      maxError = this.defaultMaxError;
    return new EllipticalArcApproximationOptions(method, numSamplesInQuadrant, maxError, remapFunction, forcePath);
  }
  /** Clone the options. */
  public clone(): EllipticalArcApproximationOptions {
    return new EllipticalArcApproximationOptions(
      this.sampleMethod, this.numSamplesInQuadrant, this.maxError, this.remapFunction, this.forcePath,
    );
  }
  /** Method used to sample the elliptical arc. */
  public get sampleMethod(): EllipticalArcSampleMethod {
    return this._sampleMethod;
  }
  public set sampleMethod(method: EllipticalArcSampleMethod) {
    this._sampleMethod = method;
  }
  /**
   * Number of samples to return in each full quadrant, including endpoint(s).
   * * Used by interpolation sample methods.
   * * In general, for n samples, the approximating [[Path]] consists of n-1 primitives,
   * and the approximating [[Loop]] consists of n primitives.
   * * Minimum value is 2.
   */
  public get numSamplesInQuadrant(): number {
    return this._numSamplesInQuadrant;
  }
  public set numSamplesInQuadrant(numSamples: number) {
    this._numSamplesInQuadrant = numSamples;
  }
  /**
   * Maximum distance (in meters) of the computed approximation to the elliptical arc.
   * * Used by [[EllipticalArcSampleMethod.AdaptiveSubdivision]].
   */
  public get maxError(): number {
    return this._maxError;
  }
  public set maxError(error: number) {
    this._maxError = error;
  }
  /**
   * Callback function to remap fraction space to fraction space.
   * * Used by [[EllipticalArcSampleMethod.NonUniformCurvature]].
   */
  public get remapFunction(): FractionMapper {
    return this._remapFunction;
  }
  public set remapFunction(f: FractionMapper) {
    this._remapFunction = f;
  }
  /** Whether to return a [[Path]] instead of a [[Loop]] when approximating a full (closed) ellipse. */
  public get forcePath(): boolean {
    return this._forcePath;
  }
  public set forcePath(value: boolean) {
    this._forcePath = value;
  }
}

/**
 * Circular or elliptic arc.
 * * The angle to point equation is:
 *   * `X = center + cos(theta) * vector0 + sin(theta) * vector90`
 * * The arc's `sweep` determines the range of theta values (angles). In particular:
 *   * The point at `theta = n*360` degrees is `center + vector0` for any integer n.
 *   * The point at `theta = 90 + n*360` degrees is `center + vector90` for any integer n.
 * * The arc's `sweep` _together with_ `vector0` and `vector90` determine the arc's orientation:
 *   * If `sweep.startDegrees < sweep.endDegrees`, the arc's orientation is counterclockwise with respect to its
 * `perpendicularVector` (i.e., looking at the arc from the head of this vector).
 *   * Similarly, if `sweep.startDegrees > sweep.endDegrees`, the arc's orientation is clockwise with respect to
 * its `perpendicularVector`.
 *   * The arc's orientation is _always_ counterclockwise with respect to its `binormalVector`.
 * * When `vector0` and `vector90` are perpendicular and have equal length, the arc is circular.
 *   * When they are non-perpendicular, the arc is always elliptic.
 *   * When they have unequal length, the arc is always elliptic.
 * * To create an ellipse in standard major-minor axis form:
 *   * `vector0` is the vector from the center to the major axis extreme.
 *   * `vector90` is the vector from the center to the minor axis extreme.
 *   * Note that constructing these vectors to the extreme points makes them perpendicular.
 * * The method [[Arc3d.toScaledMatrix3d]] can be called to convert an arc with unrestricted `vector0` and `vector90`
 * to an arc in standard major-minor axis form.
 * * The unrestricted form is much easier to work with for common calculations: stroking, projection to 2d,
 * intersection with plane.
 * @public
 */
export class Arc3d extends CurvePrimitive implements BeJSONFunctions {
  /** String name for schema properties. */
  public readonly curvePrimitiveType = "arc";
  /** Test if this and other are both instances of Arc3d. */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof Arc3d;
  }
  private _center: Point3d;
  private _matrix: Matrix3d; // columns are [vector0, vector90, unit normal]
  private _sweep: AngleSweep; // sweep limits
  private static _workPointA = Point3d.create();
  private static _workPointB = Point3d.create();
  private static _workPointC = Point3d.create();
  private static _workVectorU = Vector3d.create();
  private static _workVectorV = Vector3d.create();
  private static _workVectorW = Vector3d.create();
  /** Read/write the center. Getter returns clone. */
  public get center(): Point3d {
    return this._center.clone();
  }
  public set center(center: XYAndZ) {
    this._center.setFrom(center);
  }
  /** Read property for (reference to) the arc center. */
  public get centerRef(): Point3d {
    return this._center;
  }
  /**
   * Read property for (clone of) the x-column of the arc matrix.
   * * This vector determines the point on the arc corresponding to angles n*360 degrees.
   */
  public get vector0(): Vector3d {
    return this._matrix.columnX();
  }
  /**
   * Read property for (clone of) the y-column of the arc matrix.
   * * This vector determines the point on the arc corresponding to angles 90 + n*360 degrees.
   */
  public get vector90(): Vector3d {
    return this._matrix.columnY();
  }
  /**
   * Compute an arc binormal vector with arbitrary length.
   * * The arc parameterization is counterclockwise with respect to this vector.
   * * This vector is parallel to [[perpendicularVector]] and possibly opposite.
   */
  public binormalVector(result?: Vector3d): Vector3d {
    const plane = this.fractionToPointAnd2Derivatives(0.0);
    return plane.vectorU.crossProduct(plane.vectorV, result);
  }
  /**
   * Read property for (clone of) the z-column of the arc matrix.
   * * This vector is nominally the normalized cross product: `vector0 x vector90`.
   * * To compute a vector with respect to which the arc sweep is counterclockwise, use [[binormalVector]].
   */
  public get perpendicularVector(): Vector3d {
    return this._matrix.columnZ();
  }
  /** Return a clone of the arc matrix. */
  public matrixClone(): Matrix3d {
    return this._matrix.clone();
  }
  /** Read property for (reference to) the arc matrix. */
  public get matrixRef(): Matrix3d {
    return this._matrix;
  }
  /** Read/write the sweep. Getter returns reference. */
  public get sweep(): AngleSweep {
    return this._sweep;
  }
  public set sweep(value: AngleSweep) {
    this._sweep.setFrom(value);
  }
  /** An Arc3d extends along its complete elliptic arc. */
  public override get isExtensibleFractionSpace(): boolean {
    return true;
  }
  /** Constructor. Captures the inputs. */
  private constructor(center: Point3d, matrix: Matrix3d, sweep: AngleSweep) {
    super();
    this._center = center;
    this._matrix = matrix;
    this._sweep = sweep.clampToFullCircle(sweep);
  }
  /** Return a clone of the arc, with transform applied. */
  public cloneTransformed(transform: Transform): Arc3d {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }
  /**
   * Redefine the arc with (captured references to) given data.
   * @param center arc center.
   * @param matrix matrix with columns vector0, vector90, and their unit cross product.
   * @param sweep angle sweep.
   */
  public setRefs(center: Point3d, matrix: Matrix3d, sweep: AngleSweep) {
    this._center = center;
    this._matrix = matrix;
    this._sweep = sweep;
  }
  /**
   * Redefine the arc with (clones of) given data.
   * @param center arc center.
   * @param matrix matrix with columns vector0, vector90, and their unit cross product.
   * @param sweep angle sweep.
   */
  public set(center: Point3d, matrix: Matrix3d, sweep: AngleSweep | undefined) {
    this.setRefs(center.clone(), matrix.clone(), sweep ? sweep.clone() : AngleSweep.create360());
  }
  /** Copy center, matrix, and sweep from other Arc3d. */
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
   * @param center center point.
   * @param matrix matrix with columns vector0, vector90, and their unit cross product.
   * @param sweep sweep limits.
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
   * @param center center of ellipse.
   * @param matrix the x-column and y-column of this matrix are scaled by `radius0` and `radius90` to define the
   * arc's `vector0` and `vector90`.
   * @param radius0 radius along `vector0`.
   * @param radius90 radius along `vector90`.
   * @param sweep sweep limits.
   * @param result optional preallocated result.
   */
  public static createScaledXYColumns(
    center: Point3d | undefined, matrix: Matrix3d, radius0: number, radius90: number, sweep?: AngleSweep, result?: Arc3d,
  ): Arc3d {
    const vector0 = matrix.columnX();
    const vector90 = matrix.columnY();
    return Arc3d.create(center, vector0.scale(radius0, vector0), vector90.scale(radius90, vector90), sweep, result);
  }
  /**
   * Create a full circle from center, normal and radius.
   * @param center center of circle. If undefined, use 000.
   * @param normal normal vector.
   * @param radius radius of the circle.
   * @param result optional preallocated result.
   */
  public static createCenterNormalRadius(
    center: Point3d | undefined, normal: Vector3d, radius: number, result?: Arc3d,
  ): Arc3d {
    const frame = Matrix3d.createRigidHeadsUp(normal);
    return Arc3d.createScaledXYColumns(center, frame, radius, radius, undefined, result);
  }
  /**
   * Create an elliptical arc by center with vectors to points at 0 and 90 degrees in parameter space.
   * @param center arc center.
   * @param vector0 vector to 0 degrees (commonly major axis).
   * @param vector90 vector to 90 degree point (commonly minor axis).
   * @param sweep sweep limits; defaults to full sweep.
   * @param result optional preallocated result.
   */
  public static create(
    center: Point3d | undefined, vector0: Vector3d, vector90: Vector3d, sweep?: AngleSweep, result?: Arc3d,
  ): Arc3d {
    const normal = vector0.unitCrossProductWithDefault(vector90, 0, 0, 0); // normal will be 000 for degenerate case
    const matrix = Matrix3d.createColumns(vector0, vector90, normal);
    return Arc3d.createRefs(
      center !== undefined ? center.clone() : Point3d.create(0, 0, 0),
      matrix,
      sweep ? sweep.clone() : AngleSweep.create360(),
      result,
    );
  }
  /**
   * Create an elliptical arc from three points on the ellipse: two points on an axis and one in between.
   * @param start start of arc, on an axis.
   * @param middle point on arc somewhere between `start` and `end`.
   * @param end point on arc directly opposite `start`.
   * @param sweep angular sweep, measured from `start` in the direction of `middle`.
   *  For a half-ellipse from `start` to `end` passing through `middle`, pass `AngleSweep.createStartEndDegrees(0,180)`.
   *  Default value is full sweep to create the entire ellipse.
   * @param result optional preallocated result.
   * @returns elliptical arc, or undefined if construction impossible.
   */
  public static createStartMiddleEnd(
    start: XYAndZ, middle: XYAndZ, end: XYAndZ, sweep?: AngleSweep, result?: Arc3d,
  ): Arc3d | undefined {
    const center = Point3d.createAdd2Scaled(start, 0.5, end, 0.5);
    const vector0 = Vector3d.createStartEnd(center, start);
    const vector1 = Vector3d.createStartEnd(center, middle);
    const v0DotV1 = vector0.dotProduct(vector1);
    const v0Len2 = vector0.magnitudeSquared();
    if (Math.abs(v0DotV1) >= v0Len2)
      return undefined; // middle point projects to end of axis or beyond (rules out negative under the radical below)
    const normal = vector0.crossProduct(vector1);
    const vector90 = normal.unitCrossProductWithDefault(vector0, 0, 0, 0);
    const v1DotV90 = vector1.dotProduct(vector90);
    // solve the standard ellipse equation for the unknown axis length, given local coords of middle (v0.v1/||v0||, v90.v1)
    const v90Len = Geometry.safeDivideFraction(v0Len2 * v1DotV90, Math.sqrt(v0Len2 * v0Len2 - v0DotV1 * v0DotV1), 0);
    if (Geometry.isSmallMetricDistanceSquared(v90Len)) // tighter than smallMetricDistance to allow flatter long elliptical arcs
      return undefined;
    vector90.scaleInPlace(v90Len);
    return Arc3d.create(center, vector0, vector90, sweep, result);
  }
  /**
   * Create a circular arc defined by start point, tangent at start point, and end point.
   * * The circular arc is swept from `start` to `end` in the direction of `tangentAtStart`.
   * * If `tangentAtStart` is parallel to the line segment from `start` to `end`, return the line segment.
   */
  public static createCircularStartTangentEnd(
    start: Point3d, tangentAtStart: Vector3d, end: Point3d, result?: Arc3d,
  ): Arc3d | LineSegment3d {
    // see itwinjs-core\core\geometry\internaldocs\Arc3d.md to clarify below algorithm
    const startToEnd = Vector3d.createStartEnd(start, end);
    const frame = Matrix3d.createRigidFromColumns(tangentAtStart, startToEnd, AxisOrder.XYZ);
    if (frame !== undefined) {
      const vv = startToEnd.dotProduct(startToEnd);
      const vw = frame.dotColumnY(startToEnd);
      const radius = Geometry.conditionalDivideCoordinate(vv, 2 * vw);
      if (radius !== undefined) {
        const vector0 = frame.columnY();
        vector0.scaleInPlace(-radius); // center to start
        const vector90 = frame.columnX();
        vector90.scaleInPlace(radius);
        const centerToEnd = vector0.plus(startToEnd);
        const sweepAngle = vector0.angleTo(centerToEnd);
        let sweepRadians = sweepAngle.radians; // always positive and less than PI
        if (tangentAtStart.dotProduct(centerToEnd) < 0.0) // sweepRadians is the wrong way
          sweepRadians = 2.0 * Math.PI - sweepRadians;
        const center = start.plusScaled(vector0, -1.0);
        const sweep = AngleSweep.createStartEndRadians(0.0, sweepRadians);
        return Arc3d.create(center, vector0, vector90, sweep, result);
      }
    }
    return LineSegment3d.create(start, end);
  }
  /**
   * Create a circular arc from start point, tangent at start, radius, optional plane normal, arc sweep.
   * * The vector from start point to center is in the direction of upVector crossed with tangentA.
   * @param start start point.
   * @param tangentAtStart vector in tangent direction at the start.
   * @param radius signed radius.
   * @param upVector optional out-of-plane vector. Defaults to positive Z.
   * @param sweep angular range. If single `Angle` is given, start angle is at 0 degrees (the start point).
   */
  public static createCircularStartTangentRadius(
    start: Point3d, tangentAtStart: Vector3d, radius: number, upVector?: Vector3d, sweep?: Angle | AngleSweep,
  ): Arc3d | undefined {
    if (upVector === undefined)
      upVector = Vector3d.unitZ();
    const vector0 = upVector.unitCrossProduct(tangentAtStart);
    if (vector0 === undefined)
      return undefined;
    const center = start.plusScaled(vector0, radius);
    // reverse the A-to-center vector and bring it up to scale
    vector0.scaleInPlace(-radius);
    const vector90 = tangentAtStart.scaleToLength(Math.abs(radius))!; // cannot fail; prior unitCrossProduct would have failed first
    return Arc3d.create(center, vector0, vector90, AngleSweep.create(sweep));
  }
  /**
   * Create a circular arc defined by start and end points and radius.
   * @param start start point of the arc.
   * @param end end point of the arc.
   * @param helper a third point near the arc in its plane, or a vector in the direction of the arc normal.
   * @returns the constructed arc, or undefined if desired arc cannot be constructed.
   */
  public static createCircularStartEndRadius(start: Point3d, end: Point3d, radius: number, helper: Point3d | Vector3d): Arc3d | undefined {
    // Construct a line segment from start to end. It is a chord of the circle,
    // so the circle center is on its perpendicular bisector.
    const semiChordLen2 = 0.25 * start.distanceSquared(end);
    const radius2 = radius * radius;
    if (radius2 < semiChordLen2)
      return undefined;
    const height = Math.sqrt(radius2 - semiChordLen2); // Pythagoras gives us distance from chord to center
    const normal = Vector3d.createZero(this._workVectorU);
    const vecToCenter = Vector3d.createZero(this._workVectorV);
    // the helper gives us the circle normal
    if (helper instanceof Point3d)
      start.crossProductToPoints(helper, end, normal);
    else
      normal.setFrom(helper);
    // the normal and chord direction give us the side of the chord on which the center resides
    if (!normal.normalizeInPlace() || !normal.crossProductStartEnd(start, end, vecToCenter).scaleToLength(height, vecToCenter))
      return undefined;
    const center = Point3d.createZero();
    start.interpolate(0.5, end, center).addInPlace(vecToCenter);
    const vector0 = Vector3d.createStartEnd(center, start, this._workVectorW);
    const endVector = Vector3d.createStartEnd(center, end, this._workVectorV); // reuse static
    const sweep = AngleSweep.create(vector0.signedAngleTo(endVector, normal));
    const vector90 = normal.crossProduct(vector0, this._workVectorV); // has length radius (reuse static)
    return Arc3d.createRefs(center, Matrix3d.createColumns(vector0, vector90, normal), sweep);
  }

  /**
   * Return a clone of this arc, projected to given z value.
   * * If `z` is omitted, the clone is at the z of the center.
   * * This function projects the arc into a plane parallel to xy-plane.
   * * Note that projection to fixed z can change circle into ellipse (and (rarely) ellipse to circle).
   */
  public cloneAtZ(z?: number): Arc3d {
    if (z === undefined)
      z = this._center.z;
    return Arc3d.createXYZXYZXYZ(
      this._center.x, this._center.y, z,
      this._matrix.coffs[0], this._matrix.coffs[3], 0,
      this._matrix.coffs[1], this._matrix.coffs[4], 0,
      this._sweep,
    );
  }
  /**
   * Create an arc by center (cx,cy,xz) with vectors (ux,uy,uz) and (vx,vy,vz) to points at 0 and 90 degrees in
   * parameter space.
   * @param result optional preallocated result.
   */
  public static createXYZXYZXYZ(
    cx: number, cy: number, cz: number,
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    sweep?: AngleSweep, result?: Arc3d,
  ): Arc3d {
    return Arc3d.create(
      Point3d.create(cx, cy, cz), Vector3d.create(ux, uy, uz), Vector3d.create(vx, vy, vz), sweep, result,
    );
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
  /**
   * Create a circular arc defined by start point, any intermediate point, and end point.
   * If the points are colinear, assemble them into a linestring.
   */
  public static createCircularStartMiddleEnd(
    pointA: XYAndZ, pointB: XYAndZ, pointC: XYAndZ, result?: Arc3d,
  ): Arc3d | LineString3d {
    const vectorAB = Vector3d.createStartEnd(pointA, pointB);
    const vectorAC = Vector3d.createStartEnd(pointA, pointC);
    const ab2 = vectorAB.magnitudeSquared();
    const ac2 = vectorAC.magnitudeSquared();
    const normal = vectorAB.sizedCrossProduct(vectorAC, Math.sqrt(Math.sqrt(ab2 * ac2)));
    if (normal) {
      const vectorToCenter = SmallSystem.linearSystem3d(
        normal.x, normal.y, normal.z,
        vectorAB.x, vectorAB.y, vectorAB.z,
        vectorAC.x, vectorAC.y, vectorAC.z,
        0,         // vectorToCenter DOT normal = 0 (ensure normal is perp to the plane of the 3 points)
        0.5 * ab2, // vectorToCenter DOT vectorAB = ab2 / 2 (ensure the projection of vectorToCenter on AB bisects AB)
        0.5 * ac2, // vectorToCenter DOT vectorAC = ac2 / 2 (ensure the projection of vectorToCenter on AC bisects AC)
      );
      if (vectorToCenter) { // i.e., the negative of vectorX
        const center = Point3d.create(pointA.x, pointA.y, pointA.z).plus(vectorToCenter);
        const vectorX = Vector3d.createStartEnd(center, pointA);
        const vectorY = Vector3d.createRotateVectorAroundVector(vectorX, normal, Angle.createDegrees(90));
        if (vectorY) {
          const vectorCenterToC = Vector3d.createStartEnd(center, pointC);
          const sweepAngle = vectorX.signedAngleTo(vectorCenterToC, normal);
          if (sweepAngle.radians < 0.0)
            sweepAngle.addMultipleOf2PiInPlace(1.0);
          return Arc3d.create(
            center, vectorX, vectorY, AngleSweep.createStartEndRadians(0.0, sweepAngle.radians), result,
          );
        }
      }
    }
    return LineString3d.create(pointA, pointB, pointC);
  }
  /** The arc has simple proportional arc length if and only if it is a circular arc. */
  public override getFractionToDistanceScale(): number | undefined {
    const radius = this.circularRadius();
    if (radius !== undefined)
      return Math.abs(radius * this._sweep.sweepRadians);
    return undefined;
  }
  /**
   * Convert a fractional position to xyz coordinates.
   * @param fraction fractional position on arc.
   * @param result optional preallocated result.
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const radians = this._sweep.fractionToRadians(fraction);
    return this._matrix.originPlusMatrixTimesXY(this._center, Math.cos(radians), Math.sin(radians), result);
  }
  /**
   * Convert fractional arc and radial positions to xyz coordinates.
   * @param fraction fractional position on arc.
   * @param result optional preallocated result.
   */
  public fractionAndRadialFractionToPoint(arcFraction: number, radialFraction: number, result?: Point3d): Point3d {
    const radians = this._sweep.fractionToRadians(arcFraction);
    return this._matrix.originPlusMatrixTimesXY(
      this._center, radialFraction * Math.cos(radians), radialFraction * Math.sin(radians), result,
    );
  }
  /**
   * Convert a fractional position to xyz coordinates and derivative with respect to fraction.
   * @param fraction fractional position on arc.
   * @param result optional preallocated result.
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = this.radiansToPointAndDerivative(this._sweep.fractionToRadians(fraction), result);
    result.direction.scaleInPlace(this._sweep.sweepRadians);
    return result;
  }
  /**
   * Construct a plane with
   * * origin at the fractional position along the arc.
   * * x axis is the first derivative, i.e. tangent along the arc.
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center.
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const radians = this._sweep.fractionToRadians(fraction);
    if (!result)
      result = Plane3dByOriginAndVectors.createXYPlane();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    this._matrix.originPlusMatrixTimesXY(this._center, c, s, result.origin);
    const a = this._sweep.sweepRadians;
    this._matrix.multiplyXY(-a * s, a * c, result.vectorU);
    const aa = a * a;
    this._matrix.multiplyXY(-aa * c, -aa * s, result.vectorV);
    return result;
  }
  /**
   * Evaluate the point and derivative with respect to the angle (in radians).
   * @param radians angular position.
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
   * Evaluate the point with respect to the angle (in radians).
   * @param radians angular position.
   * @param result optional preallocated ray.
   */
  public radiansToPoint(radians: number, result?: Point3d): Point3d {
    result = result ? result : Point3d.create();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    this._matrix.originPlusMatrixTimesXY(this._center, c, s, result);
    return result;
  }
  /**
   * Return a parametric plane with
   * * origin at arc center.
   * * vectorU from center to arc at angle (in radians).
   * * vectorV from center to arc at 90 degrees past the angle.
   * @param radians angular position.
   * @param result optional preallocated plane.
   */
  public radiansToRotatedBasis(radians: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    result = result ? result : Plane3dByOriginAndVectors.createXYPlane();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    result.origin.setFromPoint3d(this.center);
    this._matrix.multiplyXY(c, s, result.vectorU);
    this._matrix.multiplyXY(-s, c, result.vectorV);
    return result;
  }
  /**
   * Evaluate the point and derivative with respect to the angle (in radians).
   * @param theta angular position.
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
   * Return the start point of the arc.
   * @param result optional preallocated result.
   */
  public override startPoint(result?: Point3d): Point3d {
    return this.fractionToPoint(0.0, result);
  }
  /**
   * Return the end point of the arc.
   * @param result optional preallocated result.
   */
  public override endPoint(result?: Point3d): Point3d {
    return this.fractionToPoint(1.0, result);
  }
  /** * If this is a circular arc, return the simple length derived from radius and sweep.
   * * Otherwise (i.e. if this elliptical) fall through to CurvePrimitive base implementation which
   *     Uses quadrature.
   */
  public override curveLength(): number {
    return this.curveLengthBetweenFractions(0, 1);
  }
  /**
   * Gauss point quadrature count for evaluating curve length. (The number of intervals is adjusted to the arc sweep).
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use correct spelling quadratureGaussCount.
   */
  public static readonly quadratureGuassCount = 5;
  /** Gauss point quadrature count for evaluating curve length. (The number of intervals is adjusted to the arc sweep). */
  public static readonly quadratureGaussCount = 5;
  /** In quadrature for arc length, use this interval (divided by quickEccentricity). */
  public static readonly quadratureIntervalAngleDegrees = 10.0;
  /**
   * * If this is a circular arc, return the simple length derived from radius and sweep.
   * * Otherwise (i.e. if this elliptical) fall through CurvePrimitive integrator.
   */
  public override curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
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
    return super.curveLengthWithFixedIntervalCountQuadrature(f0, f1, numInterval, Arc3d.quadratureGaussCount);
  }
  /**
   * Return an approximate (but easy to compute) arc length.
   * The estimate is:
   * * Form 8 chords on full circle, proportionally fewer for partials (but 2 extras if less than half circle).
   * * Sum the chord lengths.
   * * For a circle, we know this crude approximation has to be increased by a factor (theta/(2*sin(theta/2))).
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
   * * See extended comments on `CurvePrimitive.moveSignedDistanceFromFraction`.
   * * A zero length line generates `CurveSearchStatus.error`.
   * * Nonzero length line generates `CurveSearchStatus.success` or `CurveSearchStatus.stoppedAtBoundary`.
   */
  public override moveSignedDistanceFromFraction(
    startFraction: number, signedDistance: number, allowExtension: false, result?: CurveLocationDetail,
  ): CurveLocationDetail {
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
   * Return all radian angles where the ellipse tangent is perpendicular to the vector to a spacePoint.
   * @param spacePoint point of origin of vectors to the ellipse.
   * @param _extend always true. Sweep is ignored: perpendiculars for the full ellipse are returned.
   * @param endpoints if true, force the end radians into the result.
   */
  public allPerpendicularAngles(spacePoint: Point3d, _extend: boolean = true, endpoints: boolean = false): number[] {
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
      0.0,
      radians,
    );
    if (endpoints) {
      radians.push(this.sweep.startRadians);
      radians.push(this.sweep.endRadians);
    }
    return radians;
  }
  /**
   * Return details of the closest point on the arc, optionally extending to full ellipse.
   * @param spacePoint search for point closest to this point.
   * @param extend if true, consider projections to the complete ellipse. If false, consider only endpoints and
   * projections within the arc sweep.
   * @param result optional preallocated result.
   */
  public override closestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = CurveLocationDetail.create(this, result);
    const allRadians = this.allPerpendicularAngles(spacePoint, true, true);
    let extend0 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 0);
    let extend1 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 1);
    // distinct extends for cyclic space are awkward ....
    if (this._sweep.isFullCircle) {
      extend0 = CurveExtendMode.None;
      extend1 = CurveExtendMode.None;
    }
    if (extend0 !== CurveExtendMode.None && extend1 !== CurveExtendMode.None) {
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
        const fraction = CurveExtendOptions.resolveRadiansToSweepFraction(extend, radians, this.sweep);
        if (fraction !== undefined) {
          this.fractionToPointAndDerivative(fraction, workRay);

          d = spacePoint.distance(workRay.origin);
          if (d < dMin) {
            dMin = d;
            result.setFR(fraction, workRay);
            result.a = d;
          }
        }
      }
    }
    return result;
  }
  /** Override of [[CurvePrimitive.emitTangents]] for Arc3d. */
  public override emitTangents(
    spacePoint: Point3d, announceTangent: (tangent: CurveLocationDetail) => any, options?: TangentOptions,
  ): void {
    const centerToPoint = Vector3d.createStartEnd(this.centerRef, spacePoint);
    let centerToLocalPoint: Vector3d | undefined;
    if (options?.vectorToEye) {
      const arcToView = Matrix3d.createColumns(this.matrixRef.getColumn(0), this.matrixRef.getColumn(1), options.vectorToEye);
      centerToLocalPoint = arcToView.multiplyInverse(centerToPoint);
    } else {
      centerToLocalPoint = this.matrixRef.multiplyInverse(centerToPoint)!;
    }
    if (centerToLocalPoint === undefined)
      return;
    // centerToLocalPoint is a vector in the local coordinate system of the as-viewed arc.
    // In other words, the local arc is the unit circle.
    // alpha is the angle from the local x-axis to centerToLocalPoint.
    // beta is the nonnegative angle from centerToLocalPoint to a tangency radial.
    // Tangency angles are preserved by local <-> world transformation.
    if (centerToLocalPoint !== undefined) {
      const hypotenuseSquared = centerToLocalPoint.magnitudeSquaredXY();
      if (hypotenuseSquared >= 1.0) { // localPoint lies outside or on the unit circle...
        // ...and forms a right triangle with unit radial leg to tangent point
        const distanceToTangency = Math.sqrt(hypotenuseSquared - 1.0);
        const alpha = Math.atan2(centerToLocalPoint.y, centerToLocalPoint.x);
        const beta = Math.atan2(distanceToTangency, 1);
        const angles = Geometry.isSmallAngleRadians(beta) ? [alpha] : [alpha + beta, alpha - beta];
        for (const theta of angles) {
          const f = CurveExtendOptions.resolveRadiansToValidSweepFraction(options?.extend ?? false, theta, this.sweep);
          if (f.isValid) {
            const tangent = CurveLocationDetail.createCurveFractionPoint(this, f.fraction, this.fractionToPoint(f.fraction));
            announceTangent(tangent);
          }
        }
      }
    }
  }
  /** Reverse the sweep  of the arc. */
  public reverseInPlace(): void {
    this._sweep.reverseInPlace();
  }
  /**
   * Apply a transform to the arc basis vectors.
   * * nonuniform (i.e. skewing) transforms are allowed.
   * * The transformed vector0 and vector90 are NOT squared up as major minor axes (this is a good feature).
   */
  public tryTransformInPlace(transform: Transform): boolean {
    this._center = transform.multiplyPoint3d(this._center, this._center);
    this._matrix = transform.matrix.multiplyMatrixMatrix(this._matrix, this._matrix);
    // force re-normalization of columnZ.
    this.setVector0Vector90(this._matrix.columnX(), this._matrix.columnY());
    return true;
  }
  /** Return true if the ellipse center and basis vectors are in the plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    const normal = plane.getNormalRef();
    // The ellipse vectors are full-length  -- true distance comparisons say things.
    return Geometry.isSmallMetricDistance(plane.altitude(this._center))
      && Geometry.isSmallMetricDistance(this._matrix.dotColumnX(normal))
      && Geometry.isSmallMetricDistance(this._matrix.dotColumnY(normal));
  }
  /** Return true if the vector0 and vector90 are of equal length and perpendicular. */
  public get isCircular(): boolean {
    const axx = this._matrix.columnXMagnitudeSquared();
    const ayy = this._matrix.columnYMagnitudeSquared();
    const axy = this._matrix.columnXDotColumnY();
    return Angle.isPerpendicularDotSet(axx, ayy, axy) && Geometry.isSameCoordinateSquared(axx, ayy);
  }
  /** Return radius if the vector0 and vector90 are of equal length and perpendicular. Ignores z. */
  public circularRadiusXY(): number | undefined {
    const ux = this._matrix.at(0, 0);
    const uy = this._matrix.at(1, 0);
    const vx = this._matrix.at(0, 1);
    const vy = this._matrix.at(1, 1);
    const dotUU = Geometry.dotProductXYXY(ux, uy, ux, uy);
    const dotVV = Geometry.dotProductXYXY(vx, vy, vx, vy);
    const dotUV = Geometry.dotProductXYXY(ux, uy, vx, vy);
    if (Angle.isPerpendicularDotSet(dotUU, dotVV, dotUV) && Geometry.isSameCoordinateSquared(dotUU, dotVV))
      return Geometry.hypotenuseXY(ux, uy);
    return undefined;
  }
  /** If the arc is circular, return its radius. Otherwise return undefined. */
  public circularRadius(): number | undefined {
    return this.isCircular ? this._matrix.columnXMagnitude() : undefined;
  }

  /** Return the larger length of the two defining vectors. */
  public maxVectorLength(): number {
    return Math.max(this._matrix.columnXMagnitude(), this._matrix.columnYMagnitude());
  }
  /**
   * Compute intersections with a plane.
   * @param plane plane to intersect.
   * @param result array of locations on the curve.
   */
  public override appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
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
        const detail = CurveLocationDetail.createCurveFractionPoint(this, fraction, this.fractionToPoint(fraction));
        detail.intervalRole = CurveIntervalRole.isolated;
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._sweep.startRadians))
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
        else if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._sweep.endRadians))
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
        result.push(detail);
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
    this.extendRangeInSweep(range, this._sweep, transform);
  }
  /**
   * Extend a range to include the range of the arc, using specified range in place of the arc range.
   * @param range range being extended.
   * @param transform optional transform to apply to the arc.
   */
  public extendRangeInSweep(range: Range3d, sweep: AngleSweep, transform?: Transform): void {
    const trigForm = new SineCosinePolynomial(0, 0, 0);
    const center = this._center.clone(Arc3d._workPointA);
    const vectorU = this._matrix.columnX(Arc3d._workVectorU);
    const vectorV = this._matrix.columnY(Arc3d._workVectorV);
    if (transform) {
      transform.multiplyPoint3d(center, center);
      transform.multiplyVector(vectorU, vectorU);
      transform.multiplyVector(vectorV, vectorV);
    }
    const lowPoint = Arc3d._workPointB;
    const highPoint = Arc3d._workPointC;
    const range1 = Range1d.createNull();
    for (let i = 0; i < 3; i++) {
      trigForm.set(center.at(i), vectorU.at(i), vectorV.at(i));
      trigForm.rangeInSweep(sweep, range1);
      lowPoint.setAt(i, range1.low);
      highPoint.setAt(i, range1.high);
    }
    range.extend(lowPoint);
    range.extend(highPoint);
  }
  /**
   * Returns a (high accuracy) range of the curve between fractional positions.
   * * Default implementation returns teh range of the curve from clonePartialCurve.
   */
  public override rangeBetweenFractions(fraction0: number, fraction1: number, transform?: Transform): Range3d {
    const sweep = AngleSweep.createStartEndRadians(
      this.sweep.fractionToRadians(fraction0), this.sweep.fractionToRadians(fraction1),
    );
    const range = Range3d.create();
    this.extendRangeInSweep(range, sweep, transform);
    return range;
  }
  /**
   * Set up a SineCosinePolynomial as the function c+u*cos(theta)+v*sin(theta) where
   * c,u,v are coefficients obtained by evaluating altitude and velocity relative to the plane.
   * @param plane plane for altitude calculation.
   * @param result optional result.
   * @internal
   */
  public getPlaneAltitudeSineCosinePolynomial(
    plane: PlaneAltitudeEvaluator, result?: SineCosinePolynomial,
  ): SineCosinePolynomial {
    if (!result)
      result = new SineCosinePolynomial(0, 0, 0);
    // altitude function of angle t, given plane with origin o and unit normal n:
    //  A(t) = (c + u cos(t) + v sin(t)) . n = (c-o).n + u.n cos(t) + v.n sin(t)
    // Note the different functions for computing dot product against a point vs. a vector!
    result.set(plane.altitude(this._center),
      plane.velocityXYZ(this._matrix.coffs[0], this._matrix.coffs[3], this._matrix.coffs[6]),
      plane.velocityXYZ(this._matrix.coffs[1], this._matrix.coffs[4], this._matrix.coffs[7]));
    return result;
  }
  /** Create a new arc which is a unit circle in the xy-plane centered at the origin. */
  public static createUnitCircle(): Arc3d {
    return Arc3d.createRefs(Point3d.create(0, 0, 0), Matrix3d.createIdentity(), AngleSweep.create360());
  }
  /**
   * Create a new arc which is parallel to the xy plane, with given center and radius and optional angle sweep.
   * @param center center of arc.
   * @param radius radius of arc.
   * @param sweep sweep limits; defaults to full circle.
   */
  public static createXY(center: Point3d, radius: number, sweep: AngleSweep = AngleSweep.create360()): Arc3d {
    return new Arc3d(center.clone(), Matrix3d.createScale(radius, radius, 1.0), sweep.clone());
  }
  /**
   * Create a new arc which is parallel to the xy plane, with given center and x,y radii, and optional angle sweep
   * @param center center of ellipse.
   * @param radiusA x axis radius.
   * @param radiusB y axis radius.
   * @param sweep angle sweep.
   */
  public static createXYEllipse(
    center: Point3d,
    radiusA: number,
    radiusB: number,
    sweep: AngleSweep = AngleSweep.create360()): Arc3d {
    return new Arc3d(center.clone(), Matrix3d.createScale(radiusA, radiusB, 1.0), sweep.clone());
  }
  /**
   * Replace the arc's 0 and 90 degree vectors.
   * @param vector0 vector from center to ellipse point at 0 degrees in parameter space.
   * @param vector90 vector from center to ellipse point at 90 degrees in parameter space.
   */
  public setVector0Vector90(vector0: Vector3d, vector90: Vector3d) {
    this._matrix.setColumns(vector0, vector90,
      vector0.unitCrossProductWithDefault(vector90, 0, 0, 0), // normal will be 000 for degenerate case
    );
  }
  /**
   * Return the symmetric definition of the arc, with rigid axes and radii.
   * * The caller can send the returned data into [[createScaledXYColumns]] to construct the major-minor axis
   * version of the instance arc. This formulation of the arc has the same shape, but has perpendicular axes,
   * from which the arc's symmetry is readily apparent.
   */
  public toScaledMatrix3d(): { center: Point3d, axes: Matrix3d, r0: number, r90: number, sweep: AngleSweep } {
    const angleData = Angle.dotProductsToHalfAngleTrigValues(
      this._matrix.columnXMagnitudeSquared(),
      this._matrix.columnYMagnitudeSquared(),
      this._matrix.columnXDotColumnY(),
      true,
    );
    const vector0A = this._matrix.multiplyXY(angleData.c, angleData.s);
    const vector90A = this._matrix.multiplyXY(-angleData.s, angleData.c);
    const axes = Matrix3d.createRigidFromColumns(vector0A, vector90A, AxisOrder.XYZ);
    return {
      center: this._center.clone(),
      axes: (axes ? axes : Matrix3d.createIdentity()),
      r0: vector0A.magnitude(),
      r90: vector90A.magnitude(),
      sweep: this.sweep.cloneMinusRadians(angleData.radians),
    };
  }
  /** Return the arc definition with center, two vectors, and angle sweep. */
  public toVectors(): ArcVectors {
    return {
      center: this.center.clone(),
      vector0: this._matrix.columnX(),
      vector90: this._matrix.columnY(),
      sweep: this.sweep.clone(),
    };
  }
  /** Return the arc definition with center, two vectors, and angle sweep, optionally transformed. */
  public toTransformedVectors(
    transform?: Transform,
  ): { center: Point3d, vector0: Vector3d, vector90: Vector3d, sweep: AngleSweep } {
    return transform ? {
      center: transform.multiplyPoint3d(this._center),
      vector0: transform.multiplyVector(this._matrix.columnX()),
      vector90: transform.multiplyVector(this._matrix.columnY()),
      sweep: this.sweep.clone(),
    }
      : {
        center: this._center.clone(),
        vector0: this._matrix.columnX(),
        vector90: this._matrix.columnY(),
        sweep: this.sweep.clone(),
      };
  }
  /** Return the arc definition with center, two vectors, and angle sweep, transformed to 4d points. */
  public toTransformedPoint4d(
    matrix: Matrix4d,
  ): { center: Point4d, vector0: Point4d, vector90: Point4d, sweep: AngleSweep } {
    return {
      center: matrix.multiplyPoint3d(this._center, 1.0),
      vector0: matrix.multiplyPoint3d(this._matrix.columnX(), 0.0),
      vector90: matrix.multiplyPoint3d(this._matrix.columnY(), 0.0),
      sweep: this.sweep.clone(),
    };
  }
  /**
   * Set this arc from a json object with these values:
   * * center center point.
   * * vector0 vector from center to 0 degree point in parameter space (commonly but not always the major axis vector).
   * * vector90 vector from center to 90 degree point in parameter space (commonly but not always the minor axis vector).
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
  /** Test if this arc is almost equal to another GeometryQuery object. */
  public override isAlmostEqual(otherGeometry: GeometryQuery, distanceTol: number = Geometry.smallMetricDistance, radianTol: number = Geometry.smallAngleRadians): boolean {
    if (otherGeometry instanceof Arc3d) {
      const other = otherGeometry;
      return this._center.isAlmostEqual(other._center, distanceTol)
        && this._matrix.isAlmostEqual(other._matrix, distanceTol)
        && this._sweep.isAlmostEqualAllowPeriodShift(other._sweep, radianTol);
    }
    return false;
  }
  /** Emit strokes to caller-supplied linestring. */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const numStrokes = this.computeStrokeCountForOptions(options);
    dest.appendFractionalStrokePoints(this, numStrokes, 0.0, 1.0, true);
  }
  /** Emit strokes to caller-supplied handler. */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const numStrokes = this.computeStrokeCountForOptions(options);
    handler.startCurvePrimitive(this);
    handler.announceIntervalForUniformStepStrokes(this, numStrokes, 0.0, 1.0);
    handler.endCurvePrimitive(this);
  }
  /**
   * Return the stroke count required for given options.
   * @param options StrokeOptions that determine count.
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    let numStroke;
    if (options) {
      const rMax = this.maxVectorLength();
      numStroke = options.applyTolerancesToArc(rMax, this._sweep.sweepRadians);
    } else {
      numStroke = StrokeOptions.applyAngleTol(undefined, 1, this._sweep.sweepRadians);
    }
    return numStroke;
  }
  /** Second step of double dispatch: call `handler.handleArc3d(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleArc3d(this);
  }
  /**
   * Return (if possible) an arc which is a portion of this curve.
   * @param fractionA start fraction.
   * @param fractionB end fraction.
   */
  public override clonePartialCurve(fractionA: number, fractionB: number): Arc3d {
    if (fractionB < fractionA) {
      const arcA = this.clonePartialCurve(fractionB, fractionA);
      arcA.reverseInPlace();
      return arcA;
    }
    const arcB = this.clone();
    arcB.sweep.setStartEndRadians(
      this.sweep.fractionToRadians(fractionA),
      this.sweep.fractionToRadians(fractionB),
    );
    return arcB;
  }
  /**
   * Return an arc whose basis vectors are rotated by given angle within the current basis space.
   * * The returned arc will have `vector0 = this.vector0 * cos(theta) + this.vector90 * sin(theta)`.
   * * The returned arc has the same shape as the instance.
   *   * In other words, the arc's sweep is adjusted so that all fractional parameters evaluate to the same points.
   *   * Specifically, theta is subtracted from the original start and end angles.
   * @param theta the angle (in the input arc space) which is to become the 0-degree point in the new arc.
   */
  public cloneInRotatedBasis(theta: Angle): Arc3d {
    const c = theta.cos();
    const s = theta.sin();
    const vector0 = this._matrix.multiplyXY(c, s);
    const vector90 = this._matrix.multiplyXY(-s, c);
    const newSweep = AngleSweep.createStartEndRadians(
      this._sweep.startRadians - theta.radians, this._sweep.endRadians - theta.radians,
    );
    const arcB = Arc3d.create(this._center.clone(), vector0, vector90, newSweep);
    return arcB;
  }
  /**
   * Return a cloned arc with basis rotated to align with the global axes. The arc's shape is unchanged.
   * * This method is most useful when the instance is an xy-circular arc, for then the aligned arc's stored sweep
   * angles can be understood as being measured from the global positive x-axis to the arc's start/end. This is *not*
   * the case for xy-elliptical arcs: the parameter angle difference between two points on an ellipse is in general
   * not the same as the angle measured between their radials.
   * * For an xy instance, the output arc will have:
   *   * vector0 is in the same direction as the positive x-axis
   *   * perpendicularVector is in the same direction as the positive z-axis
   * * For a general instance, the output arc will have:
   *   * vector0 is in the same direction as the projection of the positive x-axis vector onto the arc plane
   *   * perpendicularVector lies in the halfspace z >= 0
   * @returns cloned arc, or undefined (if the instance normal is parallel to the x-axis, or its matrix is singular)
   */
  public cloneAxisAligned(): Arc3d | undefined {
    const plane = Plane3dByOriginAndUnitNormal.create(this.center, this.perpendicularVector.crossProduct(Vector3d.unitX()));
    if (!plane)
      return undefined;
    const axisPts: CurveLocationDetail[] = [];
    if (2 !== this.appendPlaneIntersectionPoints(plane, axisPts))
      return undefined;
    const iAxisPt = plane.getNormalRef().dotProduct(this.perpendicularVector.crossProductStartEnd(this.center, axisPts[0].point)) > 0.0 ? 0 : 1;
    const toUnitX = this.sweep.fractionToAngle(axisPts[iAxisPt].fraction);
    const arc1 = this.cloneInRotatedBasis(toUnitX); // rotate in arc's plane
    if (this.perpendicularVector.dotProduct(Vector3d.unitZ()) < -Geometry.smallAngleRadians) {
      if (this.matrixRef.isSingular())
        return undefined;
      const flip = Matrix3d.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1); // rotate 180 degrees around arc's local x-axis
      arc1.matrixRef.multiplyMatrixMatrix(flip, arc1.matrixRef);
      arc1.sweep.setStartEndDegrees(-arc1.sweep.startDegrees, -arc1.sweep.endDegrees); // rotation alone is insufficient to flip
    }
    return arc1;
  }
  /**
   * Find intervals of this CurvePrimitive that are interior to a clipper.
   * @param clipper clip structure (e.g.clip planes).
   * @param announce (optional) function to be called announcing fractional intervals
   * `announce(fraction0, fraction1, curvePrimitive)`.
   * @returns true if any "in" segments are announced.
   */
  public override announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    return clipper.announceClippedArcIntervals(this, announce);
  }
  /** Compute the center and vectors of another arc as local coordinates within this arc's frame. */
  public otherArcAsLocalVectors(other: Arc3d): ArcVectors | undefined {
    const otherOrigin = this._matrix.multiplyInverseXYZAsPoint3d(
      other.center.x - this.center.x,
      other.center.y - this.center.y,
      other.center.z - this.center.z,
    );
    const otherVector0 = this._matrix.multiplyInverse(other.vector0);
    const otherVector90 = this._matrix.multiplyInverse(other.vector90);
    if (otherOrigin && otherVector0 && otherVector90) {
      return {
        center: otherOrigin,
        vector0: otherVector0,
        vector90: otherVector90,
        sweep: this.sweep.clone(),
      };
    }
    return undefined;
  }
  /**
   * Determine an arc "at a point of inflection" of a point sequence.
   * * Return the arc along with the fractional positions of the tangency points.
   * * In the returned object:
   *   * `arc` is the (bounded) arc.
   *   * `fraction10` is the tangency point's position as an interpolating fraction of the line segment from
   * `point1` (backwards) to `point0`.
   *   * `fraction12` is the tangency point's position as an interpolating fraction of the line segment from
   * `point1` (forward) to `point2`.
   *   * `point` is the `point1` input.
   * * If unable to construct the arc:
   *   * `point` is the `point1` input.
   *   * both fractions are zero.
   *   * `arc` is undefined.
   * @param point0 first point of path (the point before the point of inflection).
   * @param point1 second point of path (the point of inflection).
   * @param point2 third point of path (the point after the point of inflection).
   * @param radius arc radius.
   *
   */
  public static createFilletArc(point0: Point3d, point1: Point3d, point2: Point3d, radius: number): ArcBlendData {
    const vector10 = Vector3d.createStartEnd(point1, point0);
    const vector12 = Vector3d.createStartEnd(point1, point2);
    const d10 = vector10.magnitude();
    const d12 = vector12.magnitude();
    if (vector10.normalizeInPlace() && vector12.normalizeInPlace()) {
      const bisector = vector10.plus(vector12);
      if (bisector.normalizeInPlace()) {
        // const theta = vector12.angleTo(bisector);
        // vector10, vector12, and bisector are UNIT vectors
        // bisector splits the angle between vector10 and vector12
        const perpendicular = vector12.minus(vector10);
        const perpendicularMagnitude = perpendicular.magnitude();  // == 2 * sin(theta)
        const sinTheta = 0.5 * perpendicularMagnitude;
        if (!Geometry.isSmallAngleRadians(sinTheta)) {  // (for small theta, sinTheta is almost equal to theta)
          const cosTheta = Math.sqrt(1 - sinTheta * sinTheta);
          const tanTheta = sinTheta / cosTheta;
          const alphaRadians = Math.acos(sinTheta);
          const distanceToCenter = radius / sinTheta;
          const distanceToTangency = radius / tanTheta;
          const f10 = distanceToTangency / d10;
          const f12 = distanceToTangency / d12;
          const center = point1.plusScaled(bisector, distanceToCenter);
          bisector.scaleInPlace(-radius);
          perpendicular.scaleInPlace(radius / perpendicularMagnitude);
          const arc02 = Arc3d.create(center, bisector, perpendicular, AngleSweep.createStartEndRadians(-alphaRadians, alphaRadians));
          return { arc: arc02, fraction10: f10, fraction12: f12, point: point1.clone() };
        }
      }
    }
    return { fraction10: 0.0, fraction12: 0.0, point: point1.clone() };
  }
  /** Scale the vector0 and vector90 vectors by `scaleFactor`. */
  public scaleAboutCenterInPlace(scaleFactor: number) {
    this._matrix.scaleColumnsInPlace(scaleFactor, scaleFactor, 1.0);
  }
  /** Return the (signed) area between (a fractional portion of) the arc and the chord between those points. */
  public areaToChordXY(fraction0: number, fraction1: number): number {
    let detJ = Geometry.crossProductXYXY(
      this._matrix.coffs[0], this._matrix.coffs[3],
      this._matrix.coffs[1], this._matrix.coffs[4],
    );
    // areas in arc of unit circle with radians limits
    const radians0 = this._sweep.fractionToRadians(fraction0);
    const radians1 = this._sweep.fractionToRadians(fraction1);
    // const midRadians = 0.5 * (radians0 + radians1);
    const alpha = 0.5 * (radians1 - radians0);
    if (alpha < 0.0)
      detJ = -detJ;
    const wedgeArea = Math.cos(alpha) * Math.sin(alpha);
    return (alpha - wedgeArea) * detJ;
  }
  /**
   * Construct an offset of the instance curve as viewed in the xy-plane (ignoring z).
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve), or options object.
   */
  public override constructOffsetXY(
    offsetDistanceOrOptions: number | OffsetOptions,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    const options = OffsetOptions.create(offsetDistanceOrOptions);
    if (this.isCircular || options.preserveEllipticalArcs) {
      const arcXY = this.cloneAtZ();
      const sign = arcXY.sweep.sweepRadians * arcXY.matrixRef.coffs[8] >= 0.0 ? 1.0 : -1.0;
      const r0 = arcXY.matrixRef.columnXMagnitude();
      const r0new = r0 - sign * options.leftOffsetDistance;
      const r90 = this.isCircular ? r0 : arcXY.matrixRef.columnYMagnitude();
      const r90new = this.isCircular ? r0new : r90 - sign * options.leftOffsetDistance;
      if (
        !Geometry.isSmallMetricDistance(r0new)
        && (r0 * r0new > 0.0)
        && (this.isCircular || (!Geometry.isSmallMetricDistance(r90new) && (r90 * r90new > 0.0)))
      ) {
        const factor0 = r0new / r0;
        const factor90 = this.isCircular ? factor0 : r90new / r90;
        const matrix = arcXY.matrixClone();
        matrix.scaleColumnsInPlace(factor0, factor90, 1.0);
        return Arc3d.createRefs(arcXY.center.clone(), matrix, arcXY.sweep.clone());
      } else {
        return undefined; // zero radius
      }
    }
    // default impl
    const handler = new CurveOffsetXYHandler(this, options.leftOffsetDistance);
    this.emitStrokableParts(handler, options.strokeOptions);
    return handler.claimResult();
  }
  /**
   * Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters of projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output.
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the end of the ray.
   */
  public override projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
  /**
   * Construct a circular arc chain approximation to the instance elliptical arc.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/ArcApproximationGeneral and
   *  https://www.itwinjs.org/sandbox/SaeedTorabi/ArcApproximation
   * @param options bundle of options for sampling an elliptical arc (use default options if undefined).
   * @returns the approximating curve chain, the circular instance, or undefined if construction fails.
   */
  public constructCircularArcChainApproximation(options?: EllipticalArcApproximationOptions): CurveChain | Arc3d | undefined {
    if (!options)
      options = EllipticalArcApproximationOptions.create();
    const context = EllipticalArcApproximationContext.create(this);
    const result = context.constructCircularArcChainApproximation(options);
    if (!result && this.isCircular)
      return (this.sweep.isFullCircle && options.forcePath) ? Path.create(this) : this;
    return result;
  }
}
