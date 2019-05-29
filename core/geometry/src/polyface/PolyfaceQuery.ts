/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Point3d, Vector3d, Point2d } from "./PointVector";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Polyface, PolyfaceVisitor } from "./Polyface";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { BagOfCurves } from "../curve/CurveCollection";
import { Loop } from "../curve/Loop";
import { LineString3d } from "../curve/LineString3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedEdgeMatcher, SortableEdgeCluster } from "./IndexedEdgeMatcher";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Transform } from "../geometry3d/Transform";
import { Segment1d } from "../geometry3d/Segment1d";
import { PolyfaceBuilder } from "./PolyfaceBuilder";
import { Geometry } from "../Geometry";

/** PolyfaceQuery is a static class whose methods implement queries on a polyface or polyface visitor provided as a parameter to each method.
 * @public
 */
export class PolyfaceQuery {
  /** copy the points from a visitor into a Linestring3d in a Loop object */
  public static visitorToLoop(visitor: PolyfaceVisitor) {
    const ls = LineString3d.createPoints(visitor.point.getPoint3dArray());
    return Loop.create(ls);
  }
  /** Create a linestring loop for each facet of the polyface. */
  public static indexedPolyfaceToLoops(polyface: Polyface): BagOfCurves {
    const result = BagOfCurves.create();
    const visitor = polyface.createVisitor(1);
    while (visitor.moveToNextFacet()) {
      const loop = PolyfaceQuery.visitorToLoop(visitor);
      result.tryAddChild(loop);
    }
    return result;
  }
  /** Return the sum of all facets areas. */
  public static sumFacetAreas(source: Polyface | PolyfaceVisitor): number {
    let s = 0;
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetAreas(source.createVisitor(1));

    const visitor = source as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      s += PolygonOps.sumTriangleAreas(visitor.point.getPoint3dArray());
    }
    return s;
  }
  /** sum volumes of tetrahedra from origin to all facets.
   * * if origin is omitted, the first point encountered (by the visitor) is used as origin.
   * * If the mesh is closed, this sum is the volume.
   * * If the mesh is not closed, this sum is the volume of a mesh with various additional facets
   * from the origin to facets.
  */
  public static sumTetrahedralVolumes(source: Polyface | PolyfaceVisitor, origin?: Point3d): number {
    let s = 0;
    if (source instanceof Polyface)
      return PolyfaceQuery.sumTetrahedralVolumes(source.createVisitor(0), origin);
    let myOrigin = origin;
    const visitor = source as PolyfaceVisitor;
    const facetOrigin = Point3d.create();
    const targetA = Point3d.create();
    const targetB = Point3d.create();
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      if (myOrigin === undefined)
        myOrigin = visitor.point.getPoint3dAtUncheckedPointIndex(0);
      visitor.point.getPoint3dAtUncheckedPointIndex(0, facetOrigin);
      for (let i = 1; i + 1 < visitor.point.length; i++) {
        visitor.point.getPoint3dAtUncheckedPointIndex(i, targetA);
        visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, targetB);
        s += myOrigin.tripleProductToPoints(facetOrigin, targetA, targetB);
      }
    }
    return s / 6.0;
  }
  /** Return the inertia products [xx,xy,xz,xw, yw, etc] integrated over all facets. */
  public static sumFacetSecondAreaMomentProducts(source: Polyface | PolyfaceVisitor, origin: Point3d): Matrix4d {
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetSecondAreaMomentProducts(source.createVisitor(0), origin);
    const products = Matrix4d.createZero();
    const visitor = source as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      PolygonOps.addSecondMomentAreaProducts(visitor.point, origin, products);
    }
    return products;
  }
  /** Compute area moments for the mesh. In the returned MomentData:
   * * origin is the centroid.
   * * localToWorldMap has the origin and principal directions
   * * radiiOfGyration radii for rotation around the x,y,z axes.
   */
  public static computePrincipalAreaMoments(source: Polyface): MomentData | undefined {
    const origin = source.data.getPoint(0);
    if (!origin) return undefined;
    const inertiaProducts = PolyfaceQuery.sumFacetSecondAreaMomentProducts(source, origin);
    return MomentData.inertiaProductsToPrincipalAxes(origin, inertiaProducts);
  }
  /**
   * Test if the facets in `source` occur in perfectly mated pairs, as is required for a closed manifold volume.
   * @param source
   */
  public static isPolyfaceClosedByEdgePairing(source: Polyface): boolean {
    const edges = new IndexedEdgeMatcher();
    const visitor = source.createVisitor(1) as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), visitor.currentReadIndex());
      }
    }
    const badClusters: SortableEdgeCluster[] = [];
    edges.sortAndCollectClusters(undefined, badClusters, undefined, badClusters);
    return badClusters.length === 0;
  }
  /** Find segments (within the linestring) which project to facets.
   * * Announce each pair of linestring segment and on-facet segment through a callback.
   * * Facets are ASSUMED to be convex and planar.
   */
  public static announceSweepLinestringToConvexPolyfaceXY(linestringPoints: GrowableXYZArray, polyface: Polyface,
    announce: AnnounceDrapePanel): any {
    const visitor = polyface.createVisitor(0);
    const numLinestringPoints = linestringPoints.length;
    const segmentPoint0 = Point3d.create();
    const segmentPoint1 = Point3d.create();
    const localSegmentPoint0 = Point3d.create();
    const localSegmentPoint1 = Point3d.create();
    const clipFractions = Segment1d.create(0, 1);
    const localFrame = Transform.createIdentity();
    let frame;
    for (visitor.reset(); visitor.moveToNextFacet();) {
      // For each triangle within the facet ...
      for (let k1 = 1; k1 + 1 < visitor.point.length; k1++) {
        frame = visitor.point.fillLocalXYTriangleFrame(0, k1, k1 + 1, localFrame);
        if (frame) {
          // For each stroke of the linestring ...
          for (let i1 = 1; i1 < numLinestringPoints; i1++) {
            linestringPoints.getPoint3dAtCheckedPointIndex(i1 - 1, segmentPoint0);
            linestringPoints.getPoint3dAtCheckedPointIndex(i1, segmentPoint1);
            frame.multiplyInversePoint3d(segmentPoint0, localSegmentPoint0);
            frame.multiplyInversePoint3d(segmentPoint1, localSegmentPoint1);
            clipFractions.set(0, 1);
            /** (x,y,1-x-y) are barycentric coordinates in the triangle !!! */
            if (clipFractions.clipBy01FunctionValuesPositive(localSegmentPoint0.x, localSegmentPoint1.x)
              && clipFractions.clipBy01FunctionValuesPositive(localSegmentPoint0.y, localSegmentPoint1.y)
              && clipFractions.clipBy01FunctionValuesPositive(
                1 - localSegmentPoint0.x - localSegmentPoint0.y,
                1 - localSegmentPoint1.x - localSegmentPoint1.y)) {
              /* project the local segment point to the plane. */
              const localClippedPointA = localSegmentPoint0.interpolate(clipFractions.x0, localSegmentPoint1);
              const localClippedPointB = localSegmentPoint0.interpolate(clipFractions.x1, localSegmentPoint1);
              const worldClippedPointA = localFrame.multiplyPoint3d(localClippedPointA)!;
              const worldClippedPointB = localFrame.multiplyPoint3d(localClippedPointB)!;
              const planePointA = localFrame.multiplyXYZ(localClippedPointA.x, localClippedPointA.y, 0.0)!;
              const planePointB = localFrame.multiplyXYZ(localClippedPointB.x, localClippedPointB.y, 0.0)!;
              const splitParameter = Geometry.inverseInterpolate01(localSegmentPoint0.z, localSegmentPoint1.z);
              // emit 1 or 2 panels, oriented so panel normal is always to the left of the line.
              if (splitParameter !== undefined && splitParameter > clipFractions.x0 && splitParameter < clipFractions.x1) {
                const piercePointX = segmentPoint0.interpolate(splitParameter, segmentPoint1);
                const piercePointY = piercePointX.clone();   // so points are distinct for the two triangle announcements.
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointA, piercePointX, planePointA], 2, 1);
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointB, piercePointY, planePointB], 1, 2);
              } else if (localSegmentPoint0.z > 0) {  // segment is entirely above
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointA, worldClippedPointB, planePointB, planePointA], 3, 2);
              } else // segment is entirely under
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointB, worldClippedPointA, planePointA, planePointB], 2, 3);
            }
          }
        }
      }
    }
  }
  /** Find segments (within the linestring) which project to facets.
   * * Assemble each segment pair as a facet in a new polyface
   * * Facets are ASSUMED to be convex and planar.
   */
  public static sweepLinestringToFacetsXYreturnSweptFacets(linestringPoints: GrowableXYZArray, polyface: Polyface): Polyface {
    const builder = PolyfaceBuilder.create();
    this.announceSweepLinestringToConvexPolyfaceXY(linestringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[]) => {
        if (points.length === 4)
          builder.addQuadFacet(points);
        else if (points.length === 3)
          builder.addTriangleFacet(points);

      });
    return builder.claimPolyface(true);
  }

}
/** Announce the points on a drape panel.
 * * The first two points in the array are always along the draped line segment.
 * * The last two are always on the facet.
 * * If there are 4 points, those two pairs are distinct, i.e. both segment points are to the same side of the facet.
 * * If there are 3 points, those two pairs share an on-facet point.
 * * The panel is ordered so the outward normal is to the right of the draped segment.
 * @param indexAOnFacet index (in points) of the point that is the first facet point for moving forward along the linestring
 * @param indexBOnFacet index (in points) of the point that is the second facet point for moving forward along the linestring
 * @public
 */
export type AnnounceDrapePanel = (linestring: GrowableXYZArray, segmentIndex: number,
  polyface: Polyface, facetIndex: number, points: Point3d[], indexAOnFacet: number, indexBOnFacet: number) => any;
