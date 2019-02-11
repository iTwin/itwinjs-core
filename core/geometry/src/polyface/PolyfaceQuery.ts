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
import { PolygonOps } from "../geometry3d/PointHelpers";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedEdgeMatcher, SortableEdgeCluster } from "./IndexedEdgeMatcher";

/** PolyfaceQuery is a static class whose methods implement queries on a polyface or polyface visitor provided as a parameter to each mtehod. */
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
  /** @returns Return the sum of all facets areas. */
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
        myOrigin = visitor.point.getPoint3dAt(0);
      visitor.point.getPoint3dAt(0, facetOrigin);
      for (let i = 1; i + 1 < visitor.point.length; i++) {
        visitor.point.getPoint3dAt(i, targetA);
        visitor.point.getPoint3dAt(i + 1, targetB);
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
   * * radiiOfGyration radii for rotation aroud the x,y,z axes.
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
    edges.sortAndcollectClusters(undefined, badClusters, undefined, badClusters);
    return badClusters.length === 0;
  }
}
