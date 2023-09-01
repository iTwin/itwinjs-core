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
import { Transform } from "./Transform";

/**
 * Carries data about a location in the plane of a triangle.
 * * Each instance carries both world and barycentric coordinates for the point, and provides query
 * services on the latter.
 * * No tolerance is used when querying barycentric coordinates (e.g., `isInsideOrOn`, `classify`). Use
 * [[BarycentricTriangle.snapLocationToEdge]] to adjust the barycentric coordinates to a triangle edge
 * if they lie within a distance or parametric tolerance.
 *
 * Properties of the barycentric coordinates `(b0, b1, b2)` of a point `p` in the plane of a triangle
 * `T` with vertices `v0, v1, v2`:
 * * `1 = b0 + b1 + b2`
 * * `p = b0 * v0 + b1 * v1 + b2 * v2`
 * * If T is spanned by the vectors `U = v1 - v0` and `V = v2 - v0`, then the vector `P = p - v0` can
 * be written `P = b1 * U + b2 * V`.
 * * The coordinates are all nonnegative if and only if `p` is inside or on `T`.
 * * Exactly one coordinate is zero if and only if `p` lies on an (infinitely extended) edge of `T`.
 * * Exactly two coordinates are zero if and only if `p` coincides with a vertex of `T`.
 * * Note that if `p` can be written as a linear combination of the vertices of `T` using scales that do
 * NOT sum to 1, then `p` is not coplanar with `T`
 * @public
 */
export class TriangleLocationDetail {
  /** The Cartesian coordinates of the point p. */
  public world: Point3d;
  /** The barycentric coordinates of p with respect to the triangle. Assumed to sum to one. */
  public local: Point3d;
  /** Application-specific number */
  public a: number;
  /** Index of the triangle vertex at the start of the closest edge to p. */
  public closestEdgeIndex: number;
  /**
   * The parameter f along the closest edge to p of its projection q.
   * * We have q = v_i + f * (v_j - v_i) where i = closestEdgeIndex and j = (i + 1) % 3 are the indices
   * of the start vertex v_i and end vertex v_j of the closest edge to p.
   * * Note that 0 <= f <= 1.
   */
  public closestEdgeParam: number;

  private constructor() {
    this.world = new Point3d();
    this.local = new Point3d();
    this.a = 0.0;
    this.closestEdgeIndex = 0;
    this.closestEdgeParam = 0.0;
  }
  /** Invalidate this detail (set all attributes to zero) . */
  public invalidate() {
    this.world.setZero();
    this.local.setZero();
    this.a = 0.0;
    this.closestEdgeIndex = 0;
    this.closestEdgeParam = 0.0;
  }
  /**
   * Create an invalid detail.
   * @param result optional pre-allocated object to fill and return
   */
  public static create(result?: TriangleLocationDetail): TriangleLocationDetail {
    if (undefined === result)
      result = new TriangleLocationDetail();
    else
      result.invalidate();
    return result;
  }
  /**
   * Set the instance contents from the `other` detail.
   * @param other detail to clone
   */
  public copyContentsFrom(other: TriangleLocationDetail) {
    this.world.setFrom(other.world);
    this.local.setFrom(other.local);
    this.a = other.a;
    this.closestEdgeIndex = other.closestEdgeIndex;
    this.closestEdgeParam = other.closestEdgeParam;
  }
  /** Whether this detail is invalid. */
  public get isValid(): boolean {
    return !this.local.isZero;
  }
  /**
   * Queries the barycentric coordinates to determine whether this instance specifies a location inside or
   * on the triangle.
   * @see classify
   */
  public get isInsideOrOn(): boolean {
    return this.isValid && this.local.x >= 0.0 && this.local.y >= 0.0 && this.local.z >= 0.0;
  }
  /**
   * Queries this detail to classify the location of this instance with respect to the triangle.
   * @returns location code
   * @see isInsideOrOn
   */
  public get classify(): PolygonLocation {
    if (!this.isValid)
      return PolygonLocation.Unknown;
    if (this.isInsideOrOn) {
      let numZero = 0;
      if (Math.abs(this.local.x) === 0.0)
        ++numZero;
      if (Math.abs(this.local.y) === 0.0)
        ++numZero;
      if (Math.abs(this.local.z) === 0.0)
        ++numZero;
      if (2 === numZero)
        return PolygonLocation.OnPolygonVertex;
      if (1 === numZero)
        return PolygonLocation.OnPolygonEdgeInterior;
      return PolygonLocation.InsidePolygonProjectsToEdgeInterior;
    }
    return (this.closestEdgeParam === 0.0) ?
      PolygonLocation.OutsidePolygonProjectsToVertex :
      PolygonLocation.OutsidePolygonProjectsToEdgeInterior;
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
  protected edgeLength2: number[];
  // private attributes
  private static _workPoint?: Point3d;
  private static _workVector0?: Vector3d;
  private static _workVector1?: Vector3d;
  private static _workRay?: Ray3d;
  private static _workMatrix?: Matrix3d;
  /**
   * Constructor.
   * * Point references are CAPTURED
   */
  protected constructor(point0: Point3d, point1: Point3d, point2: Point3d) {
    this.points = [];
    this.points.push(point0);
    this.points.push(point1);
    this.points.push(point2);
    this.edgeLength2 = [];
    this.edgeLength2.push(point1.distanceSquared(point2));
    this.edgeLength2.push(point0.distanceSquared(point2));
    this.edgeLength2.push(point0.distanceSquared(point1));
  }
  /**
   * Copy contents of (not pointers to) the given points. A vertex is zeroed if its corresponding input point
   * is undefined.
   */
  public set(point0: Point3d | undefined, point1: Point3d | undefined, point2: Point3d | undefined) {
    this.points[0].setFromPoint3d(point0);
    this.points[1].setFromPoint3d(point1);
    this.points[2].setFromPoint3d(point2);
    this.edgeLength2[0] = this.points[1].distanceSquared(this.points[2]);
    this.edgeLength2[1] = this.points[0].distanceSquared(this.points[2]);
    this.edgeLength2[2] = this.points[0].distanceSquared(this.points[1]);
  }
  /** Copy all values from `other` */
  public setFrom(other: BarycentricTriangle) {
    for (let i = 0; i < 3; ++i) {
      this.points[i].setFromPoint3d(other.points[i]);
      this.edgeLength2[i] = other.edgeLength2[i];
    }
  }
  /**
   * Create a `BarycentricTriangle` with coordinates given by enumerated x,y,z of the 3 points.
   * @param result optional pre-allocated triangle.
   */
  public static createXYZXYZXYZ(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    result?: BarycentricTriangle,
  ): BarycentricTriangle {
    if (!result)
      return new this(Point3d.create(x0, y0, z0), Point3d.create(x1, y1, z1), Point3d.create(x2, y2, z2));
    result.points[0].set(x0, y0, z0);
    result.points[1].set(x1, y1, z1);
    result.points[2].set(x2, y2, z2);
    return result;
  }
  /** Create a triangle with coordinates cloned from given points. */
  public static create(
    point0: Point3d, point1: Point3d, point2: Point3d, result?: BarycentricTriangle,
  ): BarycentricTriangle {
    if (!result)
      return new this(point0.clone(), point1.clone(), point2.clone());
    result.set(point0, point1, point2);
    return result;
  }
  /** Return a new `BarycentricTriangle` with the same coordinates. */
  public clone(result?: BarycentricTriangle): BarycentricTriangle {
    return BarycentricTriangle.create(this.points[0], this.points[1], this.points[2], result);
  }
  /** Return a clone of the transformed instance */
  public cloneTransformed(transform: Transform, result?: BarycentricTriangle): BarycentricTriangle {
    return BarycentricTriangle.create(
      transform.multiplyPoint3d(this.points[0], result?.points[0]),
      transform.multiplyPoint3d(this.points[1], result?.points[1]),
      transform.multiplyPoint3d(this.points[2], result?.points[2]),
      result,
    );
  }
  /** Return the area of the triangle. */
  public get area(): number {
    // The magnitude of the cross product A × B is the area of the parallelogram spanned by A and B.
    return 0.5 * this.points[0].crossProductToPointsMagnitude(this.points[1], this.points[2]);
  }
  /**
   * Compute squared length of the triangle edge opposite the vertex with the given index.
   * @see [[edgeStartVertexIndexToOppositeVertexIndex]]
   */
  public edgeLengthSquared(oppositeVertexIndex: number): number {
    return this.edgeLength2[Geometry.cyclic3dAxis(oppositeVertexIndex)];
  }
  /**
   * Compute length of the triangle edge opposite the vertex with the given index.
   * @see [[edgeStartVertexIndexToOppositeVertexIndex]]
   */
  public edgeLength(oppositeVertexIndex: number): number {
    return Math.sqrt(this.edgeLengthSquared(oppositeVertexIndex));
  }
  /** Return area divided by sum of squared lengths. */
  public get aspectRatio(): number {
    return Geometry.safeDivideFraction(
      this.area, this.edgeLengthSquared(0) + this.edgeLengthSquared(1) + this.edgeLengthSquared(2), 0,
    );
  }
  /** Return the perimeter of the triangle. */
  public get perimeter(): number {
    return this.edgeLength(0) + this.edgeLength(1) + this.edgeLength(2);
  }
  /**
   * Return the unit normal of the triangle.
   * @param result optional pre-allocated vector to fill and return.
   * @returns unit normal, or undefined if cross product length is too small.
   */
  public normal(result?: Vector3d): Vector3d | undefined {
    const cross = this.points[0].crossProductToPoints(this.points[1], this.points[2], result);
    if (cross.tryNormalizeInPlace())
      return cross;
    return undefined;
  }
  /**
   * Sum the triangle points with given scales.
   * * If the scales sum to 1, they are barycentric coordinates, and hence the result point is in the plane of
   * the triangle. If all coordinates are non-negative then the result point is inside the triangle.
   * * If the scales do not sum to 1, the point is inside the triangle scaled (by the scale sum) from the origin.
   * @param b0 scale to apply to vertex 0
   * @param b1 scale to apply to vertex 1
   * @param b2 scale to apply to vertex 2
   * @param result optional pre-allocated point to fill and return
   * @return linear combination of the vertices of this triangle
   * @see [[pointToFraction]]
   */
  public fractionToPoint(b0: number, b1: number, b2: number, result?: Point3d): Point3d {
    // p = b0 * v0 + b1 * v1 + b2 * v2
    return Point3d.createAdd3Scaled(this.points[0], b0, this.points[1], b1, this.points[2], b2, result);
  }
  /**
   * Compute the projection of the given `point` onto the plane of this triangle.
   * @param point point p to project
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the projection point `P = d.world`:
   * * `d.isValid` returns true if and only if `this.normal()` is defined.
   * * `d.classify` can be used to determine where P lies with respect to the triangle.
   * * `d.a` is the signed projection distance: `P = p + a * this.normal()`.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/BarycentricTriangle
   * @see [[fractionToPoint]]
   */
  public pointToFraction(point: Point3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    const normal = BarycentricTriangle._workVector0 = this.normal(BarycentricTriangle._workVector0);
    if (undefined === normal)
      return TriangleLocationDetail.create(result);
    const ray = BarycentricTriangle._workRay = Ray3d.create(point, normal, BarycentricTriangle._workRay);
    return this.intersectRay3d(ray, result); // intersectRay3d is free to use workVector0
  }
  /** Convert from opposite-vertex to start-vertex edge indexing. */
  public static edgeOppositeVertexIndexToStartVertexIndex(edgeIndex: number): number {
    return Geometry.cyclic3dAxis(edgeIndex + 1);
  }
  /** Convert from start-vertex to opposite-vertex edge indexing. */
  public static edgeStartVertexIndexToOppositeVertexIndex(startVertexIndex: number): number {
    return Geometry.cyclic3dAxis(startVertexIndex - 1);
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies inside the triangle but not on an edge/vertex.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns whether the point with barycentric coordinates is strictly inside the triangle.
   */
  public static isInsideTriangle(b0: number, b1: number, b2: number): boolean {
    return b0 > 0 && b1 > 0 && b2 > 0;
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies inside the triangle or on an edge/vertex.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns whether the point with barycentric coordinates is inside or on the triangle.
   */
  public static isInsideOrOnTriangle(b0: number, b1: number, b2: number): boolean {
    return b0 >= 0 && b1 >= 0 && b2 >= 0;
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies outside an edge of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns edge index i (opposite vertex i) for which b_i < 0 and b_j >= 0, and b_k >= 0. Otherwise, returns -1.
   */
  private static isInRegionBeyondEdge(b0: number, b1: number, b2: number): number {
    // Note: the 3 regions (specified by the following if statements) are defined by extending the triangle
    // edges to infinity and not by perpendicular lines to the edges (which gives smaller regions)
    if (b0 < 0 && b1 >= 0 && b2 >= 0)
      return 0;
    if (b0 >= 0 && b1 < 0 && b2 >= 0)
      return 1;
    if (b0 >= 0 && b1 >= 0 && b2 < 0)
      return 2;
    return -1;
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies outside a vertex of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex i for which b_j < 0 and b_k < 0. Otherwise, returns -1.
   */
  private static isInRegionBeyondVertex(b0: number, b1: number, b2: number): number {
    // Note: the 3 regions (specified by the following if statements) are defined by extending the triangle
    // edges to infinity and not by perpendicular lines to the edges (which gives larger regions)
    if (b1 < 0 && b2 < 0)
      return 0;
    if (b0 < 0 && b2 < 0)
      return 1;
    if (b0 < 0 && b1 < 0)
      return 2;
    return -1;
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies on a vertex of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns index of vertex i for which b_i = 1 and b_j = b_k = 0. Otherwise, returns -1.
   */
  private static isOnVertex(b0: number, b1: number, b2: number): number {
    if (b0 === 1 && b1 === 0 && b2 === 0)
      return 0;
    if (b0 === 0 && b1 === 1 && b2 === 0)
      return 1;
    if (b0 === 0 && b1 === 0 && b2 === 1)
      return 2;
    return -1;
  }
  /**
   * Examine a point's barycentric coordinates to determine if it lies on a bounded edge of the triangle.
   * * No parametric tolerance is used.
   * * It is assumed b0 + b1 + b2 = 1.
   * @returns edge index i (opposite vertex i) for which b_i = 0, b_j > 0, and b_k > 0. Otherwise, returns -1.
   */
  private static isOnBoundedEdge(b0: number, b1: number, b2: number): number {
    if (b0 === 0 && b1 > 0 && b2 > 0)
      return 0;
    if (b0 > 0 && b1 === 0 && b2 > 0)
      return 1;
    if (b0 > 0 && b1 > 0 && b2 === 0)
      return 2;
    return -1;
  }
  /** @returns edge/vertex index (0,1,2) for which the function has a minimum value */
  private static indexOfMinimum(fn: (index: number) => number): number {
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
  /**
   * Compute the squared distance between two points given by their barycentric coordinates.
   * * It is assumed that a0 + a1 + a2 = b0 + b1 + b2 = 1.
   */
  public distanceSquared(a0: number, a1: number, a2: number, b0: number, b1: number, b2: number): number {
    // The barycentric displacement vector distance formula
    // More details can be found at https://web.evanchen.cc/handouts/bary/bary-full.pdf
    return -this.edgeLengthSquared(0) * (b1 - a1) * (b2 - a2)
      - this.edgeLengthSquared(1) * (b2 - a2) * (b0 - a0)
      - this.edgeLengthSquared(2) * (b0 - a0) * (b1 - a1);
  }
  /** Return the index of the closest triangle vertex to the point given by its barycentric coordinates. */
  public closestVertexIndex(b0: number, b1: number, b2: number): number {
    return BarycentricTriangle.indexOfMinimum((i: number) => {
      const a = BarycentricTriangle._workPoint = Point3d.createZero(BarycentricTriangle._workPoint);
      a.setAt(i, 1.0); // "a" is (1,0,0) or (0,1,0) or (0,0,1) so "a" represents vertex i
      return this.distanceSquared(a.x, a.y, a.z, b0, b1, b2); // distance between the point and vertex i
    });
  }
  /** Compute dot product of the edge vectors based at the vertex with the given index. */
  public dotProductOfEdgeVectorsAtVertex(baseVertexIndex: number): number {
    const i = Geometry.cyclic3dAxis(baseVertexIndex);
    const j = Geometry.cyclic3dAxis(i + 1);
    const k = Geometry.cyclic3dAxis(j + 1);
    return Geometry.dotProductXYZXYZ(
      this.points[j].x - this.points[i].x, this.points[j].y - this.points[i].y, this.points[j].z - this.points[i].z,
      this.points[k].x - this.points[i].x, this.points[k].y - this.points[i].y, this.points[k].z - this.points[i].z,
    );
  }
  /**
   * Compute the projection of barycentric point p onto the (unbounded) edge e_k(v_i,v_j) of the triangle T(v_i,v_j,v_k).
   * @param k vertex v_k is opposite the edge e_k
   * @param b barycentric coordinates of point to project
   * @returns parameter f along e_k, such that:
   * * the projection point is q = v_i + f * (v_j - v_i)
   * * the barycentric coords of the projection are q_ijk = (1 - f, f, 0)
   */
  private computeProjectionToEdge(k: number, b: number[]): number {
    /**
     * We know p = (b_i*v_i) + (b_j*v_j) + (b_k*v_k) and 1 = b_i + b_j + b_k.
     * Let U = v_j - v_i and V = v_k - v_i and P = p - v_i.
     * First we prove P = b_jU + b_kV.
     *       P = (b_i * v_i) + (b_j * v_j) + (b_k * v_k) - v_i
     *         = (b_i * v_i) + (b_j * (v_j-v_i)) + (b_j * v_i) + (b_k * (v_k-v_i)) + (b_k * v_i) - v_i
     *         = (b_i * v_i) + (b_j * U) + (b_j * v_i) + (b_k * V) + (b_k * v_i) - v_i
     *         = (b_j * U) + (b_k * V) + ((b_i + b_j + b_k) * v_i) - v_i
     *         = (b_j * U) + (b_k * V) + v_i - v_i
     *         = (b_j * U) + (b_k * V)
     * So we know p - v_i = b_jU + b_kV and q - v_i = fU
     * Therefore, 0 = (p - q).(v_j - v_i)
     *              = ((p-v_i) - (q-v_i)).(v_j - v_i)
     *              = (b_jU + b_kV - fU).U
     *              = b_jU.U + b_kU.V - fU.U
     * Thus f = b_j + b_k(U.V/U.U)
     */
    k = Geometry.cyclic3dAxis(k);
    const i = Geometry.cyclic3dAxis(k + 1);
    const j = Geometry.cyclic3dAxis(i + 1);
    return b[j] + b[k] * this.dotProductOfEdgeVectorsAtVertex(i) / this.edgeLengthSquared(k);
  }
  /**
   * Compute the projection of a barycentric point p to the triangle T(v_0,v_1,v_2).
   * @param b0 barycentric coordinate of p corresponding to v_0
   * @param b1 barycentric coordinate of p corresponding to v_1
   * @param b2 barycentric coordinate of p corresponding to v_2
   * @returns closest edge start vertex index i and projection parameter f such that the projection
   * q = v_i + f * (v_j - v_i).
   */
  public closestPoint(b0: number, b1: number, b2: number): { closestEdgeIndex: number, closestEdgeParam: number } {
    const b: number[] = [b0, b1, b2];
    let edgeIndex = -1;  // opposite-vertex index
    let edgeParam = 0.0;
    if (BarycentricTriangle.isInsideTriangle(b0, b1, b2)) { // projects to any edge
      edgeIndex = BarycentricTriangle.indexOfMinimum((i: number) => {
        // We want smallest projection distance d_i of p to e_i.
        // Since b_i=d_i|e_i|/2A we can compare quantities b_i/|e_i|.
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
  /**
   * Compute the intersection of a line (parameterized as a ray) with the plane of this triangle.
   * * This method is slower than `Ray3d.intersectionWithTriangle`.
   * @param ray infinite line to intersect, as a ray
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection point `d.world`:
   * * `d.a` is the intersection parameter along the ray.
   * * The line intersects the plane of the triangle if and only if `d.isValid` returns true.
   * * The ray intersects the plane of the triangle if and only if `d.isValid` returns true and `d.a` >= 0.
   * * The ray intersects the triangle if and only if `d.isValid` returns true, `d.a` >= 0, and `d.isInsideOrOn`
   * returns true.
   * * `d.classify` can be used to determine where the intersection lies with respect to the triangle.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/RayTriangleIntersection
   * @see [[pointToFraction]]
  */
  public intersectRay3d(ray: Ray3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    result = TriangleLocationDetail.create(result);
    /**
     * Let r0 = ray.origin and d = ray.direction. Write intersection point p two ways for unknown scalars s,b0,b1,b2:
     *         r0 + s*d = p = b0*v0 + b1*v1 + b2*v2
     * Subtract v0 from both ends, let u=v1-v0, v=v2-v0, c=r0-v0, and enforce b0+b1+b2=1:
     *              b1*u + b2*v - s*d = c
     * This is a linear system Mx = c where M has columns u,v,d and solution x=(b1,b2,-s).
     */
    const r0 = ray.origin;
    const d = ray.direction;
    const u = BarycentricTriangle._workVector0 = Vector3d.createStartEnd(
      this.points[0], this.points[1], BarycentricTriangle._workVector0,
    );
    const v = BarycentricTriangle._workVector1 = Vector3d.createStartEnd(
      this.points[0], this.points[2], BarycentricTriangle._workVector1,
    );
    const M = BarycentricTriangle._workMatrix = Matrix3d.createColumns(u, v, d, BarycentricTriangle._workMatrix);
    const c = Vector3d.createStartEnd(this.points[0], r0, BarycentricTriangle._workVector0);  // reuse workVector0
    const solution = BarycentricTriangle._workVector1;  // reuse workVector1
    if (undefined === M.multiplyInverse(c, solution))
      return result;  // invalid
    result.a = -solution.z; // = -(-s) = s
    ray.fractionToPoint(result.a, result.world);
    result.local.set(1.0 - solution.x - solution.y, solution.x, solution.y); // = (1 - b1 - b2, b1, b2) = (b0 , b1, b2)
    const proj = this.closestPoint(result.local.x, result.local.y, result.local.z);
    result.closestEdgeIndex = proj.closestEdgeIndex;
    result.closestEdgeParam = proj.closestEdgeParam;
    return result;
  }
  /**
   * Compute the intersection of a line (parameterized as a line segment) with the plane of this triangle.
   * @param point0 start point of segment on line to intersect
   * @param point1 end point of segment on line to intersect
   * @param result optional pre-allocated object to fill and return
   * @returns details d of the line-plane intersection point `d.world`:
   * * `d.isValid` returns true if and only if the line intersects the plane.
   * * `d.classify` can be used to determine where the intersection lies with respect to the triangle.
   * * `d.a` is the intersection parameter. If `d.a` is in [0,1], the segment intersects the plane of the triangle.
   * @see [[intersectRay3d]]
  */
  public intersectSegment(point0: Point3d, point1: Point3d, result?: TriangleLocationDetail): TriangleLocationDetail {
    BarycentricTriangle._workRay = Ray3d.createStartEnd(point0, point1, BarycentricTriangle._workRay);
    return this.intersectRay3d(BarycentricTriangle._workRay, result);
  }
  /**
   * Adjust the location to the closest edge of the triangle if within either given tolerance.
   * @param location details of a point in the plane of the triangle (note that `location.local` and
   * `location.world` possibly updated to lie on the triangle closest edge)
   * @param distanceTolerance absolute distance tolerance (or zero to ignore)
   * @param parameterTolerance barycentric coordinate fractional tolerance (or zero to ignore)
   * @return whether the location was adjusted
   */
  public snapLocationToEdge(
    location: TriangleLocationDetail,
    distanceTolerance: number = Geometry.smallMetricDistance,
    parameterTolerance: number = Geometry.smallFloatingPoint,
  ): boolean {
    if (!location.isValid)
      return false;
    // first try parametric tol to zero barycentric coordinate (no vertices or world distances used!)
    if (parameterTolerance > 0.0) {
      let numSnapped = 0;
      let newSum = 0.0;
      for (let i = 0; i < 3; i++) {
        const barycentricDist = Math.abs(location.local.at(i));
        if (barycentricDist > 0.0 && barycentricDist < parameterTolerance) {
          location.local.setAt(i, 0.0);
          numSnapped++;
        }
        newSum += location.local.at(i);
      }
      if (numSnapped > 0 && newSum > 0.0) {
        location.local.scaleInPlace(1.0 / newSum);
        if (1 === numSnapped) {
          location.closestEdgeIndex = BarycentricTriangle.edgeOppositeVertexIndexToStartVertexIndex(
            BarycentricTriangle.isOnBoundedEdge(location.local.x, location.local.y, location.local.z),
          );
          location.closestEdgeParam = 1.0 - location.local.at(location.closestEdgeIndex);
        } else {  // 2 snapped, at vertex
          location.closestEdgeIndex = BarycentricTriangle.isOnVertex(
            location.local.x, location.local.y, location.local.z,
          );
          location.closestEdgeParam = 0.0;
        }
        this.fractionToPoint(location.local.x, location.local.y, location.local.z, location.world);
        return true;
      }
    }
    // failing that, try distance tol to closest edge projection
    if (distanceTolerance > 0.0) {
      const i = location.closestEdgeIndex;
      const j = (i + 1) % 3;
      const k = (j + 1) % 3;
      const edgeProjection = BarycentricTriangle._workPoint = this.points[i].interpolate(
        location.closestEdgeParam, this.points[j], BarycentricTriangle._workPoint,
      );
      const dist = location.world.distance(edgeProjection);
      if (dist > 0.0 && dist < distanceTolerance) {
        location.local.setAt(i, 1.0 - location.closestEdgeParam);
        location.local.setAt(j, location.closestEdgeParam);
        location.local.setAt(k, 0.0);
        location.world.setFrom(edgeProjection);
        return true;
      }
    }
    return false;
  }
  /**
   * Return the dot product of the scaled normals of the two triangles.
   * * The sign of the return value is useful for determining the triangles' relative orientation:
   * positive (negative) means the normals point into the same (opposite) half-space determined by
   * one of the triangles' planes; zero means the triangles are perpendicular.
   */
  public dotProductOfCrossProductsFromOrigin(other: BarycentricTriangle): number {
    BarycentricTriangle._workVector0 = this.points[0].crossProductToPoints(
      this.points[1], this.points[2], BarycentricTriangle._workVector0,
    );
    BarycentricTriangle._workVector1 = other.points[0].crossProductToPoints(
      other.points[1], other.points[2], BarycentricTriangle._workVector1,
    );
    return BarycentricTriangle._workVector0.dotProduct(BarycentricTriangle._workVector1);
  }
  /** Return the centroid of the 3 points. */
  public centroid(result?: Point3d): Point3d {
    // Do the scale as true division (rather than multiply by precomputed 1/3). This might protect one bit of result.
    return Point3d.create(
      (this.points[0].x + this.points[1].x + this.points[2].x) / 3.0,
      (this.points[0].y + this.points[1].y + this.points[2].y) / 3.0,
      (this.points[0].z + this.points[1].z + this.points[2].z) / 3.0,
      result,
    );
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
  /** Test for point-by-point `isAlmostEqual` relationship. */
  public isAlmostEqual(other: BarycentricTriangle, tol?: number): boolean {
    return this.points[0].isAlmostEqual(other.points[0], tol)
      && this.points[1].isAlmostEqual(other.points[1], tol)
      && this.points[2].isAlmostEqual(other.points[2], tol);
  }
}
