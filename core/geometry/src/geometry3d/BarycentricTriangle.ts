/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";
import { Matrix3d } from "./Matrix3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";

/** Enumeration of locations of a point in the plane of a triangle.
 * @public
 */
export enum TriangleLocation {
  /** No location specified. */
  Invalid = 0,
  /** Point is at a vertex. */
  OnVertex = 1,
  /** Point is on an edge (but not a vertex). */
  OnEdgeInterior = 2,
  /** Point is strictly inside the triangle. */
  StrictlyInside = 3,
  /** Point is strictly outside the triangle. */
  StrictlyOutside = 4,
}

/**
 * Carries data about a point in the plane of a triangle.
 * Each instance carries both world and barycentric coordinates for the point, and provides query services on the latter.
 *
 * Properties of the barycentric coordinates (b0, b1, b2) of a point p in the plane of a triangle T with vertices p0, p1, p2:
 * * 1 = b0 + b1 + b2
 * * p = b0 * p0 + b1 * p1 + b2 * p2
 * * The coordinates are all nonnegative if and only if p is inside or on T.
 * * Exactly one coordinate is zero if and only if p lies on an (infinitely extended) edge of T.
 * * Exactly two coordinates are zero if and only if p coincides with a vertex of T.
 * @public
 */
export class TriangleLocationDetail {
  /** The Cartesian coordinates of the point. */
  public world: Point3d;
  /** The barycentric coordinates of the point with respect to the triangle. */
  public local: Point3d;
  /** Application-specific number */
  public a: number;

  private constructor() {
    this.world = new Point3d();
    this.local = new Point3d();
    this.a = 0.0;
  }

  /** Create an invalid detail with all zeroes.
   * @param result optional pre-allocated object to fill and return
   */
  public static createInvalid(result?: TriangleLocationDetail): TriangleLocationDetail {
    return this.create(0, 0, 0, 0, 0, undefined, result);
  }

  /**
   * Populate the detail from a point's Cartesian and barycentric coordinates.
   * * The point p in the plane of the triangle T(p0,p1,p2) has the barycentric formulation p = (1-b1-b2) * p0 + b1 * p1 + b2 * p2.
   * * If T is spanned by the vectors U=p1-p0 and V=p2-p0, then the vector P=p-p0 can be written P = b1 * U + b2 * V.
   * @param x x-coordinate of p
   * @param y y-coordinate of p
   * @param z z-coordinate of p
   * @param b1 barycentric coordinate of p corresponding to p1
   * @param b2 barycentric coordinate of p corresponding to p2
   * @param a optional application-specific number
   * @param result optional pre-allocated object to fill and return
   */
  public static create(x: number, y: number, z: number, b1: number, b2: number, a?: number, result?: TriangleLocationDetail): TriangleLocationDetail {
    if (undefined === result)
      result = new TriangleLocationDetail();
    result.world.set(x, y, z);
    result.local.set(1.0 - b1 - b2, b1, b2);
    if (undefined !== a)
      result.a = a;
    return result;
  }

  /** Whether the barycentric coordinates sum to 1.
   * @param paramTol optional tolerance for comparing barycentric coordinates. Not a distance!
   */
  public isValid(paramTol: number = Geometry.smallFraction): boolean {
    return Math.abs(this.local.x + this.local.y + this.local.z - 1.0) <= Math.abs(paramTol);
  }

  /** Queries the barycentric coordinates to determine whether this instance specifies a location inside or on the triangle.
   * @param paramTol optional tolerance for comparing barycentric coordinates. Not a distance!
   * @see classify
   */
  public isInsideOrOn(paramTol: number = Geometry.smallFraction): boolean {
    const code = this.classify(paramTol);
    return code === TriangleLocation.OnVertex || code === TriangleLocation.OnEdgeInterior || code === TriangleLocation.StrictlyInside;
  }

  /** Queries the barycentric coordinates to classify the location of this instance with respect to the triangle.
   * @param paramTol optional tolerance for comparing barycentric coordinates. Not a distance!
   * @returns classification code, cf. TriangleLocation enum
   * @see isInsideOrOn
   */
  public classify(paramTol: number = Geometry.smallFraction): number {
    if (!this.isValid(paramTol))
      return TriangleLocation.Invalid;
    const absTol = Math.abs(paramTol);
    const min = -absTol;
    const max = 1.0 + absTol;
    if (this.local.x >= min && this.local.y >= min && this.local.z >= min &&
        this.local.x <= max && this.local.y <= max && this.local.z <= max) {
      // inside or on triangle
      let nZero = 0;
      if (Math.abs(this.local.x) <= absTol)
        ++nZero;
      if (Math.abs(this.local.y) <= absTol)
        ++nZero;
      if (Math.abs(this.local.z) <= absTol)
        ++nZero;
      if (2 === nZero)
        return TriangleLocation.OnVertex;
      if (1 === nZero)
        return TriangleLocation.OnEdgeInterior;
      return TriangleLocation.StrictlyInside;
    }
    return TriangleLocation.StrictlyOutside;
  }
}

/**
 * 3 points defining a triangle to be evaluated with barycentric coordinates.
 * @public
 */
export class BarycentricTriangle {
  /** Array of 3 point coordinates for the triangle. */
  public points: Point3d[];
  /** Constructor.
   * * Point references are CAPTURED
   */
  protected constructor(point0: Point3d, point1: Point3d, point2: Point3d) {
    this.points = [];
    this.points.push(point0);
    this.points.push(point1);
    this.points.push(point2);
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
    return Geometry.safeDivideFraction(0.5 * this.points[0].crossProductToPointsMagnitude(this.points[1], this.points[2]),
      (this.points[0].distanceSquared(this.points[1]) + this.points[1].distanceSquared(this.points[2]) + this.points[2].distanceSquared(this.points[0])), 0);
  }
  /** Return the area of the triangle. */
  public get area(): number {
    return 0.5 * this.points[0].crossProductToPointsMagnitude(this.points[1], this.points[2]);
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
      return TriangleLocationDetail.createInvalid(result);
    const ray = Ray3d.create(point, BarycentricTriangle._workVector0);
    return this.intersectRay3d(ray, result);
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
      return TriangleLocationDetail.createInvalid(result);
    const s = -solution.z;
    const p = BarycentricTriangle._workPoint = ray.fractionToPoint(s, BarycentricTriangle._workPoint);
    return TriangleLocationDetail.create(p.x, p.y, p.z, solution.x, solution.y, s, result);
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
}
