/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Arc3d } from "../curve/Arc3d";
import { AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Clipper, ClipPlaneContainment, ClipUtilities, PolygonClipper } from "./ClipUtils";
import { ConvexClipPlaneSet, ConvexClipPlaneSetProps } from "./ConvexClipPlaneSet";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";

/** Wire format describing a [[UnionOfConvexClipPlaneSets]].
 * @public
 */
export type UnionOfConvexClipPlaneSetsProps = ConvexClipPlaneSetProps[];

/**
 * A collection of ConvexClipPlaneSets.
 * * A point is "in" the clip plane set if it is "in" one or more of  the ConvexClipPlaneSet
 * * Hence the boolean logic is that the ClipPlaneSet is a UNION of its constituents.
 * @public
 */
export class UnionOfConvexClipPlaneSets implements Clipper, PolygonClipper {
  private _convexSets: ConvexClipPlaneSet[];
  /** (property accessor)  Return the (reference to the) array of `ConvexClipPlaneSet` */
  public get convexSets(): ConvexClipPlaneSet[] { return this._convexSets; }

  private constructor() {
    this._convexSets = [];
  }
  /** Return an array with the `toJSON` form of each  `ConvexClipPlaneSet` */
  public toJSON(): UnionOfConvexClipPlaneSetsProps {
    const val: ConvexClipPlaneSetProps[] = [];
    for (const convex of this._convexSets)
      val.push(convex.toJSON());

    return val;
  }

  /** Convert json `UnionOfConvexClipPlaneSets`, using `setFromJSON`. */
  public static fromJSON(json: UnionOfConvexClipPlaneSetsProps | undefined, result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    result._convexSets.length = 0;
    if (!Array.isArray(json))
      return result;

    for (const thisJson of json)
      result._convexSets.push(ConvexClipPlaneSet.fromJSON(thisJson));

    return result;
  }

  /** Create a `UnionOfConvexClipPlaneSets` with no members. */
  public static createEmpty(result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    if (result) {
      result._convexSets.length = 0;
      return result;
    }
    return new UnionOfConvexClipPlaneSets();
  }
  /**
   * Return true if all member convex sets are almostEqual to corresponding members of other.  This includes identical order in array.
   * @param other clip plane to compare
   */
  public isAlmostEqual(other: UnionOfConvexClipPlaneSets): boolean {
    if (this._convexSets.length !== other._convexSets.length)
      return false;
    for (let i = 0; i < this._convexSets.length; i++)
      if (!this._convexSets[i].isAlmostEqual(other._convexSets[i]))
        return false;
    return true;
  }
  /** Create a `UnionOfConvexClipPlaneSets` with given `ConvexClipPlaneSet` members */
  public static createConvexSets(convexSets: ConvexClipPlaneSet[], result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    for (const set of convexSets)
      result._convexSets.push(set);
    return result;
  }
  /** return a deep copy. */
  public clone(result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    result._convexSets.length = 0;
    for (const convexSet of this._convexSets)
      result._convexSets.push(convexSet.clone());
    return result;
  }
  /** Append `toAdd` to the array of `ConvexClipPlaneSet`.
   * * undefined toAdd is ignored.
   */
  public addConvexSet(toAdd: ConvexClipPlaneSet | undefined) {
    if (toAdd)
    this._convexSets.push(toAdd);
  }

  /** Test if there is any intersection with a ray defined by origin and direction.
   * * Optionally record the range (null or otherwise) in caller-allocated result.
   * * If the ray is unbounded inside the clip, result can contain positive or negative "Geometry.hugeCoordinate" values
   * * If no result is provide, there are no object allocations.
   * @param maximalRange optional Range1d to receive parameters along the ray.
   */
  public hasIntersectionWithRay(ray: Ray3d, maximalRange?: Range1d): boolean {
    if (maximalRange === undefined) {
      // if complete result is not requested, return after any hit.
      for (const planeSet of this._convexSets) {
        if (planeSet.hasIntersectionWithRay(ray))
          return true;
      }
      return false;
    }
    maximalRange.setNull();
    const rangeA = Range1d.createNull();
    for (const planeSet of this._convexSets) {
      if (planeSet.hasIntersectionWithRay(ray, rangeA))
        maximalRange.extendRange(rangeA);
    }
    return !maximalRange.isNull;
  }

  /** Return true if true is returned for any contained convex set returns true for `convexSet.isPointInside (point, tolerance)`  */
  public isPointInside(point: Point3d): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointInside(point)) {
        return true;
      }
    }
    return false;
  }
  /** Return true if true is returned for any contained convex set returns true for `convexSet.isPointOnOrInside (point, tolerance)`  */
  public isPointOnOrInside(point: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointOnOrInside(point, tolerance))
        return true;
    }
    return false;
  }

  /** Return true if true is returned for any contained convex set returns true for `convexSet.isSphereOnOrInside (point, tolerance)`  */
  public isSphereInside(point: Point3d, radius: number) {
    for (const convexSet of this._convexSets) {
      if (convexSet.isSphereInside(point, radius))
        return true;
    }
    return false;
  }

  /** test if any part of a line segment is within the volume */
  public isAnyPointInOrOnFromSegment(segment: LineSegment3d): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.announceClippedSegmentIntervals(0.0, 1.0, segment.point0Ref, segment.point1Ref))
        return true;
    }
    return false;
  }

  // Intervals must be Segment1d array, as there may be multiple intervals along segment that pass through set regions,
  // and so splitting the intervals into segments aids in better organization
  /** Returns the fractions of the segment that pass through the set region, as 1 dimensional pieces */
  public appendIntervalsFromSegment(segment: LineSegment3d, intervals: Segment1d[]) {
    for (const convexSet of this._convexSets) {
      convexSet.announceClippedSegmentIntervals(0.0, 1.0, segment.point0Ref, segment.point1Ref,
        (fraction0: number, fraction1: number) =>
          intervals.push(Segment1d.create(fraction0, fraction1)));
    }
  }
  /** apply `transform` to all the ConvexClipPlaneSet's */
  public transformInPlace(transform: Transform) {
    for (const convexSet of this._convexSets) {
      convexSet.transformInPlace(transform);
    }
  }

  /** Returns 1, 2, or 3 based on whether point is strongly inside, ambiguous, or strongly outside respectively */
  public classifyPointContainment(points: Point3d[], onIsOutside: boolean): number {
    for (const convexSet of this._convexSets) {
      const thisStatus = convexSet.classifyPointContainment(points, onIsOutside);
      if (thisStatus !== ClipPlaneContainment.StronglyOutside)
        return thisStatus;
    }
    return ClipPlaneContainment.StronglyOutside;
  }

  /** Clip a polygon using this ClipPlaneSet, returning new polygon boundaries. Note that each polygon may lie next to the previous, or be disconnected. */
  public polygonClip(input: GrowableXYZArray | Point3d[], output: GrowableXYZArray[]) {
    output.length = 0;
    if (Array.isArray(input))
      input = GrowableXYZArray.create(input);
    const work = new GrowableXYZArray();
    for (const convexSet of this._convexSets) {
      const convexSetOutput = new GrowableXYZArray();
      convexSet.polygonClip(input, convexSetOutput, work);
      if (convexSetOutput.length !== 0)
        output.push(convexSetOutput);
    }
  }

  /**
   * * announce clipSegment() for each convexSet in this ClipPlaneSet.
   * * all clipPlaneSets are inspected
   * * announced intervals are for each individual clipPlaneSet -- adjacent intervals are not consolidated.
   * @param f0 active interval start.
   * @param f1 active interval end
   * @param pointA line segment start
   * @param pointB line segment end
   * @param announce function to announce interval.
   * @returns Return true if any announcements are made.
   */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: (fraction0: number, fraction1: number) => void): boolean {
    let numAnnounce = 0;
    for (const convexSet of this._convexSets) {
      if (convexSet.announceClippedSegmentIntervals(f0, f1, pointA, pointB, announce))
        numAnnounce++;
    }
    return numAnnounce > 0;
  }

  private static _clipArcFractionArray = new GrowableFloat64Array();
  /** Find parts of an arc that are inside any member clipper.
   * Announce each with `announce(startFraction, endFraction, this)`
   */
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = UnionOfConvexClipPlaneSets._clipArcFractionArray;
    breaks.clear();
    for (const convexSet of this._convexSets) {
      for (const clipPlane of convexSet.planes) {
        clipPlane.appendIntersectionRadians(arc, breaks);
      }
    }
    arc.sweep.radiansArrayToPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }

  /**
   * Collect the output from computePlanePlanePlaneIntersections in all the contained convex sets.
   *
   * @param transform (optional) transform to apply to the points.
   * @param points (optional) array to which computed points are to be added.
   * @param range (optional) range to be extended by the computed points
   * @param transform (optional) transform to apply to the accepted points.
   * @param testContainment if true, test each point to see if it is within the convex set.  (Send false if confident that the convex set is rectilinear set such as a slab.  Send true if chiseled corners are possible)
   * @returns number of points.
   */
  public computePlanePlanePlaneIntersectionsInAllConvexSets(points: Point3d[] | undefined, rangeToExtend: Range3d | undefined, transform?: Transform, testContainment: boolean = true): number {
    let n = 0;
    for (const convexSet of this._convexSets) {
      n += convexSet.computePlanePlanePlaneIntersections(points, rangeToExtend, transform, testContainment);
    }
    return n;
  }
  /**
   * Multiply all ClipPlanes DPoint4d by matrix.
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
    // (no inversion -- no failures possible)
    for (const convexSet of this._convexSets) {
      convexSet.multiplyPlanesByMatrix4d(matrix, false, transpose);
    }
    return true;
  }
  /** Recursively call `setInvisible` on all member convex sets. */
  public setInvisible(invisible: boolean) {
    for (const convexSet of this._convexSets) {
      convexSet.setInvisible(invisible);
    }
  }
  /** add convex sets that accept points below `zLow` and above `zHigh` */
  public addOutsideZClipSets(invisible: boolean, zLow?: number, zHigh?: number) {
    if (zLow) {
      const convexSet = ConvexClipPlaneSet.createEmpty();
      convexSet.addZClipPlanes(invisible, zLow);
      this._convexSets.push(convexSet);
    }
    if (zHigh) {
      const convexSet = ConvexClipPlaneSet.createEmpty();
      convexSet.addZClipPlanes(invisible, undefined, zHigh);
      this._convexSets.push(convexSet);
    }
  }
  /** move convex sets from source.*/
  public takeConvexSets(source: UnionOfConvexClipPlaneSets) {
    let convexSet;
    while ((undefined !== (convexSet = source._convexSets.pop()))) {
      this._convexSets.push(convexSet);
    }
  }
  /**
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
    const oldOutsideCount = outsideFragments.length;
    const oldInsideCount = insideFragments.length;
    let carryForwardA = [arrayCache.grabAndFill(xyz)];
    let carryForwardB: GrowableXYZArray[] = [];
    let tempAB;
    let shard;
    // At each convex set, carryForwardA is all the fragments that have been outside all previous convex sets.
    // Clip each such fragment to the current set, sending the outside parts to carryForwardB, which will got to the next clipper
    // The final surviving carryForward really is out.
    for (const c of this._convexSets) {
      while (undefined !== (shard = carryForwardA.pop())) {
        c.appendPolygonClip(shard, insideFragments, carryForwardB, arrayCache);
        arrayCache.dropToCache(shard);
      }
      tempAB = carryForwardB;
      carryForwardB = carryForwardA;  // and that is empty
      carryForwardA = tempAB;
    }
    while (undefined !== (shard = carryForwardA.pop())) {
      outsideFragments.push(shard);
    }
    if (outsideFragments.length === oldOutsideCount)
      ClipUtilities.restoreSingletonInPlaceOfMultipleShards(insideFragments, oldInsideCount, xyz, arrayCache);
    else if (insideFragments.length === oldInsideCount)
      ClipUtilities.restoreSingletonInPlaceOfMultipleShards(outsideFragments, oldOutsideCount, xyz, arrayCache);
  }
}

/* FUNCTIONS SKIPPED DUE TO BSPLINES, VU, OR NON-USAGE IN NATIVE CODE----------------------------------------------------------------

Involves vu: skipping for now...
  public fromSweptPolygon(points: Point3d[], directions: Vector3d[]): ClipPlaneSet;
  public parseConcavePolygonPlanes(...)

Uses bsplines... skipping for now:
  public appendIntervalsClipPlaneSetFromCurve();

Uses bsplines... skipping for now:
  public isAnyPointInOrOnFrom();

Skipped fromSweptPolygon(...), which is overloaded function from first, due to presence of vu
  public fromSweptPolygon(points: Point3d[], directions: Vector3d[], shapes: Point3d[])
*/
