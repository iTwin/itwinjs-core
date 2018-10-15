/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CartesianGeometry */

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { GrowableFloat64Array } from "../geometry3d/GrowableArray";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Arc3d } from "../curve/Arc3d";
import { ClipPlaneContainment, Clipper, ClipUtilities } from "./ClipUtils";
import { AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";

/**
 * A collection of ConvexClipPlaneSets.
 * * A point is "in" the clip plane set if it is "in" one or more of  the ConvexClipPlaneSet
 * * Hence the boolean logic is that the ClipPlaneSet is a UNION of its constituents.
 */
export class UnionOfConvexClipPlaneSets implements Clipper {
  private _convexSets: ConvexClipPlaneSet[];

  public get convexSets() { return this._convexSets; }

  private constructor() {
    this._convexSets = [];
  }
  public toJSON(): any {
    const val: any = [];
    for (const convex of this._convexSets) {
      val.push(convex.toJSON());
    }
    return val;
  }

  public static fromJSON(json: any, result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    result._convexSets.length = 0;
    if (!Array.isArray(json))
      return result;
    for (const thisJson of json) {
      result._convexSets.push(ConvexClipPlaneSet.fromJSON(thisJson));
    }
    return result;
  }

  public static createEmpty(result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    if (result) {
      result._convexSets.length = 0;
      return result;
    }
    return new UnionOfConvexClipPlaneSets();
  }
  /**
   * @returns Return true if all member convex sets are almostEqual to corresponding members of other.  This includes identical order in array.
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
  public static createConvexSets(convexSets: ConvexClipPlaneSet[], result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    for (const set of convexSets)
      result._convexSets.push(set);
    return result;
  }

  public clone(result?: UnionOfConvexClipPlaneSets): UnionOfConvexClipPlaneSets {
    result = result ? result : new UnionOfConvexClipPlaneSets();
    result._convexSets.length = 0;
    for (const convexSet of this._convexSets)
      result._convexSets.push(convexSet.clone());
    return result;
  }

  public addConvexSet(toAdd: ConvexClipPlaneSet) {
    this._convexSets.push(toAdd);
  }

  public testRayIntersect(point: Point3d, direction: Vector3d): boolean {
    const tNear = new Float64Array(1);
    for (const planeSet of this._convexSets) {
      if (ConvexClipPlaneSet.testRayIntersections(tNear, point, direction, planeSet))
        return true;
    }
    return false;
  }

  public getRayIntersection(point: Point3d, direction: Vector3d): number | undefined {
    let nearest = -ConvexClipPlaneSet.hugeVal;
    for (const planeSet of this._convexSets) {
      if (planeSet.isPointInside(point)) {
        return 0.0;
      } else {
        const tNear = new Float64Array(1);
        if (ConvexClipPlaneSet.testRayIntersections(tNear, point, direction, planeSet) && tNear[0] > nearest) {
          nearest = tNear[0];
        }
      }
    }
    if (nearest > - ConvexClipPlaneSet.hugeVal)
      return nearest;
    else
      return undefined;
  }

  public isPointInside(point: Point3d): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointInside(point)) {
        return true;
      }
    }
    return false;
  }

  public isPointOnOrInside(point: Point3d, tolerance: number): boolean {
    for (const convexSet of this._convexSets) {
      if (convexSet.isPointOnOrInside(point, tolerance))
        return true;
    }
    return false;
  }

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
  public polygonClip(input: Point3d[], output: Point3d[][]) {
    output.length = 0;

    for (const convexSet of this._convexSets) {
      const convexSetOutput: Point3d[] = [];
      convexSet.polygonClip(input, convexSetOutput, []);
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
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const breaks = UnionOfConvexClipPlaneSets._clipArcFractionArray;
    breaks.clear();
    for (const convexSet of this._convexSets) {
      for (const clipPlane of convexSet.planes) {
        clipPlane.appendIntersectionRadians(arc, breaks);
      }
    }
    arc.sweep.radiansArraytoPositivePeriodicFractions(breaks);
    return ClipUtilities.selectIntervals01(arc, breaks, this, announce);
  }

  /**
   * Returns range if result does not cover a space of infinity, otherwise undefined.
   * Note: If given a range for output, overwrites it, rather than extending it.
   */
  public getRangeOfAlignedPlanes(transform?: Transform, result?: Range3d): Range3d | undefined {
    const range = Range3d.createNull(result);

    for (const convexSet of this._convexSets) {
      const thisRange = Range3d.createNull();

      if (convexSet.getRangeOfAlignedPlanes(transform, thisRange))
        range.extendRange(thisRange);
    }
    if (range.isNull)
      return undefined;
    else
      return range;
  }

  public multiplyPlanesByMatrix(matrix: Matrix4d) {
    for (const convexSet of this._convexSets) {
      convexSet.multiplyPlanesByMatrix(matrix);
    }
  }

  public setInvisible(invisible: boolean) {
    for (const convexSet of this._convexSets) {
      convexSet.setInvisible(invisible);
    }
  }

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
}
