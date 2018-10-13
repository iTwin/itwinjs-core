/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { GrowableFloat64Array } from "../geometry3d/GrowableArray";
import { ClusterableArray } from "../numerics/ClusterableArray";

class SweepEvent {
  // Node from segment array
  public node0: HalfEdge;
  public node1: HalfEdge;

  public leftEvent: SweepEvent | undefined;   // The top-most node of the segment paired left (node0)
  public rightEvent: SweepEvent | undefined;   // The bottom-most node of the segment paired right (node1)
  // Alternates, if left or right pairs at a face vertex
  public leftAlt: SweepEvent | undefined;
  public rightAlt: SweepEvent | undefined;

  public constructor(node0: HalfEdge, node1: HalfEdge) {
    this.node0 = node0;
    this.node1 = node1;
  }
}

export class Merger {

  // SORTING FUNCTIONS (compare methods used by sort() in larger algorithms) -----------------------------------------------------------

  /** Compare function for sorting X, Y, and theta componenets stored in a Point3d, useful for forming a graph from an array of segments */
  private static XYThetaCompare(a: any, b: any) {
    // Check x's
    if (!Geometry.isSameCoordinate(a.xyTheta.x, b.xyTheta.x))
      if (a.xyTheta.x < b.xyTheta.x)
        return -1;
      else if (a.xyTheta.x > b.xyTheta.x)
        return 1;
    // Check y's
    if (!Geometry.isSameCoordinate(a.xyTheta.y, b.xyTheta.y))
      if (a.xyTheta.y < b.xyTheta.y)
        return -1;
      else if (a.xyTheta.y > b.xyTheta.y)
        return 1;
    // Check theta
    if (a.xyTheta.z < b.xyTheta.z)
      return -1;
    else if (a.xyTheta.z > b.xyTheta.z)
      return 1;
    return 0;
  }

  /** Compare function for sorting the "event queue" when searching for crossings of line segments in an array of segments (x increasing) */
  private static eventCompareCrossings(a: any, b: any): number {
    if (a.leftPoint.x < b.leftPoint.x)
      return -1;
    else if (a.leftPoint.x > b.leftPoint.x)
      return 1;
    return 0;
  }

  /** Compare function for sorting the "event queue" when sweeping a polygon forming trapezoid sections (y increasing) */
  private static eventCompareTrapezoidation(a: SweepEvent, b: SweepEvent): number {
    if (a.node0.y > b.node0.y)
      return -1;
    else if (a.node0.y < b.node0.y)
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

  /** Returns an array of a Point3d holding x, y, and theta values for a point, and a corresponding node. Useful for organizing/sorting nodes */
  private static segmentsToXYThetaNode(segments: LineSegment3d[], returnGraph: HalfEdgeGraph): Array<{ xyTheta: Point3d, node: HalfEdge }> {
    const arr = [];
    let idxCounter = 0;

    // Push the endpoints of each segment onto arr[] in the form {(x, y, theta), Node}
    for (const segment of segments) {
      // Endpoint 0
      let theta0 = Math.atan2((segment.point1Ref.y - segment.point0Ref.y), (segment.point1Ref.x - segment.point0Ref.x));
      if (theta0 < 0) theta0 = theta0 + 2 * Math.PI;
      const point0 = Point3d.create(segment.point0Ref.x, segment.point0Ref.y, theta0);

      let theta1 = Math.atan2(-(segment.point1Ref.y - segment.point0Ref.y), -(segment.point1Ref.x - segment.point0Ref.x));
      if (theta1 < 0) theta1 = theta1 + 2 * Math.PI;
      const point1 = Point3d.create(segment.point1Ref.x, segment.point1Ref.y, theta1);

      const node0 = returnGraph.createEdgeXYZXYZ(point0.x, point0.y, point0.z, idxCounter, point1.x, point1.y, point1.z, idxCounter + 1);
      const node1 = node0.edgeMate;
      idxCounter += 2;

      node0.setMaskAroundFace(HalfEdgeMask.BOUNDARY);   // Original given coordinates must be part of boundary
      arr.push({ xyTheta: point0, node: node0 });
      arr.push({ xyTheta: point1, node: node1 });
      returnGraph.allHalfEdges.push(node0);
    }

    return arr;
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
      if ((intersection.x >= Merger.getLeftValueOfSegment(seg1) && intersection.x <= Merger.getRightValueOfSegment(seg1) &&
        intersection.y >= Merger.getLowValueOfSegment(seg1) && intersection.y <= Merger.getHighValueOfSegment(seg1))) {
        if (intersection.x >= Merger.getLeftValueOfSegment(seg2) && intersection.x <= Merger.getRightValueOfSegment(seg2) &&
          intersection.y >= Merger.getLowValueOfSegment(seg2) && intersection.y <= Merger.getHighValueOfSegment(seg2)) {
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
  private static sortAndFilterCrossings(arr: number[]) {
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
  private static findCrossings(segments: LineSegment3d[]): number[][] {
    const queue: Array<{ leftPoint: Point3d, rightPoint: Point3d, segIdx: number }> = [];
    const crossings: number[][] = [];

    for (let i = 0; i < segments.length; i++) {
      queue.push({
        leftPoint: Merger.getLeftmostPointOfSegment(segments[i]),
        rightPoint: Merger.getRightmostPointOfSegment(segments[i]),
        segIdx: i,
      });
    }

    // Sort the eQueue of points from left to right
    queue.sort(Merger.eventCompareCrossings);

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
        const intersection = Merger.getIntersectionOfSegments(iSeg, jSeg, true);

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
   * Returns a graph structure formed from the given LineSegment array
   *
   * *  Find all intersections of each segment, and split them if necessary
   * *  Record endpoints of every segment in the form X, Y, Theta; This information is stored as a new node and sorted to match up
   *      vertices.
   * *  For vertices that match up, pinch the nodes to create vertex loops, which in closed objects, will also eventually form face
   *      loops
   */
  public static formGraphFromSegments(lineSegments: LineSegment3d[]): HalfEdgeGraph {
    // Structure of an index of the array: { xyTheta: Point3d, node: Node }
    const returnGraph = new HalfEdgeGraph();
    const segments: LineSegment3d[] = [];

    // Obtain an array of all of the fractional intersections for each segment... remove duplicates and endpoints
    const intersectArray = Merger.findCrossings(lineSegments);
    for (const item of intersectArray) {
      // Get rid of duplicate intersection findings
      Merger.sortAndFilterCrossings(item);
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

    const arr = Merger.segmentsToXYThetaNode(segments, returnGraph);

    // Sort lexically
    arr.sort(Merger.XYThetaCompare);
    let lastNode = 0;

    // Connect nodes at vertices
    for (let i = 1; i <= arr.length; i++) {
      if (i === arr.length || !Geometry.isSameCoordinate(arr[i].node.x, arr[lastNode].node.x) ||
        !Geometry.isSameCoordinate(arr[i].node.y, arr[lastNode].node.y)) {
        // pinch matching vertices
        for (let j = lastNode; j < i - 1; j++) {
          HalfEdge.pinch(arr[j].node, arr[j + 1].node);
        }
        lastNode = i;
      }
    }

    return returnGraph;
  }

  // TODO: IMPROVE PERFORMANCE FROM N^2, N BEING THE # OF NODES IN THE FACE
  /** For every event, pair it with other events of the closest segments that this event's horizontal would hit on the left and right */
  private static setQueuePairings(queue: SweepEvent[]) {
    // Segment to be reused when testing intersections
    const unitSegment = LineSegment3d.createXYXY(0, 0, 0, 0);
    for (const event of queue) {
      // Segment to be reused when testing intersections
      const segToCheck = LineSegment3d.createXYXY(0, 0, 0, 0);

      // Left pairing
      LineSegment3d.createXYXY(event.node0.x, event.node0.y, event.node0.x - 1, event.node0.y, undefined, unitSegment);
      let closestDistance = Number.MAX_VALUE;
      let lastIntersection: Point3d | undefined;
      for (const toCheck of queue) {
        if (event.node0 === toCheck.node0)
          continue;

        LineSegment3d.createXYXY(toCheck.node0.x, toCheck.node0.y, toCheck.node1.x, toCheck.node1.y, undefined, segToCheck);
        const intersection = Merger.getIntersectionOfSegments(
          unitSegment, segToCheck, false);
        if (intersection) {  // found possible match

          if ((segToCheck.point0Ref.y <= event.node0.y && segToCheck.point1Ref.y >= event.node0.y) ||
            (segToCheck.point0Ref.y >= event.node0.y && segToCheck.point1Ref.y <= event.node0.y)) { // Check that segment is of correct height

            if (intersection.x < event.node0.x) {  // Is to left of point

              if (!(Geometry.isSameCoordinate(intersection.x, event.node0.x))) { // Intersection does not occur at same coord as endpoint
                const distanceToSegment = Geometry.distanceXYXY(intersection.x, intersection.y, event.node0.x, event.node0.y);

                if (lastIntersection && Geometry.isSamePoint3d(lastIntersection, intersection)) {   // For pairing at vertice, save alt.
                  event.leftAlt = toCheck;
                  lastIntersection = intersection;
                } else if (distanceToSegment < closestDistance) {
                  event.leftEvent = toCheck;
                  event.leftAlt = undefined;
                  lastIntersection = intersection;
                  closestDistance = distanceToSegment;
                }
              }
            }
          }
        }
      }

      // Right pairing
      LineSegment3d.createXYXY(event.node0.x, event.node0.y, event.node0.x + 1, event.node0.y, undefined, unitSegment);
      closestDistance = Number.MAX_VALUE;
      lastIntersection = undefined;
      for (const toCheck of queue) {
        if (event.node0 === toCheck.node0)
          continue;

        LineSegment3d.createXYXY(toCheck.node0.x, toCheck.node0.y, toCheck.node1.x, toCheck.node1.y, undefined, segToCheck);
        const intersection = Merger.getIntersectionOfSegments(unitSegment, segToCheck, false);
        if (intersection) {  // found possible match

          if ((segToCheck.point0Ref.y <= event.node0.y && segToCheck.point1Ref.y >= event.node0.y) ||
            (segToCheck.point0Ref.y >= event.node0.y && segToCheck.point1Ref.y <= event.node0.y)) { // Check that segment is of correct height

            if (intersection.x > event.node0.x) {  // Is to right of point

              if (!(Geometry.isSameCoordinate(intersection.x, event.node0.x))) {   // Intersection does not occur at same coord as endpoint
                const distanceToSegment = Geometry.distanceXYXY(intersection.x, intersection.y, event.node0.x, event.node0.y);

                if (lastIntersection && Geometry.isSamePoint3d(lastIntersection, intersection)) {   // For pairing at vertice, save alt.
                  event.rightAlt = toCheck;
                  lastIntersection = intersection;
                } else if (distanceToSegment < closestDistance) {
                  event.rightEvent = toCheck;
                  event.rightAlt = undefined;
                  lastIntersection = intersection;
                  closestDistance = distanceToSegment;
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Form a new connection between two nodes, patching up pointers in the creation of new face loops
   * * !! mark both new half edges visited!!! (This is strange)
   */
  private static join(node0: HalfEdge, node1: HalfEdge, graph: HalfEdgeGraph) {
    const alpha = graph.createEdgeXYZXYZ (
        node0.x, node0.y, node0.z, node0.i,
        node1.x, node1.y, node1.z, node1.i);
    const beta = alpha.edgeMate;
    HalfEdge.pinch (node0, alpha);
    HalfEdge.pinch (node1, beta);
    alpha.setMask(HalfEdgeMask.VISITED);
    beta.setMask(HalfEdgeMask.VISITED);
  }

  private static getNodeToJoin(eventNode: HalfEdge, toCheckNode: HalfEdge): HalfEdge | undefined {
    // Check if there already exists some form of connection between these two points in space
    // (Otherwise, duplicates will not be recognized due to previous connections that cause the node to split)
    for (const item1 of toCheckNode.collectAroundVertex())
      for (const item2 of eventNode.collectAroundVertex())
        if (item1.faceSuccessor === item2)
          return undefined;

    // If node toCheck already formed a connection, possible to have > 2 nodes at vertex (find out)
    const possibleConnections = toCheckNode.collectAroundVertex();
    if (possibleConnections.length <= 2)
      return toCheckNode;
    else {
      let currNode;
      // Only make a connection to the node in the same face loop
      for (const node of possibleConnections) {
        // Loop around face and return the node that is part of the face the eventNode is in
        currNode = node;
        do {
          if (currNode === eventNode)
            return node;
          currNode = currNode.faceSuccessor;
        } while (currNode !== node);
      }

      // Not in same face loop
      return undefined;
    }
  }

  /** Check a variety of cases by which adding a diagonal is allowed. If one is found, link nodes and return. */
  private static checkAndAddDiagonal(event: SweepEvent, toCheck: SweepEvent, graph: HalfEdgeGraph) {
    if (!event.leftEvent && !event.rightEvent) // No side of trapezoid.. continue to next event
      return;

    if (event.node0.facePredecessor === toCheck.node0 || event.node0.faceSuccessor === toCheck.node0)   // Can't join two neighbors
      return;

    // Case 1: Both left and right pairings of events are equal
    if (event.leftEvent && toCheck.leftEvent && event.rightEvent && toCheck.rightEvent) {
      if (event.leftEvent.node0 === toCheck.leftEvent.node0 && event.rightEvent.node0 === toCheck.rightEvent.node0) {
        const toJoin = Merger.getNodeToJoin(event.node0, toCheck.node0);
        if (toJoin)
          Merger.join(event.node0, toJoin!, graph);
        return;
      }
    }
    // Case 2: Event(1) left pairing is event(2) who's right pairing is event(1)
    if (event.leftEvent && toCheck.rightEvent) {
      if (event.node0 === toCheck.rightEvent.node0 && toCheck.node0 === event.leftEvent.node0) {
        const toJoin = Merger.getNodeToJoin(event.node0, toCheck.node0);
        if (toJoin)
          Merger.join(event.node0, toJoin!, graph);
        return;
      }
    }
    // Case 3: Event(1) right pairing is event(2) who's left pairing is event(1)
    if (event.rightEvent && toCheck.leftEvent) {
      if (event.node0 === toCheck.leftEvent.node0 && toCheck.node0 === event.rightEvent.node0) {
        const toJoin = Merger.getNodeToJoin(event.node0, toCheck.node0);
        if (toJoin)
          Merger.join(event.node0, toJoin!, graph);
        return;
      }
    }
    // Case 4: Event(1) has a left pairing of event(2), and both events have same right pairing
    if (toCheck.leftEvent && toCheck.rightEvent && event.rightEvent) {
      if (event.node0 === toCheck.leftEvent.node0 && event.rightEvent.node0 === toCheck.rightEvent.node0) {
        const toJoin = Merger.getNodeToJoin(event.node0, toCheck.node0);
        if (toJoin)
          Merger.join(event.node0, toJoin!, graph);
        return;
      }
    }
    // Case 5: Event(1) has a right pairing of event(2), and both events have same left pairing
    if (toCheck.leftEvent && toCheck.rightEvent && event.leftEvent) {
      if (event.node0 === toCheck.rightEvent.node0 && event.leftEvent.node0 === toCheck.leftEvent.node0) {
        const toJoin = Merger.getNodeToJoin(event.node0, toCheck.node0);
        if (toJoin)
          Merger.join(event.node0, toJoin!, graph);
        return;
      }
    }
  }

  /** Sweep over an event queue, adding new diagonal segments where possible in the formation of monotone faces */
  private static sweepDownUp(queue: SweepEvent[], graph: HalfEdgeGraph) {
    // Sweep going down...
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        if (queue[i].node0 === queue[j].node0)
          continue;

        const event = queue[i];
        const toCheck = queue[j];

        Merger.checkAndAddDiagonal(event, toCheck, graph);

      }
    }
    // Sweep going up...
    for (let i = queue.length - 1; i >= 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (queue[i].node0 === queue[j].node0)
          continue;

        const event = queue[i];
        const toCheck = queue[j];

        Merger.checkAndAddDiagonal(event, toCheck, graph);

      }
    }
  }

  public static formMonotoneFaces(graph: HalfEdgeGraph) {
    graph.clearMask(HalfEdgeMask.VISITED);

    // For every face, break the face down into monotone sections
    for (const node of graph.allHalfEdges) {
      if (node.isMaskSet(HalfEdgeMask.VISITED))
        continue;

      const queue: SweepEvent[] = [];
      let currNode = node;
      // Push face nodes onto the queue
      do {
        queue.push(new SweepEvent(currNode, currNode.faceSuccessor));
        currNode.setMask(HalfEdgeMask.VISITED);
        currNode = currNode.faceSuccessor;
      } while (currNode !== node);

      queue.sort(Merger.eventCompareTrapezoidation);  // Sort top to bottom by node0
      Merger.setQueuePairings(queue);   // Pair every event to a left and right "segment" (node connection)

      Merger.sweepDownUp(queue, graph);   // Sweep adding diagonals

      // Swap in alternates
      for (const event of queue) {
        if (event.leftAlt)
          event.leftEvent = event.leftAlt;
        if (event.rightAlt)
          event.rightEvent = event.rightAlt;
      }

      Merger.sweepDownUp(queue, graph);   // Sweep adding diagonals with alternates
    }
  }

}
export class GraphMerge {
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

}
