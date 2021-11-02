/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Arc3d } from "../curve/Arc3d";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Angle } from "../geometry3d/Angle";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { IndexedXYZCollectionPolygonOps, PolygonOps } from "../geometry3d/PolygonOps";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";
import { Transform } from "../geometry3d/Transform";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { ClipPlane, ClipPlaneProps } from "./ClipPlane";
import { Clipper, ClipPlaneContainment, ClipUtilities, PolygonClipper } from "./ClipUtils";

/** Wire format describing a [[ConvexClipPlaneSet]].
 * @public
 */
export type ConvexClipPlaneSetProps = ClipPlaneProps[];

/**
 * A ConvexClipPlaneSet is a collection of ClipPlanes, often used for bounding regions of space.
 * @public
 */
export class ConvexClipPlaneSet implements Clipper, PolygonClipper {
  /** Value acting as "at infinity" for coordinates along a ray. */
  public static readonly hugeVal = 1e37;
  private _planes: ClipPlane[];
  // private _parity: number;   <--- Not yet used
  // public get parity() { return this._parity; }
  // public set parity(value: number) { this._parity = value; }
  private constructor(planes?: ClipPlane[]) {
    // this._parity = 1;
    this._planes = planes ? planes : [];
  }
  /** Return an array containing all the planes of the convex set.
   * * Note that this has no leading keyword identifying it as a ConvexClipPlaneSet.
   */
  public toJSON(): ConvexClipPlaneSetProps {
    const val: ClipPlaneProps[] = [];
    for (const plane of this._planes)
      val.push(plane.toJSON());

    return val;
  }

  /** Extract clip planes from a json array `[  clipPlane, clipPlane ]`.
   * * Non-clipPlane members are ignored.
   */
  public static fromJSON(json: ConvexClipPlaneSetProps | undefined, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    if (!Array.isArray(json))
      return result;

    for (const thisJson of json) {
      const plane = ClipPlane.fromJSON(thisJson);
      if (plane)
        result._planes.push(plane);
    }

    return result;
  }
  /**
   * Return true if all members are almostEqual to corresponding members of other.  This includes identical order in array.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: ConvexClipPlaneSet): boolean {
    if (this._planes.length !== other._planes.length)
      return false;
    for (let i = 0; i < this._planes.length; i++)
      if (!this._planes[i].isAlmostEqual(other._planes[i]))
        return false;
    return true;
  }
  /** create from an array of planes.
   * * Each plane reference in the `planes` array is taken into the result.
   * * The input array itself is NOT taken into the result.
   */
  public static createPlanes(planes: (ClipPlane | Plane3dByOriginAndUnitNormal)[], result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    for (const plane of planes) {
      if (plane instanceof ClipPlane) {
        result._planes.push(plane);
      } else if (plane instanceof Plane3dByOriginAndUnitNormal) {
        const clipPlane = ClipPlane.createPlane(plane);
        result._planes.push(clipPlane);
      }
    }
    return result;
  }

  /**
   * Create new convex set using selected planes of a Range3d.
   * @param range range with coordinates
   * @param lowX true to clip at the low x plane
   * @param highX true to clip at the high x plane
   * @param lowY true to clip at the low y plane
   * @param highY true to clip at the high z plane
   * @param lowZ true to clip at the low z plane
   * @param highZ true to clip at the high z plane
   */
  public static createRange3dPlanes(range: Range3d,
    lowX: boolean = true, highX: boolean = true,
    lowY: boolean = true, highY: boolean = true,
    lowZ: boolean = true, highZ: boolean = true): ConvexClipPlaneSet {
    const result = ConvexClipPlaneSet.createEmpty();

    if (lowX)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, range.low.x, 0, 0)!);
    if (highX)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(-1, 0, 0, range.high.x, 0, 0)!);

    if (lowY)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 1, 0, 0, range.low.y, 0)!);
    if (highY)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, -1, 0, 0, range.high.y, 0)!);

    if (lowZ)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, range.low.z)!);
    if (highZ)
      result.planes.push(ClipPlane.createNormalAndPointXYZXYZ(0, 0, -1, 0, 0, range.high.z)!);

    return result;
  }
  /** create an empty `ConvexClipPlaneSet` */
  public static createEmpty(result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    if (result) {
      result._planes.length = 0;
      return result;
    }
    return new ConvexClipPlaneSet();
  }
  /** negate all planes of the set. */
  public negateAllPlanes(): void {
    for (const plane of this._planes)
      plane.negateInPlace();
  }
  /** Create a convex clip plane set that clips to `x0 <= x <= x1` and `y0 <= y <= y1`.
   * * Note that there is no test for the usual ordering `x0 <= x1` or `y0 <= y1`.
   *    * if the usual ordering is violated, the convex set is an empty set.
   */
  public static createXYBox(x0: number, y0: number, x1: number, y1: number, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    const clip0 = ClipPlane.createNormalAndDistance(Vector3d.create(-1, 0, 0), -x1, false, true);
    const clip1 = ClipPlane.createNormalAndDistance(Vector3d.create(1, 0, 0), x0, false, true);
    const clip2 = ClipPlane.createNormalAndDistance(Vector3d.create(0, -1, 0), -y1, false, true);
    const clip3 = ClipPlane.createNormalAndDistance(Vector3d.create(0, 1, 0), y0, false, true);
    if (clip0 && clip1 && clip2 && clip3) {
      result._planes.push(clip0, clip1, clip2, clip3);
    }
    return result;
  }
  /** Create a convex set containing a half space for each edge between points of a polyline.
   * * Caller is responsible for assuring the polyline is convex.
   * @param points array of points.  Only xy parts are considered.
   * @param interior array whose boolean value is used as both the `interior` and `invisible` bits of the plane for the succeeding segment.   If this array is not provided, both are false.
   * @param leftIsInside if true, the interior is "to the left" of the segments.  If false, interior is "to the right"
   */
  public static createXYPolyLine(points: Point3d[], interior: boolean[] | undefined, leftIsInside: boolean, result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (let i0 = 0; (i0 + 1) < points.length; i0++) {
      const edgeVector: Vector3d = Vector3d.createStartEnd(points[i0], points[i0 + 1]);
      const perp: Vector3d = edgeVector.unitPerpendicularXY();
      perp.z = 0.0;

      if (!leftIsInside)
        perp.scaleInPlace(-1.0);

      const perpNormalized = perp.normalize();
      if (perpNormalized) {
        const flag = interior !== undefined ? interior[i0] : false;
        const clip = ClipPlane.createNormalAndPoint(perp, points[i0], flag, flag);
        if (clip) {
          result._planes.push(clip);
        }
      }
    }

    return result;
  }

  /**
   * Create a convexClipPlaneSet with planes whose "inside" normal is to the left of each segment.
   * @param points array of points.
   */
  public static createXYPolyLineInsideLeft(points: Point3d[], result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (let i0 = 0; (i0 + 1) < points.length; i0++) {
      const edgeVector: Vector3d = Vector3d.createStartEnd(points[i0], points[i0 + 1]);
      const perp: Vector3d = edgeVector.unitPerpendicularXY();
      perp.z = 0.0;

      const perpNormalized = perp.normalize();
      if (perpNormalized) {
        const clip = ClipPlane.createNormalAndPoint(perp, points[i0], false, false);
        if (clip) { result._planes.push(clip); }
      }
    }
    return result;
  }
  /**
   * (re)set a plane and ConvexClipPlaneSet for a convex array, such as a convex facet used for xy clip.
   * * The planeOfPolygon is (re)initialized with the normal from 3 points, but not otherwise referenced.
   * * The ConvexClipPlaneSet is filled with outward normals of the facet edges as viewed to xy plane.
   * @param points
   * @param result
   */
  public static setPlaneAndXYLoopCCW(points: GrowableXYZArray, planeOfPolygon: ClipPlane, frustum: ConvexClipPlaneSet) {
    const i0 = points.length - 1;
    const n = points.length;
    let x0 = points.getXAtUncheckedPointIndex(i0);
    let y0 = points.getYAtUncheckedPointIndex(i0);
    let x1, y1, nx, ny;
    frustum._planes.length = 0;
    const z0 = points.getZAtUncheckedPointIndex(i0);  // z for planes can stay fixed
    const planeNormal = points.crossProductIndexIndexIndex(0, 2, 1)!;
    ClipPlane.createNormalAndPointXYZXYZ(planeNormal.x, planeNormal.y, planeNormal.z, x0, y0, z0, false, false, planeOfPolygon);
    if (planeNormal.normalizeInPlace()) {
      for (let i1 = 0; i1 < n; i1++, x0 = x1, y0 = y1) {
        x1 = points.getXAtUncheckedPointIndex(i1);
        y1 = points.getYAtUncheckedPointIndex(i1);
        nx = -(y1 - y0);
        ny = x1 - x0;
        const clipper = ClipPlane.createNormalAndPointXYZXYZ(nx, ny, 0, x1, y1, z0);
        if (clipper)
          frustum._planes.push(clipper);
      }
    }
  }

  /** Deep clone of all planes. */
  public clone(result?: ConvexClipPlaneSet): ConvexClipPlaneSet {
    result = result ? result : new ConvexClipPlaneSet();
    result._planes.length = 0;
    for (const plane of this._planes)
      result._planes.push(plane.clone());
    return result;
  }
  /** Return the (reference to the) array of `ClipPlane` */
  public get planes(): ClipPlane[] {
    return this._planes;
  }

  /** Test if there is any intersection with a ray defined by origin and direction.
   * * Optionally record the range (null or otherwise) in caller-allocated result.
   * * If the ray is unbounded inside the clip, result can contain positive or negative "Geometry.hugeCoordinate" values
   * * If no result is provide, there are no object allocations.
   * @param result optional Range1d to receive parameters along the ray.
   */
  public hasIntersectionWithRay(ray: Ray3d, result?: Range1d, tolerance: number = Geometry.smallMetricDistance ): boolean {
    // form low and high values in locals that do not require allocation.
    // transfer to caller-supplied result at end
    let t0 = -Geometry.hugeCoordinate;
    let t1 = Geometry.hugeCoordinate;
    if (result)
      result.setNull();
    const velocityTolerance = 1.0e-13;
    for (const plane of this._planes) {
      const vD = plane.velocity(ray.direction);
      const vN = plane.altitude(ray.origin);

      if (Math.abs (vD) <= velocityTolerance) {
        // Ray is parallel... No need to continue testing if outside halfspace.
        if (vN < -tolerance)
          return false;   // and result is a null range.
      } else {
        const rayFraction = - vN / vD;
        if (vD < 0.0) {
          if (rayFraction < t1)
            t1 = rayFraction;
        } else {
          if (rayFraction > t0)
            t0 = rayFraction;
        }
      }
    }
    if (t1 < t0)
      return false;   // and result is a null range.
    if (result) {
      result.extendX(t0);
      result.extendX(t1);
    }
    return true;
  }
  /**
   * Multiply all the ClipPlanes DPoint4d by matrix.
   * @param matrix matrix to apply.
   * @param invert if true, use in verse of the matrix.
   * @param transpose if true, use the transpose of the matrix (or inverse, per invert parameter)
   * * Note that if matrixA is applied to all of space, the matrix to send to this method to get a corresponding effect on the plane is the inverse transpose of matrixA
   * * Callers that will apply the same matrix to many planes should pre-invert the matrix for efficiency.
   * * Both params default to true to get the full effect of transforming space.
   * @param matrix matrix to apply
   */
  public multiplyPlanesByMatrix4d(matrix: Matrix4d, invert: boolean = true, transpose: boolean = true): boolean {
    if (invert) {  // form inverse once here, reuse for all planes
      const inverse = matrix.createInverse();
      if (!inverse)
        return false;
      return this.multiplyPlanesByMatrix4d(inverse, false, transpose);
    }
    for (const plane of this._planes) {
      plane.multiplyPlaneByMatrix4d(matrix, false, transpose);
    }
    return true;
  }
  /** Return true if `point` satisfies `point.isPointInside` for all planes */
  public isPointInside(point: Point3d): boolean {
    for (const plane of this._planes) {
      if (!plane.isPointInside(point))  // Defaults to strict inside check. Other clipping classes may use "on or inside" check for the "on" case
        return false;
    }
    return true;
  }

  /** Return true if `point` satisfies `point.isPointOnOrInside` for all planes */
  public isPointOnOrInside(point: Point3d, tolerance: number): boolean {
    const interiorTolerance = Math.abs(tolerance);   // Interior tolerance should always be positive. (TFS# 246598).
    for (const plane of this._planes) {
      if (!plane.isPointOnOrInside(point, (plane.interior ? interiorTolerance : tolerance)))
        return false;
    }
    return true;
  }
  /**
   * Test if a sphere is completely inside the convex set.
   * @param centerPoint center of sphere
   * @param radius radius of sphere.
   */
  public isSphereInside(centerPoint: Point3d, radius: number): boolean {
    const r1 = Math.abs(radius) + Geometry.smallMetricDistance;
    for (const plane of this._planes) {
      if (!plane.isPointOnOrInside(centerPoint, r1)) {
        return false;
      }
    }
    return true;
  }

  /** Find the parts of the line segment  (if any) that is within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * * To clip to the usual bounded line segment, starts with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative Number.MAX_VALUE.
   * @param fraction0 fraction that is the initial lower fraction of the active interval. (e.g. 0.0 for bounded segment)
   * @param fraction1 fraction that is the initial upper fraction of the active interval.  (e.g. 1.0 for bounded segment)
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean {
    let fraction: number | undefined;
    if (f1 < f0)
      return false;
    for (const plane of this._planes) {
      const hA = - plane.altitude(pointA);
      const hB = - plane.altitude(pointB);
      fraction = Geometry.conditionalDivideFraction(-hA, (hB - hA));
      if (fraction === undefined) {
        // LIne parallel to the plane.  If positive, it is all OUT
        if (hA > 0.0)
          return false;
      } else if (hB > hA) {    // STRICTLY moving outward
        if (fraction < f0)
          return false;
        if (fraction < f1)
          f1 = fraction;
      } else if (hA > hB) { // STRICTLY moving inward
        if (fraction > f1)
          return false;
        if (fraction > f0)
          f0 = fraction;
      } else {
        // Strictly equal evaluations
        if (hA > 0.0)
          return false;
      }
    }
    if (f1 >= f0) {
      if (announce)
        announce(f0, f1);
      return true;
    }
    return false;
  }

  private static _clipArcFractionArray = new GrowableFloat64Array();
  /** Find fractional parts of the arc that are within this ClipPlaneSet, and announce each as
   * * `announce(fraction, fraction, curve)`
   */
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = ConvexClipPlaneSet._clipArcFractionArray;
    breaks.clear();
    for (const clipPlane of this.planes) {
      clipPlane.appendIntersectionRadians(arc, breaks);
    }
    arc.sweep.radiansArrayToPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }
  /** Find the parts of the (unbounded) line segment  (if any) that is within the convex clip volume.
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  public clipUnboundedSegment(pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean {
    return this.announceClippedSegmentIntervals(-Number.MAX_VALUE, Number.MAX_VALUE, pointA, pointB, announce);
  }
  /** transform each plane in place. */
  public transformInPlace(transform: Transform) {
    for (const plane of this._planes) {
      plane.transformInPlace(transform);
    }
  }

  /**
   * Clip a polygon to the inside of the convex set.
   * * Results with 2 or fewer points are ignored.
   * * Other than ensuring capacity in the arrays, there are no object allocations during execution of this function.
   * @param xyz input points.
   * @param work work buffer
   * @param tolerance tolerance for "on plane" decision.
   */
  public clipConvexPolygonInPlace(xyz: GrowableXYZArray, work: GrowableXYZArray, tolerance: number = Geometry.smallMetricDistance) {
    for (const plane of this._planes) {
      plane.clipConvexPolygonInPlace(xyz, work, true, tolerance);
      if (xyz.length < 3)
        return;
    }
  }
  /** Clip a convex polygon to (a single) inside part and (possibly many) outside parts.
   * @param xyz input polygon.
   * @param outsideFragments an array to receive (via push, with no preliminary clear) outside fragments
   * @param arrayCache cache for work arrays.
   * @return the surviving inside part (if any)
   */
  public clipInsidePushOutside(xyz: GrowableXYZArray,
    outsideFragments: GrowableXYZArray[] | undefined,
    arrayCache: GrowableXYZArrayCache): GrowableXYZArray | undefined {
    const perpendicularRange = Range1d.createNull();
    let newInside = arrayCache.grabFromCache();
    let newOutside = arrayCache.grabFromCache();
    let insidePart = arrayCache.grabFromCache();  // this is empty ...
    insidePart.pushFrom(xyz);
    // While looping through planes . .
    // the outside part for the current plane is definitely outside and can be stashed to the final outside
    // the inside part for the current plane passes forward to be further split by the remaining planes.
    for (const plane of this._planes) {
      IndexedXYZCollectionPolygonOps.splitConvexPolygonInsideOutsidePlane(plane, insidePart, newInside, newOutside, perpendicularRange);
      if (newOutside.length > 0) {
        // the newOutside fragment is definitely outside the ConvexClipPlaneSet
        if (outsideFragments)   // save the definitely outside part as return data.
          ClipUtilities.captureOrDrop(newOutside, 3, outsideFragments, arrayCache);
        newOutside = arrayCache.grabFromCache();
        if (newInside.length === 0) {
          insidePart.length = 0;
          break;
        }
        // insideWork is changed ... swap it with insidePart
        arrayCache.dropToCache(insidePart);
        insidePart = newInside;
        newInside = arrayCache.grabFromCache();
      }
      // outside clip was empty .. insideWork is identical to insidePart .. let insidePart feed through to the next clipper.
    }
    // at break or fall out ...
    // ALWAYS drop `newInside` and `newOutside` to the cache
    arrayCache.dropToCache(newInside);
    arrayCache.dropToCache(newOutside);
    // if `insidePart` is alive, return it to caller.  Otherwise drop it to cache and return undefined.
    if (insidePart.length > 0)
      return insidePart;
    arrayCache.dropToCache(insidePart);
    return undefined;
  }
  /** Returns 1, 2, or 3 based on whether point array is strongly inside, ambiguous, or strongly outside respectively.
   * * This has a peculiar expected use case as a very fast pre-filter for more precise clipping.
   * * The expected point set is for a polygon.
   * * Hence any clipping will eventually have to consider the lines between the points.
   * * This method looks for the special case of a single clip plane that has all the points outside.
   * * In this case the whole polygon must be outside.
   * * Note that this does not detect a polygon that is outside but "crosses a corner" -- it is mixed with respect to
   *     multiple planes.
   */
  public classifyPointContainment(points: Point3d[], onIsOutside: boolean): ClipPlaneContainment {
    let allInside = true;
    const onTolerance = onIsOutside ? 1.0e-8 : -1.0e-8;
    const interiorTolerance = 1.0e-8;   // Interior tolerance should always be positive

    for (const plane of this._planes) {
      let nOutside = 0;
      for (const point of points) {
        if (plane.altitude(point) < (plane.interior ? interiorTolerance : onTolerance)) {
          nOutside++;
          allInside = false;
        }
      }

      if (nOutside === points.length)
        return ClipPlaneContainment.StronglyOutside;
    }

    return allInside ? ClipPlaneContainment.StronglyInside : ClipPlaneContainment.Ambiguous;
  }

  /**
   * * Create a convex clip set for a polygon swept with possible tilt angle.
   * * planes are constructed by ClipPlane.createEdgeAndUpVector, using successive points from the array.
   * * If the first and last points match, the polygon area is checked.  If the area is negative, points are used in reverse order.
   * * If first and last points do not match, points are used in order given
   * @param points polygon points. (Closure point optional)
   * @param upVector primary sweep direction, as applied by ClipPlane.createEdgeAndUpVector
   * @param tiltAngle angle to tilt sweep planes away from the sweep direction.
   */
  public static createSweptPolyline(points: Point3d[], upVector: Vector3d, tiltAngle?: Angle): ConvexClipPlaneSet | undefined {
    const result = ConvexClipPlaneSet.createEmpty();
    let reverse = false;
    if (points.length > 3 && points[0].isAlmostEqual(points[points.length - 1])) {
      const polygonNormal: Vector3d = PolygonOps.areaNormal(points);
      const normalDot = polygonNormal.dotProduct(upVector);
      if (normalDot > 0.0)
        reverse = true;
    }
    for (let i = 0; (i + 1) < points.length; i++) {
      if (reverse) {
        const toAdd = ClipPlane.createEdgeAndUpVector(points[i + 1], points[i], upVector, tiltAngle);
        if (toAdd) {   // clipPlane creation could result in undefined
          result.addPlaneToConvexSet(toAdd);
        } else {
          return undefined;
        }
      } else {
        const toAdd = ClipPlane.createEdgeAndUpVector(points[i], points[i + 1], upVector, tiltAngle);
        if (toAdd) {   // clipPlane creation could result in undefined
          result.addPlaneToConvexSet(toAdd);
        } else {
          return undefined;
        }
      }
    }
    return result;
  }
  /**
   * Add a plane to the convex set.
   * @param plane plane to add
   */
  public addPlaneToConvexSet(plane: ClipPlane | Plane3dByOriginAndUnitNormal| undefined) {
    if (plane instanceof ClipPlane)
      this._planes.push(plane);
    else if (plane instanceof Plane3dByOriginAndUnitNormal)
      this._planes.push(ClipPlane.createPlane(plane));
  }
  /**
   * test many points.  Distribute them to arrays depending on in/out result.
   * @param points points to test
   * @param inOrOn points that are in or on the set
   * @param out points that are out.
   */
  public clipPointsOnOrInside(points: Point3d[], inOrOn: Point3d[], out: Point3d[]) {
    inOrOn.length = 0;
    out.length = 0;
    for (const xyz of points) {
      if (this.isPointOnOrInside(xyz, 0.0)) {
        inOrOn.push(xyz);
      } else {
        out.push(xyz);
      }
    }
  }
  /**
   * Clip a polygon to the planes of the clip plane set.
   * * For a convex input polygon, the output is another convex polygon.
   * * For a non-convex input, the output may have double-back edges along plane intersections.  This is still a valid clip in a parity sense.
   * * The containingPlane parameter allows callers within ConvexClipPlane set to bypass planes known to contain the polygon
   * @param input input polygon, usually convex.
   * @param output output polygon
   * @param work work array.
   * @param containingPlane if this plane is found in the convex set, it is NOT applied.
   */
  public polygonClip(input: GrowableXYZArray | Point3d[], output: GrowableXYZArray, work: GrowableXYZArray, planeToSkip?: ClipPlane) {
    if (input instanceof GrowableXYZArray)
      input.clone(output);
    else
      GrowableXYZArray.create(input, output);

    for (const plane of this._planes) {
      if (planeToSkip === plane)
        continue;
      if (output.length === 0)
        break;
      plane.clipConvexPolygonInPlace(output, work);
    }
  }
  /**
   * * Define new planes in this ConvexClipPlaneSet so it clips to the inside of a polygon.
   * * always create planes for the swept edges of the polygon
   * * optionally (with nonzero sideSelect) create a cap plane using the polygon normal.
   * @param points Points of a bounding polygon
   * @param sweepDirection direction to sweep.
   * @param sideSelect 0 to have no cap polygon, 1 if the sweep vector side is in, -1 if sweep vector side is out.
   */
  public reloadSweptPolygon(points: Point3d[], sweepDirection: Vector3d, sideSelect: number): number {
    this._planes.length = 0;
    const n = points.length;
    if (n <= 2)
      return 0;

    const planeNormal: Vector3d = PolygonOps.areaNormal(points);
    const isCCW = sweepDirection.dotProduct(planeNormal) > 0.0;

    const delta = isCCW ? 1 : n - 1;
    for (let i = 0; i < n; i++) {
      const i1 = (i + delta) % n;
      const xyz0: Point3d = points[i];
      const xyz1: Point3d = points[i1];
      if (xyz0.isAlmostEqual(xyz1))
        continue;
      const edgeVector: Vector3d = Vector3d.createStartEnd(xyz0, xyz1);
      const inwardNormal: Vector3d = Vector3d.createCrossProduct(sweepDirection.x, sweepDirection.y, sweepDirection.z,
        edgeVector.x, edgeVector.y, edgeVector.z);
      const inwardNormalNormalized = inwardNormal.normalize();
      let distance;
      if (inwardNormalNormalized) { // Should never fail... simply a check due to the format of the normalize function return
        distance = inwardNormalNormalized.dotProduct(xyz0);
        const clipToAdd = ClipPlane.createNormalAndDistance(inwardNormalNormalized, distance, false, false);
        if (clipToAdd) { this._planes.push(clipToAdd); }  // clipPlane creation could result in undefined
      }
    }
    if (sideSelect !== 0.0) {
      let planeNormalNormalized = planeNormal.normalize();
      if (planeNormalNormalized) { // Again.. should never fail
        const a = sweepDirection.dotProduct(planeNormalNormalized) * sideSelect;
        if (a < 0.0)
          planeNormalNormalized = planeNormalNormalized.negate();
        const xyz0: Point3d = points[0];
        const distance = planeNormalNormalized.dotProduct(xyz0);
        const clipToAdd = ClipPlane.createNormalAndDistance(planeNormalNormalized, distance, false, false);
        if (clipToAdd) { this._planes.push(clipToAdd); }  // clipPlane creation could result in undefined
      }
    }
    return isCCW ? 1 : -1;
  }

  /**
   * Compute intersections among all combinations of 3 planes in the convex set.
   * * optionally throw out points that are not in the set.
   * * optionally push the points in the caller-supplied point array.
   * * optionally extend a caller supplied range.
   * * In the common case where the convex set is (a) a slab or (b) a view frustum, there will be 8 points and the range is the range of the convex set.
   * * If the convex set is unbounded, the range only contains the range of the accepted (corner) points, and the range is not a representative of the "range of all points in the set" .
   * @param transform (optional) transform to apply to the points.
   * @param points (optional) array to which computed points are to be added.
   * @param range (optional) range to be extended by the computed points
   * @param transform (optional) transform to apply to the accepted points.
   * @param testContainment if true, test each point to see if it is within the convex set.  (Send false if confident that the convex set is rectilinear set such as a slab.  Send true if chiseled corners are possible)
   * @returns number of points.
   */
  public computePlanePlanePlaneIntersections(points: Point3d[] | undefined, rangeToExtend: Range3d | undefined, transform?: Transform, testContainment: boolean = true): number {

    const normalRows = Matrix3d.createIdentity();
    const allPlanes = this._planes;
    const n = allPlanes.length;
    let numPoints = 0;    // explicitly count points -- can't wait to end for points.length because it may be an optional output.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++)
        for (let k = j + 1; k < n; k++) {
          Matrix3d.createRowValues(
            allPlanes[i].inwardNormalRef.x, allPlanes[i].inwardNormalRef.y, allPlanes[i].inwardNormalRef.z,
            allPlanes[j].inwardNormalRef.x, allPlanes[j].inwardNormalRef.y, allPlanes[j].inwardNormalRef.z,
            allPlanes[k].inwardNormalRef.x, allPlanes[k].inwardNormalRef.y, allPlanes[k].inwardNormalRef.z,
            normalRows);
          if (normalRows.computeCachedInverse(false)) {
            const xyz = normalRows.multiplyInverseXYZAsPoint3d(allPlanes[i].distance, allPlanes[j].distance, allPlanes[k].distance)!;
            if (!testContainment || this.isPointOnOrInside(xyz, Geometry.smallMetricDistance)) {
              numPoints++;
              if (transform)
                transform.multiplyPoint3d(xyz, xyz);
              if (points)
                points.push(xyz);
              if (rangeToExtend)
                rangeToExtend.extendPoint(xyz);
            }
          }
        }
    }
    return numPoints;
  }
  /**
   * Set the `invisible` property on each plane of the convex set.
   * @param invisible value to store
   */
  public setInvisible(invisible: boolean) {
    for (const plane of this._planes) {
      plane.setInvisible(invisible);
    }
  }
  /**
   * Add planes for z-direction clip between low and high z levels.
   * @param invisible value to apply to the `invisible` bit for the new planes
   * @param zLow low z value.  The plane clips out points with z below this.
   * @param zHigh high z value.  The plane clips out points with z above this.
   */
  public addZClipPlanes(invisible: boolean, zLow?: number, zHigh?: number) {
    if (zLow !== undefined)
      this._planes.push(ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, 1), zLow, invisible)!);
    if (zHigh !== undefined)
      this._planes.push(ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, -1), -zHigh, invisible)!);
  }
  /** Implement appendPolygonClip, as defined in interface PolygonClipper.  /**
   *
   * @param xyz input polygon.  This is not changed.
   * @param insideFragments Array to receive "inside" fragments.  Each fragment is a GrowableXYZArray grabbed from the cache.  This is NOT cleared.
   * @param outsideFragments Array to receive "outside" fragments.  Each fragment is a GrowableXYZArray grabbed from the cache.  This is NOT cleared.
   * @param arrayCache cache for reusable GrowableXYZArray.
   */
  public appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache): void {
    const newInside = this.clipInsidePushOutside(xyz, outsideFragments, arrayCache);
    if (newInside)
      insideFragments.push(newInside);
  }

  // FUNCTIONS SKIPPED DUE TO BSPLINES, VU, OR NON-USAGE IN NATIVE CODE----------------------------------------------------------------

  // Uses bsplines... skipping for now:
  // public convexAppendIntervalsFromBspline();

  // Uses pushing and clearing from/to a cache and added functionality for arrays. . . skipping for now
  // public convexPolygonClipInsideOutside(input: Point3d[], inside: Point3d[], outside: Point3d[], work1: Point3d[], work2: Point3d[],
  // clearOutside: boolean, distanceTolerance: number)
}
