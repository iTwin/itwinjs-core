/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { HalfEdgeMask, HalfEdge, HalfEdgeGraph } from "./Graph";
import { XAndY } from "../geometry3d/XYZProps";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
/**
 * (static) mehods for triangulating polygons
 * * @internal
 */
export class Triangulator {

  /** Given the six nodes that make up two bordering triangles, "pinch" and relocate the nodes to flip them
   * * The shared edge mates are a and d.
   * * (abc) are a triangle in CCW order
   * * (dfe) are a triangle in CCW order. (!! node dfe instead of def.)
   */
  private static flipEdgeBetweenTriangles(a: HalfEdge, b: HalfEdge, c: HalfEdge, d: HalfEdge, e: HalfEdge, f: HalfEdge) {
    // Reassign all of the pointers
    HalfEdge.pinch(a, e);
    HalfEdge.pinch(c, d);
    HalfEdge.pinch(f, c);
    HalfEdge.pinch(e, b);

    // Move alpha and beta into the xy coordinates of their predecessors
    e.x = b.x;
    e.y = b.y;
    e.z = b.z;
    e.i = b.i;
    c.i = f.i;
    c.x = f.x;
    c.y = f.y;
    c.z = f.z;
  }
  /**
   * * nodeA is a given node
   * * nodeA1 is its nodeA.faceSuccessor
   * * nodeA2 is nodeA1.faceSuccessor, i.e. 3rd node of triangle A
   * * nodeB  is nodeA.edgeMate, i.e. a node in the "other" triangle at nodeA's edge
   * * nodeB1 is nodeB.faceSucessor
   * * nodeB2 is nodeB1.faceSuccessor, i.e the 3rd node of triangle B
   * Construct (as simple doubles, to avoid object creation) xy vectors from:
   * * (ux,uy): nodeA to nodeA1, i.e. the shared edge
   * * (vx,vy): nodeA to ndoeA2,
   * * (wx,wy): nodeA to nodeB2
   * * this determinant is positive if nodeA is "in the circle" of nodeB2, nodeA1, nodeA2
   * @param nodeA node on the diagonal edge of candidate for edge flip.
   * @param if true, divide the determinant by the sum of absolute values of the cubic terms of the determinant.
   * @return the determinant (but undefined if the faces are not triangles as expected.)
   */
  private static computeInCircleDeterminant(nodeA: HalfEdge, normalize: boolean): number | undefined {
    const nodeA1 = nodeA.faceSuccessor;
    const nodeA2 = nodeA1.faceSuccessor;
    if (nodeA2.faceSuccessor !== nodeA)
      return undefined;
    const nodeB = nodeA.edgeMate;
    const nodeB1 = nodeB.faceSuccessor;
    const nodeB2 = nodeB1.faceSuccessor;
    if (nodeB2.faceSuccessor !== nodeB)
      return undefined;
    const ux = nodeA1.x - nodeA.x;
    const uy = nodeA1.y - nodeA.y;
    const vx = nodeA2.x - nodeA.x;
    const vy = nodeA2.y - nodeA.y;
    if (Geometry.crossProductXYXY(ux, uy, vx, vy) < 0)
      return undefined;
    // we assume identical coordinates in pairs (nodeA, nodeB1)  and (nodeA1, nodeB)
    const wx = nodeB2.x - nodeA.x;
    const wy = nodeB2.y - nodeA.y;
    const tx = wx * wx + wy * wy;
    const ty = vx * vx + vy * vy;
    const tz = ux * ux + uy * uy;
    const q = Geometry.tripleProduct(
      wx, wy, tx,
      vx, vy, ty,
      ux, uy, tz);
    if (!normalize) return q;
    const denom = Math.abs(wx * vy * tz) + Math.abs(wx * ty * ux) + Math.abs(tx * vx * uy)
      + Math.abs(wx * ty * uy) + Math.abs(wy * vx * tz) + Math.abs(tx * vy * ux);
    return q / denom;   // divide by zero?  only if collapsed to a point.
  }
  /**
   *  *  Visit each node of the graph array
   *  *  If a flip would be possible, test the results of flipping using incircle condition
   *  *  If revealed to be an improvement, conduct the flip, mark involved nodes as unvisited, and repeat until all nodes are visited
   */
  public static flipTriangles(graph: HalfEdgeGraph) {
    const nodeArray = graph.allHalfEdges;
    graph.clearMask(HalfEdgeMask.VISITED);
    let foundNonVisited = false;

    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];

      // HalfEdge has already been visited or is exterior node
      if (node.isMaskSet(HalfEdgeMask.VISITED))
        continue;

      node.setMask(HalfEdgeMask.VISITED);

      if (node.edgeMate === undefined || node.isMaskSet(HalfEdgeMask.EXTERIOR) || node.isMaskSet(HalfEdgeMask.PRIMARY_EDGE)) // Flip not allowed
        continue;

      foundNonVisited = true;
      const incircle = Triangulator.computeInCircleDeterminant(node, false);
      if (incircle !== undefined && incircle > 0.0) {
        // Mark all nodes involved in flip as needing to be buffer (other than alpha and beta node we started with)
        node.facePredecessor.clearMask(HalfEdgeMask.VISITED);
        node.faceSuccessor.clearMask(HalfEdgeMask.VISITED);
        node.edgeMate.facePredecessor.clearMask(HalfEdgeMask.VISITED);
        node.edgeMate.faceSuccessor.clearMask(HalfEdgeMask.VISITED);
        // Flip the triangles
        Triangulator.flipEdgeBetweenTriangles(node.edgeMate.faceSuccessor, node.edgeMate.facePredecessor, node.edgeMate, node.faceSuccessor, node, node.facePredecessor);
      }

      // If at the end of the loop, check if we found an unvisited node we tried to flip.. if so, restart loop
      if (i === nodeArray.length - 1 && foundNonVisited) {
        i = -1;
        foundNonVisited = false;
      }
    }

    graph.clearMask(HalfEdgeMask.VISITED);
  }
  /**
   * * Only one outer loop permitted.
   * * Largest area loop is assumed outer.
   * @param loops an array of loops as GrowableXYZArray or XAndY[]
   * @returns triangulated graph, or undefined if bad data.
   */
  public static createTriangulatedGraphFromLoops(loops: GrowableXYZArray[] | XAndY[][]): HalfEdgeGraph | undefined {
    if (loops.length < 1)
      return undefined;
    const mask = HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE;
    const graph = new HalfEdgeGraph();
    const holeSeeds: HalfEdge[] = [];
    let maxArea = -10000.0;
    let maxAreaIndex = -1;
    // collect all the loops with pointers to the positive (inside)
    // remember which one has largest area.
    for (let i = 0; i < loops.length; i++) {
      let seed = Triangulator.directCreateFaceLoopFromCoordinates(graph, loops[i]);
      if (seed) {
        seed = seed.faceSuccessor;  // directCreate returns tail
        const mate = seed.vertexSuccessor;
        seed.setMaskAroundFace(mask);
        mate.setMaskAroundFace(mask);
        const signedFaceArea = seed.signedFaceArea();
        const area = Math.abs(signedFaceArea);
        holeSeeds.push(signedFaceArea >= 0 ? seed : mate);
        if (i === 0 || area > maxArea) {
          maxArea = area;
          maxAreaIndex = i;
        }
      }
    }
    if (holeSeeds.length === 0)
      return undefined;
    // extract the max area seed ...
    const maxAreaFace = holeSeeds[maxAreaIndex];
    holeSeeds[maxAreaIndex] = holeSeeds[holeSeeds.length - 1];
    holeSeeds.pop();
    maxAreaFace.vertexSuccessor.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
    // The hole seeds all have inside nodes.  Set mask there and jump to outside.
    for (let i = 0; i < holeSeeds.length; i++) {
      const seed = holeSeeds[i];
      seed.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
      holeSeeds[i] = this.getLeftmost(seed.vertexSuccessor);
    }

    const startingNode = Triangulator.spliceLeftMostNodesOfHoles(graph, maxAreaFace, holeSeeds, false);
    Triangulator.triangulateSingleFace(graph, startingNode);
    return graph;
  }
  /**
   * Triangulate all positive area faces of a graph.
   */
  public triangulateAllPositiveAreaFaces(graph: HalfEdgeGraph) {
    const seeds = graph.collectFaceLoops();
    for (const face of seeds) {
      if (face.countEdgesAroundFace() > 3) {
        const area = face.signedFaceArea();
        if (area > 0.0)
          Triangulator.triangulateSingleFace(graph, face);
      }
    }

  }

  /**
   * Triangulate the polygon made up of by a series of points.
   * * The loop may be either CCW or CW -- CCW order will be used for triangles.
   * * To triangulate a polygon with holes, use createTriangulatedGraphFromLoops
   */
  public static createTriangulatedGraphFromSingleLoop(data: XAndY[] | GrowableXYZArray): HalfEdgeGraph {
    const graph = new HalfEdgeGraph();
    const startingNode = Triangulator.createFaceLoopFromCoordinates(graph, data, true, true);

    if (!startingNode) return graph;

    Triangulator.triangulateSingleFace(graph, startingNode, undefined);
    return graph;
  }

  /**
   * cautiously split the edge starting at baseNode.
   * * If baseNode is null, create a trivial loop with the single vertex at xy
   * * if xy is distinct from the coordinates at both baseNode and its successor, insert xy as a new node within that edge.
   * * also include z coordinate if present.
   */
  private static interiorEdgeSplit(graph: HalfEdgeGraph, baseNode: HalfEdge | undefined, xy: XAndY): HalfEdge | undefined {
    const z = (xy as any).hasOwnProperty("z") ? (xy as any).z : 0.0;
    if (!baseNode)
      return graph.splitEdge(baseNode, xy.x, xy.y, z);
    if (Triangulator.equalXAndY(baseNode, xy))
      return baseNode;
    if (Triangulator.equalXAndY(baseNode.faceSuccessor, xy))
      return baseNode;
    return graph.splitEdge(baseNode, xy.x, xy.y, z);
  }

  private static directCreateFaceLoopFromCoordinates(graph: HalfEdgeGraph, data: XAndY[] | IndexedXYZCollection): HalfEdge | undefined {
    // Add the starting nodes as the boundary, and apply initial masks to the primary edge and exteriors
    let baseNode: HalfEdge | undefined;
    if (data instanceof IndexedXYZCollection) {
      const xyz = Point3d.create();
      for (let i = 0; i < data.length; i++) {
        data.getPoint3dAtCheckedPointIndex(i, xyz);
        baseNode = Triangulator.interiorEdgeSplit(graph, baseNode, xyz);
      }
    } else {
      for (const xy of data) {
        baseNode = Triangulator.interiorEdgeSplit(graph, baseNode, xy);
      }
    }
    return baseNode;
  }

  /**
   * @param graph the containing graph
   * @param base The last node of a newly created loop.  (i.e. its `faceSuccessor` has the start xy)
   * @param returnPositiveAreaLoop if true, return the start node on the side with positive area.  otherwise return the left side as given.
   * @param markExterior
   * @return the loop's start node or its vertex sucessor, chosen to be the positive or negative loop per request.
   */
  private static maskAndOrientNewFaceLoop(_graph: HalfEdgeGraph, base: HalfEdge | undefined, returnPositiveAreaLoop: boolean, markExterior: boolean): HalfEdge | undefined {
    // base is the final coordinates
    if (base) {
      base = base.faceSuccessor; // because typical construction process leaves the "live" edge at the end of the loop.
      const area = base.signedFaceArea();
      const mate = base.edgeMate;
      base.setMaskAroundFace(HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE);
      mate.setMaskAroundFace(HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE);

      let preferredNode = base;
      if (returnPositiveAreaLoop === (area < 0))
        preferredNode = mate;
      const otherNode = preferredNode.vertexSuccessor;

      if (markExterior)
        otherNode.setMaskAroundFace(HalfEdgeMask.EXTERIOR);
      return preferredNode;
    }
    return undefined;   // caller should not be calling with start <= end
  }
  /**
   * create a circular doubly linked list of internal and external nodes from polygon points in the specified winding order
   * * If start and end are both zero, use the whole array.
   */
  public static createFaceLoopFromCoordinates(graph: HalfEdgeGraph, data: XAndY[] | GrowableXYZArray, returnPositiveAreaLoop: boolean, markExterior: boolean): HalfEdge | undefined {
    const base = Triangulator.directCreateFaceLoopFromCoordinates(graph, data);
    return Triangulator.maskAndOrientNewFaceLoop(graph, base, returnPositiveAreaLoop, markExterior);
  }

  /** eliminate colinear or duplicate points using starting and ending nodes */
  private static filterPoints(graph: HalfEdgeGraph, start?: HalfEdge, end?: HalfEdge): HalfEdge | undefined {
    if (!start) return start;
    if (!end) end = start;

    let p = start;
    let again;
    do {
      again = false;

      if (!p.steiner && (Triangulator.equalXAndY(p, p.faceSuccessor) || Triangulator.signedTriangleArea(p.facePredecessor, p, p.faceSuccessor) === 0)) {
        Triangulator.joinNeighborsOfEar(graph, p);
        p = end = p.facePredecessor;
        if (p === p.faceSuccessor) return undefined;
        again = true;

      } else {
        p = p.faceSuccessor;
      }
    } while (again || p !== end);

    return end;
  }

  /** Cut off an ear, forming a new face loop of nodes
   * @param ear the vertex being cut off.
   * *  Form two new nodes, alpha and beta, which have the coordinates one step away from the ear vertex.
   * *  Reassigns the pointers such that beta is left behind with the new face created
   * *  Reassigns the pointers such that alpha becomes the resulting missing node from the remaining polygon
   * * Reassigns prevZ and nextZ pointers
   */
  private static joinNeighborsOfEar(graph: HalfEdgeGraph, ear: HalfEdge) {
    const alpha = graph.createEdgeXYZXYZ(
      ear.facePredecessor.x, ear.facePredecessor.y, ear.facePredecessor.z, ear.facePredecessor.i,
      ear.faceSuccessor.x, ear.faceSuccessor.y, ear.faceSuccessor.z, ear.faceSuccessor.i);
    const beta = alpha.edgeMate;

    // Add two nodes alpha and beta and reassign pointers (also mark triangle nodes as part of triangle)
    HalfEdge.pinch(ear.faceSuccessor, beta);
    HalfEdge.pinch(ear.facePredecessor, alpha);
    ear.setMaskAroundFace(HalfEdgeMask.TRIANGULATED_NODE_MASK);
  }
  private static isInteriorTriangle(a: HalfEdge) {
    if (!a.isMaskSet(HalfEdgeMask.TRIANGULATED_NODE_MASK))
      return false;
    const b = a.faceSuccessor;
    if (!b.isMaskSet(HalfEdgeMask.TRIANGULATED_NODE_MASK))
      return false;
    const c = b.faceSuccessor;
    if (!c.isMaskSet(HalfEdgeMask.TRIANGULATED_NODE_MASK))
      return false;
    return c.faceSuccessor === a;
  }

  /**
   * Perform 0, 1, or more edge flips to improve aspect ratio just behind an that was just cut.
   * @param ear the triangle corner which just served as the ear node.
   * @returns the node at the back corner after flipping."appropriately positioned" node for the usual advance to ear.faceSuccessor.edgeMate.faceSuccessor.
   */
  private static doPostCutFlips(ear: HalfEdge) {
    //    B is the ear -- inside a (probably newly created) triangle ABC
    //    CA is the recently added cut edge.
    //    AB is the candidate to be flipped.
    //    triangle B1 A1 D is on the other side of AB
    //    The condition for flipping is:
    //           ! both triangles must be TRIANGULATED_NODE_MASK
    //           ! incircle condition flags D as in the circle of ABC
    //     after flip, node A moves to the vertex of D, and is the effective "ear",  with the cap edge C A1
    //      after flip, consider the A1 D (whose nodes are A1 and flipped A!!!)
    //
    //
    //                                   . C0|
    //                              .        |
    //                           .           |
    //                       .              ^|
    //                   .  A0 ---->       B0|
    //               *=======================*
    //                 \ A1     <----   B1/
    //                   \             /
    //                     \         /
    //                       \  D1 /
    //                          *
    let b0 = ear;
    let a0 = b0.facePredecessor;
    let b1 = a0.edgeMate;
    while (Triangulator.isInteriorTriangle(a0) && Triangulator.isInteriorTriangle(b1)) {
      const detA = Triangulator.computeInCircleDeterminant(a0, true);
      if (detA === undefined || detA < 1.0e-10)
        break;
      // Flip the triangles
      const a1 = b1.faceSuccessor;
      Triangulator.flipEdgeBetweenTriangles(a1, a1.faceSuccessor, a1.facePredecessor, b0, b0.facePredecessor, b0.faceSuccessor);
      b0 = a0;
      a0 = b0.facePredecessor;
      b1 = a0.edgeMate;
    }
    return b0;
  }

  /**
   * main ear slicing loop which triangulates a polygon (given as a linked list)
   * While there still exists ear nodes that have not yet been triangulated...
   *
   * *  Check if the ear is hashed, and can easily be split off. If so, "join" that ear.
   * *  If not hashed, move on to a seperate ear.
   * *  If no ears are currently hashed, attempt to cure self intersections or split the polygon into two before continuing
   */
  private static triangulateSingleFace(graph: HalfEdgeGraph, ear?: HalfEdge, pass?: number) {
    if (!ear) return;

    let next;
    let numFail = 0;
    let maxFail = (ear as HalfEdge).countEdgesAroundFace();
    // iterate through ears, slicing them one by one
    while (!ear.isMaskSet(HalfEdgeMask.TRIANGULATED_NODE_MASK)) {
      next = ear.faceSuccessor;

      if (Triangulator.isEar(ear)) {
        // skipping the next vertice leads to less sliver triangles

        // If we already have a seperated triangle, do not join
        if (ear.faceSuccessor.faceSuccessor !== ear.facePredecessor) {
          Triangulator.joinNeighborsOfEar(graph, ear);
          ear = Triangulator.doPostCutFlips(ear);
          ear = ear.faceSuccessor.edgeMate.faceSuccessor;
          // another step?   Nate's 2017 code went one more.
        } else {
          ear.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear.faceSuccessor.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear.facePredecessor.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear = next.faceSuccessor;
        }
        numFail = 0;
        maxFail--;
        continue;
      }
      numFail++;
      ear = next;

      // if we looped through the whole remaining polygon and can't find any more ears
      if (numFail >= maxFail) {
        numFail = 0;
        // try filtering points and slicing again
        // if (!pass) {
        //  Triangulator.earcutLinked(Triangulator.filterPoints(ear), minX, minY, size, 1);
        // }
        // if this didn't work, try curing all small self-intersections locally
        if (!pass) {
          ear = Triangulator.cureLocalIntersections(graph, ear);
          Triangulator.triangulateSingleFace(graph, ear, 2);

          // as a last resort, try splitting the remaining polygon into two
        } else if (pass === 2) {
          Triangulator.splitEarcut(graph, ear);
        }

        break;
      }
    }
  }

  /** Check whether a polygon node forms a valid ear with adjacent nodes */
  private static isEar(ear: HalfEdge) {
    const a = ear.facePredecessor;
    const b = ear;
    const c = ear.faceSuccessor;

    if (Triangulator.signedTriangleArea(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    let p = ear.faceSuccessor.faceSuccessor;

    while (p !== ear.facePredecessor) {
      if (Triangulator.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
        Triangulator.signedTriangleArea(p.facePredecessor, p, p.faceSuccessor) >= 0) return false;
      p = p.faceSuccessor;
    }

    return true;
  }

  /** Go through all polygon nodes and cure small local self-intersections */
  private static cureLocalIntersections(graph: HalfEdgeGraph, start: HalfEdge) {
    let p = start;
    do {
      const a = p.facePredecessor;
      const b = p.faceSuccessor.faceSuccessor;

      if (!Triangulator.equalXAndY(a, b) && Triangulator.intersects(a, p, p.faceSuccessor, b) &&
        Triangulator.locallyInside(a, b) && Triangulator.locallyInside(b, a)) {

        // remove two nodes involved
        Triangulator.joinNeighborsOfEar(graph, p);
        Triangulator.joinNeighborsOfEar(graph, p.faceSuccessor);

        p = start = b;
      }
      p = p.faceSuccessor;
    } while (p !== start);

    return p;
  }

  /** try splitting face into two and triangulate them independently */
  private static splitEarcut(graph: HalfEdgeGraph, start: HalfEdge) {
    // look for a valid diagonal that divides the polygon into two
    let a: HalfEdge | undefined = start;
    do {
      let b = a.faceSuccessor.faceSuccessor;
      while (b !== a.facePredecessor) {
        if (a.i !== b.i && Triangulator.isValidDiagonal(a, b)) {
          // split the polygon in two by the diagonal
          let c: HalfEdge | undefined = Triangulator.splitPolygon(graph, a, b);

          // filter colinear points around the cuts
          a = Triangulator.filterPoints(graph, a, a.faceSuccessor);
          c = Triangulator.filterPoints(graph, c, c.faceSuccessor);

          // run earcut on each half
          Triangulator.triangulateSingleFace(graph, a);
          Triangulator.triangulateSingleFace(graph, c);
          return;
        }
        b = b.faceSuccessor;
      }
      a = a.faceSuccessor;
    } while (a !== start);
  }

  /** link holeLoopNodes[1], holeLoopNodes[2] etc into the outer loop, producing a single-ring polygon without holes
   *
   */
  private static spliceLeftMostNodesOfHoles(graph: HalfEdgeGraph, outerNode: HalfEdge, leftMostHoleLoopNode: HalfEdge[], applyFilter: boolean = true) {

    leftMostHoleLoopNode.sort(Triangulator.compareX);

    // process holes from left to right
    for (const holeStart of leftMostHoleLoopNode) {
      Triangulator.eliminateHole(graph, holeStart, outerNode, applyFilter);
      if (applyFilter)
        outerNode = Triangulator.filterPoints(graph, outerNode, (outerNode) ? outerNode.faceSuccessor : undefined) as HalfEdge;
    }

    return outerNode;
  }
  /** For use in sorting -- return (signed) difference (a.x - b.x) */
  private static compareX(a: HalfEdge, b: HalfEdge) {
    return a.x - b.x;
  }

  /** find a bridge between vertices that connects hole with an outer ring and and link it */
  private static eliminateHole(graph: HalfEdgeGraph, hole: HalfEdge, outerNode: HalfEdge, applyFilter: boolean) {
    const outerNodeA = Triangulator.findHoleBridge(hole, outerNode);
    if (outerNodeA) {
      const b = Triangulator.splitPolygon(graph, outerNodeA, hole);
      if (applyFilter)
        Triangulator.filterPoints(graph, b, b.faceSuccessor);
    }
  }

  /**
   *  David Eberly's algorithm for finding a bridge between hole and outer polygon:
   *  https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
   */
  private static findHoleBridge(hole: HalfEdge, outerNode?: HalfEdge): HalfEdge | undefined {
    let p = outerNode;

    if (!p)
      return undefined;

    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    let m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    do {
      if (hy <= p.y && hy >= p.faceSuccessor.y && p.faceSuccessor.y !== p.y) {
        const x = p.x + (hy - p.y) * (p.faceSuccessor.x - p.x) / (p.faceSuccessor.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          if (x === hx) {
            if (hy === p.y) return p;
            if (hy === p.faceSuccessor.y) return p.faceSuccessor;
          }
          m = p.x < p.faceSuccessor.x ? p : p.faceSuccessor;
        }
      }
      p = p.faceSuccessor;
    } while (p !== outerNode);

    if (!m) return undefined;

    if (hx === qx) return m.facePredecessor; // hole touches outer segment; pick lower endpoint

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    const stop = m;
    const mx = m.x;
    const my = m.y;
    let tanMin = Infinity;
    let tan;

    p = m.faceSuccessor;

    while (p !== stop) {
      if (hx >= p.x && p.x >= mx && hx !== p.x &&
        Triangulator.pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

        tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

        if ((tan < tanMin || (tan === tanMin && p.x > m.x)) && Triangulator.locallyInside(p, hole)) {
          m = p;
          tanMin = tan;
        }
      }

      p = p.faceSuccessor;
    }

    return m;
  }

  // find the leftmost node of a polygon ring
  private static getLeftmost(start: HalfEdge) {
    let p = start;
    let leftmost = start;
    do {
      if (p.x < leftmost.x) leftmost = p;
      p = p.faceSuccessor;
    } while (p !== start);

    return leftmost;
  }

  /** check if a point lies within a convex triangle */
  private static pointInTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number) {
    return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
      (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
      (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
  }

  /** check if a diagonal between two polygon nodes is valid (lies in polygon interior) */
  private static isValidDiagonal(a: HalfEdge, b: HalfEdge) {
    return a.faceSuccessor.i !== b.i && a.facePredecessor.i !== b.i && !Triangulator.intersectsPolygon(a, b) &&
      Triangulator.locallyInside(a, b) && Triangulator.locallyInside(b, a) && Triangulator.middleInside(a, b);
  }

  /** signed area of a triangle */
  private static signedTriangleArea(p: HalfEdge, q: HalfEdge, r: HalfEdge) {
    return 0.5 * ((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  }

  /** check if two points are equal */
  private static equalXAndY(p1: XAndY, p2: XAndY) {
    return Geometry.isSameCoordinate(p1.x, p2.x) && Geometry.isSameCoordinate(p1.y, p2.y);
  }

  /** check if two segments intersect */
  private static intersects(p1: HalfEdge, q1: HalfEdge, p2: HalfEdge, q2: HalfEdge) {
    if ((Triangulator.equalXAndY(p1, q1) && Triangulator.equalXAndY(p2, q2)) ||
      (Triangulator.equalXAndY(p1, q2) && Triangulator.equalXAndY(p2, q1))) return true;
    return Triangulator.signedTriangleArea(p1, q1, p2) > 0 !== Triangulator.signedTriangleArea(p1, q1, q2) > 0 &&
      Triangulator.signedTriangleArea(p2, q2, p1) > 0 !== Triangulator.signedTriangleArea(p2, q2, q1) > 0;
  }

  /** check if a polygon diagonal intersects any polygon segments */
  private static intersectsPolygon(a: HalfEdge, b: HalfEdge) {
    let p = a;
    do {
      if (p.i !== a.i && p.faceSuccessor.i !== a.i && p.i !== b.i && p.faceSuccessor.i !== b.i &&
        Triangulator.intersects(p, p.faceSuccessor, a, b)) return true;
      p = p.faceSuccessor;
    } while (p !== a);

    return false;
  }

  /** check if a polygon diagonal is locally inside the polygon */
  private static locallyInside(a: HalfEdge, b: HalfEdge) {
    return Triangulator.signedTriangleArea(a.facePredecessor, a, a.faceSuccessor) < 0 ?
      Triangulator.signedTriangleArea(a, b, a.faceSuccessor) >= 0 && Triangulator.signedTriangleArea(a, a.facePredecessor, b) >= 0 :
      Triangulator.signedTriangleArea(a, b, a.facePredecessor) < 0 || Triangulator.signedTriangleArea(a, a.faceSuccessor, b) < 0;
  }

  /** check if the middle point of a polygon diagonal is inside the polygon */
  private static middleInside(a: HalfEdge, b: HalfEdge) {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    do {
      if (((p.y > py) !== (p.faceSuccessor.y > py)) && p.faceSuccessor.y !== p.y &&
        (px < (p.faceSuccessor.x - p.x) * (py - p.y) / (p.faceSuccessor.y - p.y) + p.x))
        inside = !inside;
      p = p.faceSuccessor;
    } while (p !== a);

    return inside;
  }

  /**
   * link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
   * if one belongs to the outer ring and another to a hole, it merges it into a single ring
   * * Returns the base of the new edge at the "a" end.
   * * "a" and "b" still represent the same physical pieces of edges
   * @returns Returns the (base of) the new half edge, at the "a" end.
   */
  private static splitPolygon(graph: HalfEdgeGraph, a: HalfEdge, b: HalfEdge): HalfEdge {
    const a2 = graph.createEdgeXYZXYZ(a.x, a.y, a.z, a.i, b.x, b.y, b.z, b.i);
    const b2 = a2.faceSuccessor;

    HalfEdge.pinch(a, a2);
    HalfEdge.pinch(b, b2);

    return a2;
  }

  // Methods below were originally properties of the Earcut function itself (was not originally a class), but were not used for
  // actual triangulation process

  /*
  // return a percentage difference between the polygon area and its triangulation area;
  // used to verify correctness of triangulation
  private static deviation(data: number[], holeIndices: number[], dim: number, triangles: number[][]) {
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = holeIndices ? holeIndices[0] * dim : data.length;

    let polygonArea = Math.abs(Triangulator.signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (let i = 0, len = holeIndices.length; i < len; i++) {
            const start = holeIndices[i] * dim;
            const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(Triangulator.signedArea(data, start, end, dim));
        }
    }

    let trianglesArea = 0;
    for (const triangle of triangles) {
        const a = triangle[0] * dim;
        const b = triangle[1] * dim;
        const c = triangle[2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    return polygonArea === 0 && trianglesArea === 0 ? 0 :
        Math.abs((trianglesArea - polygonArea) / polygonArea);
  }

  // turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
  private static flatten(data: number[][][]) {
    const dim = data[0][0].length;
    const result: {vertices: number[], holes: number[], dimensions: number} = {vertices: [], holes: [], dimensions: dim};
    let holeIndex = 0;

    for (let i = 0; i < data.length; i++) {
        const len = data[i].length;
        for (let j = 0; j < len; j++) {
            for (let d = 0; d < dim; d++) result.vertices.push(data[i][j][d]);
        }
        if (i > 0) {
            holeIndex += data[i - 1].length;
            result.holes.push(holeIndex);
        }
    }
    return result;
  }
  */
}
