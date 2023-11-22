/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { assert } from "@itwin/core-bentley";
import { Arc3d } from "../curve/Arc3d";
import { BagOfCurves } from "../curve/CurveCollection";
import { CurveFactory } from "../curve/CurveFactory";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "../curve/CurvePrimitive";
import { AnyCurve, AnyRegion } from "../curve/CurveTypes";
import { GeometryQuery } from "../curve/GeometryQuery";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { Path } from "../curve/Path";
import { RegionBinaryOpType, RegionOps } from "../curve/RegionOps";
import { UnionRegion } from "../curve/UnionRegion";
import { Geometry } from "../Geometry";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";
import { Transform } from "../geometry3d/Transform";
import { XAndY } from "../geometry3d/XYZProps";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { ClipPlane } from "./ClipPlane";
import { ClipPrimitive } from "./ClipPrimitive";
import { ClipVector } from "./ClipVector";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { LineStringOffsetClipperContext } from "./internalContexts/LineStringOffsetClipperContext";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";

/**
 * Enumerated type for describing where geometry lies with respect to clipping planes.
 * @public
 */
export enum ClipPlaneContainment {
  /** All points inside. */
  StronglyInside = 1,
  /** Inside/outside state unknown. */
  Ambiguous = 2,
  /** All points outside. */
  StronglyOutside = 3,
}
/**
 * Enumeration of ways to handle an intermediate fragment from a clipping step.
 * @public
 */
export enum ClipStepAction {
  /** Pass fragments directly to final accepted "in" state. */
  acceptIn = 1,
  /** Pass fragments directly to final accepted "out" state. */
  acceptOut = -1,
  /** Forward fragments to subsequent steps. */
  passToNextStep = 0,
}

/**
 * Enumerated type for describing what must yet be done to clip a piece of geometry.
 * @public
 */
export enum ClipStatus {
  /** Some geometry may cross the clip boundaries */
  ClipRequired,
  /** Geometry is clearly outside */
  TrivialReject,
  /** Geometry is clearly inside */
  TrivialAccept,
}

/**
 * An object containing clipping planes that can be used to clip geometry.
 * @public
 */
export interface Clipper {
  /** Test if `point` is on or inside the Clipper's volume. */
  isPointOnOrInside(point: Point3d, tolerance?: number): boolean;
  /**
   * Find the parts of the line segment (if any) that is within the convex clip volume.
   * * The line segment is defined by `pointA` and `pointB`.
   * * The input fractional interval from `fraction0` to `fraction1` (increasing) is the active part to consider.
   * * To clip to the usual bounded line segment, start with fractions (0,1).
   * If the clip volume is unbounded, the line interval may also be unbounded.
   * * An unbounded line portion will have fraction coordinates positive or negative `Number.MAX_VALUE`.
   * @param f0 fraction that is the initial lower fraction of the active interval (e.g., 0.0 for bounded segment).
   * @param f1 fraction that is the initial upper fraction of the active interval (e.g., 1.0 for bounded segment).
   * @param pointA segment start (fraction 0)
   * @param pointB segment end (fraction 1)
   * @param announce function to be called to announce a fraction interval that is within the convex clip volume.
   * @returns true if a segment was announced, false if entirely outside.
   */
  announceClippedSegmentIntervals(
    f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber
  ): boolean;
  /**
   * Find the portion (or portions) of the arc (if any) that are within the convex clip volume.
   * @param arc the arc to be clipped.
   * @param announce function to be called to announce a fraction intervals that are within the convex clip volume.
   * @returns true if one or more arcs portions were announced, false if entirely outside.
   */
  announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean;
  /**
   * Optional polygon clip method.
   * * This is expected to be implemented by planar clip structures.
   * * This is unimplemented for curve clippers (e.g. sphere) for which polygon clip result has curved edges.
   * * The input polygon must be convex.
   */
  appendPolygonClip?: AppendPolygonClipFunction;
}
/**
 * Signature of method to execute polygon clip, distributing fragments of xyz among insideFragments and outsideFragments
 * @param xyz convex polygon. This is not changed.
 * @param insideFragments Array to receive "inside" fragments. Each fragment is a GrowableXYZArray grabbed from
 * the cache. This is NOT cleared.
 * @param outsideFragments Array to receive "outside" fragments. Each fragment is a GrowableXYZArray grabbed from
 * the cache. This is NOT cleared.
 * @param arrayCache cache for reusable GrowableXYZArray.
 */
type AppendPolygonClipFunction = (
  xyz: IndexedXYZCollection,
  insideFragments: GrowableXYZArray[],
  outsideFragments: GrowableXYZArray[],
  arrayCache: GrowableXYZArrayCache
) => void;

/**
 * Interface for clipping convex polygons.
 * Supported by:
 * * AlternatingCCTreeNode
 * * ConvexClipPlaneSet
 * @public
 */
export interface PolygonClipper {
  appendPolygonClip: AppendPolygonClipFunction;
}
/**
 * Class whose various static methods are functions for clipping geometry
 * @public
 */
export class ClipUtilities {
  // on-demand scratch objects for method implementations. If you use one, make sure it isn't already being used in scope.
  private static _workTransform?: Transform;
  private static _workRange?: Range3d;
  private static _workClipper?: ConvexClipPlaneSet;

  private static _selectIntervals01TestPoint = Point3d.create();
  /**
   * Augment the unsortedFractionsArray with 0 and 1
   * * sort
   * * test the midpoint of each interval with `clipper.isPointOnOrInside`
   * * pass accepted intervals to `announce(f0,f1,curve)`
   */
  public static selectIntervals01(
    curve: CurvePrimitive,
    unsortedFractions: GrowableFloat64Array,
    clipper: Clipper,
    announce?: AnnounceNumberNumberCurvePrimitive,
  ): boolean {
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
   * Announce triples of (low, high, cp) for each entry in intervals.
   * @param intervals source array
   * @param cp CurvePrimitive for announcement
   * @param announce function to receive data
   */
  public static announceNNC(
    intervals: Range1d[], cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive,
  ): boolean {
    if (announce) {
      for (const ab of intervals) {
        announce(ab.low, ab.high, cp);
      }
    }
    return intervals.length > 0;
  }
  /**
   * Compute and return portions of the input curve that are within the clipper.
   * @param curve input curve, unmodified
   * @param clipper used to compute the clipped components
   * @return array of clipped curves
   */
  public static collectClippedCurves(curve: CurvePrimitive, clipper: Clipper): CurvePrimitive[] {
    const result: CurvePrimitive[] = [];
    curve.announceClipIntervals(
      clipper,
      (fraction0: number, fraction1: number, curveA: CurvePrimitive) => {
        if (fraction1 !== fraction0) {
          const partialCurve = curveA.clonePartialCurve(fraction0, fraction1);
          if (partialCurve)
            result.push(partialCurve);
        }
      },
    );
    return result;
  }
  /**
   * Compute and return the portions of the input region that are within the clipper.
   * @param region input region, unmodified
   * @param clipper used to compute the clipped components
   * @return clipped subregion, as a single `AnyRegion`
   */
  public static clipAnyRegion(region: AnyRegion, clipper: Clipper): AnyRegion | undefined {
    let result: UnionRegion | undefined;
    // Create "local region" which is the result of rotating region to make
    // it parallel to the xy-plane and then translating it to the xy-plane.
    const localToWorld = ClipUtilities._workTransform = FrameBuilder.createRightHandedFrame(undefined, region, ClipUtilities._workTransform);
    if (!localToWorld)
      return result;
    const worldToLocal = localToWorld?.inverse();
    if (!worldToLocal)
      return result;
    const localRegion = region.cloneTransformed(worldToLocal) as AnyRegion;
    if (!localRegion)
      return result;
    // We can only clip convex polygons with our clipper machinery, but the input region doesn't have to be
    // convex or even a polygon. We get around this limitation by using a Boolean operation, which admits
    // *any* planar regions, albeit in local coordinates. First, we clip a rectangle that covers the input region
    // (in world coordinates), then we intersect the resulting fragments with the input region in local coordinates.
    // Finally, we assemble the results into a UnionRegion back in world coordinates.
    const localRegionRange = ClipUtilities._workRange = localRegion.range();
    const xLength = localRegionRange.xLength();
    const yLength = localRegionRange.yLength();
    const rectangle = LineString3d.createRectangleXY(localRegionRange.low, xLength, yLength, true);
    rectangle.tryTransformInPlace(localToWorld);
    // Clip the rectangle to produce fragment(s) which we can Boolean intersect with the input region.
    const insideFragments: GrowableXYZArray[] = [];
    const outsideFragments: GrowableXYZArray[] = [];
    const cache = new GrowableXYZArrayCache();
    clipper.appendPolygonClip?.(rectangle.packedPoints, insideFragments, outsideFragments, cache);
    if (insideFragments.length === 0)
      return result;
    // Create the "clipped region".
    for (const fragment of insideFragments) {
      const loop = Loop.createPolygon(fragment);
      loop.tryTransformInPlace(worldToLocal);
      const clippedLocalRegion = RegionOps.regionBooleanXY(localRegion, loop, RegionBinaryOpType.Intersection);
      if (clippedLocalRegion) {
        clippedLocalRegion.tryTransformInPlace(localToWorld);
        if (!result)
          result = (clippedLocalRegion instanceof UnionRegion) ? clippedLocalRegion : UnionRegion.create(clippedLocalRegion);
        else if (!result.tryAddChild(clippedLocalRegion))
          result.children.push(...(clippedLocalRegion as UnionRegion).children);
      }
    }
    return result;
  }
  /**
   * Compute and return portions of the input curve or region that are within the clipper.
   * @param curve input curve or region, unmodified
   * @param clipper used to compute the clipped components
   * @return array of clipped components of the input curve or region that lie inside the clipper
   */
  public static clipAnyCurve(curve: AnyCurve, clipper: Clipper): AnyCurve[] {
    if (curve instanceof CurvePrimitive)
      return ClipUtilities.collectClippedCurves(curve, clipper);
    if (curve.isAnyRegion()) {
      const ret = ClipUtilities.clipAnyRegion(curve, clipper);
      return ret ? [ret] : [];
    }
    const result: AnyCurve[] = [];
    if (curve instanceof Path || curve instanceof BagOfCurves) {
      for (const child of curve.children) {
        const partialClip = ClipUtilities.clipAnyCurve(child, clipper);
        result.push(...partialClip);
      }
    }
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
  public static clipPolygonToClipShapeReturnGrowableXYZArrays(
    polygon: Point3d[], clipShape: ClipPrimitive,
  ): GrowableXYZArray[] {
    const output: GrowableXYZArray[] = [];
    const clipper = clipShape.fetchClipPlanesRef();
    // NEEDS WORK -- what if it is a mask !!!!
    if (clipper) {
      clipper.polygonClip(polygon, output);
    }
    return output;
  }
  /**
   * Given an array of points, test for trivial containment conditions.
   * * ClipStatus.TrivialAccept if all points are in any one of the convexSet's.
   * * ClipStatus.ClipRequired if (in any single convexSet) there were points on both sides of any single plane.
   * * ClipStatus.TrivialReject if neither of those occurred.
   */
  public static pointSetSingleClipStatus(
    points: GrowableXYZArray, planeSet: UnionOfConvexClipPlaneSets, tolerance: number,
  ): ClipStatus {
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
  public static announceLoopsOfConvexClipPlaneSetIntersectRange(
    convexSet: ConvexClipPlaneSet | ClipPlane,
    range: Range3d,
    loopFunction: (loopPoints: GrowableXYZArray) => void,
    includeConvexSetFaces: boolean = true,
    includeRangeFaces: boolean = true,
    ignoreInvisiblePlanes = false,
  ): void {
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
   * Return a (possibly empty) array of geometry (Loops !!) which are facets of the intersection of the convex set
   * intersecting a range.
   * * Return zero length array for (a) null range or (b) no intersections
   * @param allClippers convex or union clipper
   * @param range range to intersect
   * @param includeConvexSetFaces if false, do not compute facets originating as convex set planes.
   * @param includeRangeFaces if false, do not compute facets originating as range faces
   * @param ignoreInvisiblePlanes if true, do NOT compute a facet for convex set faces marked invisible.
   */
  public static loopsOfConvexClipPlaneIntersectionWithRange(
    allClippers: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPlane,
    range: Range3d,
    includeConvexSetFaces: boolean = true,
    includeRangeFaces: boolean = true,
    ignoreInvisiblePlanes = false,
  ): GeometryQuery[] {
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
   * * If `observeInvisibleFlag` is true, the "invisible" properties are observed, and "invisible" parts do not restrict the range.
   * @param clipper
   * @param range non-null range.
   * @param observeInvisibleFlag indicates how "invisible" bit is applied for ClipPrimitive.
   */
  public static rangeOfClipperIntersectionWithRange(
    clipper: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPrimitive | ClipVector | undefined,
    range: Range3d,
    observeInvisibleFlag: boolean = true,
  ): Range3d {
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
  public static doesClipperIntersectRange(
    clipper: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPrimitive | ClipVector | undefined,
    range: Range3d,
    observeInvisibleFlag: boolean = true,
  ): boolean {
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
  public static doesConvexClipPlaneSetIntersectRange(
    convexSet: ConvexClipPlaneSet,
    range: Range3d,
    includeConvexSetFaces: boolean = true,
    includeRangeFaces: boolean = true,
    ignoreInvisiblePlanes = false,
  ): boolean {
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
   * Create a clipper from the transformed range.
   * @param range input range to create clipper from
   * @param transform how to transform the range (NOTE: applied to the range faces without swelling the range volume)
   * @param degeneratePoints optionally populated with the 1 or 2 points defining the transformed range if it is degenerate (all points colinear/coincident); otherwise untouched
   * @returns newly constructed clipper. If no clip planes could be computed, fill `degeneratePoints` and return undefined.
  */
  private static createClipperFromTransformedRange3d(range: Range3d, transform: Transform, degeneratePoints?: Point3d[]): ConvexClipPlaneSet | undefined {
    if (!transform)
      transform = Transform.createIdentity();
    const builder = PolyfaceBuilder.create();
    builder.addTransformedRangeMesh(transform, range);
    const mesh = builder.claimPolyface();
    const clipper = this._workClipper = ConvexClipPlaneSet.createConvexPolyface(mesh, this._workClipper).clipper;
    if (clipper.planes.length > 0)
      return clipper;
    // no faces found in the compressed mesh
    if (degeneratePoints) {
      assert(mesh.data.point.length <= 2);
      for (let i = 0; i < 2; ++i) {
        const point = mesh.data.point.getPoint3dAtCheckedPointIndex(i);
        if (point)
          degeneratePoints.push(point);
      }
    }
    return undefined;
  }
  /**
   * Handle pathological cases of range-range intersection, where one of the ranges defines no area or volume (is a line segment or single point).
   * @param range local range to intersect with the point/segment
   * @param points isolated local point, or local segment's start and end
   * @param localToWorld optional transform for output range
   * @param intersection optional range of the intersection, in world coordinates, or null range if no intersection.
   * @returns whether the point/segment intersects the range
   */
  private static rangeIntersectPointOrSegment(range: Range3d, points: Point3d[], localToWorld?: Transform, intersection?: Range3d): boolean {
    const announceInterval: AnnounceNumberNumberCurvePrimitive | undefined = intersection ?
      (f0: number, f1: number, cp: CurvePrimitive) => {
        intersection.extendPoint(cp.fractionToPoint(f0), localToWorld);
        intersection.extendPoint(cp.fractionToPoint(f1), localToWorld);
        } : undefined;
    let hasIntersection = false;
    if (points.length > 1) {
      const segment = LineSegment3d.createCapture(points[0], points[1]);
      const clipper = ConvexClipPlaneSet.createRange3dPlanes(range);
      hasIntersection = segment.announceClipIntervals(clipper, announceInterval);
    } else if (points.length > 0) {
      hasIntersection = range.containsPoint(points[0]);
      if (hasIntersection && intersection)
        intersection.extendPoint(points[0], localToWorld);
    }
    return hasIntersection;
  }
  /**
   * Test for intersection of two ranges in different local coordinates.
   * * Useful for clash detection of elements in iModels, using their stored (tight) local ranges and placement transforms.
   * @param range0 first range in local coordinates
   * @param local0ToWorld placement transform for first range
   * @param range1 second range in local coordinates
   * @param local1ToWorld placement transform for second range. Assumed to be invertible.
   * @param range1Margin optional signed local distance to expand/contract the second range before intersection. Positive expands.
   * @return whether the local ranges are adjacent or intersect. Also returns false if local1ToWorld is singular.
   */
  public static doLocalRangesIntersect(
    range0: Range3d, local0ToWorld: Transform, range1: Range3d, local1ToWorld: Transform, range1Margin?: number,
  ): boolean {
    const worldToLocal1 = this._workTransform = local1ToWorld.inverse(this._workTransform);
    if (!worldToLocal1)
      return false;
    let myRange1 = range1;
    if (range1Margin) {
      myRange1 = this._workRange = range1.clone(this._workRange);
      myRange1.expandInPlace(range1Margin);
    }
    const degeneratePoints: Point3d[] = [];
    const local0ToLocal1 = worldToLocal1.multiplyTransformTransform(local0ToWorld, worldToLocal1);
    // convert range0 into a clipper in local1 coordinates, then intersect with range1
    const clipper = this.createClipperFromTransformedRange3d(range0, local0ToLocal1, degeneratePoints);
    if (clipper)
      return this.doesClipperIntersectRange(clipper, myRange1);
    return this.rangeIntersectPointOrSegment(myRange1, degeneratePoints, local1ToWorld);
  }
  /**
   * Compute the range of the intersection between two local (e.g., element-aligned) ranges.
   * @param range0 first range in local coordinates
   * @param local0ToWorld placement transform for first range
   * @param range1 second range in local coordinates
   * @param local1ToWorld placement transform for second range. Assumed to be invertible.
   * @param result optional pre-allocated range to fill and return
   * @return range of the intersection (aligned to world axes). Returns null range if local1ToWorld is singular.
   */
  public static rangeOfIntersectionOfLocalRanges(range0: Range3d, local0ToWorld: Transform, range1: Range3d, local1ToWorld: Transform, result?: Range3d): Range3d {
    const myResult = Range3d.createNull(result);
    const worldToLocal1 = this._workTransform = local1ToWorld.inverse(this._workTransform);
    if (!worldToLocal1)
      return myResult;
    const degeneratePoints: Point3d[] = [];
    const local0ToLocal1 = worldToLocal1.multiplyTransformTransform(local0ToWorld, worldToLocal1);
    // convert range0 into a clipper in local1 coordinates, then intersect with range1
    const clipper = this.createClipperFromTransformedRange3d(range0, local0ToLocal1, degeneratePoints);
    if (clipper)
      this.announceLoopsOfConvexClipPlaneSetIntersectRange(clipper, range1, (loopPoints: GrowableXYZArray) => { loopPoints.extendRange(myResult, local1ToWorld); });
    else
      this.rangeIntersectPointOrSegment(range1, degeneratePoints, local1ToWorld, myResult);
    return myResult;
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
   * * The use case for this is that a multi-step clipper (e.g. UnionOfConvexClipPlaneSets) may produce many fragments,
   * and then be able to determine that they really are the original pre-clip polygon unchanged.
   * * The baseCount+1 case is the case where the entire original singleton is still a singleton and can be left alone.
   * * Calling this replacer shuffles the original back into the fragment array, and drops the fragments.
   * * This determination is solely within the logic of the caller.
   * @param shards array of fragments
   * @param baseCount original count
   * @param singleton single array which may be a replacement for multiple fragments
   * @param cache cache for array management
   */
  public static restoreSingletonInPlaceOfMultipleShards(
    fragments: GrowableXYZArray[] | undefined, baseCount: number, singleton: IndexedXYZCollection, arrayCache: GrowableXYZArrayCache,
  ): void {
    if (fragments && fragments.length > baseCount + 1) {
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
  public static createXYOffsetClipFromLineString(
    points: Point3d[] | IndexedXYZCollection, leftOffset: number, rightOffset: number, z0: number, z1: number,
  ): UnionOfConvexClipPlaneSets {
    if (Array.isArray(points)) {
      return LineStringOffsetClipperContext.createClipBetweenOffsets(
        new Point3dArrayCarrier(points), leftOffset, rightOffset, z0, z1);
    }
    return LineStringOffsetClipperContext.createClipBetweenOffsets(points, leftOffset, rightOffset, z0, z1);
  }
  /** If data.length >= minLength threshold, push it to destination; if smaller drop it back to the cache. */
  public static captureOrDrop(
    data: GrowableXYZArray, minLength: number, destination: GrowableXYZArray[], cache: GrowableXYZArrayCache,
  ): void {
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
  public static clipSegmentToLLeftOfLineXY(
    linePointA: XAndY, linePointB: XAndY, segmentPoint0: XAndY, segmentPoint1: XAndY, interval: Range1d, absoluteTolerance: number = 1.0e-14,
  ): void {
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
        interval.setNull();
    } else if (h0 * h1 < 0.0) {
      // strict crossing with safe fraction . . .
      const fraction = -h0 / (h1 - h0);
      if (h0 < 0.0) {
        return interval.intersectRangeXXInPlace(0.0, fraction);
      } else {
        return interval.intersectRangeXXInPlace(fraction, 1.0);
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
  public static clipSegmentToCCWTriangleXY(
    pointA: XAndY, pointB: XAndY, pointC: XAndY, segment0: XAndY, segment1: XAndY, interval: Range1d, absoluteTolerance: number = 1.0e-14,
  ): void {
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
  public static clipSegmentBelowPlaneXY(
    plane: Plane3dByOriginAndUnitNormal, segmentPoint0: XAndY, segmentPoint1: XAndY, interval: Range1d, absoluteTolerance: number = 1.0e-14,
  ): void {
    // negative is in positive is out ...
    const h0 = plane.altitudeXY(segmentPoint0.x, segmentPoint0.y);
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
      if (h0 < 0.0) {
        return interval.intersectRangeXXInPlace(0.0, fraction);
      } else {
        return interval.intersectRangeXXInPlace(fraction, 1.0);
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
  public static clipSegmentBelowPlanesXY(
    planes: Plane3dByOriginAndUnitNormal[], segment0: XAndY, segment1: XAndY, interval: Range1d, signedAltitude: number = 1.0e-14,
  ): void {
    const numPlanes = planes.length;
    for (let i = 0; (!interval.isNull) && i < numPlanes; i++) {
      this.clipSegmentBelowPlaneXY(planes[i], segment0, segment1, interval, signedAltitude);
    }
  }
  /**
   * Pass line segments from a polyline to the clipper.  Resolve the fractional clips to simple points for announcement.
   * @param clipper clipper to call
   * @param points polyline whose segments are passed to the clipper
   * @param announce caller's handler for simple point pairs.
   */
  public static announcePolylineClip(
    clipper: Clipper, points: Point3d[], announce: (point0: Point3d, point1: Point3d) => void,
  ): void {
    for (let i = 0; i + 1 < points.length; i++) {
      clipper.announceClippedSegmentIntervals(0, 1, points[i], points[i + 1],
        (f0: number, f1: number) => {
          announce(points[i].interpolate(f0, points[i + 1]), points[i].interpolate(f1, points[i + 1]));
        });
    }
  }
  /**
   * Pass line segments from a polyline to the clipper.  Sum the lengths of the clipped pieces.  Return the sum.
   * @param clipper clipper to call
   * @param points polyline whose segments are passed to the clipper
   */
  public static sumPolylineClipLength(clipper: Clipper, points: Point3d[]): number {
    let s = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i].distance(points[i + 1]);
      clipper.announceClippedSegmentIntervals(0, 1, points[i], points[i + 1],
        (f0: number, f1: number) => { s += Math.abs(f1 - f0) * a; });
    }
    return s;
  }
  /**
   * Pass polygon `xyz` through a sequence of PolygonClip steps.
   * * At the outset, `xyz` is the (only) entry in a set of candidates.
   * * For each clipper, each candidate is presented for appendPolygon to inside and outside parts.
   * * Each (in,out) result is distributed among (acceptedIn, acceptedOut, candidates) according to
   *      (inAction, outAction)
   * * At the end, all remaining candidates are distributed among (acceptedIn, acceptedOut, finalUnknown)
   *     according to finalAction
   * * Any clipper that does not have an appendPolygonClip method is skipped.
   * @param xyz
   * @param clippers
   * @param acceptedIn
   * @param acceptedOut
   * @param finalCandidates
   * @param inAction
   * @param outAction
   * @param finalCandidateAction
   */
  public static doPolygonClipSequence(
    xyz: IndexedXYZCollection,
    clippers: Clipper[],
    acceptedIn: GrowableXYZArray[] | undefined,
    acceptedOut: GrowableXYZArray[] | undefined,
    finalCandidates: GrowableXYZArray[] | undefined,
    inAction: ClipStepAction,
    outAction: ClipStepAction,
    finalFragmentAction: ClipStepAction,
    arrayCache: GrowableXYZArrayCache | undefined,
  ) {
    if (arrayCache === undefined)
      arrayCache = new GrowableXYZArrayCache();
    let candidates = [arrayCache.grabAndFill(xyz)];
    let nextCandidates: GrowableXYZArray[] = [];
    const intermediateIn: GrowableXYZArray[] = [];
    const intermediateOut: GrowableXYZArray[] = [];
    const oldInsideCount = acceptedIn ? acceptedIn.length : 0;
    const oldOutsideCount = acceptedOut ? acceptedOut.length : 0;
    let shard;
    // At each convex set, carryForwardA is all the fragments that have been outside all previous convex sets.
    // Clip each such fragment to the current set, sending the outside parts to carryForwardB, which will got to
    // the next clipper. The final surviving carryForward really is out.
    for (const c of clippers) {
      if (c.appendPolygonClip) {
        while (undefined !== (shard = candidates.pop())) {
          c.appendPolygonClip(shard, intermediateIn, intermediateOut, arrayCache);
          distributeFragments(inAction, intermediateIn, acceptedIn, acceptedOut, nextCandidates, arrayCache);
          distributeFragments(outAction, intermediateOut, acceptedIn, acceptedOut, nextCandidates, arrayCache);
          arrayCache.dropToCache(shard);
        }
        // candidates is empty !!
        const temp = candidates; candidates = nextCandidates; nextCandidates = temp;
      }
    }
    distributeFragments(finalFragmentAction, candidates, acceptedIn, acceptedOut, finalCandidates, arrayCache);
    // Note: The following assumes that there were no residual candidates ... need to track if that happened?
    // If nothing was out, the inside fragments can be replaced by the original.
    if (acceptedOut?.length === oldOutsideCount)
      ClipUtilities.restoreSingletonInPlaceOfMultipleShards(acceptedIn, oldInsideCount, xyz, arrayCache);
    // If nothing was in, the outside fragments can be replaced by the original.
    if (acceptedIn?.length === oldInsideCount)
      ClipUtilities.restoreSingletonInPlaceOfMultipleShards(acceptedOut, oldOutsideCount, xyz, arrayCache);
  }
  /** Pass polygon `xyz` through a sequence of PolygonClip steps with "parity" rules */
  public static doPolygonClipParitySequence(
    xyz: IndexedXYZCollection,
    clippers: Clipper[],
    acceptedIn: GrowableXYZArray[] | undefined,
    acceptedOut: GrowableXYZArray[] | undefined,
    arrayCache: GrowableXYZArrayCache | undefined,
  ) {
    if (arrayCache === undefined)
      arrayCache = new GrowableXYZArrayCache();
    let candidatesOut = [arrayCache.grabAndFill(xyz)];
    let candidatesIn: GrowableXYZArray[] = [];
    let nextCandidatesIn: GrowableXYZArray[] = [];
    let nextCandidatesOut: GrowableXYZArray[] = [];
    const intermediateIn: GrowableXYZArray[] = [];
    const intermediateOut: GrowableXYZArray[] = [];
    let shard;
    // at each step ..
    // candidatesIn and candidatesOut are evolved in and out
    // nextCandidatesIn and nextCandidatesOut are EMPTY
    for (const c of clippers) {
      if (c.appendPolygonClip) {
        // (IN,OUT) parts of IN parts distribute to (OUT,IN)
        while (undefined !== (shard = candidatesIn.pop())) {
          c.appendPolygonClip(shard, intermediateIn, intermediateOut, arrayCache);
          distributeFragments(ClipStepAction.acceptOut, intermediateIn, nextCandidatesIn, nextCandidatesOut, undefined, arrayCache);
          distributeFragments(ClipStepAction.acceptIn, intermediateOut, nextCandidatesIn, nextCandidatesOut, undefined, arrayCache);
          arrayCache.dropToCache(shard);
        }
        // (IN,OUT) parts of IN parts distribute to (OUT,IN)
        while (undefined !== (shard = candidatesOut.pop())) {
          c.appendPolygonClip(shard, intermediateIn, intermediateOut, arrayCache);
          distributeFragments(ClipStepAction.acceptIn, intermediateIn, nextCandidatesIn, nextCandidatesOut, undefined, arrayCache);
          distributeFragments(ClipStepAction.acceptOut, intermediateOut, nextCandidatesIn, nextCandidatesOut, undefined, arrayCache);
          arrayCache.dropToCache(shard);
        }
        // reload each candidate step
        const tempA = candidatesIn; candidatesIn = nextCandidatesIn; nextCandidatesIn = tempA;
        const tempB = candidatesOut; candidatesOut = nextCandidatesOut; nextCandidatesOut = tempB;
      }
    }
    // candidatesIn and candidatesOut are final ....
    if (candidatesOut.length === 0)
      acceptedIn?.push(arrayCache.grabAndFill(xyz));
    else if (candidatesOut.length === 0)
      acceptedOut?.push(arrayCache.grabAndFill(xyz));
    else {
      moveFragments(candidatesIn, acceptedIn, arrayCache);
      moveFragments(candidatesOut, acceptedOut, arrayCache);
    }
  }
  /**
   * For each plane of clipper, construct a UnionOfConvexClipPlaneSets for an outer (infinite) convex volume that
   * abuts the outer volume of the neighbor faces.
   */
  public static createComplementaryClips(clipper: ConvexClipPlaneSet): UnionOfConvexClipPlaneSets {
    const planes = clipper.planes;
    const interval = Range1d.createNull();
    const n = planes.length;
    const newClippers: ConvexClipPlaneSet[] = [];
    for (const p of planes) {
      const outerSet = ConvexClipPlaneSet.createEmpty();
      outerSet.addPlaneToConvexSet(p.cloneNegated());
      newClippers.push(outerSet);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ray = CurveFactory.planePlaneIntersectionRay(planes[i], planes[j]);
        if (ray) {
          if (clipper.hasIntersectionWithRay(ray, interval)) {
            // the normal-to-normal vector is bisector (or close to bisector?)
            const newNormal = planes[j].inwardNormalRef.minus(planes[i].inwardNormalRef);
            const plane1 = ClipPlane.createNormalAndPoint(newNormal, ray.origin);
            if (plane1) {
              const plane2 = plane1.cloneNegated();
              newClippers[i].addPlaneToConvexSet(plane1);
              newClippers[j].addPlaneToConvexSet(plane2);
            }
          }
        }
      }
    }
    return UnionOfConvexClipPlaneSets.createConvexSets(newClippers);
  }
}
function moveFragments(
  fragments: GrowableXYZArray[],
  destination: GrowableXYZArray[] | undefined,
  arrayCache: GrowableXYZArrayCache,
) {
  if (destination === undefined)
    arrayCache.dropAllToCache(fragments);
  else {
    for (const f of fragments)
      destination.push(f);
  }
  fragments.length = 0;
}
/**
 * Distribute fragments among acceptedIn, acceptedOut, and passToNextStep as directed by action.
 * * If the indicated destination is unknown, drop the fragments to the arrayCache.
 * @param action destination selector
 * @param fragments fragments to be distributed
 * @param acceptedIn destination for "in"
 * @param acceptedOut destination for "out"
 * @param passToNextStep destination for fragments to be passed to a later step
 * @param arrayCache destination for un-distributed fragments.
 */
function distributeFragments(
  action: ClipStepAction,
  fragments: GrowableXYZArray[],
  acceptedIn: GrowableXYZArray[] | undefined,
  acceptedOut: GrowableXYZArray[] | undefined,
  passToNextStep: GrowableXYZArray[] | undefined,
  arrayCache: GrowableXYZArrayCache,
) {
  let destination;
  if (action === ClipStepAction.acceptIn)
    destination = acceptedIn;
  else if (action === ClipStepAction.acceptOut)
    destination = acceptedOut;
  else if (action === ClipStepAction.passToNextStep)
    destination = passToNextStep;
  // remark: if action is other than the enum values, destination is undefined
  if (destination === undefined)
    arrayCache.dropAllToCache(fragments);
  else {
    for (const f of fragments)
      destination.push(f);
  }
  fragments.length = 0;
}
