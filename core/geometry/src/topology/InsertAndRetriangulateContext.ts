/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Topology
 */

import { Point3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { SmallSystem } from "../numerics/Polynomials";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { MarkedEdgeSet } from "./HalfEdgeMarkSet";
import { PointSearchContext, RayClassification } from "./HalfEdgePointInGraphSearch";
import { HalfEdgePositionDetail } from "./HalfEdgePositionDetail";
import { Triangulator } from "./Triangulation";

/**
 * Context for repeated insertion of new points in a graph.
 * * Initial graph should have clean outer boundary. (e.g. as typically marked with HalfEdgeMask.EXTERIOR)
 * * After each insertion, the current "position" within the graph is remembered so that each subsequent insertion
 *     can reuse that position as start for walking to the new point.
 */
export class InsertAndRetriangulateContext {
  private _graph: HalfEdgeGraph;
  private _edgeSet: MarkedEdgeSet;
  private _searcher: HalfEdgePositionDetail;
  // Temporaries used in reAimFromFace
  // private _lastBefore: HalfEdgePositionDetail;
  // private _firstAfter: HalfEdgePositionDetail;

  private constructor(graph: HalfEdgeGraph) {
    this._graph = graph;
    this._edgeSet = MarkedEdgeSet.create(graph)!;
    this._searcher = HalfEdgePositionDetail.create();
    // this._lastBefore = HalfEdgePositionDetail.create();
    // this._firstAfter = HalfEdgePositionDetail.create();
  }
  /** Create a new context referencing the graph. */
  public static create(graph: HalfEdgeGraph) {
    return new InsertAndRetriangulateContext(graph);
  }
  /** Query the (pointer to) the graph in the context. */
  public get graph(): HalfEdgeGraph { return this._graph; }
  // Walk face from edgeNode;  insert new edges back to start node from all except
  //   immediate successor and predecessor.
  // insert all new nodes, and nodes of the existing face, in edgeSet.
  private retriangulateFromBaseVertex(centralNode: HalfEdge) {
    const numNode = centralNode.countEdgesAroundFace();
    this._edgeSet.addAroundFace(centralNode);
    if (numNode < 4 || centralNode.signedFaceArea() <= 0.0)
      return;
    const numEdge = numNode - 3;
    let farNode = centralNode.faceSuccessor;
    let nearNode = centralNode;
    for (let i = 0; i < numEdge; i++) {
      farNode = farNode.faceSuccessor;
      nearNode = this._graph.createEdgeHalfEdgeHalfEdge(nearNode, 0, farNode, 0);
      farNode = nearNode.faceSuccessor;
      this._edgeSet.addToSet(nearNode);
    }
  }
  /** Reset the "current" position to unknown state. */
  public reset() {
    this._searcher = HalfEdgePositionDetail.create();
  }

  /** Return a (reference to!) the current position in the graph */
  public get currentPosition() { return this._searcher; }
  /**
   * Linear search through the graph
   * * Returns a HalfEdgePositionDetail for the nearest edge or vertex.
   * @param xyz
   */
  public searchForNearestEdgeOrVertex(xyz: Point3d): HalfEdgePositionDetail {
    const position = HalfEdgePositionDetail.create();
    position.setDTag(Number.MAX_VALUE);
    const xyzC = Point3d.create();
    let fractionC;
    let distanceC;
    for (const nodeA of this._graph.allHalfEdges) {
      const nodeB = nodeA.faceSuccessor;
      fractionC = SmallSystem.lineSegment3dXYClosestPointUnbounded(nodeA, nodeB, xyz);
      if (fractionC !== undefined) {
        if (fractionC > 1.0) {
          distanceC = xyz.distanceXY(nodeB);
          if (distanceC < position.getDTag()!) {
            position.resetAsVertex(nodeB);
            position.setDTag(distanceC);
          }
        } else if (fractionC < 0.0) {
          distanceC = xyz.distanceXY(nodeA);
          if (distanceC < position.getDTag()!) {
            position.resetAsVertex(nodeA);
            position.setDTag(distanceC);
          }
        } else {
          nodeA.fractionToPoint3d(fractionC, xyzC);

          distanceC = xyz.distanceXY(xyzC);
          if (distanceC < position.getDTag()!) {
            position.resetAtEdgeAndFraction(nodeA, fractionC);
          }
        }
      }
    }
    return position;
  }
  public searchForNearestVertex(xyz: Point3d): HalfEdgePositionDetail {
    const position = HalfEdgePositionDetail.create();
    position.setDTag(Number.MAX_VALUE);
    let distanceA;
    for (const nodeA of this._graph.allHalfEdges) {
      distanceA = xyz.distanceXY(nodeA);
      if (distanceA < position.getDTag()!) {
        position.resetAsVertex(nodeA);
        position.setDTag(distanceA);
      }
    }
    return position;
  }

  public resetSearch(xyz: Point3d, maxDim: number) {
    if (maxDim > 0)
      this._searcher = this.searchForNearestEdgeOrVertex(xyz);
    else
      this._searcher = this.searchForNearestVertex(xyz);
  }
  public insertAndRetriangulate(xyz: Point3d, newZWins: boolean): boolean {
    this.moveToPoint(this._searcher, xyz);
    const seedNode = this._searcher.node;
    let stat = false;
    if (seedNode === undefined) {
    } else if (this._searcher.isFace) {
      if (!seedNode.isMaskSet(HalfEdgeMask.EXTERIOR)) {
        const newInteriorNode = this._graph.createEdgeXYZHalfEdge(xyz.x, xyz.y, xyz.z, 0, seedNode, 0);
        this.retriangulateFromBaseVertex(newInteriorNode);
        Triangulator.flipTrianglesInEdgeSet(this._graph, this._edgeSet);
        this._searcher.resetAsVertex(newInteriorNode);
      }
      stat = true;
    } else if (this._searcher.isEdge) {
      const newA = this._graph.splitEdgeAtFraction(seedNode, this._searcher.edgeFraction!);
      const newB = newA.vertexPredecessor;
      this.retriangulateFromBaseVertex(newA);
      this.retriangulateFromBaseVertex(newB);
      Triangulator.flipTrianglesInEdgeSet(this._graph, this._edgeSet);
      this._searcher.resetAsVertex(newA);
      stat = true;
    } else if (this._searcher.isVertex) {
      // There's already a vertex there.  Maybe the z is different.
      if (newZWins)
        seedNode.setXYZAroundVertex(xyz.x, xyz.y, xyz.z);
      stat = true;
    } else {
      stat = false;
    }
    return stat;
  }

  // Advance movingPosition to a face, edge, or vertex position detail that contains xyz.
  // Prior content in movingPosition is used as seed.
  // Return true if successful.
  public moveToPoint(movingPosition: HalfEdgePositionDetail, xyz: Point3d, announcer?: (position: HalfEdgePositionDetail) => boolean): boolean {
    const psc = PointSearchContext.create();
    movingPosition.setITag(0);
    if (movingPosition.isUnclassified) {
      moveToAnyUnmaskedEdge(this.graph, movingPosition, 0.5, 0);
      if (movingPosition.isUnclassified)
        return false;
    }
    let trap = 0;
    // double tol = vu_getMergeTol (pGraph);
    const ray = Ray3d.createXAxis();
    for (; movingPosition.getITag() === 0 && trap < 2;) {
      if (announcer !== undefined) {
        const continueSearch = announcer(movingPosition);
        if (!continueSearch)
          break;
      }
      if (!psc.setSearchRay(movingPosition, xyz, ray)) {
        return false;
      } else if (movingPosition.isFace) {
        const lastBefore = HalfEdgePositionDetail.create();
        const firstAfter = HalfEdgePositionDetail.create();
        const rc = psc.reAimAroundFace(movingPosition.node!, ray, ray.a!, lastBefore, firstAfter);
        // reAimAroundFace returns lots of cases in `lastBefore` !!
        switch (rc) {
          case RayClassification.RC_NoHits: {
            movingPosition.resetAsUnknown();
            break;
          }
          case RayClassification.RC_TargetOnVertex: {
            movingPosition.setFrom(lastBefore);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.RC_TargetOnEdge: {
            movingPosition.setFrom(lastBefore);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.RC_Bracket: {
            movingPosition.resetAsFace(lastBefore.node, xyz);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.RC_TargetBefore: {
            movingPosition.resetAsFace(movingPosition.node, xyz);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.RC_TargetAfter: {
            if (movingPosition.node === lastBefore.node
              && movingPosition.isFace
              && (lastBefore.isEdge || lastBefore.isVertex)){
              trap++;
            } else {
              trap = 0;
            }
            movingPosition.setFrom(lastBefore);
            break;
          }
        }
      } else if (movingPosition.isEdge) {
        psc.reAimFromEdge(movingPosition, ray, ray.a!);
        if (movingPosition.isUnclassified)
          break;
      } else if (movingPosition.isVertex) {
        psc.reAimFromVertex(movingPosition, ray, ray.a!);
        if (movingPosition.isUnclassified)
          break;
      }
    }
    if (movingPosition.isAtXY(xyz.x, xyz.y))
      return true;
    if (trap > 1) {
      // Ugh.  We exited the loop by repeatedly hitting the same node
      // with edge or vertex type in lastBefore.
      // This happens only when the target point is exterior.
      // (Heavy triangulation use cases start with a convex hull and only do interior intersections,
      //     so case only happens in contrived unit tests.... so far ...)
      // What to mark?
      // Leave it as is, but mark as exterior target
      //
      if (movingPosition.node !== undefined) {
          movingPosition.setIsExteriorTarget(true);
      }
      return false;
    }
    // Murky here ...  should never be hit.  Has never been hit in unit tests.
    return false;
  }

}
// Create a VuPositionDetail for specified fraction along any unmasked edge.
function moveToAnyUnmaskedEdge(graph: HalfEdgeGraph, position: HalfEdgePositionDetail, edgeFraction: number, skipMask: HalfEdgeMask): boolean {
  for (const candidate of graph.allHalfEdges) {
    if (!candidate.isMaskSet(skipMask)) {
      position.resetAtEdgeAndFraction(candidate, edgeFraction);
      return true;
    }
  }
  return false;
}
