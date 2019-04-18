/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { XAndY } from "./XYZProps";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Ray3d } from "./Ray3d";
import { IndexedXYZCollection } from "./IndexedXYZCollection";
import { Point3dArrayCarrier, Point3dArray } from "./PointHelpers";
import { XYParitySearchContext } from "../topology/XYParitySearchContext";
/** Static class for operations that treat an array of points as a polygon (with area!) */
export class PolygonOps {
  /** Sum areas of triangles from points[0] to each far edge.
   * * Consider triangles from points[0] to each edge.
   * * Sum the areas(absolute, without regard to orientation) all these triangles.
   * @returns sum of absolute triangle areas.
   */
  public static sumTriangleAreas(points: Point3d[]): number {
    let s = 0.0;
    const n = points.length;
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
    s *= 0.5;
    // console.log ("polygon area ", s, points);
    return s;
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
  // statics for shared reuse.
  // many methods use these.
  // only use them in "leaf" methods that are certain not to call other users . . .
  private static _vector0 = Vector3d.create();
  private static _vector1 = Vector3d.create();
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
  public static areaNormal(points: Point3d[], result?: Vector3d): Vector3d {
    if (!result)
      result = Vector3d.create();
    PolygonOps.areaNormalGo(new Point3dArrayCarrier(points), result);
    return result;
  }
  /** return the area of the polygon (assuming planar) */
  public static area(points: Point3d[]): number {
    return PolygonOps.areaNormal(points).magnitude();
  }
  /** return the projected XY area of the polygon (assuming planar) */
  public static areaXY(points: Point3d[]): number {
    let area = 0.0;
    for (let i = 1; i + 1 < points.length; i++)
      area += points[0].crossProductToPointsXY(points[i], points[i + 1]);
    return 0.5 * area;
  }
  public static centroidAreaNormal(points: Point3d[]): Ray3d | undefined {
    const n = points.length;
    if (n === 3) {
      const normal = points[0].crossProductToPoints(points[1], points[2]);
      const a = 0.5 * normal.magnitude();
      const result = Ray3d.createCapture(Point3dArray.centroid(new Point3dArrayCarrier(points)), normal);
      if (result.tryNormalizeInPlaceWithAreaWeight(a))
        return result;
      return undefined;
    }
    if (n >= 3) {
      const origin = points[0];
      const vector0 = origin.vectorTo(points[1]);
      let vector1 = Vector3d.create();
      let cross = Vector3d.create();
      const centroidSum = Vector3d.createZero();
      const normalSum = Vector3d.createZero();
      // This will work with or without closure edge.  If closure is given, the last vector is 000.
      for (let i = 2; i < n; i++) {
        vector1 = origin.vectorTo(points[i], vector1);
        cross = vector0.crossProduct(vector1, cross);
        normalSum.addInPlace(cross); // this grows to twice the area
        const b = cross.magnitude() / 6.0;
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
   *
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
  /** Return the matrix of area products of a polygon with respect to an origin.
   * The polygon is assumed to be planar and non-self-intersecting.
   */
  public static addSecondMomentAreaProducts(points: IndexedXYZCollection, origin: Point3d, moments: Matrix4d) {
    const unitNormal = PolygonOps._normal;
    if (PolygonOps.unitNormal(points, unitNormal)) {
      // The direction of the normal makes the various detJ values positive or negative so that non-convex polygons
      // sum correctly.
      const vector01 = PolygonOps._vector0;
      const vector02 = PolygonOps._vector1;
      const placement = PolygonOps._matrixA;
      const matrixAB = PolygonOps._matrixB;
      const matrixABC = PolygonOps._matrixC;
      const vectorOrigin = points.vectorXYAndZIndex(origin, 0, PolygonOps._vectorOrigin)!;
      const numPoints = points.length;
      let detJ = 0;
      for (let i2 = 2; i2 < numPoints; i2++) {
        points.vectorIndexIndex(0, i2 - 1, vector01);
        points.vectorIndexIndex(0, i2, vector02);
        detJ = unitNormal.tripleProduct(vector01, vector02);
        placement.setOriginAndVectors(vectorOrigin, vector01, vector02, unitNormal);
        placement.multiplyMatrixMatrix(PolygonOps._triangleMomentWeights, matrixAB);
        matrixAB.multiplyMatrixMatrixTranspose(placement, matrixABC);
        moments.addScaledInPlace(matrixABC, detJ);
      }
    }
  }
  /** Test the direction of turn at the vertices of the polygon, ignoring z-coordinates.
   *
   * *  For a polygon without self intersections, this is a convexity and orientation test: all positive is convex and counterclockwise,
   * all negative is convex and clockwise
   * *  Beware that a polygon which turns through more than a full turn can cross itself and close, but is not convex
   * *  Returns 1 if all turns are to the left, -1 if all to the right, and 0 if there are any zero turns
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
    for (i0 = 0; i0 < n; i0 = i1) {
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
}
