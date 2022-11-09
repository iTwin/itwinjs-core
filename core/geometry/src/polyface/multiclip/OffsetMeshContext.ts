/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { SmallSystem } from "../../numerics/Polynomials";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Ray3d } from "../../geometry3d/Ray3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphFromIndexedLoopsContext } from "../../topology/HalfEdgeGraphFromIndexedLoopsContext";
import { IndexedPolyface} from "../Polyface";
import { PolyfaceBuilder } from "../PolyfaceBuilder";
import { XYAndZ } from "../../geometry3d/XYZProps";

 // facet properties used during offset.
 //
 class FacetOffsetProperties {
  public constructor(facetIndex: number, normal: Ray3d){
    this.facetIndex = facetIndex;
    this.facetNormal = normal;
  }
public facetIndex: number;
public facetNormal: Ray3d;
 }
 /**
  * Sector properties during offset.
  * * this.normal may be initially assigned as the facet normal but can mutate by
  *     averaging with neighbors.
  * * this.xyz is initially the base mesh xyz but is expected to move along the normal.
  * * this.count is used locally in computations.
  */
 class SectorOffsetProperties {
  public constructor(normal: Vector3d, xyz: Point3d){
    this.xyz = xyz;
    this.normal = normal;
    this.count = 0;
  }
  public normal: Vector3d;
  public xyz: Point3d;
  public count: number;
  public static almostEqualNormals(sectorA: SectorOffsetProperties, sectorB: SectorOffsetProperties): boolean{
    return sectorA.normal.isAlmostEqual (sectorB.normal);
    }
  // Set the offset point this.xyz as sum of the nodeXyz + distance * this.normal
  public setOffsetPointAtDistance(node: HalfEdge, distance: number){
      node.getPoint3d (this.xyz);
      this.xyz.addScaledInPlace (this.normal, distance);
    }
  // Set the offset point this.xyz directly
  public setXYAndZ(xyz: XYAndZ){
    this.xyz.set (xyz.x, xyz.y, xyz.z);
    }
    // access the XYZ and push to the array (which makes copies, not reference)
    // return pointer to the SectorOffsetProperties
  public static pushXYZ(xyzArray: GrowableXYZArray, node: HalfEdge): SectorOffsetProperties{
      const sector = node.edgeTag as SectorOffsetProperties;
      if (sector !== undefined)
        xyzArray.push (sector.xyz);
      return sector;
      }
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
    const baseGraph = this.buildBaseGraph (basePolyface);
    if (baseGraph !== undefined){
      const breakMask = baseGraph.grabMask ();
      const exteriorMask = HalfEdgeMask.EXTERIOR;
      const offsetBuilder = new OffsetMeshContext (basePolyface, baseGraph);
      offsetBuilder.computeSectorOffsetPoints (distance, exteriorMask, breakMask);
      offsetBuilder.announceOffsetLoopsByFace (builder);
      offsetBuilder.announceOffsetLoopsByEdge (builder);
      offsetBuilder.announceOffsetLoopsByVertex (builder, exteriorMask, breakMask);
      baseGraph.dropMask (breakMask);
    }
  }

    /**
   * For each face of the graph, shift vertices by offsetDistance and emit to the builder as a facet
   * @param polyfaceBuilder
   */
  public announceSimpleOffsetFromFaces(polyfaceBuilder: PolyfaceBuilder, offsetDistance: number){
    const xyzLoop = new GrowableXYZArray ();
    const xyz = Point3d.create ();    // reused at each point around each facet.
    const uvw = Vector3d.create ();   // reused once per facet
    const announceNodeAroundFace = (node: HalfEdge): number => {
      node.getPoint3d (xyz);
      xyz.addInPlace (uvw);
      xyzLoop.push (xyz);
      return 0;
    };
    this._baseGraph.announceFaceLoops (
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean=>{
        if (!seed.isMaskSet (HalfEdgeMask.EXTERIOR)){
          const facetProperties = seed.faceTag as FacetOffsetProperties;
          uvw.setFromVector3d (facetProperties.facetNormal.direction);
          uvw.scaleInPlace (offsetDistance);
          xyzLoop.length = 0;
          seed.sumAroundFace (announceNodeAroundFace);
          polyfaceBuilder.addPolygonGrowableXYZArray (xyzLoop);
        }
        return true;
      });
  }

  /**
   * For each face of the graph, announce facets using xyz recorded in the sectors associated with the 4 nodes
   * @param polyfaceBuilder
   */
     public announceOffsetLoopsByEdge(polyfaceBuilder: PolyfaceBuilder){
      const xyzLoop = new GrowableXYZArray ();
      const announceNode = (node: HalfEdge): number => {
        const sector = node.edgeTag as SectorOffsetProperties;
        xyzLoop.push (sector.xyz);
        return 0;
      };
      this._baseGraph.announceEdges (
        (_graph: HalfEdgeGraph, nodeA0: HalfEdge): boolean=>{
          const nodeB0 = nodeA0.edgeMate;
          if (!nodeA0.isMaskSet(HalfEdgeMask.EXTERIOR)
           && !nodeB0.isMaskSet(HalfEdgeMask.EXTERIOR)){
            const nodeA1 = nodeA0.faceSuccessor;
            const nodeB1 = nodeB0.faceSuccessor;
            xyzLoop.length = 0;
            announceNode (nodeA1);
            announceNode (nodeA0);
            announceNode (nodeB1);
            announceNode (nodeB0);
            polyfaceBuilder.addPolygonGrowableXYZArray (xyzLoop);
          }
          return true;
        });
    }

  /**
   * @param polyfaceBuilder
   */
   public announceOffsetLoopsByFace(polyfaceBuilder: PolyfaceBuilder){
    const xyzLoop = new GrowableXYZArray ();
    const announceNode = (node: HalfEdge): number => {
      SectorOffsetProperties.pushXYZ(xyzLoop, node);
      return 0;
    };
    this._baseGraph.announceNodes (
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean=>{
        if (!seed.isMaskSet (HalfEdgeMask.EXTERIOR)){
          xyzLoop.length = 0;
          seed.sumAroundFace (announceNode);
          polyfaceBuilder.addPolygonGrowableXYZArray (xyzLoop);
        }
        return true;
      });
  }
  /**
   * @param polyfaceBuilder
   */
   public announceOffsetLoopsByVertex(polyfaceBuilder: PolyfaceBuilder,  exteriorMask: HalfEdgeMask, sectorMask: HalfEdgeMask){
    const xyzLoop = new GrowableXYZArray ();
    const breakEdges: HalfEdge[] = [];
    this._baseGraph.announceVertexLoops (
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean=>{
        if (seed.countMaskAroundVertex (exteriorMask) === 0){
        this.collectMaskedEdgesAroundVertex (seed, sectorMask, breakEdges);
        if (breakEdges.length > 3){
          xyzLoop.clear ();
          for (const node of breakEdges)
            SectorOffsetProperties.pushXYZ(xyzLoop, node);
          polyfaceBuilder.addPolygonGrowableXYZArray (xyzLoop);
          }
        }
        return true;
      });
    }

/**
   * * Exterior half edges have HalfEdgeMask.EXTERIOR
   * * All interior half edge around a facet have facetTag pointing to a facetProperties object for that facet.
   *    * the facetOffsetProperties object has the simple facet normal.
   * * Each half edge has edgeTag pointing to to a sectorOffsetProperties object
   *    * the sectorOffsetProperties has a copy of the facet normal.
   * @param polyface
   * @returns graph
   */
  public static buildBaseGraph(polyface: IndexedPolyface): HalfEdgeGraph | undefined {
    const graphBuilder = new HalfEdgeGraphFromIndexedLoopsContext ();
    const visitor = polyface.createVisitor ();
    const xyzA = Point3d.create ();
    const xyzB = Point3d.create ();
    for (visitor.reset (); visitor.moveToNextFacet ();){
      const normal = PolygonOps.centroidAreaNormal(visitor.point);
      if (normal !== undefined){
        const edgeA = graphBuilder.insertLoop (visitor.pointIndex,
        (insideHalfEdge: HalfEdge)=>{
          const mate = insideHalfEdge.edgeMate;
          polyface.data.getPoint (insideHalfEdge.i, xyzA);
          insideHalfEdge.setXYZ (xyzA);
          polyface.data.getPoint (mate.i, xyzB);
          mate.setXYZ (xyzB);
        });
        const facetProperties = new FacetOffsetProperties (visitor.currentReadIndex (), normal);
        if (edgeA !== undefined){
          edgeA.sumAroundFace (
            (edgeB: HalfEdge)=>{
            edgeB.faceTag = facetProperties;
            edgeB.edgeTag = new SectorOffsetProperties (normal.direction.clone (), edgeB.getPoint3d ());
            return 0;
            });
          }
      }
    }
    return graphBuilder.graph;
   }
   private setOffsetAtDistanceAroundVertex(vertexSeed: HalfEdge, distance: number) {
    vertexSeed.sumAroundVertex ((nodeAroundVertex: HalfEdge)=>{
        const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
        if (props !== undefined)
          props.setOffsetPointAtDistance  (nodeAroundVertex, distance);
        return 0.0;
        }
      );
    }

    private setOffsetXYAndZAroundVertex(vertexSeed: HalfEdge, xyz: XYAndZ) {
      vertexSeed.sumAroundVertex ((nodeAroundVertex: HalfEdge)=>{
          const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
          if (props !== undefined)
            props.setXYAndZ  (xyz);
          return 0.0;
          }
        );
      }

      private setOffsetXYAndZAroundVertexUpToMask(vertexSeed: HalfEdge, xyz: XYAndZ, mask: HalfEdgeMask): number {
        let n = 0;
        for (let currentNode = vertexSeed;;){
          const props = currentNode.edgeTag as SectorOffsetProperties;
          n++;
          if (props !== undefined)
            props.setXYAndZ  (xyz);
          currentNode = currentNode.vertexSuccessor;
          if (currentNode.isMaskSet (mask))
            return n;
          if (currentNode.isMaskSet (HalfEdgeMask.EXTERIOR))
            return n;
          if (currentNode === vertexSeed)
            return n;
          }
        }
     /** Search around a vertex for a sector which has a different normal from its vertexPredecessor.
    * * The seed will be the first candidate considered
   */
   private markAndCollectBreakEdgesAroundVertex(vertexSeed: HalfEdge,
        exteriorMask: HalfEdgeMask,
        breakMask: HalfEdgeMask,
        breakEdges: HalfEdge[]){
    breakEdges.length = 0;
    vertexSeed.sumAroundVertex ((nodeA: HalfEdge): number =>{
      nodeA.clearMask(breakMask);
      let isBreak = false;
      if (!nodeA.isMaskSet (exteriorMask)){
        const nodeB = nodeA.edgeMate;
        const nodeC = nodeB.faceSuccessor;
        if (nodeB.isMaskSet (exteriorMask)){
          isBreak = true;
        } else if (!SectorOffsetProperties.almostEqualNormals(
            nodeA.edgeTag as SectorOffsetProperties,
            nodeC.edgeTag as SectorOffsetProperties)){
              isBreak = true;
            }
        }
        if (isBreak){
          breakEdges.push (nodeA);
        }
        return 0.0;
      });
    }
    /**
     * search around a vertex for nodes that have a specified mask
     * @param vertexSeed first node to search
     * @param mask target mask
     * @param collectedNodes array to be cleared and receive masked nodes
     */
    private collectMaskedEdgesAroundVertex(vertexSeed: HalfEdge,
      mask: HalfEdgeMask,
      collectedNodes: HalfEdge[]){
      collectedNodes.length = 0;
      vertexSeed.sumAroundVertex ((nodeA: HalfEdge): number =>{
        if (nodeA.isMaskSet (mask))
          collectedNodes.push (nodeA);
          return 0.0;
        });
      }

/** Compute the point of intersection of the planes in the sectors of 3 half edges */
   private compute3SectorIntersection(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge, result?: Vector3d): Vector3d | undefined{
      const sectorA = nodeA.edgeTag as SectorOffsetProperties;
      const sectorB = nodeB.edgeTag as SectorOffsetProperties;
      const sectorC = nodeC.edgeTag as SectorOffsetProperties;
      return SmallSystem.intersect3Planes (
        sectorA.xyz, sectorA.normal,
        sectorB.xyz, sectorB.normal,
        sectorC.xyz, sectorC.normal,
        result);
   }
/** Compute the point of intersection of the planes in the sectors of 2 half edges, using cross product of their normals to resolve */
private compute2SectorIntersection(nodeA: HalfEdge, nodeB: HalfEdge, result?: Vector3d): Vector3d | undefined{
  const sectorA = nodeA.edgeTag as SectorOffsetProperties;
  const sectorB = nodeB.edgeTag as SectorOffsetProperties;
  const normalC = sectorA.normal.crossProduct (sectorB.normal);
  return SmallSystem.intersect3Planes (
    sectorA.xyz, sectorA.normal,
    sectorB.xyz, sectorB.normal,
    sectorB.xyz, normalC,
    result);
}
/**
 * * at input:
 *   * Each node points to sectorOffsetProperties with appropriate unit normal
 * * at exit:
 *    * Each sectorOffsetProperties has an offset point computed with consideration of offset planes in the neighborhood.
 * @param distance distance to offset.
 */
   private computeSectorOffsetPoints(distance: number, exteriorMask: HalfEdgeMask, breakMask: HalfEdgeMask){
    const breakEdges: HalfEdge[] = [];
    this._baseGraph.announceVertexLoops((_graph: HalfEdgeGraph, vertexSeed: HalfEdge) => {
      this.markAndCollectBreakEdgesAroundVertex (vertexSeed, exteriorMask, breakMask, breakEdges);
      this.setOffsetAtDistanceAroundVertex (vertexSeed, distance);
      if (breakEdges.length <= 1){
        // just one smooth sequence.
        // everything is set already.
      } else if (breakEdges.length === 2){
        // exterior vertex with two incident smooth
        const vectorFromOrigin = this.compute2SectorIntersection (breakEdges[0], breakEdges[1]);
        if (vectorFromOrigin !== undefined){
          this.setOffsetXYAndZAroundVertex (vertexSeed, vectorFromOrigin);
        }
  } else if (breakEdges.length === 3){
        const vectorFromOrigin = this.compute3SectorIntersection (breakEdges[0], breakEdges[1], breakEdges[2]);
        if (vectorFromOrigin !== undefined){
          this.setOffsetXYAndZAroundVertex (vertexSeed, vectorFromOrigin);
        }
        // simple 3-face corner . . .
      } else {
        // Lots and Lots of edges
        // each set of 3 sectors independently generates an offset for its central sector.
        // make the array wrap 2 nodes.
        breakEdges.push (breakEdges[0]);
        breakEdges.push (breakEdges[1]);
        for (let i = 0; i + 2 < breakEdges.length; i++){
          const vectorFromOrigin = this.compute3SectorIntersection (breakEdges[i], breakEdges[i+1], breakEdges[i+2]);
          if (vectorFromOrigin !== undefined){
            this.setOffsetXYAndZAroundVertexUpToMask (breakEdges[i+1], vectorFromOrigin, breakMask);
          }
        }
      }
      return true;
    });
   }
}
