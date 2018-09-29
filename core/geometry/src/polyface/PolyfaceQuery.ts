/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Point3d, Vector3d, Point2d } from "./PointVector";
import { Point3d } from "../PointVector";
import { Polyface, PolyfaceVisitor } from "./Polyface";
import { Matrix4d } from "../numerics/Geometry4d";
import { Loop, BagOfCurves } from "../curve/CurveChain";
import { LineString3d } from "../curve/LineString3d";
import { PolygonOps } from "../PointHelpers";
import { MomentData } from "../numerics/Moments";

/** PolyfaceQuery is a static class whose methods implement queries on a polyface or polyface visitor provided as a parameter to each mtehod. */
export class PolyfaceQuery {
  /** copy the points from a visitor into a Linestring3d in a Loop object */
  public static VisitorToLoop(visitor: PolyfaceVisitor) {
    const ls = LineString3d.createPoints(visitor.point.getPoint3dArray());
    return Loop.create(ls);
  }
  /** Create a linestring loop for each facet of the polyface. */
  public static IndexedPolyfaceToLoops(polyface: Polyface): BagOfCurves {
    const result = BagOfCurves.create();
    const visitor = polyface.createVisitor(1);
    while (visitor.moveToNextFacet()) {
      const loop = PolyfaceQuery.VisitorToLoop(visitor);
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
  public static SumFacetSecondAreaMomentProducts(source: Polyface | PolyfaceVisitor, origin: Point3d): Matrix4d {
    if (source instanceof Polyface)
      return PolyfaceQuery.SumFacetSecondAreaMomentProducts(source.createVisitor(0), origin);
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
    const inertiaProducts = PolyfaceQuery.SumFacetSecondAreaMomentProducts(source, origin);
    return MomentData.inertiaProductsToPrincipalAxes(origin, inertiaProducts);
  }

}
