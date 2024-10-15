/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Topology
 */

import { assert } from "@itwin/core-bentley";
import { Geometry, PolygonLocation } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { Ray3d } from "../geometry3d/Ray3d";
import { SmallSystem } from "../numerics/Polynomials";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { MarkedEdgeSet } from "./HalfEdgeMarkSet";
import { PointSearchContext, RayClassification } from "./HalfEdgePointInGraphSearch";
import { HalfEdgePositionDetail } from "./HalfEdgePositionDetail";
import { Triangulator } from "./Triangulation";

/**
 * Options for setting the z-coordinate of a vertex in the triangulation when a point with the same xy is inserted.
 * @internal
 */
export enum InsertedVertexZOptions {
  /** The point's z-coordinate is ignored, and the existing vertex's z-coordinate is unchanged. */
  Ignore,
  /** The point's z-coordinate replaces the existing vertex's z-coordinate. */
  Replace,
  /**
   * Like [[InsertedVertexZOptions.Replace]], but the existing vertex's z-coordinate is updated only if the
   * point's z-coordinate is larger.
   */
  ReplaceIfLarger,
  /**
   * Like [[InsertedVertexZOptions.Replace]], but the existing vertex's z-coordinate is updated only if the
   * point's z-coordinate is smaller.
   */
  ReplaceIfSmaller,
}

/**
 * Context for repeated insertion of new points in a graph.
 * * Initial graph should have clean outer boundary (e.g., as typically marked with `HalfEdgeMask.EXTERIOR` and
 * `HalfEdgeMask.BOUNDARY_EDGE`).
 * * After each insertion, the current "position" within the graph is remembered so that each subsequent insertion
 * can reuse that position as start for walking to the new point.
 * @internal
 */
export class InsertAndRetriangulateContext {
  private _graph: HalfEdgeGraph;
  private _edgeSet: MarkedEdgeSet;
  private _searcher: HalfEdgePositionDetail;
  private _tolerance: number;

  private constructor(graph: HalfEdgeGraph, tolerance: number) {
    this._graph = graph;
    this._edgeSet = MarkedEdgeSet.create(graph)!;
    this._searcher = HalfEdgePositionDetail.create();
    this._tolerance = tolerance;
  }
  /** Create a new context referencing the graph. */
  public static create(graph: HalfEdgeGraph, tolerance: number = Geometry.smallMetricDistance) {
    return new InsertAndRetriangulateContext(graph, tolerance);
  }
  /** Query the (pointer to) the graph in the context. */
  public get graph(): HalfEdgeGraph {
    return this._graph;
  }
  /**
   * Walk face from edgeNode. Insert new edges back to start node from all except immediate successor and predecessor.
   * Insert all new nodes and nodes of the existing face in edgeSet.
   */
  private retriangulateFromBaseVertex(centralNode: HalfEdge) {
    const numNode = centralNode.countEdgesAroundFace();
    if (numNode < 4 || centralNode.isMaskSet(HalfEdgeMask.EXTERIOR))
      return;
    this._edgeSet.addAroundFace(centralNode);
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
  /** Return a (reference to!) the current position in the graph. */
  public get currentPosition() {
    return this._searcher;
  }
  /** Linear search for the nearest graph edge or vertex. */
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
  /** Linear search for the nearest graph vertex. */
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
  /**
   * Reset the "current" position to a vertex nearest the target point.
   * @param xyz target point
   * @param searchEdgesToo reset to nearest vertex or edge
  */
  public resetSearch(xyz: Point3d, searchEdgesToo: boolean): void {
    if (searchEdgesToo)
      this._searcher = this.searchForNearestEdgeOrVertex(xyz);
    else
      this._searcher = this.searchForNearestVertex(xyz);
  }
  /** Reclassify the current interior face hit if it is too close to an edge of the face. */
  private reclassifyFaceHit(point: Point3d): boolean {
    if (undefined === this._searcher.node || !this._searcher.isFace || this._searcher.node.isMaskSet(HalfEdgeMask.EXTERIOR))
      return false;
    const pointXY = Point3d.create(point.x, point.y);
    const face = this._searcher.node.collectAroundFace((node: HalfEdge) => {
      const xy = Point3d.create(node.x, node.y);
      (xy as any).node = node; // decorate the point with the node
      return xy;
    });
    const detail = PolygonOps.closestPointOnBoundary(face, pointXY, this._tolerance);
    assert(detail.code === PolygonLocation.OnPolygonEdgeInterior);
    if (detail.a > this._tolerance)
      return false;
    const edge = face[detail.closestEdgeIndex].node;
    const vertex = (detail.closestEdgeParam < 0.5) ? edge : edge.faceSuccessor;
    if (detail.point.distanceSquaredXY(vertex) <= this._tolerance * this._tolerance)
      this._searcher.resetAsVertex(vertex);
    else
      this._searcher.resetAtEdgeAndFraction(edge, detail.closestEdgeParam);
    return true;
  }
  /** Reclassify the current interior edge hit if it is too close to an edge of either adjacent face. */
  private reclassifyEdgeHit(point: Point3d): boolean {
    if (undefined === this._searcher.node || !this._searcher.isEdge || this._searcher.node.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE))
      return false;
    const pointXY = Point3d.create(point.x, point.y);
    const superFace: Point3d[] = [];
    for (let n = this._searcher.node.faceSuccessor; n !== this._searcher.node; n = n.faceSuccessor) {
      const xy = Point3d.create(n.x, n.y);
      (xy as any).node = n; // decorate the point with a node of the left face
      superFace.push(xy);
    }
    for (let n = this._searcher.node.vertexPredecessor; n !== this._searcher.node.edgeMate; n = n.faceSuccessor) {
      const xy = Point3d.create(n.x, n.y);
      (xy as any).node = n; // decorate the point with a node of the right face
      superFace.push(xy);
    }
    const detail = PolygonOps.closestPointOnBoundary(superFace, pointXY, this._tolerance);
    if (detail.a > this._tolerance)
      return false;
    const edge = (superFace[detail.closestEdgeIndex] as any).node;
    const vertex = (detail.closestEdgeParam < 0.5) ? edge : edge.faceSuccessor;
    if (detail.code === PolygonLocation.OnPolygonVertex) // can happen if superFace is non-concave (e.g., a dart)
      this._searcher.resetAsVertex(vertex);
    else if (detail.point.distanceSquaredXY(vertex) <= this._tolerance * this._tolerance)
      this._searcher.resetAsVertex(vertex);
    else
      this._searcher.resetAtEdgeAndFraction(edge, detail.closestEdgeParam);
    return true;
  }
  /**
   * Given a point that was just inserted into the graph at the given node, apply the z-coordinate rule around
   * the vertex loop.
   */
  private updateZAroundVertex(node: HalfEdge, point: Point3d, zOption: InsertedVertexZOptions): void {
    if (InsertedVertexZOptions.Ignore === zOption)
      return;
    if ((InsertedVertexZOptions.ReplaceIfLarger === zOption) && (point.z <= node.z))
      return;
    if ((InsertedVertexZOptions.ReplaceIfSmaller === zOption) && (point.z >= node.z))
      return;
    // only replace z; preserving xy preserves convexity of the hull
    node.setXYZAroundVertex(node.x, node.y, point.z);
  }
  /**
   * Insert a new point into the graph and retriangulate.
   * @param point the coordinates of the node to be inserted.
   * @param newZWins rule governing when `point.z` should override the z-coordinate of an existing vertex with the
   * same x and y.
   * @returns true if and only if the point didn't need to be inserted or was successfully inserted.
   */
  public insertAndRetriangulate(point: Point3d, newZWins: InsertedVertexZOptions): boolean {
    this.moveToPoint(this._searcher, point);
    if (this._searcher.node === undefined)
      return false;
    // Try to avoid skinny triangles. If we iterated, this could get out of control (e.g., inserting point into a fan).
    // Limiting to one reclassification ensures the hit doesn't move more than tol and reduces skinny triangles
    // adjacent to the hull.
    if (!this.reclassifyFaceHit(point))
      this.reclassifyEdgeHit(point);
    if (this._searcher.isFace) {
      // insert point into the graph if it lies in an interior face
      if (!this._searcher.node.isMaskSet(HalfEdgeMask.EXTERIOR)) {
        const newNode = this._graph.createEdgeXYZHalfEdge(point.x, point.y, point.z, 0, this._searcher.node, 0);
        this.retriangulateFromBaseVertex(newNode);
        Triangulator.flipTrianglesInEdgeSet(this._graph, this._edgeSet);
        this._searcher.resetAsVertex(newNode);
      }
    } else if (this._searcher.isEdge) {
      // insert point into the graph by splitting its containing edge
      const newA = this._graph.splitEdgeAtFraction(this._searcher.node, this._searcher.edgeFraction!);
      const newB = newA.vertexPredecessor;
      this.updateZAroundVertex(newA, point, InsertedVertexZOptions.Replace);  // always replace
      this.retriangulateFromBaseVertex(newA);
      this.retriangulateFromBaseVertex(newB);
      Triangulator.flipTrianglesInEdgeSet(this._graph, this._edgeSet);
      this._searcher.resetAsVertex(newA);
    } else if (this._searcher.isVertex) {
      // no need to insert point as there's already a vertex there, but maybe update its z-coord
      this.updateZAroundVertex(this._searcher.node, point, newZWins);
    }
    return true;
  }
  /**
   * Advance movingPosition to a face, edge, or vertex position detail that contains `target`.
   * @param movingPosition input seed for search, updated on return.
   * @param target point to search for containing topology in the graph.
   * @param announcer optional callback invoked during search loop; return false to end search.
   * @returns true if search was successful.
   */
  public moveToPoint(
    movingPosition: HalfEdgePositionDetail,
    target: Point3d,
    announcer?: (position: HalfEdgePositionDetail) => boolean,
  ): boolean {
    const psc = PointSearchContext.create(this._tolerance);
    movingPosition.setITag(0);
    if (movingPosition.isUnclassified) {
      moveToAnyUnmaskedEdge(this.graph, movingPosition, 0.5, HalfEdgeMask.NULL_MASK);
      if (movingPosition.isUnclassified)
        return false;
    }
    let trap = 0;
    const ray = Ray3d.createXAxis();
    for (; movingPosition.getITag() === 0 && trap < 2;) {
      if (announcer !== undefined) {
        const continueSearch = announcer(movingPosition);
        if (!continueSearch)
          break;
      }
      if (!psc.setSearchRay(movingPosition, target, ray)) {
        return false;
      } else if (movingPosition.isFace) {
        const lastBefore = HalfEdgePositionDetail.create();
        const firstAfter = HalfEdgePositionDetail.create();
        const rc = psc.reAimAroundFace(movingPosition.node!, ray, ray.a!, lastBefore, firstAfter);
        // reAimAroundFace returns lots of cases in `lastBefore`
        switch (rc) {
          case RayClassification.NoHits: {
            movingPosition.resetAsUnknown();
            break;
          }
          case RayClassification.TargetOnVertex: {
            movingPosition.setFrom(lastBefore);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.TargetOnEdge: {
            movingPosition.setFrom(lastBefore);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.Bracket: {
            movingPosition.resetAsFace(lastBefore.node, target);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.TargetBefore: { // do we ever get here?
            movingPosition.resetAsFace(movingPosition.node, target);
            movingPosition.setITag(1);
            break;
          }
          case RayClassification.TargetAfter: {
            if (movingPosition.node === lastBefore.node
              && movingPosition.isFace
              && (lastBefore.isEdge || lastBefore.isVertex)) {
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
    if (movingPosition.isAtXY(target.x, target.y))
      return true;
    if (trap > 1) {
      // ugh! We exited the loop by repeatedly hitting the same node with edge or vertex type in lastBefore.
      // This happens only when the target point is exterior (heavy triangulation use cases start with a convex
      // hull and only do interior intersections, so case only happens in contrived unit tests so far
      // What to mark? Leave it as is, but mark as exterior target
      if (movingPosition.node !== undefined) {
        movingPosition.setIsExteriorTarget(true);
      }
      return false;
    }
    // murky here; should never be hit. Has never been hit in unit tests.
    return false;
  }
}
/** Set `position` to a random unmasked edge at the specified fraction. */
function moveToAnyUnmaskedEdge(
  graph: HalfEdgeGraph, position: HalfEdgePositionDetail, edgeFraction: number, skipMask: HalfEdgeMask,
): boolean {
  for (const candidate of graph.allHalfEdges) {
    if (!candidate.isMaskSet(skipMask)) {
      position.resetAtEdgeAndFraction(candidate, edgeFraction);
      return true;
    }
  }
  return false;
}
