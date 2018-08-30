/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { HalfEdgeMask, HalfEdge, HalfEdgeGraph } from "./Graph";
import { Point3d, Vector3d } from "../PointVector";
import { Matrix3d } from "../Transform";
import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "../GrowableArray";

export class Triangulator {
  // HalfEdgeGraph that is used by many of the private methods inside of the Triangulator class, until being returned at the end of triangulation
  private static _returnGraph: HalfEdgeGraph;

  /** Given the six nodes that make up two bordering triangles, "pinch" and relocate the nodes to flip them */
  private static flipTriangles(a: any, b: any, c: any, d: any, e: any, f: any) {
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
   *  *  Visit each node of the graph array
   *  *  If a flip would be possible, test the results of flipping using an Matrix3d
   *  *  If revealed to be an improvement, conduct the flip, mark involved nodes as unvisited, and repeat until all nodes are visited
   */
  public static cleanupTriangulation(graph: HalfEdgeGraph) {
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

      // Grab 4 points between the two triangles
      const alphaPoint = Point3d.create(node.x, node.y, node.z);
      const betaPoint = Point3d.create(node.edgeMate.x, node.edgeMate.y, node.edgeMate.z);
      const preAlphaPoint = Point3d.create(node.facePredecessor.x, node.facePredecessor.y, node.edgeMate.z);
      const preBetaPoint = Point3d.create(node.edgeMate.facePredecessor.x, node.edgeMate.facePredecessor.y, node.edgeMate.facePredecessor.z);

      // Convert to vectors
      const sharedVector = Vector3d.createStartEnd(alphaPoint, betaPoint);
      const alphaVector = Vector3d.createStartEnd(alphaPoint, preAlphaPoint);
      const betaVector = Vector3d.createStartEnd(alphaPoint, preBetaPoint);

      // Use Matrix3d to determine if flip is necessary
      const matrix = Matrix3d.createRowValues(
        betaVector.x, betaVector.y, betaVector.x * betaVector.x + betaVector.y * betaVector.y,
        alphaVector.x, alphaVector.y, alphaVector.x * alphaVector.x + alphaVector.y * alphaVector.y,
        sharedVector.x, sharedVector.y, sharedVector.x * sharedVector.x + sharedVector.y * sharedVector.y,
      );

      if (matrix.determinant() > 0.0) {
        // Mark all nodes involved in flip as needing to be buffer (other than alpha and beta node we started with)
        node.facePredecessor.clearMask(HalfEdgeMask.VISITED);
        node.faceSuccessor.clearMask(HalfEdgeMask.VISITED);
        node.edgeMate.facePredecessor.clearMask(HalfEdgeMask.VISITED);
        node.edgeMate.faceSuccessor.clearMask(HalfEdgeMask.VISITED);
        // Flip the triangles
        Triangulator.flipTriangles(node.edgeMate.faceSuccessor, node.edgeMate.facePredecessor, node.edgeMate, node.faceSuccessor, node, node.facePredecessor);
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
   *
   * @param strokedLoops an array of loops as GrowableXYZArray.
   * @returns triangulated graph, or undefined if bad data.
   */
  public static triangulateStrokedLoops(strokedLoops: GrowableXYZArray[]): HalfEdgeGraph | undefined {
    if (strokedLoops.length < 1)
      return undefined;
    Triangulator._returnGraph = new HalfEdgeGraph();
    let maxArea = strokedLoops[0].areaXY();
    let largestLoopIndex = 0;
    for (let i = 0; i < strokedLoops.length; i++) {
      const area = Math.abs(strokedLoops[i].areaXY());
      if (area > maxArea) {
        maxArea = area;
        largestLoopIndex = i;
      }
    }
    // NOW WE KNOW ...
    // strokedLoops[largestAreaIndex] is the largest loop.  (Hence outer, but orientation is not guaranteed.)
    const holeLoops = [];
    const startingNode = Triangulator.createFaceLoopFromGrowableXYZArray(strokedLoops[largestLoopIndex], true, true);
    if (!startingNode)
      return Triangulator._returnGraph;
    for (let i = 0; i < strokedLoops.length; i++) {
      if (i !== largestLoopIndex) {
        const holeLoop = Triangulator.createFaceLoopFromGrowableXYZArray(strokedLoops[i], false, true);
        if (holeLoop)
          holeLoops.push(holeLoop);
      }
    }
    // HERE .. NATE ... all the hole loops been created.  Make sure the settings for returnPositiveAreaLoop and markExterior had the effect you need !!!
    return undefined;
  }
  /**
   * Triangulate the polygon made up of by a series of points
   *
   * *  Outer-edge points must be passed in counter-clockwise order
   * *  Inner-edge (hole) indices must be passed in clockwise order (following the outer edge points)
   * *  Optional holeIndices array specifies which indices of points array given are the starts of holes
   */
  public static earcutFromPoints(data: Point3d[], holeIndices?: number[]): HalfEdgeGraph {
    Triangulator._returnGraph = new HalfEdgeGraph();
    let outerLen = (holeIndices && holeIndices.length) ? holeIndices[0] : data.length;

    // Do not include points on end of array that match the starting point
    for (let i = outerLen - 1; i > 0; i--) {
      if (Geometry.isSameCoordinate(data[i].x, data[0].x) && Geometry.isSameCoordinate(data[i].y, data[0].y))
        outerLen--;
      else
        break;
    }

    let startingNode = Triangulator.createFaceLoop(data, 0, outerLen, true, true);

    if (!startingNode) return Triangulator._returnGraph;

    let minX;
    let minY;
    let maxX;
    let maxY;
    let x;
    let y;
    let size;

    if (holeIndices && holeIndices.length) startingNode = Triangulator.eliminateHoles(data, startingNode, holeIndices);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80) {
      minX = maxX = data[0].x;
      minY = maxY = data[0].y;

      for (let i = 1; i < outerLen; i++) {
        x = data[i].x;
        y = data[i].y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }

      // minX, minY and size are later used to transform coords into integers for z-order calculation
      size = Math.max(maxX - minX, maxY - minY);
    }

    Triangulator.earcutLinked(startingNode, minX, minY, size);
    return Triangulator._returnGraph;
  }

  private static directcreateFaceLoopFromGrowableXYZ(graph: HalfEdgeGraph, data: GrowableXYZArray): HalfEdge | undefined {
    let i;
    // Add the starting nodes as the boundary, and apply initial masks to the primary edge and exteriors
    let base: HalfEdge | undefined;
    const xyz = Point3d.create();
    for (i = 0; i < data.length; i++) {
      data.getPoint3dAt(i, xyz);
      base = graph.splitEdge(base, xyz.x, xyz.y, xyz.z);
    }
    return base;
  }

  private static directCreateFaceLoopFromPointArraySubset(graph: HalfEdgeGraph, data: Point3d[], start: number, end: number): HalfEdge | undefined {
    let i;
    // Add the starting nodes as the boundary, and apply initial masks to the primary edge and exteriors
    let base: HalfEdge | undefined;
    for (i = start; i < end; i++) {
      base = graph.splitEdge(base, data[i].x, data[i].y, data[i].z);
    }
    return base;
  }

  /**
   * @param graph the containing graph
   * @praam base base node of newly created loop.
   * @param returnPositiveAreaLoop if true, return the start node on the side with positive area.  otherwise return the left side as given.
   * @param markExterior
   */
  private static assignMasksToNewFaceLoop(_graph: HalfEdgeGraph, base: HalfEdge | undefined, returnPositiveAreaLoop: boolean, markExterior: boolean): HalfEdge | undefined {
    // base is the final coordinates
    if (base) {
      base = base.faceSuccessor;
      const area = base.signedFaceArea();
      base.setMaskAroundFace(HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE);
      base.edgeMate.setMaskAroundFace(
        markExterior ? (HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE | HalfEdgeMask.EXTERIOR)
          : (HalfEdgeMask.BOUNDARY | HalfEdgeMask.PRIMARY_EDGE));
      if (area > 0 === returnPositiveAreaLoop)
        return base;
      else return base.vertexSuccessor;
    }
    return undefined;   // caller should not be calling with start <= end
  }
  /**
   * create a circular doubly linked list of internal and external nodes from polygon points in the specified winding order
   */
  private static createFaceLoop(data: Point3d[], start: number, end: number, returnPositiveAreaLoop: boolean, markExterior: boolean): HalfEdge | undefined {
    const graph = Triangulator._returnGraph;
    const base = Triangulator.directCreateFaceLoopFromPointArraySubset(graph, data, start, end);
    return Triangulator.assignMasksToNewFaceLoop(graph, base, returnPositiveAreaLoop, markExterior);
  }

  /**
   * create a circular doubly linked list of internal and external nodes from polygon points in the specified winding order
   */
  public static createFaceLoopFromGrowableXYZArray(data: GrowableXYZArray, returnPositiveAreaLoop: boolean, markExterior: boolean): HalfEdge | undefined {
    const graph = Triangulator._returnGraph;
    const base = Triangulator.directcreateFaceLoopFromGrowableXYZ(graph, data);
    return Triangulator.assignMasksToNewFaceLoop(graph, base, returnPositiveAreaLoop, markExterior);
  }

  /** eliminate colinear or duplicate points using starting and ending nodes */
  private static filterPoints(start?: any, end?: any) {
    if (!start) return start;
    if (!end) end = start;

    let p = start;
    let again;
    do {
      again = false;

      if (!p.steiner && (Triangulator.equals(p, p.faceSuccessor) || Triangulator.area(p.facePredecessor, p, p.faceSuccessor) === 0)) {
        Triangulator.join(p);
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
  private static join(ear: HalfEdge) {
    const alpha = Triangulator._returnGraph.createEdgeXYZXYZ(
      ear.facePredecessor.x, ear.facePredecessor.y, ear.facePredecessor.z, ear.facePredecessor.i,
      ear.faceSuccessor.x, ear.faceSuccessor.y, ear.faceSuccessor.z, ear.faceSuccessor.i);
    const beta = alpha.edgeMate;

    // Take care of z-ordering
    if (ear.prevZ) ear.prevZ.nextZ = ear.nextZ;
    if (ear.nextZ) ear.nextZ.prevZ = ear.prevZ;

    // Add two nodes alpha and beta and reassign pointers (also mark triangle nodes as part of triangle)
    HalfEdge.pinch(ear.faceSuccessor, beta);
    HalfEdge.pinch(ear.facePredecessor, alpha);
    ear.setMaskAroundFace(HalfEdgeMask.TRIANGULATED_NODE_MASK);
  }

  /**
   * main ear slicing loop which triangulates a polygon (given as a linked list)
   * While there still exists ear nodes that have not yet been triangulated...
   *
   * *  Check if the ear is hashed, and can easily be split off. If so, "join" that ear.
   * *  If not hashed, move on to a seperate ear.
   * *  If no ears are currently hashed, attempt to cure self intersections or split the polygon into two before continuing
   */
  private static earcutLinked(ear?: any, minX?: number, minY?: number, size?: number, pass?: number) {
    if (!ear) return;

    // interlink polygon nodes in z-order
    if (!pass && size) Triangulator.indexCurve(ear, minX, minY, size);

    let stop = ear;
    let next;

    // iterate through ears, slicing them one by one
    while (!ear.isMaskSet(HalfEdgeMask.TRIANGULATED_NODE_MASK)) {
      next = ear.faceSuccessor;

      if (size ? Triangulator.isEarHashed(ear, minX, minY, size) : Triangulator.isEar(ear)) {
        // skipping the next vertice leads to less sliver triangles
        stop = next.faceSuccessor;

        // If we already have a seperated triangle, do not join
        if (ear.faceSuccessor.faceSuccessor !== ear.facePredecessor) {
          Triangulator.join(ear);
          ear = ear.faceSuccessor.edgeMate.faceSuccessor.faceSuccessor;
        } else {
          ear.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear.faceSuccessor.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear.facePredecessor.setMask(HalfEdgeMask.TRIANGULATED_NODE_MASK);
          ear = next.faceSuccessor;
        }

        continue;
      }

      ear = next;

      // if we looped through the whole remaining polygon and can't find any more ears
      if (ear === stop) {
        // try filtering points and slicing again
        // if (!pass) {
        //  Triangulator.earcutLinked(Triangulator.filterPoints(ear), minX, minY, size, 1);
        // }
        // if this didn't work, try curing all small self-intersections locally
        if (!pass) {
          ear = Triangulator.cureLocalIntersections(ear);
          Triangulator.earcutLinked(ear, minX, minY, size, 2);

          // as a last resort, try splitting the remaining polygon into two
        } else if (pass === 2) {
          Triangulator.splitEarcut(ear, minX, minY, size);
        }

        break;
      }
    }
  }

  /** Check whether a polygon node forms a valid ear with adjacent nodes */
  private static isEar(ear: any) {
    const a = ear.facePredecessor;
    const b = ear;
    const c = ear.faceSuccessor;

    if (Triangulator.area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    let p = ear.faceSuccessor.faceSuccessor;

    while (p !== ear.facePredecessor) {
      if (Triangulator.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
        Triangulator.area(p.facePredecessor, p, p.faceSuccessor) >= 0) return false;
      p = p.faceSuccessor;
    }

    return true;
  }

  /** Check whether a polygon node forms a valid ear with adjacent nodes using bounded boxes of z-ordering of this and adjacent nodes */
  private static isEarHashed(ear: any, minX?: number, minY?: number, size?: number) {
    const a = ear.facePredecessor;
    const b = ear;
    const c = ear.faceSuccessor;

    if (Triangulator.area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // triangle bbox; min & max are calculated like this for speed
    const minTX = a.x < b.x ? (a.x < c.x ? a.x : c.x) : (b.x < c.x ? b.x : c.x);
    const minTY = a.y < b.y ? (a.y < c.y ? a.y : c.y) : (b.y < c.y ? b.y : c.y);
    const maxTX = a.x > b.x ? (a.x > c.x ? a.x : c.x) : (b.x > c.x ? b.x : c.x);
    const maxTY = a.y > b.y ? (a.y > c.y ? a.y : c.y) : (b.y > c.y ? b.y : c.y);

    // z-order range for the current triangle bbox;
    const minZ = Triangulator.zOrder(minTX, minTY, minX, minY, size);
    const maxZ = Triangulator.zOrder(maxTX, maxTY, minX, minY, size);

    // first look for points inside the triangle in increasing z-order
    let p = ear.nextZ;

    while (p && p.zOrder <= maxZ) {
      if (p !== ear.facePredecessor && p !== ear.faceSuccessor &&
        Triangulator.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
        Triangulator.area(p.facePredecessor, p, p.faceSuccessor) >= 0) return false;
      p = p.nextZ;
    }

    // then look for points in decreasing z-order
    p = ear.prevZ;

    while (p && p.zOrder >= minZ) {
      if (p !== ear.facePredecessor && p !== ear.faceSuccessor &&
        Triangulator.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
        Triangulator.area(p.facePredecessor, p, p.faceSuccessor) >= 0) return false;
      p = p.prevZ;
    }

    return true;
  }

  /** Go through all polygon nodes and cure small local self-intersections */
  private static cureLocalIntersections(start: any) {
    let p = start;
    do {
      const a = p.facePredecessor;
      const b = p.faceSuccessor.faceSuccessor;

      if (!Triangulator.equals(a, b) && Triangulator.intersects(a, p, p.faceSuccessor, b) &&
        Triangulator.locallyInside(a, b) && Triangulator.locallyInside(b, a)) {

        // remove two nodes involved
        Triangulator.join(p);
        Triangulator.join(p.faceSuccessor);

        p = start = b;
      }
      p = p.faceSuccessor;
    } while (p !== start);

    return p;
  }

  /** try splitting polygon into two and triangulate them independently */
  private static splitEarcut(start: any, minX?: number, minY?: number, size?: number) {
    // look for a valid diagonal that divides the polygon into two
    let a = start;
    do {
      let b = a.faceSuccessor.faceSuccessor;
      while (b !== a.facePredecessor) {
        if (a.i !== b.i && Triangulator.isValidDiagonal(a, b)) {
          // split the polygon in two by the diagonal
          let c: HalfEdge | undefined = Triangulator.splitPolygon(a, b);

          // filter colinear points around the cuts
          a = Triangulator.filterPoints(a, a.faceSuccessor);
          c = Triangulator.filterPoints(c, c.faceSuccessor);

          // run earcut on each half
          Triangulator.earcutLinked(a, minX, minY, size);
          Triangulator.earcutLinked(c, minX, minY, size);
          return;
        }
        b = b.faceSuccessor;
      }
      a = a.faceSuccessor;
    } while (a !== start);
  }

  /** link every hole into the outer loop, producing a single-ring polygon without holes */
  private static eliminateHoles(data: Point3d[], outerNode: HalfEdge | undefined, holeIndices: number[]) {
    const queue: HalfEdge[] = [];
    let i;
    let len;
    let start;
    let end;
    let list;

    for (i = 0, len = holeIndices.length; i < len; i++) {
      start = holeIndices[i];
      end = i < len - 1 ? holeIndices[i + 1] : data.length;
      list = Triangulator.createFaceLoop(data, start, end, false, false);
      if (list && list === list.faceSuccessor) list.steiner = true;
      queue.push(Triangulator.getLeftmost(list));
    }

    queue.sort(Triangulator.compareX);

    // process holes from left to right
    for (i = 0; i < queue.length; i++) {
      Triangulator.eliminateHole(queue[i], outerNode);
      outerNode = Triangulator.filterPoints(outerNode, (outerNode) ? outerNode.faceSuccessor : undefined);
    }

    return outerNode;
  }

  private static compareX(a: HalfEdge, b: HalfEdge) {
    return a.x - b.x;
  }

  /** find a bridge between vertices that connects hole with an outer ring and and link it */
  private static eliminateHole(hole: HalfEdge, outerNode?: HalfEdge) {
    outerNode = Triangulator.findHoleBridge(hole, outerNode);
    if (outerNode) {
      const b = Triangulator.splitPolygon(outerNode, hole);
      Triangulator.filterPoints(b, b.faceSuccessor);
    }
  }

  /**
   *  David Eberly's algorithm for finding a bridge between hole and outer polygon:
   *  https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
   */
  private static findHoleBridge(hole: HalfEdge, outerNode?: any) {
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

  /** interlink polygon nodes in z-order */
  private static indexCurve(start: any, minX?: number, minY?: number, size?: number) {
    let p = start;
    do {
      if (p.zOrder === undefined) p.zOrder = Triangulator.zOrder(p.x, p.y, minX, minY, size);
      p.prevZ = p.facePredecessor;
      p.nextZ = p.faceSuccessor;
      p = p.faceSuccessor;
    } while (p !== start);

    p.prevZ.nextZ = undefined;
    p.prevZ = undefined;

    Triangulator.sortLinked(p);
  }

  /**
   * Simon Tatham's linked list merge sort algorithm
   * http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
   */
  private static sortLinked(list: any) {
    let i;
    let p;
    let q;
    let e;
    let tail;
    let numMerges;
    let pSize;
    let qSize;
    let inSize = 1;

    do {
      p = list;
      list = undefined;
      tail = undefined;
      numMerges = 0;

      while (p) {
        numMerges++;
        q = p;
        pSize = 0;
        for (i = 0; i < inSize; i++) {
          pSize++;
          q = q.nextZ;
          if (!q) break;
        }
        qSize = inSize;

        while (pSize > 0 || (qSize > 0 && q)) {

          if (pSize !== 0 && (qSize === 0 || !q || p.zOrder <= q.zOrder)) {
            e = p;
            p = p.nextZ;
            pSize--;
          } else {
            e = q;
            q = q.nextZ;
            qSize--;
          }

          if (tail) tail.nextZ = e;
          else list = e;

          e.prevZ = tail;
          tail = e;
        }

        p = q;
      }

      tail.nextZ = undefined;
      inSize *= 2;

    } while (numMerges > 1);

    return list;
  }

  /**
   * z-order of a point given coords and size of the data bounding box
   */
  private static zOrder(x: number, y: number, minX: any, minY: any, size: any) {
    // coords are transformed into non-negative 15-bit integer range
    x = 32767 * (x - minX) / size;
    y = 32767 * (y - minY) / size;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
  }

  // find the leftmost node of a polygon ring
  private static getLeftmost(start: any) {
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
  private static isValidDiagonal(a: any, b: any) {
    return a.faceSuccessor.i !== b.i && a.facePredecessor.i !== b.i && !Triangulator.intersectsPolygon(a, b) &&
      Triangulator.locallyInside(a, b) && Triangulator.locallyInside(b, a) && Triangulator.middleInside(a, b);
  }

  /** signed area of a triangle */
  private static area(p: any, q: any, r: any) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  }

  /** check if two points are equal */
  private static equals(p1: any, p2: any) {
    return Geometry.isSameCoordinate(p1.x, p2.x) && Geometry.isSameCoordinate(p1.y, p2.y);
  }

  /** check if two segments intersect */
  private static intersects(p1: any, q1: any, p2: any, q2: any) {
    if ((Triangulator.equals(p1, q1) && Triangulator.equals(p2, q2)) ||
      (Triangulator.equals(p1, q2) && Triangulator.equals(p2, q1))) return true;
    return Triangulator.area(p1, q1, p2) > 0 !== Triangulator.area(p1, q1, q2) > 0 &&
      Triangulator.area(p2, q2, p1) > 0 !== Triangulator.area(p2, q2, q1) > 0;
  }

  /** check if a polygon diagonal intersects any polygon segments */
  private static intersectsPolygon(a: any, b: any) {
    let p = a;
    do {
      if (p.i !== a.i && p.faceSuccessor.i !== a.i && p.i !== b.i && p.faceSuccessor.i !== b.i &&
        Triangulator.intersects(p, p.faceSuccessor, a, b)) return true;
      p = p.faceSuccessor;
    } while (p !== a);

    return false;
  }

  /** check if a polygon diagonal is locally inside the polygon */
  private static locallyInside(a: any, b: any) {
    return Triangulator.area(a.facePredecessor, a, a.faceSuccessor) < 0 ?
      Triangulator.area(a, b, a.faceSuccessor) >= 0 && Triangulator.area(a, a.facePredecessor, b) >= 0 :
      Triangulator.area(a, b, a.facePredecessor) < 0 || Triangulator.area(a, a.faceSuccessor, b) < 0;
  }

  /** check if the middle point of a polygon diagonal is inside the polygon */
  private static middleInside(a: any, b: any) {
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
  private static splitPolygon(a: HalfEdge, b: HalfEdge): HalfEdge {
    const a2 = Triangulator._returnGraph.createEdgeXYZXYZ(a.x, a.y, a.z, a.i, b.x, b.y, b.z, b.i);
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
