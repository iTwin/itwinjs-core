/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { SmallSystem } from "../numerics/Polynomials";
import { MaskManager } from "./MaskManager";
// import { GraphChecker } from "../test/topology/Graph.test";
/* eslint-disable @typescript-eslint/no-this-alias */
// cspell:word CONSTU
// cspell:word CONSTV
// cspell:word USEAM
// cspell:word VSEAM
/**
 * * Each node of the graph has a mask member.
 * * The mask member is a number which is used as set of single bit boolean values.
 * * Particular meanings of the various bits are HIGHLY application dependent.
 *   * The EXTERIOR mask bit is widely used to mark nodes that are "outside" the active areas
 *   * The PRIMARY_EDGE bit is widely used to indicate linework created directly from input data, hence protected from triangle edge flipping.
 *   * The BOUNDARY bit is widely used to indicate that crossing this edge is a transition from outside to inside.
 *   * VISITED is used locally in many searches.
 *      * Never use VISITED unless the search logic is highly self contained.
 * @internal
 */
export enum HalfEdgeMask {
  /**  Mask commonly set consistently around exterior faces.
   * * A boundary edge with interior to one side, exterior to the other will have EXTERIOR only on the outside.
   * * An an edge inserted "within a purely exterior face" can have EXTERIOR on both sides.
   * * An interior edge (such as added during triangulation) will have no EXTERIOR bits.
   */
  EXTERIOR = 0x00000001,
  /** Mask commonly set (on both sides) of original geometry edges that are transition from outside from to inside.
   * * At the moment of creating an edge from primary user boundary loop coordinates, the fact that an edge is BOUNDARY is often clear even though
   *  there is uncertainty about which side should be EXTERIOR.
   */
  BOUNDARY_EDGE = 0x00000002,
  // REMARK: Various mask names are COMMENTED here for reference to native legacy code.
  // CONSTU_MASK = 0x00000004,
  // CONSTV_MASK = 0x00000008,
  // USEAM_MASK = 0x00000010,
  // VSEAM_MASK = 0x00000020,
  // BOUNDARY_VERTEX_MASK = 0x00000040,
  // PRIMARY_VERTEX_MASK = 0x00000080,
  // DIRECTED_EDGE_MASK = 0x00000100,
  /** Mask commonly set (on both sides) of original geometry edges, but NOT indicating that the edge is certainly a boundary between outside and inside.
   * * For instance, if geometry is provided as stray sticks (not loops), it can be marked PRIMARY_EDGE but neither BOUNDARY_EDGE nor EXTERIOR_EDGE
   */
  PRIMARY_EDGE = 0x00000004,

  /** Mask used for low level searches to identify previously-visited nodes */
  VISITED = 0x0000010,

  /** Mask applied to triangles by earcut triangulator */
  TRIANGULATED_FACE = 0x00000100,
  /** mask applied in a face with 2 edges. */
  NULL_FACE = 0x00000200,

  /** no mask bits */
  NULL_MASK = 0x00000000,
  /** The "upper 12 " bits of 32 bit integer. */
  ALL_GRAB_DROP_MASKS = 0xffF00000,  // 12 masks reserved for grab/drop.
  /** all mask bits */
  ALL_MASK = 0xFFFFFFFF,
  // informal convention on preassigned mask bit numbers:
  // byte0 (EXTERIOR, BOUNDARY_EDGE, PRIMARY_EDGE) -- edge properties
  // byte1 (VISITED, VISIT_A, WORK_MASK0, WORK_MASK1) -- temp masks for algorithms.
  // byte2 (TRIANGULATED_FACE, NULL_FACE) -- face properties.

}

/** function signature for function of one node with no return type restrictions
 * @internal
 */
export type NodeFunction = (node: HalfEdge) => any;
/** function signature for function of one node, returning a number
 * @internal
 */
export type NodeToNumberFunction = (node: HalfEdge) => number;
/** function signature for function of one node, returning a boolean
 * @internal
 */
export type HalfEdgeToBooleanFunction = (node: HalfEdge) => boolean;
/** function signature for function of a node and a mask, returning a number
 * @internal
 */
export type HalfEdgeAndMaskToBooleanFunction = (node: HalfEdge, mask: HalfEdgeMask) => boolean;
/** function signature for function of a graph and a node, returning a boolean
 * @internal
 */
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
 * @internal
 */
export class HalfEdge {
  /** Vertex index in some parent object's numbering. */
  public i: number;
  /** bitmask bits, used to mark nodes as part of a triangle(idx 0) or visited when flipping(idx 1) */
  public maskBits: number;
  /** Vertex x coordinate */
  public x: number;
  /** Vertex y coordinate */
  public y: number;
  /** Vertex z coordinate */
  public z: number;
  /** angle used for sort-around-vertex */
  public sortAngle?: number;  // used in sorting around vertex.
  /** numeric value for application-specific tagging (e.g. sorting) */
  public sortData?: number;
  /** application-specific data for the edge identifier.
   * * edge split operations are expected to copy this to new sub-edges.
   */
  public edgeTag?: any;
  private _id: any;   // immutable id useful for debugging.
  /** id assigned sequentially during construction --- useful for debugging. */
  public get id() { return this._id; }
  private _facePredecessor: HalfEdge;
  private _faceSuccessor: HalfEdge;
  private _edgeMate: HalfEdge;
  /** previous half edge "around the face"
   */
  public get facePredecessor(): HalfEdge { return this._facePredecessor; }
  /** next half edge "around the face" */
  public get faceSuccessor(): HalfEdge { return this._faceSuccessor; }
  /** Half edge on the other side of this edge.
   */
  public get edgeMate(): HalfEdge { return this._edgeMate; }
  /** Take numStep face steps and return y coordinate
   * * positive steps are through faceSuccessor
   * * negative steps are through facePredecessor
   */
  public faceStepY(numStep: number): number {
    let node: HalfEdge = this;
    if (numStep > 0)
      for (let i = 0; i < numStep; i++) node = node.faceSuccessor;
    else if (numStep < 0)
      for (let i = 0; i > numStep; i--) node = node.facePredecessor;
    return node.y;
  }
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
   * * this must always be done with another call to reestablish the entire double-linked list.
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
   * * This preserves xyz and i properties at all existing vertices.
   * * on each side, if edgeTag is present it is copied to the new edge.
   * @returns Returns the reference to the half edge created.
   */
  public static splitEdge(baseA: undefined | HalfEdge,
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0, heArray: HalfEdge[] | undefined): HalfEdge {
    const newA = new HalfEdge(xA, yA, zA, iA);
    const newB = new HalfEdge(xA, yA, zA, iA);
    if (heArray) {
      heArray.push(newA);
      heArray.push(newB);
    }

    if (baseA === undefined) {
      newA._faceSuccessor = newA._facePredecessor = newA;
      newB._faceSuccessor = newB._facePredecessor = newB;
      HalfEdge.setEdgeMates(newA, newB);
    } else {
      const nextA = baseA._faceSuccessor;
      const mateA = baseA._edgeMate;
      const vPredA = mateA._faceSuccessor;
      HalfEdge.setFaceLinks(newA, nextA);
      HalfEdge.setFaceLinks(baseA, newA);
      HalfEdge.setFaceLinks(mateA, newB);
      HalfEdge.setFaceLinks(newB, vPredA);
      HalfEdge.setEdgeMates(newA, mateA);
      HalfEdge.setEdgeMates(newB, baseA);
      this.transferEdgeProperties(baseA, newA);
      this.transferEdgeProperties(mateA, newB);
    }
    return newA;
  }
  private static _edgePropertyMasks: HalfEdgeMask[] = [HalfEdgeMask.BOUNDARY_EDGE, HalfEdgeMask.EXTERIOR, HalfEdgeMask.PRIMARY_EDGE, HalfEdgeMask.NULL_FACE];
  /**
   * Copy "edge based" content of fromNode to toNode
   * * edgeTag
   * * masks in _edgePropertyMasks: EXTERIOR, BOUNDARY_EDGE, NULL_FACE, PRIMARY_EDGE
   * @param fromNode
   * @param toNode
   */
  public static transferEdgeProperties(fromNode: HalfEdge, toNode: HalfEdge) {
    toNode.edgeTag = fromNode.edgeTag;
    for (const mask of this._edgePropertyMasks) {
      if (fromNode.getMask(mask))
        toNode.setMask(mask);
      else
        toNode.clearMask(mask);
    }
  }
  private static _totalNodesCreated = 0;
  public constructor(x: number = 0, y: number = 0, z: number = 0, i: number = 0) {
    this._id = HalfEdge._totalNodesCreated++;
    this.i = i;
    this.maskBits = 0x00000000;
    this.x = x;
    this.y = y;
    this.z = z;
    // Explicit init to undefined is important for performance here
    this.sortAngle = undefined;
    this.sortData = undefined;
    this.edgeTag = undefined;
    // Always created in pairs, init here to make TS compiler and JS runtime happy
    this._facePredecessor = this;
    this._faceSuccessor = this;
    this._edgeMate = this;
  }

  /**
   * Return the next outbound half edge around this vertex in the CCW direction
   */
  public get vertexSuccessor(): HalfEdge { return this.facePredecessor.edgeMate; }
  /**
   * Return the next outbound half edge around this vertex in the CW direction
   */
  public get vertexPredecessor(): HalfEdge { return this.edgeMate.faceSuccessor; }
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
   * Set a mask at all nodes around a vertex.
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
   * Set x,y,z at all nodes around a vertex.
   * @param mask mask to apply to the half edges around this HalfEdge's vertex loop
   */
  public setXYZAroundVertex(x: number, y: number, z: number) {
    let node: HalfEdge = this;
    do {
      node.x = x; node.y = y; node.z = z;
      node = node.vertexSuccessor;
    } while (node !== this);
  }
  /**
   * Apply a mask to all edges around a face.
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
   * Apply a mask to both sides of an edge.
   * @param mask mask to apply to this edge and its `edgeMate`
   */
  public setMaskAroundEdge(mask: HalfEdgeMask) {
    this.setMask(mask);
    this.edgeMate.setMask(mask);
  }

  /**
   * Apply a mask to both sides of an edge.
   * @param mask mask to apply to this edge and its `edgeMate`
   */
  public clearMaskAroundEdge(mask: HalfEdgeMask) {
    this.clearMask(mask);
    this.edgeMate.clearMask(mask);
  }

  /** Returns the number of edges around this face. */
  public countEdgesAroundFace(): number {
    let count = 0;
    let node: HalfEdge = this;
    do {
      count++;
      node = node.faceSuccessor;
    } while (node !== this);
    return count;
  }

  /** Return true if other is in the vertex loop around this. */
  public findAroundVertex(other: HalfEdge): boolean {
    let node: HalfEdge = this;
    do {
      if (node === other)
        return true;
      node = node.vertexSuccessor;
    } while (node !== this);
    return false;
  }

  /** Return true if other is in the face loop around this. */
  public findAroundFace(other: HalfEdge): boolean {
    let node: HalfEdge = this;
    do {
      if (node === other)
        return true;
      node = node.faceSuccessor;
    } while (node !== this);
    return false;
  }

  /**
   * @return whether the mask is set (or unset) on all nodes of the face loop
   */
  public isMaskedAroundFace(mask: HalfEdgeMask, value: boolean = true): boolean {
    let node: HalfEdge = this;
    if (value) {
      do {
        if (!node.isMaskSet(mask))
          return false;
        node = node.faceSuccessor;
      } while (node !== this);
    } else {
      do {
        if (node.isMaskSet(mask))
          return false;
        node = node.faceSuccessor;
      } while (node !== this);
    }
    return true;
  }

  /**
   * Apply a edgeTag and mask to all edges around a face.
   * optionally apply it to all edge mates.
   * @param edgeTag tag to apply
   * @param bothSides If true, also apply the tag to the mates around the face.
   */
  public setMaskAndEdgeTagAroundFace(mask: HalfEdgeMask, tag: any, applyToMate: boolean = false) {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node.edgeTag = tag;
      if (applyToMate) {
        const mate = node.edgeMate;
        mate.edgeTag = tag;
        mate.setMask(mask);
      }
      node = node.faceSuccessor;
    } while (node !== this);
  }

  /** Returns the number of edges around vertex. */
  public countEdgesAroundVertex(): number {
    let count = 0;
    let node: HalfEdge = this;
    do {
      count++;
      node = node.vertexSuccessor;
    } while (node !== this);
    return count;
  }

  /** Returns the number of nodes found with the given mask value around this vertex loop. */
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

  /** Returns the number of nodes found with the given mask value around this vertex loop.   */
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

  /** Set a mask, and return prior value.
   * @param mask mask to apply
   */
  public testAndSetMask(mask: HalfEdgeMask): number {
    const oldMask = this.maskBits & mask;
    this.maskBits |= mask;
    return oldMask;
  }
  /**
   * Set (copy) the this.x, this.y, this.z from node.x, node.y, node.z
   * @param node node containing xyz
   */
  public setXYZFrom(node: HalfEdge) {
    this.x = node.x;
    this.y = node.y;
    this.z = node.z;
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
   * Create an edge with initial id,x,y at each end.
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
   * * swaps face predecessors of nodeA and nodeB.
   * *  is its own inverse.
   * *  if nodeA, nodeB are in different face loops, the loops join to one loop.
   * *  if nodeA, nodeB are in the same face loop, the loop splits into two loops.
   */
  public static pinch(nodeA: HalfEdge, nodeB: HalfEdge) {
    if (nodeA !== nodeB) {
      const predA = nodeA._facePredecessor;
      const predB = nodeB._facePredecessor;
      nodeB._facePredecessor = predA;
      nodeA._facePredecessor = predB;
      predB._faceSuccessor = nodeA;
      predA._faceSuccessor = nodeB;
    }
  }

  /**
   * Pinch this half edge out of its base vertex loop.
   * * if this  the half edge (possibly undefined)
   */
  public yankFromVertexLoop(): HalfEdge | undefined {
    const other = this.edgeMate.faceSuccessor;
    if (other === this)
      return undefined;
    HalfEdge.pinch(this, other);
    return other;
  }

  /** Turn all pointers to undefined so garbage collector can reuse the object.
   *  This is to be called only by a Graph object that is being decommissioned.
   */
  public decommission() {
    (this._facePredecessor as any) = undefined;
    (this._faceSuccessor as any) = undefined;
    (this._edgeMate as any) = undefined;
  }

  /** Return the node. This identity function is useful as the NodeFunction in collector methods. */
  public static nodeToSelf(node: HalfEdge): any { return node; }
  /** Return the id of a node.  Useful for collector methods. */
  public static nodeToId(node: HalfEdge): any { return node.id; }
  /** Return the id of a node.Useful for collector methods. */
  public static nodeToIdString(node: HalfEdge): any { return node.id.toString(); }

  /** Return the [id, [x,y]] of a node.  Useful for collector methods. */
  public static nodeToIdMaskXY(node: HalfEdge): { id: any, mask: any, xy: number[] } {
    return { id: node.id, mask: HalfEdge.nodeToMaskString(node), xy: [node.x, node.y] };
  }
  /** Return the [id, [x,y]] of a node.  Useful for collector methods. */
  public static nodeToIdXYString(node: HalfEdge): string {
    const s = `${node.id.toString()}+${HalfEdge.nodeToMaskString(node)}[${node.x},${node.y}]`;
    return s;
  }

  /** Create a string representation of the mask
   * * Null mask is empty string.
   * * Appended characters B,P,X for Boundary, Primary, Exterior mask bits.
   */
  public static nodeToMaskString(node: HalfEdge): string {
    let s = "";
    if (node.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE)) s += "B";
    if (node.isMaskSet(HalfEdgeMask.PRIMARY_EDGE)) s += "P";
    if (node.isMaskSet(HalfEdgeMask.EXTERIOR)) s += "X";
    if (node.isMaskSet(HalfEdgeMask.NULL_FACE)) s += "N";
    return s;
  }
  /** Return [x,y] with coordinates of node */
  public static nodeToXY(node: HalfEdge): number[] { return [node.x, node.y]; }
  /** Return Vector2d to face successor, with only xy coordinates */
  public vectorToFaceSuccessorXY(result?: Vector2d): Vector2d {
    return Vector2d.create(this.faceSuccessor.x - this.x, this.faceSuccessor.y - this.y, result);
  }
  /** Return Vector3d to face successor */
  public vectorToFaceSuccessor(result?: Vector3d): Vector3d {
    return Vector3d.create(
      this.faceSuccessor.x - this.x,
      this.faceSuccessor.y - this.y,
      this.faceSuccessor.z - this.z,
      result);
  }
  /** test if spaceNode is in the sector at sectorNode */
  public static isNodeVisibleInSector(spaceNode: HalfEdge, sectorNode: HalfEdge): boolean {
    // remark: fussy details ported from native code.
    // The obscure cases seemed "unlikely" at first.  But preexisting unit tests for triangulation pinged just about everything.
    // So it really matters to do the "0" cases this way.
    //  (As usual, hard coded zero is suspect, but it seems to work nicely in the discrete decisions.)
    if (sectorNode.vertexSuccessor === sectorNode)
      return true;
    const successor = sectorNode.faceSuccessor;
    const predecessor = sectorNode.facePredecessor;
    const successorCross = this.crossProductXYToTargets(sectorNode, successor, spaceNode);
    const predecessorCross = this.crossProductXYToTargets(predecessor, sectorNode, spaceNode);
    // simplest case:  two positives
    if (successorCross > 0.0 && predecessorCross > 0.0)
      return true;

    const sectorCross = this.crossProductXYToTargets(predecessor, sectorNode, successor);

    if (predecessorCross <= 0.0 && successorCross <= 0.0) {
      if (predecessorCross === 0.0 && successorCross === 0.0 && sectorCross === 0.0) {
        /* Everything is on a line.*/
        /* If the sector is a degenerate face, nodeP can only be
                in if it is the other node in the degenerate face.
        */
        if (predecessor === successor && sectorNode.vertexSuccessor !== sectorNode)
          return spaceNode === successor;
        /* Sector is 360 degrees.  Call it in only if vector from predP
            to sectorP points forward to nodeP.
        */
        return HalfEdge.dotProductNodeToNodeVectorsXY(predecessor, sectorNode, sectorNode, spaceNode) > 0.0;

      } else {
        return false;
      }
    } else {
      if (sectorCross === 0.0 && predecessorCross !== 0.0 && successorCross !== 0.0) {
        // The incoming and outgoing edges at the sector are identical direction.
        // We have to decide if this node is  inside the degenerate face (i.e. a geometrically empty sector)
        // or outside (i.e. a nearly complete sector).
        // In the inside case, the face is just two nodes.
        // Exact equality for zero is ok because cross product should be using identical
        // coordinates in subtracted terms.  (All furrow eyebrows in unison ....)
        return predecessor !== successor;
      }
      return sectorCross < 0.0;
    }

  }

  /** Returns Return cross product (2d) of vectors from baseA to targetA and baseB to targetB */
  public static crossProductXYToTargets(base: HalfEdge, targetA: HalfEdge, targetB: HalfEdge): number {
    return Geometry.crossProductXYXY(
      targetA.x - base.x, targetA.y - base.y,
      targetB.x - base.x, targetB.y - base.y);
  }

  /** Returns Return dot product (2d) of vectors along two edges. */
  public static dotProductNodeToNodeVectorsXY(baseA: HalfEdge, targetA: HalfEdge, baseB: HalfEdge, targetB: HalfEdge): number {
    return Geometry.dotProductXYXY(
      targetA.x - baseA.x, targetA.y - baseA.y,
      targetB.x - baseB.x, targetB.y - baseB.y);
  }

  /** Return cross product (2d) of vectors from nodeA to nodeB and nodeB to nodeC
   */
  public static crossProductXYAlongChain(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge): number {
    return Geometry.crossProductXYXY(
      nodeB.x - nodeA.x, nodeB.y - nodeA.y,
      nodeC.x - nodeB.x, nodeC.y - nodeB.y);
  }

  /**
   * @return whether the sector represented by the 2D vectors from nodeA to nodeB and nodeB to nodeC is convex.
   */
  public static isSectorConvex(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge): boolean {
    const cross = HalfEdge.crossProductXYAlongChain(nodeA, nodeB, nodeC);
    if (cross > 0.0)
      return true;
    if (cross < 0.0)
      return false;
    return HalfEdge.dotProductNodeToNodeVectorsXY(nodeA, nodeB, nodeB, nodeC) > 0.0;
  }

  /**
   * @return whether the sector of the face is convex.
   */
  // eslint-disable-next-line @itwin/prefer-get
  public isSectorConvex(): boolean {
    return HalfEdge.isSectorConvex(this.facePredecessor, this, this.faceSuccessor);
  }

  /**
   * @return whether the face is convex.
   */
   // eslint-disable-next-line @itwin/prefer-get
  public isFaceConvex(): boolean {
    let node: HalfEdge = this;
    do {
      if (!node.isSectorConvex())
        return false;
      node = node.faceSuccessor;
    } while (node !== this);
    return true;
  }

  /**
   * Isolate the edge from the graph by yanking each end from its vertex loop.
   */
  public isolateEdge() {
    const mate = this.edgeMate;
    this.yankFromVertexLoop();
    mate.yankFromVertexLoop();
  }

  /**
   * @return whether this edge is isolated from the rest of the graph.
   */
  public get isIsolatedEdge() {
    return this === this.vertexSuccessor && this.edgeMate === this.edgeMate.vertexSuccessor;
  }

  /** Return true if `this` is lexically below `other`, comparing y first then x. */
  public belowYX(other: HalfEdge): boolean {
    // Check y's
    // if (!Geometry.isSameCoordinate(a.y, b.y))

    if (this.y < other.y)
      return true;
    if (this.y > other.y)
      return false;
    // same y.
    // Check x's
    if (this.x < other.x)
      return true;
    return false;
  }
  /** Returns Returns true if the node does NOT have Mask.EXTERIOR_MASK set. */
  public static testNodeMaskNotExterior(node: HalfEdge) { return !node.isMaskSet(HalfEdgeMask.EXTERIOR); }

  /** Returns Returns true if the node does NOT have Mask.EXTERIOR_MASK set. */
  public static testMateMaskExterior(node: HalfEdge) { return node.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR); }

  /** Returns Returns true if the face has positive area in xy parts. */
  public static testFacePositiveAreaXY(node: HalfEdge) {
    return node.countEdgesAroundFace() > 2 && node.signedFaceArea() > 0.0;
  }

  /** Return true if x and y coordinates of this and other are exactly equal */
  public isEqualXY(other: XAndY): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /** Return true if x and y coordinates of this and other are exactly equal */
  public distanceXY(other: HalfEdge): number {
    return Geometry.distanceXYXY(this.x, this.y, other.x, other.y);
  }

  /** Return true if x and y coordinates of this and other are exactly equal */
  public distanceXYZ(other: HalfEdge): number {
    return Geometry.distanceXYZXYZ(this.x, this.y, this.z, other.x, other.y, other.z);
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
  /** Returns the signed sum of xy areas of triangles from first node to edges.
   *
   * * A positive area is counterclockwise.
   * * A negative area is clockwise.
   */
  public signedFaceArea(): number {
    let sum = 0;
    // sum area of trapezoids.
    // * the formula in the loop gives twice the area (because it does nto average the y values).
    // * this is fixed up at the end by a single multiply by 0.5
    // * individual trapezoid heights are measured from y at the start node to keep area values numerical smaller.
    const y0 = this.y;
    let dy0 = 0.0;
    let dy1 = 0.0;
    let x0 = this.x;
    let x1;
    let node1;
    let node0: HalfEdge = this;
    do {
      node1 = node0.faceSuccessor;
      x1 = node1.x;
      dy1 = node1.y - y0;
      sum += (x0 - x1) * (dy0 + dy1);
      x0 = x1;
      dy0 = dy1;
      node0 = node1;
    } while (node0 !== this);
    return 0.5 * sum;
  }
  /**
   * interpolate xy coordinates between this node and its face successor.
   * @param fraction fractional position along this edge.
   * @param result xy coordinates
   */
  public fractionToPoint2d(fraction: number, result?: Point2d): Point2d {
    const node1 = this.faceSuccessor;
    return Point2d.create(
      this.x + (node1.x - this.x) * fraction,
      this.y + (node1.y - this.y) * fraction,
      result);
  }
  /**
   * interpolate xy coordinates between this node and its face successor.
   * @param fraction fractional position along this edge.
   * @param result xy coordinates
   */
  public fractionToPoint3d(fraction: number, result?: Point3d): Point3d {
    const node1 = this.faceSuccessor;
    return Point3d.create(
      this.x + (node1.x - this.x) * fraction,
      this.y + (node1.y - this.y) * fraction,
      this.z + (node1.z - this.z) * fraction,
      result);
  }
  /**
   * * interpolate xy coordinates at fractionAlong between this node and its face successor.
   * * shift to left by fractionPerpendicular
   * @param fraction fractional position along this edge.
   * @param result xy coordinates
   */
  public fractionAlongAndPerpendicularToPoint2d(fractionAlong: number, fractionPerpendicular: number, result?: Point2d): Point2d {
    const node1 = this.faceSuccessor;
    const dx = node1.x - this.x;
    const dy = node1.y - this.y;
    return Point2d.create(
      this.x + dx * fractionAlong - dy * fractionPerpendicular,
      this.y + dy * fractionAlong + dx * fractionPerpendicular,
      result);
  }

  /**
   * return the 3d coordinates at this half edge base
   */
  public getPoint3d(result?: Point3d): Point3d {
    return Point3d.create(this.x, this.y, this.z, result);
  }
  /**
   * return the 2d coordinates at this half edge base
   */
  public getPoint2d(result?: Point2d): Point2d {
    return Point2d.create(this.x, this.y, result);
  }
  /**
   * return a 3d vector from start to end of this half edge.
   */
  public getVector3dAlongEdge(result?: Vector3d): Vector3d {
    const nodeB = this.faceSuccessor;
    return Vector3d.create(nodeB.x - this.x, nodeB.y - this.y, nodeB.z - this.z, result);
  }

  /**
   * return a 2d vector from start to end of this half edge
   */
  public getVector2dAlongEdge(result?: Vector2d): Vector2d {
    const nodeB = this.faceSuccessor;
    return Vector2d.create(nodeB.x - this.x, nodeB.y - this.y, result);
  }
  /**
   * Return the interpolated x coordinate between this node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToX(fraction: number): number {
    const node1 = this.faceSuccessor;
    return this.x + (node1.x - this.x) * fraction;
  }
  /**
   * Return the interpolated y coordinate between this node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToY(fraction: number): number {
    const node1 = this.faceSuccessor;
    return this.y + (node1.y - this.y) * fraction;
  }

  /**
   * Return the interpolated z coordinate between this node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToZ(fraction: number): number {
    const node1 = this.faceSuccessor;
    return this.z + (node1.z - this.z) * fraction;
  }
  /**
   * * Compute fractional coordinates of the intersection of edges from given base nodes
   * * If parallel or colinear, return undefined.
   * * If (possibly extended) lines intersect, return the fractions of intersection as x,y in the result.
   * @param nodeA0 Base node of edge A
   * @param nodeB0 Base node of edge B
   * @param result optional preallocated result
   */
  public static transverseIntersectionFractions(nodeA0: HalfEdge, nodeB0: HalfEdge, result?: Vector2d): Vector2d | undefined {
    const nodeA1 = nodeA0.faceSuccessor;
    const nodeB1 = nodeB0.faceSuccessor;
    if (!result)
      result = Vector2d.create();
    if (SmallSystem.linearSystem2d(
      nodeA1.x - nodeA0.x, nodeB0.x - nodeB1.x,
      nodeA1.y - nodeA0.y, nodeB0.y - nodeB1.y,
      nodeB0.x - nodeA0.x, nodeB0.y - nodeA0.y,
      result))
      return result;
    return undefined;
  }
  /**
   * * Compute fractional coordinates of the intersection of a horizontal line with an edge.
   * * If the edge is horizontal with (approximate) identical y, return the node.
   * * If the edge is horizontal with different y, return undefined.
   * * If the edge is not horizontal, return the fractional position (possibly outside 0..1) of the intersection.
   * @param nodeA Base node of edge
   * @param result optional preallocated result
   */
  public static horizontalScanFraction(node0: HalfEdge, y: number): number | undefined | HalfEdge {
    const node1 = node0.faceSuccessor;
    const dy = node1.y - node0.y;
    if (Geometry.isSameCoordinate(y, node0.y) && Geometry.isSameCoordinate(y, node1.y))
      return node0;
    if (Geometry.isSameCoordinate(dy, 0.0))
      return undefined;
    return Geometry.conditionalDivideFraction(y - node0.y, dy);
  }

  /**
   * * Compute fractional coordinates of the intersection of a horizontal line with an edge.
   * * If the edge is horizontal return undefined (no test for horizontal at y!!!)
   * * If the edge is not horizontal and y is between its end y's, return the fraction
   * @param nodeA Base node of edge
   * @param result optional preallocated result
   */
  public static horizontalScanFraction01(node0: HalfEdge, y: number): number | undefined {
    const node1 = node0.faceSuccessor;
    const dy = node1.y - node0.y;
    if (Geometry.isSameCoordinate(y, node0.y) && Geometry.isSameCoordinate(y, node1.y))
      return undefined;
    if (Geometry.isSameCoordinate(dy, 0.0))
      return undefined;
    const fraction = Geometry.conditionalDivideFraction(y - node0.y, dy);
    if (fraction !== undefined && fraction >= 0.0 && fraction <= 1.0)
      return fraction;
    return undefined;
  }
}
/**
 * A HalfEdgeGraph has:
 * * An array of (pointers to ) HalfEdge objects.
 * * A pool of masks for grab/drop use by algorithms.
 * @internal
 */
export class HalfEdgeGraph {
  /** Simple array with pointers to all the half edges in the graph. */
  public allHalfEdges: HalfEdge[];
  private _maskManager: MaskManager;
  private _numNodesCreated = 0;
  public constructor() {
    this.allHalfEdges = [];
    this._maskManager = MaskManager.create(HalfEdgeMask.ALL_GRAB_DROP_MASKS)!;
  }
  /** Ask for a mask (from the graph's free pool.) for caller's use.
   * * Optionally clear the mask throughout the graph.
   */
  public grabMask(clearInAllHalfEdges: boolean = true): HalfEdgeMask {
    const mask = this._maskManager.grabMask();
    if (clearInAllHalfEdges) {
      this.clearMask(mask);
    }
    return mask;
  }
  /**
   * Return `mask` to the free pool.
   */
  public dropMask(mask: HalfEdgeMask) { this._maskManager.dropMask(mask); }
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
   * * create an edge from coordinates x,y,z to (the tail of) an existing half edge.
   * @returns Return pointer to the half edge with tail at x,y,z
   */
  public createEdgeXYZHalfEdge(
    xA: number = 0,
    yA: number = 0,
    zA: number = 0,
    iA: number = 0,
    node: HalfEdge,
    iB: number = 0): HalfEdge {
    const a = HalfEdge.createHalfEdgePairWithCoordinates(xA, yA, zA, iA, node.x, node.y, node.z, iB, this.allHalfEdges);
    const b = a.faceSuccessor;
    HalfEdge.pinch(node, b);
    return a;
  }
  /**
   * * create an edge from coordinates x,y,z to (the tail of) an existing half edge.
   * @returns Return pointer to the half edge with tail at x,y,z
   */
  public createEdgeHalfEdgeHalfEdge(
    nodeA: HalfEdge,
    idA: number,
    nodeB: HalfEdge,
    idB: number = 0): HalfEdge {
    const a = HalfEdge.createHalfEdgePairWithCoordinates(nodeA.x, nodeA.y, nodeA.z, idA, nodeB.x, nodeB.y, nodeB.z, idB, this.allHalfEdges);
    const b = a.faceSuccessor;
    HalfEdge.pinch(nodeA, a);
    HalfEdge.pinch(nodeB, b);
    return a;
  }

  /**
   * * Create 2 half edges forming 2 vertices, 1 edge, and 1 face
   * * The two edges are joined as edgeMate pair.
   * * The two edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * The two edges are added to the graph's HalfEdge set
   * @returns Return pointer to the first half edge created.
   */
  public createEdgeXYAndZ(xyz0: XYAndZ, id0: number, xyz1: XYAndZ, id1: number): HalfEdge {
    const a = HalfEdge.createHalfEdgePairWithCoordinates(xyz0.x, xyz0.y, xyz0.z, id0, xyz1.x, xyz1.y, xyz1.z, id1, this.allHalfEdges);
    return a;
  }

  /**
   * * Insert a vertex in the edge beginning at base.
   * * this creates two half edges.
   * * The base of the new edge is 'after' the (possibly undefined) start node in its face loop.
   * * The existing mate retains its base xyz and i properties but is no longer the mate of base.
   * * The base and existing mate each become mates with a new half edge.
   * @returns Returns the reference to the half edge created.
   */
  public splitEdge(base: undefined | HalfEdge,
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0): HalfEdge {
    const he = HalfEdge.splitEdge(base, xA, yA, zA, iA, this.allHalfEdges);
    return he;
  }

  /**
   * * Insert a vertex in the edge beginning at base, with coordinates specified as a fraction along the existing edge.
   * * this creates two half edges.
   * * The base of the new edge is 'after' the (possibly undefined) start node in its face loop.
   * * The existing mate retains its base xyz and i properties but is no longer the mate of base.
   * * The base and existing mate each become mates with a new half edge.
   * @returns Returns the reference to the half edge created.
   */
  public splitEdgeAtFraction(base: HalfEdge, fraction: number): HalfEdge {
    const he = HalfEdge.splitEdge(base, base.fractionToX(fraction), base.fractionToY(fraction), base.fractionToZ(fraction), 0, this.allHalfEdges);
    return he;
  }
  /** This is a destructor-like action that eliminates all interconnection among the graph's nodes.
   * After this is called the graph is unusable.
   */
  public decommission() {
    for (const node of this.allHalfEdges) { node.decommission(); }
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
   * Return the number of nodes that have a specified mask bit set.
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

  /** Returns the number of face loops */
  public countFaceLoops(): number {
    this.clearMask(HalfEdgeMask.VISITED);
    let count = 0;
    this.announceFaceLoops((_graph: HalfEdgeGraph, _seed: HalfEdge) => { count++; return true; });
    return count;
  }
  /**
   * Returns the number of face loops satisfying a filter function with mask argument.
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

  /** Returns an array of nodes, where each node represents a starting point of a face loop.
   */
  public collectFaceLoops(): HalfEdge[] {
    const returnArray: HalfEdge[] = [];
    this.announceFaceLoops(
      (_graph: HalfEdgeGraph, node: HalfEdge) => { returnArray.push(node); return true; });
    return returnArray;
  }

  /** Returns an array of nodes, where each node represents a starting point of a vertex loop.
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
   * * terminate search if announce face (graph, node) returns false
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
   * * continue search if announceVertex(graph, node) returns true
   * * terminate search if announce vertex (graph, node) returns false
   * @param  announceVertex function to apply at one node of each face.
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
  /**
   * * Visit each vertex loop of the graph once.
   * * Call the announceVertex function
   * * continue search if announceNode(graph, node) returns true
   * * terminate search if announce face (graph, node) returns false
   * @param  announceNode function to apply at one node of each face.
   */
  public announceNodes(announceNode: GraphNodeFunction) {
    for (const node of this.allHalfEdges) {
      if (!announceNode(this, node))
        break;
    }
  }

  /** Return the number of nodes in the graph */
  public countNodes(): number { return this.allHalfEdges.length; }
  /** Apply transform to the xyz coordinates in the graph. */
  public transformInPlace(transform: Transform) {
    for (const node of this.allHalfEdges) {
      transform.multiplyXYAndZInPlace(node);
    }
  }
  /**
   * disconnect and delete all nodes that satisfy a filter condition.
   * @param deleteThisNode returns true to delete the corresponding edge. Should act symmetrically on the edgeMate.
   * @returns the number of nodes deleted (twice the number of deleted edges).
   */
  public yankAndDeleteEdges(deleteThisNode: NodeFunction): number {
    const numTotal = this.allHalfEdges.length;
    let numAccepted = 0;
    for (let i = 0; i < numTotal; i++) {
      const candidate = this.allHalfEdges[i];
      if (!deleteThisNode(candidate)) {
        this.allHalfEdges[numAccepted++] = candidate;
      } else
        candidate.isolateEdge();
    }
    const numDeleted = numTotal - numAccepted;
    this.allHalfEdges.length = numAccepted;
    return numDeleted;
  }

  /**
   * Delete all isolated edges.
   * @return the number of nodes deleted (twice the number of deleted edges).
   */
  public deleteIsolatedEdges(): number {
    const numTotal = this.allHalfEdges.length;
    let numAccepted = 0;
    for (let i = 0; i < numTotal; i++) {
      const candidate = this.allHalfEdges[i];
      if (!candidate.isIsolatedEdge) {
        this.allHalfEdges[numAccepted++] = candidate;
      }
    }
    const numDeleted = numTotal - numAccepted;
    this.allHalfEdges.length = numAccepted;
    return numDeleted;
  }

}
