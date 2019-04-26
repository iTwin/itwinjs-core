/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { Geometry, AxisOrder, BeJSONFunctions, PlaneAltitudeEvaluator } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { XAndY } from "../geometry3d/XYZProps";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { GrowableXYArray } from "../geometry3d/GrowableXYArray";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive, AnnounceNumberNumberCurvePrimitive } from "./CurvePrimitive";
import { StrokeCountMap } from "./Query/StrokeCountMap";
import { GeometryQuery } from "./GeometryQuery";
import { CurveLocationDetail, CurveSearchStatus, CurveIntervalRole } from "./CurveLocationDetail";
import { Clipper } from "../clipping/ClipUtils";
import { LineSegment3d } from "./LineSegment3d";

/* tslint:disable:variable-name no-empty*/

/* Starting wtih baseIndex and moving index by stepDirection:
If the vector from baseIndex to baseIndex +1 crossed with vectorA can be normalized, accumulate it (scaled) to normal.
Return when successful.
(Do nothing if everything is parallel through limits of the array)
*/
function accumulateGoodUnitPerpendicular(
  points: GrowableXYZArray,
  vectorA: Vector3d,
  baseIndex: number,
  stepDirection: number,
  weight: number,
  normal: Vector3d,
  workVector: Vector3d): boolean {
  const n = points.length;
  if (stepDirection > 0) {
    for (let i = baseIndex; i + 1 < n; i++) {
      points.vectorIndexIndex(i, i + 1, workVector);
      vectorA.crossProduct(workVector, workVector);
      if (workVector.normalizeInPlace()) {
        normal.addScaledInPlace(workVector, weight);
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
        return true;
      }
    }
  }
  return false;
}
/**
 * * A LineString3d (sometimes called a PolyLine) is a sequence of xyz coordinates that are to be joined by line segments.
 * * The point coordinates are stored in a GrowableXYZArray.
 * @public
 */
export class LineString3d extends CurvePrimitive implements BeJSONFunctions {
  private static _workPointA = Point3d.create();
  private static _workPointB = Point3d.create();
  private static _workPointC = Point3d.create();
  private static _workRay = Ray3d.createXAxis();
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof LineString3d; }
  /**
   * A LineString3d extends along its first and final segments.
   */
  public get isExtensibleFractionSpace(): boolean { return true; }

  private _points: GrowableXYZArray;
  private _fractions?: GrowableFloat64Array;
  private _uvParams?: GrowableXYArray;
  private _derivatives?: GrowableXYZArray;
  private _surfaceNormals?: GrowableXYZArray;

  private _pointIndices?: GrowableFloat64Array;
  private _uvIndices?: GrowableFloat64Array;
  private _normalIndices?: GrowableFloat64Array;

  /** return the points array (cloned). */
  public get points(): Point3d[] { return this._points.getPoint3dArray(); }
  /** Return (reference to) point data in packed GrowableXYZArray. */
  public get packedPoints(): GrowableXYZArray { return this._points; }
  /** Return array of fraction parameters. */
  public get fractions(): GrowableFloat64Array | undefined { return this._fractions; }
  public get packedDerivatives(): GrowableXYZArray | undefined { return this._derivatives; }
  public get packedUVParams(): GrowableXYArray | undefined { return this._uvParams; }
  public get packedSurfaceNormals(): GrowableXYZArray | undefined { return this._surfaceNormals; }
  public get normalIndices(): GrowableFloat64Array | undefined { return this._normalIndices; }
  public get paramIndices(): GrowableFloat64Array | undefined { return this._uvIndices; }
  public get pointIndices(): GrowableFloat64Array | undefined { return this._pointIndices; }

  private constructor() {
    super();
    this._points = new GrowableXYZArray();
  }
  public cloneTransformed(transform: Transform): CurvePrimitive {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }

  private static flattenArray(arr: any): any {
    return arr.reduce((flat: any, toFlatten: any) => {
      return flat.concat(Array.isArray(toFlatten) ? LineString3d.flattenArray(toFlatten) : toFlatten);
    }, []);
  }

  public static create(...points: any[]): LineString3d {
    const result = new LineString3d();
    result.addPoints(points);
    return result;
  }

  public static createXY(points: XAndY[], z: number, enforceClosure: boolean = false): LineString3d {
    const result = new LineString3d();
    const xyz = result._points;
    for (const xy of points) {
      xyz.pushXYZ(xy.x, xy.y, z);
    }
    if (enforceClosure && points.length > 1) {
      const distance = xyz.distance(0, xyz.length - 1);
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

  public addPoints(...points: any[]) {
    const toAdd: any[] = LineString3d.flattenArray(points);
    for (const p of toAdd) {
      if (p instanceof Point3d)
        this._points.push(p);
    }
  }
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

  /**
   * If the linestring is not already closed, add a closure point.
   */
  public addClosurePoint() {
    const distance = this._points.distance(0, this._points.length - 1);
    if (distance !== undefined && !Geometry.isSameCoordinate(distance, 0))
      this._points.pushWrap(1);
  }
  /** Elminate (but do not return!!) the final point of the linestring */
  public popPoint() {
    this._points.pop();
  }
  /** Compute `uvParams` array as (xy parts of) a linear transform of the xyz coordinates */
  public computeUVFromXYZTransform(transform: Transform) {
    this._uvParams = GrowableXYArray.createFromGrowableXYZArray(this._points, transform);
  }
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
   * @param radiusToVertices true if polygon is inscribed in circle (radius measured to vertices); false if polygon is outside circle (radius to edges)
   */
  public static createRegularPolygonXY(center: Point3d, edgeCount: number, radius: number, radiusToVertices: boolean = true): LineString3d {
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

  public static createPoints(points: Point3d[]): LineString3d {
    const ls = new LineString3d();
    let point;
    for (point of points)
      ls._points.push(point);
    return ls;
  }
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

  public clone(): LineString3d {
    const retVal = new LineString3d();
    retVal.setFrom(this);
    return retVal;
  }

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
   * @return {*} [[x,y,z],...[x,y,z]]
   */
  public toJSON(): any {
    const value = [];
    let i = 0;
    while (this._points.isIndexValid(i)) {
      value.push(this._points.getPoint3dAtUncheckedPointIndex(i).toJSON());
      i++;
    }
    return value;
  }
  public static fromJSON(json?: any): LineString3d {
    const ls = new LineString3d(); ls.setFromJSON(json); return ls;
  }
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
   * Convert a segment index and local fraction to a global fraction.
   * @param index index of segment being evaluated
   * @param localFraction local fraction within that segment
   */
  public segmentIndexAndLocalFractionToGlobalFraction(index: number, localFraction: number): number {
    const numSegment = this._points.length - 1;
    if (numSegment < 1)
      return 0.0;
    return (index + localFraction) / numSegment;
  }
  /** Return a frenet frame, using nearby points to estimate a plane. */
  public fractionToFrenetFrame(fraction: number, result?: Transform): Transform {
    const n = this._points.length;
    if (n <= 1) {
      if (n === 1)
        return Transform.createTranslation(this._points.getPoint3dAtUncheckedPointIndex(0), result);
      return Transform.createIdentity(result);
    }

    if (n === 2)
      return Transform.createRefs(
        this._points.interpolate(0, fraction, 1)!,
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

  public startPoint() {
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
  /** If i and j are both valid indices, return the vector from point i to point j
   */
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

  public numPoints(): number { return this._points.length; }

  public endPoint() {
    if (this._points.length === 0)
      return Point3d.createZero();
    return this._points.getPoint3dAtUncheckedPointIndex(this._points.length - 1);
  }

  public reverseInPlace(): void {
    if (this._points.length >= 2) {
      let i0 = 0;
      let i1 = this._points.length - 1;
      let a: Point3d = this._points.getPoint3dAtUncheckedPointIndex(0);
      while (i0 < i1) {
        a = this._points.getPoint3dAtUncheckedPointIndex(i0);
        this._points.setAtCheckedPointIndex(i0, this._points.getPoint3dAtUncheckedPointIndex(i1));
        this._points.setAtCheckedPointIndex(i1, a);
        i0++;
        i1--;
      }
    }
  }
  public tryTransformInPlace(transform: Transform): boolean {
    this._points.multiplyTransformInPlace(transform);
    if (this._derivatives)
      this._derivatives.multiplyMatrix3dInPlace(transform.matrix);
    if (this._surfaceNormals)
      this._surfaceNormals.multiplyAndRenormalizeMatrix3dInverseTransposeInPlace(transform.matrix);
    return true;
  }

  public curveLength(): number { return this._points.sumLengths(); }
  public curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
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
      return Math.abs(scaledFraction1 - scaledFraction0) * this._points.distance(index0 - 1, index0)!;
    } else {
      // there is leading partial interval, 0 or more complete segments, and a trailing partial interval.
      // (either or both partial may be zero length)
      let sum = localFraction0 * this._points.distance(index0 - 1, index0)!
        + localFraction1 * (this._points.distance(index1, index1 + 1))!;
      for (let i = index0; i < index1; i++)
        sum += this._points.distance(i, i + 1)!;
      return sum;
    }
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
  public moveSignedDistanceFromFraction(startFraction: number, signedDistance: number, allowExtension: false, result?: CurveLocationDetail): CurveLocationDetail {
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
          return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(this, context.fraction0, context.point0,
            signedDistance, CurveSearchStatus.success, result);
      }
      // fall through for extrapolation from final segment
      if (allowExtension)
        context.announceExtrapolation(this._points, numSegments - 1, numSegments,
          (numSegments - 1) / numSegments, 1.0);
      return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(this, context.fraction0, context.point0,
        signedDistance, context.distanceStatus(), result);
    } else { // (moving backwards)
      if (localFraction <= 0.0)
        leftPointIndex--;
      for (; leftPointIndex >= 0; leftPointIndex--) {
        this._points.getPoint3dAtCheckedPointIndex(leftPointIndex, point1);
        if (context.announcePoint(point1, leftPointIndex / numSegments))
          return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(this, context.fraction0, context.point0,
            signedDistance, CurveSearchStatus.success, result);
      }
      // fall through for backward extrapolation from initial segment
      if (allowExtension)
        context.announceExtrapolation(this._points, 1, 0, 1.0 / numSegments, 0.0);
      return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(this, context.fraction0, context.point0,
        -context.distance0, context.distanceStatus(), result);
    }
  }

  public quickLength(): number { return this.curveLength(); }
  /**
   * compute and normalize cross product among 3 points on the linestring.
   * * "any" 3 points are acceptable -- no test for positive overall sense.
   * * This is appropriate for polygon known to be convex.
   * * use points spread at index step n/3, hopefully avoiding colinear points.
   * * If that fails, try points 012
   * @param result computed normal.
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

  public closestPoint(spacePoint: Point3d, extend: boolean, result?: CurveLocationDetail): CurveLocationDetail {
    result = CurveLocationDetail.create(this, result);

    const numPoints = this._points.length;
    if (numPoints > 0) {
      const lastIndex = numPoints - 1;
      result.setFP(1.0, this._points.getPoint3dAtUncheckedPointIndex(lastIndex), undefined);
      result.setDistanceTo(spacePoint);
      if (numPoints > 1) {
        let segmentFraction = 0;
        let d = 0;
        const df = 1.0 / lastIndex;
        for (let i = 1; i < numPoints; i++) {
          segmentFraction = spacePoint.fractionOfProjectionToLine(this._points.getPoint3dAtUncheckedPointIndex(i - 1), this._points.getPoint3dAtUncheckedPointIndex(i));
          if (segmentFraction < 0) {
            if (!extend || i > 1)
              segmentFraction = 0.0;
          } else if (segmentFraction > 1.0) {
            if (!extend || i < lastIndex)
              segmentFraction = 1.0;
          }
          this._points.getPoint3dAtUncheckedPointIndex(i - 1).interpolate(segmentFraction, this._points.getPoint3dAtUncheckedPointIndex(i), result.pointQ);
          d = result.pointQ.distance(spacePoint);
          if (d < result.a) {
            result.setFP((i - 1 + segmentFraction) * df, result.pointQ, undefined, d);
          }
        }
      }
    }
    return result;
  }

  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return this._points.isCloseToPlane(plane, Geometry.smallMetricDistance);
  }

  /** push a hit, fixing up the prior entry if needed.
   * return the incremented counter.
   */
  private static pushVertexHit(result: CurveLocationDetail[], counter: number, cp: CurvePrimitive, fraction: number, point: Point3d) {
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
  /** find intersections with a plane.
   *  Intersections within segments are recorded as CurveIntervalRole.isolated
   *   Intersections at isolated "on" vertex are recoded as CurveIntervalRole.isolatedAtVertex.
   */
  public appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
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
    for (let i = 0; i < this._points.length; i++ , pointA.setFrom(pointB), hA = hB) {
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

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void { this._points.extendRange(rangeToExtend, transform); }

  public isAlmostEqual(other: GeometryQuery): boolean {
    if (!(other instanceof LineString3d))
      return false;
    if (!GrowableXYZArray.isAlmostEqual(this._points, other._points)) return false;
    return true;
  }
  /** Append (clone of) one point.
   * * BUT ... skip if duplicates the tail of prior points.
   * * if fraction is given, "duplicate" considers both point and fraction.
   */
  public appendStrokePoint(point: Point3d, fraction?: number) {
    const n = this._points.length;
    let add = true;
    const addFraction = fraction !== undefined && this._fractions !== undefined;
    if (n > 0) {
      if (addFraction && Geometry.isSameCoordinate(fraction!, this._fractions!.back()))
        add = false;
      if (point.isAlmostEqual(this._points.getPoint3dAtUncheckedPointIndex(n - 1)))
        add = false;
    }

    if (add) {
      this._points.push(point);
      if (addFraction)
        this.addFraction(fraction!);
    }

  }

  /** Append a suitable evaluation of a curve ..
   * * always append the curve point
   * * if fraction array is present, append the fraction
   * * if derivative array is present, append the derivative
   * BUT ... skip if duplicates the tail of prior points.
   */
  public appendFractionToPoint(curve: CurvePrimitive, fraction: number) {
    if (this._derivatives) {
      const ray = curve.fractionToPointAndDerivative(fraction, LineString3d._workRay);
      if (this._fractions)
        this._fractions.push(fraction);
      this._points.push(ray.origin);
      if (this._derivatives)
        this._derivatives.push(ray.direction);

    } else {
      const point = curve.fractionToPoint(fraction, LineString3d._workPointA);
      if (this._fractions)
        this._fractions.push(fraction);
      this._points.push(point);
    }
  }
  /**
   * clear all array data:
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

  /** Evaluate a curve at uniform fractions.  Append the evaluations to this linestring.
   * @param curve primitive to evaluate.
   * @param numStrokes number of strokes (edges).
   * @param fraction0 starting fraction coordinate
   * @param fraction1 end fraction coordinate
   * @param include01 if false, points at fraction0 and fraction1 are omitted.
   */
  public appendFractionalStrokePoints(
    curve: CurvePrimitive,
    numStrokes: number,
    fraction0: number = 0,
    fraction1: number = 1,
    include01: boolean = true): void {
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
      // Do NOT apply minstrokes per primitive.
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

  /** Emit strokable parts of the curve to a caller-supplied handler.
   * If the stroke options does not have a maxEdgeLength, one stroke is emited for each segment of the linestring.
   * If the stroke options has a maxEdgeLength, smaller segments are emitted as needed.
   */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const n = this._points.length;
    handler.startCurvePrimitive(this);
    if (n > 1) {
      const df = 1.0 / (n - 1);
      // This is a linestring.
      // There is no need for chordTol and angleTol within a segment.
      // Do NOT apply minstrokes per primitive.
      if (options && options.hasMaxEdgeLength) {
        for (let i = 1; i < n; i++) {
          const numStroke = options.applyMaxEdgeLength(1, this._points.getPoint3dAtUncheckedPointIndex(i - 1).distance(this._points.getPoint3dAtUncheckedPointIndex(i)));
          handler.announceSegmentInterval(this, this._points.getPoint3dAtUncheckedPointIndex(i - 1), this._points.getPoint3dAtUncheckedPointIndex(i), numStroke, (i - 1) * df, i * df);
        }
      } else {
        for (let i = 1; i < n; i++) {
          handler.announceSegmentInterval(this, this._points.getPoint3dAtUncheckedPointIndex(i - 1), this._points.getPoint3dAtUncheckedPointIndex(i), 1, (i - 1) * df, i * df);
        }
      }
    }
    handler.endCurvePrimitive(this);
  }

  /**
   * return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    const numPoints = this._points.length;
    let numStroke = numPoints - 1;

    if (options && options.hasMaxEdgeLength) {
      numStroke = 0;
      for (let i = 1; i < numPoints; i++) {
        numStroke += options.applyMaxEdgeLength(1, this._points.distance(i - 1, i)!);
      }
    }
    return numStroke;
  }
  /**
   * Compute individual segment stroke counts.  Attach in a StrokeCountMap.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap evolving parent map.
   */
  public computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentStrokeMap?: StrokeCountMap) {
    const numPoints = this._points.length;
    const applyOptions = options !== undefined && options.hasMaxEdgeLength;
    const myData = StrokeCountMap.createWithCurvePrimitiveAndOptionalParent(this, parentStrokeMap, []);
    for (let i = 1; i < numPoints; i++) {
      const segmentLength = this._points.distance(i - 1, i)!;
      const numStrokeOnSegment = applyOptions ? options!.applyMaxEdgeLength(1, segmentLength)! : 1;
      myData.addToCountAndLength(numStrokeOnSegment, segmentLength);
    }
    CurvePrimitive.installStrokeCountMap(this, myData, parentStrokeMap);
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLineString3d(this);
  }
  // HARD TO TEST -- tests that get to announceClipInterval for arc, bspline do NOT get here with
  // linestring because the controller has special case loops through segments?
  /**
   * Find intervals of this curveprimitve that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce (optional) function to be called announcing fractional intervals"  ` announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const n = this._points.length;
    if (n < 2) return false;
    let globalFractionA = 0.0;
    let globalFractionB = 1.0;
    const capture = (localFraction0: number, localFraction1: number) => {
      if (announce)
        announce(
          Geometry.interpolate(globalFractionA, localFraction0, globalFractionB),
          Geometry.interpolate(globalFractionA, localFraction1, globalFractionB),
          this);
    };
    const pointA = LineString3d._workPointA;
    const pointB = LineString3d._workPointB;
    this._points.getPoint3dAtUncheckedPointIndex(0, pointA);
    let status = false;
    for (let i = 1; i < n; i++ , pointA.setFrom(pointB), globalFractionA = globalFractionB) {
      this._points.getPoint3dAtUncheckedPointIndex(i, pointB);
      globalFractionB = i / (n - 1);
      if (clipper.announceClippedSegmentIntervals(0.0, 1.0, pointA, pointB, capture))
        status = true;
    }
    return status;
  }
  private static _indexPoint = Point3d.create();  // private point for indexAndFractionToPoint.
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
    if (index >= n) {
      index = n - 1;
      fraction += 1;
    }
    this._points.interpolate(index, fraction, index + 1, LineString3d._indexPoint);
    dest.push(LineString3d._indexPoint);
  }
  /** Return (if possible) a LineString which is a portion of this curve.
   * * This implementation does NOT extrapolate the linestring -- fractions are capped at 0 and 1.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public clonePartialCurve(fractionA: number, fractionB: number): CurvePrimitive | undefined {
    if (fractionB < fractionA) {
      const linestringA = this.clonePartialCurve(fractionB, fractionA);
      if (linestringA)
        linestringA.reverseInPlace();
      return linestringA;
    }
    const n = this._points.length;
    const numEdge = n - 1;
    if (n < 2 || fractionA >= 1.0 || fractionB <= 0.0)
      return undefined;
    if (fractionA < 0)
      fractionA = 0;
    if (fractionB > 1)
      fractionB = 1;
    const gA = fractionA * numEdge;
    const gB = fractionB * numEdge;
    const indexA = Math.floor(gA);
    const indexB = Math.floor(gB);
    const localFractionA = gA - indexA;
    const localFractionB = gB - indexB;
    const result = LineString3d.create();
    this.addResolvedPoint(indexA, localFractionA, result._points);
    for (let index = indexA + 1; index <= indexB; index++) {
      this._points.getPoint3dAtUncheckedPointIndex(index, LineString3d._workPointA);
      result._points.push(LineString3d._workPointA);
    }
    if (!Geometry.isSmallRelative(localFractionB)) {
      this.addResolvedPoint(indexB, localFractionB, result._points);
    }
    return result;
  }
  /** Return (if possible) a specific segment of the linestring */
  public getIndexedSegment(index: number): LineSegment3d | undefined {
    if (index >= 0 && index + 1 < this._points.length)
      return LineSegment3d.create(this._points.getPoint3dAtCheckedPointIndex(index)!, this._points.getPoint3dAtCheckedPointIndex(index + 1)!);
    return undefined;
  }
  /**
   * @returns true if first and last points are within metric tolerance.
   */
  public get isPhysicallyClosed(): boolean {
    return this._points.length > 0 && Geometry.isSmallMetricDistance(this._points.distance(0, this._points.length - 1)!);
  }

  /**
   * evaluate strokes at fractions indicated in a StrokeCountMap.
   * * The map must have an array of component counts corresponding to the segemnet of this linestring.
   * * "fractions" in the output are mapped within a0,a1 of the map.componetData
   * @param map = stroke count data.
   * @param destLinestring = receiver linestring.
   * @return number of strokes added.  0 if `map.componentData` does not match the linestring
   */
  public addMappedStrokesToLineString3D(map: StrokeCountMap, destLinestring: LineString3d): number {
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
      for (let k = 0; k + 1 < numParentPoint; k++ , pointA.setFromPoint3d(pointB)) {
        points.getPoint3dAtUncheckedPointIndex(k + 1, pointB);
        const segmentMap = map.componentData![k];
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
}
/** An AnnotatedLineString3d is a linestring with additional surface-related data attached to each point
 * * This is useful in facet construction.
 * @internal
 */
export class AnnotatedLineString3d {
  public curveParam?: GrowableFloat64Array;
  /**
   * uv parameters, stored as uvw with the w possibly used for distinguishing among multiple "faces".
   */
  public uvwParam?: GrowableXYZArray;
  public vecturU?: GrowableXYZArray;
  public vectorV?: GrowableXYZArray;
}
/**
 * context to be called to incrementally accumulate distance along line segments.
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
   * @returns true if extraploation succeeded.  (False if indexed points are coincident)
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
    const d01 = points.distance(index0, index1);
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
