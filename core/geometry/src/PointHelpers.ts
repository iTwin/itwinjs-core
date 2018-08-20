/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty */
import { Geometry } from "./Geometry";
import { Point2d, Vector2d, Point3d, Vector3d, XYZ, XYAndZ } from "./PointVector";
import { Transform } from "./Transform";

import { Point4d, Matrix4d } from "./numerics/Geometry4d";
import { Ray3d, Plane3dByOriginAndUnitNormal } from "./AnalyticGeometry";
import { IndexedXYZCollection } from "./IndexedXYZCollection";
export class NumberArray {
  /** return the sum of values in an array,   The summation is done with correction terms which
   * improves last-bit numeric accuracy.
   */
  public static PreciseSum(data: number[]) {
    const n = data.length;
    if (n === 0)
      return 0.0;
    let sum = data[0];
    let c = 0.0;
    let y: number;
    let t: number;
    for (let i = 1; i < n; i++) {
      y = data[i] - c;
      t = sum + y;
      c = (t - sum) - y;
      sum = t;
    }
    return sum;
  }
  /** Return true if arrays have identical counts and equal entries (using `!==` comparison) */
  public static isExactEqual(dataA: any[] | Float64Array | undefined, dataB: any[] | Float64Array | undefined) {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++)
        if (dataA[i] !== dataB[i])
          return false;
      return true;
    }
    return (!dataA && !dataB);
  }
  /** Return true if arrays have identical counts and entries equal within tolerance */
  public static isAlmostEqual(
    dataA: number[] | Float64Array | undefined,
    dataB: number[] | Float64Array | undefined,
    tolerance: number) {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++)
        if (Math.abs(dataA[i] - dataB[i]) >= tolerance) return false;
      return true;
    }
    return (!dataA && !dataB);
  }

  /** return the sum of numbers in an array.  Note that "PreciseSum" may be more accurate. */
  public static sum(data: number[] | Float64Array) {
    let sum = 0;
    for (const x of data) { sum += x; }
    return sum;
  }

  public static isCoordinateInArray(x: number, data: number[] | undefined): boolean {
    if (data) {
      for (const y of data) { if (Geometry.isSameCoordinate(x, y)) return true; }
    }
    return false;
  }
  public static MaxAbsArray(values: number[]) {
    const arrLen = values.length;
    if (arrLen === 0) {
      return 0.0;
    }
    let a = Math.abs(values[0]);
    for (let i = 1; i < arrLen; i++) {
      const b = Math.abs(values[i]);
      if (a < b) {
        a = b;
      }
    }
    return a;
  }
  public static MaxAbsTwo(a1: number, a2: number) {
    a1 = Math.abs(a1);
    a2 = Math.abs(a2);
    return (a1 > a2) ? a1 : a2;
  }
  public static maxAbsDiff(dataA: number[], dataB: number[]): number {
    let a = 0.0;
    const n = Math.min(dataA.length, dataB.length);
    for (let i = 0; i < n; i++) { a = Math.max(a, Math.abs(dataA[i] - dataB[i])); }
    return a;
  }

  public static maxAbsDiffFloat64(dataA: Float64Array, dataB: Float64Array): number {
    let a = 0.0;
    const n = Math.min(dataA.length, dataB.length);
    for (let i = 0; i < n; i++) { a = Math.max(a, Math.abs(dataA[i] - dataB[i])); }
    return a;
  }

}

export class Point2dArray {
  public static isAlmostEqual(dataA: undefined | Point2d[], dataB: undefined | Point2d[]): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++) {
        if (!dataA[i].isAlmostEqual(dataB[i]))
          return false;
      }
      return true;
    }
    return (!dataA && !dataB);
  }
  /**
   * @returns return an array containing clones of the Point3d data[]
   * @param data source data
   */
  public static clonePoint2dArray(data: Point2d[]): Point2d[] {
    return data.map((p: Point2d) => p.clone());
  }

}
export class Vector3dArray {
  public static isAlmostEqual(dataA: undefined | Vector3d[], dataB: undefined | Vector3d[]): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++)
        if (!dataA[i].isAlmostEqual(dataB[i]))
          return false;
      return true;
    }
    return (!dataA && !dataB);
  }
  /**
   * @returns return an array containing clones of the Vector3d data[]
   * @param data source data
   */
  public static cloneVector3dArray(data: XYAndZ[]): Vector3d[] {
    return data.map((p: XYAndZ) => Vector3d.create(p.x, p.y, p.z));
  }
}

export class Point4dArray {
  /** pack each point and its corresponding weight into a buffer of xyzwxyzw... */
  public static packPointsAndWeightsToFloat64Array(points: Point3d[], weights: number[], result?: Float64Array): Float64Array {
    result = result ? result : new Float64Array(4 * points.length);
    let i = 0;
    let k = 0;
    for (k = 0; k < points.length; k++) {
      result[i++] = points[k].x;
      result[i++] = points[k].y;
      result[i++] = points[k].z;
      result[i++] = weights[k];
    }
    return result;
  }

  public static packToFloat64Array(data: Point4d[], result?: Float64Array): Float64Array {
    result = result ? result : new Float64Array(4 * data.length);
    let i = 0;
    for (const p of data) {
      result[i++] = p.x;
      result[i++] = p.y;
      result[i++] = p.z;
      result[i++] = p.w;
    }
    return result;
  }
  /** unpack from xyzwxyzw... to array of Point4d */
  public static unpackToPoint4dArray(data: Float64Array): Point4d[] {
    const result = [];
    for (let i = 0; i + 3 < data.length; i += 4) {
      result.push(Point4d.create(data[i], data[i + 1], data[i + 2], data[i + 3]));
    }
    return result;
  }
  /** unpack from xyzwxyzw... array to array of Point3d and array of weight.
   */
  public static unpackFloat64ArrayToPointsAndWeights(data: Float64Array, points: Point3d[], weights: number[],
    pointFormatter: (x: number, y: number, z: number) => any = Point3d.create) {
    points.length = 0;
    weights.length = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      points.push(pointFormatter(data[i], data[i + 1], data[i + 2]));
      weights.push(data[i + 3]);
    }
  }
  private static _workPoint4d = Point4d.create();
  /**
   * Multiply (and replace) each block of 4 values as a Point4d.
   * @param transform transform to apply
   * @param xyzw array of x,y,z,w points.
   */
  public static multiplyInPlace(transform: Transform, xyzw: Float64Array): void {
    const numXYZW = xyzw.length;
    const xyzw1 = Point4dArray._workPoint4d;
    for (let i = 0; i + 3 < numXYZW; i += 4) {
      transform.multiplyXYZW(xyzw[i], xyzw[i + 1], xyzw[i + 2], xyzw[i + 3], xyzw1);
      xyzw[i] = xyzw1.x;
      xyzw[i + 1] = xyzw1.y;
      xyzw[i + 2] = xyzw1.z;
      xyzw[i + 3] = xyzw1.w;
    }
  }
  public static isAlmostEqual(dataA: Point4d[] | Float64Array | undefined, dataB: Point4d[] | Float64Array | undefined): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      if (dataA instanceof Float64Array && dataB instanceof Float64Array) {
        for (let i = 0; i < dataA.length; i++)
          if (!Geometry.isSameCoordinate(dataA[i], dataB[i]))
            return false;
      } else if (Array.isArray(dataA) && Array.isArray(dataB)) {
        for (let i = 0; i < dataA.length; i++)
          if (!dataA[i].isAlmostEqual(dataB[i]))
            return false;
      }
      return true;
    }
    // if both are null it is equal, otherwise unequal
    return (!dataA && !dataB);
  }
  /** return true iff all xyzw points' altitudes are within tolerance of the plane.*/
  public static isCloseToPlane(data: Point4d[] | Float64Array, plane: Plane3dByOriginAndUnitNormal, tolerance: number = Geometry.smallMetricDistance): boolean {
    if (Array.isArray(data)) {
      for (const xyzw of data) {
        if (Math.abs(plane.altitudeXYZW(xyzw.x, xyzw.y, xyzw.z, xyzw.w)) > tolerance)
          return false;
      }
    } else if (data instanceof Float64Array) {
      const numXYZ = data.length;
      for (let i = 0; i + 2 < numXYZ; i += 4) {
        if (Math.abs(plane.altitudeXYZW(data[i], data[i + 1], data[i + 2], data[i + 3])) > tolerance)
          return false;
      }
    }
    return true;
  }

}

export class Point3dArray {
  public static packToFloat64Array(data: Point3d[]): Float64Array {
    const result = new Float64Array(3 * data.length);
    let i = 0;
    for (const p of data) {
      result[i++] = p.x;
      result[i++] = p.y;
      result[i++] = p.z;
    }
    return result;
  }

  public static unpackNumbersToPoint3dArray(data: Float64Array | number[]): Point3d[] {
    const result = [];
    for (let i = 0; i + 2 < data.length; i += 3) {
      result.push(Point3d.create(data[i], data[i + 1], data[i + 2]));
    }
    return result;
  }

  /**
   * return an 2-dimensional array containing all the values of `data` in arrays of numPerBlock
   * @param data simple array of numbers
   * @param numPerBlock number of values in each block at first level down
   */
  public static unpackNumbersToNestedArrays(data: Float64Array, numPerBlock: number): any[] {
    const result = [];
    const n = data.length;
    let i = 0;
    let i1 = 0;
    while (i < n) {
      // there is at least one more value for a block
      const row = [];
      i1 = i + numPerBlock;
      if (i1 > n)
        i1 = n;
      for (; i < i1; i++) {
        row.push(data[i]);
      }
      result.push(row);
    }
    return result;
  }

  /**
   * return an 3-dimensional array containing all the values of `data` in arrays numPerRow blocks of numPerBlock
   * @param data simple array of numbers
   * @param numPerBlock number of values in each block at first level down
   */
  public static unpackNumbersToNestedArraysIJK(data: Float64Array, numPerBlock: number, numPerRow: number): any[] {
    const result = [];
    const n = data.length;
    let i = 0;
    let i1 = 0;
    let i2;
    while (i < n) {
      const row = [];
      i2 = i + numPerBlock * numPerRow;
      while (i < i2) {
        const block = [];
        i1 = i + numPerBlock;
        if (i1 > n)
          i1 = n;
        for (; i < i1; i++) {
          block.push(data[i]);
        }
        row.push(block);
      }
      result.push(row);
    }
    return result;
  }

  public static multiplyInPlace(transform: Transform, xyz: Float64Array): void {
    const xyz1 = Point3d.create();
    const numXYZ = xyz.length;
    for (let i = 0; i + 2 < numXYZ; i += 3) {
      transform.multiplyXYZ(xyz[i], xyz[i + 1], xyz[i + 2], xyz1);
      xyz[i] = xyz1.x;
      xyz[i + 1] = xyz1.y;
      xyz[i + 2] = xyz1.z;
    }
  }
  public static isAlmostEqual(dataA: Point3d[] | Float64Array | undefined, dataB: Point3d[] | Float64Array | undefined): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      if (dataA instanceof Float64Array && dataB instanceof Float64Array) {
        for (let i = 0; i < dataA.length; i++)
          if (!Geometry.isSameCoordinate(dataA[i], dataB[i]))
            return false;
      } else if (Array.isArray(dataA) && Array.isArray(dataB)) {
        for (let i = 0; i < dataA.length; i++)
          if (!dataA[i].isAlmostEqual(dataB[i]))
            return false;
      }
      return true;
    }
    // if both are null it is equal, otherwise unequal
    return (!dataA && !dataB);
  }

  /** return simple average of all coordinates.   (000 if empty array) */
  public static centroid(points: IndexedXYZCollection, result?: Point3d): Point3d {
    result = Point3d.create(0, 0, 0, result);
    const p = Point3d.create();
    if (points.length > 0) {
      for (let i = 0; i < points.length; i++) {
        points.atPoint3dIndex(i, p);
        result.x += p.x; result.y += p.y; result.z += p.z;
      }
      result.scaleInPlace(1.0 / points.length);
    }
    return result;
  }

  /** Return the index of the point most distant from spacePoint */
  public static vectorToMostDistantPoint(points: Point3d[], spacePoint: XYZ, farVector: Vector3d): number {
    if (points.length === 0)
      return -1;
    let dMax = -1;
    let d;
    let result = -1;
    for (let i = 0; i < points.length; i++) {
      d = spacePoint.distance(points[i]);
      if (d > dMax) {
        spacePoint.vectorTo(points[i], farVector);
        dMax = d;
        result = i;
      }
    }
    return result;
  }
  /** return the index of the point whose vector from space point has the largest magnitude of cross product with given vector. */
  public static vectorToPointWithMaxCrossProductMangitude(points: Point3d[], spacePoint: Point3d, vector: Vector3d, farVector: Vector3d): number {
    if (points.length === 0)
      return -1;
    let dMax = -1;
    let d;
    let result = -1;
    let vectorAB; // to be reused in loop !!!
    for (let i = 0; i < points.length; i++) {
      vectorAB = spacePoint.vectorTo(points[i], vectorAB);
      d = vectorAB.crossProductMagnitude(vector);
      if (d > dMax) {
        farVector.setFrom(vectorAB);
        dMax = d;
        result = i;
      }
    }
    return result;
  }

  /** Return the index of the closest point in the array (full xyz) */
  public static closestPointIndex(data: XYAndZ[], spacePoint: XYAndZ): number {
    let index = -1;
    let dMin = Number.MAX_VALUE;
    let d;
    const x0 = spacePoint.x;
    const y0 = spacePoint.y;
    const z0 = spacePoint.z;
    for (let i = 0; i < data.length; i++) {
      d = Geometry.distanceXYZXYZ(x0, y0, z0, data[i].x, data[i].y, data[i].z);
      if (d < dMin) {
        index = i;
        dMin = d;
      }
    }
    return index;
  }
  /** return true iff all points' altitudes are within tolerance of the plane.*/
  public static isCloseToPlane(data: Point3d[] | Float64Array, plane: Plane3dByOriginAndUnitNormal, tolerance: number = Geometry.smallMetricDistance): boolean {
    if (Array.isArray(data)) {
      let xyz;
      for (xyz of data) {
        if (Math.abs(plane.altitude(xyz)) > tolerance)
          return false;
      }
    } else if (data instanceof Float64Array) {
      const numXYZ = data.length;
      for (let i = 0; i + 2 < numXYZ; i += 3) {
        if (Math.abs(plane.altitudeXYZ(data[i], data[i + 1], data[i + 2])) > tolerance)
          return false;
      }
    }
    return true;
  }

  public static sumLengths(data: Point3d[] | Float64Array): number {
    let sum = 0.0;
    if (Array.isArray(data)) {
      const n = data.length - 1;
      for (let i = 0; i < n; i++) sum += data[i].distance(data[i + 1]);
    } else if (data instanceof Float64Array) {
      const numXYZ = data.length;
      for (let i = 0; i + 5 < numXYZ; i += 3) {
        sum += Math.hypot(data[i + 3] - data[i],
          data[i + 4] - data[i + 1],
          data[i + 5] - data[i + 2]);
      }
    }
    return sum;
  }

  /**
   * @returns return an array containing clones of the Point3d data[]
   * @param data source data
   */
  public static clonePoint3dArray(data: XYAndZ[]): Point3d[] {
    return data.map((p: XYAndZ) => Point3d.create(p.x, p.y, p.z));
  }

  /**
   * @returns return an array containing Point2d with xy parts of each Point3d
   * @param data source data
   */
  public static clonePoint2dArray(data: XYAndZ[]): Point2d[] {
    return data.map((p: XYAndZ) => Point2d.create(p.x, p.y));
  }

}

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
  private static readonly _triangleMomentWeights = Matrix4d.createRowValues(
    2.0 / 24.0, 1.0 / 24.0, 0, 4.0 / 24.0,
    1.0 / 24.0, 2.0 / 24.0, 0, 4.0 / 24.0,
    0, 0, 0, 0,
    4.0 / 24.0, 4.0 / 24.0, 0, 12.0 / 24.0);
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
    if (!result) result = new Vector3d();
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
    if (!result) result = Vector3d.create();
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
      const result = Ray3d.createCapture(
        Point3dArray.centroid(new Point3dArrayCarrier(points)),
        normal);
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
        normalSum.addInPlace(cross);   // this grows to twice the area
        const b = cross.magnitude() / 6.0;
        centroidSum.plus2Scaled(vector0, b, vector1, b, centroidSum);
        vector0.setFrom(vector1);
      }
      const area = 0.5 * normalSum.magnitude();
      const inverseArea = Geometry.conditionalDivideFraction(1, area);
      if (inverseArea !== undefined) {
        const result = Ray3d.createCapture(origin.plusScaled(centroidSum, inverseArea, origin), normalSum);
        result.tryNormalizeInPlaceWithAreaWeight(area);
        return result;
      }
    }
    return undefined;
  }

  // Has the potential to be combined with centroidAreaNormal for point3d array and Ray3d return listed above...
  // Returns undefined if given point array less than 3 or if not safe to divide at any point
  public static centroidAndArea(points: Point2d[], centroid: Point2d): number | undefined {
    let area = 0.0;
    centroid.set(0, 0);
    if (points.length < 3)
      return undefined;
    const origin = points[0];
    let vectorSum = Vector2d.create(0, 0);   // == sum ((U+V)/3) * (U CROSS V)/2 -- but leave out divisions
    let areaSum = 0.0;   // == sum (U CROSS V) / 2 -- but leave out divisions
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
   * Classify a point with respect to a polygon.
   * Returns 1 if point is "in" by parity, 0 if "on", -1 if "out", -2 if nothing worked.
   */
  public static parity(pPoint: Point2d, pPointArray: Point2d[] | Point3d[], tol: number = 0.0): number {
    let parity: number | undefined;
    const x = pPoint.x;
    const y = pPoint.y;
    const numPoint = pPointArray.length;

    if (numPoint < 2)
      return (Math.abs(x - pPointArray[0].x) <= tol && Math.abs(y - pPointArray[0].y) <= tol) ? 0 : -1;

    // Try really easy ways first...
    parity = PolygonOps.parityYTest(pPoint, pPointArray, tol);
    if (parity !== undefined)
      return parity;
    parity = PolygonOps.parityXTest(pPoint, pPointArray, tol);
    if (parity !== undefined)
      return parity;

    // Is test point within tol of one of the polygon points in x and y?
    for (let i = 0; i < numPoint; i++)
      if (Math.abs(x - pPointArray[i].x) <= tol && Math.abs(y - pPointArray[i].y) <= tol)
        return 0;

    // Nothing easy worked. Try some ray casts
    const maxTheta = 10.0;
    let theta = 0.276234342921378;
    const dTheta = theta;
    while (theta < maxTheta) {
      parity = PolygonOps.parityVectorTest(pPoint, theta, pPointArray, tol);
      if (parity !== undefined)
        return parity;
      theta += dTheta;
    }
    return -2;
  }

  /**
   * Classify a point with respect to a polygon defined by the xy parts of the points, using only the y
   * coordinate for the tests.
   *
   * *  Return undefined (failure, could not determine answer) if any polygon point has the same y-coord as test point
   * *  Goal is to execute the simplest cases as fast as possible, and fail promptly for others
   */
  public static parityYTest(pPoint: Point2d, pPointArray: Point2d[] | Point3d[], tol: number): number | undefined {
    // Var names h, crossing to allow closest code correspondence between x,y code
    const numPoint = pPointArray.length;
    const crossing0 = pPoint.x;
    const h = pPoint.y;
    let h0 = h - pPointArray[numPoint - 1].y;
    let h1: number;
    let crossing: number;
    let s: number;
    let numLeft = 0;

    if (Math.abs(h0) <= tol)
      return undefined;

    let i0: number;
    for (let i = 0; i < numPoint; i++ , h0 = h1!) {  // <-- h0 won't be assigned to h1 until after first iteration
      h1 = h - pPointArray[i].y;
      if (Math.abs(h1) <= tol)
        return undefined;
      if (h0 * h1 < 0.0) {
        s = -h0 / (h1 - h0);
        i0 = i - 1;
        if (i0 < 0)
          i0 = numPoint - 1;
        crossing = pPointArray[i0].x + s * (pPointArray[i].x - pPointArray[i0].x);
        if (Math.abs(crossing - crossing0) <= tol)
          return 0;
        else if (crossing < crossing0)
          numLeft++;
      }
    }
    return (numLeft & 0x01) ? 1 : -1;
  }

  /**
   * Classify a point with respect to a polygon defined by the xy parts of the points, using only the x
   * coordinate for the tests.
   *
   * *  Return undefined (failure, could not determine answer) if any polygon point has the same x coordinate as the test point
   * *  Goal is to execute the simplest cases as fast as possible, and fail promptly for others
   */
  public static parityXTest(pPoint: Point2d, pPointArray: Point2d[] | Point3d[], tol: number): number | undefined {
    // Var names h, crossing to allow closest code correspondence between x,y code
    const numPoint = pPointArray.length;
    const crossing0 = pPoint.y;
    const h = pPoint.x;
    let h0 = h - pPointArray[numPoint - 1].x;
    let h1: number;
    let crossing: number;
    let s: number;
    let numLeft = 0;

    if (Math.abs(h0) <= tol)
      return undefined;

    let i0: number;
    for (let i = 0; i < numPoint; i++ , h0 = h1!) {  // <-- h0 won't be assigned to h1 until after first iteration
      h1 = h - pPointArray[i].x;
      if (Math.abs(h1) <= tol)
        return undefined;
      if (h0 * h1 < 0.0) {
        s = -h0 / (h1 - h0);
        i0 = i - 1;
        if (i0 < 0)
          i0 = numPoint - 1;
        crossing = pPointArray[i0].y + s * (pPointArray[i].y - pPointArray[i0].y);
        if (Math.abs(crossing - crossing0) <= tol)
          return 0;
        else if (crossing < crossing0)
          numLeft++;
      }
    }
    return (numLeft & 0x01) ? 1 : -1;
  }

  /**
   * Classify a point with respect to a polygon defined by the xy parts of the points, using a given ray cast
   * direction.
   *
   * *  Return false (failure, could not determine answer) if any polygon point is on the ray
   */
  public static parityVectorTest(pPoint: Point2d, theta: number, pPointArray: Point2d[] | Point3d[], tol: number): number | undefined {
    const numPoint = pPointArray.length;
    let v1: number;
    let u0: number;
    let u1: number;
    let u: number;
    let s: number;
    let numLeft = 0;
    const tangent = Vector2d.create(Math.cos(theta), Math.sin(theta));
    const normal = Vector2d.create(-tangent.y, tangent.x);
    let v0 = normal.dotProductStartEnd(pPoint, pPointArray[numPoint - 1]);

    if (Math.abs(v0) <= tol)
      return undefined;

    let i0: number;
    for (let i = 0; i < numPoint; i++ , v0 = v1!) {  // <-- v0 won't be assigned to v1 until after first iteration
      v1 = normal.dotProductStartEnd(pPoint, pPointArray[i]);
      if (Math.abs(v1) <= tol)
        return undefined;
      if (v0 * v1 < 0.0) {
        s = -v0 / (v1 - v0);
        i0 = i - 1;
        if (i0 < 0)
          i0 = numPoint - 1;
        u0 = tangent.dotProductStartEnd(pPoint, pPointArray[i0]);
        u1 = tangent.dotProductStartEnd(pPoint, pPointArray[i]);
        u = u0 + s * (u1 - u0);
        if (Math.abs(u) <= tol)
          return 0;
        else if (u < 0.0)
          numLeft++;
      }
    }
    return (numLeft & 0x01) ? 1 : -1;
  }
}
/**
 * Helper object to access members of a Point3d[] in geometric calculations.
*/
export class Point3dArrayCarrier extends IndexedXYZCollection {
  public data: Point3d[];
  /** CAPTURE caller supplied array ... */
  public constructor(data: Point3d[]) {
    super();
    this.data = data;
  }
  public isValidIndex(index: number): boolean {
    return index >= 0 && index < this.data.length;
  }
  /**
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public atPoint3dIndex(index: number, result?: Point3d): Point3d | undefined {
    if (this.isValidIndex(index)) {
      const source = this.data[index];
      return Point3d.create(source.x, source.y, source.z, result);
    }
    return undefined;
  }
  /**
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public atVector3dIndex(index: number, result?: Vector3d): Vector3d | undefined {
    if (this.isValidIndex(index)) {
      const source = this.data[index];
      return Vector3d.create(source.x, source.y, source.z, result);
    }
    return undefined;
  }
  /**
   * @param indexA index of point within the array
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public vectorIndexIndex(indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined {
    if (this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return Vector3d.createStartEnd(this.data[indexA], this.data[indexB], result);
    return undefined;
  }
  /**
   * @param origin origin for vector
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public vectorXYAndZIndex(origin: XYAndZ, indexB: number, result?: Vector3d): Vector3d | undefined {
    if (this.isValidIndex(indexB))
      return Vector3d.createStartEnd(origin, this.data[indexB], result);
    return undefined;
  }

  /**
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public crossProductXYAndZIndexIndex(origin: XYAndZ, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined {
    if (this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return Vector3d.createCrossProductToPoints(origin, this.data[indexA], this.data[indexB], result);
    return undefined;
  }
  /**
 * @param originIndex index of origin
 * @param indexA index of first target within the array
 * @param indexB index of second target within the array
 * @param result caller-allocated vector.
 * @returns return true if indexA, indexB both valid
 */
  public crossProductIndexIndexIndex(originIndex: number, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined {
    if (this.isValidIndex(originIndex) && this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return Vector3d.createCrossProductToPoints(this.data[originIndex], this.data[indexA], this.data[indexB], result);
    return undefined;
  }
  /**
   * @param origin index of origin
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns return true if indexA, indexB both valid
   */
  public accumulateCrossProductIndexIndexIndex(originIndex: number, indexA: number, indexB: number, result: Vector3d): void {
    const data = this.data;
    if (this.isValidIndex(originIndex) && this.isValidIndex(indexA) && this.isValidIndex(indexB))
      result.addCrossProductToTargetsInPlace(
        data[originIndex].x, data[originIndex].y, data[originIndex].z,
        data[indexA].x, data[indexA].y, data[indexA].z,
        data[indexB].x, data[indexB].y, data[indexB].z);
  }

  /**
   * read-only property for number of XYZ in the collection.
   */
  public get length(): number {
    return this.data.length;
  }
}
