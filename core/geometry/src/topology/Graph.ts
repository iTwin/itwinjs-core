/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { OrderedSet } from "@itwin/core-bentley";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { WritableXYAndZ, XAndY, XYAndZ } from "../geometry3d/XYZProps";
import { SmallSystem } from "../numerics/SmallSystem";
import { MaskManager } from "./MaskManager";

// import { GraphChecker } from "../test/topology/Graph.test"; // used for debugging

/* eslint-disable @typescript-eslint/no-this-alias */

/**
 * * Each node of the graph has a mask member.
 * * The mask member is a number which is used as set of single bit boolean values.
 * * Particular meanings of the various bits are HIGHLY application dependent.
 *   * The EXTERIOR mask bit is widely used to mark nodes that are "outside" the active areas
 *   * The PRIMARY_EDGE bit is widely used to indicate linework created directly from input data, hence protected from
 * triangle edge flipping.
 *   * The BOUNDARY bit is widely used to indicate that crossing this edge is a transition from outside to inside.
 *   * VISITED is used locally in many searches.
 *      * Never use VISITED unless the search logic is highly self contained.
 * @internal
 */
export enum HalfEdgeMask {
  /**
   * Mask commonly set consistently around exterior faces.
   * * A boundary edge with interior to one side, exterior to the other, will have EXTERIOR only on the outside.
   * * An edge inserted "within a purely exterior face" can have EXTERIOR on both sides.
   * * An interior edge (such as added during triangulation) will have no EXTERIOR bits.
  */
  // Visualization can be found at geometry/internaldocs/Graph.md
  EXTERIOR = 0x00000001,
  /**
   * Mask commonly set (on both sides) of original geometry edges that are transition from outside to inside.
   * * At the moment of creating an edge from primary user boundary loop coordinates, the fact that an edge is BOUNDARY
   * is often clear even though there is uncertainty about which side should be EXTERIOR.
   */
  // Visualization can be found at geometry/internaldocs/Graph.md
  BOUNDARY_EDGE = 0x00000002,
  /**
   * Mask commonly set (on both sides) of original geometry edges, but NOT indicating that the edge is certainly a
   * boundary between outside and inside.
   * * For instance, if geometry is provided as stray sticks (not loops), it can be marked PRIMARY_EDGE but neither
   * BOUNDARY_EDGE nor EXTERIOR_EDGE.
   */
  PRIMARY_EDGE = 0x00000004,
  /** Mask set on both sides of a bridge edge added by algorithms to join loops. */
  BRIDGE_EDGE = 0x00000008,
  /** Mask set on both sides of an edge added during graph regularization. */
  REGULARIZED_EDGE = 0x00000010,
  /** Mask applied to triangles by earcut triangulator. */
  TRIANGULATED_FACE = 0x00000100,
  /** Mask applied in a face with 2 edges. */
  NULL_FACE = 0x00000200,
  /** Temporary mask used for low level searches to identify previously-visited nodes. */
  VISITED = 0x00010000,
  /** No mask bits. */
  NULL_MASK = 0x00000000,
  /** The "upper 12" bits of 32 bit integer reserved for grab/drop. */
  ALL_GRAB_DROP_MASKS = 0xFFF00000,
  /** All mask bits */
  ALL_MASK = 0xFFFFFFFF,
}

/**
 * Function signature for function of one node with no return type restrictions.
 * @internal
 */
export type NodeFunction = (node: HalfEdge) => any;
/**
 * Function signature for function of one node, returning a number.
 * @internal
 */
export type NodeToNumberFunction = (node: HalfEdge) => number;
/**
 * Function signature for function of one node, returning a boolean.
 * @internal
 */
export type HalfEdgeToBooleanFunction = (node: HalfEdge) => boolean;
/**
 * Function signature for function of a node and a mask, returning a number.
 * @internal
 */
export type HalfEdgeAndMaskToBooleanFunction = (node: HalfEdge, mask: HalfEdgeMask) => boolean;
/**
 * Function signature for function of a graph and a node, returning a boolean.
 * @internal
 */
export type GraphNodeFunction = (graph: HalfEdgeGraph, node: HalfEdge) => boolean;
/**
 * Non-topological data members in a half edge.
 * These are not part of adjacency and masking logic.
 * Member fields for a half edge (which is also commonly called a node).
 * @internal
 */
export interface HalfEdgeUserData extends WritableXYAndZ {
  /** Angle used for sort-around-vertex. */
  sortAngle?: number;
  /** Numeric value for application-specific tagging (e.g. sorting). */
  sortData?: number;
  /**
   * Application-specific data for the edge identifier.
   * * Edge split operations are expected to copy this to new sub-edges.
   */
  edgeTag?: any;
  /**
   * Application-specific data for the face loop.
   * * Face split operations are expected to copy this to new nodes in the face.
   */
  faceTag?: any;
}
/**
 * A HalfEdge is "one side of an edge" in a structure of faces, edges and vertices. From a node there are
 * navigational links to:
 * * "faceSuccessor" -- the next half edge in a loop around a face.
 * * "facePredecessor" -- the previous half edge in a loop around a face.
 * * "edgeMate"  -- the node's partner on the other side of the edge.
 *
 * The next, prev, and mate are the essential connectivity. Additional node content is for application-specific
 * uses. The most useful ones are:
 * * x,y -- coordinates in the xy plane
 * * z -- z coordinate. This is normally ignored during planar setup, but used for output.
 * * maskBits -- an integer value manipulated as individual bits.
 *
 * In properly connected planar graph, interior face loops are counterclockwise. But that property (along with
 * expected masking) is a result of extensive validation of inputs, and is not true in intermediate phases of
 * graph manipulation.
 * @internal
 */
export class HalfEdge implements HalfEdgeUserData {
  /** Vertex index in some parent object's numbering. */
  public i: number;
  /**
   * Bitmask bits, used to set multiple flags on a node, indicating e.g., nodes on boundary edges, or in
   * an exterior face, or nodes visited during graph computations.
   * * See [[HalfEdgeMask]] for mask values.
   */
  public maskBits: number;
  /** Vertex x coordinate. */
  public x: number;
  /** Vertex y coordinate. */
  public y: number;
  /** Vertex z coordinate. */
  public z: number;
  /** Angle used for sort-around-vertex */
  public sortAngle?: number;
  /** Numeric value for application-specific tagging (e.g. sorting) */
  public sortData?: number;
  /**
   * Application-specific data for the edge identifier.
   * * edge split operations are expected to copy this to new sub-edges.
   */
  public edgeTag?: any;
  /**
   * Application-specific data for the face loop.
   * * Face split operations are expected to copy this to new nodes in the face.
   */
  public faceTag?: any;
  private _id: number;
  /** Immutable ID assigned sequentially during construction --- useful for debugging. */
  public get id() {
    return this._id;
  }
  private _facePredecessor: HalfEdge;
  private _faceSuccessor: HalfEdge;
  private _edgeMate: HalfEdge;
  /** Previous half edge "around the face" */
  public get facePredecessor(): HalfEdge {
    return this._facePredecessor;
  }
  /** Next half edge "around the face" */
  public get faceSuccessor(): HalfEdge {
    return this._faceSuccessor;
  }
  /** Half edge on the other side of this edge. */
  public get edgeMate(): HalfEdge {
    return this._edgeMate;
  }
  private static _totalNodesCreated = 0;
  public constructor(x: number = 0, y: number = 0, z: number = 0, i: number = 0) {
    this._id = HalfEdge._totalNodesCreated++;
    this.i = i;
    this.maskBits = 0x00000000;
    this.x = x;
    this.y = y;
    this.z = z;
    // explicit init to undefined is important for performance here
    this.sortAngle = undefined;
    this.sortData = undefined;
    this.edgeTag = undefined;
    this.faceTag = undefined;
    // always created in pairs, init here to make TS compiler and JS runtime happy
    this._facePredecessor = this;
    this._faceSuccessor = this;
    this._edgeMate = this;
  }
  /**
   * Take numStep face steps and return y coordinate.
   * * Positive steps are through faceSuccessor.
   * * Negative steps are through facePredecessor.
   */
  public faceStepY(numStep: number): number {
    let node: HalfEdge = this;
    if (numStep > 0)
      for (let i = 0; i < numStep; i++)
        node = node.faceSuccessor;
    else if (numStep < 0)
      for (let i = 0; i > numStep; i--)
        node = node.facePredecessor;
    return node.y;
  }
  /**
   * Create 2 half edges.
   * * The two edges are joined as edgeMate pair.
   * * The two edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * @returns the reference to the first half edge created.
   */
  public static createHalfEdgePair(heArray: HalfEdge[] | undefined): HalfEdge {
    // Visualization can be found at geometry/internaldocs/Graph.md
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
   * * Properties x,y,z,i are inserted in each half edge.
   * @returns the reference to the first half edge created, set with "A" properties.
   */
  public static createHalfEdgePairWithCoordinates(
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0,
    xB: number = 0, yB: number = 0, zB: number = 0, iB: number = 0,
    heArray: HalfEdge[] | undefined,
  ): HalfEdge {
    const a = HalfEdge.createHalfEdgePair(heArray);
    const b = a._edgeMate;
    a.x = xA;
    a.y = yA;
    a.z = zA;
    a.i = iA;
    b.x = xB;
    b.y = yB;
    b.z = zB;
    b.i = iB;
    return a;
  }
  /**
   * * Set heA <==> heB pointer relation through heA._faceSuccessor and heB._facePredecessor.
   * * This changes heA._faceSuccessor and heB._facePredecessor, but not heA._facePredecessor and heB._faceSuccessor.
   * * This must always be done with another call to setFaceLinks(heB,heA) in order to re-establish the entire
   * double-linked list.
   */
  private static setFaceLinks(heA: HalfEdge, heB: HalfEdge) {
    heA._faceSuccessor = heB;
    heB._facePredecessor = heA;
  }
  /** set heA <==> heB pointer relation edgeMate. */
  private static setEdgeMates(heA: HalfEdge, heB: HalfEdge) {
    heA._edgeMate = heB;
    heB._edgeMate = heA;
  }
  /**
   * Create a new vertex within the edge beginning at `baseA`.
   * * This creates two new nodes in their own vertex loop.
   * * If the base is `undefined`, create a single-edge loop.
   * * Existing nodes stay in their face and vertex loops and retain xyz and i values.
   * * Unlike [[pinch]], this breaks the edgeMate pairing of the input edge:
   * each node of the input edge gets a new node as its edge mate.
   * * On each side of the edge, if edgeTag is present, it is copied to the new node on that side.
   * @returns reference to the half edge created, the new face successor of `baseA`.
   */
  public static splitEdge(
    baseA: undefined | HalfEdge,
    xA: number = 0,
    yA: number = 0,
    zA: number = 0,
    iA: number = 0,
    heArray: HalfEdge[] | undefined,
  ): HalfEdge {
    // Visualization can be found at geometry/internaldocs/Graph.md
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
      // insert newA and newB between existing half edges
      HalfEdge.setFaceLinks(newA, nextA);
      HalfEdge.setFaceLinks(baseA, newA);
      HalfEdge.setFaceLinks(mateA, newB);
      HalfEdge.setFaceLinks(newB, vPredA);
      // set correct edge mates
      HalfEdge.setEdgeMates(newA, mateA);
      HalfEdge.setEdgeMates(newB, baseA);
      this.transferEdgeProperties(baseA, newA);
      this.transferEdgeProperties(mateA, newB);
    }
    return newA;
  }
  /**
   * Reverse of [[splitEdge]]: remove the vertex at `doomed` and merge its two incident edges.
   * @param doomed one of two nodes added by [[splitEdge]]. These nodes should form a vertex loop of two nodes.
   * On successful return this node and its mate are isolated.
   * @param checkParallel whether to check that the doomed edge and the preceding edge in its face loop are parallel.
   * When passing `true` the assumption is that edge geometry is linear. If nonlinear edge geometry is attached, the
   * caller should a) verify that the geometry on either side of the doomed vertex can be merged, and if so, they
   * should b) call this method passing `false`, and c) adjust the geometry of the returned edge and its edge mate
   * as appropriate.
   * @returns the former (surviving) face predecessor of `doomed`, or undefined if the edge can't be healed.
   */
  public static healEdge(doomed: HalfEdge, checkParallel: boolean = true): HalfEdge | undefined {
    if (doomed.isIsolatedEdge)
      return undefined;
    const doomed1 = doomed.vertexSuccessor;
    if (doomed1.vertexSuccessor !== doomed)
      return undefined; // v-loop not a 2-cycle
    if (checkParallel && !doomed.vectorToFaceSuccessor().isParallelTo(doomed.facePredecessor.vectorToFaceSuccessor(), false, true))
      return undefined; // removing this vertex does not leave a straight edge behind
    const fPred = doomed.facePredecessor;
    const fSucc = doomed.faceSuccessor;
    const fPred1 = doomed1.facePredecessor;
    const fSucc1 = doomed1.faceSuccessor;
    this.setFaceLinks(fPred, fSucc);
    this.setFaceLinks(fPred1, fSucc1);
    this.setEdgeMates(fPred, fPred1);
    this.setFaceLinks(doomed, doomed1);
    this.setFaceLinks(doomed1, doomed);
    this.setEdgeMates(doomed, doomed1);
    return fPred;
  }
  /**
   * Create a new sliver face "inside" an existing edge.
   * * This creates two nodes that are each face predecessor and successor to the other.
   * * Existing nodes stay in their face and vertex loops and retain xyz and i values.
   * * Unlike [[pinch]], this breaks the edgeMate pairing of the input edge:
   * each node of the input edge gets a new node as its edge mate.
   * * New nodes get the xyz and i values shared by the nodes in the vertex loops into which they are placed.
   * * New nodes' faceTag and edgeTag are `undefined`.
   * @returns reference to the half edge created in the vertex loop of baseA.
   */
  public static splitEdgeCreateSliverFace(
    baseA: HalfEdge,
    heArray: HalfEdge[] | undefined,
  ): HalfEdge {
    // Visualization can be found at geometry/internaldocs/Graph.md
    const baseB = baseA.edgeMate;
    const newA = new HalfEdge();
    const newB = new HalfEdge();
    if (heArray) {
      heArray.push(newA);
      heArray.push(newB);
    }
    newA._faceSuccessor = newA._facePredecessor = newB;
    newB._faceSuccessor = newB._facePredecessor = newA;
    HalfEdge.setEdgeMates(newA, baseB);
    HalfEdge.setEdgeMates(newB, baseA);
    newA.copyDataFrom(baseA, true, true, false, false);
    newB.copyDataFrom(baseB, true, true, false, false);
    return newA;
  }
  /** Masks copied when an edge is split. */
  private static _edgePropertyMasks: HalfEdgeMask[] = [
    HalfEdgeMask.EXTERIOR, HalfEdgeMask.BOUNDARY_EDGE, HalfEdgeMask.PRIMARY_EDGE, HalfEdgeMask.BRIDGE_EDGE, HalfEdgeMask.REGULARIZED_EDGE, HalfEdgeMask.NULL_FACE
  ];
  /**
   * Copy "edge based" content of `fromNode` to `toNode`:
   * * edgeTag
   * * edge masks
   */
  public static transferEdgeProperties(fromNode: HalfEdge, toNode: HalfEdge): void {
    toNode.edgeTag = fromNode.edgeTag;
    for (const mask of this._edgePropertyMasks) {
      if (fromNode.getMask(mask))
        toNode.setMask(mask);
      else
        toNode.clearMask(mask);
    }
  }
  /** Return the next half edge around this vertex in the CCW direction. */
  public get vertexSuccessor(): HalfEdge {
    return this.facePredecessor.edgeMate;
  }
  /** Return the next half edge around this vertex in the CW direction. */
  public get vertexPredecessor(): HalfEdge {
    return this.edgeMate.faceSuccessor;
  }
  /**
   * Set mask bits on this HalfEdge.
   * @param mask mask bits to apply
   */
  public setMask(mask: HalfEdgeMask): void {
    this.maskBits |= mask;
  }
  /**
   * Get mask bits from this HalfEdge.
   * @param mask mask bits to query
   */
  public getMask(mask: HalfEdgeMask): number {
    return (this.maskBits & mask);
  }
  /**
   * Clear mask bits from this HalfEdge.
   * @param mask mask bits to clear
   */
  public clearMask(mask: HalfEdgeMask): void {
    this.maskBits &= ~mask;
  }
  /**
   * Set a mask at all nodes around a vertex.
   * @param mask mask to apply to the half edges around this HalfEdge's vertex loop.
   */
  public setMaskAroundVertex(mask: HalfEdgeMask): void {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node = node.vertexSuccessor;
    } while (node !== this);
  }

  /** Set x,y,z at all nodes around a vertex. */
  public setXYZAroundVertex(x: number, y: number, z: number): void {
    let node: HalfEdge = this;
    do {
      node.x = x;
      node.y = y;
      node.z = z;
      node = node.vertexSuccessor;
    } while (node !== this);
  }
  /**
   * Apply a mask to all edges around a face.
   * @param mask mask to apply to the half edges around this HalfEdge's face loop.
   */
  public setMaskAroundFace(mask: HalfEdgeMask): void {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node = node.faceSuccessor;
    } while (node !== this);
  }
  /**
   * Apply a mask to both sides of an edge.
   * @param mask mask to apply to this edge and its edgeMate.
   */
  public setMaskAroundEdge(mask: HalfEdgeMask): void {
    this.setMask(mask);
    this.edgeMate.setMask(mask);
  }
  /**
   * Clear a mask on both sides of an edge.
   * @param mask mask to clear on this edge and its edgeMate.
   */
  public clearMaskAroundEdge(mask: HalfEdgeMask): void {
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
  /** Return true if `other` node is in the vertex loop around `this` node. */
  public findAroundVertex(other: HalfEdge): boolean {
    let node: HalfEdge = this;
    do {
      if (node === other)
        return true;
      node = node.vertexSuccessor;
    } while (node !== this);
    return false;
  }
  /** Return true if `other` node is in the face loop around `this` node. */
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
   * Returns whether the mask is set or unset on all nodes of the face loop.
   * @param mask the mask to check.
   * @param value true for mask set and false for mask unset.
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
   * Apply a mask and edgeTag to all edges around a face. Optionally apply it to all edge mates.
   * @param mask mask to apply.
   * @param tag edgeTag to apply
   * @param applyToMate If true, also apply the tag to the edge mates around the face.
   */
  public setMaskAndEdgeTagAroundFace(mask: HalfEdgeMask, tag: any, applyToMate: boolean = false): void {
    let node: HalfEdge = this;
    do {
      node.setMask(mask);
      node.edgeTag = tag;
      if (applyToMate) {
        const mate = node.edgeMate;
        mate.setMask(mask);
        mate.edgeTag = tag;
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
  /**
   * Returns the number of nodes that match (or do not match) the given mask value around this face loop.
   * @param mask the mask to check.
   * @param value true for mask match and false for mask not match. Default is `true`.
   */
  public countMaskAroundFace(mask: HalfEdgeMask, value: boolean = true): number {
    let count = 0;
    let node: HalfEdge = this;
    if (value) {
      do {
        if (node.isMaskSet(mask))
          count++;
        node = node.faceSuccessor;
      } while (node !== this);
    } else {
      do {
        if (!node.isMaskSet(mask))
          count++;
        node = node.faceSuccessor;
      } while (node !== this);
    }
    return count;
  }
  /**
   * Returns the number of nodes that match (or do not match) the given mask value around this vertex loop.
   * @param mask the mask to check.
   * @param value true for mask match and false for mask not match.
   */
  public countMaskAroundVertex(mask: HalfEdgeMask, value: boolean = true): number {
    let count = 0;
    let node: HalfEdge = this;
    if (value) {
      do {
        if (node.isMaskSet(mask))
          count++;
        node = node.vertexSuccessor;
      } while (node !== this);
    } else {
      do {
        if (!node.isMaskSet(mask))
          count++;
        node = node.vertexSuccessor;
      } while (node !== this);
    }
    return count;
  }
  /**
   * Returns the first node that matches (or does not match) the given mask value around this vertex loop, starting
   * with the instance node and proceeding via `vertexSuccessor`.
   * @param mask the mask to check.
   * @param value true for mask match and false for mask not match. Default is `true`.
   * @param reverse if true, search in reverse order via `vertexPredecessor`. Default is `false`.
   */
  public findMaskAroundVertex(mask: HalfEdgeMask, value: boolean = true, reverse: boolean = false): HalfEdge | undefined {
    let node: HalfEdge = this;
    do {
      if (node.isMaskSet(mask) === value)
        return node;
      node = reverse ? node.vertexPredecessor : node.vertexSuccessor;
    } while (node !== this);
    return undefined;
  }
  /**
   * Returns the first node that matches (or does not match) the given mask value around this face loop, starting
   * with the instance node and proceeding via face successors.
   * @param mask the mask to check.
   * @param value true for mask match and false for mask not match. Default is `true`.
   */
  public findMaskAroundFace(mask: HalfEdgeMask, value: boolean = true): HalfEdge | undefined {
    let node: HalfEdge = this;
    do {
      if (node.isMaskSet(mask) === value)
        return node;
      node = node.faceSuccessor;
    } while (node !== this);
    return undefined;
  }
  /**
   *  Returns the first node that matches (or does not match) the given mask value around this edge, starting
   * with the instance node and then checking its edge mate.
   * @param mask the mask to check.
   * @param value true for mask match and false for mask not match.
   */
  public findMaskAroundEdge(mask: HalfEdgeMask, value: boolean = true): HalfEdge | undefined {
    if (this.isMaskSet(mask) === value)
      return this;
    const mate = this.edgeMate;
    if (mate.isMaskSet(mask) === value)
      return mate;
    return undefined;
  }
  /**
   * Set a mask and return prior value.
   * @param mask mask to apply.
   */
  public testAndSetMask(mask: HalfEdgeMask): number {
    const oldMask = this.maskBits & mask;
    this.maskBits |= mask;
    return oldMask;
  }
  /**
   * Set `this.x`, `this.y`, `this.z` from `node.x`, `node.y`, `node.z`.
   * @param node node containing xyz.
   */
  public setXYZFrom(node: HalfEdge) {
    this.x = node.x;
    this.y = node.y;
    this.z = node.z;
  }
  /**
   * Set `this.x`, `this.y`, `this.z` from `xyz.x`, `xyz.y`, `xyz.z`.
   * @param node source with x,y,z properties
   */
  public setXYZ(xyz: XYAndZ) {
    this.x = xyz.x;
    this.y = xyz.y;
    this.z = xyz.z;
  }
  /**
   * Test if any of the `mask` bits are set in the node's bitMask.
   * @return true (as a simple boolean, not a mask) if any bits of the `mask` match bits of the node's bitMask.
   */
  public isMaskSet(mask: HalfEdgeMask): boolean {
    return (this.maskBits & mask) !== 0;
  }
  /**
   * Static method to test if any of the `mask` bits are set in the `node`'s bitMask.
   * * This is used as filter in searches.
   * @returns `node.isMaskSet(mask)`
   */
  public static filterIsMaskOn(node: HalfEdge, mask: HalfEdgeMask): boolean {
    return node.isMaskSet(mask);
  }
  /**
   * Static method to test if any of the `mask` bits are set in the `node`'s bitMask.
   * * This is used as filter in searches.
   * @returns `!node.isMaskSet(mask)`
   */
  public static filterIsMaskOff(node: HalfEdge, mask: HalfEdgeMask): boolean {
    return !node.isMaskSet(mask);
  }
  /**
   * Create an edge with initial id,x,y at each end.
   * @param id0 id for first node.
   * @param x0 x coordinate for first node.
   * @param y0 y coordinate for first node.
   * @param id1 id for second node.
   * @param x1 x coordinate for second node.
   * @param y1 y coordinate for second node.
   * @returns the reference to the new node at (x0,y0).
   */
  public static createEdgeXYXY(id0: number, x0: number, y0: number, id1: number, x1: number, y1: number): HalfEdge {
    const node0 = new HalfEdge(x0, y0);
    const node1 = new HalfEdge(x1, y1);
    node0._faceSuccessor = node0._facePredecessor = node0._edgeMate = node1;
    node1._faceSuccessor = node1._facePredecessor = node1._edgeMate = node0;
    node0._id = id0;
    node1._id = id1;
    return node0;
  }
  /**
   *"Pinch" is the universal operator for manipulating a node's next and previous pointers.
   * * It is its own inverse: applying it twice on the same inputs (i.e., `pinch(a,b); pinch(a,b);`) gets back to
   * where you started.
   * * If the inputs are in different face loops, the loops join to one face loop after the pinch.
   * * If the inputs are in the same face loop, the loop splits into two face loops after the pinch.
   */
  public static pinch(nodeA: HalfEdge, nodeB: HalfEdge) {
    // Visualization can be found at geometry/internaldocs/Graph.md
    if (nodeA !== nodeB) {
      const predA = nodeA._facePredecessor;
      const predB = nodeB._facePredecessor;
      nodeB._facePredecessor = predA;
      nodeA._facePredecessor = predB;
      predB._faceSuccessor = nodeA;
      predA._faceSuccessor = nodeB;
    }
  }
  /** Return whether the edge is dangling at its base. */
  public get isDangling(): boolean {
    return this.edgeMate.faceSuccessor === this;
  }
  /**
   * Pinch this half edge out of its base vertex loop.
   * @return the surviving HalfEdge in the vertex loop or `undefined` if the instance HalfEdge is already dangling.
   */
  public yankFromVertexLoop(): HalfEdge | undefined {
    const other = this.edgeMate.faceSuccessor;
    if (other === this)
      return undefined;
    // at this point "other" is the vertex predecessor of "this"
    HalfEdge.pinch(this, other);
    return other;
  }
  /**
   * Turn all pointers to `undefined` so garbage collector can reuse the object.
   * * This is to be called only by a Graph object that is being decommissioned.
   */
  public decommission() {
    (this._facePredecessor as any) = undefined;
    (this._faceSuccessor as any) = undefined;
    (this._edgeMate as any) = undefined;
  }
  /** Return the node. This identity function is useful as the NodeFunction in collector methods. */
  public static nodeToSelf(node: HalfEdge): any {
    return node;
  }
  /** Return the id of a node. Useful for collector methods. */
  public static nodeToId(node: HalfEdge): number {
    return node.id;
  }
  /** Return the id of a node as string. Useful for collector methods. */
  public static nodeToIdString(node: HalfEdge): string {
    return node.id.toString();
  }
  /** Return the [id, mask, [x,y]] of a node. Useful for collector methods. */
  public static nodeToIdMaskXY(node: HalfEdge): { id: number, mask: string, xy: number[] } {
    return { id: node.id, mask: HalfEdge.nodeToMaskString(node), xy: [node.x, node.y] };
  }
  /** Return the [id, mask, [x,y]] of a node as string. Useful for collector methods. */
  public static nodeToIdXYString(node: HalfEdge): string {
    const s = `${node.id.toString()}+${HalfEdge.nodeToMaskString(node)}[${node.x},${node.y}]`;
    return s;
  }
  /** Return the [id, [x,y,z]] of a node as string. Useful for collector methods. */
  public static nodeToIdXYZString(node: HalfEdge): string {
    return `[${node.id.toString()}: ${node.x},${node.y},${node.z}]`;
  }
  /**
   * Create a string representation of the mask.
   * * Null mask is empty string.
   * * Appended characters B,P,X,N are for BOUNDARY_EDGE, PRIMARY_EDGE, EXTERIOR, and NULL_FACE mask bits.
   */
  public static nodeToMaskString(node: HalfEdge): string {
    let s = "";
    if (node.isMaskSet(HalfEdgeMask.BOUNDARY_EDGE))
      s += "B";
    if (node.isMaskSet(HalfEdgeMask.PRIMARY_EDGE))
      s += "P";
    if (node.isMaskSet(HalfEdgeMask.EXTERIOR))
      s += "X";
    if (node.isMaskSet(HalfEdgeMask.NULL_FACE))
      s += "N";
    return s;
  }
  /** Return [x,y] with coordinates of node. */
  public static nodeToXY(node: HalfEdge): number[] {
    return [node.x, node.y];
  }
  /** Return Vector2d from `this` to face successor (with only xy coordinates). */
  public vectorToFaceSuccessorXY(result?: Vector2d): Vector2d {
    return Vector2d.create(this.faceSuccessor.x - this.x, this.faceSuccessor.y - this.y, result);
  }
  /** Return Vector3d from `this` to face successor. */
  public vectorToFaceSuccessor(result?: Vector3d): Vector3d {
    const other = this.faceSuccessor;
    return Vector3d.create(
      other.x - this.x,
      other.y - this.y,
      other.z - this.z,
      result,
    );
  }
  /** Return Vector3d from `this` to face successor. */
  public vectorToFacePredecessor(result?: Vector3d): Vector3d {
    const other = this.facePredecessor;
    return Vector3d.create(
      other.x - this.x,
      other.y - this.y,
      other.z - this.z,
      result,
    );
  }
  /**
   * Test if `spaceNode` is in the sector of `sectorNode`.
   * * The sector at `sectorNode` is defined by two rays starting at `sectorNode` and extending along the edges
   * owned by `sectorNode` and its face predecessor.
   * * In general, this method returns `true` if the coordinates of `spaceNode` are _strictly_ inside this sector
   * (not on the rays).
   * * Interpretation is whether a viewer at `sectorNode` can see `spaceNode` between the two rays.
   * * Degenerate sectors of 180 or 360 degrees have special handling.
   */
  public static isNodeVisibleInSector(spaceNode: HalfEdge, sectorNode: HalfEdge): boolean {
    // remark: fussy details ported from native code. The obscure cases seemed "unlikely" at first. But pre-existing
    // unit tests for triangulation pinged just about everything. So it really matters to do the "0" cases this way
    // (as usual, hard coded zero is suspect, but it seems to work nicely in the discrete decisions).
    if (sectorNode.vertexSuccessor === sectorNode)
      return true;
    const successor = sectorNode.faceSuccessor;
    const predecessor = sectorNode.facePredecessor;
    const successorCross = this.crossProductXYToTargets(sectorNode, successor, spaceNode);
    const predecessorCross = this.crossProductXYToTargets(predecessor, sectorNode, spaceNode);
    // simplest case: two positives
    if (successorCross > 0.0 && predecessorCross > 0.0)
      return true;
    const sectorCross = this.crossProductXYToTargets(predecessor, sectorNode, successor);
    if (predecessorCross <= 0.0 && successorCross <= 0.0) {
      if (predecessorCross === 0.0 && successorCross === 0.0 && sectorCross === 0.0) {
        // Everything is on a line. If the sector is a degenerate face, nodeP
        // can only be in if it is the other node in the degenerate face.
        if (predecessor === successor && sectorNode.vertexSuccessor !== sectorNode)
          return spaceNode === successor;
        // Sector is 360 degrees. Call it in only if vector from predP to sectorP points forward to nodeP.
        return HalfEdge.dotProductNodeToNodeVectorsXY(predecessor, sectorNode, sectorNode, spaceNode) > 0.0;
      } else {
        return false;
      }
    } else {
      if (sectorCross === 0.0 && predecessorCross !== 0.0 && successorCross !== 0.0) {
        // The incoming and outgoing edges at the sector are identical direction. We have to decide if this node is
        // inside the degenerate face (i.e. a geometrically empty sector) or outside (i.e. a nearly complete sector).
        // In the inside case, the face is just two nodes. Exact equality for zero is ok because cross product should
        // be using identical coordinates in subtracted terms (all furrow eyebrows in unison).
        return predecessor !== successor;
      }
      return sectorCross < 0.0;
    }
  }
  /** Returns 2D cross product of vectors from `base` to `targetA` and from `base` to `targetB`. */
  public static crossProductXYToTargets(base: HalfEdge, targetA: HalfEdge, targetB: HalfEdge): number {
    return Geometry.crossProductXYXY(
      targetA.x - base.x, targetA.y - base.y,
      targetB.x - base.x, targetB.y - base.y,
    );
  }
  /** Returns 2D dot product of vectors from `baseA` to `targetA` and from `baseB` to `targetB`. */
  public static dotProductNodeToNodeVectorsXY(baseA: HalfEdge, targetA: HalfEdge, baseB: HalfEdge, targetB: HalfEdge): number {
    return Geometry.dotProductXYXY(
      targetA.x - baseA.x, targetA.y - baseA.y,
      targetB.x - baseB.x, targetB.y - baseB.y,
    );
  }
  /** Return 2D cross product of vectors from `nodeA` to `nodeB` and from `nodeB` to `nodeC`. */
  public static crossProductXYAlongChain(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge): number {
    return Geometry.crossProductXYXY(
      nodeB.x - nodeA.x, nodeB.y - nodeA.y,
      nodeC.x - nodeB.x, nodeC.y - nodeB.y,
    );
  }
  /**
   * Compute whether the sector defined by the chain of nodes is convex.
   * * This function is determining if, in the traversal of the HalfEdges in a face loop, a corner makes a left turn
   * (convex) or a right turn (not-convex). Note that if we have a convex face, then to traverse it in ccw orientation,
   * we always do left turns. However, if the face is not convex, we make both left and right turns.
   * * This computation ignores z-coordinates and connectivity, so the nodes are not required to be in the same face loop.
   * @param nodeA the first node in the chain, nominally the face predecessor of nodeB.
   * @param nodeB the second node in the chain; the node at the sector vertex.
   * @param nodeC the third node in the chain, nominally the face successor of nodeB.
   * @param signedAreaTol optional signed area tolerance to use in test for parallel vectors. Typically this is a
   * fraction of the sector's face's signed area. We can't compute area here, so if `undefined`, zero tolerance is used.
   * @returns true iff the sector is convex. A degenerate sector, where the incident edges overlap, returns false.
   */
  public static isSectorConvex(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge, signedAreaTol: number = 0): boolean {
    const signedSectorArea = 0.5 * HalfEdge.crossProductXYAlongChain(nodeA, nodeB, nodeC);
    signedAreaTol = signedAreaTol ?? 0.0;
    if (Math.abs(signedSectorArea) <= Math.abs(signedAreaTol)) {
      // the sector vectors are nearly parallel or anti-parallel; only the former is deemed convex.
      return HalfEdge.dotProductNodeToNodeVectorsXY(nodeA, nodeB, nodeB, nodeC) > 0.0;
    }
    // // sector is convex if the area is positive. Call it convex even if we are a little bit on the other side of zero.
    return signedSectorArea > -signedAreaTol;
  }
  /**
   * Compute whether the sector at this node is convex.
   * * This function is determining if, in the traversal of the HalfEdges in a face loop, a corner makes a left turn
   * (convex) or a right turn (not-convex). Note that if we have a convex face, then to traverse it in ccw orientation,
   * we always do left turns. However, if the face is not convex, we make both left and right turns.
   * * This computation ignores z-coordinates.
   * @param signedAreaTol optional signed area tolerance to use in test for parallel vectors. If `undefined`, a fraction
   * (`Geometry.smallMetricDistanceSquared`) of the computed signed area is used. Pass 0 to skip toleranced computation.
   * @returns true iff the sector is convex. A degenerate sector, where the incident edges overlap, returns false.
   */
  public isSectorConvex(signedAreaTol?: number): boolean {
    if (signedAreaTol === undefined)
      signedAreaTol = Geometry.smallMetricDistanceSquared * this.signedFaceArea();
    return HalfEdge.isSectorConvex(this.facePredecessor, this, this.faceSuccessor, signedAreaTol);
  }
  /**
   * Compute whether this face is convex.
   * * Note that if we have a convex face, then to traverse it in ccw orientation, we always do left turns.
   * However, if the face is not convex, we make both left and right turns.
   * * This computation ignores z-coordinates.
   * @param tolerance optional relative tolerance to use in test for parallel vectors. Default value is
   * `Geometry.smallMetricDistanceSquared`. Pass 0 to skip toleranced computation.
   * @returns true iff this face is convex.
   */
  public isFaceConvex(tolerance: number = Geometry.smallMetricDistanceSquared): boolean {
    let node: HalfEdge = this;
    const signedAreaTol = tolerance > 0.0 ? tolerance * node.signedFaceArea() : 0.0;
    do {
      if (!node.isSectorConvex(signedAreaTol))
        return false;
      node = node.faceSuccessor;
    } while (node !== this);
    return true;
  }
  /** Isolate the edge from the graph by yanking each end from its vertex loop. */
  public isolateEdge(): void {
    const mate = this.edgeMate;
    this.yankFromVertexLoop();
    mate.yankFromVertexLoop();
  }
  /**
   * Specify whether this edge is isolated from the rest of the graph.
   * * Both edge mates of an isolated edge return true for [[isDangling]].
   */
  public get isIsolatedEdge(): boolean {
    return this === this.vertexSuccessor && this.edgeMate === this.edgeMate.vertexSuccessor;
  }
  /** Return true if `this` is lexically below `other`. We compare y first, then x, and ignore z. */
  public belowYX(other: HalfEdge): boolean {
    if (this.y < other.y)
      return true;
    if (this.y > other.y)
      return false;
    if (this.x < other.x)
      return true;
    return false;
  }
  /** Returns `true` if the node does NOT have `Mask.EXTERIOR_MASK` set. */
  public static testNodeMaskNotExterior(node: HalfEdge): boolean {
    return !node.isMaskSet(HalfEdgeMask.EXTERIOR);
  }
  /** Returns `true` if the edge mate has `Mask.EXTERIOR_MASK` set. */
  public static testMateMaskExterior(node: HalfEdge): boolean {
    return node.edgeMate.isMaskSet(HalfEdgeMask.EXTERIOR);
  }
  /**
   * Returns radians between this edge and its face predecessor edge, using all three coordinates x,y,z and
   * given normal to resolve sweep direction.
   * * The returned angle is non-negative: 0 <= radians < 2*PI.
   */
  public static sectorSweepRadiansXYZ(node: HalfEdge, normal: Vector3d): number {
    const suc = node.faceSuccessor;
    const pred = node.facePredecessor;
    return Angle.orientedRadiansBetweenVectorsXYZ(
      suc.x - node.x, suc.y - node.y, suc.z - node.z,
      pred.x - node.x, pred.y - node.y, pred.z - node.z,
      normal.x, normal.y, normal.z,
      true,
    );
  }
  /** Returns true if the face has positive area in xy parts. */
  public static testFacePositiveAreaXY(node: HalfEdge) {
    return node.countEdgesAroundFace() > 2 && node.signedFaceArea() > 0.0;
  }
  /** Return true if x and y coordinates of `this` and `other` are exactly equal .*/
  public isEqualXY(other: XAndY | HalfEdge): boolean {
    return this.x === other.x && this.y === other.y;
  }
  /** Return distance between xy coordinates of `this` and `other` node. */
  public distanceXY(other: HalfEdge): number {
    return Geometry.distanceXYXY(this.x, this.y, other.x, other.y);
  }
  /** Return distance between xyz coordinates of `this` and `other` node. */
  public distanceXYZ(other: HalfEdge): number {
    return Geometry.distanceXYZXYZ(this.x, this.y, this.z, other.x, other.y, other.z);
  }
  /**
   * Search around the instance's face loop for nodes with the specified mask value.
   * * Returned nodes satisfy `node.isMaskSet(mask) === value`.
   * @param mask target mask.
   * @param value target boolean value for mask on half edges (default `true`).
   * @param result optional array to be cleared, populated with masked nodes, and returned.
   * @return array of masked half edges
   */
  public collectMaskedEdgesAroundFace(mask: HalfEdgeMask, value: boolean = true, result?: HalfEdge[]): HalfEdge[] {
    if (result === undefined)
      result = [];
    else
      result.length = 0;
    let node: HalfEdge = this;
    do {
      if (node.isMaskSet(mask) === value)
        result.push(node);
      node = node.faceSuccessor;
    } while (node !== this);
    return result;
  }
  /**
   * Announce edges in the face loop, starting with the instance and proceeding in a `faceSuccessor` traversal.
   * @param announceEdge function to call at each edge
   */
  public announceEdgesInFace(announceEdge: NodeFunction): void {
    let node: HalfEdge = this;
    do {
      announceEdge(node);
      node = node.faceSuccessor;
    } while (node !== this);
  }
  /**
   * Announce edges in the super face loop, starting with the instance.
   * * A super face admits a `faceSuccessor` traversal, where the next edge at the far vertex is the first one lacking `skipMask` in a `vertexPredecessor` traversal.
   * @param skipMask mask on edges to skip.
   * @param announceEdge function to call at each edge that is not skipped.
   * @param announceSkipped optional function to call at each edge that is skipped.
   * @return whether a super face was found. Specifically, if a vertex loop has all edges with `skipMask` set, the return value is `false`.
   */
  public announceEdgesInSuperFace(skipMask: HalfEdgeMask, announceEdge: NodeFunction, announceSkipped?: NodeFunction): boolean {
    const maxIter = 1000; // safeguard against infinite loops
    let iter = 0;
    const findNextNodeAroundVertex = (he: HalfEdge): HalfEdge | undefined => {
      let vNode = he;
      do {
        if (!vNode.isMaskSet(skipMask))
          return vNode;
        announceSkipped?.(vNode);
        vNode = vNode.vertexPredecessor;
      } while (vNode !== he);
      return undefined;
    };
    const firstNode = findNextNodeAroundVertex(this);
    if (!firstNode)
      return false;
    let node: HalfEdge | undefined = firstNode;
    do {
      announceEdge(node);
      node = findNextNodeAroundVertex(node.faceSuccessor);
      if (!node)
        return false;
    } while (node !== firstNode && iter++ < maxIter);
    return iter < maxIter;
  }
  /**
   * Evaluate `f(node)` at each node around `this` node's face loop. Collect the function values.
   * @param f optional node function. If `undefined`, collect the nodes themselves.
   * @returns the array of function values.
   */
  public collectAroundFace(f?: NodeFunction): any[] {
    const nodes = [];
    let node: HalfEdge = this;
    do {
      nodes.push(f ? f(node) : node); // push the node itself if "f" is undefined
      node = node.faceSuccessor;
    } while (node !== this);
    return nodes;
  }
  /**
   * Search around `this` node's vertex loop for nodes with the specified mask value.
   * * Returned nodes satisfy `node.isMaskSet(mask) === value`.
   * @param mask target mask.
   * @param value target boolean value for mask on half edges.
   * @param result optional array to be cleared and receive masked nodes.
   */
  public collectMaskedEdgesAroundVertex(
    mask: HalfEdgeMask, value: boolean = true, result?: HalfEdge[],
  ): HalfEdge[] {
    if (result === undefined)
      result = [];
    else
      result.length = 0;
    let node: HalfEdge = this;
    do {
      if (node.isMaskSet(mask) === value)
        result.push(node);
      node = node.vertexSuccessor;
    } while (node !== this);
    return result;
  }
  /**
   * Evaluate `f(node)` at each node around `this` node's vertex loop. Collect the function values.
   * @param f optional node function. If `undefined`, collect the nodes themselves.
   * @returns the array of function values.
   */
  public collectAroundVertex(f?: NodeFunction): any[] {
    const nodes = [];
    let node: HalfEdge = this;
    do {
      nodes.push(f ? f(node) : node); // push the node itself if "f" is undefined
      node = node.vertexSuccessor;
    } while (node !== this);
    return nodes;
  }
  /**
   * Evaluate `f(node)` at each node around `this` node's face loop. Sum the function values.
   * @param f node to number function.
   * @returns the sum of function values.
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
   * Evaluate `f(node)` at each node around `this` node's vertex loop. Sum the function values.
   * @param f node to number function.
   * @returns the sum of function values.
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
  /** Clear the given mask bits for all nodes in `this` node's face loop. */
  public clearMaskAroundFace(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.clearMask(mask);
      node = node.faceSuccessor;
    } while (node !== this);
  }
  /** Clear out the given mask bits for all nodes in `this` node's vertex loop. */
  public clearMaskAroundVertex(mask: HalfEdgeMask) {
    let node: HalfEdge = this;
    do {
      node.clearMask(mask);
      node = node.vertexSuccessor;
    } while (node !== this);
  }
  /**
   * Compute the signed xy area of `this` node's face.
   * * A positive area is counterclockwise.
   * * A negative area is clockwise.
   * @returns signed area of `this` node's face.
   */
  public signedFaceArea(): number {
    let sum = 0;
    // We start from `this` node and traverse the face, forming trapezoids with vertical bases.
    // Some trapezoids will have a zero-length base, e.g., a triangle.
    // Trapezoid bases are measured from `this.y` to keep area values numerically smaller.
    // Split each trapezoid into two triangles whose y-coordinates are above/below `this.y`.
    // Each trapezoid's signed area is computed by summing the signed areas of these two triangles.
    // Area signs depend on careful assignment of signs to trapezoid height (relative to `this.x`) and trapezoid
    // bases (relative to `this.y`).
    // Some trapezoids have signed areas outside the face that are cancelled out by subsequent trapezoids.
    // The formula in the loop accumulates twice the trapezoid areas, so at the end we halve the sum.
    // Illustration of the algorithm can be found at geometry/internaldocs/Graph.md
    let x0 = this.x;
    let x1 = 0.0;
    const y0 = this.y;
    let dy0 = 0.0;
    let dy1 = 0.0;
    let node1;
    let node0: HalfEdge = this;
    do {
      node1 = node0.faceSuccessor;
      x1 = node1.x;
      dy1 = node1.y - y0;
      // When trapezoid bases dy0 and dy1 have opposite sign, this product is (twice) the difference of the areas
      // of the trapezoid above and below y=y0. This is equal to (twice) the difference of the areas of the congruent
      // triangles formed by the trapezoid diagonals and bases, a consequence of the other two triangles having equal
      // area, and thus cancelling out.
      sum += (x0 - x1) * (dy0 + dy1); // twice trapezoid area = trapezoid height * sum of trapezoid bases
      x0 = x1;
      dy0 = dy1;
      node0 = node1;
    } while (node0 !== this);
    return 0.5 * sum;
  }
  /**
   * Interpolate xy coordinates between `this` node and its face successor.
   * @param fraction fractional position along this edge.
   * @param result optional point to populate and return.
   */
  public fractionToPoint2d(fraction: number, result?: Point2d): Point2d {
    const suc = this.faceSuccessor;
    return Point2d.create(
      this.x + (suc.x - this.x) * fraction,
      this.y + (suc.y - this.y) * fraction,
      result,
    );
  }
  /**
   * Interpolate xyz coordinates between `this` node and its face successor.
   * @param fraction fractional position along this edge.
   * @param result optional point to populate and return.
   */
  public fractionToPoint3d(fraction: number, result?: Point3d): Point3d {
    const suc = this.faceSuccessor;
    return Point3d.create(
      this.x + (suc.x - this.x) * fraction,
      this.y + (suc.y - this.y) * fraction,
      this.z + (suc.z - this.z) * fraction,
      result,
    );
  }
  /**
   * Interpolate xy coordinates at `fractionAlong` between this node and its face successor. Then shift perpendicular
   * to the left of this edge by `fractionPerpendicular`.
   * @param fractionAlong fractional position along this edge.
   * @param fractionPerpendicular fractional position along the left perpendicular with the same length as this edge.
   * @param result optional xy coordinates.
   */
  public fractionAlongAndPerpendicularToPoint2d(
    fractionAlong: number, fractionPerpendicular: number, result?: Point2d,
  ): Point2d {
    const suc = this.faceSuccessor;
    const dx = suc.x - this.x;
    const dy = suc.y - this.y;
    return Point2d.create(
      this.x + dx * fractionAlong - dy * fractionPerpendicular,
      this.y + dy * fractionAlong + dx * fractionPerpendicular,
      result,
    );
  }
  /** Return the 3d coordinates at this half edge. */
  public getPoint3d(result?: Point3d): Point3d {
    return Point3d.create(this.x, this.y, this.z, result);
  }
  /** Return the 2d coordinates at this half edge. */
  public getPoint2d(result?: Point2d): Point2d {
    return Point2d.create(this.x, this.y, result);
  }
  /** Return a 3d vector from start to end of this half edge. */
  public getVector3dAlongEdge(result?: Vector3d): Vector3d {
    const suc = this.faceSuccessor;
    return Vector3d.create(suc.x - this.x, suc.y - this.y, suc.z - this.z, result);
  }
  /** Return a 2d vector from start to end of this half edge. */
  public getVector2dAlongEdge(result?: Vector2d): Vector2d {
    const suc = this.faceSuccessor;
    return Vector2d.create(suc.x - this.x, suc.y - this.y, result);
  }
  /**
   * Return the interpolated x coordinate between `this` node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToX(fraction: number): number {
    const suc = this.faceSuccessor;
    return this.x + (suc.x - this.x) * fraction;
  }
  /**
   * Return the interpolated y coordinate between `this` node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToY(fraction: number): number {
    const suc = this.faceSuccessor;
    return this.y + (suc.y - this.y) * fraction;
  }
  /**
   * Return the interpolated z coordinate between `this` node and its face successor.
   * @param fraction fractional position along this edge.
   */
  public fractionToZ(fraction: number): number {
    const suc = this.faceSuccessor;
    return this.z + (suc.z - this.z) * fraction;
  }
  /**
   * Compute fractional coordinates of the intersection of edges from given base nodes.
   * * If parallel or colinear, return `undefined`.
   * * If (possibly extended) lines intersect, return the fractions of intersection as x,y in the result.
   * @param nodeA0 base node of edge A.
   * @param nodeB0 base node of edge B.
   * @param result optional preallocated result.
   */
  public static transverseIntersectionFractions(
    nodeA0: HalfEdge, nodeB0: HalfEdge, result?: Vector2d,
  ): Vector2d | undefined {
    const nodeA1 = nodeA0.faceSuccessor;
    const nodeB1 = nodeB0.faceSuccessor;
    if (!result)
      result = Vector2d.create();
    // To find the fraction of intersection (ta,tb), you need to solve these 2 equations:
    // (nodeA1.x - nodeA0.x)ta + (nodeB0.x - nodeB1.x)tb = nodeB0.x - nodeA0.x
    // (nodeA1.y - nodeA0.y)ta + (nodeB0.y - nodeB1.y)tb = nodeB0.y - nodeA0.y
    // Proof can be found at geometry/internaldocs/Graph.md
    if (SmallSystem.linearSystem2d(
      nodeA1.x - nodeA0.x, nodeB0.x - nodeB1.x,
      nodeA1.y - nodeA0.y, nodeB0.y - nodeB1.y,
      nodeB0.x - nodeA0.x, nodeB0.y - nodeA0.y,
      result,
    ))
      return result;
    return undefined;
  }
  /**
   * Compute fractional position (possibly outside 0..1) of the intersection of a horizontal line with an edge.
   * * If the edge is horizontal with (approximate) identical y, return the base node.
   * * If the edge is horizontal with different y, return `undefined`.
   * @param node0 base node of edge.
   * @param y y coordinate of the horizontal line.
   */
  public static horizontalScanFraction(node0: HalfEdge, y: number): number | undefined | HalfEdge {
    const node1 = node0.faceSuccessor;
    const dy = node1.y - node0.y;
    if (Geometry.isSameCoordinate(y, node0.y) && Geometry.isSameCoordinate(y, node1.y))
      return node0;
    if (Geometry.isSameCoordinate(dy, 0.0))
      return undefined;
    // parametric equation of line is (1-t)y0 + ty1 which is equal to y at the intersection so
    // (1-t)y0 + ty1 = y or t = (y-y0)/(y1-y0)
    return Geometry.conditionalDivideFraction(y - node0.y, dy);
  }
  /**
   * Compute fractional position (inside 0..1) of the intersection of a horizontal line with an edge.
   * * If fractional position is outside 0..1, return `undefined`.
   * * If the edge is horizontal return `undefined` (no test for horizontal at y).
   * @param node0 base node of edge.
   * @param y y coordinate of the horizontal line.
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
  /**
   * Copy various data from source to `this`.
   * @param source source half edge.
   * @param copyXYZ true to copy xyz coordinates.
   * @param copyVertexData true to copy data belonging to the vertex (i.e. the `i` member).
   * @param copyEdgeData true to copy data belonging to the edge (i.e. edge masks, `edgeTag`).
   * @param copyFaceData true to copy `faceTag`.
   */
  public copyDataFrom(
    source: HalfEdge, copyXYZ: boolean, copyVertexData: boolean, copyEdgeData: boolean, copyFaceData: boolean,
  ): void {
    if (copyXYZ) {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
    }
    if (copyVertexData)
      this.i = source.i;
    if (copyEdgeData)
      HalfEdge.transferEdgeProperties(source, this);
    if (copyFaceData)
      this.faceTag = source.faceTag;
  }
  /**
   * Is the instance's face loop a split-washer type face?
   * * A split-washer face contains at least one bridge edge.
   * * A bridge edge and its edge mate have the same `bridgeMask` and live in the same face loop.
   * * By connecting hole/outer loops with bridge edges, a split-washer face can represent a parity region.
   * @param bridgeMask mask preset on bridge edges (default is [[HalfEdgeMask.BRIDGE_EDGE]]).
   */
  public isSplitWasherFace(bridgeMask: HalfEdgeMask = HalfEdgeMask.BRIDGE_EDGE): boolean {
    if (!this.countMaskAroundFace(HalfEdgeMask.BRIDGE_EDGE))
      return false;
    const bridges = new OrderedSet<HalfEdge>((a: HalfEdge, b: HalfEdge) => a.id - b.id);
    let node: HalfEdge = this;
    do {
      if (node.isMaskSet(bridgeMask))
        bridges.add(node);
      node = node.faceSuccessor;
    } while (node !== this);
    if (bridges.size === 0)
      return false;
    for (const bridge of bridges) {
      if (!bridges.has(bridge.edgeMate) || !bridge.edgeMate.isMaskSet(bridgeMask))
        return false;
    }
    return true;
  }
}

/**
 * A HalfEdgeGraph has:
 * * An array of (pointers to) HalfEdge objects.
 * * A pool of masks for grab/drop used by algorithms.
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
  /**
   * Ask for a mask (from the graph's free pool) for caller's use.
   * @param clearInAllHalfEdges optionally clear the mask throughout the graph (default `true`).
   */
  public grabMask(clearInAllHalfEdges: boolean = true): HalfEdgeMask {
    const mask = this._maskManager.grabMask();
    if (clearInAllHalfEdges) {
      this.clearMask(mask);
    }
    return mask;
  }
  /** Return `mask` to the free pool. */
  public dropMask(mask: HalfEdgeMask) {
    this._maskManager.dropMask(mask);
  }
  /**
   * Create 2 half edges forming 2 vertices, 1 edge, and 1 face.
   * * The two half edges are joined as edgeMate pair.
   * * The two half edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * The two half edges are added to the graph's HalfEdge set.
   * @returns pointer to the first half edge created.
   */
  public createEdgeXYZXYZ(
    xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0,
    xB: number = 0, yB: number = 0, zB: number = 0, iB: number = 0,
  ): HalfEdge {
    return HalfEdge.createHalfEdgePairWithCoordinates(xA, yA, zA, iA, xB, yB, zB, iB, this.allHalfEdges);
  }
  /**
   * Create 2 half edges forming 2 vertices, 1 edge, and 1 face.
   * * The two half edges are joined as edgeMate pair.
   * * The two half edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * The two half edges are added to the graph's HalfEdge set.
   * * Coordinates are set to zero.
   * @param iA `i` property of the first created HalfEdge
   * @param iB `i` property of the second created HalfEdge
   * @returns pointer to the first half edge created, with `i` property set to iA.
   */
  public createEdgeIdId(iA: number = 0, iB: number = 0): HalfEdge {
    return HalfEdge.createHalfEdgePairWithCoordinates(0.0, 0.0, 0.0, iA, 0.0, 0.0, 0.0, iB, this.allHalfEdges);
  }
  /**
   * Create an edge from coordinates x,y,z connected to the graph at the vertex of the given `node`.
   * @returns pointer to the dangling node at x,y,z.
   */
  public createEdgeXYZHalfEdge(
    xA: number = 0,
    yA: number = 0,
    zA: number = 0,
    iA: number = 0,
    node: HalfEdge,
    iB: number = 0,
  ): HalfEdge {
    // Visualization can be found at geometry/internaldocs/Graph.md
    const a = HalfEdge.createHalfEdgePairWithCoordinates(xA, yA, zA, iA, node.x, node.y, node.z, iB, this.allHalfEdges);
    const b = a.faceSuccessor;
    HalfEdge.pinch(node, b);
    return a;
  }
  /**
   * Create an edge from the vertex of `nodeA` to the vertex of `nodeB`.
   * @returns pointer to the new half edge at the vertex of `nodeA`.
   */
  public createEdgeHalfEdgeHalfEdge(nodeA: HalfEdge, idA: number, nodeB: HalfEdge, idB: number = 0): HalfEdge {
    // visualization can be found at geometry/internaldocs/Graph.md
    const a = HalfEdge.createHalfEdgePairWithCoordinates(
      nodeA.x, nodeA.y, nodeA.z, idA, nodeB.x, nodeB.y, nodeB.z, idB, this.allHalfEdges,
    );
    const b = a.faceSuccessor;
    HalfEdge.pinch(nodeA, a);
    HalfEdge.pinch(nodeB, b);
    return a;
  }
  /**
   * Create 2 half edges forming 2 vertices, 1 edge, and 1 face
   * * The two half edges are joined as edgeMate pair.
   * * The two half edges are a 2-half-edge face loop in both the faceSuccessor and facePredecessor directions.
   * * The two half edges are added to the graph's HalfEdge set.
   * @returns pointer to the first half edge created, with coordinates `xyz0`.
   */
  public createEdgeXYAndZ(xyz0: XYAndZ, id0: number, xyz1: XYAndZ, id1: number): HalfEdge {
    return HalfEdge.createHalfEdgePairWithCoordinates(
      xyz0.x, xyz0.y, xyz0.z, id0, xyz1.x, xyz1.y, xyz1.z, id1, this.allHalfEdges,
    );
  }
  /**
   * Create a new vertex within the edge beginning at `base`.
   * * This creates two new nodes in their own vertex loop.
   * * If the base is `undefined`, create a single-edge loop.
   * * Existing nodes stay in their face and vertex loops and retain xyz and i values.
   * * Unlike [[pinch]], this breaks the edgeMate pairing of the input edge:
   * each node of the input edge gets a new node as its edge mate.
   * * On each side of the edge, if edgeTag is present, it is copied to the new node on that side.
   * @returns reference to the half edge created, the new face successor of `base`.
   */
  public splitEdge(base: undefined | HalfEdge, xA: number = 0, yA: number = 0, zA: number = 0, iA: number = 0): HalfEdge {
    return HalfEdge.splitEdge(base, xA, yA, zA, iA, this.allHalfEdges);
  }
  /**
   * Create a new sliver face "inside" an existing edge.
   * * This creates two nodes that are each face predecessor and successor to the other.
   * * Existing nodes stay in their face and vertex loops and retain xyz and i values.
   * * Unlike [[pinch]], this breaks the edgeMate pairing of the input edge:
   * each node of the input edge gets a new node as its edge mate.
   * * New nodes get the xyz and i values shared by the nodes in the vertex loops into which they are placed.
   * * New nodes' faceTag and edgeTag are `undefined`.
   * @returns reference to the half edge created in the vertex loop of baseA.
   */
  public splitEdgeCreateSliverFace(base: HalfEdge): HalfEdge {
    return HalfEdge.splitEdgeCreateSliverFace(base, this.allHalfEdges);
  }
  /**
   * Create a new vertex within the edge beginning at `base`, with coordinates specified by a fraction along the edge.
   * * This creates two new nodes in their own vertex loop.
   * * Existing nodes stay in their face and vertex loops and retain xyz and i values.
   * * Unlike [[pinch]], this breaks the edgeMate pairing of the input edge:
   * each node of the input edge gets a new node as its edge mate.
   * * On each side of the edge, if edgeTag is present, it is copied to the new node on that side.
   * @returns reference to the half edge created, the new face successor of `base`.
   */
  public splitEdgeAtFraction(base: HalfEdge, fraction: number): HalfEdge {
    return HalfEdge.splitEdge(
      base, base.fractionToX(fraction), base.fractionToY(fraction), base.fractionToZ(fraction), 0, this.allHalfEdges,
    );
  }
  /**
   * This is a destructor-like action that eliminates all inter-connections among the graph's nodes.
   * After this is called, the graph is unusable.
   */
  public decommission() {
    for (const node of this.allHalfEdges) {
      node.decommission();
    }
    this.allHalfEdges.length = 0;
    (this.allHalfEdges as any) = undefined;
  }
  /**
   * Create two nodes of a new edge.
   * @returns the reference to the new node at (x0,y0).
   */
  public addEdgeXY(x0: number, y0: number, x1: number, y1: number): HalfEdge {
    const baseNode = HalfEdge.createEdgeXYXY(this._numNodesCreated, x0, y0, this._numNodesCreated + 1, x1, y1);
    this._numNodesCreated += 2;
    this.allHalfEdges.push(baseNode);
    this.allHalfEdges.push(baseNode.faceSuccessor);
    return baseNode;
  }
  /** Clear selected `mask` bits in all nodes of the graph. */
  public clearMask(mask: HalfEdgeMask) {
    for (const node of this.allHalfEdges)
      node.maskBits &= ~mask;
  }
  /** Set selected `mask` bits in all nodes of the graph. */
  public setMask(mask: HalfEdgeMask) {
    for (const node of this.allHalfEdges)
      node.maskBits |= mask;
  }
  /** Toggle selected `mask` bits in all nodes of the graph. */
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
  /**
   * Return an array of LineSegment3d.
   * * The array has one segment per edge.
   * * The coordinates are taken from a node and its face successor.
   * * On each edge, the line segment starts at the HalfEdge with lower ID than its edgeMate.
   */
  public collectSegments(): LineSegment3d[] {
    const segments: LineSegment3d[] = [];
    for (const node of this.allHalfEdges) {
      if (node.id < node.edgeMate.id)
        segments.push(
          LineSegment3d.create(
            Point3d.create(node.x, node.y),
            Point3d.create(node.faceSuccessor.x, node.faceSuccessor.y),
          ),
        );
    }
    return segments;
  }
  /** Returns the number of vertex loops in a graph structure. */
  public countVertexLoops(): number {
    let count = 0;
    this.announceVertexLoops(
      (_graph: HalfEdgeGraph, _seed: HalfEdge) => {
        count++;
        return true;
      },
    );
    return count;
  }
  /** Returns the number of face loops in a graph structure. */
  public countFaceLoops(): number {
    let count = 0;
    this.announceFaceLoops(
      (_graph: HalfEdgeGraph, _seed: HalfEdge) => {
        count++;
        return true;
      },
    );
    return count;
  }
  /** Returns the number of face loops satisfying a filter function with mask argument. */
  public countFaceLoopsWithMaskFilter(filter: HalfEdgeAndMaskToBooleanFunction, mask: HalfEdgeMask): number {
    let count = 0;
    this.announceFaceLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge) => {
        if (filter(seed, mask))
          count++;
        return true;
      },
    );
    return count;
  }
  /** Returns an array of nodes, where each node represents a starting point of a vertex loop. */
  public collectVertexLoops(): HalfEdge[] {
    const returnArray: HalfEdge[] = [];
    this.announceVertexLoops(
      (_graph: HalfEdgeGraph, node: HalfEdge) => {
        returnArray.push(node);
        return true;
      },
    );
    return returnArray;
  }
  /** Returns an array of nodes, where each node represents a starting point of a face loop. */
  public collectFaceLoops(): HalfEdge[] {
    const returnArray: HalfEdge[] = [];
    this.announceFaceLoops(
      (_graph: HalfEdgeGraph, node: HalfEdge) => {
        returnArray.push(node);
        return true;
      },
    );
    return returnArray;
  }
  /**
   * Visit each vertex loop of the graph once.
   * * Call the `announceVertex` function.
   * * Continue search if `announceVertex(graph, node)` returns `true`.
   * * Terminate search if `announceVertex(graph, node)` returns `false`.
   * @param announceVertex function to apply at one node of each vertex.
   */
  public announceVertexLoops(announceVertex: GraphNodeFunction): void {
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
   * Visit each facet of the graph once.
   * * Call the `announceFace` function.
   * * Continue search if `announceFace(graph, node)` returns `true`.
   * * Terminate search if `announceFace(graph, node)` returns `false`.
   * @param announceFace function to apply at one node of each face.
   */
  public announceFaceLoops(announceFace: GraphNodeFunction): void {
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
   * Visit each edge of the graph once.
   * * Call the `announceEdge` function.
   * * The edge mate will NOT appear in an announceEdge call.
   * * Continue search if `announceEdge(graph, node)` returns `true`.
   * * Terminate search if `announceEdge(graph, node)` returns `false`.
   * @param announceEdge function to apply at one node of each edge.
   */
  public announceEdges(announceEdge: GraphNodeFunction): void {
    this.clearMask(HalfEdgeMask.VISITED);
    for (const node of this.allHalfEdges) {
      if (node.getMask(HalfEdgeMask.VISITED))
        continue;
      const mate = node.edgeMate;
      node.setMask(HalfEdgeMask.VISITED);
      mate.setMask(HalfEdgeMask.VISITED);
      if (!announceEdge(this, node))
        break;
    }
  }
  /**
   * Visit each half edge (node) of the graph once.
   * * Call the `announceNode` function.
   * * Continue search if `announceNode(graph, node)` returns `true`.
   * * Terminate search if `announceNode(graph, node)` returns `false`.
   * @param announceNode function to apply at each node.
   */
  public announceNodes(announceNode: GraphNodeFunction): void {
    for (const node of this.allHalfEdges) {
      if (!announceNode(this, node))
        break;
    }
  }
  /** Return the number of nodes in the graph. */
  public countNodes(): number {
    return this.allHalfEdges.length;
  }
  /** Apply transform to the xyz coordinates in the graph. */
  public transformInPlace(transform: Transform): void {
    for (const node of this.allHalfEdges) {
      transform.multiplyXYAndZInPlace(node);
    }
  }
  /**
   * Disconnect and delete all nodes that satisfy a filter condition.
   * @param deleteThisNode returns true to delete the corresponding node. Should act symmetrically on the edgeMate.
   * @returns the number of nodes deleted (twice the number of deleted edges).
   */
  public yankAndDeleteEdges(deleteThisNode: NodeFunction): number {
    const numTotal = this.allHalfEdges.length;
    let numAccepted = 0;
    for (let i = 0; i < numTotal; i++) {
      const candidate = this.allHalfEdges[i];
      if (!deleteThisNode(candidate))
        this.allHalfEdges[numAccepted++] = candidate; // overwrite a previously "deleted node"
      else
        candidate.yankFromVertexLoop(); // assume callback symmetry so we eventually yank the mate
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
