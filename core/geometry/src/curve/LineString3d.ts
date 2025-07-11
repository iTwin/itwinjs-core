/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { Clipper } from "../clipping/ClipUtils";
import { AxisOrder, BeJSONFunctions, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYArray } from "../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { MultiLineStringDataVariant } from "../geometry3d/IndexedXYZCollection";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PointStreamGrowableXYZArrayCollector, VariantPointDataStream } from "../geometry3d/PointStreaming";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { XAndY, XYZProps } from "../geometry3d/XYZProps";
import { CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveIntervalRole, CurveLocationDetail, CurveSearchStatus } from "./CurveLocationDetail";
import { AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { LineSegment3d } from "./LineSegment3d";
import { OffsetOptions } from "./OffsetOptions";
import { StrokeCountMap } from "./Query/StrokeCountMap";
import { StrokeOptions } from "./StrokeOptions";

/**
 * Starting with the segment at (baseIndex, baseIndex + 1):
 * * If the segment vector and vectorA determine a normal, accumulate it (scaled) to normal, and return.
 * * Otherwise move to next/previous segment if stepDirection is positive/negative and repeat.
 * * Do nothing if everything is parallel through the end of the array.
 */
function accumulateGoodUnitPerpendicular(
  points: GrowableXYZArray,
  vectorA: Vector3d,
  baseIndex: number,
  stepDirection: number,
  weight: number,
  normal: Vector3d,
  workVector: Vector3d,
): boolean {
  const n = points.length;
  if (stepDirection > 0) {
    for (let i = baseIndex; i + 1 < n; i++) {
      points.vectorIndexIndex(i, i + 1, workVector);
      vectorA.crossProduct(workVector, workVector);
      if (workVector.normalizeInPlace()) {
        normal.addScaledInPlace(workVector, weight);
        if (normal.isAlmostEqualXYZ(0, 0, 0, Geometry.smallFraction))
          workVector.scale(-weight, normal); // Concavity changed! Revert to previous
        return true;
      }
    }
  } else {
    if (baseIndex + 1 >= n)
      baseIndex = n - 2;
    for (let i = baseIndex; i >= 0; i--) {
      points.vectorIndexIndex(i, i + 1, workVector);
      workVector.crossProduct(vectorA, workVector);
      if (workVector.normalizeInPlace()) {
        normal.addScaledInPlace(workVector, weight);
        if (normal.isAlmostEqualXYZ(0, 0, 0, Geometry.smallFraction))
          workVector.scale(-weight, normal); // Concavity changed! Revert to previous
        return true;
      }
    }
  }
  return false;
}

/**
 * * A LineString3d (sometimes called a PolyLine) is a sequence of xyz coordinates that are to be joined by line
 * segments.
 * * The point coordinates are stored in a GrowableXYZArray, not as full point objects.
 * * The parameterization of "fraction along" is
 *    * In a linestring with `N` segments (i.e. `N+1` points), each segment (regardless of physical length) occupies
 * the same fraction (1/N) of the 0-to-1 fraction space.
 *    * Within segment `i`, the fraction interval `i/N` to `(i+1)/N` is mapped proportionally to the segment
 *    * Note that this `fraction` is therefore NOT fraction of true distance along.
 *    * Use `moveSignedDistanceFromFraction` to do true-length evaluations.
 * @public
 */
export class LineString3d extends CurvePrimitive implements BeJSONFunctions {
  /** String name for schema properties */
  public readonly curvePrimitiveType = "lineString";
  private static _workPointA = Point3d.create();
  private static _workPointB = Point3d.create();
  private static _workPointC = Point3d.create();
  private static _workRay = Ray3d.createXAxis();
  /** test if `other` is an instance of `LineString3d` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof LineString3d;
  }
  /** A LineString3d extends along its first and final segments. */
  public override get isExtensibleFractionSpace(): boolean {
    return true;
  }
  private _points: GrowableXYZArray;
  private _fractions?: GrowableFloat64Array;
  private _uvParams?: GrowableXYArray;
  private _derivatives?: GrowableXYZArray;
  private _surfaceNormals?: GrowableXYZArray;
  private _pointIndices?: GrowableFloat64Array;
  private _uvIndices?: GrowableFloat64Array;
  private _normalIndices?: GrowableFloat64Array;
  /** Return the points array (cloned). */
  public get points(): Point3d[] {
    return this._points.getPoint3dArray();
  }
  /** Return (reference to) point data in packed GrowableXYZArray. */
  public get packedPoints(): GrowableXYZArray {
    return this._points;
  }
  /**
   * Return array of fraction parameters.
   * * These are only present during certain constructions such as faceting.
   * * When present, these fractions are fractions of some other curve being stroked, and are NOT related to the
   * linestring fraction parameters.
   */
  public get fractions(): GrowableFloat64Array | undefined {
    return this._fractions;
  }
  /** Return the (optional) array of derivatives. These are only present during certain constructions such as faceting. */
  public get packedDerivatives(): GrowableXYZArray | undefined {
    return this._derivatives;
  }
  /** Return the (optional) array of uv parameters. These are only present during certain constructions such as faceting. */
  public get packedUVParams(): GrowableXYArray | undefined {
    return this._uvParams;
  }
  /** Return the (optional) array of surface normals. These are only present during certain constructions such as faceting. */
  public get packedSurfaceNormals(): GrowableXYZArray | undefined {
    return this._surfaceNormals;
  }
  /** Return the (optional) array of normal indices. These are only present during certain constructions such as faceting. */
  public get normalIndices(): GrowableFloat64Array | undefined {
    return this._normalIndices;
  }
  /** Return the (optional) array of uv parameter indices. These are only present during certain constructions such as faceting. */
  public get paramIndices(): GrowableFloat64Array | undefined {
    return this._uvIndices;
  }
  /** Return the (optional) array of point indices. These are only present during certain constructions such as faceting. */
  public get pointIndices(): GrowableFloat64Array | undefined {
    return this._pointIndices;
  }
  private constructor(points?: GrowableXYZArray) {
    super();
    if (points)
      this._points = points;
    else
      this._points = new GrowableXYZArray();
  }
  /** Clone this linestring and apply the transform to the clone points. */
  public cloneTransformed(transform: Transform): LineString3d {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }
  /**
   * Create a linestring, using flex length arg list and any typical combination of points such as
   * Point3d, Point2d, `[1,2,3]', array of any of those, or GrowableXYZArray
   */
  public static create(...points: any[]): LineString3d {
    const result = new LineString3d();
    result.addPoints(points);
    return result;
  }
  /** Create a linestring, capturing the given GrowableXYZArray as the points. */
  public static createCapture(points: GrowableXYZArray): LineString3d {
    return new LineString3d(points);
  }
  /** Create a linestring from `XAndY` points, with a specified z applied to all. */
  public static createXY(points: XAndY[], z: number, enforceClosure: boolean = false): LineString3d {
    const result = new LineString3d();
    const xyz = result._points;
    for (const xy of points) {
      xyz.pushXYZ(xy.x, xy.y, z);
    }
    if (enforceClosure && points.length > 1) {
      const distance = xyz.distanceIndexIndex(0, xyz.length - 1);
      if (distance !== undefined && distance !== 0.0) {
        if (Geometry.isSameCoordinate(0, distance)) {
          xyz.pop();   // nonzero but small distance -- to be replaced by point 0 exactly.
          const xyzA = xyz.front();
          xyz.push(xyzA!);
        }
      }
    }
    return result;
  }
  /**
   * Add copies of points to the linestring.
   * Valid inputs are:
   * * a Point2d
   * * a point3d
   * * An array of 2 doubles
   * * An array of 3 doubles
   * * A GrowableXYZArray
   * * An array of any of the above
   */
  public addPoints(...points: any[]) {
    this._points.pushFrom(points);
  }
  /** Add points accessed by index in a GrowableXYZArray, with a specified index step. */
  public addSteppedPoints(source: GrowableXYZArray, pointIndex0: number, step: number, numAdd: number) {
    this._points.addSteppedPoints(source, pointIndex0, step, numAdd);
  }
  /**
   * Add a point to the linestring.
   * @param point
   */
  public addPoint(point: Point3d) {
    this._points.push(point);
  }
  /**
   * Add a point to the linestring.
   * @param point
   */
  public addPointXYZ(x: number, y: number, z: number = 0) {
    this._points.pushXYZ(x, y, z);
  }
  /**
   * Append a fraction to the fractions array.
   * @param fraction
   */
  public addFraction(fraction: number) {
    if (!this._fractions)
      this._fractions = new GrowableFloat64Array();
    this._fractions.push(fraction);
  }
  /** Ensure that the fraction array exists with no fractions but at least the capacity of the point array. */
  public ensureEmptyFractions(): GrowableFloat64Array {
    const n = this.numPoints();
    if (!this._fractions) {
      this._fractions = new GrowableFloat64Array(n);
      return this._fractions;
    }
    this._fractions.clear();
    this._fractions.ensureCapacity(n);
    return this._fractions;
  }
  /** Ensure that the parameter array exists with no points but at least the capacity of the point array. */
  public ensureEmptyUVParams(): GrowableXYArray {
    const n = this.numPoints();
    if (!this._uvParams) {
      this._uvParams = new GrowableXYArray(n);
      return this._uvParams;
    }
    this._uvParams.clear();
    this._uvParams.ensureCapacity(n);
    return this._uvParams;
  }
  /** Ensure that the surfaceNormals array exists with no points but at least the capacity of the point array. */
  public ensureEmptySurfaceNormals(): GrowableXYZArray {
    const n = this.numPoints();
    if (!this._surfaceNormals) {
      this._surfaceNormals = new GrowableXYZArray(n);
      return this._surfaceNormals;
    }
    this._surfaceNormals.clear();
    this._surfaceNormals.ensureCapacity(n);
    return this._surfaceNormals;
  }
  /** Ensure that the surfaceNormals array exists with no points but at least the capacity of the point array. */
  public ensureEmptyDerivatives(): GrowableXYZArray {
    const n = this.numPoints();
    if (!this._derivatives) {
      this._derivatives = new GrowableXYZArray(n);
      return this._derivatives;
    }
    this._derivatives.clear();
    this._derivatives.ensureCapacity(n);
    return this._derivatives;
  }
  /** Ensure that the surfaceNormals array exists with no points but at least the capacity of the point array. */
  public ensureEmptyNormalIndices(): GrowableFloat64Array {
    const n = this.numPoints();
    if (!this._normalIndices) {
      this._normalIndices = new GrowableFloat64Array(n);
      return this._normalIndices;
    }
    this._normalIndices.clear();
    this._normalIndices.ensureCapacity(n);
    return this._normalIndices;
  }
  /** Ensure that the surfaceNormals array exists with no points but at least the capacity of the point array. */
  public ensureEmptyUVIndices(): GrowableFloat64Array {
    const n = this.numPoints();
    if (!this._uvIndices) {
      this._uvIndices = new GrowableFloat64Array(n);
      return this._uvIndices;
    }
    this._uvIndices.clear();
    this._uvIndices.ensureCapacity(n);
    return this._uvIndices;
  }
  /** Ensure that the surfaceNormals array exists with no points but at least the capacity of the point array. */
  public ensureEmptyPointIndices(): GrowableFloat64Array {
    const n = this.numPoints();
    if (!this._pointIndices) {
      this._pointIndices = new GrowableFloat64Array(n);
      return this._pointIndices;
    }
    this._pointIndices.clear();
    this._pointIndices.ensureCapacity(n);
    return this._pointIndices;
  }
  /**
   * Append a uv coordinate to the uvParams array
   * @param uv
   */
  public addUVParam(uvParam: XAndY) {
    if (!this._uvParams)
      this._uvParams = new GrowableXYArray();
    this._uvParams.pushXY(uvParam.x, uvParam.y);
  }
  /**
   * Append a uv coordinate to the uvParams array
   * @param uv
   */
  public addUVParamAsUV(u: number, v: number) {
    if (!this._uvParams)
      this._uvParams = new GrowableXYArray();
    this._uvParams.pushXY(u, v);
  }
  /**
   * Append a derivative to the derivative array
   * @param vector
   */
  public addDerivative(vector: Vector3d) {
    if (!this._derivatives)
      this._derivatives = new GrowableXYZArray();
    this._derivatives.push(vector);
  }
  /**
   * Append a surface normal to the surface normal array.
   * @param vector
   */
  public addSurfaceNormal(vector: Vector3d) {
    if (!this._surfaceNormals)
      this._surfaceNormals = new GrowableXYZArray();
    this._surfaceNormals.push(vector);
  }
  /** If the linestring is not already closed, add a closure point. */
  public addClosurePoint() {
    const distance = this._points.distanceIndexIndex(0, this._points.length - 1);
    if (distance !== undefined && !Geometry.isSameCoordinate(distance, 0))
      this._points.pushWrap(1);
  }
  /** Eliminate (but do not return!!) the final point of the linestring */
  public popPoint() {
    this._points.pop();
  }
  /** Compute `uvParams` array as (xy parts of) a linear transform of the xyz coordinates */
  public computeUVFromXYZTransform(transform: Transform) {
    this._uvParams = GrowableXYArray.createFromGrowableXYZArray(this._points, transform);
  }
  /**
   * Create the linestring for a rectangle parallel to the xy plane.
   * * The z coordinate from `point0` is used for all points.
   * * `ax` and `ay` are signed.
   * * The point sequence is:
   *    * Start at `point0`
   *    * move by (signed !) `ax` in the x direction.
   *    * move by (signed !) `ay` in the y direction.
   *    * move by (signed !) negative `ax` in the x direction.
   *    * move by (signed !) negative `ay` in the y direction.
   *    * (this returns to `point0`)
   */
  public static createRectangleXY(point0: Point3d, ax: number, ay: number, closed: boolean = true): LineString3d {
    const ls = LineString3d.create();
    const x0 = point0.x;
    const x1 = point0.x + ax;
    const y0 = point0.y;
    const y1 = point0.y + ay;
    const z = point0.z;
    ls.addPointXYZ(x0, y0, z);
    ls.addPointXYZ(x1, y0, z);
    ls.addPointXYZ(x1, y1, z);
    ls.addPointXYZ(x0, y1, z);
    if (closed)
      ls.addClosurePoint();
    return ls;
  }
  /**
   * Create a regular polygon centered
   * @param center center of the polygon.
   * @param edgeCount number of edges.
   * @param radius distance to vertex or edge (see `radiusToVertices`)
   * @param radiusToVertices true if polygon is inscribed in circle (radius measured to vertices); false if polygon
   * is outside circle (radius to edges)
   */
  public static createRegularPolygonXY(
    center: Point3d, edgeCount: number, radius: number, radiusToVertices: boolean = true,
  ): LineString3d {
    if (edgeCount < 3)
      edgeCount = 3;
    const ls = LineString3d.create();
    const i0 = radiusToVertices ? 0 : -1;   // offset to make first vector (radius,0,0)
    const radiansStep = Math.PI / edgeCount;
    let c;
    let s;
    let radians;
    if (!radiusToVertices)
      radius = radius / Math.cos(radiansStep);
    for (let i = 0; i < edgeCount; i++) {
      radians = (i0 + 2 * i) * radiansStep;
      c = Angle.cleanupTrigValue(Math.cos(radians));
      s = Angle.cleanupTrigValue(Math.sin(radians));
      ls.addPointXYZ(center.x + radius * c, center.y + radius * s, center.z);
    }
    ls.addClosurePoint();
    return ls;
  }
  /**
   * Copy coordinate data from another linestring.
   *  * The copied content is:
   *    * points
   *    * derivatives (if present)
   *    * fractions (if present)
   *    * surfaceNormals (if present)
   *    * uvParams (if present)
   * @param other
   */
  public setFrom(other: LineString3d) {
    // ugly -- "clone" methods are inconsistent about 'reuse' and 'result' parameter . . .
    this._points = other._points.clone(this._points);
    if (other._derivatives)
      this._derivatives = other._derivatives.clone(this._derivatives);
    else
      this._derivatives = undefined;
    if (other._fractions)
      this._fractions = other._fractions.clone(false);
    else this._fractions = undefined;
    if (other._surfaceNormals)
      this._surfaceNormals = other._surfaceNormals.clone(this._surfaceNormals);
    else
      this._surfaceNormals = undefined;
    if (other._uvParams)
      this._uvParams = other._uvParams.clone();
    else
      this._uvParams = undefined;
  }
  /** Create a linestring from an array of points. */
  public static createPoints(points: Point3d[]): LineString3d {
    const ls = new LineString3d();
    let point;
    for (point of points)
      ls._points.push(point);
    return ls;
  }
  /** Create a linestring, taking points at specified indices from an array of points. */
  public static createIndexedPoints(points: Point3d[], index: number[], addClosure: boolean = false): LineString3d {
    const ls = new LineString3d();
    for (const i of index)
      ls._points.push(points[i]); // no clone needed -- we know this reformats to packed array.
    if (addClosure && index.length > 1)
      ls._points.push(points[index[0]]);
    return ls;
  }
  /** Create a LineString3d from xyz coordinates packed in a Float64Array */
  public static createFloat64Array(xyzData: Float64Array): LineString3d {
    const ls = new LineString3d();
    for (let i = 0; i + 3 <= xyzData.length; i += 3)
      ls._points.push(Point3d.create(xyzData[i], xyzData[i + 1], xyzData[i + 2]));
    return ls;
  }
  /** Return a clone of this linestring. */
  public clone(): LineString3d {
    const retVal = new LineString3d();
    retVal.setFrom(this);
    return retVal;
  }
  /**
   * Set point coordinates from a json array, e.g. `[[1,2,3],[4,5,6] . . .]`
   * * The `json` parameter must be an array.
   * * Each member `i` of the array is converted to a point with `Point3d.fromJSON(json[i]`)
   */
  public setFromJSON(json?: any) {
    this._points.clear();
    if (Array.isArray(json)) {
      let xyz;
      for (xyz of json)
        this._points.push(Point3d.fromJSON(xyz));
    }
  }
  /**
   * Convert an LineString3d to a JSON object.
   * * The returned object is an array of arrays of x,y,z coordinates, `[[x,y,z],...[x,y,z]]`
   */
  public toJSON(): XYZProps[] {
    const value = [];
    let i = 0;
    while (this._points.isIndexValid(i)) {
      value.push(this._points.getPoint3dAtUncheckedPointIndex(i).toJSON());
      i++;
    }
    return value;
  }
  /**
   * Construct a new linestring.
   * * See `LineString3d.setFromJSON ()` for remarks on `json` structure.
   */
  public static fromJSON(json?: any): LineString3d {
    const ls = new LineString3d(); ls.setFromJSON(json); return ls;
  }
  /**
   * Evaluate a point a fractional position along this linestring.
   * * See `LineString3d` class comments for description of how fraction relates to the linestring points.
   * @param fraction fractional position
   * @param result optional result
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const n = this._points.length;
    if (n === 0)
      return Point3d.createZero();
    if (n === 1)
      return Point3d.createFrom(this._points.getPoint3dAtUncheckedPointIndex(0), result);
    const df = 1.0 / (n - 1);
    if (fraction <= df)
      return this._points.interpolate(0, fraction / df, 1, result)!;
    if (fraction + df >= 1.0)
      return this._points.interpolate(n - 1, (1.0 - fraction) / df, n - 2, result)!;
    const index0 = Math.floor(fraction / df);
    return this._points.interpolate(index0, (fraction - index0 * df) / df, index0 + 1, result)!;
  }
  /**
   * Evaluate a point a fractional position and derivative with respect to fraction along this linestring.
   * * See `LineString3d` class comments for description of how fraction relates to the linestring points.
   * * At interior corners and the end point, the left derivative is returned; at the start point, the right derivative is returned.
   * @param fraction fractional position
   * @param result optional result
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    const n = this._points.length;
    if (n <= 1) {
      result.direction.setZero();
      if (n === 1)
        result.origin.setFrom(this._points.getPoint3dAtUncheckedPointIndex(0));
      else result.origin.setZero();
      return result;
    }
    const numSegment = n - 1;
    const df = 1.0 / numSegment;
    if (fraction <= df) {
      result = result ? result : Ray3d.createZero();
      this._points.interpolate(0, fraction / df, 1, result.origin);
      this._points.vectorIndexIndex(0, 1, result.direction);
      result.direction.scaleInPlace(1.0 / df);
      return result;
    }
    if (fraction + df >= 1.0) {
      result = result ? result : Ray3d.createZero();
      this._points.interpolate(n - 2, 1.0 - (1.0 - fraction) / df, n - 1, result.origin);
      this._points.vectorIndexIndex(n - 2, n - 1, result.direction);
      result.direction.scaleInPlace(1.0 / df);
      return result;
    }
    /* true interior point */
    result = result ? result : Ray3d.createZero();
    const index0 = Math.floor(fraction / df);
    const localFraction = (fraction - index0 * df) / df;
    this._points.interpolate(index0, localFraction, index0 + 1, result.origin);
    this._points.vectorIndexIndex(index0, index0 + 1, result.direction);
    result.direction.scaleInPlace(1.0 / df);
    return result;
  }
  /** Return point and derivative at fraction, with 000 second derivative. */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const ray = this.fractionToPointAndDerivative(fraction);
    result = Plane3dByOriginAndVectors.createCapture(ray.origin, ray.direction, Vector3d.createZero(), result);
    return result;
  }
  /**
   * Convert a segment index and local fraction to a global linestring fraction.
   * @param index index of segment being evaluated
   * @param localFraction local fraction in [0,1] within the segment
   * @param numSegment number N of segments in the linestring
   * @return global fraction f in [0,1] such that the segment is parameterized by index/N <= f <= (index+1)/N.
   */
  public static mapLocalToGlobalFraction(index: number, localFraction: number, numSegment: number): number {
    if (numSegment < 1)
      return 0.0;
    return (index + localFraction) / numSegment;
  }
  /**
   * Convert a segment index and local fraction to a global linestring fraction.
   * @param index index of segment being evaluated
   * @param localFraction local fraction relative to the segment, typically in [0,1]. Fraction may be negative (or greater than 1) to represent extension of the first (or last) segment.
   * @return global fraction f such that the segment is parameterized by index/N <= f <= (index+1)/N.
   */
  public segmentIndexAndLocalFractionToGlobalFraction(index: number, localFraction: number): number {
    return LineString3d.mapLocalToGlobalFraction(index, localFraction, this._points.length - 1);
  }
  /**
   * Convert a global linestring fraction to a segment index and local fraction.
   * @param globalFraction a fraction f in the linestring parameterization, where the i_th segment
   * (0 <= i < N) is parameterized by i/N <= f <= (i+1)/N. If `globalFraction` is negative (or greater than 1),
   * so is the returned local fraction, which corresponds to the first (last) segment.
   * @param numSegment number N of segments in the linestring
   * @returns segment index and local fraction
   */
  public static mapGlobalToLocalFraction(globalFraction: number, numSegment: number): { index: number, fraction: number } {
    if (numSegment < 1)
      return { index: 0, fraction: 0.0 };
    const scaledGlobalFraction = globalFraction * numSegment;
    let segmentIndex: number;
    if (globalFraction <= 0)
      segmentIndex = 0;
    else if (globalFraction >= 1)
      segmentIndex = numSegment - 1;
    else  // globalFraction in (0,1)
      segmentIndex = Math.floor(scaledGlobalFraction);
    return { index: segmentIndex, fraction: scaledGlobalFraction - segmentIndex };
  }
  /**
   * Convert a global linestring fraction to a segment index and local fraction.
   * @param globalFraction a fraction f in the linestring parameterization, where the i_th segment
   * (0 <= i < N) is parameterized by i/N <= f <= (i+1)/N. If `globalFraction` is negative (or greater than 1),
   * so is the returned local fraction, which corresponds to the first (last) segment.
   * @returns segment index and local fraction
   */
  public globalFractionToSegmentIndexAndLocalFraction(globalFraction: number): { index: number, fraction: number } {
    return LineString3d.mapGlobalToLocalFraction(globalFraction, this._points.length - 1);
  }
  /** Return a frenet frame, using nearby points to estimate a plane. */
  public override fractionToFrenetFrame(fraction: number, result?: Transform): Transform {
    const n = this._points.length;
    if (n <= 1) {
      if (n === 1)
        return Transform.createTranslation(this._points.getPoint3dAtUncheckedPointIndex(0), result);
      return Transform.createIdentity(result);
    }
    if (n === 2)
      return Transform.createRefs(
        this._points.interpolate(0, fraction, 1),
        Matrix3d.createRigidHeadsUp(this._points.vectorIndexIndex(0, 1)!, AxisOrder.XYZ));
    /** 3 or more points. */
    const numSegment = n - 1;
    const df = 1.0 / numSegment;
    let baseIndex = 0;
    let localFraction = 0;
    if (fraction <= df) {
      localFraction = fraction / df;
      baseIndex = 0;
    } else if (fraction + df >= 1.0) {
      baseIndex = n - 2;
      localFraction = 1.0 - (1.0 - fraction) / df;
    } else {
      baseIndex = Math.floor(fraction / df);
      localFraction = fraction * numSegment - baseIndex;
    }
    const origin = this._points.interpolate(baseIndex, localFraction, baseIndex + 1)!;
    const vectorA = this._points.vectorIndexIndex(baseIndex, baseIndex + 1)!;
    // tricky stuff to handle colinear points.   But if vectorA is zero it is still a mess . ..
    const normal = Vector3d.create();
    const workVector = Vector3d.create();
    if (baseIndex === 0) {  // only look forward
      accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex + 1, 1, 1.0, normal, workVector);
    } else if (baseIndex + 2 >= n) { // only look back
      accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex - 1, -1, 1.0, normal, workVector);
    } else {
      accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex - 1, -1, (1.0 - localFraction), normal, workVector);
      accumulateGoodUnitPerpendicular(this._points, vectorA, baseIndex + 1, 1, (localFraction), normal, workVector);
    }
    const matrix = Matrix3d.createRigidFromColumns(normal, vectorA, AxisOrder.ZXY);
    if (matrix)
      return Transform.createOriginAndMatrix(origin, matrix, result);
    return Transform.createTranslation(origin, result);
  }
  /** Evaluate the start point of the linestring. */
  public override startPoint() {
    if (this._points.length === 0)
      return Point3d.createZero();
    return this._points.getPoint3dAtUncheckedPointIndex(0);
  }
  /** If i is a valid index, return that point. */
  public pointAt(i: number, result?: Point3d): Point3d | undefined {
    if (this._points.isIndexValid(i))
      return this._points.getPoint3dAtUncheckedPointIndex(i, result);
    return undefined;
  }
  /** If i and j are both valid indices, return the vector from point i to point j */
  public vectorBetween(i: number, j: number, result?: Vector3d): Vector3d | undefined {
    return this._points.vectorIndexIndex(i, j, result);
  }
  /** If i is a valid index, return that stored derivative vector. */
  public derivativeAt(i: number, result?: Vector3d): Vector3d | undefined {
    if (this._derivatives && this._derivatives.isIndexValid(i))
      return this._derivatives.getVector3dAtCheckedVectorIndex(i, result);
    return undefined;
  }
  /** If i is a valid index, return that stored surfaceNormal vector. */
  public surfaceNormalAt(i: number, result?: Vector3d): Vector3d | undefined {
    if (this._surfaceNormals && this._surfaceNormals.isIndexValid(i))
      return this._surfaceNormals.getVector3dAtCheckedVectorIndex(i, result);
    return undefined;
  }
  /** Return the number of points in this linestring. */
  public numPoints(): number {
    return this._points.length;
  }
  /** Return the number of edges in this linestring. */
  public numEdges(): number {
    return this._points.length > 0 ? this._points.length - 1 : 0;
  }
  /** Evaluate the end point of the linestring. */
  public override endPoint() {
    if (this._points.length === 0)
      return Point3d.createZero();
    return this._points.getPoint3dAtUncheckedPointIndex(this._points.length - 1);
  }
  /** Reverse the points within the linestring. */
  public reverseInPlace(): void {
    if (this._points.length >= 2) {
      this._points.reverseInPlace();
      if (this._fractions) {
        this._fractions.reverseInPlace();
        for (let i = 0; i < this._fractions.length; ++i)
          this._fractions.reassign(i, 1.0 - this._fractions.atUncheckedIndex(i));
      }
      if (this._uvParams)
        this._uvParams.reverseInPlace();
      if (this._derivatives) {
        this._derivatives.reverseInPlace();
        this._derivatives.scaleInPlace(-1.0);
      }
      if (this._surfaceNormals)
        this._surfaceNormals.reverseInPlace();
      if (this._pointIndices)
        this._pointIndices.reverseInPlace();
      if (this._uvIndices)
        this._uvIndices.reverseInPlace();
      if (this._normalIndices)
        this._normalIndices.reverseInPlace();
    }
  }
  /**
   * Apply `transform` to each point of this linestring.
   * * Note that this method always returns true. If transforming the surface normals fails (due to singular matrix or zero
   * normal), the original normal(s) are left unchanged.
  */
  public tryTransformInPlace(transform: Transform): boolean {
    this._points.multiplyTransformInPlace(transform);
    if (this._derivatives)
      this._derivatives.multiplyMatrix3dInPlace(transform.matrix);
    if (this._surfaceNormals)
      this._surfaceNormals.multiplyAndRenormalizeMatrix3dInverseTransposeInPlace(transform.matrix);
    return true;
  }
  /** Sum the lengths of segments within the linestring */
  public override curveLength(): number {
    return this._points.sumLengths();
  }
  /** Sum the lengths of segments between fractional positions on a linestring. */
  public override curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    const numSegments = this._points.length - 1;
    if (fraction1 === fraction0 || numSegments < 1)
      return 0.0;
    if (fraction1 < fraction0)
      return this.curveLengthBetweenFractions(fraction1, fraction0);
    const scaledFraction0 = fraction0 * numSegments;
    const scaledFraction1 = fraction1 * numSegments;
    const index0 = Math.max(1, Math.ceil(scaledFraction0));
    const index1 = Math.min(Math.floor(scaledFraction1), numSegments - 1);
    const localFraction0 = index0 - scaledFraction0;
    const localFraction1 = scaledFraction1 - index1;
    if (index0 > index1) {
      // the interval is entirely within a single segment
      return Math.abs(scaledFraction1 - scaledFraction0) * this._points.distanceIndexIndex(index0 - 1, index0)!;
    } else {
      // there is leading partial interval, 0 or more complete segments, and a trailing partial interval.
      // (either or both partial may be zero length)
      let sum = localFraction0 * this._points.distanceIndexIndex(index0 - 1, index0)!
        + localFraction1 * (this._points.distanceIndexIndex(index1, index1 + 1))!;
      for (let i = index0; i < index1; i++)
        sum += this._points.distanceIndexIndex(i, i + 1)!;
      return sum;
    }
  }
  /** Compute the range of points between fractional positions on the linestring. */
  public override rangeBetweenFractions(fraction0: number, fraction1: number, transform?: Transform): Range3d {
    const range = Range3d.create();
    if (this.points.length < 1)
      return range;
    if (fraction1 < fraction0)
      return this.rangeBetweenFractions(fraction1, fraction0, transform);
    const numSegments = this._points.length - 1;
    const scaledFraction0 = fraction0 * numSegments;
    const index0 = Math.max(0, Math.floor(scaledFraction0));
    const localFraction0 = scaledFraction0 - index0;
    const workPoint = Point3d.create();
    this._points.interpolate(index0, localFraction0, index0 + 1, workPoint);
    range.extendPoint(workPoint, transform);
    if (fraction1 === fraction0)
      return range; // 1-point range
    const scaledFraction1 = fraction1 * numSegments;
    const index1 = Math.min(Math.floor(scaledFraction1), numSegments - 1);
    const localFraction1 = scaledFraction1 - index1;
    this._points.interpolate(index1, localFraction1, index1 + 1, workPoint);
    range.extendPoint(workPoint, transform);
    for (let i = index0 + 1; i <= index1; i++) {
      this._points.getPoint3dAtUncheckedPointIndex(i, workPoint);
      range.extendPoint(workPoint, transform);
    }
    return range;
  }
  /**
   * * Implementation of `CurvePrimitive.moveSignedDistanceFromFraction`.  (see comments there!)
   * * Find the segment that contains the start fraction
   * * Move point-by-point from that position to the start or end (respectively for negative or positive signedDistance)
   * * Optionally extrapolate
   * @param startFraction
   * @param signedDistance
   * @param allowExtension
   * @param result
   */
  public override moveSignedDistanceFromFraction(
    startFraction: number, signedDistance: number, allowExtension: false, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    const numSegments = this._points.length - 1;
    const scaledFraction = startFraction * numSegments;
    let leftPointIndex = Geometry.restrictToInterval(Math.floor(scaledFraction), 0, numSegments - 1);  // lower point index on active segment.
    const localFraction = scaledFraction - leftPointIndex;
    const point0 = this._points.interpolate(leftPointIndex, localFraction, leftPointIndex + 1, LineString3d._workPointA)!;
    const point1 = LineString3d._workPointB;
    const context = new MoveByDistanceContext(point0, startFraction, signedDistance);

    if (signedDistance > 0.0) {
      for (; leftPointIndex <= numSegments;) {
        leftPointIndex++;
        this._points.getPoint3dAtCheckedPointIndex(leftPointIndex, point1);
        if (context.announcePoint(point1, leftPointIndex / numSegments))
          return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
            this, context.fraction0, context.point0, signedDistance, CurveSearchStatus.success, result,
          );
      }
      // fall through for extrapolation from final segment
      if (allowExtension)
        context.announceExtrapolation(this._points, numSegments - 1, numSegments,
          (numSegments - 1) / numSegments, 1.0);
      return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
        this, context.fraction0, context.point0, signedDistance, context.distanceStatus(), result,
      );
    } else { // (moving backwards)
      if (localFraction <= 0.0)
        leftPointIndex--;
      for (; leftPointIndex >= 0; leftPointIndex--) {
        this._points.getPoint3dAtCheckedPointIndex(leftPointIndex, point1);
        if (context.announcePoint(point1, leftPointIndex / numSegments))
          return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
            this, context.fraction0, context.point0, signedDistance, CurveSearchStatus.success, result,
          );
      }
      // fall through for backward extrapolation from initial segment
      if (allowExtension)
        context.announceExtrapolation(this._points, 1, 0, 1.0 / numSegments, 0.0);
      return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
        this, context.fraction0, context.point0, -context.distance0, context.distanceStatus(), result,
      );
    }
  }
  /** Sum lengths of segments in the linestring.  (This is a true length.) */
  public quickLength(): number { return this.curveLength(); }
  /**
   * Compute and normalize cross product among 3 points on the linestring.
   * * Essentially 3 random points are used to form the cross product.
   * * This is appropriate for a polygon known to be convex.
   * * No test for convexity or collinearity is performed.
   * * If the polygon is not convex, the returned normal may be reversed.
   * * If the random points used in the cross product are collinear, undefined is returned.
   * @param result pre-allocated object to populate and return
   * @returns unit normal, or undefined if normalization failed
   */
  public quickUnitNormal(result?: Vector3d): Vector3d | undefined {
    let step = Math.floor(this._points.length / 3);
    if (step < 1)
      step = 1;
    result = this._points.crossProductIndexIndexIndex(0, step, step + step);
    if (result && result.normalizeInPlace())
      return result;
    return undefined;
  }
  /** Find the point on the linestring (including its segment interiors) that is closest to spacePoint. */
  public override closestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = CurveLocationDetail.create(this, result);
    const extend0 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 0);
    const extend1 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 1);
    const numPoints = this._points.length;
    if (numPoints > 0) {
      const lastIndex = numPoints - 1;
      result.setFP(1.0, this._points.getPoint3dAtUncheckedPointIndex(lastIndex), undefined);
      result.setDistanceTo(spacePoint);
      if (numPoints > 1) {
        let segmentFraction = 0;
        let d = 0;
        for (let i = 1; i < numPoints; i++) {
          segmentFraction = spacePoint.fractionOfProjectionToLine(
            this._points.getPoint3dAtUncheckedPointIndex(i - 1), this._points.getPoint3dAtUncheckedPointIndex(i),
          );
          if (segmentFraction < 0) {
            if (!extend0 || i > 1)
              segmentFraction = 0.0;
          } else if (segmentFraction > 1.0) {
            if (!extend1 || i < lastIndex)
              segmentFraction = 1.0;
          }
          this._points.getPoint3dAtUncheckedPointIndex(i - 1)
            .interpolate(segmentFraction, this._points.getPoint3dAtUncheckedPointIndex(i), result.pointQ);
          d = result.pointQ.distance(spacePoint);
          if (d < result.a) {
            result.setFP(
              this.segmentIndexAndLocalFractionToGlobalFraction(i - 1, segmentFraction), result.pointQ, undefined, d,
            );
          }
        }
      }
    }
    return result;
  }
  /** Test if all points of the linestring are in a plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return this._points.isCloseToPlane(plane, Geometry.smallMetricDistance);
  }
  /** Push a hit, fixing up the prior entry if needed. */
  private static pushVertexHit(
    result: CurveLocationDetail[], counter: number, cp: CurvePrimitive, fraction: number, point: Point3d,
  ): void {
    const detail = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point);
    result.push(detail);
    if (counter === 0) {
      detail.setIntervalRole(CurveIntervalRole.isolatedAtVertex);
    } else if (counter === 1) {  // last entry must be isolatedAtVertex !!!
      result[result.length - 2].setIntervalRole(CurveIntervalRole.intervalStart);
      detail.setIntervalRole(CurveIntervalRole.intervalEnd);
    } else {
      result[result.length - 2].setIntervalRole(CurveIntervalRole.intervalInterior);
      detail.setIntervalRole(CurveIntervalRole.intervalEnd);
    }
  }
  /**
   * Find intersections with a plane.
   *  Intersections within segments are recorded as CurveIntervalRole.isolated
   *   Intersections at isolated "on" vertex are recoded as CurveIntervalRole.isolatedAtVertex.
   */
  public override appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    if (this._points.length < 1) return 0;
    const initialLength = result.length;
    const n = this._points.length;
    const divisor = n === 1 ? 1.0 : n - 1;
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    const pointC = LineString3d._workPointC;
    this._points.getPoint3dAtUncheckedPointIndex(0, pointA);
    let hB = 0;
    let numConsecutiveZero = 0;
    let hA = 0;
    let segmentFraction = 0;
    for (let i = 0; i < this._points.length; i++, pointA.setFrom(pointB), hA = hB) {
      this._points.getPoint3dAtUncheckedPointIndex(i, pointB);
      hB = Geometry.correctSmallMetricDistance(plane.altitude(pointB));
      if (hB === 0.0)
        LineString3d.pushVertexHit(result, numConsecutiveZero++, this, i / divisor, pointB);
      else {
        if (hA * hB < 0.0) {  // at point0, hA=0 will keep us out of here . ..
          segmentFraction = hA / (hA - hB); // this division is safe because the signs are different.
          pointA.interpolate(segmentFraction, pointB, pointC);
          const detail = CurveLocationDetail.createCurveFractionPoint(this, (i - 1 + segmentFraction) / divisor, pointC);
          detail.setIntervalRole(CurveIntervalRole.isolated);
          result.push(detail);
          numConsecutiveZero = 0;
        }
      }
    }
    return result.length - initialLength;
  }
  /** Extend `rangeToExtend` to include all points of this linestring. */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this._points.extendRange(rangeToExtend, transform);
  }
  /** Test if each point of this linestring isAlmostEqual with corresponding point in `other`. */
  public override isAlmostEqual(other: GeometryQuery): boolean {
    if (!(other instanceof LineString3d))
      return false;
    if (!GrowableXYZArray.isAlmostEqual(this._points, other._points))
      return false;
    return true;
  }
  /**
   * Append (clone of) one point.
   * @param point the point to append. If same as the last point, nothing is appended.
   * @param fraction optional associated fraction to append. If same as the last fraction, nothing is appended.
   * It is assumed that both fractions refer to the same CurvePrimitive.
   */
  public appendStrokePoint(point: Point3d, fraction?: number): void {
    const n = this._points.length;
    let add = true;
    const addFraction = (fraction !== undefined) && (this._fractions !== undefined);
    if (n > 0) {
      if (addFraction && Geometry.isSmallRelative(fraction - this._fractions!.back()))
        add = false;
      if (point.isAlmostEqual(this._points.getPoint3dAtUncheckedPointIndex(n - 1)))
        add = false;
    }
    if (add) {
      this._points.push(point);
      if (addFraction)
        this.addFraction(fraction);
    }
  }
  /** Compress out duplicate points (according to point.isAlmostEqual) */
  public removeDuplicatePoints(tolerance: number = Geometry.smallMetricDistance) {
    const n = this._points.length;
    if (n < 2)
      return;
    let n1 = 1;
    for (let i = 1; i < n; i++) {
      const q = this._points.distanceIndexIndex(i, n1 - 1);
      if (q !== undefined && q > tolerance) {
        this._points.moveIndexToIndex(i, n1);
        if (this._fractions !== undefined)
          this._fractions.setAtUncheckedIndex(n1, this._fractions.atUncheckedIndex(i));
        if (this._derivatives)
          this._derivatives.moveIndexToIndex(i, n1);
        n1++;
      }
    }
    this._points.resize(n1);
    if (this._fractions)
      this._fractions.resize(n1);
    if (this._derivatives)
      this._derivatives.resize(n1);
  }
  /**
   * Append a suitable evaluation of a curve.
   * * If the computed point is the same as the last point, nothing is appended.
   * * Otherwise, the point is appended, as well as the fraction and derivative (if those arrays are present).
   * @param curve the curve to evaluate.
   * @param fraction the fraction at which to evaluate the curve.
   */
  public appendFractionToPoint(curve: CurvePrimitive, fraction: number) {
    let ray: Ray3d | undefined;
    let point: Point3d | undefined;
    const n = this._points.length;
    if (this._derivatives) {
      ray = curve.fractionToPointAndDerivative(fraction, LineString3d._workRay);
      point = ray.origin;
    } else {
      point = curve.fractionToPoint(fraction, LineString3d._workPointA);
    }
    if (n > 0 && point.isAlmostEqual(this._points.getPoint3dAtUncheckedPointIndex(n - 1)))
      return;
    if (ray)
      this._derivatives?.push(ray.direction);
    if (this._fractions)
      this._fractions.push(fraction);
    this._points.push(point);
  }
  /**
   * Clear all array data:
   * * points
   * * optional fractions.
   * * optional derivatives.
   */
  public clear() {
    this._points.clear();
    if (this._fractions)
      this._fractions.clear();
    if (this._derivatives)
      this._derivatives.clear();
  }
  /**
   * * options.needParams triggers creation of fraction array and uvParams array.
   * * options.needNormals triggers creation of derivatives array
   * @param capacity if positive, initial capacity of arrays
   * @param options  optional, to indicate if fraction and derivative arrays are required.
   */
  public static createForStrokes(capacity: number = 0, options: StrokeOptions | undefined): LineString3d {
    const ls = LineString3d.create();
    if (capacity > 0)
      ls._points.ensureCapacity(capacity);
    if (options) {
      if (options.needParams) {
        ls._fractions = new GrowableFloat64Array(capacity);
        ls._uvParams = new GrowableXYArray(capacity);
      }
      if (options.needNormals) {
        ls._derivatives = new GrowableXYZArray(capacity);
        ls._surfaceNormals = new GrowableXYZArray(capacity);
      }
    }
    return ls;
  }
  /**
   * Evaluate a curve at uniform fractions. Append the evaluations to this linestring.
   * @param curve primitive to evaluate.
   * @param numStrokes number of strokes (edges).
   * @param fraction0 starting fraction coordinate
   * @param fraction1 end fraction coordinate
   * @param include01 if false, points at fraction0 and fraction1 are omitted.
   */
  public appendFractionalStrokePoints(
    curve: CurvePrimitive, numStrokes: number, fraction0: number = 0, fraction1: number = 1, include01: boolean = true,
  ): void {
    let i0 = 1;
    let i1 = numStrokes - 1;
    if (include01) {
      i0 = 0;
      i1 = numStrokes;
    }
    if (numStrokes >= 1) {
      const df = (fraction1 - fraction0) / numStrokes;
      for (let i = i0; i <= i1; i++)
        this.appendFractionToPoint(curve, fraction0 + i * df);
    }
  }
  /**
   * Append points constructed as interpolation between two points.
   * @param numStrokes number of strokes.
   * @param point0 first point
   * @param point1 last point
   * @param include01 if false, OMIT both start and end points (i.e. only compute and add true interior points)
   */
  public appendInterpolatedStrokePoints(numStrokes: number, point0: Point3d, point1: Point3d, include01: boolean): void {
    if (include01)
      this.appendStrokePoint(point0, 0.0);
    if (numStrokes > 1) {
      const df = 1.0 / numStrokes;
      for (let i = 1; i < numStrokes; i++) {
        const f = i * df;
        this.appendStrokePoint(point0.interpolate(f, point1), f);
      }
    }
    if (include01)
      this.appendStrokePoint(point1, 1.0);
  }
  /** Emit strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const n = this._points.length;
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    if (n > 0) {
      // This is a linestring.
      // There is no need for chordTol and angleTol within a segment.
      // Do NOT apply min strokes per primitive.
      if (options && options.hasMaxEdgeLength) {
        dest.appendStrokePoint(this._points.getPoint3dAtUncheckedPointIndex(0));
        for (let i = 1; i < n; i++) {
          this._points.getPoint3dAtUncheckedPointIndex(i - 1, pointA);
          this._points.getPoint3dAtUncheckedPointIndex(i, pointB);
          const numStroke = options.applyMaxEdgeLength(1, pointA.distance(pointB));
          if (numStroke > 1)
            dest.appendInterpolatedStrokePoints(numStroke, pointA, pointB, false);
          dest.appendStrokePoint(pointB);
        }
      } else {
        for (let i = 0; i < n; i++) {
          dest.appendStrokePoint(this._points.getPoint3dAtUncheckedPointIndex(i));
        }
      }
    }
  }
  /**
   * Emit strokable parts of the curve to a caller-supplied handler.
   * If the stroke options does not have a maxEdgeLength, one stroke is emitted for each segment of the linestring.
   * If the stroke options has a maxEdgeLength, smaller segments are emitted as needed.
   */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const n = this._points.length;
    handler.startCurvePrimitive(this);
    if (n > 1) {
      const df = 1.0 / (n - 1);
      // this is a line string; there is no need for chordTol and angleTol within a segment
      // DO NOT apply min strokes per primitive
      if (options && options.hasMaxEdgeLength) {
        for (let i = 1; i < n; i++) {
          const numStroke = options.applyMaxEdgeLength(
            1, this._points.getPoint3dAtUncheckedPointIndex(i - 1).distance(this._points.getPoint3dAtUncheckedPointIndex(i)),
          );
          handler.announceSegmentInterval(
            this,
            this._points.getPoint3dAtUncheckedPointIndex(i - 1),
            this._points.getPoint3dAtUncheckedPointIndex(i),
            numStroke,
            (i - 1) * df,
            i * df,
          );
        }
      } else {
        for (let i = 1; i < n; i++) {
          handler.announceSegmentInterval(
            this,
            this._points.getPoint3dAtUncheckedPointIndex(i - 1),
            this._points.getPoint3dAtUncheckedPointIndex(i),
            1,
            (i - 1) * df,
            i * df,
          );
        }
      }
    }
    handler.endCurvePrimitive(this);
  }
  /**
   * Return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    const numPoints = this._points.length;
    let numStroke = numPoints - 1;

    if (options && options.hasMaxEdgeLength) {
      numStroke = 0;
      for (let i = 1; i < numPoints; i++) {
        numStroke += options.applyMaxEdgeLength(1, this._points.distanceIndexIndex(i - 1, i)!);
      }
    }
    return numStroke;
  }
  /**
   * Compute individual segment stroke counts.  Attach in a StrokeCountMap.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap evolving parent map.
   */
  public override computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentStrokeMap?: StrokeCountMap) {
    const numPoints = this._points.length;
    const applyOptions = options !== undefined && options.hasMaxEdgeLength;
    const myData = StrokeCountMap.createWithCurvePrimitiveAndOptionalParent(this, parentStrokeMap, []);
    for (let i = 1; i < numPoints; i++) {
      const segmentLength = this._points.distanceIndexIndex(i - 1, i)!;
      const numStrokeOnSegment = applyOptions ? options.applyMaxEdgeLength(1, segmentLength) : 1;
      myData.addToCountAndLength(numStrokeOnSegment, segmentLength);
    }
    CurvePrimitive.installStrokeCountMap(this, myData, parentStrokeMap);
  }
  /** Second step of double dispatch:  call `handler.handleLineString3d(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLineString3d(this);
  }
  // HARD TO TEST -- tests that get to announceClipInterval for arc, bspline do NOT get here with
  // linestring because the controller has special case loops through segments?
  /**
   * Find intervals of this CurvePrimitive that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce (optional) function to be called announcing fractional intervals"
   * ` announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public override announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const n = this._points.length;
    if (n < 2)
      return false;
    let globalFractionA = 0.0;
    let globalFractionB = 1.0;
    const capture = (localFraction0: number, localFraction1: number) => {
      if (announce)
        announce(
          Geometry.interpolate(globalFractionA, localFraction0, globalFractionB),
          Geometry.interpolate(globalFractionA, localFraction1, globalFractionB),
          this,
        );
    };
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    this._points.getPoint3dAtUncheckedPointIndex(0, pointA);
    let status = false;
    for (let i = 1; i < n; i++, pointA.setFrom(pointB), globalFractionA = globalFractionB) {
      this._points.getPoint3dAtUncheckedPointIndex(i, pointB);
      globalFractionB = i / (n - 1);
      if (clipper.announceClippedSegmentIntervals(0.0, 1.0, pointA, pointB, capture))
        status = true;
    }
    return status;
  }
  private static _indexPoint = Point3d.create();  // private point for addResolvedPoint
  /** @param fraction used to interpolate between points at index and index + 1 */
  private addResolvedPoint(index: number, fraction: number, dest: GrowableXYZArray) {
    const n = this._points.length;
    if (n === 0) return;
    if (n === 1) {
      this._points.getPoint3dAtUncheckedPointIndex(0, LineString3d._indexPoint);
      dest.push(LineString3d._indexPoint);
      return;
    }
    if (index < 0)
      index = 0;
    if (index > n - 2) {
      index = n - 2;
      fraction += 1;
    }
    this._points.interpolate(index, fraction, index + 1, LineString3d._indexPoint);
    dest.push(LineString3d._indexPoint);
  }
  /**
   * Return a LineString which is a portion of this curve.
   * * Fractions outside [0,1] extend the relevant end segment.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public override clonePartialCurve(fractionA: number, fractionB: number): LineString3d {
    if (fractionB < fractionA) {
      const linestringA = this.clonePartialCurve(fractionB, fractionA);
      if (linestringA)
        linestringA.reverseInPlace();
      return linestringA;
    }
    const n = this._points.length;
    if (n < 2)
      return this.clone();
    if (n > 2 && this.isPhysicallyClosed) {
      // don't extend a closed linestring
      if (fractionA < 0)
        fractionA = 0;
      if (fractionB > 1)
        fractionB = 1;
    }
    let index0, index1: number;   // range of original vertices to copy into clone
    const localA = this.globalFractionToSegmentIndexAndLocalFraction(fractionA);
    const localB = this.globalFractionToSegmentIndexAndLocalFraction(fractionB);
    if (fractionA < 0) {
      index0 = 1; // first original vertex is not in clone
    } else if (0 <= fractionA && fractionA <= 1) {
      index0 = Geometry.isSmallRelative(1 - localA.fraction) ? localA.index + 2 : localA.index + 1;
    } else { // 1 < fractionA
      index0 = n; // no original vertices in clone
    }
    if (fractionB < 0) {
      index1 = -1;  // no original vertices in clone
    } else if (0 <= fractionB && fractionB <= 1) {
      index1 = Geometry.isSmallRelative(localB.fraction) ? localB.index - 1 : localB.index;
    } else {  // 1 < fractionB
      index1 = n - 2; // last original vertex is not in clone
    }
    const result = LineString3d.create();
    this.addResolvedPoint(localA.index, localA.fraction, result._points);
    for (let index = index0; index <= index1; index++) {
      if (this._points.isIndexValid(index)) {
        result._points.pushFromGrowableXYZArray(this._points, index);
      }
    }
    this.addResolvedPoint(localB.index, localB.fraction, result._points);
    return result;
  }
  /** Return (if possible) a specific segment of the linestring */
  public getIndexedSegment(index: number, result?: LineSegment3d): LineSegment3d | undefined {
    if (index >= 0 && index + 1 < this._points.length)
      return LineSegment3d.create(
        this._points.getPoint3dAtCheckedPointIndex(index)!, this._points.getPoint3dAtCheckedPointIndex(index + 1)!, result,
      );
    return undefined;
  }
  /**
   * Whether the start and end points are defined and within tolerance.
   * * Does not check for planarity or degeneracy.
   * @param tolerance optional distance tolerance (default is [[Geometry.smallMetricDistance]])
   * @param xyOnly if true, ignore z coordinate (default is `false`)
   */
  public override isPhysicallyClosedCurve(tolerance: number = Geometry.smallMetricDistance, xyOnly: boolean = false): boolean {
    if (!this._points.length)
      return false;
    if (xyOnly)
      return this._points.almostEqualXYIndexIndex(0, this._points.length - 1, tolerance)!; // we know the indices are valid
    return this._points.almostEqualIndexIndex(0, this._points.length - 1, tolerance)!;
  }
  /** Returns true if first and last points are within metric tolerance. */
  public get isPhysicallyClosed(): boolean {
    return this.isPhysicallyClosedCurve();
  }

  /**
   * Evaluate strokes at fractions indicated in a StrokeCountMap.
   * * The map must have an array of component counts corresponding to the segment of this linestring.
   * * "fractions" in the output are mapped within a0,a1 of the map.componentData
   * @param map = stroke count data.
   * @param destLinestring = receiver linestring.
   * @return number of strokes added.  0 if `map.componentData` does not match the linestring
   */
  public override addMappedStrokesToLineString3D(map: StrokeCountMap, destLinestring: LineString3d): number {
    const numPoint0 = destLinestring.numPoints();
    const needFractions = destLinestring._fractions !== undefined;
    const needDerivatives = destLinestring._derivatives !== undefined;
    const points = this._points;
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    const pointC = LineString3d._workPointC;
    const numParentPoint = points.length;
    if (map.primitive && map.primitive === this && map.componentData && map.componentData.length + 1 === numParentPoint) {
      points.getPoint3dAtUncheckedPointIndex(0, pointA);
      for (let k = 0; k + 1 < numParentPoint; k++, pointA.setFromPoint3d(pointB)) {
        points.getPoint3dAtUncheckedPointIndex(k + 1, pointB);
        const segmentMap = map.componentData[k];
        const m = segmentMap.numStroke;
        const vectorAB = pointA.vectorTo(pointB);
        vectorAB.scale(m);
        for (let i = 0; i <= m; i++) {
          const fraction = i / m;
          const outputFraction = segmentMap.fractionToA(fraction);
          destLinestring.addPoint(pointA.interpolate(fraction, pointB, pointC));
          if (needFractions)
            destLinestring._fractions!.push((outputFraction));
          if (needDerivatives)
            destLinestring._derivatives!.push(vectorAB);

        }
      }
    }
    return destLinestring.numPoints() - numPoint0;
  }
  /**
   * Convert variant point data to a single level array of linestrings.
   * * The result is always an array of LineString3d.
   *   * Single linestring is NOT bubbled out as a special case.
   *   * data with no point is an empty array.
   *   * "deep" data is flattened to a single array of linestrings, losing structure.
   */
  public static createArrayOfLineString3d(data: MultiLineStringDataVariant): LineString3d[] {
    const collector = new PointStreamGrowableXYZArrayCollector();
    VariantPointDataStream.streamXYZ(data, collector);
    const growableArrays = collector.claimArrayOfGrowableXYZArray();
    const result = [];
    if (growableArrays !== undefined) {
      for (const points of growableArrays)
        result.push(LineString3d.createCapture(points));
    }
    return result;
  }
  /**
   * Return an array containing only the curve primitives.
   * @param collectorArray array to receive primitives (pushed -- the array is not cleared)
   * @param _smallestPossiblePrimitives unused
   * @param explodeLinestrings if true, push a [[LineSegment3d]] for each segment. If false, only push `this`.
   */
  public override collectCurvePrimitivesGo(
    collectorArray: CurvePrimitive[], _smallestPossiblePrimitives: boolean, explodeLinestrings: boolean = false,
  ): void {
    if (explodeLinestrings) {
      let segment: LineSegment3d | undefined;
      for (let i = 0; (segment = this.getIndexedSegment(i)) !== undefined; i++)
        collectorArray.push(segment);
    } else {
      collectorArray.push(this);
    }
  }
  /**
   * Construct an offset of each segment as viewed in the xy-plane (ignoring z).
   * * No attempt is made to join the offset segments. Use RegionOps.constructCurveXYOffset() to return a fully
   * joined offset.
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve), or options object
   */
  public override constructOffsetXY(
    offsetDistanceOrOptions: number | OffsetOptions,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    const options = OffsetOptions.create(offsetDistanceOrOptions);
    const offsets: CurvePrimitive[] = [];
    for (const seg of this.collectCurvePrimitives(undefined, true, true)) {
      const offset = seg.constructOffsetXY(options);
      if (offset !== undefined) {
        if (offset instanceof CurvePrimitive)
          offsets.push(offset);
        else if (Array.isArray(offset))
          offset.forEach((cp) => offsets.push(cp));
      }
    }
    return offsets;
  }
  /**
   * Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters
   * of projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is
   * the end of the ray.
   */
  public override projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
  /**
   * Convert the segment detail to a linestring detail:
   * * `detail.childDetail` is set to a clone of the input segment detail (optionally populating pre-allocated `child` object).
   * * `childDetail.a` is set to `segmentIndex`.
   * * `detail.fraction` is set to the global linestring parameter.
   * * `detail.curve` is set to the parent linestring.
   * @param detail segment location detail, converted in place
   * @param segmentIndex index of segment in the linestring
   * @param numSegment linestring segment count
   * @param parent optional linestring primitive
   * @param child optional pre-allocated detail to use to clone the child data
   * @returns reference to input detail, with both linestring and segment data
   */
  public static convertLocalToGlobalDetail(detail: CurveLocationDetail, segmentIndex: number, numSegment: number, parent?: LineString3d, child?: CurveLocationDetail): CurveLocationDetail {
    detail.childDetail = detail.clone(child);
    detail.childDetail.a = segmentIndex;
    detail.fraction = this.mapLocalToGlobalFraction(segmentIndex, detail.fraction, numSegment);
    detail.curve = parent;
    return detail;
  }
}

/**
 * An AnnotatedLineString3d is a linestring with additional surface-related data attached to each point
 * * This is useful in facet construction.
 * @internal
 */
export class AnnotatedLineString3d {
  /** Parameter along curve being faceted.  */
  public curveParam?: GrowableFloat64Array;
  /** uv parameters, stored as uvw with the w possibly used for distinguishing among multiple "faces". */
  public uvwParam?: GrowableXYZArray;
  /** u direction tangent vectors from surface being faceted. */
  public vectorU?: GrowableXYZArray;
  /** v direction tangent vectors from surface being faceted. */
  public vectorV?: GrowableXYZArray;
}

/**
 * Context to be called to incrementally accumulate distance along line segments.
 */
class MoveByDistanceContext {
  public distance0: number;   // accumulated distance through point0
  public point0: Point3d;      // most recent point
  public fraction0: number;   // most recent fraction position
  public targetDistance: number;  // this is always positive.
  /** CAPTURE point0, fraction0, targetDistance */
  public constructor(point0: Point3d, fraction0: number, targetDistance: number) {
    this.point0 = point0;
    this.distance0 = 0.0;
    this.targetDistance = Math.abs(targetDistance);
    this.fraction0 = fraction0;
  }
  // Return CurveSearchStatus indicating whether the accumulated distance has reached the target.
  public distanceStatus(): CurveSearchStatus {
    return Geometry.isSameCoordinate(this.distance0, this.targetDistance) ?
      CurveSearchStatus.success : CurveSearchStatus.stoppedAtBoundary;
  }
  /**
   * Announce next point on the polyline.
   * * if the additional segment does NOT reach the target:
   *   * accumulate the segment length
   *   * update point0 and fraction0
   *   * return false
   *  * if the additional segment DOES reach the target:
   *    * update point0 and fraction0 to the (possibly interpolated) final point and fraction
   *    * return true
   * @param point1 new point
   * @param fraction1 fraction at point1
   * @return true if targetDistance reached.
   */
  public announcePoint(point1: Point3d, fraction1: number): boolean {
    const a = this.point0.distance(point1);
    const distance1 = this.distance0 + a;
    if (distance1 < this.targetDistance && !Geometry.isSameCoordinate(distance1, this.targetDistance)) {
      this.point0.setFromPoint3d(point1);
      this.distance0 = distance1;
      this.fraction0 = fraction1;
      return false;
    }
    const b = this.targetDistance - this.distance0;
    const intervalFraction = Geometry.safeDivideFraction(b, a, 0.0);
    this.point0.interpolate(intervalFraction, point1, this.point0);
    this.fraction0 = Geometry.interpolate(this.fraction0, intervalFraction, fraction1);
    this.distance0 = this.targetDistance;
    return true;
  }
  /**
   * Update point0, fraction0, and distance0 based on extrapolation of a segment between indices of a point array.
   * @returns true if extrapolation succeeded.  (False if indexed points are coincident)
   * @param points
   * @param index0
   * @param index1
   * @param fraction0
   * @param fraction1
   * @param result
   * @param CurveLocationDetail
   */
  public announceExtrapolation(points: GrowableXYZArray,
    index0: number, index1: number,
    fraction0: number, fraction1: number): boolean {
    const residual = this.targetDistance - this.distance0;
    const d01 = points.distanceIndexIndex(index0, index1);
    if (!d01)
      return false;
    const extensionFraction = Geometry.conditionalDivideFraction(residual, d01);
    if (extensionFraction === undefined)
      return false;
    // (Remark: indices are swapped and extensionFraction negated to prevent incidental precision
    // loss with the alternative call with (index0, 1 + extensionFraction, index1);
    points.interpolate(index1, -extensionFraction, index0, this.point0);
    this.distance0 = this.targetDistance;
    this.fraction0 = Geometry.interpolate(fraction1, -extensionFraction, fraction0);
    return true;
  }
}
