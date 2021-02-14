/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Arc3d } from "../curve/Arc3d";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "../curve/CurvePrimitive";
import { GeometryQuery } from "../curve/GeometryQuery";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { ClipPlane } from "./ClipPlane";
import { ClipPrimitive } from "./ClipPrimitive";
import { ClipVector } from "./ClipVector";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { LineStringOffsetClipperContext } from "./internalContexts/LineStringOffsetClipperContext";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { XAndY } from "../geometry3d/XYZProps";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";

/** Enumerated type for describing where geometry lies with respect to clipping planes.
 * @public
 */
export enum ClipPlaneContainment {
  /** All points inside */
  StronglyInside = 1,
  /** Inside/outside state unknown. */
  Ambiguous = 2,
  /** All points outside */
  StronglyOutside = 3,
}

/** Enumerated type for describing what must yet be done to clip a piece of geometry.
 * @public
 */
export enum ClipStatus {
  /** some geometry may cross the clip boundaries */
  ClipRequired,
  /** geometry is clearly outside */
  TrivialReject,
  /** geometry is clearly inside */
  TrivialAccept,
}

/** An object containing clipping planes that can be used to clip geometry.
 * @public
 */
export interface Clipper {
  /** test if `point` is on or inside the Clipper's volume. */
  isPointOnOrInside(point: Point3d, tolerance?: number): boolean;
  /** Find the parts of the line segment  (if any) that is within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * * To clip to the usual bounded line segment, start with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative Number.MAX_VALUE.
   * @param f0 fraction that is the initial lower fraction of the active interval. (e.g. 0.0 for bounded segment)
   * @param f1 fraction that is the initial upper fraction of the active interval.  (e.g. 1.0 for bounded segment)
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean;
  /** Find the portion (or portions) of the arc (if any) that are within the convex clip volume.
   * * The input fractional interval from fraction0 to fraction1 (increasing!!) is the active part to consider.
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if one or more arcs portions were announced, false if entirely outside.
   */
  announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean;
}
/**
 * Interface for clipping polygons.
 * Supported by:
 * * AlternatingCCTreeNode
 * * ConvexClipPlaneSet
 * @public
 */
export interface PolygonClipper {
  /**
   *
   * @param xyz input polygon.  This is not changed.
   * @param insideFragments Array to receive "inside" fragments.  Each fragment is a GrowableXYZArray grabbed from the cache.  This is NOT cleared.
   * @param outsideFragments Array to receive "outside" fragments.  Each fragment is a GrowableXYZArray grabbed from the cache.  This is NOT cleared.
   * @param arrayCache cache for reusable GrowableXYZArray.
   */
  appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache): void;
}
/** Static class whose various methods are functions for clipping geometry
 * @public
 */
export class ClipUtilities {
  private static _selectIntervals01TestPoint = Point3d.create();
  /**
   * * Augment the unsortedFractionsArray with 0 and 1
   * * sort
   * * test the midpoint of each interval with `clipper.isPointOnOrInside`
   * * pass accepted intervals to `announce(f0,f1,curve)`
   */
  public static selectIntervals01(curve: CurvePrimitive, unsortedFractions: GrowableFloat64Array, clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    unsortedFractions.push(0);
    unsortedFractions.push(1);
    unsortedFractions.sort();
    let f0 = unsortedFractions.atUncheckedIndex(0);
    let f1;
    let fMid;
    const testPoint = ClipUtilities._selectIntervals01TestPoint;
    const n = unsortedFractions.length;
    for (let i = 1; i < n; i++) {
      f1 = unsortedFractions.atUncheckedIndex(i);
      if (f1 > f0 + Geometry.smallFraction) {
        fMid = 0.5 * (f0 + f1);
        if (fMid >= 0.0 && fMid <= 1.0) {
          curve.fractionToPoint(fMid, testPoint);
          if (clipper.isPointOnOrInside(testPoint)) {
            if (announce)
              announce(f0, f1, curve);
            else
              return true;
          }
        }
        f0 = f1;
      }
    }
    return false;
  }
  /**
   * Announce triples of (low, high, cp) for each entry in intervals
   * @param intervals source array
   * @param cp CurvePrimitive for announcement
   * @param announce function to receive data
   */
  public static announceNNC(intervals: Range1d[], cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    if (announce) {
      for (const ab of intervals) {
        announce(ab.low, ab.high, cp);
      }
    }
    return intervals.length > 0;
  }

  /** Find portions of the curve that are within the clipper.
   * Collect them into an array of curve primitives.
   */
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
    const outputA = this.clipPolygonToClipShapeReturnGrowableXYZArrays(polygon, clipShape);
    const output = [];
    for (const g of outputA)
      output.push(g.getPoint3dArray());
    return output;
  }

  /**
   * Clip a polygon down to regions defined by each shape of a ClipShape.
   * @return An multidimensional array of points, where each array is the boundary of part of the remaining polygon.
   */
  public static clipPolygonToClipShapeReturnGrowableXYZArrays(polygon: Point3d[], clipShape: ClipPrimitive): GrowableXYZArray[] {
    const output: GrowableXYZArray[] = [];
    const clipper = clipShape.fetchClipPlanesRef();
    // NEEDS WORK -- what if it is a mask !!!!
    if (clipper) {
      clipper.polygonClip(polygon, output);
    }
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
   * Emit point loops for intersection of a convex set with a range.
   * * return zero length array for (a) null range or (b) no intersections
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static announceLoopsOfConvexClipPlaneSetIntersectRange(convexSet: ConvexClipPlaneSet | ClipPlane, range: Range3d, loopFunction: (loopPoints: GrowableXYZArray) => void,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false) {
    const work = new GrowableXYZArray();
    if (includeConvexSetFaces) {
      // Clip convexSet planes to the range and to the rest of the convexSet . .
      if (convexSet instanceof ConvexClipPlaneSet) {
        for (const plane of convexSet.planes) {
          if (ignoreInvisiblePlanes && plane.invisible)
            continue;
          const pointsClippedToRange = plane.intersectRange(range, true);
          const finalPoints = new GrowableXYZArray();
          if (pointsClippedToRange) {
            convexSet.polygonClip(pointsClippedToRange, finalPoints, work, plane);
            if (finalPoints.length > 0)
              loopFunction(finalPoints);
          }
        }
      } else {  // `convexSet` is just one plane ...
        if (ignoreInvisiblePlanes && convexSet.invisible) {
          // skip it !
        } else {
          const pointsClippedToRange = convexSet.intersectRange(range, true);
          if (pointsClippedToRange)
            loopFunction(pointsClippedToRange);
        }
      }
    }

    if (includeRangeFaces) {
      // clip range faces to the convex set . . .
      const corners = range.corners();
      for (let i = 0; i < 6; i++) {
        const indices = Range3d.faceCornerIndices(i);
        const finalPoints = new GrowableXYZArray();
        const lineString = LineString3d.createIndexedPoints(corners, indices);
        if (convexSet instanceof ConvexClipPlaneSet) {
          convexSet.polygonClip(lineString.packedPoints, finalPoints, work);
          if (finalPoints.length > 0)
            loopFunction(finalPoints);
        } else {
          convexSet.clipConvexPolygonInPlace(lineString.packedPoints, work);
          if (lineString.packedPoints.length > 0)
            loopFunction(lineString.packedPoints);
        }
      }
    }
  }

  /**
   * Return a (possibly empty) array of geometry (Loops !!) which are facets of the intersection of the convex set intersecting a range.
   * * return zero length array for (a) null range or (b) no intersections
   * @param allClippers convex or union clipper
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static loopsOfConvexClipPlaneIntersectionWithRange(allClippers: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPlane, range: Range3d,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false): GeometryQuery[] {
    const result: GeometryQuery[] = [];
    if (allClippers instanceof UnionOfConvexClipPlaneSets) {
      for (const clipper of allClippers.convexSets) {
        this.announceLoopsOfConvexClipPlaneSetIntersectRange(clipper, range,
          (points: GrowableXYZArray) => {
            if (points.length > 0) result.push(Loop.createPolygon(points));
          },
          includeConvexSetFaces, includeRangeFaces, ignoreInvisiblePlanes);
      }
    } else if (allClippers instanceof ConvexClipPlaneSet || allClippers instanceof ClipPlane) {
      this.announceLoopsOfConvexClipPlaneSetIntersectRange(allClippers, range,
        (points: GrowableXYZArray) => {
          if (points.length > 0) result.push(Loop.createPolygon(points));
        },
        includeConvexSetFaces, includeRangeFaces, ignoreInvisiblePlanes);
    }
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
      (points: GrowableXYZArray) => {
        if (points.length > 0) result.extendArray(points);
      },
      true, true, false);
    return result;
  }
  /**
   * Return the range of various types of clippers
   * * `ConvexClipPlaneSet` -- dispatch to `rangeOfConvexClipPlaneSetIntersectionWithRange`
   * * `UnionOfConvexClipPlaneSet` -- union of ranges of member `ConvexClipPlaneSet`
   * * `ClipPrimitive` -- access its `UnionOfConvexClipPlaneSet`.
   * * `ClipVector` -- intersection of the ranges of its `ClipPrimitive`.
   * * `undefined` -- entire input range.
   * * If `observeInvisibleFlag` is false, the "invisible" properties are ignored, and this effectively returns the range of the edge work of the members
   * * If `observeInvisibleFlag` is false, the "invisible" properties are observed, and "invisible" parts do not restrict the range.
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
   * * `UnionOfConvexClipPlaneSet` -- union of ranges of member `ConvexClipPlaneSet`
   * * `ClipPrimitive` -- access its `UnionOfConvexClipPlaneSet`.
   * * `ClipVector` -- intersection of the ranges of its `ClipPrimitive`.
   * * `undefined` -- entire input range.
   * * If `observeInvisibleFlag` is false, the "invisible" properties are ignored, and holes do not affect the result.
   * * If `observeInvisibleFlag` is true, the "invisible" properties are observed, and may affect the result.
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
   * Emit point loops for intersection of a convex set with a range.
   * * return zero length array for (a) null range or (b) no intersections
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static doesConvexClipPlaneSetIntersectRange(convexSet: ConvexClipPlaneSet, range: Range3d,
    includeConvexSetFaces: boolean = true, includeRangeFaces: boolean = true, ignoreInvisiblePlanes = false): boolean {
    const work = new GrowableXYZArray();
    if (includeConvexSetFaces) {
      // Clip convexSet planes to the range and to the rest of the convexSet . .
      for (const plane of convexSet.planes) {
        if (ignoreInvisiblePlanes && plane.invisible)
          continue;
        const pointsClippedToRange = plane.intersectRange(range, true);
        if (pointsClippedToRange) {
          const finalPoints = new GrowableXYZArray();
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
        const finalPoints = new GrowableXYZArray();
        const lineString = LineString3d.createIndexedPoints(corners, indices);
        convexSet.polygonClip(lineString.packedPoints, finalPoints, work);
        if (finalPoints.length > 0)
          return true;
      }
    }
    return false;
  }
  /**
   * Test if `obj` is a `Clipper` object.
   * * This is implemented by testing for each of the methods in the `Clipper` interface.
   */
  public static isClipper(obj: any): boolean {
    if (obj) {
      if (obj.isPointOnOrInside
        && obj.announceClippedSegmentIntervals
        && obj.announceClippedArcIntervals)
        return true;
    }
    return false;
  }
  /**
   * Specialized logic for replacing clip fragments by an equivalent singleton.
   * * If there are baseCount + 1 or fewer fragments, do nothing.
   * * If there are more than baseCount+1 fragments:
   *   * drop them all to the cache
   *   * push a copy of the singleton.
   * * The use case for this is that a multi-step clipper (e.g. UnionOfConvexClipPlaneSets) may produce many fragments, and then be able to determine
   *     that they really are the original pre-clip polygon unchanged.
   * * The baseCount+1 case is the case where the entire original singleton is still a singleton and can be left alone.
   * * Calling this replacer shuffles the original back into the fragment array, and drops the fragments.
   * * This determination is solely within the logic of the caller.
   * @param shards array of fragments
   * @param baseCount original count
   * @param singleton single array which may be a replacement for multiple fragments
   * @param cache cache for array management
   */
  public static restoreSingletonInPlaceOfMultipleShards(fragments: GrowableXYZArray[], baseCount: number, singleton: GrowableXYZArray, arrayCache: GrowableXYZArrayCache) {
    if (fragments.length > baseCount + 1) {
      while (fragments.length > baseCount) {
        const f = fragments.pop();
        arrayCache.dropToCache(f);
      }
      fragments.push(arrayCache.grabAndFill(singleton));
    }
  }

  /**
   * Create a UnionOfConvexClipPlaneSets for a volume defined by a path and offsets.
   * @param points points along the path.
   * @param positiveOffsetLeft offset to left.  0 is clip on the path.
   * @param positiveOffsetRight offset to the right.  0 is clip on the path.
   * @param z0 z for lower clipping plane.  If undefined, unbounded in positive z
   * @param z1 z for upper clipping plane.  If undefined, unbounded in negative z.
   * @alpha
   */
  public static createXYOffsetClipFromLineString(points: Point3d[] | IndexedXYZCollection,
    leftOffset: number, rightOffset: number, z0: number, z1: number): UnionOfConvexClipPlaneSets {
    if (Array.isArray(points)) {
      return LineStringOffsetClipperContext.createClipBetweenOffsets(
        new Point3dArrayCarrier(points), leftOffset, rightOffset, z0, z1);
    }
    return LineStringOffsetClipperContext.createClipBetweenOffsets(points, leftOffset, rightOffset, z0, z1);
  }
  /** if data.length >= minLength threshold, push it to destination; if smaller drop it back to the cache.
   */
  public static captureOrDrop(data: GrowableXYZArray, minLength: number, destination: GrowableXYZArray[], cache: GrowableXYZArrayCache) {
    if (data.length >= minLength)
      destination.push(data);
    else
      cache.dropToCache(data);
  }
/**
 * Find the portion of a line within a half-plane clip.
 * * The half-plane clip is to the left of the line from clipA to clipB.
 * * The original clipped segment has fractions 0 and 1 at respective segment points.
 * * Caller initializes the interval
 * * This method reduces the interval size.
 * * See clipSegmentToCCWTriangleXY for typical use.
 * @param linePointA First point of clip line
 * @param linePointB Second point of clip line
 * @param segmentPoint0 First point of clipped segment
 * @param segmentPoint1 Second point of clipped segment
 * @param interval Live interval.
   * @param absoluteTolerance absolute tolerance for both cross product values to indicate "on" the line
 */
  public static clipSegmentToLLeftOfLineXY(linePointA: XAndY, linePointB: XAndY, segmentPoint0: XAndY, segmentPoint1: XAndY, interval: Range1d,
  absoluteTolerance: number = 1.0e-14) {
  const ux = linePointB.x - linePointA.x;
  const uy = linePointB.y - linePointA.y;
  // negative is in positive is out ...
  const h0 = -(ux * (segmentPoint0.y - linePointA.y) - uy * (segmentPoint0.x - linePointA.x));
    const h1 = -(ux * (segmentPoint1.y - linePointA.y) - uy * (segmentPoint1.x - linePointA.x));
    if (h0 < absoluteTolerance && h1 < absoluteTolerance) {
      // The entire segment is in .....
      return;
      }
  if (h0 * h1 > 0.0) {
    if (h0 > 0.0)
      interval.setNull ();
  } else if (h0 * h1 < 0.0) {
  // strict crossing with safe fraction . . .
  const fraction = -h0 / (h1 - h0);
  if (h0 < 0.0){
    return interval.intersectRangeXXInPlace (0.0, fraction);
    }else {
      return interval.intersectRangeXXInPlace (fraction, 1.0);
    }
  } else {
    // There is an exact hit at one end, possibly non-zero at the other ... the sign of either determines which side is in play
    // A zero and a zero or negative is entirely in, which does not alter the prior clip.
    if (h0 > 0.0) {
      interval.intersectRangeXXInPlace(1.0, 1.0);
    } else if (h1 > 0.0) {
      interval.intersectRangeXXInPlace(0.0, 0.0);
    }
  }
}
  /**
   * Clip an interval of a line segment to a triangle.
   * * Triangle is assumed CCW
   * @param pointA point of triangle.
   * @param pointB point of triangle.
   * @param pointC point of triangle.
   * @param segment0 start of segment
   * @param segment1 end of segment
   * @param interval Pre-initialized interval of live part of segment
   * @param absoluteTolerance absolute tolerance for begin "on a line"
   */
  public static clipSegmentToCCWTriangleXY(pointA: XAndY, pointB: XAndY, pointC: XAndY, segment0: XAndY, segment1: XAndY, interval: Range1d,
      absoluteTolerance: number = 1.0e-14) {
    if (!interval.isNull) {
      this.clipSegmentToLLeftOfLineXY(pointA, pointB, segment0, segment1, interval, absoluteTolerance);
      if (!interval.isNull) {
        this.clipSegmentToLLeftOfLineXY(pointB, pointC, segment0, segment1, interval, absoluteTolerance);
        if (!interval.isNull) {
          this.clipSegmentToLLeftOfLineXY(pointC, pointA, segment0, segment1, interval, absoluteTolerance);
        }
      }
    }
  }

/**
 * Find the portion of a line within a half-plane clip.
 * * The half-plane clip is to the left of the line from clipA to clipB.
 * * The original clipped segment has fractions 0 and 1 at respective segment points.
 * * Caller initializes the interval
 * * This method reduces the interval size.
 * * See clipSegmentToCCWTriangleXY for typical use.
 * @param linePointA First point of clip line
 * @param linePointB Second point of clip line
 * @param segmentPoint0 First point of clipped segment
 * @param segmentPoint1 Second point of clipped segment
 * @param interval Live interval.
   * @param absoluteTolerance absolute tolerance for both cross product values to indicate "on" the line
 */
  public static clipSegmentBelowPlaneXY(plane: Plane3dByOriginAndUnitNormal, segmentPoint0: XAndY, segmentPoint1: XAndY, interval: Range1d,
  absoluteTolerance: number = 1.0e-14) {
  // negative is in positive is out ...
  const h0 = plane.altitudeXY (segmentPoint0.x, segmentPoint0.y);
  const h1 = plane.altitudeXY(segmentPoint1.x, segmentPoint1.y);
  if (h0 < absoluteTolerance && h1 < absoluteTolerance) {
      // The entire segment is in ..... the interval is unaffected.
      return;
      }
  if (h0 * h1 > 0.0) {
    if (h0 > 0.0)
      interval.setNull();
  } else if (h0 * h1 < 0.0) {
  // strict crossing with safe fraction . . .
  const fraction = -h0 / (h1 - h0);
  if (h0 < 0.0){
    return interval.intersectRangeXXInPlace (0.0, fraction);
    }else {
      return interval.intersectRangeXXInPlace (fraction, 1.0);
    }
  } else {
    // There is an exact hit at one end, possibly non-zero at the other ... the sign of either determines which side is in play
    // A zero and a zero or negative is entirely in, which does not alter the prior clip.
    if (h0 > 0.0) {
      interval.intersectRangeXXInPlace(1.0, 1.0);
    } else if (h1 > 0.0) {
      interval.intersectRangeXXInPlace(0.0, 0.0);
    }
  }
}
  /**
   * Clip an interval of a line segment to an array of planes
   * * plane normals assumed OUTWARD
   * * planeAltitude is typically a tolerance a tolerance distance.
   *   * positive altitude makes tha plane move in the direction of the unit normal.
   * @param planes array of planes
   * @param segment0 start of segment
   * @param segment1 end of segment
   * @param interval Pre-initialized interval of live part of segment
   * @param absoluteTolerance absolute tolerance for begin "on a line"
   */
  public static clipSegmentBelowPlanesXY(planes: Plane3dByOriginAndUnitNormal[], segment0: XAndY, segment1: XAndY, interval: Range1d,
    signedAltitude: number = 1.0e-14) {
    const numPlanes = planes.length;
    for (let i = 0; (!interval.isNull) && i < numPlanes; i++) {
      this.clipSegmentBelowPlaneXY(planes[i], segment0, segment1, interval, signedAltitude);
    }
  }
}
