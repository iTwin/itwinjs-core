/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { SmallSystem } from "../numerics/Polynomials";
import { AxisOrder, BeJSONFunctions, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";
import { Transform } from "./Transform";
import { XAndY } from "./XYZProps";
import { Point3dPoint3d } from "./Point3dPoint3d";

/**
 * A plane defined by
 *
 * * Any point on the plane.
 * * a unit normal.
 * @public
 */
export class Plane3dByOriginAndUnitNormal implements BeJSONFunctions, PlaneAltitudeEvaluator {
  private _origin: Point3d;
  private _normal: Vector3d;
  // constructor captures references !!!
  private constructor(origin: Point3d, normal: Vector3d) {
    this._origin = origin;
    this._normal = normal;
  }
  // This is private because it does not check validity of the unit vector.
  private static _create(x: number, y: number, z: number, u: number, v: number, w: number) {
    return new Plane3dByOriginAndUnitNormal(Point3d.create(x, y, z), Vector3d.create(u, v, w));
  }
  /**
   * Create a plane parallel to the XY plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createXYPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 0, 0, 1);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 0, 0, 1);
  }
  /**
   * Create a plane parallel to the YZ plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createYZPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 1, 0, 0);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 1, 0, 0);
  }
  /**
   * Create a plane parallel to the ZX plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createZXPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 0, 1, 0);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 0, 1, 0);
  }
  /** create a new  Plane3dByOriginAndUnitNormal with given origin and normal.
   * * The inputs are NOT captured.
   * * Returns undefined if the normal vector is all zeros.
   */
  public static create(origin: Point3d, normal: Vector3d, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const normalized = normal.normalize();
    if (!normalized)
      return undefined;
    if (result) {
      result.set(origin, normalized);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(origin.clone(), normalized);
  }
  /** create a new  Plane3dByOriginAndUnitNormal with direct coordinates of origin and normal.
   * * Returns undefined if the normal vector is all zeros.
   * * If unable to normalize return undefined. (And if result is given it is left unchanged)
   */
  public static createXYZUVW(ax: number, ay: number, az: number, ux: number, uy: number, uz: number, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const magU = Geometry.hypotenuseXYZ(ux, uy, uz);
    if (magU < Geometry.smallMetricDistance)
      return undefined;
    if (result) {
      result._origin.set(ax, ay, az);
      result._normal.set(ux / magU, uy / magU, uz / magU);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(Point3d.create(ax, ay, az), Vector3d.create(ux / magU, uy / magU, uz / magU));
  }
  /** create a new  Plane3dByOriginAndUnitNormal with unit normal (a) in the xy plane (b) perpendicular to the line defined by xy parts of origin to target.
   * * origin and normal both have z = 0.
   * * The inputs are NOT captured.
   * * Returns undefined if the normal vector is all zeros.
   */
  public static createOriginAndTargetXY(origin: XAndY, target: XAndY, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const ux = target.x - origin.x;
    const uy = target.y - origin.y;
    return this.createXYZUVW(origin.x, origin.y, 0.0, uy, -ux, 0.0, result);
  }

  /** create a new  Plane3dByOriginAndUnitNormal with xy origin (at z=0) and normal angle in xy plane.
   * * Returns undefined if the normal vector is all zeros.
   */
  public static createXYAngle(x: number, y: number, normalAngleFromX: Angle, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal {
    if (result) {
      result._origin.set(x, y, 0.0);
      result._normal.set(normalAngleFromX.cos(), normalAngleFromX.sin(), 0.0);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(Point3d.create(x, y, 0), Vector3d.create(normalAngleFromX.cos(), normalAngleFromX.sin()));
  }

  /** Create a plane defined by two points and an in-plane vector.
   * @param pointA any point in the plane
   * @param pointB any other point in the plane
   * @param vector any vector in the plane but not parallel to the vector from pointA to pointB
   */
  public static createPointPointVectorInPlane(pointA: Point3d, pointB: Point3d, vector: Vector3d): Plane3dByOriginAndUnitNormal | undefined {
    const cross = vector.crossProductStartEnd(pointA, pointB);
    if (cross.tryNormalizeInPlace())
      return new Plane3dByOriginAndUnitNormal(pointA, cross);
    return undefined;
  }

  /** test for (toleranced) equality with `other` */
  public isAlmostEqual(other: Plane3dByOriginAndUnitNormal): boolean {
    return this._origin.isAlmostEqual(other._origin) && this._normal.isAlmostEqual(other._normal);
  }
  /** Parse a json fragment `{origin: [x,y,z], normal: [ux,uy,uz]}`  */
  public setFromJSON(json?: any) {
    if (!json) {
      this._origin.set(0, 0, 0);
      this._normal.set(0, 0, 1);
    } else {
      this._origin.setFromJSON(json.origin);
      this._normal.setFromJSON(json.normal);
    }
  }
  /**
   * Convert to a JSON object.
   * @return {*} [origin,normal]
   */
  public toJSON(): any { return { origin: this._origin.toJSON(), normal: this._normal.toJSON() }; }
  /**  create a new Plane3dByOriginAndUnitNormal from json fragment.
   * * See `Plane3dByOriginAndUnitNormal.setFromJSON`
   */
  public static fromJSON(json?: any): Plane3dByOriginAndUnitNormal {
    const result = Plane3dByOriginAndUnitNormal.createXYPlane();
    result.setFromJSON(json);
    return result;
  }
  /** Return a reference to the origin. */
  public getOriginRef(): Point3d { return this._origin; }
  /** Return a reference to the unit normal. */
  public getNormalRef(): Vector3d { return this._normal; }

  /** Return coordinate axes (as a transform) with
   * * origin at plane origin
   * * z axis in direction of plane normal.
   * * x,y axes in plane.
   */
  public getLocalToWorld(): Transform {
    const axes = Matrix3d.createRigidHeadsUp(this._normal, AxisOrder.ZXY);
    return Transform.createRefs(this._origin.clone(), axes);
  }
  /** Return a (singular) transform which projects points to this plane.
   */
  public getProjectionToPlane(): Transform {
    const axes = Matrix3d.createIdentity();
    axes.addScaledOuterProductInPlace(this._normal, this._normal, -1.0);
    axes.markSingular();
    return Transform.createFixedPointAndMatrix(this._origin, axes);
  }

  /** Copy coordinates from the given origin and normal. */
  public set(origin: Point3d, normal: Vector3d): void {
    this._origin.setFrom(origin);
    this._normal.setFrom(normal);
  }
  /** return a deep clone (point and normal cloned) */
  public clone(result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal {
    if (result) {
      result.set(this._origin, this._normal);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(this._origin.clone(), this._normal.clone());
  }
  /** Create a clone and return the transform of the clone. */
  public cloneTransformed(transform: Transform, inverse: boolean = false): Plane3dByOriginAndUnitNormal | undefined {
    const result = this.clone();
    if (inverse) {
      transform.multiplyInversePoint3d(result._origin, result._origin);
      if (transform.matrix.multiplyTransposeVector(result._normal, result._normal) !== undefined
        && result._normal.normalizeInPlace())
        return result;
    } else {
      transform.multiplyPoint3d(result._origin, result._origin);
      if (transform.matrix.multiplyInverseTranspose(result._normal, result._normal) !== undefined
        && result._normal.normalizeInPlace())
        return result;
    }
    return undefined;
  }
  /** Copy data from the given plane. */
  public setFrom(source: Plane3dByOriginAndUnitNormal): void {
    this.set(source._origin, source._normal);
  }
  /** Return the altitude of spacePoint above or below the plane.  (Below is negative) */
  public altitude(spacePoint: Point3d): number { return this._normal.dotProductStartEnd(this._origin, spacePoint); }
  /** Return the altitude of point (x,y)  given xy parts using only the xy parts of origin and unit normal */
  public altitudeXY(x: number, y: number): number {
    return (x - this._origin.x) * this._normal.x + (y - this._origin.y) * this._normal.y;
  }
  /**
   * Return the x component of the normal used to evaluate altitude.
   */
  public normalX(): number { return this._normal.x; }
  /**
   * Return the x component of the normal used to evaluate altitude.
   */
  public normalY(): number { return this._normal.y; }
  /**
   * Return the z component of the normal used to evaluate altitude.
   */
  public normalZ(): number { return this._normal.z; }

  /** Return the altitude of weighted spacePoint above or below the plane.  (Below is negative) */
  public weightedAltitude(spacePoint: Point4d): number {
    return this._normal.dotProductStart3dEnd4d(this._origin, spacePoint);
  }

  /** return a point at specified (signed) altitude */
  public altitudeToPoint(altitude: number, result?: Point3d): Point3d {
    return this._origin.plusScaled(this._normal, altitude, result);
  }
  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocityXYZ(x: number, y: number, z: number): number { return this._normal.dotProductXYZ(x, y, z); }
  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocity(spaceVector: Vector3d): number { return this._normal.dotProduct(spaceVector); }
  /** Return the altitude of a point given as separate x,y,z components. */
  public altitudeXYZ(x: number, y: number, z: number): number {
    return this._normal.dotProductStartEndXYZ(this._origin, x, y, z);
  }
  /** Return the altitude of a point given as separate x,y,z,w components. */
  public altitudeXYZW(x: number, y: number, z: number, w: number): number {
    return this._normal.dotProductStartEndXYZW(this._origin, x, y, z, w);
  }
  /** Return the projection of spacePoint onto the plane. */
  public projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d {
    return spacePoint.plusScaled(this._normal, -this._normal.dotProductStartEnd(this._origin, spacePoint), result);
  }
  /** Returns true of spacePoint is within distance tolerance of the plane. */
  public isPointInPlane(spacePoint: Point3d): boolean { return Geometry.isSmallMetricDistance(this.altitude(spacePoint)); }

  /**
   * Find a point on the plane (via getOriginOnPlaneAltitudeEvaluator) and the project that to planeB.
   * @param planeA
   * @param planeB
   */
  private static createPoint3dPoint3dBetweenPlanes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): Point3dPoint3d {
    const pointA = Plane3dByOriginAndUnitNormal.getOriginOnPlaneAltitudeEvaluator(planeA);
    const pointB = Plane3dByOriginAndUnitNormal.projectPointToPlane(planeB, pointA);
    return Point3dPoint3d.create(pointA, pointB);
  }
  /** Returns the relationship of 2 planes:
   * * Each plane can be any form that returns normal and altitude evaluations via methods in [[PlaneAltitudeEvaluator]]
   * * Return value has variants for
   *   * If intersecting in a line, a Ray3d on the line of intersection
   *   * If identical planes, a Plane3dByOriginAndUnitNormal with the same normal and distance from origin as planeA
   *   * If distinct parallel planes: a Point3dPoint3d with a point on planeA and its projection on planeB
   *   * If extraordinary tolerance issues prevent any of those, undefined is returned.
   *      * This might indicate a 000 normal, which is not expected on a valid plane.
   */
  public static intersect2Planes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator):
    Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined {
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const distanceA = planeA.altitudeXYZ(0, 0, 0), distanceB = planeB.altitudeXYZ(0, 0, 0);
    // Try the most common case without forming an intermediate matrix . . .
    const normalA = Vector3d.create(normalAx, normalAy, normalAz);
    const normalB = Vector3d.create(normalBx, normalBy, normalBz);
    const crossProduct = normalA.crossProduct(normalB);
    if (!crossProduct.tryNormalizeInPlace()) {
      // Parallel planes.
      // get distanceB with orientation of normalB matching that of normalA
      const distanceB1 = normalA.dotProduct(normalB) > 0.0 ? distanceB : -distanceB;
      const originA = Point3d.createScale(normalA, -distanceA);
      const originB = Point3d.createScale(normalB, -distanceB1);
      if (originA.isAlmostEqualMetric(originB))
        return Plane3dByOriginAndUnitNormal.create(originA, normalA);
      else
        return Plane3dByOriginAndUnitNormal.createPoint3dPoint3dBetweenPlanes(planeA, planeB);
    } else {
      // the cross product vector is directed along the intersection of these two planes.
      // find a single point on that ray by intersecting the 2 planes with a 3rd plane through the origin
      const vectorToPoint = SmallSystem.linearSystem3d(
        normalA.x, normalA.y, normalA.z,
        normalB.x, normalB.y, normalB.z,
        crossProduct.x, crossProduct.y, crossProduct.z,
        -distanceA, -distanceB, 0.0);
      // remark: Since the cross product had nonzero length, the linear system should always has a solution.
      if (vectorToPoint !== undefined)
        return Ray3d.createXYZUVW(vectorToPoint.x, vectorToPoint.y, vectorToPoint.z, crossProduct.x, crossProduct.y, crossProduct.z);
      // uh oh.  What can this mean? All exact-arithmetic cases are covered.
      return undefined;
    }
  }

  /** Returns the intersection of 3 planes.
   * * Each plane can be any form that returns normal and altitude evaluations via methods in [[PlaneAltitudeEvaluator]]
   * * Return value has variants for
   *   * Point3d: (usual case) single point of intersection
   *   * Plane3dByOriginAndUnitNormal: fully coincident 3 planes
   * * All other configurations return as an array of the 3 pairwise intersection among [planeA ^ planeB, planeB ^ planeC, planeC ^ planeA].
   *   * Each of those 3 pairs can produce coincident planes, a pair of points that project to each other between parallel planes, or a ray of intersection,
   *     as described by [[Plane3dByOriginAndUnitVector.intersect2Planes]]
   * * undefined as a result indicates really bad data like 000 normal vectors.
   */
  public static intersect3Planes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator, planeC: PlaneAltitudeEvaluator):
    Point3d | Plane3dByOriginAndUnitNormal | Array<Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined> | undefined {
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const normalCx = planeC.normalX(), normalCy = planeC.normalY(), normalCz = planeC.normalZ();
    const distanceA = planeA.altitudeXYZ(0, 0, 0), distanceB = planeB.altitudeXYZ(0, 0, 0), distanceC = planeC.altitudeXYZ(0, 0, 0);
    // Try the most common case without forming an intermediate matrix . . .
    const simpleIntersection = SmallSystem.linearSystem3d(
      normalAx, normalAy, normalAz,
      normalBx, normalBy, normalBz,
      normalCx, normalCy, normalCz,
      -distanceA, -distanceB, -distanceC);
    // UGH -- SmallSystem returned a vector, have to restructure as a point . . .
    if (simpleIntersection !== undefined)
      return Point3d.create(simpleIntersection.x, simpleIntersection.y, simpleIntersection.z);
    let numPlanes = 0;
    let numUndefined = 0;
    const allPlanes = [planeA, planeB, planeC, planeA]; // repeat planeA for easy wraparound indexing
    // The 3 normals are not independent.
    // Find which pairs are parallel, coincident, or intersecting.
    const result: Array<Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined> = [];
    for (let i0 = 0; i0 < 3; i0++) {
      const r = Plane3dByOriginAndUnitNormal.intersect2Planes(allPlanes[i0], allPlanes[i0 + 1]);
      result.push(r);
      if (r === undefined)
        numUndefined++;
      else if (r instanceof Plane3dByOriginAndUnitNormal)
        numPlanes++;
    }
    // Each of the 3 combinations was pushed.
    // If the were all planes, it's true intersection of just one plane
    if (numPlanes === 3) {
      return result[0] as Plane3dByOriginAndUnitNormal;
    }
    if (numUndefined === 3)
      return undefined;
    return result;
  }
  /**
   * Using the altitude and normal data, determine if planeA and planeB have a parallel or coplanar relationship:
   * * return 0 if the planes are not parallel.
   * * return 1 if the planes are coplanar with normals in the same direction
   * * return 2 if the planes are parallel (but not coplanar) with normals in the same direction but different distance from origin.
   * * return -2 if the planes are coplanar with opposing normals
   * * return 2 if the planes are parallel (but not coplanar) with opposing normals.
   * @param planeA
   * @param planeB
   * @returns
   */
  public static classifyIfParallelPlanes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): 0 | 1 | -1 | 2 | -2 {
    const altitudeA = planeA.altitudeXYZ(0, 0, 0);
    const altitudeB = planeB.altitudeXYZ(0, 0, 0);
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const radians = Angle.radiansBetweenVectorsXYZ(normalAx, normalAy, normalAz, normalBx, normalBy, normalBz);
    // nb radians is always positive -- no vector available to resolve up and produce negative.
    let sign = 0;
    if (radians < Geometry.smallAngleRadians)
      sign = 1;
    else if (Math.abs(radians - Math.PI) < Geometry.smallAngleRadians)
      sign = -1;
    else
      return 0;
    const ax = -altitudeA * normalAx, ay = -altitudeA * normalAy, az = -altitudeA * normalAz;
    const bx = -altitudeB * normalBx, by = -altitudeB * normalBy, bz = -altitudeB * normalBz;
    if (Geometry.isSmallMetricDistance(Geometry.distanceXYZXYZ(ax, ay, az, bx, by, bz)))
      return sign > 0 ? 1 : -1;   // The value of sign itself is returned, but type checker doesn't get that.
    else
      return sign > 0 ? 2 : -2;
  }
  /**
   * On a plane that provides normal and distance evaluations (but might not store an origin) use the evaluations to get a point on the plane
   * @param plane plane to evaluate
   * @returns Closest point to the origin
   */
  public static getOriginOnPlaneAltitudeEvaluator(plane: PlaneAltitudeEvaluator): Point3d {
    const d = -plane.altitudeXYZ(0, 0, 0);
    return Point3d.create(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }

  /**
   * Project spacePoint to a plane.
   * @param plane plane for projection.
   * @returns Closest point to the spacePoint
   */
  public static projectPointToPlane(plane: PlaneAltitudeEvaluator, spacePoint: Point3d): Point3d {
    const d = -plane.altitude(spacePoint);
    return spacePoint.plusXYZ(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }

}
