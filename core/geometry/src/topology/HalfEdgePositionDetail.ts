/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { HalfEdge } from "./Graph";
import { XYAndZ } from "../geometry3d/XYZProps";
import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";

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

  /** Copy (clones of) all data from other */
  public setFrom(other: HalfEdgePositionDetail) {
    this._node = other._node;
    this._xyz.setFromPoint3d(other._xyz);
    this._topo = other._topo;
    this._edgeFraction = other._edgeFraction;
    this._iTag = other._iTag;
    this._dTag = other._dTag;
  }
  /** reset to null topo state. */
  public resetAsUnknown() {
    this._node = undefined;
    this._topo = HalfEdgeTopo.None;
  }
  /**  Create with null data. */
  public static create(): HalfEdgePositionDetail {
    const detail = new HalfEdgePositionDetail(undefined, undefined, HalfEdgeTopo.None);
    return detail;
  }
  public getITag(): number | undefined { return this._iTag; }
  public setITag(value: number): void { this._iTag = value; }

  public getDTag(): number | undefined { return this._dTag; }
  public setDTag(value: number): void { this._dTag = value; }
  public getTopo(): HalfEdgeTopo { return this._topo; }

  /** Create with node, fraction along edge, marked as "HalfEdgeTopo.Edge".  Compute interpolated xyz on the edge */
  public static createEdgeAtFraction(node: HalfEdge, edgeFraction: number): HalfEdgePositionDetail {
    const node1 = node.faceSuccessor;
    const xyz = Point3d.create(
      Geometry.interpolate(node.x, edgeFraction, node1.x),
      Geometry.interpolate(node.y, edgeFraction, node1.y),
      Geometry.interpolate(node.z, edgeFraction, node1.z));
    return new HalfEdgePositionDetail(node, xyz, HalfEdgeTopo.Edge, edgeFraction);
  }

  /** reassign contents so this instance becomes a face hit.
   * @param node new node value. If missing, current node is left unchanged.
   * @param xyz new coordinates. if missing, current coordinates are left unchanged.
   */
  public resetAsFace(node?: HalfEdge, xyz?: XYAndZ): HalfEdgePositionDetail {
    this._topo = HalfEdgeTopo.Face;
    if (node)
      this._node = node;
    if (xyz)
      this._xyz.setFrom(xyz);
    return this;
  }

  /** reassign contents so this instance has dTag but no node or HalfEdgeTopo
   */
  public resetAsUndefinedWithTag(dTag: number): HalfEdgePositionDetail {
    this._topo = HalfEdgeTopo.None;
    this._dTag = 0;
    this._iTag = 0;
    this._dTag = dTag;
    this._node = undefined;
    return this;
  }

  /** reassign contents so this instance becomes an edge hit
   * @param node new node value.
   * @param edgeFraction new edge fraction.   xyz is recomputed from this edge and its face successor.
   */
  public resetAtEdgeAndFraction(node: HalfEdge, edgeFraction: number): HalfEdgePositionDetail {
    this._topo = HalfEdgeTopo.Edge;
    this._node = node;
    const nodeB = node.faceSuccessor;
    this._edgeFraction = edgeFraction;
    this._xyz.set(
      Geometry.interpolate(node.x, edgeFraction, nodeB.x),
      Geometry.interpolate(node.y, edgeFraction, nodeB.y),
      Geometry.interpolate(node.z, edgeFraction, nodeB.z),
    );
    return this;
  }

  /** Create at a node.
   * * Take xyz from the node.
   */
  public static createVertex(node: HalfEdge): HalfEdgePositionDetail {
    return new HalfEdgePositionDetail(node,
      Point3d.create(node.x, node.y, node.z), HalfEdgeTopo.Vertex);
  }

  /** Create with node and (optional) xyz, marked as "HalfEdgeTopo.Vertex"
   * * if the xyz is omitted, take from the node.
   */
  public resetAsVertex(node: HalfEdge): HalfEdgePositionDetail {
    this._topo = HalfEdgeTopo.Vertex;
    this._node = node;
    this._xyz.setFrom(node);
    return this;
  }

  /**
   * Return the (possibly undefined) edge fraction.
   */
  public get edgeFraction(): number | undefined {
    return this._edgeFraction;
  }

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

  public isAtXY(x: number, y: number): boolean {
    return this._topo !== HalfEdgeTopo.None && Geometry.isSameCoordinate(this.x, x) && Geometry.isSameCoordinate(this.y, y);

  }
}
