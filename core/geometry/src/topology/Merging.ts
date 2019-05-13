/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { ClusterableArray } from "../numerics/ClusterableArray";
import { Range3d } from "../geometry3d/Range";

/**
 * * Assorted methods used in algorithms on HalfEdgeGraph.
 * @internal
 */
export class HalfEdgeGraphOps {

  // SORTING FUNCTIONS (compare methods used by sort() in larger algorithms) -----------------------------------------------------------

  /** Compare function for sorting X, Y, and (optional) sortAngle components of ndoes. */
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
  /** Compare function for sorting "downward" with primary y compare, secondary  x compare. */
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
  /** Compare function for sorting the "event queue" when searching for crossings of line segments in an array of segments (x increasing) */
  private static eventCompareCrossings(a: any, b: any): number {
    if (a.leftPoint.x < b.leftPoint.x)
      return -1;
    else if (a.leftPoint.x > b.leftPoint.x)
      return 1;
    return 0;
  }

  // ---------------------------------------------------------------------------------------------------------------------

  // QUERY FUNCTIONS (methods to grab specific extremities of a segment or node connection) -----------------------------------------

  /** Returns the greatest y-value of a segment */
  private static getHighValueOfSegment(seg: LineSegment3d): number {
    if (seg.point0Ref.y > seg.point1Ref.y)
      return seg.point0Ref.y;
    return seg.point1Ref.y;
  }

  /** Returns the lowest y-value of a segment */
  private static getLowValueOfSegment(seg: LineSegment3d): number {
    if (seg.point0Ref.y < seg.point1Ref.y)
      return seg.point0Ref.y;
    return seg.point1Ref.y;
  }

  /** Returns the lowest x-value of a segment */
  private static getLeftValueOfSegment(seg: LineSegment3d): number {
    if (seg.point0Ref.x < seg.point1Ref.x)
      return seg.point0Ref.x;
    return seg.point1Ref.x;
  }

  /** Returns the greatest x-value of a segment */
  private static getRightValueOfSegment(seg: LineSegment3d): number {
    if (seg.point0Ref.x > seg.point1Ref.x)
      return seg.point0Ref.x;
    return seg.point1Ref.x;
  }

  /** Returns a reference to the point of a segment that lies farther left along the x-axis (if same x, use smaller y value) */
  private static getLeftmostPointOfSegment(seg: LineSegment3d): Point3d {
    if (seg.point0Ref.x < seg.point1Ref.x)
      return seg.point0Ref;
    else if (seg.point1Ref.x < seg.point0Ref.x)
      return seg.point1Ref;
    // Resort to y values to avoid outputting same endpoints
    if (seg.point0Ref.y < seg.point1Ref.y)
      return seg.point0Ref;
    else if (seg.point1Ref.y < seg.point0Ref.y)
      return seg.point1Ref;

    return seg.point0Ref;
  }

  /** Returns a reference to the point of a segment that lies farther right along the x-axis (if same x, use greater y value) */
  private static getRightmostPointOfSegment(seg: LineSegment3d): Point3d {
    if (seg.point0Ref.x > seg.point1Ref.x)
      return seg.point0Ref;
    else if (seg.point1Ref.x > seg.point0Ref.x)
      return seg.point1Ref;
    // Resort to y values to avoid outputting same endpoints
    if (seg.point0Ref.y > seg.point1Ref.y)
      return seg.point0Ref;
    else if (seg.point1Ref.y > seg.point0Ref.y)
      return seg.point1Ref;

    return seg.point1Ref;
  }

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

  /** Given two segments, uses the equations of the two representative lines and the determinant to give a point of intersection;
   *  Note that when point is found, it may fall outside bounds of segments. Therefore, extra check for in bounds is necessary.
   */
  private static getIntersectionOfSegments(seg1: LineSegment3d, seg2: LineSegment3d, checkInBounds: boolean): Point3d | undefined {
    const a1 = seg1.point1Ref.y - seg1.point0Ref.y;
    const b1 = seg1.point0Ref.x - seg1.point1Ref.x;
    const c1 = a1 * (seg1.point0Ref.x) + b1 * (seg1.point0Ref.y);

    const a2 = seg2.point1Ref.y - seg2.point0Ref.y;
    const b2 = seg2.point0Ref.x - seg2.point1Ref.x;
    const c2 = a2 * (seg2.point0Ref.x) + b2 * (seg2.point0Ref.y);

    const det = a1 * b2 - a2 * b1;

    if (det === 0) {
      return undefined;
    }

    const x = (b2 * c1 - b1 * c2) / det;
    const y = (a1 * c2 - a2 * c1) / det;
    const intersection = Point3d.create(x, y);

    if (checkInBounds) {
      // Ensure the point is within bounds of both segments
      if ((intersection.x >= HalfEdgeGraphOps.getLeftValueOfSegment(seg1) && intersection.x <= HalfEdgeGraphOps.getRightValueOfSegment(seg1) &&
        intersection.y >= HalfEdgeGraphOps.getLowValueOfSegment(seg1) && intersection.y <= HalfEdgeGraphOps.getHighValueOfSegment(seg1))) {
        if (intersection.x >= HalfEdgeGraphOps.getLeftValueOfSegment(seg2) && intersection.x <= HalfEdgeGraphOps.getRightValueOfSegment(seg2) &&
          intersection.y >= HalfEdgeGraphOps.getLowValueOfSegment(seg2) && intersection.y <= HalfEdgeGraphOps.getHighValueOfSegment(seg2)) {
          return intersection;
        } else {
          return undefined;
        }
      }
    }
    return intersection;
  }

  /**
   * sorts a number array and filters out 0's, 1's, and duplicates...
   * useful when trying to simplify the found intersections of each segment in an array
   */
  public static sortAndFilterCrossings(arr: number[]) {
    if (arr.length === 0) return arr;
    arr.sort(GrowableFloat64Array.compare);
    let r = 0;
    for (let i = 1; i < arr.length; i++) {
      if (!Geometry.isSameCoordinate(arr[r], arr[i])) {
        arr[++r] = arr[i]; // copy-in next unique number
      }
    }
    arr.length = r + 1;
    return arr;
  }

  /**
   * Returns an array for each index of the segments array given, which holds the fractional moments of intersection along that segment
   *
   * *  Creates a queue array of left-most segment points, paired with a link back to its original index into the segment array given
   * *  For each 'event' in the queue, check its corresponding segment for intersections with segments whose left-most points
   *      appear before this event's right-most point
   */
  public static findCrossings(segments: LineSegment3d[]): number[][] {
    const queue: Array<{ leftPoint: Point3d, rightPoint: Point3d, segIdx: number }> = [];
    const crossings: number[][] = [];

    for (let i = 0; i < segments.length; i++) {
      queue.push({
        leftPoint: HalfEdgeGraphOps.getLeftmostPointOfSegment(segments[i]),
        rightPoint: HalfEdgeGraphOps.getRightmostPointOfSegment(segments[i]),
        segIdx: i,
      });
    }

    // Sort the eQueue of points from left to right
    queue.sort(HalfEdgeGraphOps.eventCompareCrossings);

    for (let i = 0; i < queue.length; i++) {
      const iSegIdx = queue[i].segIdx;

      if (!crossings[iSegIdx]) // If index into crossings does not exist yet for segment, create it
        crossings[iSegIdx] = [];

      // Only check intersections of segments in queue who's left endpoints are before this segment's right
      // endpoint pair
      for (let j = i + 1; j < queue.length; j++) {
        if (queue[j].leftPoint.x > queue[i].rightPoint.x)
          break;

        const jSegIdx = queue[j].segIdx;
        const iSeg = segments[iSegIdx];
        const jSeg = segments[jSegIdx];
        const intersection = HalfEdgeGraphOps.getIntersectionOfSegments(iSeg, jSeg, true);

        if (intersection !== undefined) {
          const fractionForISeg = iSeg.point0Ref.distance(intersection) / iSeg.curveLength();
          const fractionForJSeg = jSeg.point0Ref.distance(intersection) / jSeg.curveLength();
          if (fractionForISeg > 0 && fractionForISeg < 1 && fractionForJSeg > 0 && fractionForJSeg < 1) {
            if (!crossings[jSegIdx]) // If array does not exist for other (j) segment of intersection yet, create it
              crossings[jSegIdx] = [];

            crossings[iSegIdx].push(fractionForISeg);
            crossings[jSegIdx].push(fractionForJSeg);
          }
        }
      }
    }
    return crossings;
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
   * * If there are edge crossings, the graph can be a (highly complicated) Klein bottle topoogy.
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
    const segments: LineSegment3d[] = [];

    // Obtain an array of all of the fractional intersections for each segment... remove duplicates and endpoints
    const intersectArray = HalfEdgeGraphOps.findCrossings(lineSegments);
    for (const item of intersectArray) {
      // Get rid of duplicate intersection findings
      HalfEdgeGraphOps.sortAndFilterCrossings(item);
    }

    // Create new segment array that contains the split segments
    for (let i = 0; i < intersectArray.length; i++) {
      if (intersectArray[i].length === 0) {
        segments.push(lineSegments[i]);
        continue;
      }

      let newStart = 0;
      for (const f of intersectArray[i]) {
        segments.push(LineSegment3d.create(lineSegments[i].fractionToPoint(newStart),
          lineSegments[i].fractionToPoint(f)));
        newStart = f;
      }
      // Add last segment, which is from last element of break array to end of original segment
      segments.push(LineSegment3d.create(lineSegments[i].fractionToPoint(newStart),
        lineSegments[i].fractionToPoint(1)));
    }

    const arr = HalfEdgeGraphOps.segmentArrayToGraphEdges(segments, graph, HalfEdgeMask.BOUNDARY);
    HalfEdgeGraphOps.setXYSortAnglesInGraph(graph);

    // Sort lexically
    arr.sort(HalfEdgeGraphOps.compareNodeXYTheta);
    let lastNode = 0;

    // Connect nodes at vertices
    for (let i = 1; i <= arr.length; i++) {
      if (i === arr.length || !Geometry.isSameCoordinate(arr[i].x, arr[lastNode].x) ||
        !Geometry.isSameCoordinate(arr[i].y, arr[lastNode].y)) {
        // pinch matching vertices
        for (let j = lastNode; j < i - 1; j++) {
          HalfEdge.pinch(arr[j], arr[j + 1]);
        }
        lastNode = i;
      }
    }

    return graph;
  }

}
