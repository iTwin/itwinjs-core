/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { assert } from "@itwin/core-bentley";
import { CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { AxisOrder, Geometry, PlaneAltitudeEvaluator, PolygonLocation } from "../Geometry";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { XYParitySearchContext } from "../topology/XYParitySearchContext";
import { FrameBuilder } from "./FrameBuilder";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedReadWriteXYZCollection, IndexedXYZCollection } from "./IndexedXYZCollection";
import { Matrix3d } from "./Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { PolylineOps } from "./PolylineOps";
import { Range1d, Range3d } from "./Range";
import { Ray3d } from "./Ray3d";
import { SortablePolygon } from "./SortablePolygon";
import { XAndY, XYAndZ } from "./XYZProps";

/**
 * Carries data about a point in the plane of a polygon.
 * @public
 */
export class PolygonLocationDetail {
  /** The coordinates of the point p. */
  public point: Point3d;
  /** Application-specific number */
  public a: number;
  /** Application-specific vector */
  public v: Vector3d;
  /** A number that classifies the point's location with respect to the polygon. */
  public code: PolygonLocation;
  /** Index of the polygon vertex at the base of the edge closest to p. */
  public closestEdgeIndex: number;
  /** The parameter along the closest edge of the projection of p. */
  public closestEdgeParam: number;

  private constructor() {
    this.point = new Point3d();
    this.a = 0.0;
    this.v = new Vector3d();
    this.code = PolygonLocation.Unknown;
    this.closestEdgeIndex = 0;
    this.closestEdgeParam = 0.0;
  }

  /** Invalidate this detail. */
  public invalidate() {
    this.point.setZero();
    this.a = 0.0;
    this.v.setZero();
    this.code = PolygonLocation.Unknown;
    this.closestEdgeIndex = 0;
    this.closestEdgeParam = 0.0;
  }

  /** Create an invalid detail.
   * @param result optional pre-allocated object to fill and return
   */
  public static create(result?: PolygonLocationDetail): PolygonLocationDetail {
    if (undefined === result)
      result = new PolygonLocationDetail();
    else
      result.invalidate();
    return result;
  }

  /** Set the instance contents from the other detail.
   * @param other detail to clone
   */
  public copyContentsFrom(other: PolygonLocationDetail) {
    this.point.setFrom(other.point);
    this.a = other.a;
    this.v.setFrom(other.v);
    this.code = other.code;
    this.closestEdgeIndex = other.closestEdgeIndex;
    this.closestEdgeParam = other.closestEdgeParam;
  }

  /** Whether this detail is valid. */
  public get isValid(): boolean {
    return this.code !== PolygonLocation.Unknown;
  }

  /** Whether this instance specifies a location inside or on the polygon. */
  public get isInsideOrOn(): boolean {
    return this.code === PolygonLocation.InsidePolygon ||
      this.code === PolygonLocation.OnPolygonVertex || this.code === PolygonLocation.OnPolygonEdgeInterior ||
      this.code === PolygonLocation.InsidePolygonProjectsToVertex || this.code === PolygonLocation.InsidePolygonProjectsToEdgeInterior;
  }
  /**
   * Set point, index, and fraction for an "at vertex" or "along edge" PolygonLocationDetail.
   * * Point is not captured; its coordinates are copied.
   */
  public static createAtVertexOrEdge(point: Point3d, index: number, fraction: number = 0): PolygonLocationDetail {
    const detail = new PolygonLocationDetail();
    detail.point.setFrom(point);
    detail.closestEdgeIndex = index;
    detail.closestEdgeParam = fraction;
    fraction = Geometry.clamp(fraction, 0, 1);
    detail.code = (fraction > 0 && fraction < 1) ? PolygonLocation.OnPolygonEdgeInterior : PolygonLocation.OnPolygonVertex;
    return detail;
  }
}

/**
 * A pair of PolygonLocationDetail.
 * @public
 */
export class PolygonLocationDetailPair {
  /** The first of the two details. */
  public detailA: PolygonLocationDetail;
  /** The second of the two details. */
  public detailB: PolygonLocationDetail;

  /** Constructor, captures inputs */
  private constructor(detailA?: PolygonLocationDetail, detailB?: PolygonLocationDetail) {
    this.detailA = detailA ? detailA : PolygonLocationDetail.create();
    this.detailB = detailB ? detailB : PolygonLocationDetail.create();
  }
  /** Create an instance by capturing inputs */
  public static create(detailA: PolygonLocationDetail, detailB: PolygonLocationDetail, result?: PolygonLocationDetailPair): PolygonLocationDetailPair {
    if (!result)
      return new PolygonLocationDetailPair(detailA, detailB);
    result.detailA = detailA;
    result.detailB = detailB;
    return result;
  }
  /** Make a deep copy of this PolygonLocationDetailPair */
  public clone(result?: PolygonLocationDetailPair): PolygonLocationDetailPair {
    result = result ? result : new PolygonLocationDetailPair();
    result.detailA.copyContentsFrom(this.detailA);
    result.detailB.copyContentsFrom(this.detailB);
    return result;
  }
  /** Swap the details of A, B */
  public swapDetails() {
    const q = this.detailA;
    this.detailA = this.detailB;
    this.detailB = q;
  }
}

/**
 * Carrier for a loop extracted from clip operation, annotated for sorting
 * @internal
 */
export class CutLoop {
  /* All points of the loop */
  public xyz: GrowableXYZArray;
  /* ray within point of "on" edge */
  public edge?: Ray3d;
  public sortCoordinate0: number;
  public sortCoordinate1: number;
  public sortDelta: number;
  public isNotch: boolean;
  public constructor(xyz: GrowableXYZArray) {
    this.xyz = xyz;
    this.edge = undefined;
    this.sortCoordinate0 = this.sortCoordinate1 = 0;
    this.sortDelta = 0;
    this.isNotch = false;
  }
  /**
   * Create a `CutLoop` structure annotated with the vector from last point to first.
   * @param xyz coordinates to capture
   */
  public static createCaptureWithReturnEdge(xyz: GrowableXYZArray): CutLoop {
    const result = new CutLoop(xyz);
    if (xyz.length >= 2)
      result.edge = Ray3d.createStartEnd(xyz.front()!, xyz.back()!);
    return result;
  }
  /**
   * Set up coordinates for sort steps:
   * * Make `sortCoordinate0` and `sortCoordinate` the (algebraically sorted) start and end fractions along the ray
   * * Make `sortDelta` the oriented difference of those two
   * * Hence sorting on the coordinates puts loops in left-to-right order by the their edge vector leftmost point.
   */
  public setSortCoordinates(ray: Ray3d) {
    this.sortDelta = this.edge!.direction.dotProduct(ray.direction);
    const a = ray.dotProductToPoint(this.edge!.origin);
    if (this.sortDelta >= 0) {
      this.sortCoordinate0 = a;
      this.sortCoordinate1 = a + this.sortDelta;
    } else {
      this.sortCoordinate0 = a + this.sortDelta;    // and sortDelta is negative !!!
      this.sortCoordinate1 = a;

    }
  }
  /** Return
   * * 0 if other sort limits are not strictly contained in this.
   * * 1 if other sort limits are strictly contained with same direction
   * * -1 if other sort limits are strictly contained in opposite direction.
   */
  public containsSortLimits(other: CutLoop): number {
    if (other.sortCoordinate0 >= this.sortCoordinate1
      || other.sortCoordinate0 <= this.sortCoordinate0
      || other.sortCoordinate1 <= this.sortCoordinate0
      || other.sortCoordinate1 >= this.sortCoordinate1)
      return 0;
    return this.sortDelta * other.sortDelta > 0 ? 1 : -1;
  }
  /**
   * * push coordinates from other onto this
   * * reset this.sortCoordinate0 to other.sortCoordinate1
   * @param other new coordinates
   */
  public absorb(other: CutLoop) {
    this.xyz.pushFromGrowableXYZArray(other.xyz);
    this.sortCoordinate0 = other.sortCoordinate1;
  }
  /** Comparison function for system sort function applied to an array of CutLoop .... */
  public static sortFunction(loopA: CutLoop, loopB: CutLoop): number {
    const q = loopA.sortCoordinate0 - loopB.sortCoordinate0;
    return q > 0 ? 1 : -1;
  }

  /** Return first point coordinates.
   * * For type checking, assume array is not empty.
   */
  public front(result?: Point3d): Point3d { return this.xyz.front(result)!; }
  /** Return last point coordinates.
   * * For type checking, assume array is not empty.
   */
  public back(result?: Point3d): Point3d { return this.xyz.back(result)!; }

}
/**
 * Context to hold an array of input loops and apply sort logic.
 * * This is used when a non-convex face is clipped by a plane
 * *  Simple convex clip logic in this case generates double-back edges that need to be eliminated.
 * * This class manages the elimination.
 * * Usage pattern is:
 * @internal
 */
export class CutLoopMergeContext {
  /** Array (filled by user code) of loops being sorted. Contents are subject to being changed during sort. */
  public inputLoops: CutLoop[];
  /** Array (filled by sortAndMergeLoops) of reorganized loops. */
  public outputLoops: CutLoop[];
  // Initialize with empty loop arrays.
  public constructor() {
    this.inputLoops = [];
    this.outputLoops = [];
  }
  /**
   *  * Search all start and end points for the one most distant from point0.
   */
  private mostDistantPoint(point0: Point3d, workPoint: Point3d, resultPoint: Point3d) {
    let dMax = -1.0;
    resultPoint.setZero();
    let d;
    for (const loop of this.inputLoops) {
      loop.front(workPoint);
      d = workPoint.distanceSquared(point0);
      if (d > dMax) {
        dMax = d;
        resultPoint.setFromPoint3d(workPoint);
      }
      loop.back(workPoint);
      d = workPoint.distanceSquared(point0);
      if (d > dMax) {
        dMax = d;
        resultPoint.setFromPoint3d(workPoint);
      }
    }
  }
  /**
   * * Find a long (probably longest) edge through start and end points of inputs.
   * * Setup sortCoordinate0 and sortCoordinate1 along that edge for each loop
   * * sort all inputLoop members by sortCoordinate0.
   */
  private sortInputs() {
    if (this.inputLoops.length > 0 && this.inputLoops[0].xyz.length > 0) {
      const point0 = this.inputLoops[0].xyz.front()!;
      const workPoint = Point3d.create();
      const point1 = Point3d.create();
      // point0 could be in the middle.   Find the most distant point ...
      this.mostDistantPoint(point0, workPoint, point1);
      // And again from point1 to get to the other extreme .  .
      this.mostDistantPoint(point1, workPoint, point0);
      const sortRay = Ray3d.createStartEnd(point0, point1);
      sortRay.direction.normalizeInPlace();
      for (const loop of this.inputLoops)
        loop.setSortCoordinates(sortRay);
      this.inputLoops.sort((loopA, loopB) => CutLoop.sortFunction(loopA, loopB));

    }
  }
  /**
   * * sort all input loops by coordinate along the cut edge
   * * sweep left to right, using start and end coordinates to decide if loops are outer or hole, and combine holes into their containing outer loops.
   */
  public sortAndMergeLoops() {
    this.sortInputs();
    const inputs = this.inputLoops;
    const outputs = this.outputLoops;
    const stack = [];
    outputs.length = 0;
    for (const candidate of inputs) {
      candidate.isNotch = false;
      // candidate must be either (a) absorbed in to of stack or (b) pushed onto stack.
      // If pushed, must have indication of natch state.
      for (; stack.length > 0;) {
        const topOfStack = stack[stack.length - 1];
        const containment = topOfStack.containsSortLimits(candidate);
        if (containment === 0) {
          if (!topOfStack.isNotch)
            outputs.push(topOfStack);
          stack.pop();
          continue;   // a larger topOfStack may have appeared !
          candidate.isNotch = false;
        } else if (containment === 1) {
          candidate.isNotch = false;
          break;
        } else {
          topOfStack.absorb(candidate);
          candidate.isNotch = true;
          break;
        }
      }
      stack.push(candidate);
    }
    // Anything on stack must be complete ...
    for (const p of stack) {
      if (!p.isNotch)
        outputs.push(p);
    }
  }
}
/**
 * Various static methods to perform computations on an array of points interpreted as a polygon.
 * @public
 */
export class PolygonOps {
  /** Sum areas of triangles from points[0] to each far edge.
   * * Consider triangles from points[0] to each edge.
   * * Sum the absolute areas (without regard to orientation) all these triangles.
   * @returns sum of absolute triangle areas.
   */
  public static sumTriangleAreas(points: Point3d[] | GrowableXYZArray): number {
    let s = 0;
    const n = points.length;
    if (Array.isArray(points)) {
      if (n >= 3) {
        const origin = points[0];
        const vector0 = origin.vectorTo(points[1]);
        let vector1 = Vector3d.create();
        // This will work with or without closure edge.  If closure is given, the last vector is 000.
        for (let i = 2; i < n; i++) {
          vector1 = origin.vectorTo(points[i], vector1);
          s += vector0.crossProductMagnitude(vector1);
          vector0.setFrom(vector1);
        }
      }
      return s * 0.5;
    }
    const crossVector = Vector3d.create();
    for (let i = 2; i < n; i++) {
      points.crossProductIndexIndexIndex(0, i - 1, i, crossVector);
      s += crossVector.magnitude();
    }
    return s * 0.5;
  }
  /** Sum areas of triangles from points[0] to each far edge, as viewed with upVector pointing up.
   * * Consider triangles from points[0] to each edge.
   * * Sum the areas perpendicular to the upVector.
   * * If the upVector is near-zero length, a simple z vector is used.
   * @returns sum of triangle areas.
   */
  public static sumTriangleAreasPerpendicularToUpVector(points: Point3d[] | GrowableXYZArray, upVector: Vector3d): number {
    let scale = upVector.magnitude();
    if (scale < Geometry.smallMetricDistance) {
      upVector = Vector3d.create(0, 0, 1);
      scale = 1.0;
    }

    let s = 0;
    const n = points.length;
    if (Array.isArray(points)) {
      if (n >= 3) {
        const origin = points[0];
        const vector0 = origin.vectorTo(points[1]);
        let vector1 = Vector3d.create();
        // This will work with or without closure edge.  If closure is given, the last vector is 000.
        for (let i = 2; i < n; i++) {
          vector1 = origin.vectorTo(points[i], vector1);
          s += vector0.tripleProduct(vector1, upVector);
          vector0.setFrom(vector1);
        }
      }
      return s * 0.5 / scale;
    }
    const crossVector = Vector3d.create();
    for (let i = 2; i < n; i++) {
      points.crossProductIndexIndexIndex(0, i - 1, i, crossVector);
      s += crossVector.dotProduct(upVector);
    }
    return s * 0.5 / scale;
  }

  /** Sum areas of triangles from points[0] to each far edge.
   * * Consider triangles from points[0] to each edge.
   * * Sum the signed areas of all these triangles. (An area can be negative at a concave corner.)
   * @returns sum of signed triangle areas.
   */
  public static sumTriangleAreasXY(points: Point3d[]): number {
    let s = 0.0;
    const n = points.length;
    if (n >= 3) {
      const origin = points[0];
      const vector0 = origin.vectorTo(points[1]);
      let vector1 = Vector3d.create();
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        vector1 = origin.vectorTo(points[i], vector1);
        s += vector0.crossProductXY(vector1);
        vector0.setFrom(vector1);
      }
    }
    s *= 0.5;
    return s;
  }
  /** These values are the integrated area moment products [xx,xy,xz, x]
   * for a right triangle in the first quadrant at the origin -- (0,0),(1,0),(0,1)
   */
  private static readonly _triangleMomentWeights = Matrix4d.createRowValues(2.0 / 24.0, 1.0 / 24.0, 0, 4.0 / 24.0, 1.0 / 24.0, 2.0 / 24.0, 0, 4.0 / 24.0, 0, 0, 0, 0, 4.0 / 24.0, 4.0 / 24.0, 0, 12.0 / 24.0);
  /** These values are the integrated volume moment products [xx,xy,xz, x, yx,yy,yz,y, zx,zy,zz,z,x,y,z,1]
   * for a tetrahedron in the first quadrant at the origin -- (0,00),(1,0,0),(0,1,0),(0,0,1)
   */
  private static readonly _tetrahedralMomentWeights = Matrix4d.createRowValues(
    1.0 / 60.0, 1.0 / 120, 1.0 / 120, 1.0 / 24.0,
    1.0 / 120, 1.0 / 60.0, 1.0 / 120, 1.0 / 24.0,
    1.0 / 120, 1.0 / 120, 1.0 / 60.0, 1.0 / 24.0,
    1.0 / 24.0, 1.0 / 24.0, 1.0 / 24.0, 1.0 / 6.0);
  // statics for shared reuse.
  // many methods use these.
  // only use them in "leaf" methods that are certain not to call other users . . .
  private static _vector0 = Vector3d.create();
  private static _vector1 = Vector3d.create();
  private static _vector2 = Vector3d.create();
  private static _vectorOrigin = Vector3d.create();
  private static _normal = Vector3d.create();
  private static _matrixA = Matrix4d.createIdentity();
  private static _matrixB = Matrix4d.createIdentity();
  private static _matrixC = Matrix4d.createIdentity();
  /** return a vector which is perpendicular to the polygon and has magnitude equal to the polygon area. */
  public static areaNormalGo(points: IndexedXYZCollection, result?: Vector3d): Vector3d | undefined {
    if (!result)
      result = new Vector3d();
    else
      result.setZero();
    const n = points.length;
    if (n === 3) {
      points.crossProductIndexIndexIndex(0, 1, 2, result);
    } else if (n > 3) {
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        points.accumulateCrossProductIndexIndexIndex(0, i - 1, i, result);
      }
    }
    // ALL BRANCHES SUM FULL CROSS PRODUCTS AND EXPECT SCALE HERE
    result.scaleInPlace(0.5);
    return result.isZero ? undefined : result;
  }
  /** return a vector which is perpendicular to the polygon and has magnitude equal to the polygon area. */
  public static areaNormal(points: Point3d[], result?: Vector3d): Vector3d {
    if (!result)
      result = Vector3d.create();
    PolygonOps.areaNormalGo(new Point3dArrayCarrier(points), result);
    return result;
  }
  /** return the area of the polygon.
   * * This assumes the polygon is planar
   * * This does NOT assume the polygon is on the xy plane.
   */
  public static area(points: Point3d[]): number {
    return PolygonOps.areaNormal(points).magnitude();
  }
  /** return the projected XY area of the polygon. */
  public static areaXY(points: Point3d[] | IndexedXYZCollection): number {
    let area = 0.0;
    if (points instanceof IndexedXYZCollection) {
      if (points.length > 2) {
        const x0 = points.getXAtUncheckedPointIndex(0);
        const y0 = points.getYAtUncheckedPointIndex(0);
        let u1 = points.getXAtUncheckedPointIndex(1) - x0;
        let v1 = points.getYAtUncheckedPointIndex(1) - y0;
        let u2, v2;
        for (let i = 2; i + 1 < points.length; i++, u1 = u2, v1 = v2) {
          u2 = points.getXAtUncheckedPointIndex(i) - x0;
          v2 = points.getYAtUncheckedPointIndex(i) - y0;
          area += Geometry.crossProductXYXY(u1, v1, u2, v2);
        }
      }
    } else {
      for (let i = 1; i + 1 < points.length; i++)
        area += points[0].crossProductToPointsXY(points[i], points[i + 1]);
    }
    return 0.5 * area;
  }
  /** Sum the areaXY () values for multiple polygons */
  public static sumAreaXY(polygons: Point3d[][]): number {
    let s = 0.0;
    for (const p of polygons)
      s += this.areaXY(p);
    return s;
  }
  /**
   * Return a Ray3d with (assuming the polygon is planar and not self-intersecting)
   * * origin at the centroid of the (3D) polygon
   * * normal is a unit vector perpendicular to the plane
   * * 'a' member is the area.
   * @param points
   */
  public static centroidAreaNormal(points: IndexedXYZCollection | Point3d[]): Ray3d | undefined {
    if (Array.isArray(points)) {
      const carrier = new Point3dArrayCarrier(points);
      return this.centroidAreaNormal(carrier);
    }
    const n = points.length;
    if (n === 3) {
      const normal = points.crossProductIndexIndexIndex(0, 1, 2)!;
      const a = 0.5 * normal.magnitude();
      const centroid = points.getPoint3dAtCheckedPointIndex(0)!;
      points.accumulateScaledXYZ(1, 1.0, centroid);
      points.accumulateScaledXYZ(2, 1.0, centroid);
      centroid.scaleInPlace(1.0 / 3.0);
      const result = Ray3d.createCapture(centroid, normal);
      if (result.tryNormalizeInPlaceWithAreaWeight(a))
        return result;
      return undefined;
    }
    if (n >= 3) {

      const areaNormal = Vector3d.createZero();
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        points.accumulateCrossProductIndexIndexIndex(0, i - 1, i, areaNormal);
      }
      areaNormal.normalizeInPlace();

      const origin = points.getPoint3dAtCheckedPointIndex(0)!;
      const vector0 = Vector3d.create();
      const vector1 = Vector3d.create();
      points.vectorXYAndZIndex(origin, 1, vector0);
      let cross = Vector3d.create();
      const centroidSum = Vector3d.createZero();
      const normalSum = Vector3d.createZero();
      let signedTriangleArea;
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        points.vectorXYAndZIndex(origin, i, vector1);
        cross = vector0.crossProduct(vector1, cross);
        signedTriangleArea = areaNormal.dotProduct(cross);    // well, actually twice the area.
        normalSum.addInPlace(cross); // this grows to twice the area
        const b = signedTriangleArea / 6.0;
        centroidSum.plus2Scaled(vector0, b, vector1, b, centroidSum);
        vector0.setFrom(vector1);
      }
      const area = 0.5 * normalSum.magnitude();
      const inverseArea = Geometry.conditionalDivideFraction(1, area);
      if (inverseArea !== undefined) {
        const result = Ray3d.createCapture(origin.plusScaled(centroidSum, inverseArea), normalSum);
        result.tryNormalizeInPlaceWithAreaWeight(area);
        return result;
      }
    }
    return undefined;
  }
  // Has the potential to be combined with centroidAreaNormal for point3d array and Ray3d return listed above...
  // Returns undefined if given point array less than 3 or if not safe to divide at any point
  /**
   * * Return (in caller-allocated centroid) the centroid of the xy polygon.
   * * Return (as function value)  the area
   */
  public static centroidAndAreaXY(points: Point2d[], centroid: Point2d): number | undefined {
    let area = 0.0;
    centroid.set(0, 0);
    if (points.length < 3)
      return undefined;
    const origin = points[0];
    let vectorSum = Vector2d.create(0, 0); // == sum ((U+V)/3) * (U CROSS V)/2 -- but leave out divisions
    let areaSum = 0.0; // == sum (U CROSS V) / 2 -- but leave out divisions
    for (let i = 1; i + 1 < points.length; i++) {
      const vector0 = origin.vectorTo(points[i]);
      const vector1 = origin.vectorTo(points[i + 1]);
      const tempArea = vector0.crossProduct(vector1);
      vectorSum = vectorSum.plus(vector0.plus(vector1).scale(tempArea));
      areaSum += tempArea;
    }
    area = areaSum * 0.5;
    const a = Geometry.conditionalDivideFraction(1.0, 6.0 * area);
    if (a === undefined) {
      centroid.setFrom(origin);
      return undefined;
    }
    centroid.setFrom(origin.plusScaled(vectorSum, a));
    return area;
  }
  /**
   * Return a unit normal to the plane of the polygon.
   * @param points array of points around the polygon.
   * @param result caller-allocated result vector.
   * @return true if and only if result has unit length
   */
  public static unitNormal(points: IndexedXYZCollection, result: Vector3d): boolean {
    result.setZero();
    let n = points.length;
    if (n > 1 && points.getPoint3dAtUncheckedPointIndex(0).isExactEqual(points.getPoint3dAtUncheckedPointIndex(n - 1)))
      --n;  // ignore closure point
    if (n === 3) {
      points.crossProductIndexIndexIndex(0, 1, 2, result);
      return result.normalizeInPlace();
    }
    if (n === 4) {
      // cross product of diagonals is more stable than from single of the points . . .
      points.vectorIndexIndex(0, 2, PolygonOps._vector0);
      points.vectorIndexIndex(1, 3, PolygonOps._vector1);
      PolygonOps._vector0.crossProduct(PolygonOps._vector1, result);
      return result.normalizeInPlace();
    }
    // more than 4 points  ... no shortcuts ...
    PolygonOps.areaNormalGo(points, result);
    return result.normalizeInPlace();
  }
  /** Accumulate to the matrix of area products of a polygon with respect to an origin.
   * The polygon is assumed to be planar and non-self-intersecting.
   */
  /** Accumulate to the matrix of area products of a polygon with respect to an origin.
   * * The polygon is assumed to be planar and non-self-intersecting.
   * * Accumulated values are integrals over triangles from point 0 of the polygon to other edges of the polygon.
   * * Integral over each triangle is transformed to integrals from the given origin.
   * @param points array of points around the polygon.   Final closure point is not needed.
   * @param origin origin for global accumulation.
   * @param moments 4x4 matrix where products are accumulated.
   */
  public static addSecondMomentAreaProducts(points: IndexedXYZCollection, origin: Point3d, moments: Matrix4d) {
    this.addSecondMomentTransformedProducts(PolygonOps._triangleMomentWeights, points, origin, 2, moments);
  }

  /** Accumulate to the matrix of volume products of a polygon with respect to an origin.
   * * The polygon is assumed to be planar and non-self-intersecting.
   * * Accumulated values are integrals over tetrahedra from the origin to triangles on the polygon.
   * @param points array of points around the polygon.   Final closure point is not needed.
   * @param origin origin for tetrahedra
   * @param moments 4x4 matrix where products are accumulated.
   */
  public static addSecondMomentVolumeProducts(points: IndexedXYZCollection, origin: Point3d, moments: Matrix4d) {
    this.addSecondMomentTransformedProducts(PolygonOps._tetrahedralMomentWeights, points, origin, 3, moments);
  }
  /** Return the matrix of area products of a polygon with respect to an origin.
   * The polygon is assumed to be planar and non-self-intersecting.
   * * `frameType===2` has xy vectors in the plane of the polygon, plus a unit normal z. (Used for area integrals)
   * * `frameType===3` has vectors from origin to 3 points in the triangle. (Used for volume integrals)
   */
  private static addSecondMomentTransformedProducts(firstQuadrantMoments: Matrix4d, points: IndexedXYZCollection, origin: Point3d,
    frameType: 2 | 3,
    moments: Matrix4d) {
    const unitNormal = PolygonOps._normal;
    if (PolygonOps.unitNormal(points, unitNormal)) {
      // The direction of the normal makes the various detJ values positive or negative so that non-convex polygons
      // sum correctly.
      const vector01 = PolygonOps._vector0;
      const vector02 = PolygonOps._vector1;
      const vector03 = PolygonOps._vector2;
      const placement = PolygonOps._matrixA;
      const matrixAB = PolygonOps._matrixB;
      const matrixABC = PolygonOps._matrixC;
      const vectorOrigin = points.vectorXYAndZIndex(origin, 0, PolygonOps._vectorOrigin)!;
      const numPoints = points.length;
      let detJ = 0;
      for (let i2 = 2; i2 < numPoints; i2++) {
        if (frameType === 2) {
          points.vectorIndexIndex(0, i2 - 1, vector01);
          points.vectorIndexIndex(0, i2, vector02);
          detJ = unitNormal.tripleProduct(vector01, vector02);
          placement.setOriginAndVectors(vectorOrigin, vector01, vector02, unitNormal);
          placement.multiplyMatrixMatrix(firstQuadrantMoments, matrixAB);
          matrixAB.multiplyMatrixMatrixTranspose(placement, matrixABC);
          moments.addScaledInPlace(matrixABC, detJ);
        } else if (frameType === 3) {
          points.vectorXYAndZIndex(origin, 0, vector01);
          points.vectorXYAndZIndex(origin, i2 - 1, vector02);
          points.vectorXYAndZIndex(origin, i2, vector03);
          detJ = vector01.tripleProduct(vector02, vector03);
          placement.setOriginAndVectors(origin, vector01, vector02, vector03);
          placement.multiplyMatrixMatrix(firstQuadrantMoments, matrixAB);
          matrixAB.multiplyMatrixMatrixTranspose(placement, matrixABC);
          moments.addScaledInPlace(matrixABC, detJ);
        }
      }
    }
  }

  /** Test the direction of turn at the vertices of the polygon, ignoring z-coordinates.
   * * For a polygon without self-intersections and successive colinear edges, this is a convexity and orientation test: all positive is convex and counterclockwise, all negative is convex and clockwise.
   * * Beware that a polygon which turns through more than a full turn can cross itself and close, but is not convex.
   * @returns 1 if all turns are to the left, -1 if all to the right, and 0 if there are any zero or reverse turns
   */
  public static testXYPolygonTurningDirections(points: Point2d[] | Point3d[]): number {
    // Reduce count by trailing duplicates; leaves iLast at final index
    let numPoint = points.length;
    let iLast = numPoint - 1;
    while (iLast > 1 && points[iLast].x === points[0].x && points[iLast].y === points[0].y) {
      numPoint = iLast--;
    }
    if (numPoint > 2) {
      let vector0 = Point2d.create(points[iLast].x - points[iLast - 1].x, points[iLast].y - points[iLast - 1].y);
      const vector1 = Point2d.create(points[0].x - points[iLast].x, points[0].y - points[iLast].y);
      const baseArea = vector0.x * vector1.y - vector0.y * vector1.x;
      // In a convex polygon, all successive-vector cross products will
      // have the same sign as the base area, hence all products will be
      // positive.
      for (let i1 = 1; i1 < numPoint; i1++) {
        vector0 = vector1.clone();
        Point2d.create(points[i1].x - points[i1 - 1].x, points[i1].y - points[i1 - 1].y, vector1);
        const currArea = vector0.x * vector1.y - vector0.y * vector1.x;
        if (currArea * baseArea <= 0.0)
          return 0;
      }
      // Fall out with all signs same as base area
      return baseArea > 0.0 ? 1 : -1;
    }
    return 0;
  }
  /**
   * Determine whether the polygon is convex.
   * @param polygon vertices, closure point optional
   * @returns whether the polygon is convex.
   */
  public static isConvex(polygon: Point3d[] | IndexedXYZCollection): boolean {
    if (!(polygon instanceof IndexedXYZCollection))
      return this.isConvex(new Point3dArrayCarrier(polygon));
    let n = polygon.length;
    if (n > 1 && polygon.getPoint3dAtUncheckedPointIndex(0).isExactEqual(polygon.getPoint3dAtUncheckedPointIndex(n - 1)))
      --n;  // ignore closure point
    const normal = Vector3d.create();
    if (!this.unitNormal(polygon, normal))
      return false;
    let positiveArea = 0.0;
    let negativeArea = 0.0;
    const vecA = this._vector0;
    let vecB = Vector3d.createStartEnd(polygon.getPoint3dAtUncheckedPointIndex(n - 1), polygon.getPoint3dAtUncheckedPointIndex(0), this._vector1);
    for (let i = 1; i <= n; i++) {
      // check turn through vertices i-1,i,i+1
      vecA.setFromVector3d(vecB);
      vecB = Vector3d.createStartEnd(polygon.getPoint3dAtUncheckedPointIndex(i - 1), polygon.getPoint3dAtUncheckedPointIndex(i % n), vecB);
      const signedArea = normal.tripleProduct(vecA, vecB);
      if (signedArea >= 0.0)
        positiveArea += signedArea;
      else
        negativeArea += signedArea;
    }
    return Math.abs(negativeArea) < Geometry.smallMetricDistanceSquared * positiveArea;
  }
  /**
   * Test if point (x,y) is IN, OUT or ON a polygon.
   * @return (1) for in, (-1) for OUT, (0) for ON
   * @param x x coordinate
   * @param y y coordinate
   * @param points array of xy coordinates.
   */
  public static classifyPointInPolygon(x: number, y: number, points: XAndY[]): number | undefined {
    const context = new XYParitySearchContext(x, y);
    let i0 = 0;
    const n = points.length;
    let i1;
    let iLast = -1;
    // walk to an acceptable start index ...
    for (i0 = 0; i0 < n; i0++) {
      i1 = i0 + 1;
      if (i1 >= n)
        i1 = 0;
      if (context.tryStartEdge(points[i0].x, points[i0].y, points[i1].x, points[i1].y)) {
        iLast = i1;
        break;
      }
    }
    if (iLast < 0)
      return undefined;
    for (let i = 1; i <= n; i++) {
      i1 = iLast + i;
      if (i1 >= n)
        i1 -= n;
      if (!context.advance(points[i1].x, points[i1].y))
        return context.classifyCounts();
    }
    return context.classifyCounts();
  }
  /**
   * Test if point (x,y) is IN, OUT or ON a polygon.
   * @return (1) for in, (-1) for OUT, (0) for ON
   * @param x x coordinate
   * @param y y coordinate
   * @param points array of xy coordinates.
   */
  public static classifyPointInPolygonXY(x: number, y: number, points: IndexedXYZCollection): number | undefined {
    const context = new XYParitySearchContext(x, y);
    let i0 = 0;
    const n = points.length;
    let i1;
    let iLast = -1;
    // walk to an acceptable start index ...
    for (i0 = 0; i0 < n; i0++) {
      i1 = i0 + 1;
      if (i1 >= n)
        i1 = 0;
      if (context.tryStartEdge(points.getXAtUncheckedPointIndex(i0), points.getYAtUncheckedPointIndex(i0), points.getXAtUncheckedPointIndex(i1), points.getYAtUncheckedPointIndex(i1))) {
        iLast = i1;
        break;
      }
    }
    if (iLast < 0)
      return undefined;
    for (let i = 1; i <= n; i++) {
      i1 = iLast + i;
      if (i1 >= n)
        i1 -= n;
      if (!context.advance(points.getXAtUncheckedPointIndex(i1), points.getYAtUncheckedPointIndex(i1)))
        return context.classifyCounts();
    }
    return context.classifyCounts();
  }

  /**
   * Reverse loops as necessary to make them all have CCW orientation for given outward normal.
   * @param loops
   * @param outwardNormal
   * @return the number of loops reversed.
   */
  public static orientLoopsCCWForOutwardNormalInPlace(loops: IndexedReadWriteXYZCollection | IndexedReadWriteXYZCollection[], outwardNormal: Vector3d): number {
    if (loops instanceof IndexedXYZCollection)
      return this.orientLoopsCCWForOutwardNormalInPlace([loops], outwardNormal);
    const orientations: number[] = [];
    const unitNormal = Vector3d.create();
    // orient individually ... (no hole analysis)
    let numReverse = 0;
    for (const loop of loops) {
      if (this.unitNormal(loop, unitNormal)) {
        const q = unitNormal.dotProduct(outwardNormal);
        orientations.push(q);
        if (q <= 0.0)
          loop.reverseInPlace();
        numReverse++;
      } else {
        orientations.push(0.0);
      }
    }
    return numReverse;
  }
  /**
   * Reverse and reorder loops in the xy-plane for consistency and containment.
   * @param loops multiple polygons in any order and orientation, z-coordinates ignored
   * @returns array of arrays of polygons that capture the input pointers. In each first level array:
   * * The first polygon is an outer loop, oriented counterclockwise.
   * * Any subsequent polygons are holes of the outer loop, oriented clockwise.
   * @see [[RegionOps.sortOuterAndHoleLoopsXY]]
   */
  public static sortOuterAndHoleLoopsXY(loops: IndexedReadWriteXYZCollection[]): IndexedReadWriteXYZCollection[][] {
    const loopAndArea: SortablePolygon[] = [];
    for (const loop of loops) {
      SortablePolygon.pushPolygon(loopAndArea, loop);
    }
    return SortablePolygon.sortAsArrayOfArrayOfPolygons(loopAndArea);
  }

  /**
   * Exactly like `sortOuterAndHoleLoopsXY` but allows loops in any plane.
   * @param loops multiple loops to sort and reverse.
   * @param defaultNormal optional normal for the loops, if known
   * @see [[sortOuterAndHoleLoopsXY]]
   */
  public static sortOuterAndHoleLoops(loops: IndexedReadWriteXYZCollection[], defaultNormal: Vector3d | undefined): IndexedReadWriteXYZCollection[][] {
    const localToWorld = FrameBuilder.createRightHandedFrame(defaultNormal, loops);
    const worldToLocal = localToWorld?.inverse();

    const xyLoops: GrowableXYZArray[] = [];
    if (worldToLocal !== undefined) {
      // transform into plane so we can ignore z in the sort
      for (const loop of loops) {
        const xyLoop = new GrowableXYZArray(loop.length);
        for (const point of loop.points)
          xyLoop.push(worldToLocal.multiplyPoint3d(point));
        xyLoops.push(xyLoop);
      }
    }
    const xySortedLoopsArray = PolygonOps.sortOuterAndHoleLoopsXY(xyLoops);

    const sortedLoopsArray: GrowableXYZArray[][] = [];
    if (localToWorld !== undefined) {
      for (const xySortedLoops of xySortedLoopsArray) {
        const sortedLoops: GrowableXYZArray[] = [];
        for (const xySortedLoop of xySortedLoops) {
          const sortedLoop = new GrowableXYZArray(xySortedLoop.length);
          for (const point of xySortedLoop.points)
            sortedLoop.push(localToWorld.multiplyPoint3d(point));
          sortedLoops.push(sortedLoop);
        }
        sortedLoopsArray.push(sortedLoops);
      }
    }
    return sortedLoopsArray;
  }

  /** Compute the closest point on the polygon boundary to the given point.
   * * Compare to [[closestPoint]].
   * @param polygon points of the polygon, closure point optional
   * @param testPoint point p to project onto the polygon edges. Works best when p is in the plane of the polygon.
   * @param tolerance optional distance tolerance to determine point-vertex and point-edge coincidence.
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the closest point `d.point`:
   * * `d.isValid()` returns true if and only if the polygon is nontrivial.
   * * `d.edgeIndex` and `d.edgeParam` specify the location of the closest point.
   * * `d.code` classifies the closest point as a vertex (`PolygonLocation.OnPolygonVertex`) or as a point on an edge (`PolygonLocation.OnPolygonEdgeInterior`).
   * * `d.a` is the distance from testPoint to the closest point.
   * * `d.v` can be used to classify p (if p and polygon are coplanar): if n is the polygon normal then `d.v.dotProduct(n)` is +/-/0 if and only if p is inside/outside/on the polygon.
  */
  public static closestPointOnBoundary(polygon: Point3d[] | IndexedXYZCollection, testPoint: Point3d, tolerance: number = Geometry.smallMetricDistance, result?: PolygonLocationDetail): PolygonLocationDetail {
    if (!(polygon instanceof IndexedXYZCollection))
      return this.closestPointOnBoundary(new Point3dArrayCarrier(polygon), testPoint, tolerance, result);

    const distTol2 = tolerance * tolerance;

    let numPoints = polygon.length;
    while (numPoints > 1) {
      if (polygon.distanceSquaredIndexIndex(0, numPoints - 1)! > distTol2)
        break;
      --numPoints; // ignore closure point
    }

    result = PolygonLocationDetail.create(result);
    if (0 === numPoints)
      return result;  // invalid
    if (1 === numPoints) {
      polygon.getPoint3dAtUncheckedPointIndex(0, result.point);
      result.a = result.point.distance(testPoint);
      result.v.setZero();
      result.code = PolygonLocation.OnPolygonVertex;
      result.closestEdgeIndex = 0;
      result.closestEdgeParam = 0.0;
      return result;
    }

    let iPrev = numPoints - 1;
    let minDist2 = Geometry.largeCoordinateResult;
    for (let iBase = 0; iBase < numPoints; ++iBase) {
      let iNext = iBase + 1;
      if (iNext === numPoints)
        iNext = 0;

      const uDotU = polygon.distanceSquaredIndexIndex(iBase, iNext)!;
      if (uDotU <= distTol2)
        continue; // ignore trivial polygon edge (keep iPrev)

      const vDotV = polygon.distanceSquaredIndexXYAndZ(iBase, testPoint)!;
      const uDotV = polygon.dotProductIndexIndexXYAndZ(iBase, iNext, testPoint)!;
      const edgeParam = uDotV / uDotU;  // param of projection of testPoint onto this edge

      if (edgeParam <= 0.0) { // testPoint projects to/before edge start
        const distToStart2 = vDotV;
        if (distToStart2 <= distTol2) {
          // testPoint is at edge start; we are done
          polygon.getPoint3dAtUncheckedPointIndex(iBase, result.point);
          result.a = Math.sqrt(distToStart2);
          result.v.setZero();
          result.code = PolygonLocation.OnPolygonVertex;
          result.closestEdgeIndex = iBase;
          result.closestEdgeParam = 0.0;
          return result;
        }
        if (distToStart2 < minDist2) {
          if (polygon.dotProductIndexIndexXYAndZ(iBase, iPrev, testPoint)! <= 0.0) {
            // update candidate (to edge start) only if testPoint projected beyond previous edge end
            polygon.getPoint3dAtUncheckedPointIndex(iBase, result.point);
            result.a = Math.sqrt(distToStart2);
            polygon.crossProductIndexIndexIndex(iBase, iPrev, iNext, result.v)!;
            result.code = PolygonLocation.OnPolygonVertex;
            result.closestEdgeIndex = iBase;
            result.closestEdgeParam = 0.0;
            minDist2 = distToStart2;
          }
        }
      } else if (edgeParam <= 1.0) {  // testPoint projects inside edge, or to edge end
        const projDist2 = vDotV - edgeParam * edgeParam * uDotU;
        if (projDist2 <= distTol2) {
          // testPoint is on edge; we are done
          const distToStart2 = vDotV;
          if (edgeParam <= 0.5 && distToStart2 <= distTol2) {
            // testPoint is at edge start
            polygon.getPoint3dAtUncheckedPointIndex(iBase, result.point);
            result.a = Math.sqrt(distToStart2);
            result.v.setZero();
            result.code = PolygonLocation.OnPolygonVertex;
            result.closestEdgeIndex = iBase;
            result.closestEdgeParam = 0.0;
            return result;
          }
          const distToEnd2 = projDist2 + (1.0 - edgeParam) * (1.0 - edgeParam) * uDotU;
          if (edgeParam > 0.5 && distToEnd2 <= distTol2) {
            // testPoint is at edge end
            polygon.getPoint3dAtUncheckedPointIndex(iNext, result.point);
            result.a = Math.sqrt(distToEnd2);
            result.v.setZero();
            result.code = PolygonLocation.OnPolygonVertex;
            result.closestEdgeIndex = iNext;
            result.closestEdgeParam = 0.0;
            return result;
          }
          // testPoint is on edge interior
          polygon.interpolateIndexIndex(iBase, edgeParam, iNext, result.point);
          result.a = Math.sqrt(projDist2);
          result.v.setZero();
          result.code = PolygonLocation.OnPolygonEdgeInterior;
          result.closestEdgeIndex = iBase;
          result.closestEdgeParam = edgeParam;
          return result;
        }
        if (projDist2 < minDist2) {
          // update candidate (to edge interior)
          polygon.interpolateIndexIndex(iBase, edgeParam, iNext, result.point);
          result.a = Math.sqrt(projDist2);
          polygon.crossProductIndexIndexXYAndZ(iBase, iNext, testPoint, result.v)!;
          result.code = PolygonLocation.OnPolygonEdgeInterior;
          result.closestEdgeIndex = iBase;
          result.closestEdgeParam = edgeParam;
          minDist2 = projDist2;
        }
      } else {  // edgeParam > 1.0
        // NOOP: testPoint projects beyond edge end, handled by next edge
      }
      iPrev = iBase;
    }
    return result;
  }

  /**
   * Compute the closest point on the polygon boundary or its interior to the given point.
   * * Compare to [[closestPointOnBoundary]].
   * @param polygon points of the polygon, closure point optional
   * @param testPoint point p to project onto the polygon edges. Works best when p is in the plane of the polygon.
   * @param tolerance optional distance tolerance for distinguishing boundary versus interior closest point.
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the closest point `d.point`:
   * * `d.isValid()` returns true if and only if the polygon is nontrivial.
   * * `d.edgeIndex` and `d.edgeParam` specify the location of the (nearest) boundary point.
   * * `d.code` classifies the closest point: `PolygonLocation.OnPolygonVertex`, `PolygonLocation.OnPolygonEdgeInterior`, `PolygonLocation.InsidePolygonProjectsToVertex`, or `PolygonLocation.InsidePolygonProjectsToEdgeInterior`.
   * * `d.a` is the distance from testPoint to the closest point.
   */
  public static closestPoint(polygon: Point3d[] | IndexedXYZCollection, testPoint: Point3d, tolerance: number = Geometry.smallMetricDistance, result?: PolygonLocationDetail): PolygonLocationDetail {
    if (!(polygon instanceof IndexedXYZCollection))
      return this.closestPoint(new Point3dArrayCarrier(polygon), testPoint, tolerance, result);
    if (!this.unitNormal(polygon, this._normal))
      return PolygonLocationDetail.create(result);  // invalid
    const polygonPlane = this._workPlane = Plane3dByOriginAndUnitNormal.createXYZUVW(polygon.getXAtUncheckedPointIndex(0), polygon.getYAtUncheckedPointIndex(0), polygon.getZAtUncheckedPointIndex(0), this._normal.x, this._normal.y, this._normal.z, this._workPlane)!;
    const planePoint = this._workXYZ = polygonPlane.projectPointToPlane(testPoint, this._workXYZ);
    result = this.closestPointOnBoundary(polygon, planePoint, tolerance, result);
    if (result.isValid) {
      const dot = result.v.dotProduct(this._normal);
      if (dot > 0.0) {  // planePoint is inside, so return it instead of the closest boundary point
        result.point.setFrom(planePoint);
        if (PolygonLocation.OnPolygonVertex === result.code)
          result.code = PolygonLocation.InsidePolygonProjectsToVertex;
        else if (PolygonLocation.OnPolygonEdgeInterior === result.code)
          result.code = PolygonLocation.InsidePolygonProjectsToEdgeInterior;
      }
      result.a = testPoint.distance(result.point);
      result.v.setZero(); // not relevant
    }
    return result;
  }

  // work objects, allocated as needed
  private static _workXYZ?: Point3d;
  private static _workXY0?: Point2d;
  private static _workXY1?: Point2d;
  private static _workXY2?: Point2d;
  private static _workRay?: Ray3d;
  private static _workMatrix3d?: Matrix3d;
  private static _workPlane?: Plane3dByOriginAndUnitNormal;

  /** Compute the intersection of a line (parameterized as a ray) with the plane of this polygon.
   * @param polygon points of the polygon, closure point optional
   * @param ray infinite line to intersect, as a ray
   * @param tolerance optional distance tolerance to determine point-vertex and point-edge coincidence.
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection `d.point`:
   * * `d.isValid()` returns true if and only if the line intersects the plane.
   * * `d.code` indicates where the intersection lies with respect to the polygon.
   * * `d.a` is the ray intersection parameter. If `d.a` >= 0, the ray intersects the plane of the polygon.
   * * `d.edgeIndex` and `d.edgeParam` specify the location of the closest point on the polygon to the intersection, within `distTol`.
   */
  public static intersectRay3d(polygon: Point3d[] | IndexedXYZCollection, ray: Ray3d, tolerance: number = Geometry.smallMetricDistance, result?: PolygonLocationDetail): PolygonLocationDetail {
    if (!(polygon instanceof IndexedXYZCollection))
      return this.intersectRay3d(new Point3dArrayCarrier(polygon), ray, tolerance, result);
    if (!this.unitNormal(polygon, this._normal))
      return PolygonLocationDetail.create(result); // invalid
    this._workPlane = Plane3dByOriginAndUnitNormal.createXYZUVW(polygon.getXAtUncheckedPointIndex(0), polygon.getYAtUncheckedPointIndex(0), polygon.getZAtUncheckedPointIndex(0), this._normal.x, this._normal.y, this._normal.z, this._workPlane)!;
    const intersectionPoint = this._workXYZ = Point3d.createZero(this._workXYZ);
    const rayParam = ray.intersectionWithPlane(this._workPlane, intersectionPoint);
    if (undefined === rayParam)
      return PolygonLocationDetail.create(result);
    result = this.closestPointOnBoundary(polygon, intersectionPoint, tolerance, result);
    if (result.isValid) {
      result.point.setFrom(intersectionPoint);
      result.a = rayParam;
      const dot = result.v.dotProduct(this._normal);
      if (dot === 0.0) {
        // NOOP: intersectionPoint is on the polygon, so result.code already classifies it
      } else {
        // intersectionPoint is not on polygon, so result.code refers to the closest point. Update it to refer to intersectionPoint.
        if (PolygonLocation.OnPolygonVertex === result.code)
          result.code = (dot > 0.0) ? PolygonLocation.InsidePolygonProjectsToVertex : PolygonLocation.OutsidePolygonProjectsToVertex;
        else if (PolygonLocation.OnPolygonEdgeInterior === result.code)
          result.code = (dot > 0.0) ? PolygonLocation.InsidePolygonProjectsToEdgeInterior : PolygonLocation.OutsidePolygonProjectsToEdgeInterior;
      }
    }
    return result;
  }

  /** Compute the intersection of a line (parameterized as a line segment) with the plane of this polygon.
   * @param polygon points of the polygon, closure point optional
   * @param point0 start point of segment on line to intersect
   * @param point1 end point of segment on line to intersect
   * @param tolerance optional distance tolerance to determine point-vertex and point-edge coincidence.
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection `d.point`:
   * * `d.isValid()` returns true if and only if the line intersects the plane.
   * * `d.code` indicates where the intersection lies with respect to the polygon.
   * * `d.a` is the segment intersection parameter. If `d.a` is in [0,1], the segment intersects the plane of the polygon.
   * * `d.edgeIndex` and `d.edgeParam` specify the location of the closest point on the polygon to the intersection, within `distTol`.
   * @see intersectRay3d
   */
  public static intersectSegment(polygon: Point3d[] | IndexedXYZCollection, point0: Point3d, point1: Point3d, tolerance: number = Geometry.smallMetricDistance, result?: PolygonLocationDetail): PolygonLocationDetail {
    this._workRay = Ray3d.createStartEnd(point0, point1, this._workRay);
    return this.intersectRay3d(polygon, this._workRay, tolerance, result);
  }

  /** Compute edge data for the barycentric coordinate computation, ignoring all z-coordinates.
   * @param polygon points of the polygon (without closure point)
   * @param edgeStartVertexIndex index of start vertex of the edge (unchecked)
   * @param point point to project to the edge
   * @param edgeOutwardUnitNormal pre-allocated vector to be populated on return with the unit perpendicular to the edge, facing outward, in xy-plane
   * @param tolerance used to clamp outputs
   * @param result optional pre-allocated result
   * @returns x: signed projection distance of `point` to the edge, y: edge parameter of the projection
   */
  private static computeEdgeDataXY(polygon: IndexedXYZCollection, edgeStartVertexIndex: number, point: XYAndZ, edgeOutwardUnitNormal: Vector3d, tolerance: number = Geometry.smallMetricDistance, result?: Point2d): Point2d {
    const i0 = edgeStartVertexIndex % polygon.length;
    const i1 = (i0 + 1) % polygon.length;
    polygon.vectorIndexIndex(i0, i1, edgeOutwardUnitNormal)!.unitPerpendicularXY(edgeOutwardUnitNormal).negate(edgeOutwardUnitNormal);  // z is zero
    const hypDeltaX = polygon.getXAtUncheckedPointIndex(i0) - point.x;
    const hypDeltaY = polygon.getYAtUncheckedPointIndex(i0) - point.y;
    let projDist = Geometry.dotProductXYXY(hypDeltaX, hypDeltaY, edgeOutwardUnitNormal.x, edgeOutwardUnitNormal.y);
    const edgeDist = Geometry.crossProductXYXY(hypDeltaX, hypDeltaY, edgeOutwardUnitNormal.x, edgeOutwardUnitNormal.y);
    const edgeLength = Geometry.distanceXYXY(polygon.getXAtUncheckedPointIndex(i0), polygon.getYAtUncheckedPointIndex(i0), polygon.getXAtUncheckedPointIndex(i1), polygon.getYAtUncheckedPointIndex(i1));
    let edgeParam = Geometry.safeDivideFraction(edgeDist, edgeLength, 0.0);
    if (Geometry.isSameCoordinate(0.0, projDist, tolerance))
      projDist = 0.0;
    if (Geometry.isSameCoordinate(0.0, edgeParam, tolerance))
      edgeParam = 0.0;
    else if (Geometry.isSameCoordinate(1.0, edgeParam, tolerance))
      edgeParam = 1.0;
    return Point2d.create(projDist, edgeParam, result);
  }

  /** Compute the barycentric coordinates for a point on either of a pair of adjacent edges of a convex polygon.
   * @param polygon points of the polygon, assumed to be convex. Assumed to have no closure point.
   * @param iPrev start index of previous edge
   * @param prevNormal outward unit normal of previous edge
   * @param prevProj x = signed distance from point to previous edge; y = edge parameter of this projection in [0,1]
   * @param i start index of current edge
   * @param normal outward unit normal of current edge
   * @param proj x = signed distance from point to current edge; y = edge parameter of this projection in [0,1]
   * @param coords pre-allocated barycentric coordinate array to return, assumed to have length at least `polygon.length`
   * @returns barycentric coordinates, or undefined if not on either edge
   */
  private static convexBarycentricCoordinatesOnEdge(polygon: IndexedXYZCollection, iPrev: number, prevNormal: Vector3d, prevProj: XAndY, i: number, normal: Vector3d, proj: XAndY, coords: number[]): number[] | undefined {
    // ignore degenerate edges
    const pointIsOnPrevEdge = !prevNormal.isZero && (0.0 === prevProj.x) && Geometry.isIn01(prevProj.y);
    const pointIsOnEdge = !normal.isZero && (0.0 === proj.x) && Geometry.isIn01(proj.y);
    if (pointIsOnPrevEdge && pointIsOnEdge) { // the point is at vertex i
      coords.fill(0);
      coords[i] = 1.0;
      return coords;
    }
    const n = polygon.length;
    if (pointIsOnPrevEdge) { // the point is on the previous edge
      coords.fill(0);
      const i0 = iPrev;
      const i1 = i;
      const edgeParam = prevProj.y;
      coords[i0] = 1.0 - edgeParam;
      coords[i1] = edgeParam;
      return coords;
    }
    if (pointIsOnEdge) { // the point is on the edge starting at the i_th vertex
      coords.fill(0);
      const i0 = i;
      const i1 = (i + 1) % n;
      const edgeParam = proj.y;
      coords[i0] = 1.0 - edgeParam;
      coords[i1] = edgeParam;
      return coords;
    }
    return undefined;   // not on edge
  }

  // cspell:word CAGD
  /** Compute the barycentric coordinates for a point inside a convex polygon.
   * @param polygon points of the polygon, assumed to be convex. Closure point optional.
   * @param point point assumed to be inside or on polygon
   * @param tolerance distance tolerance for point to be considered on a polygon edge
   * @return barycentric coordinates of the interior point, or undefined if invalid polygon or exterior point. Length is same as `polygon.length`.
   * @see BarycentricTriangle.pointToFraction
   */
  public static convexBarycentricCoordinates(polygon: Point3d[] | IndexedXYZCollection, point: Point3d, tolerance: number = Geometry.smallMetricDistance): number[] | undefined {
    // cf. "Barycentric Coordinates for Convex Sets", by Warren et al., CAGD (2003)
    if (Array.isArray(polygon))
      return this.convexBarycentricCoordinates(new Point3dArrayCarrier(polygon), point);
    let n = polygon.length;
    while (n > 1 && polygon.getPoint3dAtUncheckedPointIndex(0).isExactEqual(polygon.getPoint3dAtUncheckedPointIndex(n - 1)))
      --n;  // ignore closure point(s)
    if (n < 3 || !PolygonOps.unitNormal(polygon, this._normal))
      return undefined;
    const localToWorld = this._workMatrix3d = Matrix3d.createRigidHeadsUp(this._normal, AxisOrder.ZXY, this._workMatrix3d);
    const polygonXY = new GrowableXYZArray(n);
    for (let i = 0; i < n; ++i)
      polygonXY.push(localToWorld.multiplyInverseXYZAsPoint3d(polygon.getXAtUncheckedPointIndex(i), polygon.getYAtUncheckedPointIndex(i), polygon.getZAtUncheckedPointIndex(i), this._workXYZ)!);
    const pointXY = this._workXYZ = localToWorld.multiplyInverseXYZAsPoint3d(point.x, point.y, point.z, this._workXYZ)!;
    // now we know polygon orientation is ccw, its last edge has positive length, and we can ignore z-coords
    let iPrev = n - 1;
    const outwardUnitNormalOfLastEdge = this._vector0;
    const projToLastEdge = this._workXY0 = this.computeEdgeDataXY(polygonXY, iPrev, pointXY, outwardUnitNormalOfLastEdge, tolerance, this._workXY0);
    // we can compare to exact zero because computeEdgeDataXY has chopped small distances to zero
    if (projToLastEdge.x < 0.0)
      return undefined; // point is outside polygon, or polygon is nonconvex
    const outwardUnitNormalOfPrevEdge = Vector3d.createFrom(outwardUnitNormalOfLastEdge, this._vector1);
    const projToPrevEdge = this._workXY1 = Point2d.createFrom(projToLastEdge, this._workXY1);
    const coords = Array<number>(polygon.length).fill(0); // use original length
    const largestResult = (tolerance > 0.0) ? 1.0 / (tolerance * tolerance) : Geometry.largeCoordinateResult;
    let coordSum = 0.0;
    for (let i = 0; i < n; ++i) {
      const outwardUnitNormalOfEdge = Vector3d.createFrom(outwardUnitNormalOfLastEdge, this._vector2);
      const projToEdge = this._workXY2 = (i < n - 1) ? this.computeEdgeDataXY(polygonXY, i, pointXY, outwardUnitNormalOfEdge, tolerance, this._workXY2) : Point2d.createFrom(projToLastEdge, this._workXY2);
      if (projToEdge.x < 0.0)
        return undefined; // point is outside polygon, or polygon is nonconvex
      if (undefined !== this.convexBarycentricCoordinatesOnEdge(polygonXY, iPrev, outwardUnitNormalOfPrevEdge, projToPrevEdge, i, outwardUnitNormalOfEdge, projToEdge, coords))
        return coords; // point is on vertex or edge; we are done
      if (outwardUnitNormalOfEdge.x === 0.0 && outwardUnitNormalOfEdge.y === 0.0)
        continue; // edge is degenerate; coords[i] = 0; keep previous edge data
      if (0.0 === projToPrevEdge.x || 0.0 === projToEdge.x)
        continue; // point is on subsequent colinear edge (ASSUMING interior point, convex polygon!); coords[i] = 0; keep previous edge data
      const areaOfNormalParallelogram = Math.abs(outwardUnitNormalOfPrevEdge.crossProductXY(outwardUnitNormalOfEdge));
      const coord = Geometry.conditionalDivideCoordinate(areaOfNormalParallelogram, projToPrevEdge.x * projToEdge.x, largestResult);
      if (undefined === coord) {
        assert(!"unexpectedly small projection distance to an edge");
        return undefined; // shouldn't happen due to chopping in computeEdgeDataXY: area/(dist*dist) <= 1/tol^2 = largestResult
      }
      coords[i] = coord;
      coordSum += coord;
      outwardUnitNormalOfPrevEdge.setFrom(outwardUnitNormalOfEdge);
      projToPrevEdge.setFrom(projToEdge);
      iPrev = i;
    }
    const scale = Geometry.conditionalDivideCoordinate(1.0, coordSum);
    if (undefined === scale) {
      assert(!"unexpected zero barycentric coordinate sum");
      return undefined;
    }
    for (let i = 0; i < n; ++i)
      coords[i] *= scale; // normalized
    return coords;
  }
  /**
   * Force the polygon to be closed.
   * * If first and last points are not within tolerance, push copy of first point
   * * If first and last points are within tolerance, set last point equal to first
   * @param polygon input polygon
   * @param tolerance closure distance tolerance
   */
  public static forceClosure(polygon: Point3d[] | GrowableXYZArray, tolerance: number = Geometry.smallMetricDistance): void {
    if (polygon.length >= 2) {
      if (polygon instanceof GrowableXYZArray) {
        polygon.forceClosure(tolerance);
      } else if (polygon[0].distance(polygon[polygon.length - 1]) > tolerance) {
        polygon.push(polygon[0].clone());
      } else {
        polygon[polygon.length - 1].setFromPoint3d(polygon[0]);
      }
    }
  }
  /**
   * Return a closed polygon, cloning only if necessary.
   * * If the first and last points are not identical, call [[forceClosure]] on a clone of the polygon and return it.
   * * If the first and last points are already identical, just return the input.
   * @param polygon input polygon
   * @param tolerance closure distance tolerance
   */
  public static ensureClosed(polygon: Point3d[] | IndexedXYZCollection, tolerance: number = Geometry.smallMetricDistance): Point3d[] | IndexedXYZCollection {
    if (polygon.length >= 2) {
      let forceClosure = false;
      if (polygon instanceof IndexedXYZCollection)
        forceClosure = !polygon.almostEqualIndexIndex(0, polygon.length - 1, 0.0);
      else
        forceClosure = !polygon[0].isExactEqual(polygon[polygon.length - 1]);
      if (forceClosure) {
        const cloned = GrowableXYZArray.create(polygon);
        this.forceClosure(cloned, tolerance);
        polygon = cloned;
      }
    }
    return polygon;
  }
  private static _workCLDPair?: CurveLocationDetailPair;
  /**
   * Find smallest distance between polygons.
   * * For efficiency, input polygons should include closure edge.
   * * If searching interiors for close approaches, the polygons are assumed to be convex.
   * @param polygonA first polygon
   * @param polygonB second polygon
   * @param dMax optional largest approach distance to consider
   * @param _searchInterior If true, include (convex) polygon interiors in computations (currently unimplemented).
   * If false (default): return closest approach between polygon boundaries only, using [[PolylineOps.closestApproach]].
   * @return pair of details, one per polygon. The `a` field of each detail stores the closest approach distance.
   */
  public static closestApproach(
    polygonA: Point3d[] | IndexedXYZCollection,
    polygonB: Point3d[] | IndexedXYZCollection,
    dMax: number = Number.MAX_VALUE,
    _searchInterior: boolean = false,
  ): PolygonLocationDetailPair | undefined {
    // TODO: handle interior close approaches as well...
    let result: PolygonLocationDetailPair | undefined;
    const polyA = this.ensureClosed(polygonA);
    const polyB = this.ensureClosed(polygonB);
    const cld = this._workCLDPair = PolylineOps.closestApproach(polyA, false, polyB, false, dMax, this._workCLDPair);
    if (cld && cld.detailA.childDetail && cld.detailB.childDetail) {
      result = PolygonLocationDetailPair.create(
        PolygonLocationDetail.createAtVertexOrEdge(cld.detailA.point, cld.detailA.childDetail.a, cld.detailA.childDetail.fraction),
        PolygonLocationDetail.createAtVertexOrEdge(cld.detailB.point, cld.detailB.childDetail.a, cld.detailB.childDetail.fraction),
      );
      result.detailA.a = result.detailB.a = cld.detailA.a;
    }
    return result;
  }
}

/**
 *  `IndexedXYZCollectionPolygonOps` class contains _static_ methods for typical operations on polygons carried as `IndexedXYZCollection`
 * @public
 */
export class IndexedXYZCollectionPolygonOps {
  private static _xyz0Work: Point3d = Point3d.create();
  private static _xyz1Work: Point3d = Point3d.create();
  private static _xyz2Work: Point3d = Point3d.create();
  /**
   * Split a (convex) polygon into 2 parts based on altitude evaluations.
   * * POSITIVE ALTITUDE IS IN
   * @param plane any `PlaneAltitudeEvaluator` object that can evaluate `plane.altitude(xyz)` for distance from the plane.
   * @param xyz original polygon
   * @param xyzPositive array to receive inside part (altitude > 0)
   * @param xyzNegative array to receive outside part
   * @param altitudeRange min and max altitudes encountered.
   */
  public static splitConvexPolygonInsideOutsidePlane(plane: PlaneAltitudeEvaluator,
    xyz: IndexedXYZCollection,
    xyzPositive: IndexedReadWriteXYZCollection,
    xyzNegative: IndexedReadWriteXYZCollection, altitudeRange: Range1d) {
    const xyz0 = IndexedXYZCollectionPolygonOps._xyz0Work;
    const xyz1 = IndexedXYZCollectionPolygonOps._xyz1Work;
    const xyzInterpolated = IndexedXYZCollectionPolygonOps._xyz2Work;
    const n = xyz.length;
    xyzPositive.clear();
    xyzNegative.clear();
    // let numSplit = 0;
    const fractionTol = 1.0e-8;
    if (n > 2) {
      xyz.back(xyz0);
      altitudeRange.setNull();
      let a0 = plane.altitude(xyz0);
      altitudeRange.extendX(a0);
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (let i1 = 0; i1 < n; i1++) {
        xyz.getPoint3dAtUncheckedPointIndex(i1, xyz1);
        const a1 = plane.altitude(xyz1);
        altitudeRange.extendX(a1);
        let nearZero = false;
        if (a0 * a1 < 0.0) {
          // simple crossing. . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
            nearZero = true;
          } else {
            xyz0.interpolate(f, xyz1, xyzInterpolated);
            xyzPositive.push(xyzInterpolated);
            xyzNegative.push(xyzInterpolated);
          }
          // numSplit++;
        }
        if (a1 >= 0.0 || nearZero)
          xyzPositive.push(xyz1);
        if (a1 <= 0.0 || nearZero)
          xyzNegative.push(xyz1);
        xyz0.setFromPoint3d(xyz1);
        a0 = a1;
      }
    }
  }
  /**
   * Clip a polygon to one side of a plane.
   * * Results with 2 or fewer points are ignored.
   * * Other than ensuring capacity in the arrays, there are no object allocations during execution of this function.
   * * plane is passed as unrolled Point4d (ax,ay,az,aw) point (x,y,z) acts as homogeneous (x,y,z,1)
   *   * `keepPositive === true` selects positive altitudes.
   * @param plane any type that has `plane.altitude`
   * @param xyz input points.
   * @param work work buffer
   * @param tolerance tolerance for "on plane" decision.
   * @return the number of crossings.   If this is larger than 2, the result is "correct" in a parity sense but may have overlapping (hence cancelling) parts.
   */
  public static clipConvexPolygonInPlace(plane: PlaneAltitudeEvaluator, xyz: GrowableXYZArray, work: GrowableXYZArray, keepPositive: boolean = true, tolerance: number = Geometry.smallMetricDistance): number {
    work.clear();
    const s = keepPositive ? 1.0 : -1.0;
    const n = xyz.length;
    let numNegative = 0;
    const fractionTol = 1.0e-8;
    const b = -tolerance;
    let numCrossings = 0;
    if (xyz.length > 1) {
      let a1;
      let index0 = xyz.length - 1;
      let a0 = s * xyz.evaluateUncheckedIndexPlaneAltitude(index0, plane);
      if (Math.abs(a0) < tolerance)
        a0 = 0;
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (let index1 = 0; index1 < n; a0 = a1, index0 = index1++) {
        a1 = s * xyz.evaluateUncheckedIndexPlaneAltitude(index1, plane);
        if (Math.abs(a1) < tolerance)
          a1 = 0;
        if (a1 < 0)
          numNegative++;
        if (a0 * a1 < 0.0) {
          // simple crossing . . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
          } else {
            work.pushInterpolatedFromGrowableXYZArray(xyz, index0, f, index1);
            if (a1 > 0)
              numCrossings++; // "out to in"
          }
        }
        if (a1 >= b) {
          work.pushFromGrowableXYZArray(xyz, index1);
          if (a0 < -b) {
            numCrossings++; // "in to out"
          }
        }
        index0 = index1;
        a0 = a1;
      }
    }

    if (work.length <= 2) {
      xyz.clear();
    } else if (numNegative > 0) {
      xyz.clear();
      xyz.pushFromGrowableXYZArray(work);
    }
    work.clear();
    return numCrossings;
  }
  /** Return an array containing
   * * All points that are exactly on the plane.
   * * Crossing points between adjacent points that are (strictly) on opposite sides.
   */
  public static polygonPlaneCrossings(plane: PlaneAltitudeEvaluator, xyz: IndexedXYZCollection, crossings: Point3d[]) {
    crossings.length = 0;
    if (xyz.length >= 2) {
      const xyz0 = this._xyz0Work;
      xyz.getPoint3dAtUncheckedPointIndex(xyz.length - 1, xyz0);
      let a0 = plane.altitude(xyz0);
      const xyz1 = this._xyz1Work;
      for (let i = 0; i < xyz.length; i++) {
        xyz.getPoint3dAtUncheckedPointIndex(i, xyz1);
        const a1 = plane.altitude(xyz1);
        if (a0 * a1 < 0.0) {
          // simple crossing. . .
          const f = - a0 / (a1 - a0);
          crossings.push(xyz0.interpolate(f, xyz1));
        }
        if (a1 === 0.0) {        // IMPORTANT -- every point is directly tested here
          crossings.push(xyz1.clone());
        }
        xyz0.setFromPoint3d(xyz1);
        a0 = a1;
      }
    }
  }
  /**
   * * Input a "clipped" polygon (from clipConvexPolygonInPlace) with more than 2 crossings, i.e. is from a non-convex polygon with configurations like:
   *   * multiple distinct polygons
   *   * single polygon, but cut lines overlap and cancel by parity rules.
   * * return 1 or more polygons, each having first and last points "on" the plane and intermediate points "off"
   * * `minChainLength` indicates the shortest chain to be returned.
   * @internal
   */
  public static gatherCutLoopsFromPlaneClip(plane: PlaneAltitudeEvaluator, xyz: GrowableXYZArray, minChainLength: number = 3, tolerance: number = Geometry.smallMetricDistance): CutLoopMergeContext {
    const result: CutLoopMergeContext = new CutLoopMergeContext();
    // find the first on-plane point
    let firstOnPlaneIndex = 0;
    const n = xyz.length;
    for (; firstOnPlaneIndex < n; firstOnPlaneIndex++) {
      const a = xyz.evaluateUncheckedIndexPlaneAltitude(firstOnPlaneIndex, plane);
      if (Math.abs(a) <= tolerance)
        break;
    }
    if (firstOnPlaneIndex === n)
      return result;
    // find contiguous blocks of "off plane" points with on-plane points at their end.
    let candidateA = firstOnPlaneIndex;
    while (candidateA < n) {
      const currentChain = new GrowableXYZArray();
      currentChain.pushFromGrowableXYZArray(xyz, candidateA);
      let candidateB = candidateA + 1;
      while (candidateB < n) {
        currentChain.pushFromGrowableXYZArray(xyz, candidateB);
        const a = xyz.evaluateUncheckedIndexPlaneAltitude(candidateB, plane);
        if (Math.abs(a) <= tolerance) {
          break;
        }
        candidateB++;
      }
      if (candidateB === n)
        for (let i = 0; i <= firstOnPlaneIndex; i++)
          currentChain.pushFromGrowableXYZArray(xyz, i);
      if (currentChain.length >= minChainLength)
        result.inputLoops.push(CutLoop.createCaptureWithReturnEdge(currentChain));
      candidateA = candidateB;
    }
    return result;
  }
  /**
   * * Input the loops from `gatherCutLoopsFromClipPlane`
   * * Consolidate loops for reentrant configurations.
   * * WARNING: The output reuses and modifies input loops whenever possible.
   * @internal
   */
  public static reorderCutLoops(loops: CutLoopMergeContext) {
    // Simple case: all loops have common orientation
    if (loops.inputLoops.length === 1)
      return;
    // Simple cases: 2 loops . . .
    if (loops.inputLoops.length === 2) {
      // if edges are in the same direction, it must be a pair of unrelated loop . . .
      if (loops.inputLoops[0].edge!.direction.dotProduct(loops.inputLoops[1].edge!.direction) > 0) {
        loops.outputLoops.push(loops.inputLoops[0]);
        loops.outputLoops.push(loops.inputLoops[1]);
        return;
      }
      // twist the two loops into 1,
      const source = loops.inputLoops[1].xyz;
      const dest = loops.inputLoops[0].xyz;
      dest.pushFromGrowableXYZArray(source);
      loops.outputLoops.push(loops.inputLoops[0]);
      return;
    }
    // 3 or more loops.
    loops.sortAndMergeLoops();
    //
  }
  /**
   * Return the intersection of the plane with a range cube.
   * @param range
   * @param xyzOut intersection polygon.  This is convex.
   * @return reference to xyz if the polygon still has points; undefined if all points are clipped away.
   */
  public static intersectRangeConvexPolygonInPlace(range: Range3d, xyz: GrowableXYZArray): GrowableXYZArray | undefined {
    if (range.isNull)
      return undefined;
    const work = new GrowableXYZArray();
    const plane = Point4d.create();
    plane.set(0, 0, -1, range.high.z);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    plane.set(0, 0, 1, -range.low.z);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    plane.set(0, -1, 0, range.high.y);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    plane.set(0, 1, 0, -range.low.y);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    plane.set(-1, 0, 0, range.high.x);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    plane.set(1, 0, 0, -range.low.x);
    this.clipConvexPolygonInPlace(plane, xyz, work, true);
    if (xyz.length === 0)
      return undefined;

    return xyz;
  }
}
/**
 * `Point3dArrayPolygonOps` class contains _static_ methods for typical operations on polygons carried as `Point3d[]`
 * @public
 */
export class Point3dArrayPolygonOps {
  private static _xyz0Work: Point3d = Point3d.create();
  //  private static _xyz1Work: Point3d = Point3d.create();
  //  private static _xyz2Work: Point3d = Point3d.create();
  /**
   * Split a (convex) polygon into 2 parts.
   * @param xyz original polygon
   * @param xyzIn array to receive inside part
   * @param xyzOut array to receive outside part
   * @param altitudeRange min and max altitudes encountered.
   */
  public static convexPolygonSplitInsideOutsidePlane(plane: PlaneAltitudeEvaluator, xyz: Point3d[], xyzIn: Point3d[], xyzOut: Point3d[], altitudeRange: Range1d): void {
    const xyzCarrier = new Point3dArrayCarrier(xyz);
    const xyzInCarrier = new Point3dArrayCarrier(xyzIn);
    const xyzOutCarrier = new Point3dArrayCarrier(xyzOut);
    IndexedXYZCollectionPolygonOps.splitConvexPolygonInsideOutsidePlane(plane, xyzCarrier, xyzInCarrier, xyzOutCarrier, altitudeRange);
  }

  /** Return an array containing
   * * All points that are exactly on the plane.
   * * Crossing points between adjacent points that are (strictly) on opposite sides.
   */
  public static polygonPlaneCrossings(plane: PlaneAltitudeEvaluator, xyz: Point3d[], crossings: Point3d[]): void {
    const xyzSource = new Point3dArrayCarrier(xyz);
    return IndexedXYZCollectionPolygonOps.polygonPlaneCrossings(plane, xyzSource, crossings);
  }
  /**
   * Clip a polygon, returning the clip result in the same object.
   * @param xyz input/output polygon
   * @param work scratch object
   * @param tolerance tolerance for on-plane decision.
   */
  public static convexPolygonClipInPlace(plane: PlaneAltitudeEvaluator, xyz: Point3d[], work: Point3d[] | undefined, tolerance: number = Geometry.smallMetricDistance) {
    if (work === undefined)
      work = [];
    work.length = 0;
    let numNegative = 0;
    const fractionTol = 1.0e-8;
    const b = -tolerance;
    if (xyz.length > 2) {
      let xyz0 = xyz[xyz.length - 1];
      let a0 = plane.altitude(xyz0);
      //    if (a0 >= 0.0)
      //      work.push_back (xyz0);
      for (const xyz1 of xyz) {
        const a1 = plane.altitude(xyz1);
        if (a1 < 0)
          numNegative++;
        if (a0 * a1 < 0.0) {
          // simple crossing . . .
          const f = - a0 / (a1 - a0);
          if (f > 1.0 - fractionTol && a1 >= 0.0) {
            // the endpoint will be saved -- avoid the duplicate
          } else {
            work.push(xyz0.interpolate(f, xyz1));
          }
        }
        if (a1 >= b)
          work.push(xyz1);
        xyz0 = Point3d.createFrom(xyz1);
        a0 = a1;
      }
    }

    if (work.length <= 2) {
      xyz.length = 0;
    } else if (numNegative > 0) {
      xyz.length = 0;
      for (const xyzI of work) {
        xyz.push(xyzI);
      }
      work.length = 0;
    }
  }
}
