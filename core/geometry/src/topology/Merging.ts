/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Range3d } from "../geometry3d/Range";
import { ClusterableArray } from "../numerics/ClusterableArray";
import { SmallSystem } from "../numerics/Polynomials";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { HalfEdgePriorityQueueWithPartnerArray } from "./HalfEdgePriorityQueue";
import { RegularizationContext } from "./RegularizeFace";
import { MultiLineStringDataVariant, Triangulator } from "./Triangulation";

export class GraphSplitData {
  public numUpEdge = 0;
  public numIntersectionTest = 0;
  public numSplit = 0;
  public numPopOut = 0;
  public numA0B0 = 0;
  public numA0B1 = 0;
  public constructor() {
  }
}

/**
 * * Assorted methods used in algorithms on HalfEdgeGraph.
 * @internal
 */
export class HalfEdgeGraphOps {

  /** Compare function for sorting with primary y compare, secondary  x compare. */
  public static compareNodesYXUp(a: HalfEdge, b: HalfEdge) {
    // Check y's
    // if (!Geometry.isSameCoordinate(a.y, b.y))
    if (a.y < b.y)
      return -1;
    else if (a.y > b.y)
      return 1;
    // Check x's
    // if (!Geometry.isSameCoordinate(a.x, b.x))
    if (a.x < b.x)
      return -1;
    else if (a.x > b.x)
      return 1;
    return 0;
  }

  /** Return true if nodeB (a) is lower than both its neighbors and (b) inflects as a downward peak (rather than an upward trough) */
  public static isDownPeak(nodeB: HalfEdge) {
    const nodeA = nodeB.facePredecessor;
    const nodeC = nodeB.faceSuccessor;
    return this.compareNodesYXUp(nodeB, nodeA) < 0
      && this.compareNodesYXUp(nodeB, nodeC) < 0
      && this.crossProductToTargets(nodeB, nodeA, nodeC) > 0;
  }

  /** return the cross product of vectors from base to targetA and base to targetB
   * @param base base vertex of both vectors.
   * @param targetA target vertex of first vector
   * @param targetB target vertex of second vector
   */
  public static crossProductToTargets(base: HalfEdge, targetA: HalfEdge, targetB: HalfEdge): number {
    return Geometry.crossProductXYXY(targetA.x - base.x, targetA.y - base.y, targetB.x - base.x, targetB.y - base.y);
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // ----------------------------------------------------------------------------------------------------------------------

  public static graphRange(graph: HalfEdgeGraph): Range3d {
    const range = Range3d.create();
    for (const node of graph.allHalfEdges) {
      range.extendXYZ(node.x, node.y, node.z);
    }
    return range;
  }
  /** Returns an array of all nodes (both ends) of edges created from segments. */
  public static segmentArrayToGraphEdges(segments: LineSegment3d[], returnGraph: HalfEdgeGraph, mask: HalfEdgeMask): HalfEdge[] {
    const result = [];
    let idxCounter = 0;

    // Push the endpoints of each segment onto arr[] in the form {(x, y, theta), Node}
    for (const segment of segments) {

      const node0 = returnGraph.createEdgeXYZXYZ(
        segment.point0Ref.x, segment.point0Ref.y, segment.point0Ref.z,
        idxCounter,
        segment.point1Ref.x, segment.point1Ref.y, segment.point1Ref.z,
        idxCounter + 1);

      const node1 = node0.edgeMate;
      idxCounter += 2;

      node0.setMaskAroundFace(mask);   // Original given coordinates must be part of boundary
      result.push(node0);
      result.push(node1);
    }

    return result;
  }

  /**
   * * Visit all nodes in `graph`.
   * * invoke `pinch(node, vertexPredecessor)`
   * * this leaves the graph as isolated edges.
   * @param graph graph to modify
   */
  public static isolateAllEdges(graph: HalfEdgeGraph) {
    for (const nodeA of graph.allHalfEdges) {
      const nodeB = nodeA.vertexPredecessor;
      HalfEdge.pinch(nodeA, nodeB);
    }
  }

  /**
   * Compute convexity of a sector of a super-face.
   * @param base node whose edge is to be tested for removal
   * @param ignore edges with this mask (on either side) are ignored for the purposes of computing convexity
   * @param barrier edges with this mask (on either side) will not be removed
   * @return whether removing the edge at base would create a convex sector in the super-face
   */
  private static isSectorConvexAfterEdgeRemoval(base: HalfEdge, ignore: HalfEdgeMask, barrier: HalfEdgeMask): boolean {
    let vs = base;
    do { // loop ccw around vertex looking for a super-face predecessor
      if (vs.isMaskSet(barrier) || vs.edgeMate.isMaskSet(barrier))
        break;
      vs = vs.vertexSuccessor;
    } while (vs !== base && vs.isMaskSet(ignore));
    if (vs === base)
      return false;
    let vp = base;
    do { // loop cw around vertex looking for a super-face successor
      if (vp.isMaskSet(barrier) || vp.edgeMate.isMaskSet(barrier))
        break;
      vp = vp.vertexPredecessor;
    } while (vp !== base && vp.isMaskSet(ignore));
    if (vp === base)
      return false;
    return HalfEdge.isSectorConvex(vs.edgeMate, base, vp.faceSuccessor);
  }

  /**
   * Mask edges between faces if the union of the faces is convex.
   * Uses a greedy algorithm with no regard to quality of resulting convex faces.
   * Best results when input faces are convex.
   * @param graph graph to examine and mark
   * @param mark the mask used to mark (both sides of) removable edges
   * @param barrier edges with this mask (on either side) will not be marked. Defaults to HalfEdgeMask.BOUNDARY_EDGE.
   * @return number of edges masked (half the number of HalfEdges masked)
   */
  public static markRemovableEdgesToExpandConvexFaces(graph: HalfEdgeGraph, mark: HalfEdgeMask, barrier: HalfEdgeMask = HalfEdgeMask.BOUNDARY_EDGE): number {
    if (HalfEdgeMask.NULL_MASK === mark)
      return 0;
    const visit = graph.grabMask(true);
    let numMarked = 0;
    for (const node of graph.allHalfEdges) {
      if (!node.isMaskSet(visit)) {
        if (!node.isMaskSet(barrier) && !node.edgeMate.isMaskSet(barrier)) {
          if (this.isSectorConvexAfterEdgeRemoval(node, mark, barrier) && this.isSectorConvexAfterEdgeRemoval(node.edgeMate, mark, barrier)) {
            node.setMaskAroundEdge(mark);
            ++numMarked;
          }
        }
      }
    node.setMaskAroundEdge(visit);
    }
    return numMarked;
  }

  /**
   * Collect edges between faces if the union of the faces is convex.
   * Uses a greedy algorithm with no regard to quality of resulting convex faces.
   * Best results when input faces are convex.
   * @param graph graph to examine
   * @param barrier edges with this mask (on either side) will not be collected. Defaults to HalfEdgeMask.BOUNDARY_EDGE.
   * @return one HalfEdge per removable edge
   */
  public static collectRemovableEdgesToExpandConvexFaces(graph: HalfEdgeGraph, barrier: HalfEdgeMask = HalfEdgeMask.BOUNDARY_EDGE): HalfEdge[] | undefined {
    const removable: HalfEdge[] = [];
    const mark = graph.grabMask(true);
    if (0 < this.markRemovableEdgesToExpandConvexFaces(graph, mark, barrier)) {
      const visited = graph.grabMask(true);
      for (const node of graph.allHalfEdges) {
        if (node.isMaskSet(mark) && !node.isMaskSet(visited)) {
          node.setMaskAroundEdge(visited);
          removable.push(node);
        }
      }
      graph.dropMask(visited);
    }
    graph.dropMask(mark);
    return removable;
  }

  /**
   * Remove edges between faces if the union of the faces is convex.
   * Uses a greedy algorithm with no regard to quality of resulting convex faces.
   * Best results when input faces are convex.
   * @param graph graph to modify
   * @param barrier edges with this mask (on either side) will not be removed. Defaults to HalfEdgeMask.BOUNDARY_EDGE.
   * @return number of edges deleted
   */
  public static expandConvexFaces(graph: HalfEdgeGraph, barrier: HalfEdgeMask = HalfEdgeMask.BOUNDARY_EDGE): number {
    const mark = graph.grabMask(true);
    const numRemovedEdges = this.markRemovableEdgesToExpandConvexFaces(graph, mark, barrier);
    if (numRemovedEdges > 0)
      graph.yankAndDeleteEdges((node: HalfEdge) => node.getMask(mark));
    graph.dropMask(mark);
    return numRemovedEdges;
  }

  /**
   * Test desired faces for convexity.
   * @param graph graph to examine
   * @param avoid faces with this mask will not be examined. Defaults to HalfEdgeMask.EXTERIOR.
   * @return whether every face in the graph is convex
   */
  public static isEveryFaceConvex(graph: HalfEdgeGraph, avoid: HalfEdgeMask = HalfEdgeMask.EXTERIOR): boolean {
    const allFaces = graph.collectFaceLoops();
    for (const node of allFaces) {
      if (node.isMaskedAroundFace(avoid))
        continue;
      if (!node.isFaceConvex())
        return false;
      }
    return true;
  }
}

/**
 * @internal
 */
export class HalfEdgeGraphMerge {
  /** Simplest merge algorithm:
   * * collect array of (x,y,theta) at all nodes
   * * lexical sort of the array.
   * * twist all vertices together.
   * * This effectively creates valid face loops for a planar subdivision if there are no edge crossings.
   * * If there are edge crossings, the graph can be a (highly complicated) Klein bottle topology.
   * * Mask.NULL_FACE is cleared throughout and applied within null faces.
   */
  public static clusterAndMergeXYTheta(graph: HalfEdgeGraph, outboundRadiansFunction?: (he: HalfEdge) => number) {
    const allNodes = graph.allHalfEdges;
    const numNodes = allNodes.length;
    graph.clearMask(HalfEdgeMask.NULL_FACE);
    const clusters = new ClusterableArray(2, 2, numNodes);  // data order: x,y,theta, nodeIndex.  But theta is not set in first round.
    for (let i = 0; i < numNodes; i++) {
      const nodeA = allNodes[i];
      const xA = nodeA.x;
      const yA = nodeA.y;
      HalfEdge.pinch(nodeA, nodeA.vertexSuccessor);  // pull it out of its current vertex loop.
      clusters.addDirect(xA, yA, 0.0, i);
    }
    const order = clusters.clusterIndicesLexical();
    let k0 = 0;
    const numK = order.length;
    for (let k1 = 0; k1 < numK; k1++) {
      if (order[k1] === ClusterableArray.clusterTerminator) {
        // nodes identified in order[k0]..order[k1] are properly sorted around a vertex.
        if (k1 > k0) {
          const iA = clusters.getExtraData(order[k0], 1);
          const nodeA0 = allNodes[iA];
          for (let k = k0 + 1; k < k1; k++) {
            const iB = clusters.getExtraData(order[k], 1);
            const nodeB = allNodes[iB];
            nodeB.x = nodeA0.x;
            nodeB.y = nodeA0.y;
          }
        }
        k0 = k1 + 1;
      }
    }
    // NOW
    //  1) There are identical coordinates at all nodes around each vertex loop.
    //  2) Hence ready do sort (at each vertex) by theta.

    // insert theta as extra data in the sort table . . .
    for (const clusterTableIndex of order) {
      if (clusterTableIndex !== ClusterableArray.clusterTerminator) {
        const nodeA = allNodes[clusterTableIndex];
        const nodeB = nodeA.faceSuccessor;
        let radians = outboundRadiansFunction ? outboundRadiansFunction(nodeA) : Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, -Math.PI))
          radians = Math.PI;
        clusters.setExtraData(clusterTableIndex, 0, radians);
      }
    }
    clusters.sortSubsetsBySingleKey(order, 2);
    const unmatchedNullFaceNodes: HalfEdge[] = [];
    k0 = 0;
    let thetaA, thetaB;
    // now pinch each neighboring pair together
    for (let k1 = 0; k1 < numK; k1++) {
      if (order[k1] === ClusterableArray.clusterTerminator) {
        // nodes identified in order[k0]..order[k1] are properly sorted around a vertex.
        if (k1 > k0) {
          const iA = clusters.getExtraData(order[k0], 1);
          thetaA = clusters.getExtraData(order[k0], 0);
          const nodeA0 = allNodes[iA];
          let nodeA = nodeA0;
          for (let k = k0 + 1; k < k1; k++) {
            const iB = clusters.getExtraData(order[k], 1);
            thetaB = clusters.getExtraData(order[k], 0);
            const nodeB = allNodes[iB];
            if (nodeA.isMaskSet(HalfEdgeMask.NULL_FACE)) {
              // nope, this edge was flagged and pinched from the other end.
              const j = unmatchedNullFaceNodes.findIndex((node: HalfEdge) => nodeA === node);
              if (j >= 0) {
                unmatchedNullFaceNodes[j] = unmatchedNullFaceNodes[unmatchedNullFaceNodes.length - 1];
                unmatchedNullFaceNodes.pop();
              }
              nodeA = nodeB;
              thetaA = thetaB;
            } else if (nodeB.isMaskSet(HalfEdgeMask.NULL_FACE)) {
              const j = unmatchedNullFaceNodes.findIndex((node: HalfEdge) => nodeA === node);
              if (j >= 0) {
                unmatchedNullFaceNodes[j] = unmatchedNullFaceNodes[unmatchedNullFaceNodes.length - 1];
                unmatchedNullFaceNodes.pop();
              }
              // NO leave nodeA and thetaA   ignore nodeB -- later step will get the outside of its banana.
            } else {
              HalfEdge.pinch(nodeA, nodeB);
              if (Angle.isAlmostEqualRadiansAllowPeriodShift(thetaA, thetaB)) {
                const nodeA1 = nodeA.faceSuccessor;
                const nodeB1 = nodeB.edgeMate;
                // WE TRUST -- nodeA1 and node B1 must have identical xy.
                // pinch them together and mark the face loop as null ..
                HalfEdge.pinch(nodeA1, nodeB1);
                nodeA.setMask(HalfEdgeMask.NULL_FACE);
                nodeB1.setMask(HalfEdgeMask.NULL_FACE);
                unmatchedNullFaceNodes.push(nodeB1);
              }
              nodeA = nodeB;
              thetaA = thetaB;
            }
          }
        }
        k0 = k1 + 1;
      }
    }
  }

  private static buildVerticalSweepPriorityQueue(graph: HalfEdgeGraph): HalfEdgePriorityQueueWithPartnerArray {
    const sweepHeap = new HalfEdgePriorityQueueWithPartnerArray();
    for (const p of graph.allHalfEdges) {

      if (HalfEdgeGraphOps.compareNodesYXUp(p, p.faceSuccessor) < 0) {
        sweepHeap.priorityQueue.push(p);
      }
    }
    return sweepHeap;
  }
  private static snapFractionToNode(xy: Point2d, fraction: number, node: HalfEdge, nodeFraction: number): number{
    if (Geometry.isSameCoordinate(xy.x, node.x) && Geometry.isSameCoordinate(xy.y, node.y))
      return nodeFraction;
    return fraction;
}
  private static computeIntersectionFractionsOnEdges(nodeA0: HalfEdge, nodeB0: HalfEdge, fractions: Vector2d, pointA: Point2d, pointB: Point2d): boolean {
    const nodeA1 = nodeA0.faceSuccessor;
    const ax0 = nodeA0.x;
    const ay0 = nodeA0.y;
    const ux = nodeA1.x - ax0;
    const uy = nodeA1.y - ay0;
    const nodeB1 = nodeB0.faceSuccessor;
    const bx0 = nodeB0.x;
    const by0 = nodeB0.y;
    const vx = nodeB1.x - bx0;
    const vy = nodeB1.y - by0;
    if (SmallSystem.lineSegmentXYUVTransverseIntersectionUnbounded(ax0, ay0, ux, uy,
      bx0, by0, vx, vy, fractions)) {
      pointA.x = ax0 + fractions.x * ux;
      pointA.y = ay0 + fractions.x * uy;
      pointB.x = bx0 + fractions.y * vx;
      pointB.y = by0 + fractions.y * vy;
      fractions.x = this.snapFractionToNode(pointA, fractions.x, nodeA0, 0.0);
      fractions.x = this.snapFractionToNode(pointA, fractions.x, nodeA1, 1.0);
      fractions.y = this.snapFractionToNode(pointB, fractions.y, nodeB0, 0.0);
      fractions.y = this.snapFractionToNode(pointB, fractions.y, nodeB1, 1.0);
      return Geometry.isIn01(fractions.x) && Geometry.isIn01(fractions.y);
    }
    return false;
  }
  /**
   * Split edges at intersections.
   * * This is a large operation.
   * @param graph
   */
  public static splitIntersectingEdges(graph: HalfEdgeGraph): GraphSplitData {
    const data = new GraphSplitData();
    const sweepHeap = this.buildVerticalSweepPriorityQueue(graph);
    let nodeA0, nodeB1;
    const smallFraction = 1.0e-8;
    const largeFraction = 1.0 - smallFraction;
    let i;
    const fractions = Vector2d.create();
    const pointA = Point2d.create();
    const pointB = Point2d.create();
    let nodeB0;
    const popTolerance = Geometry.smallMetricDistance;
    while (undefined !== (nodeA0 = sweepHeap.priorityQueue.pop())) {
      data.numUpEdge++;
      const n0 = sweepHeap.activeEdges.length;
      sweepHeap.removeArrayMembersWithY1Below(nodeA0.y - popTolerance);
      data.numPopOut += n0 - sweepHeap.activeEdges.length;
      for (i = 0; i < sweepHeap.activeEdges.length; i++) {
        nodeB0 = sweepHeap.activeEdges[i];
        nodeB1 = nodeB0.faceSuccessor;
        // const nodeB1 = nodeB0.faceSuccessor;
        if (Geometry.isSameCoordinateXY(nodeA0.x, nodeA0.y, nodeB0.x, nodeB0.y)) {
          data.numA0B0++;
        } else if (Geometry.isSameCoordinateXY(nodeB1.x, nodeB1.y, nodeA0.x, nodeA0.y)) {
          data.numA0B1++;
        } else {
          data.numIntersectionTest++;
          if (this.computeIntersectionFractionsOnEdges(nodeA0, nodeB0, fractions, pointA, pointB)) {
            if (fractions.x > smallFraction && fractions.x < largeFraction) {
              const nodeC0 = graph.splitEdgeAtFraction(nodeA0, fractions.x);
              sweepHeap.priorityQueue.push(nodeC0);  // The upper portion will be reviewed as a nodeA0 later !!!
              data.numSplit++;
            }
            if (fractions.y > smallFraction && fractions.y < largeFraction) {
              const nodeD0 = graph.splitEdgeAtFraction(nodeB0, fractions.y);
              sweepHeap.priorityQueue.push(nodeD0);  // The upper portion will be reviewed as a nodeA0 later !!!
              data.numSplit++;
            }
            // existing nodeA0 and its shortened edge remain for further intersections
          }
        }
      }
      sweepHeap.activeEdges.push(nodeA0);
    }
    return data;
  }

  /**
   * Returns a graph structure formed from the given LineSegment array
   *
   * *  Find all intersections among segments, and split them if necessary
   * *  Record endpoints of every segment in the form X, Y, Theta; This information is stored as a new node and sorted to match up
   *      vertices.
   * *  For vertices that match up, pinch the nodes to create vertex loops, which in closed objects, will also eventually form face
   *      loops
   */
  public static formGraphFromSegments(lineSegments: LineSegment3d[]): HalfEdgeGraph {
    // Structure of an index of the array: { xyTheta: Point3d, node: Node }
    const graph = new HalfEdgeGraph();
    HalfEdgeGraphOps.segmentArrayToGraphEdges(lineSegments, graph, HalfEdgeMask.BOUNDARY_EDGE);
    this.splitIntersectingEdges(graph);
    this.clusterAndMergeXYTheta(graph);

    return graph;
  }

  /**
   * * Input is random linestrings, not necessarily loops
   * * Graph gets full splitEdges, regularize, and triangulate.
   * @returns triangulated graph, or undefined if bad data.
   */
  public static formGraphFromChains(chains: MultiLineStringDataVariant, regularize: boolean = true, mask: HalfEdgeMask = HalfEdgeMask.PRIMARY_EDGE): HalfEdgeGraph | undefined {
    if (chains.length < 1)
      return undefined;
    const graph = new HalfEdgeGraph();
    const chainSeeds = Triangulator.directCreateChainsFromCoordinates(graph, chains);
    for (const seed of chainSeeds)
      seed.setMaskAroundFace(mask);

    this.splitIntersectingEdges(graph);
    this.clusterAndMergeXYTheta(graph);
    if (regularize) {
      const context = new RegularizationContext(graph);
      context.regularizeGraph(true, true);
    }
    return graph;
  }

}
