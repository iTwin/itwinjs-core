/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */

import { Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
export type NodeFunction = (node: HalfEdge) => any;
export type NodeToNumberFunction = (node: HalfEdge) => number;
export type HalfEdgeToBooleanFunction = (node: HalfEdge) => boolean;
export type HalfEdgeAndMaskToBooleanFunction = (node: HalfEdge, mask: HalfEdgeMask) => boolean;
export type GraphNodeFunction = (graph: HalfEdgeGraph, node: HalfEdge) => boolean;
/**
 *
 * * A HalfEdge is "one side of an edge" in a structure of faces, edges and vertices.  From a node there are navigational links to:
 * ** "faceSuccessor" -- the next half edge in a loop around a face.
 * ** "facePredecessor" -- the previous half edge in a loop around a face.
 * ** "edgeMate"  -- the node's partner on the other side of the edge.
 * * The next, prev, and mate are the essential connectivity.  Additional node content is for application-specific
 *     uses.  The most useful ones are:
 * ** x,y -- coordinates in the xy plane
 * ** z -- z coordinate.  This is normally ignored during planar setup, but used for output.
 * ** buffer -- a integer value manipulated as individual bits.
 * * In properly connected planar graph, interior face loops are counterclockwise.  But that property (along with
 *      expected masking) is a result of extensive validation of inputs, and is not true in intermediate phases
 *      of graph manipulation.
 */
export class HalfEdge {
  // vertice index in coordinates array
  public i: number;
  // buffer of 4 bytes, used to mark nodes as part of a triangle (idx 0) or visited when flipping (idx 1)
  public maskBits: number;
  // vertex coordinates
  public x: number;
  public y: number;
  public z: number;

  private _id: any;   // immutable id useful for debuggging.
  public get id() { return this._id; }

  private _facePredecessor!: HalfEdge;
  private _faceSuccessor!: HalfEdge;
  private _edgeMate!: HalfEdge;
  /** previous half edge "around the face"
   */
  public get facePredecessor(): HalfEdge { return this._facePredecessor; }
  /** next half edge "around the face" */
  public get faceSuccessor(): HalfEdge { return this._faceSuccessor; }
  /** Half edge on the other side of this edge.
   */
  public get edgeMate(): HalfEdge { return this._edgeMate; }

  /**
   * * Create 2 half edges.
   * * The two edges are joined as edgeMate pair.
   * * The two edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * @returns Returns the reference to the first half edge created
   */
  public static createHalfEdgePair(heArray: HalfEdge[] | undefined): HalfEdge {
    const a = new HalfEdge();
    const b = new HalfEdge();
    if (heArray) {
      heArray.push(a);
      heArray.push(b);
    }

    HalfEdge.setFaceLinks(a, b);
    HalfEdge.setFaceLinks(b, a);
    HalfEdge.setEdgeMates(a, b);
    return a;
  }

  /**
   * * Create 2 half edges.
   * * The two edges are joined as edgeMate pair.
   * * The two edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * Properties x,y,z,i are inserted in each
   * @returns Returns the reference to the first half edge created
   */
  public static createHalfEdgePairWithCoordinates(
    xA: number = 0,
    yA: number = 0,
    zA: number = 0,
    iA: number = 0,
    xB: number = 0,
    yB: number = 0,
    zB: number = 0,
    iB: number = 0,
    heArray: HalfEdge[] | undefined): HalfEdge {
    const a = HalfEdge.createHalfEdgePair(heArray);
    const b = a._edgeMate;
    a.x = xA; a.y = yA; a.z = zA; a.i = iA;
    b.x = xB; b.y = yB; b.z = zB; b.i = iB;
    return a;
  }
  /**
   * * set heA <==> heB pointer relation through heA._faceSuccessor and heB._facePredecessor
   * * This changes heA._faceSuccessor and heB._facePredecessor, but not heA._facePredecessor and heB._faceSuccessor.
   * * this must always be done with another call to restablish the entire double-linked list.
   */
  private static setFaceLinks(heA: HalfEdge, heB: HalfEdge) {
    heA._faceSuccessor = heB;
    heB._facePredecessor = heA;
  }
  /**
   * * set heA <==> heB pointer relation edgeMate
   */
  private static setEdgeMates(heA: HalfEdge, heB: HalfEdge) {
    heA._edgeMate = heB;
    heB._edgeMate = heA;
  }

  /**
   * * Create a new vertex within the edge from base.
   * * Insert it "within" the base edge.
   * * This requires two new half edges.
   * * if the base is undefined, create a single-edge loop.
   * * This (unlike pinch) breaks the edgeMate pairing of the base edge.
   * * This preserves xyzi properties at all existing vertices.
   * @returns Returns the reference to the half edge created.
   */
  public static splitEdge(base: undefined | HalfEdge,
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0, heArray: HalfEdge[] | undefined): HalfEdge {
    const newA = new HalfEdge(xA, yA, zA, iA);
    const newB = new HalfEdge(xA, yA, zA, iA);
    if (heArray) {
      heArray.push(newA);
      heArray.push(newB);
    }

    if (base === undefined) {
      newA._faceSuccessor = newA._facePredecessor = newA;
      newB._faceSuccessor = newB._facePredecessor = newB;
      HalfEdge.setEdgeMates(newA, newB);
    } else {
      const nextA = base._faceSuccessor;
      const mateA = base._edgeMate;
      const vpredA = mateA._faceSuccessor;
      HalfEdge.setFaceLinks(newA, nextA);
      HalfEdge.setFaceLinks(base, newA);
      HalfEdge.setFaceLinks(mateA, newB);
      HalfEdge.setFaceLinks(newB, vpredA);
      HalfEdge.setEdgeMates(newA, mateA);
      HalfEdge.setEdgeMates(newB, base);
    }
    return newA;
  }
  // These members are specific to the z-sweep trapezoidal decomposition and earlobe triangulation.
  // previous and next nodes in z-order
  public prevZ!: HalfEdge;
  public nextZ!: HalfEdge;
  // indicates whether this is a steiner point
  public steiner: boolean;
  // z-order curve value
  public zOrder!: number;

  private static _totalNodesCreated = 0;
  public constructor(x: number = 0, y: number = 0, z: number = 0, i: number = 0) {
    this._id = HalfEdge._totalNodesCreated++;
    this.i = i;
    this.maskBits = 0x00000000;
    this.x = x;
    this.y = y;
    this.z = z;
    this.steiner = false;
    // Other variables are by default undefined
  }

  /**
   * @returns Return the next outbound half edge around this vertex in the CCW direction
   */
  get vertexSuccessor(): HalfEdge { return this.facePredecessor.edgeMate; }
  /**
   * @returns Return the next outbound half edge around this vertex in the CW direction
   */
  get vertexPredecessor(): HalfEdge { return this.edgeMate.faceSuccessor; }
  /**
   * Set mask bits on this HalfEdge
   * @param mask mask to apply
   */
  public setMask(mask: HalfEdgeMask) { this.maskBits |= mask; }
  /**
   * Get mask bits from this HalfEdge
   * @param mask mask to query
   */
  public getMask(mask: HalfEdgeMask): number { return (this.maskBits & mask); }

  /**
   * Clear mask bits from this HalfEdge
   * @param mask mask to clear
   */
  public clearMask(mask: HalfEdgeMask) { this.maskBits &= ~mask; }
  /**
   *
   * @param mask mask to apply to the half edges around this HalfEdge's vertex loop
   */
  public setMaskAroundVertex(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node = node.vertexSuccessor;
    } while (node !== this);
  }

  /**
   *
   * @param mask mask to apply to the half edges around this HalfEdge's face loop
   */
  public setMaskAroundFace(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node = node.faceSuccessor;
    } while (node !== this);
  }

  /**
   * @returns Returns the number of edges around this face.
   */
  public countEdgesAroundFace(): number {
    let count = 0;
    let node: HalfEdge = this;
    do {
      count++;
      node = node.faceSuccessor;
    } while (node !== this);
    return count;
  }

  /**
   * @returns Returns the number of edges around vertex.
   */
  public countEdgesAroundVertex(): number {
    let count = 0;
    let node: HalfEdge = this;
    do {
      count++;
      node = node.vertexSuccessor;
    } while (node !== this);
    return count;
  }

  /**
   * @returns Returns the number of nodes found with the given mask value around this vertex loop.
   */
  public countMaskAroundFace(mask: HalfEdgeMask, value: boolean = true): number {
    let count = 0;
    let node: HalfEdge = this;
    if (value) {
      do {
        if (node.isMaskSet(mask)) count++;
        node = node.faceSuccessor;
      } while (node !== this);
    } else {
      do {
        if (!node.isMaskSet(mask)) count++;
        node = node.faceSuccessor;
      } while (node !== this);
    }
    return count;
  }

  /**
   * @returns Returns the number of nodes found with the given mask value around this vertex loop.
   */
  public countMaskAroundVertex(mask: HalfEdgeMask, value: boolean = true): number {
    let count = 0;
    let node: HalfEdge = this;
    if (value) {
      do {
        if (node.isMaskSet(mask)) count++;
        node = node.vertexSuccessor;
      } while (node !== this);
    } else {
      do {
        if (!node.isMaskSet(mask)) count++;
        node = node.vertexSuccessor;
      } while (node !== this);
    }
    return count;
  }

  /**
   * @returns the mask value prior to the call to this method.
   * @param mask mask to apply
   */
  public testAndSetMask(mask: HalfEdgeMask): number {
    const oldMask = this.maskBits & mask;
    this.maskBits |= mask;
    return oldMask;
  }
  /**
   * Test if mask bits are set in the node's bitMask.
   * @return Return true (as a simple boolean, not a mask) if any bits of the mask parameter match bits of the node's bitMask
   */
  public isMaskSet(mask: HalfEdgeMask): boolean { return (this.maskBits & mask) !== 0; }

  /** (static!) method to test if a mask is set on a node.
   * This is used as filter in searches.
   * @returns true iff `node.isMaskSet (mask)`
   */
  public static filterIsMaskOn(node: HalfEdge, mask: HalfEdgeMask): boolean {
    return node.isMaskSet(mask);
  }
  /** (static!) method to test if a mask is set on a node.
   * This is used as filter in searches.
   * @returns true iff `!node.isMaskSet (mask)`
   */
  public static filterIsMaskOff(node: HalfEdge, mask: HalfEdgeMask): boolean {
    return !node.isMaskSet(mask);
  }

  /**
   * @param id0 id for first node
   * @param x0  x coordinate for first node
   * @param y0  y coordinate for first node
   * @param id1 id for second node
   * @param x1 x coordinate for second node
   * @param y1 y coordinate for second node
   */
  public static createEdgeXYXY(id0: any, x0: number, y0: number, id1: any, x1: number, y1: number): HalfEdge {
    const node0 = new HalfEdge(x0, y0);
    const node1 = new HalfEdge(x1, y1);
    node0._faceSuccessor = node0._facePredecessor = node0._edgeMate = node1;
    node1._faceSuccessor = node1._facePredecessor = node1._edgeMate = node0;
    node0._id = id0;
    node1._id = id1;
    return node0;
  }

  /** "pinch" ...
   *
   * * is the universal manipulator for manipulating a node's next and prev pointers
   * * swaps face precessors of nodeA and nodeB.
   * *  is its own inverse.
   * *  does nothing if either node does not have a predecessor (this is obviously a logic error in the caller algorithm)
   * *  if nodeA, nodeB are in different face loops, the loops join to one loop.
   * *  if nodeA, nodeB are in the same face loop, the loop splits into two loops.
   */
  public static pinch(nodeA: HalfEdge, nodeB: HalfEdge) {
    const predA = nodeA._facePredecessor;
    const predB = nodeB._facePredecessor;
    if (predA && predB) {
      nodeB._facePredecessor = predA;
      nodeA._facePredecessor = predB;
      predB._faceSuccessor = nodeA;
      predA._faceSuccessor = nodeB;
    }
  }
  /** Turn all pointers to undefined so garbage collector can reuse the object.
   *  This is to be called only by a Graph object that is being decomissioned.
   */
  public decomission() {
    (this._facePredecessor as any) = undefined;
    (this._faceSuccessor as any) = undefined;
    (this._edgeMate as any) = undefined;
    (this.nextZ as any) = undefined;
    (this.prevZ as any) = undefined;
  }

  /** @returns Return the node. This identity function is useful as the NodeFunction in collector methods. */
  public static nodeToSelf(node: HalfEdge): any { return node; }
  /** @returns Return the id of a node.  Useful for collector methods. */
  public static nodeToId(node: HalfEdge): any { return node.id; }
  /** @returns Return the id of a node.Useful for collector methods. */
  public static nodeToIdString(node: HalfEdge): any { return node.id.toString(); }

  /** @returns Return the [id, [x,y]] of a node.  Useful for collector methods. */
  public static nodeToIdMaskXY(node: HalfEdge): { id: any, mask: any, xy: number[] } {
    return { id: node.id, mask: HalfEdge.nodeToMaskString(node), xy: [node.x, node.y] };
  }

  /** @returns Return the [id, [x,y]] of a node.  Useful for collector methods. */
  public static nodeToIdXYString(node: HalfEdge): string {
    const s = node.id.toString() + " " +
      HalfEdge.nodeToMaskString(node) + " [" + node.x + "," + node.y + "]";
    return s;
  }

  /**  */
  public static nodeToMaskString(node: HalfEdge): string {
    let s = "";
    if (node.isMaskSet(HalfEdgeMask.BOUNDARY)) s += "B";
    if (node.isMaskSet(HalfEdgeMask.PRIMARY_EDGE)) s += "P";
    if (node.isMaskSet(HalfEdgeMask.EXTERIOR)) s += "X";
    return s;
  }
  /** @returns Return [x,y] with coordinates of node */
  public static nodeToXY(node: HalfEdge): number[] { return [node.x, node.y]; }
  /** @returns Return Vector2d to face successor, with only xy coordinates */
  public vectorToFaceSuccessorXY(result?: Vector2d): Vector2d {
    return Vector2d.create(this.faceSuccessor.x - this.x, this.faceSuccessor.y - this.y, result);
  }
  /** @returns Return Vector3d to face successor */
  public vectorToFaceSuccessor(result?: Vector3d): Vector3d {
    return Vector3d.create(
      this.faceSuccessor.x - this.x,
      this.faceSuccessor.y - this.y,
      this.faceSuccessor.z - this.z,
      result);
  }

  /** @returns Returns true if the node does NOT have Mask.EXTERIOR_MASK set. */
  public static testNodeMaskNotExterior(node: HalfEdge) { return !node.isMaskSet(HalfEdgeMask.EXTERIOR); }

  /** @return Return true if x and y coordinates of this and other are exactly equal */
  public isEqualXY(other: HalfEdge): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /** @return Return true if x and y coordinates of this and other are exactly equal */
  public distanceXY(other: HalfEdge): number {
    return Geometry.distanceXYXY(this.x, this.y, other.x, other.y);
  }

  /**
   *
   * * Evaluate f(node) at each node around a face loop.
   * * Collect the function values.
   * @returns Return the array of function values.
   */
  public collectAroundFace(f?: NodeFunction): any[] {
    const nodes = [];
    let node: HalfEdge = this;
    do {
      nodes.push(f ? f(node) : node);
      node = node.faceSuccessor;
    } while (node !== this);
    return nodes;
  }

  /**
   *
   * * Evaluate f(node) at each outbound node around this node's vertex loop.
   * * Collect the function values.
   * @returns Return the array of function values.
   */
  public collectAroundVertex(f?: NodeFunction): any[] {
    const nodes = [];
    let node: HalfEdge = this;
    do {
      nodes.push(f ? f(node) : node);
      node = node.vertexSuccessor;
    } while (node !== this);
    return nodes;
  }

  /**
   *
   * * Evaluate f(node) at each node around a face loop.
   * * Sum the function values
   * @returns Return the sum
   */
  public sumAroundFace(f: NodeToNumberFunction): number {
    let node: HalfEdge = this;
    let sum = 0;
    do {
      sum += f(node);
      node = node.faceSuccessor;
    } while (node !== this);
    return sum;
  }

  /**
   *
   * * Evaluate f(node) at each outbound node around this node's vertex loop.
   * * Sum the function values
   * @returns Return the sum
   */
  public sumAroundVertex(f: NodeToNumberFunction): number {
    let node: HalfEdge = this;
    let sum = 0;
    do {
      sum += f(node);
      node = node.vertexSuccessor;
    } while (node !== this);
    return sum;
  }
  /** For all the nodes in the face loop of the given node, clear out the mask given */
  public clearMaskAroundFace(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.clearMask(mask);
      node = node.faceSuccessor;
    } while (node !== this);
  }

  /** For all the nodes in the vertex loop of the given node, clear out the mask given */
  public clearMaskAroundVertex(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.clearMask(mask);
      node = node.vertexSuccessor;
    } while (node !== this);
  }
  /** Returns the signed sum of a loop of nodes.
   *
   * * A positive area is counterclockwise.
   * * A negative area is clockwise.
   */
  public signedFaceArea(): number {
    let sum = 0;
    // sum area of trapezoids.
    // * the formula in the loop gives twice the area (because it does nto average the y values).
    // * this is fixed up at the end by a single multiply by 0.5
    // * indidual trapezoid heights are measured from y at the start node to keep area values numericall smaller.
    const y0 = this.y;
    let dy0 = 0.0;
    let dy1 = 0.0;
    let x0 = this.x;
    let x1 = x0;
    let node1: HalfEdge = this;  // just to initialize -- reassigned in each loop pass.
    let node0: HalfEdge = this;
    do {
      node1 = node0.faceSuccessor;
      x1 = node1.x;
      dy1 = node1.y - y0;
      sum += (x0 - x1) * (dy0 + dy1);
      x0 = x1;
      dy0 = dy1;
      node0 = node1;
      node0 = node1;
    } while (node0 !== this);
    return 0.5 * sum;
  }

}
/**
 * A HalfEdgeGraph has:
 * * An array of (pointers to ) HalfEdge objects.
 */
export class HalfEdgeGraph {
  public allHalfEdges: HalfEdge[];
  private _numNodesCreated = 0;
  public constructor() {
    this.allHalfEdges = [];
  }
  /**
   * * Create 2 half edges forming 2 vertices, 1 edge, and 1 face
   * * The two edges are joined as edgeMate pair.
   * * The two edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * The two edges are added to the graph's HalfEdge set
   * @returns Return pointer to the first half edge created.
   */
  public createEdgeXYZXYZ(
    xA: number = 0,
    yA: number = 0,
    zA: number = 0,
    iA: number = 0,
    xB: number = 0,
    yB: number = 0,
    zB: number = 0,
    iB: number = 0): HalfEdge {
    const a = HalfEdge.createHalfEdgePairWithCoordinates(xA, yA, zA, iA, xB, yB, zB, iB, this.allHalfEdges);
    return a;
  }

  /**
   * * Insert a vertex in the edge begining at base.
   * * this creates two half edges.
   * * The base of the new edge is 'after' the (possibly undefined) start node in its face loop.
   * * The existing mate retains its base xyzi properties but is no longer the mate of base.
   * * The base and existing mate each become mates with a new half edge.
   * @returns Returns the reference to the half edge created.
   */
  public splitEdge(base: undefined | HalfEdge,
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0): HalfEdge {
    const he = HalfEdge.splitEdge(base, xA, yA, zA, iA, this.allHalfEdges);
    return he;
  }
  /** This is a destructor-like action that elminates all interconnection among the graph's nodes.
   * After this is called the graph is unusable.
   */
  public decommission() {
    for (const node of this.allHalfEdges) { node.decomission(); }
    this.allHalfEdges.length = 0;
    (this.allHalfEdges as any) = undefined;
  }
  /** create two nodes of a new edge.
   * @returns Return one of the two nodes, which the caller may consider as the start of the edge.
   */
  public addEdgeXY(x0: number, y0: number, x1: number, y1: number): HalfEdge {
    const baseNode = HalfEdge.createEdgeXYXY(this._numNodesCreated, x0, y0, this._numNodesCreated + 1, x1, y1);
    this._numNodesCreated += 2;
    this.allHalfEdges.push(baseNode);
    this.allHalfEdges.push(baseNode.faceSuccessor);
    return baseNode;

  }
  /** Clear selected bits in all nodes of the graph. */
  public clearMask(mask: HalfEdgeMask) {
    for (const node of this.allHalfEdges)
      node.maskBits &= ~mask;
  }
  /** Set selected bits in all nodes of the graph. */
  public setMask(mask: HalfEdgeMask) {
    for (const node of this.allHalfEdges)
      node.maskBits |= mask;
  }
  /** toggle selected bits in all nodes of the graph. */
  public reverseMask(mask: HalfEdgeMask) {
    for (const node of this.allHalfEdges) {
      node.maskBits ^= mask;
    }
  }
  /**
   * @returns Return the number of nodes that have a specified mask bit set.
   * @param mask mask to count
   */
  public countMask(mask: HalfEdgeMask): number {
    let n = 0;
    for (const node of this.allHalfEdges)
      if (node.isMaskSet(mask))
        n++;
    return n;
  }
  /** Return an array LineSegment3d.
   * * The array has one segment per edge
   * * The coordinates are taken from a node and its face successor.
   * * On each edge, the line segment start at the HalfEdge with lower id than its edgeMate.
   */
  public collectSegments(): LineSegment3d[] {
    const segments: LineSegment3d[] = [];
    for (const node of this.allHalfEdges) {
      if (node.id < node.edgeMate.id)
        segments.push(LineSegment3d.create(Point3d.create(node.x, node.y), Point3d.create(node.faceSuccessor.x, node.faceSuccessor.y)));
    }
    return segments;
  }

  /** Returns the number of vertex loops in a graph structure */
  public countVertexLoops(): number {
    this.clearMask(HalfEdgeMask.VISITED);
    let count = 0;
    this.announceVertexLoops((_graph: HalfEdgeGraph, _seed: HalfEdge) => { count++; return true; });
    return count;
  }

  /** @returns Returns the number of face loops */
  public countFaceLoops(): number {
    this.clearMask(HalfEdgeMask.VISITED);
    let count = 0;
    this.announceFaceLoops((_graph: HalfEdgeGraph, _seed: HalfEdge) => { count++; return true; });
    return count;
  }
  /**
   * @returns Returns the number of face loops satisfying a filter function with mask argument.
   *
   */
  public countFaceLoopsWithMaskFilter(filter: HalfEdgeAndMaskToBooleanFunction, mask: HalfEdgeMask): number {
    this.clearMask(HalfEdgeMask.VISITED);
    let count = 0;
    this.announceFaceLoops((_graph: HalfEdgeGraph, seed: HalfEdge) => {
      if (filter(seed, mask))
        count++;
      return true;
    });
    return count;
  }

  /** @returns Returns an array of nodes, where each node represents a starting point of a face loop.
   */
  public collectFaceLoops(): HalfEdge[] {
    const returnArray: HalfEdge[] = [];
    this.announceFaceLoops(
      (_graph: HalfEdgeGraph, node: HalfEdge) => { returnArray.push(node); return true; });
    return returnArray;
  }

  /** @returns Returns an array of nodes, where each node represents a starting point of a vertex loop.
   */
  public collectVertexLoops(): HalfEdge[] {
    this.clearMask(HalfEdgeMask.VISITED);
    const returnArray: HalfEdge[] = [];

    for (const node of this.allHalfEdges) {
      if (node.getMask(HalfEdgeMask.VISITED))
        continue;
      returnArray.push(node);
      node.setMaskAroundVertex(HalfEdgeMask.VISITED);
    }
    return returnArray;
  }

  /**
   * * Visit each facet of the graph once.
   * * Call the announceFace function
   * * continue search if announceFace(graph, node) returns true
   * * terminate search if announceface (graph, node) returns false
   * @param  announceFace function to apply at one node of each face.
   */
  public announceFaceLoops(announceFace: GraphNodeFunction) {
    this.clearMask(HalfEdgeMask.VISITED);
    for (const node of this.allHalfEdges) {
      if (node.getMask(HalfEdgeMask.VISITED))
        continue;
      node.setMaskAroundFace(HalfEdgeMask.VISITED);
      if (!announceFace(this, node))
        break;
    }
  }

  /**
   * * Visit each vertex loop of the graph once.
   * * Call the announceVertex function
   * * continue search if announceFace(graph, node) returns true
   * * terminate search if announceface (graph, node) returns false
   * @param  annonceFace function to apply at one node of each face.
   */
  public announceVertexLoops(announceVertex: GraphNodeFunction) {
    this.clearMask(HalfEdgeMask.VISITED);
    for (const node of this.allHalfEdges) {
      if (node.getMask(HalfEdgeMask.VISITED))
        continue;
      node.setMaskAroundVertex(HalfEdgeMask.VISITED);
      if (!announceVertex(this, node))
        break;
    }
  }
  /** @returns Return the number of nodes in the graph */
  public countNodes(): number { return this.allHalfEdges.length; }
}

export const enum HalfEdgeMask {
  EXTERIOR = 0x00000001,
  BOUNDARY = 0x00000002,
  CONSTU_MASK = 0x00000004,
  CONSTV_MASK = 0x00000008,
  USEAM_MASK = 0x00000010,
  VSEAM_MASK = 0x00000020,
  BOUNDARY_VERTEX_MASK = 0x00000040,
  PRIMARY_VERTEX_MASK = 0x00000080,
  DIRECTED_EDGE_MASK = 0x00000100,
  PRIMARY_EDGE = 0x00000200,
  HULL_MASK = 0x00000400,
  SECTION_EDGE_MASK = 0x00000800,
  POLAR_LOOP_MASK = 0x00001000,

  VISITED = 0x00002000,
  TRIANGULATED_NODE_MASK = 0x00004000,

  NULL_MASK = 0x00000000,
  ALL_MASK = 0xFFFFFFFF,
}
