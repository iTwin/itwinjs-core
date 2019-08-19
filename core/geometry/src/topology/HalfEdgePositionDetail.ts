import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { HalfEdge } from "./Graph";

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Topology */
/**
 * Enumeration of categorization of "where" a HalfEdgePositionDetail is sitting in the graph.
 */
export enum HalfEdgeTopo {
  /** No known position */
  None = 0,
  /**  */
  Vertex = 1,
  Edge = 2,
  Face = 3,
}
/**
 * Description of a generalized position within a graph, categorized as:
 * * "at a certain node around a vertex"
 * * "at a fractional position along an edge
 * * "within a face"
 */
export class HalfEdgePositionDetail {
  /** the relevant node */
  private _node?: HalfEdge;
  /** The current coordinates */
  private _xyz: Point3d;
  /** fractional position along edge.   Only defined if the topo tag is `HalfEdgeTopo.Edge` */
  private _edgeFraction?: number;
  /** Enumeration of status vertex, edge, or face status. */
  private _topo: HalfEdgeTopo;
  /** first data tag */
  private _iTag?: number;
  /** second data tag */
  private _dTag?: number;
  /** Constructor.
   * * The point is CAPTURED.  (static `create` methods normally clone their inputs.)
   */
  private constructor(node: HalfEdge | undefined, xyz: Point3d | undefined, topo: HalfEdgeTopo, edgeFraction?: number, iTag?: number, _dTag?: number) {
    this._node = node;
    this._xyz = xyz !== undefined ? xyz : Point3d.create();
    this._topo = topo;
    this._edgeFraction = edgeFraction;
    this._iTag = iTag;
    this._dTag = _dTag;
  }
  /** Clone data into a new detail. */
  public clone(): HalfEdgePositionDetail {
    return new HalfEdgePositionDetail(this._node, this._xyz.clone(), this._topo, this._edgeFraction, this._iTag, this._dTag);
  }
  /** Create with node, coordinates, and a topo state */
  public static createTopo(node: HalfEdge, xyz: Point3d, topo: HalfEdgeTopo): HalfEdgePositionDetail {
    const detail = new HalfEdgePositionDetail(node, xyz, topo);
    return detail;
  }
  /**  Create with null data. */
  public static create(): HalfEdgePositionDetail {
    const detail = new HalfEdgePositionDetail(undefined, undefined, HalfEdgeTopo.None);
    return detail;
  }
  /** Create with null data except for a tag. */
  public createTag(iTag: number): HalfEdgePositionDetail {
    const detail = new HalfEdgePositionDetail(undefined, undefined, HalfEdgeTopo.None);
    return detail;
    this._iTag = iTag;
  }

  public getITag(): number | undefined { return this._iTag; }
  public setITag(value: number): void { this._iTag = value; }
  public incrementITag(step: number): void {
    if (this._iTag === undefined)
      this._iTag = 0;
    this._iTag += step;
  }

  public getDTag(): number | undefined { return this._dTag; }
  public setDTag(value: number): void { this._dTag = value; }
  public getTopo(): HalfEdgeTopo { return this._topo; }

  /** Create with node and coordinates, marked as "HalfEdgeTopo.Face" */
  public static createFace(node: HalfEdge, xyz: Point3d): HalfEdgePositionDetail {
    return new HalfEdgePositionDetail(node, xyz.clone(), HalfEdgeTopo.Face);
  }

  /** Create with node, xyz coordinates, and fraction along edge, marked as "HalfEdgeTopo.Edge" */
  public static createEdge(node: HalfEdge, xyz: Point3d, edgeFraction: number): HalfEdgePositionDetail {
    return new HalfEdgePositionDetail(node, xyz.clone(), HalfEdgeTopo.Edge, edgeFraction);
  }

  /** Create with node and (optional) xyz, marked as "HalfEdgeTopo.Vertex"
   * * if the xyz is omitted, take from the node.
   */
  public static createVertex(node: HalfEdge, xyz: Point3d): HalfEdgePositionDetail {
    return new HalfEdgePositionDetail(node,
      xyz !== undefined ? xyz.clone() : Point3d.create(node.x, node.y, node.z), HalfEdgeTopo.Vertex);
  }

  /** Return true if the node reference is defined. */
  public get isNodeIdNonNull(): boolean {
    return this._node !== undefined;
  }
  /**
   * Return the (possibly undefined) edge fraction.
   */
  public get edgeFraction(): number | undefined {
    return this._edgeFraction;
  }
  /** Return the (enumerated) `HalfEdgeTopo` */
  public get halfEdgeTopo(): HalfEdgeTopo { return this._topo; }

  /** Return true if this detail is marked as being within a face. */
  public get isFace(): boolean { return this._topo === HalfEdgeTopo.Face; }
  /** Return true if this detail is marked as being within an edge. */
  public get isEdge(): boolean { return this._topo === HalfEdgeTopo.Edge; }
  /** Return true if this detail is marked as being at a vertex. */
  public get isVertex(): boolean { return this._topo === HalfEdgeTopo.Vertex; }
  /** Return true if this detail has no vertex, edge, or face qualifier. */
  public get isUnclassified(): boolean { return this._topo === HalfEdgeTopo.None; }

  /** Return the node reference from this detail */
  public get node(): HalfEdge | undefined { return this._node; }
  /** Return the (clone of, or optional filled in result) coordinates from this detail. */
  public clonePoint(result?: Point3d): Point3d { return this._xyz.clone(result); }
  /** return a vector from this detail to `other`. */
  public vectorTo(other: HalfEdgePositionDetail, result?: Vector3d): Vector3d {
    return Vector3d.createStartEnd(this._xyz, other._xyz, result);
  }

  /** Return a HalfEdgePositionDetail positioned at this detail's edge mate.
   *   * The returned HalfEdgePositionDetail's edgeFraction is {1 - this->EdgeFraction ())
   *        to properly identify the "same" position relative to the other side.
   */
  public edgeMate(): HalfEdgePositionDetail {
    const result = this.clone();
    if (this._node === undefined)
      return result;
    result._node = this._node.edgeMate;
    if (this._edgeFraction !== undefined)
      result._edgeFraction = 1.0 - this._edgeFraction;
    return result;
  }

  /** Return the x coordinate of this detail. */
  public get x(): number { return this._xyz.x; }
  /** Return the y coordinate of this detail. */
  public get y(): number { return this._xyz.y; }
  /** Return the z coordinate of this detail. */
  public get z(): number { return this._xyz.z; }
  /*
    // If candidateKey is less than resultKey, replace resultPos and resultKey
    // by the candidate data.
    public updateMinimizer(
      HalfEdgePositionDetail & resultPos, number & resultKey,
  : HalfEdgePositionDetail & candidatePos, candidateKey: number
    ): boolean {
      if (candidateKey < resultKey) {
        resultKey = candidateKey;
        resultPos = candidatePos;
        return true;
      }
      return false;
    }
  */

  public updateMin(candidate: HalfEdgePositionDetail): boolean {
    if (candidate._dTag === undefined)
      return false;
    if (this._dTag === undefined || candidate._dTag < this._dTag) {
      this._dTag = candidate._dTag;
      return true;
    }
    return false;
  }

  public updateMax(candidate: HalfEdgePositionDetail): boolean {
    if (candidate._dTag === undefined)
      return false;
    if (this._dTag === undefined || candidate._dTag > this._dTag) {
      this._dTag = candidate._dTag;
      return true;
    }
    return false;
  }

  /**  Move pointer to mate on other side of edge.
   * * All other member data unchanged !!
   * * i.e. this is used by navigation code that will update other data parts itself.
   */
  public moveToEdgeMate(): void { this._node = this._node!.edgeMate; }
  /** Move the node reference to the face successor.
   * * All other member data unchanged !!
   * * i.e. this is used by navigation code that will update other data parts itself.
   */
  public moveToFaceSuccessor(): void { this._node = this._node!.faceSuccessor; }
  /** Move the node reference to the vertex successor.
   * * All other member data unchanged !!
   * * i.e. this is used by navigation code that will update other data parts itself.
   */
  public moveToVertexSuccessor(): void { this._node = this._node!.vertexSuccessor; }
  /** Move the node reference to the face predecessor.
   * * All other member data unchanged !!
   * * i.e. this is used by navigation code that will update other data parts itself.
   */
  public moveToFacePredecessor(): void { this._node = this._node!.facePredecessor; }
  /** Move the node reference to vertex face predecessor.
   * * All other member data unchanged !!
   * * i.e. this is used by navigation code that will update other data parts itself.
   */
  public moveToVertexPredecessor(): void { this._node = this._node!.vertexPredecessor; }

}
