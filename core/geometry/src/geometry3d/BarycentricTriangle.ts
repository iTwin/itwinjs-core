/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { assert } from "@itwin/core-bentley";
import { Geometry, PolygonLocation } from "../Geometry";
import { Matrix3d } from "./Matrix3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";

/**
 * Carries data about a point in the plane of a triangle.
 * Each instance carries both world and barycentric coordinates for the point, and provides query services on the latter.
 * A small tolerance (Geometry.smallFraction) is used when classifying the location via barycentric coordinates.
 *
 * Properties of the barycentric coordinates (b0, b1, b2) of a point p in the plane of a triangle T with vertices p0, p1, p2:
 * * 1 = b0 + b1 + b2
 * * p = b0 * p0 + b1 * p1 + b2 * p2
 * * If T is spanned by the vectors U=p1-p0 and V=p2-p0, then the vector P=p-p0 can be written P = b1 * U + b2 * V.
 * * The coordinates are all nonnegative if and only if p is inside or on T.
 * * Exactly one coordinate is zero if and only if p lies on an (infinitely extended) edge of T.
 * * Exactly two coordinates are zero if and only if p coincides with a vertex of T.
 * @public
 */
export class TriangleLocationDetail {
  /** The Cartesian coordinates of the point p. */
  public world: Point3d;
  /** The barycentric coordinates of p with respect to the triangle. */
  public local: Point3d;
  /** Application-specific number */
  public a: number;
  /** Index of the triangle vertex at the base of the edge closest to p. Valid if `hasEdgeProjection` returns true. */
  public closestEdgeIndex: number;
  /** The projection parameter of p onto the triangle edge closest to p. Valid if `hasEdgeProjection` returns true. */
  public closestEdgeParam: number;

  private constructor() {
    this.world = new Point3d();
    this.local = new Point3d();
    this.a = 0.0;
    this.closestEdgeIndex = -1;
    this.closestEdgeParam = 0.0;
  }

  /** Invalidate this detail. */
  public invalidate() {
    this.world.setZero();
    this.local.setZero();
    this.a = 0.0;
    this.closestEdgeIndex = -1;
    this.closestEdgeParam = 0.0;
  }

  /** Create an invalid detail with all zeroes.
   * @param result optional pre-allocated object to fill and return
   */
  public static create(result?: TriangleLocationDetail): TriangleLocationDetail {
    if (undefined === result)
      result = new TriangleLocationDetail();
    else
      result.invalidate();
    return result;
  }

  /** Whether the barycentric coordinates sum to 1. */
  public get isValid(): boolean {
    return Math.abs(this.local.x + this.local.y + this.local.z - 1.0) <= Geometry.smallFraction;
  }

  /** Queries the barycentric coordinates to determine whether this instance specifies a location inside or on the triangle.
   * @see classify
   */
  public get isInsideOrOn(): boolean {
    if (!this.isValid)
      return false;
    const min = -Geometry.smallFraction;
    const max = 1.0 + Geometry.smallFraction;
    return this.local.x >= min && this.local.y >= min && this.local.z >= min &&
           this.local.x <= max && this.local.y <= max && this.local.z <= max;
  }

  /** Whether this instance contains closest edge data. */
  public get hasEdgeProjection(): boolean {
    return this.isValid && this.closestEdgeIndex >= 0;
  }

  /** Queries this detail to classify the location of this instance with respect to the triangle.
   * @returns location code
   * @see isInsideOrOn
   */
  public classify(): PolygonLocation {
    if (!this.isValid)
      return PolygonLocation.Unknown;
    if (this.isInsideOrOn) {
      let nZero = 0;
      if (Math.abs(this.local.x) <= Geometry.smallFraction)
        ++nZero;
      if (Math.abs(this.local.y) <= Geometry.smallFraction)
        ++nZero;
      if (Math.abs(this.local.z) <= Geometry.smallFraction)
        ++nZero;
      if (2 === nZero)
        return PolygonLocation.OnPolygonVertex;
      if (1 === nZero)
        return PolygonLocation.OnPolygonEdgeInterior;
      return PolygonLocation.InsidePolygonProjectsToEdgeInterior;
    }
    if (this.hasEdgeProjection)
      return (this.closestEdgeParam === 0.0) ? PolygonLocation.OutsidePolygonProjectsToVertex : PolygonLocation.OutsidePolygonProjectsToEdgeInterior;
    return PolygonLocation.OutsidePolygon;
  }
}

/**
 * 3 points defining a triangle to be evaluated with barycentric coordinates.
 * @public
 */
export class BarycentricTriangle {
  /** Array of 3 point coordinates for the triangle. */
  public points: Point3d[];

  /** Edge length squared cache, indexed by opposite vertex index */
  protected s2: (number | undefined)[];

  /** Constructor.
   * * Point references are CAPTURED
   */
  protected constructor(point0: Point3d, point1: Point3d, point2: Point3d) {
    this.points = [];
    this.points.push(point0);
    this.points.push(point1);
    this.points.push(point2);
    this.s2 = [];
    this.s2.push(undefined);
    this.s2.push(undefined);
    this.s2.push(undefined);
  }

  /**
   * Return a `BarycentricTriangle` with coordinates given by enumerated x,y,z of the 3 points.
   * @param result optional pre-allocated triangle.
   */
  public static createXYZXYZXYZ(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, result?: BarycentricTriangle): BarycentricTriangle {
    if (!result) return new this(Point3d.create(x0, y0, z0), Point3d.create(x1, y1, z1), Point3d.create(x2, y2, z2));
    result.points[0].set(x0, y0, z0);
    result.points[1].set(x1, y1, z1);
    result.points[2].set(x2, y2, z2);
    return result;
  }
  /** create a triangle with coordinates cloned from given points. */
  public static create(point0: Point3d, point1: Point3d, point2: Point3d, result?: BarycentricTriangle): BarycentricTriangle {
    if (!result)
      return new this(point0.clone(), point1.clone(), point2.clone());
    result.set(point0, point1, point2);
    return result;
  }
  /** Return a new `BarycentricTriangle` with the same coordinates. */
  public clone(result?: BarycentricTriangle): BarycentricTriangle {
    return BarycentricTriangle.create(this.points[0], this.points[1], this.points[2], result);
  }

  /** Return area divided by sum of squared lengths. */
  public get aspectRatio(): number {
    return Geometry.safeDivideFraction(this.area, this.edgeLengthSquared(0) + this.edgeLengthSquared(1) + this.edgeLengthSquared(2), 0);
  }
  /** Return the area of the triangle. */
  public get area(): number {
    return 0.5 * this.points[0].crossProductToPointsMagnitude(this.points[1], this.points[2]);
  }

  /** Return the perimeter of the triangle */
  public get perimeter(): number {
    return this.edgeLength(0) + this.edgeLength(1) + this.edgeLength(2);
  }

  /** Sum the points with given scales.
   * * If the scales sum to 1, they are barycentric coordinates, and hence the result point is in the plane of the triangle.
   * * If the scales do not sum to 1, the point is in the triangle scaled (by the scale sum) from the origin.
   * @param b0 scale to apply to vertex 0
   * @param b1 scale to apply to vertex 1
   * @param b2 scale to apply to vertex 2
   * @param result optional pre-allocated point to fill and return
   * @return linear combination of the vertices of this triangle
   * @see pointToFraction
   */
  public fractionToPoint(b0: number, b1: number, b2: number, result?: Point3d): Point3d {
    return Point3d.createAdd3Scaled(this.points[0], b0, this.points[1], b1, this.points[2], b2, result);
  }

  private static _workPoint?: Point3d;
  private static _workVector0?: Vector3d;
  private static _workVector1?: Vector3d;
  private static _workRay?: Ray3d;
  private static _workMatrix?: Matrix3d;

  /** Compute the projection of the given point onto the plane of this triangle.
   * @param point point p to project
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the projection point P = `d.point`:
   * * `d.isValid()` returns true if and only if `this.normal()` is defined.
   * * `d.classify()` can be used to determine where P lies with respect to the triangle.
   * * `d.a` is the signed projection distance: P = p + a * `this.normal()`.
   * @see fractionToPoint
   */
  public pointToFraction(point: Point3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    BarycentricTriangle._workVector0 = this.normal(BarycentricTriangle._workVector0);
    if (undefined === BarycentricTriangle._workVector0)
      return TriangleLocationDetail.create(result);
    BarycentricTriangle._workRay = Ray3d.create(point, BarycentricTriangle._workVector0, BarycentricTriangle._workRay);
    return this.intersectRay3d(BarycentricTriangle._workRay, result); // is free to use workVector0
  }

  /** Convert from opposite-vertex to start-vertex edge indexing. */
  public static edgeOppositeVertexIndexToStartVertexIndex(edgeIndex: number): number {
    return Geometry.cyclic3dAxis(edgeIndex + 1);
  }

  /** Convert from start-vertex to opposite-vertex edge indexing. */
  public static edgeStartVertexIndexToOppositeVertexIndex(startVertexIndex: number): number {
    return Geometry.cyclic3dAxis(startVertexIndex - 1);
  }

  /** Examine a point's barycentric coordinates to determine if it lies inside the triangle but not on an edge/vertex.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns whether the point with barycentric coordinates is strictly inside the triangle.
   */
  public static isInsideTriangle(b0: number, b1: number, b2: number): boolean {
    return b0 > 0 && b1 > 0 && b2 > 0;
  }

  /** Examine a point's barycentric coordinates to determine if it lies "outside" an edge of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex/edge i for which b_i < 0 and b_j >= 0 and b_k >= 0, or -1
   */
  public static isInRegionBeyondEdge(b0: number, b1: number, b2: number): number {
    if (b0 < 0 && b1 >= 0 && b2 >= 0)
      return 0;
    if (b0 >= 0 && b1 < 0 && b2 >= 0)
      return 1;
    if (b0 >= 0 && b1 >= 0 && b2 < 0)
      return 2;
    return -1;
  }

  /** Examine a point's barycentric coordinates to determine if it lies "outside" a vertex of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex i for which and b_j < 0 and b_k < 0, or -1
   */
  public static isInRegionBeyondVertex(b0: number, b1: number, b2: number): number {
    if (b1 < 0 && b2 < 0)
      return 0;
    if (b0 < 0 && b2 < 0)
      return 1;
    if (b0 < 0 && b1 < 0)
      return 2;
    return -1;
  }

  /** Examine a point's barycentric coordinates to determine if it lies on a vertex of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex i for which b_i = 1 and b_j = b_k = 0, or -1
   */
  public static isOnVertex(b0: number, b1: number, b2: number): number {
    if (b0 === 1 && b1 === 0 && b2 === 0)
      return 0;
    if (b0 === 0 && b1 === 1 && b2 === 0)
      return 1;
    if (b0 === 0 && b1 === 0 && b2 === 1)
      return 2;
    return -1;
  }

  /** Examine a point's barycentric coordinates to determine if it lies on a bounded edge of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex/edge i for which b_i = 0 and b_j > 0 and b_k > 0, or -1
   */
  public static isOnBoundedEdge(b0: number, b1: number, b2: number): number {
    if (b0 === 0 && b1 > 0 && b2 > 0)
      return 0;
    if (b0 > 0 && b1 === 0 && b2 > 0)
      return 1;
    if (b0 > 0 && b1 > 0 && b2 === 0)
      return 2;
    return -1;
  }

  /** @returns edge/vertex index (0,1,2) for which the function has a minimum value */
  private static indexOfMinimum(fn: (edgeIndex: number) => number): number {
    let i = 0;
    let min = fn(0);
    const val = fn(1);
    if (min > val) {
      i = 1;
      min = val;
    }
    if (min > fn(2))
      i = 2;
    return i;
  }

  /** Return the index of the closest triangle vertex to the point given by its barycentric coordinates. */
  public closestVertexIndex(b0: number, b1: number, b2: number): number {
    return BarycentricTriangle.indexOfMinimum((i: number) => {
      const a = BarycentricTriangle._workPoint = Point3d.createZero(BarycentricTriangle._workPoint);
      a.setAt(i, 1.0);
      return this.distanceSquared(a.x, a.y, a.z, b0, b1, b2);
    });
  }

  /** Compute the projection of barycentric point p onto the (unbounded) edge e_k(v_i,v_j) of the triangle T(v_i,v_j,v_k).
   * @param k vertex v_k is opposite the edge e_k
   * @param b barycentric coordinates of point to project
   * @returns parameter s along e_k, such that:
   * * the projection point is q = v_i + s * (v_j - v_i)
   * * the barycentric coords of the projection are q_ijk = (1 - s, s, 0)
   */
  private computeProjectionToEdge(k: number, b: number[]): number {
    // Let U=v_j-v_i and V=v_k-v_i. Then
    // 0 = (p-q).(v_j-v_i) = ((p-v_i)-(q-v_i)).(v_j-v_i) = (b[j]U + b[k]V - sU).U = b[j]U.U + b[k]U.V - sU.U
    // Thus s = b[j] + b[k]U.V/U.U
    k = Geometry.cyclic3dAxis(k);
    const i = Geometry.cyclic3dAxis(k + 1);
    const j = Geometry.cyclic3dAxis(i + 1);
    return b[j] + b[k] * this.dotProductOfEdgeVectorsAtVertex(i) / this.edgeLengthSquared(k);
  }

  /** Compute the projection of a barycentric point p to the triangle T(v_0,v_1,v_2).
   * @param b0 barycentric coordinate of p corresponding to v_0
   * @param b1 barycentric coordinate of p corresponding to v_1
   * @param b2 barycentric coordinate of p corresponding to v_2
   * @returns closest edge start vertex index i and projection parameter u such that the projection q = v_i + u * (v_j - v_i).
   */
  public closestPoint(b0: number, b1: number, b2: number): {closestEdgeIndex: number, closestEdgeParam: number} {
    const b: number[] = [b0, b1, b2];
    let edgeIndex = -1;  // opposite-vertex index
    let edgeParam = 0.0;
    if (BarycentricTriangle.isInsideTriangle(b0, b1, b2)) { // projects to any edge
      edgeIndex = BarycentricTriangle.indexOfMinimum((i: number) => {
        // We want smallest projection distance d_i of p to e_i.
        // Since b[i]=d_i|e_i|/2A we can compare quantities b[i]/|e_i|.
        return b[i] * b[i] / this.edgeLengthSquared(i); // avoid sqrt
      });
      edgeParam = this.computeProjectionToEdge(edgeIndex, b);
    } else if ((edgeIndex = BarycentricTriangle.isInRegionBeyondVertex(b0, b1, b2)) >= 0) { // projects to other edges, or any vertex
      edgeIndex = Geometry.cyclic3dAxis(edgeIndex + 1);
      edgeParam = this.computeProjectionToEdge(edgeIndex, b);
      if (edgeParam < 0 || edgeParam > 1) {
        edgeIndex = Geometry.cyclic3dAxis(edgeIndex + 1);
        edgeParam = this.computeProjectionToEdge(edgeIndex, b);
        if (edgeParam < 0 || edgeParam > 1) {
          edgeParam = 0.0;
          edgeIndex = BarycentricTriangle.edgeStartVertexIndexToOppositeVertexIndex(this.closestVertexIndex(b0, b1, b2));
        }
      }
    } else if ((edgeIndex = BarycentricTriangle.isInRegionBeyondEdge(b0, b1, b2)) >= 0) { // projects to the edge or its vertices
      edgeParam = this.computeProjectionToEdge(edgeIndex, b);
      if (edgeParam < 0) {
        edgeParam = 0.0;  // start of this edge
      } else if (edgeParam > 1) {
        edgeParam = 0.0;
        edgeIndex = Geometry.cyclic3dAxis(edgeIndex + 1); // end of this edge = start of next edge
      }
    } else if ((edgeIndex = BarycentricTriangle.isOnBoundedEdge(b0, b1, b2)) >= 0) {
      edgeParam = 1 - b[BarycentricTriangle.edgeOppositeVertexIndexToStartVertexIndex(edgeIndex)];
    } else if ((edgeIndex = BarycentricTriangle.isOnVertex(b0, b1, b2)) >= 0) {
      edgeParam = 0.0;
      edgeIndex = BarycentricTriangle.edgeStartVertexIndexToOppositeVertexIndex(edgeIndex);
    }
    // invalid edgeIndex shouldn't happen, but propagate it anyway
    assert(edgeIndex === 0 || edgeIndex === 1 || edgeIndex === 2);
    return {
      closestEdgeIndex: (edgeIndex < 0) ? -1 : BarycentricTriangle.edgeOppositeVertexIndexToStartVertexIndex(edgeIndex),
      closestEdgeParam: edgeParam,
    };
  }

  /** Compute the intersection of a line (parameterized as a ray) with the plane of this triangle.
   * @param ray infinite line to intersect, as a ray
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection `d.point`:
   * * `d.isValid()` returns true if and only if the line intersects the plane.
   * * `d.classify()` can be used to determine where the intersection lies with respect to the triangle.
   * * `d.a` is the intersection parameter. If `d.a` >= 0, the ray intersects the plane of the triangle.
   * @see pointToFraction
  */
  public intersectRay3d(ray: Ray3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    result = TriangleLocationDetail.create(result);
    // Let r0 = ray.origin, d = ray.direction. Write intersection point p two ways for unknown scalars s,b0,b1,b2:
    //    r0 + s*d = p = b0*p0 + b1*p1 + b2*p2
    // Subtract p0 from both ends, let u=p1-p0, v=p2-p0, c=r0-p0, and enforce b0+b1+b2=1:
    //    b1*u + b2*v - s*d = c
    // This is a linear system Mx=c where M has columns u,v,d and solution x=(b1,b2,-s).
    const r0 = ray.origin;
    const d = ray.direction;
    const u = BarycentricTriangle._workVector0 = Vector3d.createStartEnd(this.points[0], this.points[1], BarycentricTriangle._workVector0);
    const v = BarycentricTriangle._workVector1 = Vector3d.createStartEnd(this.points[0], this.points[2], BarycentricTriangle._workVector1);
    const M = BarycentricTriangle._workMatrix = Matrix3d.createColumns(u, v, d, BarycentricTriangle._workMatrix);
    const c = Vector3d.createStartEnd(this.points[0], r0, BarycentricTriangle._workVector0);  // reuse workVector0
    const solution = BarycentricTriangle._workVector1;  // reuse workVector1
    if (undefined === M.multiplyInverse(c, solution))
      return result;  // invalid
    result.a = -solution.z;
    ray.fractionToPoint(result.a, result.world);
    result.local.set(1.0 - solution.x - solution.y, solution.x, solution.y);
    const proj = this.closestPoint(result.local.x, result.local.y, result.local.z);
    result.closestEdgeIndex = proj.closestEdgeIndex;
    result.closestEdgeParam = proj.closestEdgeParam;
    return result;
  }

  /** Compute the intersection of a line (parameterized as a line segment) with the plane of this triangle.
   * @param point0 start point of segment on line to intersect
   * @param point1 end point of segment on line to intersect
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection `d.point`:
   * * `d.isValid()` returns true if and only if the line intersects the plane.
   * * `d.classify()` can be used to determine where the intersection lies with respect to the triangle.
   * * `d.a` is the intersection parameter. If `d.a` is in [0,1], the segment intersects the plane of the triangle.
   * @see intersectRay3d
  */
  public intersectSegment(point0: Point3d, point1: Point3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    BarycentricTriangle._workRay = Ray3d.createStartEnd(point0, point1, BarycentricTriangle._workRay);
    return this.intersectRay3d(BarycentricTriangle._workRay, result);
  }

  /** Copy all values from `other`
   */
  public setFrom(other: BarycentricTriangle) {
    this.points[0].setFromPoint3d(other.points[0]);
    this.points[1].setFromPoint3d(other.points[1]);
    this.points[2].setFromPoint3d(other.points[2]);
  }
  /** copy contents of (not pointers to) the given points. */
  public set(point0: Point3d | undefined, point1: Point3d | undefined, point2: Point3d | undefined) {
    this.points[0].setFromPoint3d(point0);
    this.points[1].setFromPoint3d(point1);
    this.points[2].setFromPoint3d(point2);
  }
  /**
   * * For `this` and `other` BarycentricTriangles, compute cross products of vectors from point0 to point1 and from point0 to point2.
   * * return the dot product of those two
   */
  public dotProductOfCrossProductsFromOrigin(other: BarycentricTriangle): number {
    BarycentricTriangle._workVector0 = this.points[0].crossProductToPoints(this.points[1], this.points[2], BarycentricTriangle._workVector0);
    BarycentricTriangle._workVector1 = other.points[0].crossProductToPoints(other.points[1], other.points[2], BarycentricTriangle._workVector1);
    return BarycentricTriangle._workVector0.dotProduct(BarycentricTriangle._workVector1);
  }
  /** Return the centroid of the 3 points. */
  public centroid(result?: Point3d): Point3d {
    // write it out to get single scale application.
    // Do the scale as true division (rather than multiply by precomputed 1/3).  This might protect one bit of result.
    return Point3d.create(
      (this.points[0].x + this.points[1].x + this.points[2].x) / 3.0,
      (this.points[0].y + this.points[1].y + this.points[2].y) / 3.0,
      (this.points[0].z + this.points[1].z + this.points[2].z) / 3.0,
      result);
  }

  /** Return the incenter of the triangle. */
  public incenter(result?: Point3d): Point3d {
    const a = this.edgeLength(0);
    const b = this.edgeLength(1);
    const c = this.edgeLength(2);
    const scale = Geometry.safeDivideFraction(1.0, a + b + c, 0.0);
    return this.fractionToPoint(scale * a, scale * b, scale * c, result);
  }

  /** Return the circumcenter of the triangle. */
  public circumcenter(result?: Point3d): Point3d {
    const a2 = this.edgeLengthSquared(0);
    const b2 = this.edgeLengthSquared(1);
    const c2 = this.edgeLengthSquared(2);
    const x = a2 * (b2 + c2 - a2);
    const y = b2 * (c2 + a2 - b2);
    const z = c2 * (a2 + b2 - c2);
    const scale = Geometry.safeDivideFraction(1.0, x + y + z, 0.0);
    return this.fractionToPoint(scale * x, scale * y, scale * z, result);
  }

  /** Return the unit normal of the triangle.
   * @param result optional pre-allocated vector to fill and return.
   * @returns unit normal, or undefined if cross product length is too small.
   */
  public normal(result?: Vector3d): Vector3d | undefined {
    const cross = this.points[0].crossProductToPoints(this.points[1], this.points[2], result);
    if (cross.tryNormalizeInPlace())
      return cross;
    return undefined;
  }

  /** test for point-by-point `isAlmostEqual` relationship. */
  public isAlmostEqual(other: BarycentricTriangle): boolean {
    return this.points[0].isAlmostEqual(other.points[0])
      && this.points[1].isAlmostEqual(other.points[1])
      && this.points[2].isAlmostEqual(other.points[2]);
  }

  /** Compute length of the triangle edge opposite the vertex with the given index.
   * @see edgeStartVertexIndexToOppositeVertexIndex
   */
  public edgeLength(oppositeVertexIndex: number): number {
    return Math.sqrt(this.edgeLengthSquared(oppositeVertexIndex));
  }

  /** Compute squared length of the triangle edge opposite the vertex with the given index.
   * @see edgeStartVertexIndexToOppositeVertexIndex
  */
  public edgeLengthSquared(oppositeVertexIndex: number): number {
    const vi = Geometry.cyclic3dAxis(oppositeVertexIndex);
    const cached = this.s2[vi];
    if (undefined !== cached)
      return cached;
    const i = BarycentricTriangle.edgeOppositeVertexIndexToStartVertexIndex(vi);
    const j = Geometry.cyclic3dAxis(i + 1);
    return this.s2[vi] = this.points[i].distanceSquared(this.points[j]);
  }

  /** Compute dot product of the edge vectors based at the vertex with the given index. */
  public dotProductOfEdgeVectorsAtVertex(baseVertexIndex: number): number {
    const i = Geometry.cyclic3dAxis(baseVertexIndex);
    const j = Geometry.cyclic3dAxis(i + 1);
    const k = Geometry.cyclic3dAxis(j + 1);
    return Geometry.dotProductXYZXYZ(this.points[j].x - this.points[i].x, this.points[j].y - this.points[i].y, this.points[j].z - this.points[i].z,
      this.points[k].x - this.points[i].x, this.points[k].y - this.points[i].y, this.points[k].z - this.points[i].z);
  }

  /** Compute the squared distance between two points given by their barycentric coordinates.
   * * It is assumed that a0 + a1 + a2 = b0 + b1 + b2 = 1.
   */
  public distanceSquared(a0: number, a1: number, a2: number, b0: number, b1: number, b2: number): number {
    // the barycentric displacement vector distance formula
    return -this.edgeLengthSquared(0) * (b1 - a1) * (b2 - a2) - this.edgeLengthSquared(1) * (b2 - a2) * (b0 - a0) - this.edgeLengthSquared(2) * (b0 - a0) * (b1 - a1);
  }
}
