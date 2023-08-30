/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { CurveCurveApproachType, CurveLocationDetail, CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { AxisOrder, BeJSONFunctions, Geometry } from "../Geometry";
import { SmallSystem } from "../numerics/Polynomials";
import { Matrix3d } from "./Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Vector2d } from "./Point2dVector2d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Range1d, Range3d } from "./Range";
import { Transform } from "./Transform";
import { XYAndZ } from "./XYZProps";

// cspell:word Cramer
/**
 * A Ray3d contains
 * * an `origin` point.
 * * a `direction` vector (The vector is not required to be normalized).
 * * an optional weight (number).
 * @public
 */
export class Ray3d implements BeJSONFunctions {
  /** The ray origin */
  public origin: Point3d;
  /** The ray direction. This is commonly (but not always) a unit vector. */
  public direction: Vector3d;
  /** Numeric annotation. */
  public a?: number; // optional (e.g. weight)
  private static _workVector0?: Vector3d;
  private static _workVector1?: Vector3d;
  private static _workVector2?: Vector3d;
  private static _workVector3?: Vector3d;
  private static _workVector4?: Vector3d;
  private static _workMatrix?: Matrix3d;
  // constructor (captures references)
  private constructor(origin: Point3d, direction: Vector3d) {
    this.origin = origin;
    this.direction = direction;
    this.a = undefined;
  }
  private static _create(x: number, y: number, z: number, u: number, v: number, w: number) {
    return new Ray3d(Point3d.create(x, y, z), Vector3d.create(u, v, w));
  }
  /** Create a ray on the x axis. */
  public static createXAxis(): Ray3d {
    return Ray3d._create(0, 0, 0, 1, 0, 0);
  }
  /** Create a ray on the y axis. */
  public static createYAxis(): Ray3d {
    return Ray3d._create(0, 0, 0, 0, 1, 0);
  }
  /** Create a ray on the z axis. */
  public static createZAxis(): Ray3d {
    return Ray3d._create(0, 0, 0, 0, 0, 1);
  }
  /** Create a ray with all zeros. */
  public static createZero(result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setZero();
      result.direction.setZero();
      return result;
    }
    return new Ray3d(Point3d.createZero(), Vector3d.createZero());
  }
  /**
   * Test for nearly equal Ray3d objects.
   * * This tests for near equality of origin and direction -- i.e. member-by-member comparison.
   * * Use [[isAlmostEqualPointSet]] to allow origins to be anywhere along the common ray and to have to allow the
   * directions to be scaled or opposing.
   */
  public isAlmostEqual(other: Ray3d): boolean {
    return this.origin.isAlmostEqual(other.origin) && this.direction.isAlmostEqual(other.direction);
  }
  /**
   * Return the dot product of the ray's direction vector with a vector from the ray origin
   * to the `spacePoint`.
   * * If the instance is the unit normal of a plane, then this method returns the (signed) altitude
   * of `spacePoint` with respect to the plane.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/ProjectVectorOnPlane
   */
  public dotProductToPoint(spacePoint: Point3d): number {
    return this.direction.dotProductStartEnd(this.origin, spacePoint);
  }
  /** Return the fractional coordinate (along the direction vector) of the `spacePoint` projected to the ray. */
  public pointToFraction(spacePoint: Point3d): number {
    return Geometry.safeDivideFraction(
      this.dotProductToPoint(spacePoint),
      this.direction.magnitudeSquared(),
      0,
    );
  }
  /** Return the `spacePoint` projected onto the ray. */
  public projectPointToRay(spacePoint: Point3d): Point3d {
    /**
     * To project a point to the ray, we can create a vector called "v" from ray origin to the spacePoint and project
     * that vector to the ray direction vector "r". The projection is "((v.r)/||r||^2) r" where "v.r" is the dot
     * product. Note that pointToFraction returns "(v.r)/||r||^2".
     * Note: If r is the normal of a plane, then projection length "(v.r)/||r||" is the signed altitude of the
     * spacePoint with respect to the plane.
     */
    return this.origin.plusScaled(this.direction, this.pointToFraction(spacePoint));
  }
  /**
   * Test for nearly equal rays, allowing origin float and direction scaling.
   * * Use [[isAlmostEqual]] to require member-by-member comparison.
   */
  public isAlmostEqualPointSet(other: Ray3d): boolean {
    /**
     * This function tests two rays to determine if they define the same infinite lines.
     * So the origins can be different as long as they are on the infinite line (they can
     * "float") but the directions must be parallel or antiparallel.
     */
    if (!this.direction.isParallelTo(other.direction, true))
      return false;
    /**
     * In exact math, we consider a ray to have an infinite line as direction (not a finite vector).
     * Therefore, in exact math it is not possible for one origin to be on the other ray but not vice
     * versa. However, we test both ways because first check may pass due to round-off errors.
     */
    let workPoint = this.projectPointToRay(other.origin);
    if (!other.origin.isAlmostEqualMetric(workPoint))
      return false;
    workPoint = other.projectPointToRay(this.origin);
    if (!this.origin.isAlmostEqualMetric(workPoint))
      return false;
    return true;
  }
  /** Create a ray from origin and direction. */
  public static create(origin: Point3d, direction: Vector3d, result?: Ray3d): Ray3d {
    if (result) {
      result.set(origin, direction);
      return result;
    }
    return new Ray3d(origin.clone(), direction.clone());
  }
  /**
   * Given a homogeneous point and its derivative components, construct a Ray3d with cartesian
   * coordinates and derivatives.
   * @param weightedPoint `[x,y,z,w]` parts of weighted point.
   * @param weightedDerivative `[x,y,z,w]` derivatives
   * @param result
   */
  public static createWeightedDerivative(
    weightedPoint: Float64Array, weightedDerivative: Float64Array, result?: Ray3d,
  ): Ray3d | undefined {
    const w = weightedPoint[3];
    const dw = weightedDerivative[3];
    const x = weightedPoint[0];
    const y = weightedPoint[1];
    const z = weightedPoint[2];
    const dx = weightedDerivative[0] * w - weightedPoint[0] * dw;
    const dy = weightedDerivative[1] * w - weightedPoint[1] * dw;
    const dz = weightedDerivative[2] * w - weightedPoint[2] * dw;
    if (Geometry.isSmallMetricDistance(w))
      return undefined;
    const divW = 1.0 / w;
    const divWW = divW * divW;
    return Ray3d.createXYZUVW(
      x * divW, y * divW, z * divW,
      dx * divWW, dy * divWW, dz * divWW,
      result,
    );
  }
  /** Create from coordinates of the origin and direction. */
  public static createXYZUVW(
    originX: number, originY: number, originZ: number,
    directionX: number, directionY: number, directionZ: number,
    result?: Ray3d,
  ): Ray3d {
    if (result) {
      result.getOriginRef().set(originX, originY, originZ);
      result.getDirectionRef().set(directionX, directionY, directionZ);
      return result;
    }
    return new Ray3d(Point3d.create(originX, originY, originZ), Vector3d.create(directionX, directionY, directionZ));
  }
  /** Capture origin and direction in a new Ray3d. */
  public static createCapture(origin: Point3d, direction: Vector3d): Ray3d {
    return new Ray3d(origin, direction);
  }
  /** Create from (clones of) origin, direction, and numeric weight. */
  public static createPointVectorNumber(origin: Point3d, direction: Vector3d, a: number, result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setFrom(origin);
      result.direction.setFrom(direction);
      result.a = a;
      return result;
    }
    result = new Ray3d(origin.clone(), direction.clone());
    result.a = a;
    return result;
  }
  /** Create from origin and target. The direction vector is the full length (non-unit) vector from origin to target. */
  public static createStartEnd(origin: Point3d, target: Point3d, result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setFrom(origin);
      result.direction.setStartEnd(origin, target);
      return result;
    }
    return new Ray3d(origin.clone(), Vector3d.createStartEnd(origin, target));
  }
  /** Return a reference to the ray's origin. */
  public getOriginRef(): Point3d {
    return this.origin;
  }
  /** Return a reference to the ray's direction vector. */
  public getDirectionRef(): Vector3d {
    return this.direction;
  }
  /** Copy coordinates from origin and direction. */
  public set(origin: Point3d, direction: Vector3d): void {
    this.origin.setFrom(origin);
    this.direction.setFrom(direction);
  }
  /** Clone the ray. */
  public clone(result?: Ray3d): Ray3d {
    if (result) {
      result.set(this.origin.clone(), this.direction.clone());
      return result;
    }
    return new Ray3d(this.origin.clone(), this.direction.clone());
  }
  /** Return a clone of the transformed instance */
  public cloneTransformed(transform: Transform, result?: Ray3d): Ray3d {
    return Ray3d.create(
      transform.multiplyPoint3d(this.origin, result?.origin),
      transform.multiplyVector(this.direction, result?.direction),
      result,
    );
  }
  /** Create a clone and return the inverse transform of the clone. */
  public cloneInverseTransformed(transform: Transform, result?: Ray3d): Ray3d | undefined {
    if (!transform.computeCachedInverse(true))
      return undefined;
    return Ray3d.create(
      transform.multiplyInversePoint3d(this.origin, result?.origin)!,
      transform.matrix.multiplyInverseXYZAsVector3d(
        this.direction.x, this.direction.y, this.direction.z, result?.direction,
      )!,
      result,
    );
  }
  /** Apply a transform in place. */
  public transformInPlace(transform: Transform) {
    transform.multiplyPoint3d(this.origin, this.origin);
    transform.multiplyVector(this.direction, this.direction);
  }
  /** Copy data from another ray. */
  public setFrom(source: Ray3d): void {
    this.set(source.origin, source.direction);
  }
  /**
   * Return a point at fractional position along the ray.
   * * fraction 0 is the ray origin.
   * * fraction 1 is at the end of the direction vector when placed at the origin.
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return this.origin.plusScaled(this.direction, fraction, result);
  }
  /**
   * Return a transform for rigid axes at ray origin with z in ray direction.
   * * If the direction vector is zero, axes default to identity (from [[Matrix3d.createRigidHeadsUp]])
   */
  public toRigidZFrame(result?: Transform): Transform | undefined {
    const axes = Ray3d._workMatrix = Matrix3d.createRigidHeadsUp(this.direction, AxisOrder.ZXY, Ray3d._workMatrix);
    return Transform.createOriginAndMatrix(this.origin, axes, result);
  }
  /** Convert {origin:[x,y,z], direction:[u,v,w]} to a Ray3d. */
  public setFromJSON(json?: any) {
    if (!json) {
      this.origin.set(0, 0, 0);
      this.direction.set(0, 0, 1);
      return;
    }
    this.origin.setFromJSON(json.origin);
    this.direction.setFromJSON(json.direction);
  }
  /**
   * Construct a JSON object from this Ray3d.
   * @return {*} [origin,normal]
   */
  public toJSON(): any {
    return { origin: this.origin.toJSON(), direction: this.direction.toJSON() };
  }
  /** Create a new ray from json object. See `setFromJSON` for json structure; */
  public static fromJSON(json?: any) {
    const result = Ray3d.createXAxis();
    result.setFromJSON(json);
    return result;
  }
  /**
   * Try to scale the direction vector to a given `magnitude`.
   * * Returns `false` if the ray direction is a zero vector.
   */
  public trySetDirectionMagnitudeInPlace(magnitude: number = 1.0): boolean {
    if (this.direction.tryNormalizeInPlace()) {
      this.direction.scaleInPlace(magnitude);
      return true;
    }
    this.direction.setZero();
    this.a = 0.0;
    return false;
  }
  /**
   * Normalize the ray direction in place.
   * * If parameter `a` is clearly nonzero and the direction vector can be normalized,
   *    * Save the parameter `a` as the optional `a` member of the ray.
   *    * Normalize the ray's direction vector.
   * * If parameter `a` is nearly zero,
   *    * Set the `a` member to zero.
   *    * Set the ray's direction vector to zero.
   * @param a value to be saved (e.g,. area).
   * @returns `true` if `a` is nonzero and normalization was successful. Otherwise, return `false`.
   */
  public tryNormalizeInPlaceWithAreaWeight(a: number): boolean {
    const tolerance = Geometry.smallMetricDistanceSquared;
    this.a = a;
    if (Math.abs(a) > tolerance && this.direction.tryNormalizeInPlace(tolerance))
      return true;
    this.direction.setZero();
    this.a = 0.0;
    return false;
  }
  /** Return distance from the ray to point in space. */
  public distance(spacePoint: Point3d): number {
    const uu = this.direction.magnitudeSquared();
    const uv = this.dotProductToPoint(spacePoint);
    const aa = Geometry.inverseMetricDistanceSquared(uu);
    if (aa)
      return Math.sqrt(this.origin.distanceSquared(spacePoint) - uv * uv * aa);
    else
      return Math.sqrt(this.origin.distanceSquared(spacePoint));
  }
  /**
   * Return the intersection parameter of the line defined by the ray with a `plane`.
   * * Stores the point of intersection in the `result` point (if passed as a parameter) and returns the parameter
   * along the ray where the intersection occurs. If we call the parameter 'f' then the point of intersection would
   * be `ray.origin + f * ray.direction`. Therefore:
   *    * if ray intersects the plane at its origin, the function returns f = 0.
   *    * if intersects at `ray.origin + ray.direction`, the function returns f = 1.
   *    * if intersects behind the ray origin, the function returns f < 0.
   *    * if intersects after `ray.origin + ray.direction`, the function returns f > 1.
   * * Returns `undefined` if the ray and plane are parallel or coplanar.
   */
  public intersectionWithPlane(plane: Plane3dByOriginAndUnitNormal, result?: Point3d): number | undefined {
    const vectorA = Vector3d.createStartEnd(plane.getOriginRef(), this.origin);
    const uDotN = this.direction.dotProduct(plane.getNormalRef());
    const nDotN = this.direction.magnitudeSquared();
    const aDotN = vectorA.dotProduct(plane.getNormalRef());
    const division = Geometry.conditionalDivideFraction(-aDotN, uDotN);
    if (undefined === division)
      return undefined;
    const division1 = Geometry.conditionalDivideFraction(nDotN, uDotN);
    if (undefined === division1)
      return undefined;
    if (result) {
      this.origin.plusScaled(this.direction, division, result);
    }
    return division;
  }
  /**
   * Find the intersection of the line defined by the ray with a Range3d.
   * * Return the range of parameters (on the ray) which are "inside" the range.
   * * Note that a range is always returned; if there is no intersection it is indicated by the test `result.isNull`.
   */
  public intersectionWithRange3d(range: Range3d, result?: Range1d): Range1d {
    if (range.isNull)
      return Range1d.createNull(result);
    const interval = Range1d.createXX(-Geometry.largeCoordinateResult, Geometry.largeCoordinateResult, result);
    if (interval.clipLinearMapToInterval(this.origin.x, this.direction.x, range.low.x, range.high.x)
      && interval.clipLinearMapToInterval(this.origin.y, this.direction.y, range.low.y, range.high.y)
      && interval.clipLinearMapToInterval(this.origin.z, this.direction.z, range.low.z, range.high.z)
    )
      return interval;
    return interval;
  }
  /**
   * Compute the intersection of the ray with a triangle.
   * * This method is faster than `BarycentricTriangle.intersectRay3d`.
   * @param vertex0 first vertex of the triangle
   * @param vertex1 second vertex of the triangle
   * @param vertex2 third vertex of the triangle
   * @param distanceTol optional tolerance used to check if ray is parallel to the triangle or if we have line
   * intersection but not ray intersection (if tolerance is not provided, Geometry.smallMetricDistance is used)
   * @param parameterTol optional tolerance used to snap barycentric coordinates of the intersection point to
   * a triangle edge or vertex (if tolerance is not provided, Geometry.smallFloatingPoint is used)
   * @param result optional pre-allocated object to fill and return
   * @returns the intersection point if ray intersects the triangle. Otherwise, return undefined.
  */
  public intersectionWithTriangle(
    vertex0: Point3d, vertex1: Point3d, vertex2: Point3d, distanceTol?: number, parameterTol?: number, result?: Point3d,
  ): Point3d | undefined {
    /**
     * Suppose ray is shown by "rayOrigin + t*rayVector" and barycentric coordinate of point
     * P = w*v0 + u*v1 + v*v2 = (1-u-v)*v0 + u*v1 + v*v2 = v0 + u*(v1-v0) + v*(v2-v0)
     *
     * Then if ray intersects triangle at a point we have
     * v0 + u*(v1-v0) + v*(v2-v0) = rayOrigin + t*rayVector
     * or
     * -t*rayVector + u*(v1-v0) + v*(v2-v0) = rayOrigin - v0
     *
     * This equation can be reformulated as the following linear system:
     *
     * [    |          |      |  ] [t]   [      |       ]
     * [-rayVector  v1-v0   v2-v0] [u] = [rayOrigin - v0]
     * [   |          |      |   ] [v]   [      |       ]
     *
     * Then to find t, u, and v use Cramer's Rule and also the fact that if matrix A = [c1,c2,c3], then
     * det(A) = c1.(c2 x c3) which leads to
     *
     * t = [(rayOrigin - v0).((v1-v0) x (v2-v0))] / [-rayVector.((v1-v0) x (v2-v0))]
     * u = [-rayVector.((rayOrigin - v0) x (v2-v0))] / [-rayVector.((v1-v0) x (v2-v0))]
     * v = [-rayVector.((v1-v0) x (rayOrigin - v0))] / [-rayVector.((v1-v0) x (v2-v0))]
     *
     * Now note that swapping any 2 vectors c_i and c_j in formula c1.(c2 x c3) negates it. For example:
     * c1.(c2 x c3) = -c3.(c2 x c1) = c2.(c3 x c1)
     *
     * This leads to the final formulas used in the following code:
     * t = [(v2-v0).((rayOrigin - v0) x (v1-v0))] / [(v1-v0).(rayVector x (v2-v0))]
     * u = [(rayOrigin - v0).(rayVector x (v2-v0))] / [(v1-v0).(rayVector x (v2-v0))]
     * v = [-rayVector.((rayOrigin - v0) x (v1-v0))] / [(v1-v0).(rayVector x (v2-v0))]
     *
     * Note that we should verify 0 <= u,v,w <= 1. To do so we only need to check 0 <= u <= 1, 0 <= v, and u+v <= 1.
     * That's because w = 1-(u+v) and if we have those 4 checks, it's guaranteed that v <= 1 and 0 <= u+v and so
     * 0 <= w <= 1.
     *
     * More info be found at
     * https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
     */
    if (distanceTol === undefined || distanceTol < 0) // we explicitly allow zero tolerance
      distanceTol = Geometry.smallMetricDistance;
    if (parameterTol === undefined || parameterTol < 0) // we explicitly allow zero tolerance
      parameterTol = Geometry.smallFloatingPoint;
    const edge1 = Ray3d._workVector0 = Vector3d.createStartEnd(vertex0, vertex1, Ray3d._workVector0);
    const edge2 = Ray3d._workVector1 = Vector3d.createStartEnd(vertex0, vertex2, Ray3d._workVector1);
    const h = Ray3d._workVector2 = this.direction.crossProduct(edge2, Ray3d._workVector2);
    const a = edge1.dotProduct(h);
    if (a >= -distanceTol && a <= distanceTol)
      return undefined; // ray is parallel to the triangle (includes coplanar case)
    const f = 1.0 / a;
    const s = Ray3d._workVector3 = Vector3d.createStartEnd(vertex0, this.origin, Ray3d._workVector3);
    let u = f * s.dotProduct(h);
    if (u < 0.0) {
      if (u > -parameterTol)
        u = 0.0;
      else
        return undefined; // ray does not intersect the triangle
    } else if (u > 1.0) {
      if (u < 1.0 + parameterTol)
        u = 1.0;
      else
        return undefined; // ray does not intersect the triangle
    }
    const q = Ray3d._workVector4 = s.crossProduct(edge1, Ray3d._workVector4);
    let v = f * this.direction.dotProduct(q);
    if (v < 0.0) {
      if (v > -parameterTol)
        v = 0.0;
      else
        return undefined;  // ray does not intersect the triangle
    } else if (u + v > 1.0) {
      if (u + v < 1.0 + parameterTol)
        v = 1.0 - u;
      else
        return undefined;  // ray does not intersect the triangle
    }
    // at this stage, we know the line (parameterized as the ray) intersects the triangle
    const t = f * edge2.dotProduct(q);
    if (t <= distanceTol) // line intersection but not ray intersection
      return undefined;
    return this.origin.plusScaled(this.direction, t, result); // ray intersection
  }
  /**
   * Return the shortest vector `v` to `targetPoint` from the line defined by this ray.
   * * If the projection of `targetPoint` onto the line defined by this ray is q, then `v  = targetPoint - q`.
   */
  public perpendicularPartOfVectorToTarget(targetPoint: XYAndZ, result?: Vector3d): Vector3d {
    const vectorV = Vector3d.createStartEnd(this.origin, targetPoint);
    const uu = this.direction.magnitudeSquared();
    const uv = this.direction.dotProductStartEnd(this.origin, targetPoint);
    const fraction = Geometry.safeDivideFraction(uv, uu, 0.0);
    return vectorV.plusScaled(this.direction, -fraction, result);
  }
  /**
   * Determine if two rays intersect, or are fully overlapped, or parallel but not coincident, or skew.
   * * Return a CurveLocationDetailPair which contains fraction and point on each ray and has
   * annotation (in member `approachType`) indicating one of these relationships:
   *   * CurveCurveApproachType.Intersection -- the rays have a simple intersection, at fractions indicated
   * in detailA and detailB
   *   * CurveCurveApproachType.PerpendicularChord -- there is pair of where the rays have closest approach.
   * The rays are skew in space.
   *   * CurveCurveApproachType.CoincidentGeometry -- the rays are the same unbounded line in space. The
   * fractions and points are a representative single common point.
   *   * CurveCurveApproachType.Parallel -- the rays are parallel (and not coincident). The two points are
   * at the minimum distance
   */
  public static closestApproachRay3dRay3d(rayA: Ray3d, rayB: Ray3d): CurveLocationDetailPair {
    const intersectionFractions = Vector2d.create();
    let fractionA, fractionB;
    let pointA, pointB;
    let pairType;
    if (
      SmallSystem.ray3dXYZUVWClosestApproachUnbounded(
        rayA.origin.x, rayA.origin.y, rayA.origin.z, rayA.direction.x, rayA.direction.y, rayA.direction.z,
        rayB.origin.x, rayB.origin.y, rayB.origin.z, rayB.direction.x, rayB.direction.y, rayB.direction.z,
        intersectionFractions,
      )
    ) {
      fractionA = intersectionFractions.x;
      fractionB = intersectionFractions.y;
      pointA = rayA.fractionToPoint(fractionA);
      pointB = rayB.fractionToPoint(fractionB);
      pairType = pointA.isAlmostEqualMetric(pointB) ?
        CurveCurveApproachType.Intersection : CurveCurveApproachType.PerpendicularChord;
    } else {
      fractionB = 0.0;
      fractionA = rayA.pointToFraction(rayB.origin);
      pointA = rayA.fractionToPoint(fractionA);
      pointB = rayB.fractionToPoint(fractionB);
      pairType = pointA.isAlmostEqualMetric(pointB) ?
        CurveCurveApproachType.CoincidentGeometry : CurveCurveApproachType.ParallelGeometry;
    }
    const pair = CurveLocationDetailPair.createCapture(
      CurveLocationDetail.createRayFractionPoint(rayA, fractionA, rayA.fractionToPoint(fractionA)),
      CurveLocationDetail.createRayFractionPoint(rayB, fractionB, rayB.fractionToPoint(fractionB)));
    pair.approachType = pairType;
    return pair;
  }
  /**
   * Return a ray with `ray.origin` interpolated between `pt1` and `pt2` at the given `fraction`
   * and `ray.direction` set to the vector from `pt1` to `pt2` multiplied by the given `tangentScale`.
   * @param pt1 start point of the interpolation.
   * @param fraction fractional position between points.
   * @param pt2 end point of the interpolation.
   * @param tangentScale scale factor to apply to the startToEnd vector.
   * @param result optional receiver.
   */
  public static interpolatePointAndTangent(
    pt1: XYAndZ, fraction: number, pt2: XYAndZ, tangentScale: number, result?: Ray3d,
  ): Ray3d {
    result = result ?? Ray3d.createZero();
    const dx = pt2.x - pt1.x;
    const dy = pt2.y - pt1.y;
    const dz = pt2.z - pt1.z;
    result.direction.set(tangentScale * dx, tangentScale * dy, tangentScale * dz);
    if (fraction <= 0.5)
      result.origin.set(pt1.x + fraction * dx, pt1.y + fraction * dy, pt1.z + fraction * dz);
    else {
      const t: number = fraction - 1.0;
      result.origin.set(pt2.x + t * dx, pt2.y + t * dy, pt2.z + t * dz);
    }
    return result;
  }
}
