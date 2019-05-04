/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Arc3d } from "../curve/Arc3d";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";
import { CurvePrimitive, AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { ClipPrimitive } from "./ClipPrimitive";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { Loop } from "../curve/Loop";
import { LineString3d } from "../curve/LineString3d";
import { GeometryQuery } from "../curve/GeometryQuery";
import { ClipVector } from "./ClipVector";

/** Enumerated type for describing where geometry lies with respect to clipping planes.
 * @public
 */
export enum ClipPlaneContainment {
  StronglyInside = 1,
  Ambiguous = 2,
  StronglyOutside = 3,
}

/** Enumerated type for describing what must yet be done to clip a piece of geometry.
 * @public
 */
export enum ClipStatus {
  ClipRequired,
  TrivialReject,
  TrivialAccept,
}

/** An object containing clipping planes that can be used to clip geometry.
 * @public
 */
export interface Clipper {
  isPointOnOrInside(point: Point3d, tolerance?: number): boolean;
  /** Find the parts of the line segment  (if any) that is within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * * To clip to the usual bounded line segment, start with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative Number.MAX_VALUE.
   * @param fraction0 fraction that is the initial lower fraction of the active interval. (e.g. 0.0 for bounded segment)
   * @param fraction1 fraction that is the initial upper fraction of the active interval.  (e.g. 1.0 for bounded segment)
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean;
  announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean;
}

/** Static class whose various methods are functions for clipping geometry
 * @public
 */
export class ClipUtilities {
  private static _selectIntervals01TestPoint = Point3d.create();
  public static selectIntervals01(curve: CurvePrimitive, unsortedFractions: GrowableFloat64Array, clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    unsortedFractions.push(0);
    unsortedFractions.push(1);
    unsortedFractions.sort();
    let f0 = unsortedFractions.atUncheckedIndex(0);
    let f1;
    let fMid;
    const testPoint = ClipUtilities._selectIntervals01TestPoint;
    const n = unsortedFractions.length;
    for (let i = 1; i < n; i++ , f0 = f1) {
      f1 = unsortedFractions.atUncheckedIndex(i);
      fMid = 0.5 * (f0 + f1);
      if (f1 > f0 && (fMid >= 0.0 && fMid <= 1.0)) {
        curve.fractionToPoint(fMid, testPoint);
        if (clipper.isPointOnOrInside(testPoint)) {
          if (announce)
            announce(f0, f1, curve);
          else
            return true;
        }
      }
    }
    return false;
  }
  /**
   * Announce triples of (low, high, cp) for each entry in intervals
   * @param intervals source array
   * @param cp CurvePrimitive for announcement
   * @param announce funtion to receive data
   */
  public static announceNNC(intervals: Range1d[], cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    if (announce) {
      for (const ab of intervals) {
        announce(ab.low, ab.high, cp);
      }
    }
    return intervals.length > 0;
  }

  public static collectClippedCurves(curve: CurvePrimitive, clipper: Clipper): CurvePrimitive[] {
    const result: CurvePrimitive[] = [];
    curve.announceClipIntervals(clipper,
      (fraction0: number, fraction1: number, curveA: CurvePrimitive) => {
        if (fraction1 !== fraction0) {
          const partialCurve = curveA.clonePartialCurve(fraction0, fraction1);
          if (partialCurve)
            result.push(partialCurve);
        }
      });
    return result;
  }

  /**
   * Clip a polygon down to regions defined by each shape of a ClipShape.
   * @return An multidimensional array of points, where each array is the boundary of part of the remaining polygon.
   */
  public static clipPolygonToClipShape(polygon: Point3d[], clipShape: ClipPrimitive): Point3d[][] {
    const output: Point3d[][] = [];
    const clipper = clipShape.fetchClipPlanesRef();
    // NEEDS WORK -- what if it is a mask !!!!
    if (clipper)
      clipper.polygonClip(polygon, output);
    return output;
  }

  /** Given an array of points, test for trivial containment conditions.
   * * ClipStatus.TrivialAccept if all points are in any one of the convexSet's.
   * * ClipStatus.ClipRequired if (in any single convexSet) there were points on both sides of any single plane.
   * * ClipStatus.TrivialReject if neither of those occurred.
   */
  public static pointSetSingleClipStatus(points: GrowableXYZArray, planeSet: UnionOfConvexClipPlaneSets, tolerance: number): ClipStatus {
    if (planeSet.convexSets.length === 0)
      return ClipStatus.TrivialAccept;

    for (const convexSet of planeSet.convexSets) {
      let allOutsideSinglePlane = false, anyOutside = false;

      for (const plane of convexSet.planes) {
        let numInside = 0, numOutside = 0;
        const planeDistance = plane.distance - tolerance;

        const currPt = Point3d.create();
        const currVec = Vector3d.create();
        for (let i = 0; i < points.length; i++) {
          points.getPoint3dAtUncheckedPointIndex(i, currPt);
          currVec.setFrom(currPt);
          currVec.dotProduct(plane.inwardNormalRef) > planeDistance ? numInside++ : numOutside++;
        }

        anyOutside = (numOutside !== 0) ? true : anyOutside;
        if (numInside === 0) {
          allOutsideSinglePlane = true;
          break;
        }
      }

      if (!anyOutside)  // totally inside this set - no clip required
        return ClipStatus.TrivialAccept;
      if (!allOutsideSinglePlane)
        return ClipStatus.ClipRequired;
    }
    return ClipStatus.TrivialReject;
  }

  /**
   * Emit point loops for intersection of a covnex set with a range.
   * * return zero length array for (a) null range or (b) no intersectionis
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static announceLoopsOfConvexClipPlaneSetIntersectRange(convexSet: ConvexClipPlaneSet, range: Range3d, loopFunction: (loopPoints: Point3d[]) => void,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false) {
    const work: Point3d[] = [];
    if (includeConvexSetFaces) {
      // Clip convexSet planes to the range and to the rest of the convexSet . .
      for (const plane of convexSet.planes) {
        if (ignoreInvisiblePlanes && plane.invisible)
          continue;
        const pointsClippedToRange = plane.intersectRange(range, true);
        const finalPoints: Point3d[] = [];
        if (pointsClippedToRange) {
          convexSet.polygonClip(pointsClippedToRange, finalPoints, work, plane);
          if (finalPoints.length > 0)
            loopFunction(finalPoints);
        }
      }
    }

    if (includeRangeFaces) {
      // clip range faces to the convex set . . .
      const corners = range.corners();
      for (let i = 0; i < 6; i++) {
        const indices = Range3d.faceCornerIndices(i);
        const finalPoints: Point3d[] = [];
        const lineString = LineString3d.createIndexedPoints(corners, indices);
        convexSet.polygonClip(lineString.points, finalPoints, work);
        if (finalPoints.length > 0)
          loopFunction(finalPoints);
      }
    }
  }

  /**
   * Return a (possibly empty) array of geometry (Loops !!) which are facets of the intersection of the convex set intersecting a range.
   * * return zero length array for (a) null range or (b) no intersectionis
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static loopsOfConvexClipPlaneIntersectionWithRange(convexSet: ConvexClipPlaneSet, range: Range3d,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false): GeometryQuery[] {
    const result: GeometryQuery[] = [];
    this.announceLoopsOfConvexClipPlaneSetIntersectRange(convexSet, range,
      (points: Point3d[]) => {
        if (points.length > 0) result.push(Loop.createPolygon(points));
      },
      includeConvexSetFaces, includeRangeFaces, ignoreInvisiblePlanes);
    return result;
  }
  /**
   * Return the (possibly null) range of the intersection of the convex set with a range.
   * * The convex set is permitted to be unbounded (e.g. a single plane).  The range parameter provides bounds.
   * @param convexSet convex set for intersection.
   * @param range range to intersect
   */
  public static rangeOfConvexClipPlaneSetIntersectionWithRange(convexSet: ConvexClipPlaneSet, range: Range3d): Range3d {
    const result = Range3d.createNull();
    this.announceLoopsOfConvexClipPlaneSetIntersectRange(convexSet, range,
      (points: Point3d[]) => {
        if (points.length > 0) result.extendArray(points);
      },
      true, true, false);
    return result;
  }
  /**
   * Return the range of various types of clippers
   * * `ConvexClipPlaneSet` -- dispatch to `rangeOfConvexClipPlaneSetIntersectionWithRange`
   * * `UnionOfConvexClipPlaneset` -- union of ranges of member `ConvexClipPlaneSet`
   * * `ClipPrimitive` -- access its `UnionOfConvexClipPlaneSet`.
   * * `ClipVector` -- intersection of the ranges of its `ClipPrimitive`.
   * * `undefined` -- entire input range.
   * * If `observeInvisibleFlag` is false, the "invisbile" properties are ignored, and this effectively returns the range of the edgework of the members
   * * If `observeInvisibleFlag` is false, the "invisbile" properties are observed, and "invisble" parts do not restrict the range.
   * @param clipper
   * @param range non-null range.
   * @param observeInvisibleFlag indicates how "invisible" bit is applied for ClipPrimitive.
   */
  public static rangeOfClipperIntersectionWithRange(clipper: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPrimitive | ClipVector | undefined, range: Range3d, observeInvisibleFlag: boolean = true): Range3d {
    if (clipper === undefined)
      return range.clone();
    if (clipper instanceof ConvexClipPlaneSet)
      return this.rangeOfConvexClipPlaneSetIntersectionWithRange(clipper, range);
    if (clipper instanceof UnionOfConvexClipPlaneSets) {
      const rangeUnion = Range3d.createNull();
      for (const c of clipper.convexSets) {
        const rangeC = this.rangeOfConvexClipPlaneSetIntersectionWithRange(c, range);
        rangeUnion.extendRange(rangeC);
      }
      return rangeUnion;
    }
    if (clipper instanceof ClipPrimitive) {
      if (observeInvisibleFlag && clipper.invisible)
        return range.clone();
      return this.rangeOfClipperIntersectionWithRange(clipper.fetchClipPlanesRef(), range);
    }
    if (clipper instanceof ClipVector) {
      const rangeIntersection = range.clone();
      for (const c of clipper.clips) {
        if (observeInvisibleFlag && c.invisible) {
          // trivial range tests do not expose the effects.   Assume the hole allows everything.
        } else {
          const rangeC = this.rangeOfClipperIntersectionWithRange(c, range, observeInvisibleFlag);
          rangeIntersection.intersect(rangeC, rangeIntersection);
        }
      }
      return rangeIntersection;

    }
    return range.clone();
  }
  /**
   * Test if various types of clippers have any intersection with a range.
   * * This follows the same logic as `rangeOfClipperIntersectionWithRange` but attempts to exit at earliest point of confirmed intersection
   * * `ConvexClipPlaneSet` -- dispatch to `doesConvexClipPlaneSetIntersectRange`
   * * `UnionOfConvexClipPlaneset` -- union of ranges of member `ConvexClipPlaneSet`
   * * `ClipPrimitive` -- access its `UnionOfConvexClipPlaneSet`.
   * * `ClipVector` -- intersection of the ranges of its `ClipPrimitive`.
   * * `undefined` -- entire input range.
   * * If `observeInvisibleFlag` is false, the "invisbile" properties are ignored, and holes do not affect the result.
   * * If `observeInvisibleFlag` is true, the "invisbile" properties are observed, and may affect the result.
   * @param clipper
   * @param range non-null range.
   * @param observeInvisibleFlag indicates how "invisible" bit is applied for ClipPrimitive.
   */
  public static doesClipperIntersectRange(clipper: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPrimitive | ClipVector | undefined, range: Range3d, observeInvisibleFlag: boolean = true): boolean {
    if (clipper === undefined)
      return true;

    if (clipper instanceof ConvexClipPlaneSet)
      return this.doesConvexClipPlaneSetIntersectRange(clipper, range);

    if (clipper instanceof UnionOfConvexClipPlaneSets) {
      for (const c of clipper.convexSets) {
        if (this.doesConvexClipPlaneSetIntersectRange(c, range))
          return true;
      }
      return false;
    }

    if (clipper instanceof ClipPrimitive) {
      if (observeInvisibleFlag && clipper.invisible)    // um is there an easy way to detect range-completely-inside?
        return true;
      return this.doesClipperIntersectRange(clipper.fetchClipPlanesRef(), range);
    }

    if (clipper instanceof ClipVector) {
      const rangeIntersection = range.clone();
      for (const c of clipper.clips) {
        if (observeInvisibleFlag && c.invisible) {
          // trivial range tests do not expose the effects.   Assume the hole allows everything.
        } else {
          const rangeC = this.rangeOfClipperIntersectionWithRange(c, range, observeInvisibleFlag);
          rangeIntersection.intersect(rangeC, rangeIntersection);
        }
      }
      return !rangeIntersection.isNull;
    }
    /** If the case statement above is complete for the variant inputs, this is unreachable .. */
    return false;
  }
  /**
   * Emit point loops for intersection of a covnex set with a range.
   * * return zero length array for (a) null range or (b) no intersectionis
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static doesConvexClipPlaneSetIntersectRange(convexSet: ConvexClipPlaneSet, range: Range3d,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false): boolean {
    const work: Point3d[] = [];
    if (includeConvexSetFaces) {
      // Clip convexSet planes to the range and to the rest of the convexSet . .
      for (const plane of convexSet.planes) {
        if (ignoreInvisiblePlanes && plane.invisible)
          continue;
        const pointsClippedToRange = plane.intersectRange(range, true);
        if (pointsClippedToRange) {
          const finalPoints: Point3d[] = [];
          convexSet.polygonClip(pointsClippedToRange, finalPoints, work, plane);
          if (finalPoints.length > 0)
            return true;
        }
      }
    }

    if (includeRangeFaces) {
      // clip range faces to the convex set . . .
      const corners = range.corners();
      for (let i = 0; i < 6; i++) {
        const indices = Range3d.faceCornerIndices(i);
        const finalPoints: Point3d[] = [];
        const lineString = LineString3d.createIndexedPoints(corners, indices);
        convexSet.polygonClip(lineString.points, finalPoints, work);
        if (finalPoints.length > 0)
          return true;
      }
    }
    return false;
  }
}
