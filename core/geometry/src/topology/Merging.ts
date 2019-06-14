/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { Geometry } from "../Geometry";
import { LineSegment3d } from "../curve/LineSegment3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { ClusterableArray } from "../numerics/ClusterableArray";
import { Range3d } from "../geometry3d/Range";
import { HalfEdgePriorityQueueWithPartnerArray } from "./HalfEdgePriorityQueue";
import { SmallSystem } from "../numerics/Polynomials";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";

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

  // SORTING FUNCTIONS (compare methods used by sort() in larger algorithms) -----------------------------------------------------------

  /** Compare function for sorting X, Y, and (optional) sortAngle components of nodes. */
  public static compareNodeXYTheta(a: HalfEdge, b: HalfEdge) {
    // Check x's
    if (!Geometry.isSameCoordinate(a.x, b.x))
      if (a.x < b.x)
        return -1;
      else if (a.x > b.x)
        return 1;
    // Check y's
    if (!Geometry.isSameCoordinate(a.y, b.y))
      if (a.y < b.y)
        return -1;
      else if (a.y > b.y)
        return 1;
    if (a.sortAngle !== undefined && b.sortAngle !== undefined) {
      // Check theta
      if (a.sortAngle < b.sortAngle)
        return -1;
      else if (a.z > b.z)
        return 1;
    }
    return 0;
  }
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
  /** Returns an array of a all nodes (both ends) of edges created from segments. */
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
   * * For each face with positive area . . . add edges as needed so that each face has one definitely lower node and one definite upper node.
   * * Hence tracing edges from the low node, there is a sequence of upward edges, reaching the upper,  then a sequence of downward edges reaching the low node.
   * * This is an essential step for subsequent triangulation.
   *
   * @param graph
   */
  public static formMonotoneFaces(graph: HalfEdgeGraph) {

    const allFaces = graph.collectFaceLoops();
    graph.clearMask(HalfEdgeMask.VISITED);
    // For every face, break the face down into monotone sections
    for (const node of allFaces) {
      if (node.isMaskSet(HalfEdgeMask.VISITED))
        continue;
      const area = node.signedFaceArea();
      if (area <= 0.0) {
        node.setMaskAroundFace(HalfEdgeMask.VISITED);
        continue;
      }

    }
  }
  /**
   * Compute and save sort angle in all nodes of the graph.
   * * the sort angle is the atan2 of the vector to face successor.
   * * Hence the sort angle range is -PI to PI
   * @param graph graph to update.
   */
  public static setXYSortAnglesInGraph(graph: HalfEdgeGraph) {
    let node1;
    for (const node0 of graph.allHalfEdges) {
      node1 = node0.faceSuccessor;
      node0.sortAngle = Math.atan2((node1.y - node0.y), (node1.x - node0.x));
    }
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
   */
  public static clusterAndMergeXYTheta(graph: HalfEdgeGraph) {
    const allNodes = graph.allHalfEdges;
    const numNodes = allNodes.length;
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
        const theta = Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
        clusters.setExtraData(clusterTableIndex, 0, theta);
      }
    }
    clusters.sortSubsetsBySingleKey(order, 2);
    k0 = 0;
    // now pinch each neighboring pair together
    for (let k1 = 0; k1 < numK; k1++) {
      if (order[k1] === ClusterableArray.clusterTerminator) {
        // nodes identified in order[k0]..order[k1] are properly sorted around a vertex.
        if (k1 > k0) {
          const iA = clusters.getExtraData(order[k0], 1);
          const nodeA0 = allNodes[iA];
          let nodeA = nodeA0;
          for (let k = k0 + 1; k < k1; k++) {
            const iB = clusters.getExtraData(order[k], 1);
            const nodeB = allNodes[iB];
            HalfEdge.pinch(nodeA, nodeB);
            nodeA = nodeB;
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
    while (undefined !== (nodeA0 = sweepHeap.priorityQueue.pop())) {
      data.numUpEdge++;
      const n0 = sweepHeap.activeEdges.length;
      sweepHeap.removeArrayMembersWithY1Below(nodeA0.y);
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

}
