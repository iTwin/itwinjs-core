/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { isDataView } from "util/types";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Ray3d } from "../../geometry3d/Ray3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphFromIndexedLoopsContext } from "../../topology/HalfEdgeGraphFromIndexedLoopsContext";
import { IndexedPolyface} from "../Polyface";
import { PolyfaceBuilder } from "../PolyfaceBuilder";

function buildBaseGraph(polyface: IndexedPolyface): HalfEdgeGraph | undefined {
  const graphBuilder = new HalfEdgeGraphFromIndexedLoopsContext ();
  const visitor = polyface.createVisitor ();
  const xyzA = Point3d.create ();
  const xyzB = Point3d.create ();
  for (visitor.reset (); visitor.moveToNextFacet ();){
    const normal = PolygonOps.centroidAreaNormal(visitor.point);
    const edgeA = graphBuilder.insertLoop (visitor.auxData.indices,
    (insideHalfEdge: HalfEdge)=>{
      const mate = insideHalfEdge.edgeMate;
      polyface.data.getPoint (insideHalfEdge.i, xyzA);
      insideHalfEdge.setXYZ (xyzA);
      polyface.data.getPoint (insideHalfEdge.i, xyzB);
      mate.setXYZ (xyzB);
    });
    if (edgeA){
      edgeA.faceTag = new FacetProperties (visitor.currentReadIndex (), normal);
    }
  }
  return graphBuilder.graph;
 }

 // facet properties used during offset.
 class FacetProperties {
  public constructor(facetIndex: number, normal: Ray3d){
    this.facetIndex = facetIndex;
    this.facetNormal = normal;
  }
public facetIndex: number;
public facetNormal: Ray3d;
 }
export class OffsetMeshContext {
  private constructor(basePolyface: IndexedPolyface, baseGraph: HalfEdgeGraph){
  this._basePolyface = basePolyface;
  this._baseGraph = baseGraph;
  }
  private _basePolyface: IndexedPolyface;
  private _baseGraph: HalfEdgeGraph;
/**
 *
 * @param basePolyface
 * @param builder
 * @param distance
 */
  public static buildOffsetMesh(basePolyface: IndexedPolyface, builder: PolyfaceBuilder, distance: number){
    const baseGraph = buildBaseGraph (basePolyface);
    const offsetBuilder = new OffsetMeshContext (basePolyface, baseGraph);
    offsetBuilder._basePolyface = basePolyface;
    offsetBuilder._baseGraph = baseGraph;
  }

  /**
   * For each face of the graph, shift vertices by offsetDistance and emit to the builder as a facet
   * @param polyfaceBuilder
   */
  public announceSimpleOffsetFromFaces(polyfaceBuilder: PolyfaceBuilder, offsetDistance: number){
    const xyzLoop: Point3d[] = [];
    const xyz = Point3d.create ();
    const uvw = Vector3d.create ();
    const announceNodeAroundFace = (node: HalfEdge): number => {
      node.getPoint3d (xyz);
      xyz.addInPlace (uvw);
      xyzLoop.push (xyz);
      return 0;
    };
    this._baseGraph.announceFaceLoops (
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean=>{
        if (!seed.isMaskSet (HalfEdgeMask.EXTERIOR)){
          uvw.setFromVector3d ((seed.faceTag as FacetProperties).facetNormal.direction);
          uvw.scaleInPlace (offsetDistance);
          seed.sumAroundVertex (announceNodeAroundFace);
          polyfaceBuilder.addPolygon (xyzLoop);
        }
        return true;
      });
  }
}
