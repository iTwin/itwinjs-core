/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Point4d } from "../geometry4d/Point4d";
import { XYParitySearchContext } from "../topology/XYParitySearchContext";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedReadWriteXYZCollection, IndexedXYZCollection } from "./IndexedXYZCollection";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Range1d, Range3d } from "./Range";
import { Ray3d } from "./Ray3d";
import { SortablePolygon } from "./SortablePolygon";
import { XAndY } from "./XYZProps";

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
      this.inputLoops.sort(CutLoop.sortFunction);

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
/** Static class for operations that treat an array of points as a polygon (with area!) */
/**
 * Various (static method) computations for arrays of points interpreted as a polygon.
 * @public
 */
export class PolygonOps {
  /** Sum areas of triangles from points[0] to each far edge.
   * * Consider triangles from points[0] to each edge.
   * * Sum the areas(absolute, without regard to orientation) all these triangles.
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
  /** Sum areas of triangles from points[0] to each far edge.
   * * Consider triangles from points[0] to each edge.
   * * Sum the areas(absolute, without regard to orientation) all these triangles.
   * @returns sum of absolute triangle areas.
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
    // console.log ("polygon area ", s, points);
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
    const n = points.length;
    if (n === 3) {
      points.crossProductIndexIndexIndex(0, 1, 2, result);
    } else if (n >= 3) {
      result.setZero();
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        points.accumulateCrossProductIndexIndexIndex(0, i - 1, i, result);
      }
    }
    // ALL BRANCHES SUM FULL CROSS PRODUCTS AND EXPECT SCALE HERE
    result.scaleInPlace(0.5);
    return result;
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
        for (let i = 1; i + 1 < points.length; i++, u1 = u2, v1 = v2) {
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
  public static sumAreaXY(polygons: Point3d[][]): number{
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
   * @param points array of points around the polygon.  This is assumed to NOT have closure edge.
   * @param result caller-allocated result vector.
   */
  public static unitNormal(points: IndexedXYZCollection, result: Vector3d): boolean {
    const n = points.length;
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
   *
   * *  For a polygon without self intersections, this is a convexity and orientation test: all positive is convex and counterclockwise,
   * all negative is convex and clockwise
   * *  Beware that a polygon which turns through more than a full turn can cross itself and close, but is not convex
   * *  Returns 1 if all turns are to the left, -1 if all to the right, and 0 if there are any zero or reverse turns
   */
  public static testXYPolygonTurningDirections(pPointArray: Point2d[] | Point3d[]): number {
    // Reduce count by trailing duplicates; leaves iLast at final index
    let numPoint = pPointArray.length;
    let iLast = numPoint - 1;
    while (iLast > 1 && pPointArray[iLast].x === pPointArray[0].x && pPointArray[iLast].y === pPointArray[0].y) {
      numPoint = iLast--;
    }
    if (numPoint > 2) {
      let vector0 = Point2d.create(pPointArray[iLast].x - pPointArray[iLast - 1].x, pPointArray[iLast].y - pPointArray[iLast - 1].y);
      const vector1 = Point2d.create(pPointArray[0].x - pPointArray[iLast].x, pPointArray[0].y - pPointArray[iLast].y);
      const baseArea = vector0.x * vector1.y - vector0.y * vector1.x;
      // In a convex polygon, all successive-vector cross products will
      // have the same sign as the base area, hence all products will be
      // positive.
      for (let i1 = 1; i1 < numPoint; i1++) {
        vector0 = vector1.clone();
        Point2d.create(pPointArray[i1].x - pPointArray[i1 - 1].x, pPointArray[i1].y - pPointArray[i1 - 1].y, vector1);
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
   * If reverse loops as necessary to make them all have CCW orientation for given outward normal.
   * * Return an array of arrays which capture the input pointers.
   * * In each first level array:
   *    * The first loop is an outer loop.
   *    * all subsequent loops are holes
   *    * The outer loop is CCW
   *    * The holes are CW.
   * * Call RegionOps.sortOuterAndHoleLoopsXY to have the result returned as a UnionRegion
   * @param loops multiple loops to sort and reverse.
   */
  public static sortOuterAndHoleLoopsXY(loops: IndexedReadWriteXYZCollection[]): IndexedReadWriteXYZCollection[][] {
    const loopAndArea: SortablePolygon[] = [];
    for (const loop of loops) {
      SortablePolygon.pushPolygon(loopAndArea, loop);
    }
    return SortablePolygon.sortAsArrayOfArrayOfPolygons(loopAndArea);
  }
}
/**
 *  `IndexedXYZCollectionPolygonOps` class contains _static_ methods for typical operations on polygons carried as `IndexedXyZCollection`
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
    xyz: IndexedReadWriteXYZCollection,
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
  public static convexPolygonSplitInsideOutsidePlane(plane: PlaneAltitudeEvaluator, xyz: Point3d[], xyzIn: Point3d[], xyzOut: Point3d[], altitudeRange: Range1d) {
    const xyzCarrier = new Point3dArrayCarrier(xyz);
    const xyzInCarrier = new Point3dArrayCarrier(xyzIn);
    const xyzOutCarrier = new Point3dArrayCarrier(xyzOut);
    IndexedXYZCollectionPolygonOps.splitConvexPolygonInsideOutsidePlane(plane, xyzCarrier, xyzInCarrier, xyzOutCarrier, altitudeRange);

  }

  /** Return an array containing
   * * All points that are exactly on the plane.
   * * Crossing points between adjacent points that are (strictly) on opposite sides.
   */
  public static polygonPlaneCrossings(plane: PlaneAltitudeEvaluator, xyz: Point3d[], crossings: Point3d[]) {
    crossings.length = 0;
    if (xyz.length >= 2) {
      const xyz0 = this._xyz0Work;
      xyz0.setFromPoint3d(xyz[xyz.length - 1]);
      let a0 = plane.altitude(xyz0);
      for (const xyz1 of xyz) {
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
